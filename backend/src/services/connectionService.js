/**
 * Connection Service
 * 
 * Handles saving, retrieving, and managing user's database connections
 * Also manages active connections during chat sessions
 */

const Connection = require('../models/Connection');
const { createConnector } = require('../db_connectors');
const { v4: uuidv4 } = require('uuid');

// In-memory storage for active connections during chat sessions
// Structure: Map<sessionId, { connector, schema, dbType, createdAt, connectionId }>
const activeConnections = new Map();

// Cleanup old connections periodically (30 minutes timeout)
const CONNECTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
    const now = Date.now();
    for (const [sessionId, conn] of activeConnections) {
        if (now - conn.createdAt > CONNECTION_TIMEOUT) {
            console.log(`Cleaning up stale connection: ${sessionId}`);
            closeActiveConnection(sessionId);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

/**
 * Save a new database connection to MongoDB
 */
async function saveConnection(userId, connectionData) {
    try {
        const connection = new Connection({
            userId,
            ...connectionData
        });
        await connection.save();
        return connection;
    } catch (error) {
        throw new Error(`Failed to save connection: ${error.message}`);
    }
}

/**
 * Get all connections for a user
 */
async function getUserConnections(userId) {
    try {
        return await Connection.find({ userId })
            .sort({ createdAt: -1 })
            .select('-password'); // Don't return passwords
    } catch (error) {
        throw new Error(`Failed to fetch connections: ${error.message}`);
    }
}

/**
 * Get a specific connection
 */
async function getConnection(connectionId, userId) {
    try {
        const connection = await Connection.findOne({
            _id: connectionId,
            userId
        }).select('-password');
        return connection;
    } catch (error) {
        throw new Error(`Failed to fetch connection: ${error.message}`);
    }
}

/**
 * Update a connection
 */
async function updateConnection(connectionId, userId, updates) {
    try {
        // Don't allow changing userId
        delete updates.userId;

        const connection = await Connection.findOneAndUpdate(
            { _id: connectionId, userId },
            updates,
            { new: true }
        ).select('-password');

        return connection;
    } catch (error) {
        throw new Error(`Failed to update connection: ${error.message}`);
    }
}

/**
 * Delete a connection
 */
async function deleteConnection(connectionId, userId) {
    try {
        await Connection.deleteOne({
            _id: connectionId,
            userId
        });
        return true;
    } catch (error) {
        throw new Error(`Failed to delete connection: ${error.message}`);
    }
}

/**
 * Update connection schema
 */
async function updateConnectionSchema(connectionId, userId, schema) {
    try {
        const connection = await Connection.findOneAndUpdate(
            { _id: connectionId, userId },
            { schema },
            { new: true }
        ).select('-password');
        return connection;
    } catch (error) {
        throw new Error(`Failed to update schema: ${error.message}`);
    }
}

/**
 * Update last used timestamp and increment use count
 */
async function recordConnectionUse(connectionId, userId) {
    try {
        await Connection.findOneAndUpdate(
            { _id: connectionId, userId },
            {
                lastUsed: new Date(),
                $inc: { useCount: 1 }
            }
        );
    } catch (error) {
        console.error('Failed to record connection use:', error.message);
    }
}

/**
 * Get default connection
 */
async function getDefaultConnection(userId) {
    try {
        return await Connection.findOne({ userId, isDefault: true }).select('-password');
    } catch (error) {
        throw new Error(`Failed to fetch default connection: ${error.message}`);
    }
}

/**
 * Set default connection
 */
async function setDefaultConnection(connectionId, userId) {
    try {
        // Remove default from all other connections
        await Connection.updateMany({ userId }, { isDefault: false });

        // Set this one as default
        const connection = await Connection.findOneAndUpdate(
            { _id: connectionId, userId },
            { isDefault: true },
            { new: true }
        ).select('-password');

        return connection;
    } catch (error) {
        throw new Error(`Failed to set default connection: ${error.message}`);
    }
}

/**
 * Create an active connection for chat session
 */
async function createActiveConnection(userId, connectionId, dbType, connectionConfig) {
    const sessionId = `${userId}-${uuidv4()}`;

    try {
        // Create appropriate connector
        const connector = createConnector(dbType, connectionConfig);

        // Attempt connection
        await connector.connect();

        // Get schema
        const schema = await connector.getSchema();

        // Store active connection
        activeConnections.set(sessionId, {
            connector,
            schema,
            dbType,
            connectionId,
            userId,
            createdAt: Date.now()
        });

        return {
            sessionId,
            schema,
            dbType
        };
    } catch (error) {
        // Provide helpful error messages for common issues
        const errorMessage = error.message || 'Unknown error';

        // Connection timeout
        if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
            throw new Error(
                `Connection timed out. The database server at "${connectionConfig.host}" is not responding. ` +
                `Please verify: 1) The host and port are correct, 2) The server is running, ` +
                `3) Your firewall allows outbound connections to port ${connectionConfig.port || 'the specified port'}.`
            );
        }

        // Connection refused
        if (errorMessage.includes('ECONNREFUSED')) {
            throw new Error(
                `Connection refused by the server at "${connectionConfig.host}:${connectionConfig.port}". ` +
                `The database server may not be running or is not accepting connections.`
            );
        }

        // DNS resolution failed
        if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
            throw new Error(
                `Could not resolve hostname "${connectionConfig.host}". ` +
                `Please check that the hostname is spelled correctly.`
            );
        }

        // Authentication failed
        if (errorMessage.includes('Access denied') || errorMessage.includes('authentication failed') ||
            errorMessage.includes('password') || errorMessage.includes('SASL')) {
            throw new Error(
                `Authentication failed. Please verify your username and password are correct.`
            );
        }

        // Database not found
        if (errorMessage.includes('Unknown database') || errorMessage.includes('does not exist')) {
            throw new Error(
                `Database "${connectionConfig.database}" was not found on the server. ` +
                `Please verify the database name.`
            );
        }

        // SSL required
        if (errorMessage.includes('SSL') || errorMessage.includes('ssl')) {
            throw new Error(
                `SSL connection required. Please enable the "Use SSL" option and try again.`
            );
        }

        // Generic error with original message
        throw new Error(`Connection failed: ${errorMessage}`);
    }
}

/**
 * Get active connection
 */
function getActiveConnection(sessionId) {
    return activeConnections.get(sessionId);
}

/**
 * Close an active connection
 */
async function closeActiveConnection(sessionId) {
    const conn = activeConnections.get(sessionId);
    if (conn && conn.connector) {
        try {
            await conn.connector.close();
        } catch (error) {
            console.error(`Error closing connection ${sessionId}:`, error.message);
        }
    }
    activeConnections.delete(sessionId);
}

/**
 * Get connector from active connection
 */
function getConnector(sessionId) {
    const conn = activeConnections.get(sessionId);
    return conn ? conn.connector : null;
}

/**
 * Close all active connections for a user
 */
async function closeUserConnections(userId) {
    for (const [sessionId, conn] of activeConnections) {
        if (conn.userId === userId) {
            await closeActiveConnection(sessionId);
        }
    }
}

module.exports = {
    // Saved connections (MongoDB)
    saveConnection,
    getUserConnections,
    getConnection,
    updateConnection,
    deleteConnection,
    updateConnectionSchema,
    recordConnectionUse,
    getDefaultConnection,
    setDefaultConnection,

    // Active session connections
    createActiveConnection,
    getActiveConnection,
    closeActiveConnection,
    closeUserConnections,
    getConnector
};
