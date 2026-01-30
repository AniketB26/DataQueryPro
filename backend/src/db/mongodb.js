/**
 * MongoDB Connection Module
 * 
 * Handles connection to MongoDB with error handling
 */

const mongoose = require('mongoose');
const config = require('../config');

const connectMongoDB = async () => {
    try {
        const mongoUri = config.mongodb.uri;

        if (!mongoUri) {
            throw new Error('MongoDB URI not configured');
        }

        const conn = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            w: 'majority'
        });

        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB connection failed: ${error.message}`);
        console.error('Make sure MongoDB is running on the configured URI.');
        // Don't exit - allow server to run without MongoDB for now
        // In production, you should exit here
        return null;
    }
};

const disconnectMongoDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
    } catch (error) {
        console.error('MongoDB disconnection error:', error.message);
    }
};

module.exports = {
    connectMongoDB,
    disconnectMongoDB
};
