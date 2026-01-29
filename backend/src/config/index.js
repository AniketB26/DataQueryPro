/**
 * Configuration Module
 * 
 * Centralized configuration management for the application.
 * Loads environment variables and provides defaults.
 */

require('dotenv').config();

const config = {
    // Server settings
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // JWT settings
    jwt: {
        secret: process.env.JWT_SECRET || 'default-secret-change-me',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },

    // Groq AI settings (OpenAI-compatible API)
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        baseUrl: 'https://api.groq.com/openai/v1',
        maxTokens: 2000,
        temperature: 0.1 // Low temperature for consistent query generation
    },

    // File upload settings
    upload: {
        dir: process.env.UPLOAD_DIR || './uploads',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800 // 50MB
    },

    // MongoDB settings
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dataquery-pro',
        user: process.env.MONGODB_USER,
        password: process.env.MONGODB_PASSWORD
    },

    // CORS settings
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
    },

    // Session settings
    session: {
        secret: process.env.SESSION_SECRET || 'session-secret-change-me'
    },

    // Google OAuth settings
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
};

// Validate required configuration
const validateConfig = () => {
    const required = ['groq.apiKey'];
    const missing = [];

    required.forEach(key => {
        const keys = key.split('.');
        let value = config;
        keys.forEach(k => {
            value = value?.[k];
        });
        if (!value) {
            missing.push(key);
        }
    });

    if (missing.length > 0) {
        console.warn(`⚠️  Missing required configuration: ${missing.join(', ')}`);
        console.warn('Some features may not work correctly.');
    }
};

validateConfig();

module.exports = config;
