// routes/index.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Import the database connection pool promise
const bcrypt = require('bcrypt'); // ***** ADDED: Require bcrypt for password comparison *****
const saltRounds = 10; // Cost factor for hashing (used in registration, but good to keep here)
// routes/index.js
// ... other requires ...
const { sendMail } = require('../utils/mailer'); // Adjust path if needed

console.log("[ROUTES] index.js loaded.");

// --- GET Home Page ---
router.get('/', (req, res) => {
    console.log("[ROUTES] Request received for GET /");
    res.render('home', { title: 'Welcome - Lost & Found' });
});

// --- USER AUTHENTICATION ROUTES --- // ***** SECTION ADDED *****

// GET route to display registration form (Assuming this exists from Step 41)
router.get('/register', (req, res) => {
    console.log("[ROUTES] Request received for GET /register");
    if (req.session.user) { // If already logged in, redirect away
        return res.redirect('/');
    }
    res.render('register', { title: 'Register' });
});

// POST route to handle registration submission (Assuming this exists from Step 41)
router.post('/register', async (req, res, next) => {
    console.log("[ROUTES] Request received for POST /register");
    if (req.session.user) { return res.redirect('/'); }

    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
        return res.status(400).render('register', { title: 'Register', error: 'All fields except phone are required.', formData: req.body });
    }
    if (password !== confirmPassword) {
        return res.status(400).render('register', { title: 'Register', error: 'Passwords do not match.', formData: req.body });
    }

    try {
        const [existingUsers] = await db.query("SELECT user_id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).render('register', { title: 'Register', error: 'Email address is already registered.', formData: req.body });
        }

        console.log(`[ROUTES] Hashing password for ${email}...`);
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log("[ROUTES] Password hashed.");

        const sql = "INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)";
        const [result] = await db.query(sql, [name, email, phone || null, hashedPassword]);
        console.log(`[ROUTES] User registered successfully. User ID: ${result.insertId}, Email: ${email}`);

        res.redirect('/login?registered=success');

    } catch (err) {
        console.error("[ROUTES] Error during registration:", err);
        next(err);
    }
});


// --- LOGIN AND LOGOUT ROUTES --- // ***** ADDED FROM STEP 45 *****

// GET route to display login form
router.get('/login', (req, res) => {
    console.log("[ROUTES] Request received for GET /login");
    if (req.session.user) { // If already logged in, redirect home
        return res.redirect('/');
    }

    // Check for messages from query string (e.g., after registration)
    let successMessage = null;
    let errorMessage = null; // Add error message handling too
    if (req.query.registered === 'success') {
        successMessage = 'Registration successful! Please login.';
    }
    if (req.query.message) { // General message display
        errorMessage = req.query.message; // Use error for messages like "please login"
    }

    res.render('login', { title: 'Login', successMessage: successMessage, errorMessage: errorMessage });
});

// POST route to handle login submission
router.post('/login', async (req, res, next) => {
    console.log("[ROUTES] Request received for POST /login");
    if (req.session.user) { // If already logged in
        return res.redirect('/');
    }

    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).render('login', {
            title: 'Login', error: 'Email and password are required.', formData: req.body
        });
    }

    try {
        // Find user by email
        console.log(`[ROUTES] Looking up user by email: ${email}`);
        const sql = "SELECT user_id, name, email, password_hash FROM users WHERE email = ?";
        const [users] = await db.query(sql, [email]);

        // User not found
        if (users.length === 0) {
            console.warn(`[ROUTES] Login failed: User not found (${email})`);
            return res.status(401).render('login', { // 401 Unauthorized
                title: 'Login', error: 'Incorrect email or password.', formData: req.body
            });
        }

        const user = users[0];

        // Check if password_hash exists (important if column allows NULL)
        if (!user.password_hash) {
             console.error(`[ROUTES] Login failed: User ${email} has no password set.`);
             return res.status(401).render('login', {
                 title: 'Login', error: 'Account error. Please contact support.', formData: req.body
             });
        }

        // Compare submitted password with stored hash
        console.log(`[ROUTES] Comparing password for user: ${email}`);
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            // Passwords match - Login successful
            console.log(`[ROUTES] Password match successful for user: ${email} (ID: ${user.user_id})`);

            // Store user information in session (WITHOUT password hash)
            req.session.user = {
                user_id: user.user_id,
                name: user.name,
                email: user.email
                // Add other non-sensitive fields if needed (e.g., role)
            };

            // Regenerate session ID for security after login
            req.session.save((err) => {
                if (err) {
                    return next(err);
                }
                // Redirect to home page after successful login
                console.log("[ROUTES] Session saved, redirecting to /");
                res.redirect('/');
            });

        } else {
            // Passwords don't match
            console.warn(`[ROUTES] Login failed: Incorrect password for user (${email})`);
            return res.status(401).render('login', { // 401 Unauthorized
                title: 'Login', error: 'Incorrect email or password.', formData: req.body
            });
        }

    } catch (err) {
        console.error("[ROUTES] Error during login:", err);
        next(err); // Pass to general error handler
    }
});

// GET route for logout
router.get('/logout', (req, res, next) => {
    console.log("[ROUTES] Request received for GET /logout");
    if (req.session) {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error("[ROUTES] Error destroying session:", err);
                return next(err); // Pass error
            } else {
                console.log("[ROUTES] Session destroyed successfully.");
                // Redirect to home page after logout
                res.redirect('/');
            }
        });
    } else {
        // No session? Just redirect home
        res.redirect('/');
    }
});

// --- END USER AUTHENTICATION ROUTES --- // ***** END ADDED SECTION *****


// Example: Test route for DB query (Can be removed later)
router.get('/testdb', async (req, res, next) => {
    console.log("[ROUTES] Request received for GET /testdb");
    try {
        const [results, fields] = await db.query('SELECT 1 + 1 AS solution');
        console.log("[ROUTES] DB Query Result:", results);
        res.json({ message: 'DB connection test successful!', result: results[0].solution });
    } catch (err) {
        console.error("[ROUTES] Error querying database:", err);
        next(err);
    }
});

// --- REPORTING ROUTES ---

// GET route to SHOW the report lost item form
router.get('/report-lost', (req, res) => {
    console.log("[ROUTES] Request received for GET /report-lost");
    res.render('report_lost', { title: 'Report a Lost Item' });
});

// POST route to HANDLE the lost item form submission
router.post('/report-lost', async (req, res, next) => {
    // *** NOTE: This still uses hardcoded userId = 1. Needs update from Step 47 ***
    console.log("[ROUTES] Request received for POST /report-lost");
    const { item_name, category, description, lost_date, lost_location } = req.body;
    if (!item_name || !category || !lost_date || !lost_location) {
        return res.status(400).render('report_lost', { title: 'Report a Lost Item', error: 'Please fill out all required fields.', formData: req.body });
    }
    const userId = 1; // <<< HARDCODED - Needs changing later
    const status = 'Reported';
    try {
        const sql = `INSERT INTO lost_items (user_id, item_name, category, description, lost_date, lost_location, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(sql, [userId, item_name, category, description, lost_date, lost_location, status]);
        console.log(`[ROUTES] Lost item inserted successfully. Insert ID: ${result.insertId}`);
        res.redirect('/lost-items'); // Redirect to lost items list
    } catch (err) {
        console.error("[ROUTES] Error inserting lost item into database:", err);
        next(err);
    }
});

// GET route to SHOW the report found item form
router.get('/report-found', (req, res) => {
    console.log("[ROUTES] Request received for GET /report-found");
    res.render('report_found', { title: 'Report a Found Item' });
});

// POST route to HANDLE the found item form submission
router.post('/report-found', async (req, res, next) => {
    // *** NOTE: This still uses hardcoded userId = 2. Needs update from Step 47 ***
    console.log("[ROUTES] Request received for POST /report-found");
    const { item_name, category, description, found_date, found_location } = req.body;
    if (!item_name || !category || !found_date || !found_location) {
        return res.status(400).render('report_found', { title: 'Report a Found Item', error: 'Please fill out all required fields.', formData: req.body });
    }
    const userId = 2; // <<< HARDCODED - Needs changing later
    const status = 'Available';
    try {
        const sql = `INSERT INTO found_item (user_id, item_name, category, description, found_date, found_location, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.query(sql, [userId, item_name, category, description, found_date, found_location, status]);
        console.log(`[ROUTES] Found item inserted successfully. Insert ID: ${result.insertId}`);
        res.redirect('/found-items'); // Redirect to found items list
    } catch (err) {
        console.error("[ROUTES] Error inserting found item into database:", err);
        next(err);
    }
});

// --- VIEWING AND CLAIMING ROUTES ---

// Route to display FOUND items
router.get('/found-items', async (req, res, next) => {
    console.log("[ROUTES] Request received for GET /found-items");

    // Handle feedback messages (e.g., after claim attempt)
    let successMessage = null;
    let errorMessage = null;
    if (req.query.claim_status === 'success') {
        successMessage = 'Your claim has been submitted successfully and is pending review.';
    } else if (req.query.claim_status === 'already_claimed') {
        errorMessage = 'You have already submitted a claim for this item.';
    }

    try {
        const sql = `SELECT found_id, item_name, category, description, found_date, found_location, status, reported_at
                     FROM found_item
                     WHERE status = 'Available' OR status = 'Claim Pending'
                     ORDER BY reported_at DESC`;
        const [foundItems] = await db.query(sql);
        console.log(`[ROUTES] Found ${foundItems.length} available/pending found items.`);

        res.render('list_items', {
            title: 'Available Found Items',
            items: foundItems,
            type: 'found',
            successMessage: successMessage, // Pass messages to view
            errorMessage: errorMessage
        });
    } catch (err) {
        console.error("[ROUTES] Error fetching found items:", err);
        next(err);
    }
});

// Route to handle a claim submission for a found item
// routes/index.js

// Route to handle a claim submission for a found item
router.post('/claim/:found_id', async (req, res, next) => {
    // --- AUTH CHECK (Added) ---
    if (!req.session.user) {
        console.warn("[ROUTES] Unauthorized claim attempt: User not logged in.");
        return res.redirect('/login?message=Please login to claim items');
    }
    // --- END AUTH CHECK ---

    const { found_id } = req.params;
    const foundIdInt = parseInt(found_id, 10);

    // Use the logged-in user's ID (Modified)
    const claimingUserId = req.session.user.user_id;
    console.log(`[ROUTES] Request received for POST /claim/${foundIdInt} by user ID: ${claimingUserId}`); // Updated log

    // Input validation for found_id
    if (isNaN(foundIdInt) || foundIdInt <= 0) {
        console.error("[ROUTES] Invalid found_id received for claim.");
        return res.status(400).send("Invalid item ID provided.");
    }

    try {
        console.log(`[ROUTES] Checking status of found_item with ID: ${foundIdInt}`);
        const [itemCheck] = await db.query("SELECT status FROM found_item WHERE found_id = ?", [foundIdInt]);

        if (itemCheck.length === 0) { /* ... Item not found handling ... */ return res.status(404).send("Item not found."); }
        if (itemCheck[0].status !== 'Available') { /* ... Item not available handling ... */ return res.status(400).send(`This item is no longer available...`); }

        const [existingClaim] = await db.query("SELECT claim_id FROM claim_requests WHERE user_id = ? AND found_id = ?", [claimingUserId, foundIdInt]);
        if (existingClaim.length > 0) { /* ... Duplicate claim handling ... */ return res.redirect('/found-items?claim_status=already_claimed'); }

        console.log(`[ROUTES] Inserting claim request for item ${foundIdInt} by user ${claimingUserId}.`);
        const insertSql = `INSERT INTO claim_requests (user_id, found_id) VALUES (?, ?)`;
        // Use the 'claimingUserId' variable obtained from the session
        const [result] = await db.query(insertSql, [claimingUserId, foundIdInt]);
        console.log(`[ROUTES] Claim request inserted successfully. Claim ID: ${result.insertId}`);

        await db.query("UPDATE found_item SET status = 'Claim Pending' WHERE found_id = ?", [foundIdInt]);
        console.log(`[ROUTES] Status updated for item ${foundIdInt}.`);

        res.redirect('/found-items?claim_status=success');

    } catch (err) {
        console.error("[ROUTES] Error processing claim request:", err);
        if (err.code === 'ER_DUP_ENTRY') { return res.redirect('/found-items?claim_status=already_claimed'); }
        next(err);
    }
});
// Route to display LOST items
router.get('/lost-items', async (req, res, next) => {
    // *** NOTE: Removed the duplicated definition ***
    console.log("[ROUTES] Request received for GET /lost-items");
    try {
        const sql = `SELECT item_id, item_name, category, description, lost_date, lost_location, status, reported_at
                     FROM lost_items
                     WHERE status IS NULL OR status NOT IN ('Matched', 'Returned', 'Found', 'Closed')
                     ORDER BY reported_at DESC`;
        const [lostItems] = await db.query(sql);
        console.log(`[ROUTES] Found ${lostItems.length} active lost items.`);
        res.render('list_items', { title: 'Reported Lost Items', items: lostItems, type: 'lost' });
    } catch (err) {
        console.error("[ROUTES] Error fetching lost items:", err);
        next(err);
    }
});


// --- ADMIN SECTION ---

// Route to display pending claims for admin review
router.get('/admin/claims', async (req, res, next) => {
    console.log("[ROUTES] Request received for GET /admin/claims");
    try {
        const sql = `SELECT cr.claim_id, cr.requested_at, cr.status AS claim_status, u.user_id, u.name AS claimant_name, u.email AS claimant_email, fi.found_id, fi.item_name, fi.status AS item_status
                     FROM claim_requests cr
                     LEFT JOIN users u ON cr.user_id = u.user_id
                     LEFT JOIN found_item fi ON cr.found_id = fi.found_id
                     WHERE cr.status = 'pending'
                     ORDER BY cr.requested_at ASC`;
        const [claims] = await db.query(sql);
        res.render('admin_claims', { title: 'Admin - Manage Claims', claims: claims });
    } catch (err) {
        console.error("[ROUTES][Admin] Error fetching claims:", err);
        next(err);
    }
});

// Route to handle approving or rejecting a claim
router.post('/admin/claims/update/:claim_id', async (req, res, next) => {
    const { claim_id } = req.params;
    const { action } = req.body;
    const claimIdInt = parseInt(claim_id, 10);
    console.log(`[ROUTES][Admin] Request received to ${action} claim ID: ${claimIdInt}`);

    if (isNaN(claimIdInt) || claimIdInt <= 0) { return res.status(400).send("Invalid claim ID."); }
    if (action !== 'approve' && action !== 'reject') { return res.status(400).send("Invalid action."); }

    let newStatus = (action === 'approve') ? 'Approved' : 'Rejected';

    try {
        const updateSql = "UPDATE claim_requests SET status = ? WHERE claim_id = ? AND status = 'pending'";
        const [result] = await db.query(updateSql, [newStatus, claimIdInt]);
        if (result.affectedRows > 0) {
            console.log(`[ROUTES][Admin] Claim ${claimIdInt} status updated to ${newStatus}. Trigger should handle item status.`);
        } else {
            console.warn(`[ROUTES][Admin] Claim ${claimIdInt} not updated. Maybe not pending?`);
        }
        res.redirect('/admin/claims');
    } catch (err) {
        console.error(`[ROUTES][Admin] Error updating claim ${claimIdInt}:`, err);
        next(err);
    }
});

// Route to display items currently in escrow
router.get('/admin/escrow', async (req, res, next) => {
    console.log("[ROUTES][Admin] Request received for GET /admin/escrow");
    try {
        const sql = `SELECT e.escrow_id, e.status AS escrow_status, e.claimed_at AS entered_escrow_at, e.released_at, fi.found_id, fi.item_name, u.name AS claimant_name
                     FROM escrow e
                     JOIN found_item fi ON e.found_id = fi.found_id
                     LEFT JOIN claim_requests cr ON fi.found_id = cr.found_id AND cr.status = 'Approved'
                     LEFT JOIN users u ON cr.user_id = u.user_id
                     WHERE e.status = 'Holding'
                     ORDER BY e.claimed_at DESC`;
        const [escrowItems] = await db.query(sql);
        res.render('admin_escrow', { title: 'Admin - Escrow Management', escrowItems: escrowItems });
    } catch (err) {
        console.error("[ROUTES][Admin] Error fetching escrow items:", err);
        next(err);
    }
});

// Route to handle releasing an item from escrow
// routes/index.js

// Route to handle releasing an item from escrow
router.post('/admin/escrow/release/:escrow_id', async (req, res, next) => {
    const { escrow_id } = req.params;
    const escrowIdInt = parseInt(escrow_id, 10);
    console.log(`[ROUTES][Admin] Request received to release escrow ID: ${escrowIdInt}`);

    if (isNaN(escrowIdInt) || escrowIdInt <= 0) { return res.status(400).send("Invalid escrow ID."); }

    try {
        // --- Get Escrow & User Info BEFORE updating ---
        // We need user email and item name for the notification
        const escrowInfoSql = `
            SELECT
                e.found_id,
                fi.item_name,
                u.email AS claimant_email,
                u.name AS claimant_name
            FROM escrow e
            JOIN found_item fi ON e.found_id = fi.found_id
            LEFT JOIN claim_requests cr ON fi.found_id = cr.found_id AND cr.status = 'Approved'
            LEFT JOIN users u ON cr.user_id = u.user_id
            WHERE e.escrow_id = ? AND e.status = 'Holding'`; // Only fetch if holding

        const [escrowInfos] = await db.query(escrowInfoSql, [escrowIdInt]);

        if (escrowInfos.length === 0) {
             console.warn(`[ROUTES][Admin] Escrow item ${escrowIdInt} not found or not in 'Holding' status before update attempt.`);
             return res.redirect('/admin/escrow?message=Item already released or not found');
        }
        const escrowInfo = escrowInfos[0];

        // --- Update escrow status to 'Released' ---
        const updateSql = `UPDATE escrow SET status = 'Released', released_at = NOW() WHERE escrow_id = ? AND status = 'Holding'`;
        const [result] = await db.query(updateSql, [escrowIdInt]);

        if (result.affectedRows > 0) {
            console.log(`[ROUTES][Admin] Escrow item ${escrowIdInt} marked as Released.`);

            // --- Send Email Notification ---
            if (escrowInfo.claimant_email) {
                // routes/index.js

// Inside router.post('/admin/escrow/release/:escrow_id', ...)
// Inside the try { ... } block
// Inside the if (result.affectedRows > 0) { ... } block
// Inside the if (escrowInfo.claimant_email) { ... } block

try {
    await sendMail({
        to: escrowInfo.claimant_email,
        subject: `Update on Your Claimed Item: ${escrowInfo.item_name}`,

        // --- MODIFIED TEXT BODY ---
        text: `Dear ${escrowInfo.claimant_name || 'Claimant'},

This email confirms that your claimed item, "${escrowInfo.item_name}", has been processed and marked as released by our team on ${new Date().toLocaleDateString()}.

You can now collect your item from the Lost and Found Department.

Please bring proof of identification when collecting your item.

Regards,
Lost & Found Administration`,

        // --- MODIFIED HTML BODY ---
        html: `
            <p>Dear ${escrowInfo.claimant_name || 'Claimant'},</p>
            <p>This email confirms that your claimed item, "<b>${escrowInfo.item_name}</b>", has been processed and marked as released by our team on ${new Date().toLocaleDateString()}.</p>
            <p>You can now collect your item from the <b>Lost and Found Department</b>.</p>
            <p>Please bring proof of identification when collecting your item.</p>
            <hr>
            <p>Regards,<br>Lost & Found Administration</p>
        `
    });
    console.log(`[ROUTES][Admin] Release notification email sent to ${escrowInfo.claimant_email}`);
} catch (emailError) {
    console.error(`[ROUTES][Admin] Failed to send release notification email for escrow ${escrowIdInt}:`, emailError);
    // Don't block the main process, just log the error. Maybe add a flash message later.
}
// ... rest of the code ...
            } else {
                 console.warn(`[ROUTES][Admin] Cannot send release notification for escrow ${escrowIdInt}: No claimant email found.`);
            }
            // --- End Send Email ---

        } else {
            console.warn(`[ROUTES][Admin] Escrow item ${escrowIdInt} not updated during release attempt. Maybe already released?`);
        }

        // Redirect back to the escrow list
        res.redirect('/admin/escrow');

    } catch (err) {
        console.error(`[ROUTES][Admin] Error releasing escrow item ${escrowIdInt}:`, err);
        next(err);
    }
});
module.exports = router; // Export the router object