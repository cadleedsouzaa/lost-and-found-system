// server.js (Full Structure Setup)
console.log("[SERVER] Starting script...");
// server.js
require('dotenv').config(); // Add this near the top
// ... rest of requires ...

const express = require('express');
const bodyParser = require('body-parser'); // Add body-parser back
const path = require('path');             // Add path back
console.log("[SERVER] Required core modules.");
const session = require('express-session');
const FileStore = require('session-file-store')(session);

// --- Load DB ---
let db;
try {
    console.log("[SERVER] Attempting to load db.js...");
    db = require('./db'); // Load the db module
    console.log('[SERVER] db.js loaded.');
} catch (dbError) {
    console.error('❌ [SERVER] Critical error loading db.js:', dbError);
    // Decide if you want to proceed without DB
}
// --- End Load DB ---

// --- Load Routes (placeholder for now) ---
// We will create routes/index.js next
const mainRoutes = require('./routes/index'); // Require the routes file
console.log("[SERVER] Loaded routes from routes/index.js");
// --- End Load Routes ---


const app = express();
console.log("[SERVER] Created Express app.");
const port = process.env.PORT || 3000;

// --- Middleware ---
console.log("[SERVER] Setting up middleware...");
// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
console.log("[SERVER]  - Body Parser configured.");

// View Engine Setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Tell Express where views are
console.log("[SERVER]  - View engine (EJS) configured.");

// Static Files Middleware (CSS, client-side JS, images)
app.use(express.static(path.join(__dirname, 'public'))); // Serve files from 'public' folder
console.log("[SERVER]  - Static files middleware configured for 'public' folder.");
// --- End Middleware ---


// --- Mount Routes ---
console.log("[SERVER] Mounting main routes...");
// Should be near the top, after requires and before routes
app.use(express.static(path.join(__dirname, 'public')));
// --- Session Configuration ---
console.log("[SERVER] Configuring session middleware...");
app.use(session({
    store: new FileStore({
        path: './sessions', // Creates a 'sessions' folder for storing data
        logFn: function(){} // Suppress session-file-store logging if desired
    }),
    secret: 'Thisisthesecretfordbms', // ***** CHANGE THIS SECRET *****
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
        // secure: process.env.NODE_ENV === 'production', // Use true in production with HTTPS
        secure: false, // For local development (HTTP)
        maxAge: 1000 * 60 * 60 * 24 // Example: 1 day expiry
        // httpOnly: true // Recommended for security (prevents client-side JS access)
    }
}));
console.log("[SERVER] Session middleware configured.");

// Middleware to make session user available in templates
app.use((req, res, next) => {
    // This makes 'currentUser' available in all your EJS files
    res.locals.currentUser = req.session.user;
    next();
});
console.log("[SERVER] Session user middleware added to res.locals.");
app.use('/', mainRoutes); // Use the routes defined in routes/index.js for the base path '/'
console.log("[SERVER] Main routes mounted.");
// --- End Mount Routes ---


// --- Error Handling ---
console.log("[SERVER] Setting up error handlers...");
// Catch 404 (Not Found) errors - Placed AFTER routes
app.use((req, res, next) => {
    console.log(`[SERVER] 404 Handler reached for path: ${req.path}`);
    // Render a 404 page later
    res.status(404).send("Error 404: Page Not Found");
});

// General error handler - Placed last
app.use((err, req, res, next) => {
    console.error('[SERVER] General Error Handler Caught:');
    console.error(err.stack);
    // Render a generic error page later
    res.status(500).send('Error 500: Internal Server Error');
});
console.log("[SERVER] Error handlers set up.");
// --- End Error Handling ---


// --- Start Server ---
app.listen(port, () => {
  console.log(`✅ [SERVER] Express server listening on http://localhost:${port}`);
});

console.log("[SERVER] End of synchronous script.");