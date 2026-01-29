/**
 * Global Error Handler Middleware
 * 
 * Catches and formats all errors consistently.
 * Provides detailed errors in development, generic in production.
 */

const config = require('../config');

/**
 * Custom error class for API errors
 */
class APIError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'APIError';
    }
}

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let details = null;
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
        details = err.details;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        message = 'File too large';
    }
    
    // Build response
    const response = {
        success: false,
        error: message
    };
    
    // Include stack trace in development
    if (config.nodeEnv === 'development') {
        response.stack = err.stack;
        if (details) {
            response.details = details;
        }
    }
    
    res.status(statusCode).json(response);
};

module.exports = {
    APIError,
    errorHandler
};
