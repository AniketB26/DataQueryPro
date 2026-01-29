/**
 * Chat Service
 * 
 * Handles chat sessions and message history for natural language queries.
 * Integrates with OpenAI for query generation and database connectors for execution.
 */

const { v4: uuidv4 } = require('uuid');
const openai = require('../openai');
const connectionService = require('./connectionService');

// In-memory chat history storage
// Structure: Map<sessionId, Array<{ role, content, timestamp, query?, result? }>>
const chatHistory = new Map();

/**
 * Create a new chat session
 * @param {string} connectionSessionId - Database connection session ID
 * @returns {Object} - Chat session info
 */
function createChatSession(connectionSessionId) {
    const chatSessionId = `chat-${uuidv4()}`;

    chatHistory.set(chatSessionId, {
        connectionSessionId,
        messages: [],
        createdAt: Date.now()
    });

    return {
        chatSessionId,
        connectionSessionId
    };
}

/**
 * Get chat history for a session
 * @param {string} chatSessionId - Chat session ID
 * @returns {Array} - Chat messages
 */
function getChatHistory(chatSessionId) {
    const session = chatHistory.get(chatSessionId);
    return session ? session.messages : [];
}

/**
 * Process a user message and generate response
 * @param {string} chatSessionId - Chat session ID
 * @param {string} connectionSessionId - Database connection session ID
 * @param {string} userMessage - User's natural language question
 * @returns {Object} - Response with query and results
 */
async function processMessage(chatSessionId, connectionSessionId, userMessage) {
    // Get or create chat session
    if (!chatHistory.has(chatSessionId)) {
        createChatSession(connectionSessionId);
        chatHistory.get(chatSessionId).connectionSessionId = connectionSessionId;
    }

    const session = chatHistory.get(chatSessionId);

    // Get database connection and schema
    const connection = connectionService.getActiveConnection(connectionSessionId);
    if (!connection) {
        throw new Error('No active database connection');
    }

    const schema = connection.schema;
    const dbType = connection.dbType;
    const connector = connection.connector;

    // Add user message to history
    const userMsg = {
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
    };
    session.messages.push(userMsg);

    try {
        // Generate query using OpenAI
        const queryResult = await openai.generateQuery(
            userMessage,
            schema,
            dbType,
            session.messages.slice(-10) // Last 10 messages for context
        );

        if (!queryResult.success) {
            const errorResponse = {
                role: 'assistant',
                content: `I couldn't generate a query for your question: ${queryResult.error}`,
                timestamp: Date.now(),
                error: true
            };
            session.messages.push(errorResponse);

            return {
                success: false,
                message: errorResponse.content,
                error: queryResult.error
            };
        }

        // Execute the generated query
        let execResult = await connector.runQuery(queryResult.query);

        // If query failed, try to fix it
        if (!execResult.success) {
            console.log('Query failed, attempting to fix...');

            const fixedQuery = await openai.fixQuery(
                userMessage,
                queryResult.query,
                execResult.error,
                schema,
                dbType
            );

            if (fixedQuery.success && fixedQuery.query) {
                execResult = await connector.runQuery(fixedQuery.query);

                // Update query with fixed version
                if (execResult.success) {
                    queryResult.query = fixedQuery.query;
                    queryResult.wasFixed = true;
                }
            }
        }

        // Generate natural language response
        const nlResponse = await openai.generateResponse(
            userMessage,
            execResult,
            queryResult.query
        );

        // Create assistant message
        const assistantMsg = {
            role: 'assistant',
            content: nlResponse,
            timestamp: Date.now(),
            query: queryResult.query,
            queryExplanation: queryResult.explanation,
            result: execResult.success ? {
                data: execResult.data,
                rowCount: execResult.rowCount,
                columns: execResult.columns
            } : null,
            error: execResult.success ? null : execResult.error
        };

        session.messages.push(assistantMsg);

        return {
            success: execResult.success,
            message: nlResponse,
            query: typeof queryResult.query === 'string'
                ? queryResult.query
                : JSON.stringify(queryResult.query, null, 2),
            queryExplanation: queryResult.explanation,
            result: execResult.success ? {
                data: execResult.data?.slice(0, 100), // Limit to 100 rows
                rowCount: execResult.rowCount,
                columns: execResult.columns
            } : null,
            error: execResult.error,
            wasFixed: queryResult.wasFixed || false
        };

    } catch (error) {
        const errorResponse = {
            role: 'assistant',
            content: `An error occurred while processing your question: ${error.message}`,
            timestamp: Date.now(),
            error: true
        };
        session.messages.push(errorResponse);

        return {
            success: false,
            message: errorResponse.content,
            error: error.message
        };
    }
}

/**
 * Get query suggestions based on schema
 * @param {string} connectionSessionId - Database connection session ID
 * @returns {Array} - List of suggested questions
 */
function getSuggestions(connectionSessionId) {
    const connection = connectionService.getActiveConnection(connectionSessionId);
    if (!connection) {
        throw new Error('No active database connection');
    }

    const schema = connection.schema;
    const dbType = connection.dbType;

    return openai.generateQuerySuggestions(schema, dbType);
}

/**
 * Clear chat history for a session
 * @param {string} chatSessionId - Chat session ID
 */
function clearChatHistory(chatSessionId) {
    if (chatHistory.has(chatSessionId)) {
        const session = chatHistory.get(chatSessionId);
        session.messages = [];
    }
}

/**
 * Delete a chat session
 * @param {string} chatSessionId - Chat session ID
 */
function deleteChatSession(chatSessionId) {
    chatHistory.delete(chatSessionId);
}

/**
 * Export chat history as JSON
 * @param {string} chatSessionId - Chat session ID
 * @returns {Object} - Exportable chat data
 */
function exportChat(chatSessionId) {
    const session = chatHistory.get(chatSessionId);
    if (!session) {
        throw new Error('Chat session not found');
    }

    return {
        sessionId: chatSessionId,
        messages: session.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp).toISOString(),
            query: msg.query,
            result: msg.result
        })),
        exportedAt: new Date().toISOString()
    };
}

module.exports = {
    createChatSession,
    getChatHistory,
    processMessage,
    getSuggestions,
    clearChatHistory,
    deleteChatSession,
    exportChat
};
