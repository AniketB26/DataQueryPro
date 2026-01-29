/**
 * Database Connection Routes
 * 
 * POST /api/db/connect           - Establish database connection
 * GET  /api/db/schema            - Get database schema
 * POST /api/db/query             - Execute natural language query
 * POST /api/db/disconnect        - Close database connection
 * GET  /api/db/connections       - Get active connections
 * 
 * Saved Connections (MongoDB):
 * GET  /api/db/saved             - Get all saved connections
 * POST /api/db/saved             - Save a new connection
 * GET  /api/db/saved/:id         - Get specific saved connection
 * PUT  /api/db/saved/:id         - Update saved connection
 * DELETE /api/db/saved/:id       - Delete saved connection
 * POST /api/db/saved/:id/default - Set as default connection
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { dbController, chatController } = require('../controllers');
const { authenticateToken } = require('../middleware/auth');
const { connectionService } = require('../services');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.upload.dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `upload-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: config.upload.maxFileSize
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});

// All routes require authentication
router.use(authenticateToken);

// Database connection routes
router.post('/connect', upload.single('file'), dbController.connect);
router.get('/schema', dbController.getSchema);
router.post('/disconnect', dbController.disconnect);
router.get('/connections', dbController.getConnections);

// Query route (natural language via chat service)
router.post('/query', chatController.processQuery);

// ===================================
// Saved Connections Management
// ===================================

/**
 * GET /api/db/saved - Get all saved connections for user
 */
router.get('/saved', async (req, res, next) => {
    try {
        const connections = await connectionService.getUserConnections(req.user.userId);
        res.json({
            success: true,
            connections
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/db/saved - Save a new connection
 */
router.post('/saved', async (req, res, next) => {
    try {
        const { name, description, type, host, port, database, username, password, connectionString, filePath } = req.body;
        
        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Name and type are required'
            });
        }

        const connection = await connectionService.saveConnection(req.user.userId, {
            name,
            description,
            type,
            host,
            port,
            database,
            username,
            password,
            connectionString,
            filePath
        });

        res.status(201).json({
            success: true,
            message: 'Connection saved successfully',
            connection
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/db/saved/:id - Get specific saved connection
 */
router.get('/saved/:id', async (req, res, next) => {
    try {
        const connection = await connectionService.getConnection(req.params.id, req.user.userId);
        
        if (!connection) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        res.json({
            success: true,
            connection
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/db/saved/:id - Update saved connection
 */
router.put('/saved/:id', async (req, res, next) => {
    try {
        const { name, description, isDefault } = req.body;
        
        const connection = await connectionService.updateConnection(
            req.params.id,
            req.user.userId,
            { name, description, isDefault }
        );

        if (!connection) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        res.json({
            success: true,
            message: 'Connection updated successfully',
            connection
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/db/saved/:id - Delete saved connection
 */
router.delete('/saved/:id', async (req, res, next) => {
    try {
        const deleted = await connectionService.deleteConnection(req.params.id, req.user.userId);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        res.json({
            success: true,
            message: 'Connection deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/db/saved/:id/default - Set as default connection
 */
router.post('/saved/:id/default', async (req, res, next) => {
    try {
        const connection = await connectionService.setDefaultConnection(req.params.id, req.user.userId);
        
        if (!connection) {
            return res.status(404).json({
                success: false,
                error: 'Connection not found'
            });
        }

        res.json({
            success: true,
            message: 'Default connection set',
            connection
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
