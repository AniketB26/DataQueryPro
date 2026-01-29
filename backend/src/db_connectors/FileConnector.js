/**
 * File Connector
 * 
 * Connector for file-based data sources (Excel, CSV).
 * Uses in-memory data storage and supports Pandas-like operations.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const BaseConnector = require('./BaseConnector');

class FileConnector extends BaseConnector {
    constructor(config) {
        super(config);
        this.dbType = config.fileType || 'csv'; // csv or excel
        this.data = null; // In-memory data storage
        this.schema = null;
        this.sheets = {}; // For Excel files with multiple sheets
    }

    /**
     * Find actual column name (case-insensitive match)
     * @param {Object} row - A data row
     * @param {string} columnName - Column name to find
     * @returns {string|null} - Actual column name or null
     */
    _findColumnName(row, columnName) {
        if (!row || !columnName) return null;

        // Exact match first
        if (columnName in row) return columnName;

        // Case-insensitive match
        const lowerCol = columnName.toLowerCase();
        for (const key of Object.keys(row)) {
            if (key.toLowerCase() === lowerCol) {
                return key;
            }
        }
        return null;
    }

    /**
     * Load and parse file data
     */
    async connect() {
        try {
            const filePath = this.config.filePath;

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const ext = path.extname(filePath).toLowerCase();

            if (ext === '.csv') {
                await this._loadCSV(filePath);
            } else if (ext === '.xlsx' || ext === '.xls') {
                await this._loadExcel(filePath);
            } else {
                throw new Error(`Unsupported file type: ${ext}`);
            }

            this.isConnected = true;
            return true;
        } catch (error) {
            this.isConnected = false;
            throw new Error(`File load failed: ${error.message}`);
        }
    }

    /**
     * Load CSV file
     */
    async _loadCSV(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');

        const records = parse(content, {
            columns: true, // Use first row as headers
            skip_empty_lines: true,
            trim: true,
            cast: true // Auto-convert numbers
        });

        const fileName = path.basename(filePath, path.extname(filePath));
        this.sheets[fileName] = records;
        this.data = records;
        this.dbType = 'csv';
    }

    /**
     * Load Excel file
     */
    async _loadExcel(filePath) {
        const workbook = XLSX.readFile(filePath);

        // Load all sheets
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet, {
                defval: null,
                raw: false
            });
            this.sheets[sheetName] = data;
        }

        // Set default data to first sheet or specified sheet
        const targetSheet = this.config.sheetName || workbook.SheetNames[0];
        this.data = this.sheets[targetSheet] || [];
        this.dbType = 'excel';
    }

    /**
     * Get schema (sheets/tables and columns)
     */
    async getSchema() {
        if (!this.isConnected) {
            throw new Error('No file loaded');
        }

        const tables = [];

        for (const [sheetName, data] of Object.entries(this.sheets)) {
            if (data.length === 0) {
                tables.push({
                    name: sheetName,
                    columns: [],
                    rowCount: 0
                });
                continue;
            }

            // Infer column types from data
            const columns = this._inferColumnTypes(data);

            tables.push({
                name: sheetName,
                columns,
                rowCount: data.length,
                sampleData: data.slice(0, 3) // Include sample data
            });
        }

        this.schema = {
            dbType: this.dbType,
            fileName: this.config.filePath,
            tables
        };

        return this.schema;
    }

    /**
     * Infer column types from data
     */
    _inferColumnTypes(data) {
        if (data.length === 0) return [];

        const columns = Object.keys(data[0]);
        const columnTypes = [];

        for (const col of columns) {
            const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
            const type = this._inferType(values);

            columnTypes.push({
                name: col,
                type,
                nullable: data.some(row => row[col] === null || row[col] === undefined || row[col] === ''),
                sampleValues: values.slice(0, 3)
            });
        }

        return columnTypes;
    }

    /**
     * Infer type from array of values
     */
    _inferType(values) {
        if (values.length === 0) return 'unknown';

        const types = values.map(v => {
            if (typeof v === 'number') return 'number';
            if (typeof v === 'boolean') return 'boolean';
            if (v instanceof Date) return 'date';
            if (typeof v === 'string') {
                // Check if it's a date string
                if (!isNaN(Date.parse(v)) && v.match(/\d{4}[-/]\d{2}[-/]\d{2}/)) {
                    return 'date';
                }
                // Check if it's a number string
                if (!isNaN(parseFloat(v)) && isFinite(v)) {
                    return 'number';
                }
                return 'string';
            }
            return 'unknown';
        });

        // Return most common type
        const typeCounts = types.reduce((acc, t) => {
            acc[t] = (acc[t] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
    }

    /**
     * Execute a query on the file data
     * Supports SQL-like operations translated to JavaScript array operations
     */
    async runQuery(queryString) {
        if (!this.isConnected) {
            throw new Error('No file loaded');
        }

        try {
            // Import table matcher for fuzzy matching
            const { findBestTableMatch } = require('../utils/tableMatcher');

            // Parse the query operation
            const query = typeof queryString === 'string'
                ? JSON.parse(queryString)
                : queryString;

            // Get the target data (sheet/table) with fuzzy matching
            const availableSheets = Object.keys(this.sheets);
            let sheetName = query.table || availableSheets[0];

            // If exact match doesn't exist, try fuzzy match
            if (!this.sheets[sheetName]) {
                const { match, score } = findBestTableMatch(sheetName, availableSheets, 0.5);
                if (match) {
                    console.log(`Table "${sheetName}" fuzzy matched to "${match}" (score: ${score.toFixed(2)})`);
                    sheetName = match;
                }
            }

            let data = this.sheets[sheetName] ? [...this.sheets[sheetName]] : null;

            if (!data) {
                throw new Error(`Sheet/table not found: ${query.table}. Available: ${availableSheets.join(', ')}`);
            }

            // Apply operations
            if (query.filter) {
                data = this._applyFilter(data, query.filter);
            }

            if (query.select && query.select !== '*') {
                data = this._applySelect(data, query.select);
            }

            if (query.orderBy) {
                data = this._applyOrderBy(data, query.orderBy);
            }

            if (query.groupBy) {
                data = this._applyGroupBy(data, query.groupBy, query.aggregates);
            }

            if (query.limit) {
                data = data.slice(0, query.limit);
            }

            return {
                success: true,
                data: data,
                rowCount: data.length,
                columns: data.length > 0 ? Object.keys(data[0]) : []
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
     * Apply filter conditions (with case-insensitive column matching)
     */
    _applyFilter(data, filters) {
        if (!data || data.length === 0) return data;

        // Get a sample row to resolve column names
        const sampleRow = data[0];

        return data.filter(row => {
            for (const filter of filters) {
                const { column, operator, value } = filter;

                // Find actual column name (case-insensitive)
                const actualColumn = this._findColumnName(row, column);
                if (!actualColumn && operator !== 'IS NULL') {
                    // Column doesn't exist - skip this filter
                    continue;
                }

                const cellValue = actualColumn ? row[actualColumn] : undefined;
                const op = operator.toUpperCase();

                switch (op) {
                    case '=':
                    case '==':
                        if (cellValue != value) return false;
                        break;
                    case '!=':
                    case '<>':
                        if (cellValue == value) return false;
                        break;
                    case '>':
                        if (!(cellValue > value)) return false;
                        break;
                    case '>=':
                        if (!(cellValue >= value)) return false;
                        break;
                    case '<':
                        if (!(cellValue < value)) return false;
                        break;
                    case '<=':
                        if (!(cellValue <= value)) return false;
                        break;
                    case 'LIKE':
                        const regex = new RegExp(String(value).replace(/%/g, '.*'), 'i');
                        if (!regex.test(String(cellValue))) return false;
                        break;
                    case 'IN':
                        if (!Array.isArray(value) || !value.includes(cellValue)) return false;
                        break;
                    case 'IS NULL':
                        // Check for null, undefined, empty string, or "NULL" string
                        const isNullValue = cellValue === null ||
                            cellValue === undefined ||
                            cellValue === '' ||
                            cellValue === 'NULL' ||
                            cellValue === 'null';
                        if (!isNullValue) return false;
                        break;
                    case 'IS NOT NULL':
                        const isNotNullValue = cellValue !== null &&
                            cellValue !== undefined &&
                            cellValue !== '' &&
                            cellValue !== 'NULL' &&
                            cellValue !== 'null';
                        if (!isNotNullValue) return false;
                        break;
                }
            }
            return true;
        });
    }

    /**
     * Apply column selection (with case-insensitive column matching)
     */
    _applySelect(data, columns) {
        if (!data || data.length === 0) return data;

        const cols = Array.isArray(columns) ? columns : [columns];
        return data.map(row => {
            const newRow = {};
            for (const col of cols) {
                // Find actual column name (case-insensitive)
                const actualCol = this._findColumnName(row, col);
                if (actualCol) {
                    newRow[actualCol] = row[actualCol];
                }
            }
            return newRow;
        });
    }

    /**
     * Apply ordering (with case-insensitive column matching)
     */
    _applyOrderBy(data, orderBy) {
        if (!data || data.length === 0) return data;

        const { column, direction = 'ASC' } = orderBy;
        const dir = direction.toUpperCase() === 'DESC' ? -1 : 1;

        // Find actual column name from first row
        const actualColumn = this._findColumnName(data[0], column) || column;

        return data.sort((a, b) => {
            if (a[actualColumn] < b[actualColumn]) return -1 * dir;
            if (a[actualColumn] > b[actualColumn]) return 1 * dir;
            return 0;
        });
    }

    /**
     * Apply grouping with aggregations
     */
    _applyGroupBy(data, groupBy, aggregates = []) {
        const groups = new Map();

        for (const row of data) {
            const key = Array.isArray(groupBy)
                ? groupBy.map(g => row[g]).join('|||')
                : row[groupBy];

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(row);
        }

        const result = [];

        for (const [key, rows] of groups) {
            const resultRow = {};

            // Add group by columns
            if (Array.isArray(groupBy)) {
                groupBy.forEach((col, i) => {
                    resultRow[col] = key.split('|||')[i];
                });
            } else {
                resultRow[groupBy] = key;
            }

            // Apply aggregates
            for (const agg of aggregates) {
                const { function: fn, column, alias } = agg;
                const values = rows.map(r => r[column]).filter(v => v !== null && v !== undefined);

                switch (fn.toUpperCase()) {
                    case 'COUNT':
                        resultRow[alias || `COUNT(${column})`] = values.length;
                        break;
                    case 'SUM':
                        resultRow[alias || `SUM(${column})`] = values.reduce((a, b) => a + Number(b), 0);
                        break;
                    case 'AVG':
                        resultRow[alias || `AVG(${column})`] = values.reduce((a, b) => a + Number(b), 0) / values.length;
                        break;
                    case 'MIN':
                        resultRow[alias || `MIN(${column})`] = Math.min(...values.map(Number));
                        break;
                    case 'MAX':
                        resultRow[alias || `MAX(${column})`] = Math.max(...values.map(Number));
                        break;
                }
            }

            result.push(resultRow);
        }

        return result;
    }

    /**
     * Format schema for OpenAI prompt
     */
    formatSchemaForAI() {
        if (!this.schema) {
            return 'Schema not available';
        }

        let schemaStr = `File Type: ${this.dbType.toUpperCase()}\n`;
        schemaStr += `File: ${this.schema.fileName}\n\n`;
        schemaStr += 'Sheets/Tables:\n';

        for (const table of this.schema.tables) {
            schemaStr += `\n${table.name} (${table.rowCount} rows):\n`;
            for (const col of table.columns) {
                schemaStr += `  - ${col.name}: ${col.type}`;
                if (col.sampleValues && col.sampleValues.length > 0) {
                    schemaStr += ` (e.g., ${col.sampleValues.slice(0, 2).join(', ')})`;
                }
                schemaStr += '\n';
            }
        }

        return schemaStr;
    }

    /**
     * Validate query (file operations are generally safe)
     */
    validateQuery(query, options = {}) {
        // File operations are read-only, so generally safe
        return { valid: true };
    }

    /**
     * Close connection (cleanup)
     */
    async close() {
        this.data = null;
        this.sheets = {};
        this.schema = null;
        this.isConnected = false;
    }
}

module.exports = FileConnector;
