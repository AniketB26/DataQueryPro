/**
 * Query History Model
 * 
 * MongoDB schema for storing user's chat queries and results
 */

const mongoose = require('mongoose');

const queryHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        connectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Connection',
            required: true
        },
        // Original natural language query
        naturalQuery: {
            type: String,
            required: true
        },
        // Generated SQL/MongoDB query
        generatedQuery: {
            type: String,
            required: true
        },
        // Query type
        queryType: {
            type: String,
            enum: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'AGGREGATE', 'CUSTOM'],
            default: 'SELECT'
        },
        // Results
        result: {
            success: Boolean,
            data: mongoose.Mixed, // Can be array of objects or any result
            rowCount: Number,
            columns: [String],
            error: String,
            executionTime: Number // milliseconds
        },
        // Metadata
        databaseType: String,
        tableName: String,
        isFavorite: {
            type: Boolean,
            default: false
        },
        tags: [String],
        notes: String
    },
    {
        timestamps: true // createdAt, updatedAt
    }
);

// Index for efficient queries
queryHistorySchema.index({ userId: 1, createdAt: -1 });
queryHistorySchema.index({ userId: 1, connectionId: 1, createdAt: -1 });
queryHistorySchema.index({ userId: 1, isFavorite: 1 });

const QueryHistory = mongoose.model('QueryHistory', queryHistorySchema);

module.exports = QueryHistory;
