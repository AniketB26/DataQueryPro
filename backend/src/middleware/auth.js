/**
 * Authentication Middleware
 * 
 * JWT-based authentication middleware for protecting routes.
 * Extracts and validates JWT tokens from Authorization header.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Middleware to authenticate requests using JWT
 * Expects: Authorization: Bearer <token>
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }
    
    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }
        return res.status(403).json({
            success: false,
            error: 'Invalid token'
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work with or without auth
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            req.user = decoded;
        } catch (error) {
            // Token invalid but continue without user
            req.user = null;
        }
    }
    
    next();
};

module.exports = {
    authenticateToken,
    optionalAuth
};
