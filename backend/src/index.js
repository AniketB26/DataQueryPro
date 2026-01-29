/**
 * DataQuery Pro - Main Application Entry Point
 * 
 * Express server setup with middleware, routes, and error handling.
 * Provides natural language database querying powered by OpenAI.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import MongoDB connection
const { connectMongoDB } = require('./db/mongodb');

// Import routes
const authRoutes = require('./routes/auth');
const dbRoutes = require('./routes/db');
const chatRoutes = require('./routes/chat');
const historyRoutes = require('./routes/history');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// =================================
// Security Middleware
// =================================

// Helmet for security headers
app.use(helmet());

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// =================================
// Body Parsing Middleware
// =================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =================================
// Create Upload Directory
// =================================

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// =================================
// Routes
// =================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/history', historyRoutes);

// =================================
// Error Handling
// =================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Global error handler (must be last, with 4 parameters)
app.use(errorHandler);

// =================================
// Server Startup
// =================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Connect to MongoDB
    await connectMongoDB();

    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🚀 DataQuery Pro Backend Server                 ║
║                                                   ║
║   Running on: http://localhost:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}                    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
    });
};

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = app;
