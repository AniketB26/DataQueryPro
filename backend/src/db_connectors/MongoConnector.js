/**
 * MongoDB Connector
 * 
 * Connector for MongoDB databases.
 * Implements the BaseConnector interface for consistent usage.
 */

const { MongoClient } = require('mongodb');
const BaseConnector = require('./BaseConnector');

class MongoConnector extends BaseConnector {
    constructor(config) {
        super(config);
        this.dbType = 'mongodb';
        this.client = null;
        this.db = null;
        this.schema = null;
    }

    /**
     * Establish connection to MongoDB
     */
    async connect() {
        try {
            // Build connection string
            let connectionString = this.config.connectionString;

            if (!connectionString) {
                const auth = this.config.username && this.config.password
                    ? `${encodeURIComponent(this.config.username)}:${encodeURIComponent(this.config.password)}@`
                    : '';
                const host = this.config.host || 'localhost';
                const port = this.config.port || 27017;
                connectionString = `mongodb://${auth}${host}:${port}`;
            }

            console.log(`🔌 Connecting to MongoDB at ${this.config.host || 'localhost'}...`);

            // Connect to MongoDB with extended timeouts for cloud databases
            this.client = new MongoClient(connectionString, {
                maxPoolSize: 5,
                // Extended timeout for slow cloud databases (30 seconds)
                serverSelectionTimeoutMS: this.config.connectTimeout || 30000,
                connectTimeoutMS: this.config.connectTimeout || 30000,
                socketTimeoutMS: 60000
            });

            await this.client.connect();
            this.db = this.client.db(this.config.database);

            // Verify connection
            await this.db.command({ ping: 1 });

            console.log(`✅ MongoDB connection successful`);
            this.isConnected = true;
            return true;
        } catch (error) {
            this.isConnected = false;
            console.error(`❌ MongoDB connection failed:`, error.message);
            throw new Error(`MongoDB connection failed: ${error.message}`);
        }
    }

    /**
     * Get database schema (collections and their field structures)
     */
    async getSchema() {
        if (!this.isConnected) {
            throw new Error('Not connected to database');
        }

        const collections = await this.db.listCollections().toArray();
        const schema = [];

        for (const collection of collections) {
            const collectionName = collection.name;

            // Skip system collections
            if (collectionName.startsWith('system.')) {
                continue;
            }

            // Get sample documents to infer schema
            const sampleDocs = await this.db.collection(collectionName)
                .find({})
                .limit(this.config.schemaSampleSize || 50)
                .toArray();

            // Infer fields from sample documents
            const fields = this._inferFields(sampleDocs);

            // Get document count
            const count = await this.db.collection(collectionName).countDocuments();
            const indexes = await this.db.collection(collectionName).indexes().catch(() => []);

            schema.push({
                name: collectionName,
                fields,
                documentCount: count,
                indexes: indexes.map(index => ({
                    name: index.name,
                    key: index.key,
                    unique: Boolean(index.unique)
                }))
            });
        }

        this.schema = {
            dbType: 'mongodb',
            database: this.config.database,
            collections: schema
        };

        return this.schema;
    }

    /**
     * Infer field types from sample documents
     */
    _inferFields(documents) {
        const fieldMap = new Map();

        for (const doc of documents) {
            this._extractFields(doc, '', fieldMap);
        }

        return Array.from(fieldMap.entries()).map(([name, info]) => ({
            name,
            types: Array.from(info.types),
            occurrenceCount: info.occurrenceCount,
            sampleValues: Array.from(info.sampleValues).slice(0, 5)
        }));
    }

    /**
     * Recursively extract fields from a document
     */
    _extractFields(obj, prefix, fieldMap) {
        for (const [key, value] of Object.entries(obj)) {
            const fieldName = prefix ? `${prefix}.${key}` : key;
            const type = this._getMongoType(value);

            if (!fieldMap.has(fieldName)) {
                fieldMap.set(fieldName, {
                    types: new Set(),
                    occurrenceCount: 0,
                    sampleValues: new Set()
                });
            }
            const info = fieldMap.get(fieldName);
            info.types.add(type);
            info.occurrenceCount += 1;

            if (this._isSafeSampleValue(fieldName, value) && info.sampleValues.size < 5) {
                info.sampleValues.add(String(value));
            }

            // Recurse into nested objects (but not arrays or special types)
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                !(value instanceof Date) && !value._bsontype) {
                this._extractFields(value, fieldName, fieldMap);
            }
        }
    }

    /**
     * Get MongoDB type name for a value
     */
    _getMongoType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return 'ObjectId';
        if (typeof value === 'object') return 'object';
        return typeof value;
    }

    _isSafeSampleValue(fieldName, value) {
        const lowerField = fieldName.toLowerCase();
        const blockedTerms = [
            'password', 'token', 'secret', 'email', 'phone', 'address',
            'name', 'ssn', 'credit', 'card', 'auth', 'key'
        ];

        if (blockedTerms.some(term => lowerField.includes(term))) {
            return false;
        }

        if (value === null || value === undefined) return false;
        if (typeof value === 'number' || typeof value === 'boolean') return true;
        if (value instanceof Date) return true;

        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 && trimmed.length <= 40;
        }

        return false;
    }

    /**
     * Execute a MongoDB query
     * Query format: { collection: 'name', operation: 'find|aggregate|...', query: {...}, options: {...} }
     */
    async runQuery(queryString, options = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to database');
        }

        try {
            // Parse the query if it's a string
            let query;
            if (typeof queryString === 'string') {
                // Try to parse as JSON
                try {
                    query = JSON.parse(queryString);
                } catch {
                    // Try to evaluate as JavaScript object (safer method)
                    query = this._parseMongoQuery(queryString);
                }
            } else {
                query = queryString;
            }

            const validation = this.validateQuery(query, options);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.reason,
                    query: queryString
                };
            }

            // Apply fuzzy matching for collection name
            const { findBestTableMatch } = require('../utils/tableMatcher');
            let collectionName = query.collection;

            // Get available collections from schema
            if (this.schema && this.schema.collections) {
                const availableCollections = this.schema.collections.map(c => c.name);

                // Check if exact match exists
                if (!availableCollections.includes(collectionName)) {
                    const { match, score } = findBestTableMatch(collectionName, availableCollections, 0.5);
                    if (match) {
                        console.log(`Collection "${collectionName}" fuzzy matched to "${match}" (score: ${score.toFixed(2)})`);
                        collectionName = match;
                    }
                }
            }

            const collection = this.db.collection(collectionName);
            let result;

            switch (query.operation) {
                case 'find':
                    // Support both 'filter' and 'query' field names
                    const findFilter = query.filter || query.query || {};
                    const projection = query.projection || {};
                    const sort = query.sort || query.options?.sort || {};
                    const limit = Math.min(
                        Math.max(parseInt(query.limit || query.options?.limit || 100, 10) || 100, 1),
                        options.maxLimit || 1000
                    );
                    result = await collection
                        .find(findFilter, { projection })
                        .sort(sort)
                        .limit(limit)
                        .toArray();
                    break;

                case 'aggregate':
                    result = await collection
                        .aggregate(query.pipeline || [])
                        .toArray();
                    break;

                case 'count':
                    result = await collection.countDocuments(query.filter || query.query || {});
                    break;

                case 'distinct':
                    result = await collection.distinct(query.field, query.filter || query.query || {});
                    break;

                // MUTATION OPERATIONS
                case 'insertOne': {
                    const doc = query.document || {};
                    // Add timestamp if not present
                    if (!doc.createdAt) {
                        doc.createdAt = new Date();
                    }
                    const insertResult = await collection.insertOne(doc);
                    return {
                        success: true,
                        operation: 'insertOne',
                        insertedId: insertResult.insertedId,
                        acknowledged: insertResult.acknowledged,
                        message: `Document inserted successfully. ID: ${insertResult.insertedId}`,
                        data: [{ _id: insertResult.insertedId, ...doc }],
                        rowCount: 1
                    };
                }

                case 'updateOne': {
                    const updateFilter = query.filter || {};
                    const update = query.update || {};
                    if (Object.keys(updateFilter).length === 0) {
                        throw new Error('Update requires a filter to identify the document');
                    }
                    const updateResult = await collection.updateOne(updateFilter, update);
                    return {
                        success: true,
                        operation: 'updateOne',
                        matchedCount: updateResult.matchedCount,
                        modifiedCount: updateResult.modifiedCount,
                        message: `Updated ${updateResult.modifiedCount} document(s)`,
                        data: [{ matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount }],
                        rowCount: updateResult.modifiedCount
                    };
                }

                case 'updateMany': {
                    const updateManyFilter = query.filter || {};
                    const updateMany = query.update || {};
                    const updateManyResult = await collection.updateMany(updateManyFilter, updateMany);
                    return {
                        success: true,
                        operation: 'updateMany',
                        matchedCount: updateManyResult.matchedCount,
                        modifiedCount: updateManyResult.modifiedCount,
                        message: `Updated ${updateManyResult.modifiedCount} document(s)`,
                        data: [{ matchedCount: updateManyResult.matchedCount, modifiedCount: updateManyResult.modifiedCount }],
                        rowCount: updateManyResult.modifiedCount
                    };
                }

                case 'deleteOne': {
                    const deleteFilter = query.filter || {};
                    if (Object.keys(deleteFilter).length === 0) {
                        throw new Error('Delete requires a filter to identify the document. Use deleteMany with caution for bulk deletes.');
                    }
                    const deleteResult = await collection.deleteOne(deleteFilter);
                    return {
                        success: true,
                        operation: 'deleteOne',
                        deletedCount: deleteResult.deletedCount,
                        message: `Deleted ${deleteResult.deletedCount} document(s)`,
                        data: [{ deletedCount: deleteResult.deletedCount }],
                        rowCount: deleteResult.deletedCount
                    };
                }

                case 'deleteMany': {
                    const deleteManyFilter = query.filter || {};
                    // Safety check: require explicit filter for deleteMany
                    if (Object.keys(deleteManyFilter).length === 0) {
                        throw new Error('Deleting all documents requires explicit confirmation. Please specify a filter.');
                    }
                    const deleteManyResult = await collection.deleteMany(deleteManyFilter);
                    return {
                        success: true,
                        operation: 'deleteMany',
                        deletedCount: deleteManyResult.deletedCount,
                        message: `Deleted ${deleteManyResult.deletedCount} document(s)`,
                        data: [{ deletedCount: deleteManyResult.deletedCount }],
                        rowCount: deleteManyResult.deletedCount
                    };
                }

                default:
                    throw new Error(`Unsupported operation: ${query.operation}`);
            }

            // Format result for consistent output
            const rows = Array.isArray(result) ? result : [{ result }];

            return {
                success: true,
                data: rows,
                rowCount: rows.length,
                columns: rows.length > 0 ? Object.keys(rows[0]) : []
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                query: queryString
            };
        }
    }

    /**
     * Parse a MongoDB query string into an object
     */
    _parseMongoQuery(queryString) {
        // Basic safety check - don't allow require, eval, etc.
        const forbidden = ['require', 'eval', 'Function', 'process', 'global'];
        for (const word of forbidden) {
            if (queryString.includes(word)) {
                throw new Error(`Query contains forbidden keyword: ${word}`);
            }
        }

        // Try to parse as a simple JSON-like object
        // This is a simplified parser - in production, use a proper MongoDB query parser
        try {
            // Replace single quotes with double quotes for JSON parsing
            const jsonLike = queryString
                .replace(/'/g, '"')
                .replace(/(\w+):/g, '"$1":');
            return JSON.parse(jsonLike);
        } catch {
            throw new Error('Could not parse MongoDB query. Please use JSON format.');
        }
    }

    /**
     * Format schema for OpenAI prompt
     */
    formatSchemaForAI() {
        if (!this.schema) {
            return 'Schema not available';
        }

        let schemaStr = `Database Type: MongoDB\n`;
        schemaStr += `Database: ${this.schema.database}\n\n`;
        schemaStr += 'Collections:\n';

        for (const collection of this.schema.collections) {
            schemaStr += `\n${collection.name} (${collection.documentCount} documents):\n`;
            for (const field of collection.fields) {
                const samples = field.sampleValues?.length
                    ? ` [safe examples: ${field.sampleValues.slice(0, 3).join(', ')}]`
                    : '';
                schemaStr += `  - ${field.name}: ${field.types.join(' | ')}${samples}\n`;
            }
            if (collection.indexes && collection.indexes.length > 0) {
                schemaStr += '  Indexes:\n';
                for (const index of collection.indexes.slice(0, 8)) {
                    schemaStr += `    - ${index.name}${index.unique ? ' UNIQUE' : ''}: ${JSON.stringify(index.key)}\n`;
                }
            }
        }

        return schemaStr;
    }

    /**
     * Validate MongoDB query for safety
     */
    validateQuery(query, options = {}) {
        const allowDestructive = options.allowDestructive || false;
        const queryStr = (typeof query === 'string' ? query : JSON.stringify(query)).toLowerCase();

        // List of dangerous operations for MongoDB
        const dangerousOperations = [
            'deleteOne', 'deleteMany', 'drop', 'dropDatabase',
            'insertOne', 'insertMany', 'updateOne', 'updateMany',
            'replaceOne', 'findOneAndDelete', 'findOneAndReplace'
        ].map(op => op.toLowerCase());

        if (!allowDestructive) {
            for (const op of dangerousOperations) {
                if (queryStr.includes(op)) {
                    return {
                        valid: false,
                        reason: `Query contains potentially destructive operation: ${op}`
                    };
                }
            }
        }

        return { valid: true };
    }

    /**
     * Close MongoDB connection
     */
    async close() {
        if (this.client) {
            await this.client.close();
        }
        this.isConnected = false;
        this.client = null;
        this.db = null;
    }
}

module.exports = MongoConnector;
