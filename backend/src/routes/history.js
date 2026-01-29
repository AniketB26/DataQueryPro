/**
 * Query History Routes
 * 
 * GET  /api/history              - Get all query history
 * GET  /api/history/favorites    - Get favorite queries
 * GET  /api/history/:id          - Get specific query
 * POST /api/history/:id/favorite - Toggle favorite
 * POST /api/history/:id/tags     - Add tags to query
 * POST /api/history/:id/notes    - Add notes to query
 * DELETE /api/history/:id        - Delete query from history
 * GET  /api/history/export/json  - Export as JSON
 * GET  /api/history/export/sql   - Export as SQL
 * GET  /api/history/stats        - Get history statistics
 */

const express = require('express');
const router = express.Router();
const { queryHistoryService } = require('../services');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/history - Get query history (optionally filtered by connection)
 */
router.get('/', async (req, res, next) => {
    try {
        const { connectionId, limit = 50 } = req.query;
        
        const history = await queryHistoryService.getUserQueryHistory(
            req.user.userId,
            connectionId,
            parseInt(limit)
        );

        res.json({
            success: true,
            count: history.length,
            history
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/history/favorites - Get favorite queries
 */
router.get('/favorites', async (req, res, next) => {
    try {
        const favorites = await queryHistoryService.getFavoriteQueries(req.user.userId);

        res.json({
            success: true,
            count: favorites.length,
            favorites
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/history - Save a new query to history
 */
router.post('/', async (req, res, next) => {
    try {
        const { 
            connectionId, 
            naturalQuery, 
            generatedQuery, 
            queryType, 
            result, 
            databaseType, 
            tableName 
        } = req.body;

        if (!connectionId || !naturalQuery || !generatedQuery) {
            return res.status(400).json({
                success: false,
                error: 'connectionId, naturalQuery, and generatedQuery are required'
            });
        }

        const query = await queryHistoryService.saveQuery(req.user.userId, connectionId, {
            naturalQuery,
            generatedQuery,
            queryType,
            result,
            databaseType,
            tableName
        });

        res.status(201).json({
            success: true,
            message: 'Query saved to history',
            query
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/history/:id - Get specific query
 */
router.get('/:id', async (req, res, next) => {
    try {
        const history = await queryHistoryService.getUserQueryHistory(req.user.userId);
        const query = history.find(q => q._id.toString() === req.params.id);

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        res.json({
            success: true,
            query
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/history/:id/favorite - Toggle favorite status
 */
router.post('/:id/favorite', async (req, res, next) => {
    try {
        const query = await queryHistoryService.toggleFavorite(req.params.id, req.user.userId);

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        res.json({
            success: true,
            message: query.isFavorite ? 'Added to favorites' : 'Removed from favorites',
            query
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/history/:id/tags - Add tags to query
 */
router.post('/:id/tags', async (req, res, next) => {
    try {
        const { tags } = req.body;

        if (!Array.isArray(tags) || tags.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Tags array is required'
            });
        }

        const query = await queryHistoryService.addTags(req.params.id, req.user.userId, tags);

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        res.json({
            success: true,
            message: 'Tags added successfully',
            query
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/history/:id/notes - Add notes to query
 */
router.post('/:id/notes', async (req, res, next) => {
    try {
        const { notes } = req.body;

        if (!notes) {
            return res.status(400).json({
                success: false,
                error: 'Notes are required'
            });
        }

        const query = await queryHistoryService.addNotes(req.params.id, req.user.userId, notes);

        if (!query) {
            return res.status(404).json({
                success: false,
                error: 'Query not found'
            });
        }

        res.json({
            success: true,
            message: 'Notes added successfully',
            query
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/history/:id - Delete query from history
 */
router.delete('/:id', async (req, res, next) => {
    try {
        await queryHistoryService.deleteQuery(req.params.id, req.user.userId);

        res.json({
            success: true,
            message: 'Query deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/history/export/json - Export as JSON
 */
router.get('/export/json', async (req, res, next) => {
    try {
        const { connectionId } = req.query;
        
        const exportData = await queryHistoryService.exportAsJSON(req.user.userId, connectionId);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="query-history-${Date.now()}.json"`);
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/history/export/sql - Export as SQL
 */
router.get('/export/sql', async (req, res, next) => {
    try {
        const { connectionId } = req.query;
        
        const sqlContent = await queryHistoryService.exportAsSQL(req.user.userId, connectionId);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="query-history-${Date.now()}.sql"`);
        res.send(sqlContent);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/history/stats - Get query statistics
 */
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await queryHistoryService.getStatistics(req.user.userId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
