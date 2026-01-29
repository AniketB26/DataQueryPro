/**
 * Database Connectors Index
 * 
 * Factory module for creating appropriate database connectors.
 */

const SQLConnector = require('./SQLConnector');
const MongoConnector = require('./MongoConnector');
const FileConnector = require('./FileConnector');

/**
 * Create a database connector based on type
 * @param {string} type - Database type (mysql, postgresql, sqlite, mongodb, excel, csv)
 * @param {Object} config - Connection configuration
 * @returns {BaseConnector} - Appropriate connector instance
 */
function createConnector(type, config) {
    const dbType = type.toLowerCase();
    
    switch (dbType) {
        case 'mysql':
        case 'postgresql':
        case 'postgres':
        case 'sqlite':
            return new SQLConnector({ ...config, type: dbType });
            
        case 'mongodb':
        case 'mongo':
            return new MongoConnector(config);
            
        case 'excel':
        case 'xlsx':
        case 'xls':
            return new FileConnector({ ...config, fileType: 'excel' });
            
        case 'csv':
            return new FileConnector({ ...config, fileType: 'csv' });
            
        default:
            throw new Error(`Unsupported database type: ${type}`);
    }
}

module.exports = {
    createConnector,
    SQLConnector,
    MongoConnector,
    FileConnector
};
