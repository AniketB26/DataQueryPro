/**
 * Authentication Routes
 * 
 * POST /api/auth/signup - Register a new user
 * POST /api/auth/login  - Login and get token
 * GET  /api/auth/me     - Get current user info
 * POST /api/auth/logout - Logout user
 */

const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);

// Protected routes
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);
router.put('/profile', authenticateToken, authController.updateProfile);
router.put('/password', authenticateToken, authController.changePassword);

module.exports = router;
