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

// Trust proxy for rate limiting behind Render's load balancer
app.set('trust proxy', 1);

// =================================
// Security Middleware
// =================================

// Parse allowed origins from env (supports comma-separated list)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, '')); // Remove trailing slashes

// CORS configuration — must come BEFORE helmet so preflight OPTIONS are handled
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        // Strip trailing slash from incoming origin for comparison
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (allowedOrigins.includes(cleanOrigin)) {
            return callback(null, cleanOrigin);
        }
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Explicitly handle preflight OPTIONS for all routes
app.options('*', cors());

// Helmet for security headers
// crossOriginOpenerPolicy must be 'same-origin-allow-popups' to allow
// Google Identity Services popup to communicate via window.postMessage
app.use(helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false, // Required for Google GIS script loading
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

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
