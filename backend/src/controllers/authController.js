/**
 * Authentication Controller
 * 
 * Handles HTTP requests for authentication endpoints.
 */

const { authService } = require('../services');

/**
 * POST /api/auth/signup
 * Register a new user
 */
async function signup(req, res) {
    try {
        const { email, password, username, fullName } = req.body;

        // Validate required fields
        if (!email || !password || !username) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and username are required'
            });
        }

        const user = await authService.signup(email, password, username, fullName);

        // Auto-login after signup
        const { token, user: userData } = await authService.login(email, password);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: userData
        });
    } catch (error) {
        console.error('Signup error:', error);
        if (error.message.includes('already exists') ||
            error.message.includes('Invalid email') ||
            error.message.includes('Password must be') ||
            error.message.includes('duplicate key')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        return res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.'
        });
    }
}

/**
 * POST /api/auth/login
 * Login user and return token
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        const { token, user } = await authService.login(email, password);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid') || error.message.includes('password')) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        return res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
}

/**
 * GET /api/auth/me
 * Get current user info
 */
async function getMe(req, res) {
    try {
        const user = await authService.getUserById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('GetMe error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch user info'
        });
    }
}

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal, server-side cleanup)
 */
async function logout(req, res) {
    try {
        // In a production app, you might want to:
        // - Add token to a blacklist
        // - Close any active database connections for this user

        const { connectionService } = require('../services');
        await connectionService.closeUserConnections(req.user.userId);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        // Still return success - client should clear their token
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
}

/**
 * POST /api/auth/google
 * Login with Google OAuth
 */
async function googleLogin(req, res) {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({
                success: false,
                error: 'Google ID token is required'
            });
        }

        const { token, user } = await authService.loginWithGoogle(idToken);

        res.json({
            success: true,
            message: 'Google login successful',
            token,
            user
        });
    } catch (error) {
        console.error('Google login error:', error);
        return res.status(401).json({
            success: false,
            error: error.message || 'Google authentication failed'
        });
    }
}

/**
 * PUT /api/auth/profile
 * Update user profile (fullName)
 */
async function updateProfile(req, res) {
    try {
        const { fullName } = req.body;

        const updates = {};
        if (fullName !== undefined) {
            updates.fullName = fullName.trim();
        }

        const user = await authService.updateProfile(req.user.userId, updates);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to update profile'
        });
    }
}

/**
 * PUT /api/auth/password
 * Change user password
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        await authService.changePassword(req.user.userId, currentPassword, newPassword);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(400).json({
            success: false,
            error: error.message || 'Failed to change password'
        });
    }
}

module.exports = {
    signup,
    login,
    googleLogin,
    getMe,
    logout,
    updateProfile,
    changePassword
};
