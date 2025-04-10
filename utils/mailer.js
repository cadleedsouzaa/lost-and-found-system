// utils/mailer.js
const nodemailer = require('nodemailer');

// Create a transporter object using SMTP transport or service-specific config
// Reads credentials from environment variables
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10), // Default to 587 if not set
    secure: parseInt(process.env.EMAIL_PORT || '587', 10) === 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Optional: Add TLS options if needed, e.g. for self-signed certs (not recommended for production)
    // tls: {
    //     rejectUnauthorized: false
    // }
});

// Verify connection configuration (optional, good for debugging)
transporter.verify(function (error, success) {
    if (error) {
        console.error('[MAILER] Error verifying email transporter:', error);
    } else {
        console.log('[MAILER] Email server is ready to take messages');
    }
});

/**
 * Sends an email.
 * @param {string} to Recipient email address.
 * @param {string} subject Email subject line.
 * @param {string} text Plain text body.
 * @param {string} html HTML body (optional).
 * @returns {Promise<object>} Promise resolving with info about the sent message.
 */
const sendMail = async ({ to, subject, text, html }) => {
    console.log(`[MAILER] Attempting to send email to ${to} with subject: ${subject}`);
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM, // Sender address from .env
            to: to, // List of receivers
            subject: subject, // Subject line
            text: text, // Plain text body
            html: html, // HTML body (optional)
        });
        console.log(`[MAILER] Message sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[MAILER] Error sending email to ${to}:`, error);
        throw error; // Re-throw error to be caught by caller
    }
};

module.exports = { sendMail };