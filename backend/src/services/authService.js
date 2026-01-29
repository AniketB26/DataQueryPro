/**
 * Authentication Service
 * 
 * Handles user authentication logic including signup, login, and token management.
 * Uses MongoDB for persistent user storage.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @param {string} username - Username
 * @param {string} fullName - User's full name (optional)
 * @returns {Object} - User object without password
 */
async function signup(email, password, username, fullName = '') {
    try {
        console.log('📝 Signup attempt:', { email, username });

        // Check if user already exists
        let user = await User.findOne({ $or: [{ email }, { username }] });
        if (user) {
            console.log('❌ User already exists:', email);
            throw new Error('User with this email or username already exists');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Validate password strength
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        // Create new user
        user = new User({
            email,
            password,
            username,
            fullName: fullName || username
        });

        // Save user (password will be hashed by pre-save middleware)
        await user.save();
        console.log('✅ User created successfully:', { id: user._id, email: user.email, username: user.username });

        // Return user without password
        return user.toJSON();
    } catch (error) {
        console.error('❌ Signup error:', error.message);
        throw new Error(error.message);
    }
}

/**
 * Authenticate user and return token
 * @param {string} email - User email or username
 * @param {string} password - Plain text password
 * @returns {Object} - Token and user object
 */
async function login(email, password) {
    try {
        console.log('🔐 Login attempt:', email);

        // Find user by email or username
        const user = await User.findOne({
            $or: [{ email }, { username: email }]
        }).select('+password');

        if (!user || !user.isActive) {
            throw new Error('Invalid email/username or password');
        }

        // Verify password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            throw new Error('Invalid email/username or password');
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                username: user.username
            },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        // Return token and user
        return {
            token,
            user: user.toJSON()
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

/**
 * Get user by ID
 * @param {string} userId - User ID (MongoDB ObjectId)
 * @returns {Object|null} - User object without password or null
 */
async function getUserById(userId) {
    try {
        const user = await User.findById(userId);
        return user ? user.toJSON() : null;
    } catch (error) {
        throw new Error('Failed to fetch user');
    }
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, config.jwt.secret);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Object} - Updated user object
 */
async function updateProfile(userId, updates) {
    try {
        // Don't allow updating sensitive fields
        delete updates.password;
        delete updates.email;
        delete updates.username;

        const user = await User.findByIdAndUpdate(userId, updates, { new: true });
        return user ? user.toJSON() : null;
    } catch (error) {
        throw new Error('Failed to update profile');
    }
}

/**
 * Change user password
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password
 * @returns {boolean} - Success status
 */
async function changePassword(userId, currentPassword, newPassword) {
    try {
        // Get user with password
        const user = await User.findById(userId).select('+password');

        if (!user) {
            throw new Error('User not found');
        }

        // Check if user is OAuth user (no password)
        if (user.authProvider === 'google' && !user.password) {
            throw new Error('Cannot change password for Google accounts');
        }

        // Verify current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            throw new Error('Current password is incorrect');
        }

        // Validate new password
        if (newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters');
        }

        // Update password (will be hashed by pre-save middleware)
        user.password = newPassword;
        await user.save();

        console.log('✅ Password changed for user:', user.email);
        return true;
    } catch (error) {
        throw new Error(error.message || 'Failed to change password');
    }
}

/**
 * Login or register a user with Google OAuth
 * @param {string} idToken - Google ID token
 * @returns {Object} - Token and user object
 */
async function loginWithGoogle(idToken) {
    const { verifyGoogleToken } = require('./googleAuth');

    // Verify the Google token
    const googleUser = await verifyGoogleToken(idToken);
    console.log('🔐 Google login attempt:', googleUser.email);

    // Try to find existing user by googleId or email
    let user = await User.findOne({
        $or: [
            { googleId: googleUser.googleId },
            { email: googleUser.email }
        ]
    });

    if (user) {
        // Update existing user with Google info if needed
        if (!user.googleId) {
            user.googleId = googleUser.googleId;
            user.authProvider = 'google';
        }
        if (googleUser.profilePicture && !user.profilePicture) {
            user.profilePicture = googleUser.profilePicture;
        }
        user.lastLogin = new Date();
        await user.save();
        console.log('✅ Existing user logged in via Google:', user.email);
    } else {
        // Create new user from Google profile
        // Generate a unique username from email
        const baseUsername = googleUser.email.split('@')[0];
        let username = baseUsername;
        let counter = 1;

        // Ensure username is unique
        while (await User.findOne({ username })) {
            username = `${baseUsername}${counter}`;
            counter++;
        }

        user = new User({
            email: googleUser.email,
            username,
            fullName: googleUser.fullName,
            googleId: googleUser.googleId,
            authProvider: 'google',
            profilePicture: googleUser.profilePicture,
            lastLogin: new Date()
        });

        await user.save();
        console.log('✅ New user created via Google:', user.email);
    }

    // Generate JWT token
    const token = jwt.sign(
        {
            userId: user._id,
            email: user.email,
            username: user.username
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );

    return {
        token,
        user: user.toJSON()
    };
}

module.exports = {
    signup,
    login,
    loginWithGoogle,
    getUserById,
    verifyToken,
    updateProfile,
    changePassword
};
