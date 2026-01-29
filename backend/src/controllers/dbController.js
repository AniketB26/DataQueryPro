/**
 * Database Connection Controller
 * 
 * Handles HTTP requests for database connection endpoints.
 */

const { connectionService } = require('../services');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * POST /api/db/connect
 * Establish a new database connection
 */
async function connect(req, res, next) {
    try {
        let { dbType, config: connConfig, connectionId } = req.body;
        
        // Parse config if it's a JSON string (from FormData)
        if (typeof connConfig === 'string') {
            try {
                connConfig = JSON.parse(connConfig);
            } catch (e) {
                connConfig = {};
            }
        }
        
        const userId = req.user.userId;
        
        // Validate required fields
        if (!dbType) {
            return res.status(400).json({
                success: false,
                error: 'Database type is required'
            });
        }
        
        // Handle file uploads for Excel/CSV
        if (['excel', 'csv', 'xlsx'].includes(dbType.toLowerCase())) {
            if (!req.file && !connConfig?.filePath) {
                return res.status(400).json({
                    success: false,
                    error: 'File upload is required for Excel/CSV connections'
                });
            }
            
            if (req.file) {
                connConfig.filePath = req.file.path;
            }
        }
        
        // Validate connection config based on type
        const validationError = validateConnectionConfig(dbType, connConfig);
        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }
        
        // Create active connection for chat session
        const result = await connectionService.createActiveConnection(userId, connectionId, dbType, connConfig);
        
        // Record connection use if connectionId provided
        if (connectionId) {
            try {
                await connectionService.recordConnectionUse(connectionId, userId);
            } catch (error) {
                console.error('Failed to record connection use:', error);
            }
        }
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        
        console.error('Connect error:', error);
        if (error.message.includes('Connection failed') || error.message.includes('Failed to create connection')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        return res.status(500).json({
            success: false,
            error: error.message || 'Connection failed'
        });
    }
}

/**
 * GET /api/db/schema
 * Get schema for current connection
 */
async function getSchema(req, res) {
    try {
        const { sessionId } = req.query;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        
        const connection = connectionService.getActiveConnection(sessionId);
        if (!connection) {
            return res.status(404).json({
                success: false,
                error: 'No active connection found'
            });
        }
        
        res.json({
            success: true,
            schema: connection.schema
        });
    } catch (error) {
        console.error('GetSchema error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch schema'
        });
    }
}

/**
 * POST /api/db/query
 * Execute a query (used for direct query execution, not through chat)
 */
async function executeQuery(req, res) {
    try {
        const { sessionId, query } = req.body;
        
        if (!sessionId || !query) {
            return res.status(400).json({
                success: false,
                error: 'Session ID and query are required'
            });
        }
        
        const connector = connectionService.getConnector(sessionId);
        if (!connector) {
            return res.status(404).json({
                success: false,
                error: 'No active connection found'
            });
        }
        
        const result = await connector.runQuery(query);
        
        res.json({
            success: result.success,
            ...result
        });
    } catch (error) {
        console.error('ExecuteQuery error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute query'
        });
    }
}

/**
 * POST /api/db/disconnect
 * Close current database connection
 */
async function disconnect(req, res) {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        
        // Get connection to check for file cleanup
        const conn = connectionService.getActiveConnection(sessionId);
        if (conn && conn.dbType === 'file' && conn.connector?.config?.filePath) {
            // Clean up uploaded file
            const filePath = conn.connector.config.filePath;
            if (filePath.startsWith(config.upload.dir)) {
                fs.unlink(filePath, () => {});
            }
        }
        
        await connectionService.closeActiveConnection(sessionId);
        
        res.json({
            success: true,
            message: 'Disconnected successfully'
        });
    } catch (error) {
        console.error('Disconnect error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to disconnect'
        });
    }
}

/**
 * GET /api/db/connections
 * Get all active connections for current user
 */
async function getConnections(req, res) {
    try {
        const userId = req.user.userId;
        const connections = connectionService.getUserConnections(userId);
        
        res.json({
            success: true,
            connections
        });
    } catch (error) {
        console.error('GetConnections error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch connections'
        });
    }
}

/**
 * Validate connection configuration based on database type
 */
function validateConnectionConfig(dbType, config) {
    const type = dbType.toLowerCase();
    
    switch (type) {
        case 'mysql':
        case 'postgresql':
        case 'postgres':
            if (!config.host) return 'Host is required';
            if (!config.database) return 'Database name is required';
            if (!config.username) return 'Username is required';
            break;
            
        case 'sqlite':
            if (!config.database) return 'Database file path is required';
            break;
            
        case 'mongodb':
        case 'mongo':
            if (!config.connectionString && !config.host) {
                return 'Connection string or host is required';
            }
            if (!config.database) return 'Database name is required';
            break;
            
        case 'excel':
        case 'csv':
        case 'xlsx':
            if (!config.filePath) return 'File path is required';
            break;
            
        default:
            return `Unsupported database type: ${dbType}`;
    }
    
    return null;
}

module.exports = {
    connect,
    getSchema,
    executeQuery,
    disconnect,
    getConnections
};
