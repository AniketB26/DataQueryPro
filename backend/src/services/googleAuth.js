/**
 * Google OAuth Service
 * 
 * Handles Google token verification and user info extraction.
 * Uses the google-auth-library for secure token validation.
 */

const { OAuth2Client } = require('google-auth-library');
const config = require('../config');

// Initialize Google OAuth client
const client = new OAuth2Client(config.google.clientId);

/**
 * Verify Google ID token and extract user information
 * @param {string} idToken - The ID token from Google Sign-In
 * @returns {Object} - User info (email, name, picture, googleId)
 */
async function verifyGoogleToken(idToken) {
    try {
        // Log the client ID being used (first 20 chars for security)
        console.log('🔐 Verifying Google token with client ID:', config.google.clientId?.substring(0, 20) + '...');

        if (!config.google.clientId) {
            throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables');
        }

        if (!idToken || typeof idToken !== 'string') {
            throw new Error('Invalid ID token format');
        }

        // Verify the token with Google
        const ticket = await client.verifyIdToken({
            idToken,
            audience: config.google.clientId,
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            throw new Error('Invalid token payload - no email found');
        }

        console.log('✅ Google token verified for email:', payload.email);

        // Extract user information from the token payload
        return {
            googleId: payload.sub,
            email: payload.email,
            emailVerified: payload.email_verified,
            fullName: payload.name,
            firstName: payload.given_name,
            lastName: payload.family_name,
            profilePicture: payload.picture,
        };
    } catch (error) {
        console.error('❌ Google token verification failed:', error.message);

        // Provide more specific error messages
        if (error.message.includes('Token used too late') || error.message.includes('expired')) {
            throw new Error('Google token has expired. Please try signing in again.');
        }
        if (error.message.includes('Invalid token signature') || error.message.includes('Wrong recipient')) {
            throw new Error('Invalid Google token. Please check that the Google Client ID matches on frontend and backend.');
        }
        if (error.message.includes('audience') || error.message.includes('aud')) {
            throw new Error('Google Client ID mismatch between frontend and backend.');
        }
        if (error.message.includes('Invalid value')) {
            throw new Error('Invalid Google token format. Please try signing in again.');
        }

        throw new Error(error.message || 'Google authentication failed');
    }
}

module.exports = {
    verifyGoogleToken,
};
