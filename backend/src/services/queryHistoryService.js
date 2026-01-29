/**
 * Query History Service
 * 
 * Handles saving, retrieving, and exporting query history
 */

const QueryHistory = require('../models/QueryHistory');

/**
 * Save a query to history
 */
async function saveQuery(userId, connectionId, queryData) {
    try {
        const query = new QueryHistory({
            userId,
            connectionId,
            ...queryData
        });
        await query.save();
        return query;
    } catch (error) {
        throw new Error(`Failed to save query: ${error.message}`);
    }
}

/**
 * Get query history for a user
 */
async function getUserQueryHistory(userId, connectionId = null, limit = 50) {
    try {
        const filter = { userId };
        if (connectionId) {
            filter.connectionId = connectionId;
        }

        return await QueryHistory.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    } catch (error) {
        throw new Error(`Failed to fetch query history: ${error.message}`);
    }
}

/**
 * Get favorite queries
 */
async function getFavoriteQueries(userId) {
    try {
        return await QueryHistory.find({ userId, isFavorite: true })
            .sort({ createdAt: -1 })
            .lean();
    } catch (error) {
        throw new Error(`Failed to fetch favorite queries: ${error.message}`);
    }
}

/**
 * Toggle favorite status
 */
async function toggleFavorite(queryId, userId) {
    try {
        const query = await QueryHistory.findOne({ _id: queryId, userId });
        if (!query) {
            throw new Error('Query not found');
        }

        query.isFavorite = !query.isFavorite;
        await query.save();
        return query;
    } catch (error) {
        throw new Error(`Failed to toggle favorite: ${error.message}`);
    }
}

/**
 * Add tags to a query
 */
async function addTags(queryId, userId, tags) {
    try {
        const query = await QueryHistory.findOne({ _id: queryId, userId });
        if (!query) {
            throw new Error('Query not found');
        }

        query.tags = [...new Set([...query.tags, ...tags])]; // Remove duplicates
        await query.save();
        return query;
    } catch (error) {
        throw new Error(`Failed to add tags: ${error.message}`);
    }
}

/**
 * Add notes to a query
 */
async function addNotes(queryId, userId, notes) {
    try {
        const query = await QueryHistory.findOne({ _id: queryId, userId });
        if (!query) {
            throw new Error('Query not found');
        }

        query.notes = notes;
        await query.save();
        return query;
    } catch (error) {
        throw new Error(`Failed to add notes: ${error.message}`);
    }
}

/**
 * Delete a query from history
 */
async function deleteQuery(queryId, userId) {
    try {
        await QueryHistory.deleteOne({ _id: queryId, userId });
        return true;
    } catch (error) {
        throw new Error(`Failed to delete query: ${error.message}`);
    }
}

/**
 * Export query history as JSON
 */
async function exportAsJSON(userId, connectionId = null) {
    try {
        const history = await getUserQueryHistory(userId, connectionId, 1000);

        return {
            exportDate: new Date().toISOString(),
            totalQueries: history.length,
            queries: history.map(q => ({
                naturalQuery: q.naturalQuery,
                generatedQuery: q.generatedQuery,
                queryType: q.queryType,
                tableName: q.tableName,
                result: {
                    success: q.result.success,
                    rowCount: q.result.rowCount,
                    columns: q.result.columns,
                    error: q.result.error
                },
                isFavorite: q.isFavorite,
                tags: q.tags,
                notes: q.notes,
                createdAt: q.createdAt
            }))
        };
    } catch (error) {
        throw new Error(`Failed to export history: ${error.message}`);
    }
}

/**
 * Export query history as SQL file content
 */
async function exportAsSQL(userId, connectionId = null) {
    try {
        const history = await getUserQueryHistory(userId, connectionId, 1000);

        let sqlContent = `-- DataQuery Pro - Query History Export\n`;
        sqlContent += `-- Exported: ${new Date().toISOString()}\n`;
        sqlContent += `-- Total Queries: ${history.length}\n\n`;

        history.forEach((query, index) => {
            sqlContent += `-- Query #${index + 1}\n`;
            sqlContent += `-- Natural Language: ${query.naturalQuery}\n`;
            if (query.tags && query.tags.length > 0) {
                sqlContent += `-- Tags: ${query.tags.join(', ')}\n`;
            }
            if (query.notes) {
                sqlContent += `-- Notes: ${query.notes}\n`;
            }
            sqlContent += `-- Created: ${query.createdAt}\n`;
            sqlContent += `${query.generatedQuery};\n\n`;
        });

        return sqlContent;
    } catch (error) {
        throw new Error(`Failed to export as SQL: ${error.message}`);
    }
}

/**
 * Get query statistics
 */
async function getStatistics(userId) {
    try {
        const stats = await QueryHistory.aggregate([
            { $match: { userId: userId } },
            {
                $group: {
                    _id: null,
                    totalQueries: { $sum: 1 },
                    successfulQueries: {
                        $sum: { $cond: ['$result.success', 1, 0] }
                    },
                    failedQueries: {
                        $sum: { $cond: ['$result.success', 0, 1] }
                    },
                    favoriteCount: {
                        $sum: { $cond: ['$isFavorite', 1, 0] }
                    },
                    averageExecutionTime: {
                        $avg: '$result.executionTime'
                    }
                }
            }
        ]);

        const queryTypeStats = await QueryHistory.aggregate([
            { $match: { userId: userId } },
            {
                $group: {
                    _id: '$queryType',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        return {
            overall: stats[0] || {
                totalQueries: 0,
                successfulQueries: 0,
                failedQueries: 0,
                favoriteCount: 0,
                averageExecutionTime: 0
            },
            byType: queryTypeStats
        };
    } catch (error) {
        throw new Error(`Failed to get statistics: ${error.message}`);
    }
}

module.exports = {
    saveQuery,
    getUserQueryHistory,
    getFavoriteQueries,
    toggleFavorite,
    addTags,
    addNotes,
    deleteQuery,
    exportAsJSON,
    exportAsSQL,
    getStatistics
};
