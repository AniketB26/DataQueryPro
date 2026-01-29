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
            'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
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

            schema.push({
                name: tableName,
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
            const columnsResult = await this.pool.query(
                `SELECT column_name, data_type, is_nullable 
                 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = $1`,
                [tableName]
            );

            schema.push({
                name: tableName,
                columns: columnsResult.rows.map(col => ({
                    name: col.column_name,
                    type: col.data_type,
                    nullable: col.is_nullable === 'YES'
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
            const columnsStmt = this.pool.exec(`PRAGMA table_info(${table.name})`);
            const columns = columnsStmt.length > 0 ? columnsStmt[0].values : [];

            schema.push({
                name: table.name,
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

    /**
     * Execute a SQL query
     */
    async runQuery(query) {
        if (!this.isConnected) {
            throw new Error('Not connected to database');
        }

        // Validate query for safety
        const validation = this.validateQuery(query);
        if (!validation.valid) {
            throw new Error(validation.reason);
        }

        try {
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
            schemaStr += `\n${table.name}:\n`;
            for (const col of table.columns) {
                const keyInfo = col.key === 'PRI' ? ' (PRIMARY KEY)' : '';
                const nullInfo = col.nullable ? '' : ' NOT NULL';
                schemaStr += `  - ${col.name}: ${col.type}${keyInfo}${nullInfo}\n`;
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
