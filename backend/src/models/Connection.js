/**
 * Connection Model
 * 
 * MongoDB schema for saved database connections
 */

const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500
        },
        type: {
            type: String,
            enum: ['mysql', 'postgresql', 'sqlite', 'mongodb', 'excel', 'csv'],
            required: true
        },
        // Database connection details
        host: String,
        port: Number,
        database: String,
        username: String,
        password: String, // Should be encrypted in production
        // File path for file-based databases
        filePath: String,
        // MongoDB connection string
        connectionString: String,
        
        // Schema information (cached)
        schema: mongoose.Schema.Types.Mixed,
        
        // Connection metadata
        isDefault: {
            type: Boolean,
            default: false
        },
        lastUsed: Date,
        useCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// Index for faster queries
connectionSchema.index({ userId: 1, createdAt: -1 });
connectionSchema.index({ userId: 1, type: 1 });

const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;
