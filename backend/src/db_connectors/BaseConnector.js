/**
 * Base Connector Class
 * 
 * Abstract base class defining the unified interface for all database connectors.
 * All connectors must implement: connect(), getSchema(), runQuery(), close()
 */

class BaseConnector {
    constructor(config) {
        this.config = config;
        this.connection = null;
        this.isConnected = false;
        this.dbType = 'base';
    }
    
    /**
     * Establish connection to the database
     * @returns {Promise<boolean>} - True if connection successful
     */
    async connect() {
        throw new Error('connect() must be implemented by subclass');
    }
    
    /**
     * Get the schema (tables, columns, types) of the database
     * @returns {Promise<Object>} - Schema information
     */
    async getSchema() {
        throw new Error('getSchema() must be implemented by subclass');
    }
    
    /**
     * Execute a query against the database
     * @param {string} query - The query to execute
     * @returns {Promise<Object>} - Query results
     */
    async runQuery(query) {
        throw new Error('runQuery() must be implemented by subclass');
    }
    
    /**
     * Close the database connection
     * @returns {Promise<void>}
     */
    async close() {
        throw new Error('close() must be implemented by subclass');
    }
    
    /**
     * Format schema for OpenAI prompt
     * @returns {string} - Formatted schema string
     */
    formatSchemaForAI() {
        throw new Error('formatSchemaForAI() must be implemented by subclass');
    }
    
    /**
     * Validate a query for safety (prevent DROP, DELETE, etc. unless allowed)
     * @param {string} query - Query to validate
     * @param {Object} options - Validation options
     * @returns {Object} - { valid: boolean, reason?: string }
     */
    validateQuery(query, options = {}) {
        const allowDestructive = options.allowDestructive || false;
        const upperQuery = query.toUpperCase();
        
        // List of dangerous operations
        const dangerousPatterns = [
            'DROP TABLE',
            'DROP DATABASE',
            'TRUNCATE',
            'DELETE FROM',
            'ALTER TABLE',
            'CREATE TABLE',
            'INSERT INTO',
            'UPDATE '
        ];
        
        if (!allowDestructive) {
            for (const pattern of dangerousPatterns) {
                if (upperQuery.includes(pattern)) {
                    return {
                        valid: false,
                        reason: `Query contains potentially destructive operation: ${pattern}`
                    };
                }
            }
        }
        
        return { valid: true };
    }
}

module.exports = BaseConnector;
