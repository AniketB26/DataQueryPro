/**
 * SQL Connector
 * 
 * Unified connector for SQL databases including MySQL, PostgreSQL, and SQLite.
 * Implements the BaseConnector interface for consistent usage.
 */

const BaseConnector = require('./BaseConnector');

class SQLConnector extends BaseConnector {
    constructor(config) {
        super(config);
        this.dbType = config.type || 'mysql'; // mysql, postgresql, sqlite
        this.pool = null;
        this.schema = null;
    }

    /**
     * Establish connection to SQL database
     */
    async connect() {
        try {
            switch (this.dbType) {
                case 'mysql':
                    await this._connectMySQL();
                    break;
                case 'postgresql':
                case 'postgres':
                    await this._connectPostgreSQL();
                    break;
                case 'sqlite':
                    await this._connectSQLite();
                    break;
                default:
                    throw new Error(`Unsupported database type: ${this.dbType}`);
            }

            this.isConnected = true;
            return true;
        } catch (error) {
            this.isConnected = false;
            throw new Error(`Connection failed: ${error.message}`);
        }
    }

    /**
     * Connect to MySQL database
     */
    async _connectMySQL() {
        const mysql = require('mysql2/promise');

        const connectionConfig = {
            host: this.config.host || 'localhost',
            port: this.config.port || 3306,
            user: this.config.username,
            password: this.config.password,
            database: this.config.database,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            // Extended timeout for slow cloud databases (30 seconds)
            connectTimeout: this.config.connectTimeout || 30000,
            // Enable keep-alive to prevent connection drops
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
        };

        // Add SSL support for cloud databases
        if (this.config.ssl || this.config.useSSL) {
            connectionConfig.ssl = {
                rejectUnauthorized: this.config.sslRejectUnauthorized !== false
            };
        }

        this.pool = mysql.createPool(connectionConfig);

        // Test connection with extended timeout
        console.log(`🔌 Connecting to MySQL at ${connectionConfig.host}:${connectionConfig.port}...`);
        const conn = await this.pool.getConnection();
        console.log(`✅ MySQL connection successful`);
        conn.release();
    }

    /**
     * Connect to PostgreSQL database
     */
    async _connectPostgreSQL() {
        const { Pool } = require('pg');

        const connectionConfig = {
            host: this.config.host || 'localhost',
            port: this.config.port || 5432,
            user: this.config.username,
            password: this.config.password,
            database: this.config.database,
            max: 5,
            // Extended timeout for slow cloud databases (30 seconds)
            connectionTimeoutMillis: this.config.connectTimeout || 30000,
            idleTimeoutMillis: 30000,
            // Query timeout
            query_timeout: 60000
        };

        // Add SSL support for cloud databases (required for most cloud providers)
        if (this.config.ssl || this.config.useSSL) {
            connectionConfig.ssl = {
                rejectUnauthorized: this.config.sslRejectUnauthorized !== false
            };
        }

        this.pool = new Pool(connectionConfig);

        // Test connection
        console.log(`🔌 Connecting to PostgreSQL at ${connectionConfig.host}:${connectionConfig.port}...`);
        const client = await this.pool.connect();
        console.log(`✅ PostgreSQL connection successful`);
        client.release();
    }

    /**
     * Connect to SQLite database
     */
    async _connectSQLite() {
        const initSqlJs = require('sql.js');
        const fs = require('fs');
        const path = require('path');

        // Initialize SQL.js
        const SQL = await initSqlJs();

        // For SQLite, config.database is the file path
        const dbPath = this.config.database;

        if (fs.existsSync(dbPath)) {
            // Load existing database
            const fileBuffer = fs.readFileSync(dbPath);
            this.pool = new SQL.Database(fileBuffer);
        } else {
            // Create new database
            this.pool = new SQL.Database();
        }

        // Store path for saving
        this.sqlitePath = dbPath;
    }

    /**
     * Get database schema (tables and columns)
     */
    async getSchema() {
        if (!this.isConnected) {
            throw new Error('Not connected to database');
        }

        let tables = [];

        switch (this.dbType) {
            case 'mysql':
                tables = await this._getMySQLSchema();
                break;
            case 'postgresql':
            case 'postgres':
                tables = await this._getPostgreSQLSchema();
                break;
            case 'sqlite':
                tables = await this._getSQLiteSchema();
                break;
        }

        this.schema = {
            dbType: this.dbType,
            database: this.config.database,
            tables
        };

        return this.schema;
    }

    /**
     * Get MySQL schema
     */
    async _getMySQLSchema() {
        const [tables] = await this.pool.execute(
            'SELECT TABLE_NAME, TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
            [this.config.database]
        );

        const schema = [];

        for (const table of tables) {
            const tableName = table.TABLE_NAME;
            const [columns] = await this.pool.execute(
                `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY 
                 FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                [this.config.database, tableName]
            );
            const profile = await this._getMySQLTableProfile(tableName, table.TABLE_ROWS);

            schema.push({
                name: tableName,
                rowCount: profile.rowCount,
                indexes: profile.indexes,
                foreignKeys: profile.foreignKeys,
                columns: columns.map(col => ({
                    name: col.COLUMN_NAME,
                    type: col.DATA_TYPE,
                    nullable: col.IS_NULLABLE === 'YES',
                    key: col.COLUMN_KEY
                }))
            });
        }

        return schema;
    }

    /**
     * Get PostgreSQL schema
     */
    async _getPostgreSQLSchema() {
        const tablesResult = await this.pool.query(
            `SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );

        const schema = [];

        for (const table of tablesResult.rows) {
            const tableName = table.table_name;
            const profile = await this._getPostgreSQLTableProfile(tableName);
            const columnsResult = await this.pool.query(
                `SELECT column_name, data_type, is_nullable 
                 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = $1`,
                [tableName]
            );

            schema.push({
                name: tableName,
                rowCount: profile.rowCount,
                indexes: profile.indexes,
                foreignKeys: profile.foreignKeys,
                columns: columnsResult.rows.map(col => ({
                    name: col.column_name,
                    type: col.data_type,
                    nullable: col.is_nullable === 'YES',
                    key: profile.primaryKeys.has(col.column_name) ? 'PRI' : null
                }))
            });
        }

        return schema;
    }

    /**
     * Get SQLite schema
     */
    async _getSQLiteSchema() {
        const tablesStmt = this.pool.exec(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );

        const tables = tablesStmt.length > 0 ? tablesStmt[0].values.map(row => ({ name: row[0] })) : [];
        const schema = [];

        for (const table of tables) {
            const columnsStmt = this.pool.exec(`PRAGMA table_info(${this._quoteIdentifier(table.name)})`);
            const columns = columnsStmt.length > 0 ? columnsStmt[0].values : [];
            const profile = await this._getSQLiteTableProfile(table.name);

            schema.push({
                name: table.name,
                rowCount: profile.rowCount,
                indexes: profile.indexes,
                foreignKeys: profile.foreignKeys,
                columns: columns.map(col => ({
                    name: col[1],     // name is at index 1
                    type: col[2],     // type is at index 2
                    nullable: !col[3], // notnull is at index 3
                    key: col[5] ? 'PRI' : null  // pk is at index 5
                }))
            });
        }

        return schema;
    }

    _quoteIdentifier(identifier) {
        const parts = String(identifier).split('.');
        if (this.dbType === 'mysql') {
            return parts.map(part => `\`${part.replace(/`/g, '``')}\``).join('.');
        }
        return parts.map(part => `"${part.replace(/"/g, '""')}"`).join('.');
    }

    async _getMySQLTableProfile(tableName, estimatedRows = null) {
        const profile = { rowCount: estimatedRows ?? null, indexes: [], foreignKeys: [] };

        try {
            const [countRows] = await this.pool.execute(
                `SELECT COUNT(*) AS rowCount FROM ${this._quoteIdentifier(tableName)}`
            );
            profile.rowCount = Number(countRows[0]?.rowCount ?? profile.rowCount);
        } catch (error) {
            // Keep estimated row count if exact count is unavailable.
        }

        try {
            const [fkRows] = await this.pool.execute(
                `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, CONSTRAINT_NAME
                 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
                [this.config.database, tableName]
            );
            profile.foreignKeys = fkRows.map(row => ({
                column: row.COLUMN_NAME,
                referencesTable: row.REFERENCED_TABLE_NAME,
                referencesColumn: row.REFERENCED_COLUMN_NAME,
                constraintName: row.CONSTRAINT_NAME
            }));
        } catch (error) {
            profile.foreignKeys = [];
        }

        try {
            const [indexRows] = await this.pool.execute(
                `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
                 FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                 ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
                [this.config.database, tableName]
            );
            profile.indexes = this._groupIndexRows(indexRows, {
                name: 'INDEX_NAME',
                column: 'COLUMN_NAME',
                unique: row => row.NON_UNIQUE === 0
            });
        } catch (error) {
            profile.indexes = [];
        }

        return profile;
    }

    async _getPostgreSQLTableProfile(tableName) {
        const profile = { rowCount: null, indexes: [], foreignKeys: [], primaryKeys: new Set() };

        try {
            const countResult = await this.pool.query(
                `SELECT COUNT(*)::bigint AS "rowCount" FROM ${this._quoteIdentifier(tableName)}`
            );
            profile.rowCount = Number(countResult.rows[0]?.rowCount ?? 0);
        } catch (error) {
            profile.rowCount = null;
        }

        try {
            const pkResult = await this.pool.query(
                `SELECT kcu.column_name
                 FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu
                   ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                 WHERE tc.table_schema = 'public'
                   AND tc.table_name = $1
                   AND tc.constraint_type = 'PRIMARY KEY'`,
                [tableName]
            );
            profile.primaryKeys = new Set(pkResult.rows.map(row => row.column_name));
        } catch (error) {
            profile.primaryKeys = new Set();
        }

        try {
            const fkResult = await this.pool.query(
                `SELECT
                    kcu.column_name,
                    ccu.table_name AS referenced_table,
                    ccu.column_name AS referenced_column,
                    tc.constraint_name
                 FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu
                   ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                 JOIN information_schema.constraint_column_usage ccu
                   ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                 WHERE tc.table_schema = 'public'
                   AND tc.table_name = $1
                   AND tc.constraint_type = 'FOREIGN KEY'`,
                [tableName]
            );
            profile.foreignKeys = fkResult.rows.map(row => ({
                column: row.column_name,
                referencesTable: row.referenced_table,
                referencesColumn: row.referenced_column,
                constraintName: row.constraint_name
            }));
        } catch (error) {
            profile.foreignKeys = [];
        }

        try {
            const indexResult = await this.pool.query(
                `SELECT indexname, indexdef
                 FROM pg_indexes
                 WHERE schemaname = 'public' AND tablename = $1`,
                [tableName]
            );
            profile.indexes = indexResult.rows.map(row => ({
                name: row.indexname,
                definition: row.indexdef,
                unique: /\bUNIQUE\b/i.test(row.indexdef)
            }));
        } catch (error) {
            profile.indexes = [];
        }

        return profile;
    }

    async _getSQLiteTableProfile(tableName) {
        const profile = { rowCount: null, indexes: [], foreignKeys: [] };

        try {
            const countStmt = this.pool.exec(`SELECT COUNT(*) AS rowCount FROM ${this._quoteIdentifier(tableName)}`);
            profile.rowCount = countStmt.length > 0 ? Number(countStmt[0].values[0][0]) : 0;
        } catch (error) {
            profile.rowCount = null;
        }

        try {
            const fkStmt = this.pool.exec(`PRAGMA foreign_key_list(${this._quoteIdentifier(tableName)})`);
            if (fkStmt.length > 0) {
                const columns = fkStmt[0].columns;
                profile.foreignKeys = fkStmt[0].values.map(row => {
                    const obj = {};
                    columns.forEach((col, idx) => {
                        obj[col] = row[idx];
                    });
                    return {
                        column: obj.from,
                        referencesTable: obj.table,
                        referencesColumn: obj.to,
                        constraintName: `fk_${obj.id}`
                    };
                });
            }
        } catch (error) {
            profile.foreignKeys = [];
        }

        try {
            const indexStmt = this.pool.exec(`PRAGMA index_list(${this._quoteIdentifier(tableName)})`);
            if (indexStmt.length > 0) {
                profile.indexes = indexStmt[0].values.map(row => ({
                    name: row[1],
                    unique: Boolean(row[2]),
                    origin: row[3]
                }));
            }
        } catch (error) {
            profile.indexes = [];
        }

        return profile;
    }

    _groupIndexRows(rows, config) {
        const indexes = new Map();

        for (const row of rows) {
            const name = row[config.name];
            if (!indexes.has(name)) {
                indexes.set(name, {
                    name,
                    unique: Boolean(config.unique(row)),
                    columns: []
                });
            }
            indexes.get(name).columns.push(row[config.column]);
        }

        return Array.from(indexes.values());
    }

    /**
     * Execute a SQL query
     */
    async runQuery(query) {
        if (!this.isConnected) {
            throw new Error('Not connected to database');
        }

        try {
            // Validate query for safety
            const validation = this.validateQuery(query);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.reason,
                    query
                };
            }

            const dryRun = await this._dryRunQuery(query);
            if (!dryRun.valid) {
                return {
                    success: false,
                    error: dryRun.reason,
                    query
                };
            }

            let result;

            switch (this.dbType) {
                case 'mysql':
                    const [rows] = await this.pool.execute(query);
                    result = {
                        rows: Array.isArray(rows) ? rows : [],
                        rowCount: Array.isArray(rows) ? rows.length : 0
                    };
                    break;

                case 'postgresql':
                case 'postgres':
                    const pgResult = await this.pool.query(query);
                    result = {
                        rows: pgResult.rows,
                        rowCount: pgResult.rowCount
                    };
                    break;

                case 'sqlite':
                    const sqliteResult = this.pool.exec(query);
                    let sqliteRows = [];
                    if (sqliteResult.length > 0) {
                        const columns = sqliteResult[0].columns;
                        sqliteRows = sqliteResult[0].values.map(row => {
                            const obj = {};
                            columns.forEach((col, idx) => {
                                obj[col] = row[idx];
                            });
                            return obj;
                        });
                    }
                    result = {
                        rows: sqliteRows,
                        rowCount: sqliteRows.length
                    };
                    break;
            }

            return {
                success: true,
                data: result.rows,
                rowCount: result.rowCount,
                columns: result.rows.length > 0 ? Object.keys(result.rows[0]) : []
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                query: query
            };
        }
    }

    async _dryRunQuery(query) {
        if (this.config.skipDryRun) {
            return { valid: true };
        }

        const cleanedQuery = String(query).trim().replace(/;+\s*$/, '');
        const firstWord = cleanedQuery.split(/\s+/)[0]?.toUpperCase();

        // EXPLAIN validates SELECT/CTE queries without returning application data.
        if (!['SELECT', 'WITH'].includes(firstWord)) {
            return { valid: true };
        }

        try {
            switch (this.dbType) {
                case 'mysql':
                    await this.pool.execute(`EXPLAIN ${cleanedQuery}`);
                    break;
                case 'postgresql':
                case 'postgres':
                    await this.pool.query(`EXPLAIN ${cleanedQuery}`);
                    break;
                case 'sqlite':
                    this.pool.exec(`EXPLAIN QUERY PLAN ${cleanedQuery}`);
                    break;
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                reason: `Query validation failed: ${error.message}`
            };
        }
    }

    /**
     * Format schema for OpenAI prompt
     */
    formatSchemaForAI() {
        if (!this.schema) {
            return 'Schema not available';
        }

        let schemaStr = `Database Type: ${this.dbType}\n`;
        schemaStr += `Database: ${this.schema.database}\n\n`;
        schemaStr += 'Tables:\n';

        for (const table of this.schema.tables) {
            const rowInfo = Number.isFinite(table.rowCount) ? ` (${table.rowCount} rows)` : '';
            schemaStr += `\n${table.name}${rowInfo}:\n`;
            for (const col of table.columns) {
                const keyInfo = col.key === 'PRI' ? ' (PRIMARY KEY)' : '';
                const fk = table.foreignKeys?.find(f => f.column === col.name);
                const fkInfo = fk ? ` (FOREIGN KEY -> ${fk.referencesTable}.${fk.referencesColumn})` : '';
                const nullInfo = col.nullable ? '' : ' NOT NULL';
                schemaStr += `  - ${col.name}: ${col.type}${keyInfo}${fkInfo}${nullInfo}\n`;
            }

            if (table.foreignKeys && table.foreignKeys.length > 0) {
                schemaStr += '  Relationships:\n';
                for (const fk of table.foreignKeys) {
                    schemaStr += `    - ${table.name}.${fk.column} -> ${fk.referencesTable}.${fk.referencesColumn}\n`;
                }
            }

            if (table.indexes && table.indexes.length > 0) {
                schemaStr += '  Indexes:\n';
                for (const index of table.indexes.slice(0, 8)) {
                    const indexColumns = index.columns ? ` (${index.columns.join(', ')})` : '';
                    const uniqueInfo = index.unique ? ' UNIQUE' : '';
                    schemaStr += `    - ${index.name}${uniqueInfo}${indexColumns}\n`;
                }
            }
        }

        return schemaStr;
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.pool) {
            switch (this.dbType) {
                case 'mysql':
                    await this.pool.end();
                    break;
                case 'postgresql':
                case 'postgres':
                    await this.pool.end();
                    break;
                case 'sqlite':
                    this.pool.close();
                    break;
            }
        }
        this.isConnected = false;
        this.pool = null;
    }
}

module.exports = SQLConnector;
