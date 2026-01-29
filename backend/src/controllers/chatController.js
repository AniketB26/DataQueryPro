/**
 * Chat Controller
 * 
 * Handles HTTP requests for chat and query endpoints.
 */

const { chatService, connectionService, queryHistoryService } = require('../services');

/**
 * POST /api/db/query (natural language)
 * Process a natural language query
 */
async function processQuery(req, res) {
    try {
        const { sessionId, chatSessionId, message, connectionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Database session ID is required'
            });
        }
        
        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }
        
        // Verify connection exists
        const connection = connectionService.getActiveConnection(sessionId);
        if (!connection) {
            return res.status(404).json({
                success: false,
                error: 'No active database connection. Please reconnect.'
            });
        }
        
        // Create chat session if not provided
        let activeChatSessionId = chatSessionId;
        if (!activeChatSessionId) {
            const session = chatService.createChatSession(sessionId);
            activeChatSessionId = session.chatSessionId;
        }
        
        // Process the message
        const result = await chatService.processMessage(
            activeChatSessionId,
            sessionId,
            message.trim()
        );
        
        // Save query to history if connectionId provided
        if (connectionId && result.success && result.generatedQuery) {
            try {
                await queryHistoryService.saveQuery(req.user.userId, connectionId, {
                    naturalQuery: message.trim(),
                    generatedQuery: result.generatedQuery,
                    queryType: result.queryType || 'SELECT',
                    result: {
                        success: result.success,
                        data: result.data,
                        rowCount: result.rowCount,
                        columns: result.columns,
                        error: result.error
                    },
                    databaseType: connection.dbType,
                    tableName: result.tableName
                });
            } catch (historyError) {
                console.error('Failed to save query history:', historyError);
                // Don't fail the request if history saving fails
            }
        }
        
        res.json({
            success: result.success,
            chatSessionId: activeChatSessionId,
            ...result
        });
    } catch (error) {
        console.error('Query processing error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to process query'
        });
    }
}

/**
 * GET /api/chat/history
 * Get chat history for a session
 */
async function getChatHistory(req, res) {
    try {
        const { chatSessionId } = req.query;
        
        if (!chatSessionId) {
            return res.status(400).json({
                success: false,
                error: 'Chat session ID is required'
            });
        }
        
        const history = chatService.getChatHistory(chatSessionId);
        
        res.json({
            success: true,
            messages: history.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp).toISOString(),
                query: msg.query,
                result: msg.result,
                error: msg.error
            }))
        });
    } catch (error) {
        console.error('GetChatHistory error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch chat history'
        });
    }
}

/**
 * GET /api/chat/suggestions
 * Get query suggestions based on schema
 */
async function getSuggestions(req, res) {
    try {
        const { sessionId } = req.query;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Database session ID is required'
            });
        }
        
        const suggestions = await chatService.getSuggestions(sessionId);
        
        res.json({
            success: true,
            suggestions
        });
    } catch (error) {
        console.error('GetSuggestions error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch suggestions'
        });
    }
}

/**
 * POST /api/chat/clear
 * Clear chat history for a session
 */
async function clearHistory(req, res) {
    try {
        const { chatSessionId } = req.body;
        
        if (!chatSessionId) {
            return res.status(400).json({
                success: false,
                error: 'Chat session ID is required'
            });
        }
        
        chatService.clearChatHistory(chatSessionId);
        
        res.json({
            success: true,
            message: 'Chat history cleared'
        });
    } catch (error) {
        console.error('ClearHistory error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to clear history'
        });
    }
}

/**
 * GET /api/chat/export
 * Export chat history
 */
async function exportChat(req, res) {
    try {
        const { chatSessionId } = req.query;
        
        if (!chatSessionId) {
            return res.status(400).json({
                success: false,
                error: 'Chat session ID is required'
            });
        }
        
        const exportData = chatService.exportChat(chatSessionId);
        
        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        console.error('ExportChat error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to export chat'
        });
    }
}

/**
 * POST /api/chat/new
 * Create a new chat session
 */
async function createChatSession(req, res) {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Database session ID is required'
            });
        }
        
        // Verify connection exists - if not, still allow chat session creation
        // but it will fail when trying to execute queries
        const connection = connectionService.getActiveConnection(sessionId);
        if (!connection) {
            console.warn(`Warning: Creating chat session for non-existent connection ${sessionId}`);
        }
        
        const session = chatService.createChatSession(sessionId);
        
        res.json({
            success: true,
            ...session
        });
    } catch (error) {
        console.error('CreateChatSession error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to create chat session'
        });
    }
}

module.exports = {
    processQuery,
    getChatHistory,
    getSuggestions,
    clearHistory,
    exportChat,
    createChatSession
};
