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
     * Supports SQL-like operations and advanced analytics translated to JavaScript array operations
     */
    async runQuery(queryString) {
        if (!this.isConnected) {
            throw new Error('No file loaded');
        }

        try {
            // Import required modules
            const { findBestTableMatch } = require('../utils/tableMatcher');
            const StatisticalEngine = require('../analytics/StatisticalEngine');
            const DataCleaner = require('../analytics/DataCleaner');

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

            // Store insights for response
            const insights = [];

            // Apply filter operations first
            if (query.filter) {
                data = this._applyFilter(data, query.filter);
            }

            // Apply percentile filtering (top/bottom X%)
            if (query.percentileFilter && data.length > 0) {
                const { type, value } = query.percentileFilter;
                const numericCol = this._findNumericColumn(data);
                if (numericCol) {
                    data = StatisticalEngine.filterByPercentile(data, numericCol, value, type);
                    insights.push(`Filtered to ${type} ${value}% by ${numericCol}`);
                }
            }

            // Apply time-based grouping
            if (query.timeGrouping && data.length > 0 && !query.computedMetrics) {
                const { column, interval } = query.timeGrouping;
                const dateCol = this._findColumnName(data[0], column) || this._findDateColumn(data);
                const numericCol = this._findNumericColumn(data);

                if (dateCol) {
                    const aggFunc = query.aggregates && query.aggregates.length > 0
                        ? query.aggregates[0].function.toLowerCase()
                        : 'count';
                    data = StatisticalEngine.groupByTimeInterval(data, dateCol, interval, numericCol || dateCol, aggFunc);
                    insights.push(`Grouped by ${interval}`);
                }
            }

            // Handle computedMetrics - compute statistics directly from raw data
            // This supports grouped statistical calculations (e.g., monthly SD of ratings)
            if (query.computedMetrics && data.length > 0) {
                const {
                    type,           // 'stdev', 'variance', 'avg', 'median', 'percentile', 'correlation', 'all'
                    column,         // Column to compute statistics on
                    column2,        // Second column for correlation
                    groupBy,        // Optional: categorical column to group by
                    timeGrouping,   // Optional: { column: 'date', interval: 'month' }
                    percentileValue // Optional: percentile value (default 50)
                } = query.computedMetrics;

                // Find the actual column name (case-insensitive matching)
                const valueCol = this._findColumnName(data[0], column) || this._findNumericColumn(data);

                if (!valueCol) {
                    throw new Error(`Cannot find numeric column "${column}" for computed metrics`);
                }

                // Handle correlation separately
                if (type && type.toLowerCase() === 'correlation') {
                    const col2 = this._findColumnName(data[0], column2) || null;
                    if (!col2) {
                        throw new Error(`Second column "${column2}" required for correlation`);
                    }
                    const corrResult = StatisticalEngine.computeCorrelation(data, valueCol, col2);
                    data = [{
                        column1: valueCol,
                        column2: col2,
                        correlation: corrResult.correlation,
                        sampleSize: corrResult.sampleSize
                    }];
                    insights.push(`Computed correlation between ${valueCol} and ${col2}`);
                } else {
                    // Build grouping configuration
                    const groupingConfig = {};
                    if (timeGrouping) {
                        const dateCol = this._findColumnName(data[0], timeGrouping.column) || this._findDateColumn(data);
                        if (dateCol) {
                            groupingConfig.column = dateCol;
                            groupingConfig.timeInterval = timeGrouping.interval || 'month';
                        }
                    } else if (groupBy) {
                        const groupCol = this._findColumnName(data[0], groupBy);
                        if (groupCol) {
                            groupingConfig.column = groupCol;
                        }
                    }

                    // Determine which statistics to compute
                    const statsToCompute = type ? type.toLowerCase() : 'all';
                    const options = { percentileValue: percentileValue || 50 };

                    // Compute statistics from raw data using groupedStatistics
                    data = StatisticalEngine.groupedStatistics(
                        data,
                        valueCol,
                        groupingConfig,
                        statsToCompute,
                        options
                    );

                    // Build insight message
                    let insightMsg = `Computed ${statsToCompute} of ${valueCol}`;
                    if (groupingConfig.timeInterval) {
                        insightMsg += ` by ${groupingConfig.timeInterval}`;
                    } else if (groupingConfig.column) {
                        insightMsg += ` grouped by ${groupingConfig.column}`;
                    }
                    insights.push(insightMsg);
                }
            }

            // Apply standard groupBy with aggregates
            if (query.groupBy && !query.timeGrouping) {
                data = this._applyGroupBy(data, query.groupBy, query.aggregates);
            }

            // Apply window functions
            if (query.windowFunction && data.length > 0) {
                const { type, orderBy, direction = 'DESC', window } = query.windowFunction;
                const orderCol = this._findColumnName(data[0], orderBy) || this._findNumericColumn(data);

                if (orderCol) {
                    switch (type.toUpperCase()) {
                        case 'RANK':
                            data = StatisticalEngine.rank(data, orderCol, direction);
                            break;
                        case 'DENSE_RANK':
                            data = StatisticalEngine.denseRank(data, orderCol, direction);
                            break;
                        case 'ROW_NUMBER':
                            data = StatisticalEngine.rowNumber(data, orderCol, direction);
                            break;
                        case 'PERCENT_RANK':
                            data = StatisticalEngine.percentRank(data, orderCol, direction);
                            break;
                        case 'RUNNING_TOTAL':
                            data = StatisticalEngine.runningTotal(data, orderCol);
                            break;
                        case 'RUNNING_AVG':
                            data = StatisticalEngine.runningAverage(data, orderCol);
                            break;
                        case 'ROLLING_AVG':
                            data = StatisticalEngine.rollingAverage(data, orderCol, window || 7);
                            break;
                        case 'LAG':
                            data = StatisticalEngine.lag(data, orderCol, 1, null, orderCol, direction);
                            break;
                        case 'LEAD':
                            data = StatisticalEngine.lead(data, orderCol, 1, null, orderCol, direction);
                            break;
                        case 'NTILE':
                            data = StatisticalEngine.ntile(data, window || 4, orderCol, direction);
                            break;
                    }
                    insights.push(`Applied ${type} window function`);
                }
            }

            // Apply statistical operations
            if (query.statistics && data.length > 0) {
                const { type, column, percentileValue } = query.statistics;
                const statCol = this._findColumnName(data[0], column) || this._findNumericColumn(data);

                if (statCol) {
                    const values = data.map(r => parseFloat(r[statCol])).filter(v => !isNaN(v));
                    let statResult = {};

                    switch (type.toUpperCase()) {
                        case 'DESCRIBE':
                            statResult = StatisticalEngine.describe(values);
                            statResult.column = statCol;
                            data = [statResult];
                            break;
                        case 'MEDIAN':
                            statResult = { column: statCol, median: StatisticalEngine.median(values) };
                            data = [statResult];
                            break;
                        case 'MODE':
                            statResult = { column: statCol, mode: StatisticalEngine.mode(values) };
                            data = [statResult];
                            break;
                        case 'STDEV':
                            statResult = { column: statCol, stdev: StatisticalEngine.standardDeviation(values) };
                            data = [statResult];
                            break;
                        case 'PERCENTILE':
                            statResult = {
                                column: statCol,
                                percentile: percentileValue,
                                value: StatisticalEngine.percentile(values, percentileValue || 50)
                            };
                            data = [statResult];
                            break;
                        case 'OUTLIERS':
                            const outlierInfo = StatisticalEngine.detectOutliers(values);
                            data = data.filter(r => {
                                const val = parseFloat(r[statCol]);
                                return outlierInfo.outliers.includes(val);
                            });
                            insights.push(`Found ${outlierInfo.outliers.length} outliers`);
                            break;
                        case 'DISTRIBUTION':
                        case 'VALUE_COUNTS':
                            data = StatisticalEngine.valueCounts(data, statCol, true);
                            break;
                    }
                }
            }

            // Apply column selection
            if (query.select && query.select !== '*' && !query.statistics) {
                data = this._applySelect(data, query.select);
            }

            // Apply ordering
            if (query.orderBy) {
                data = this._applyOrderBy(data, query.orderBy);
            }

            // Apply limit
            if (query.limit) {
                data = data.slice(0, query.limit);
            }

            return {
                success: true,
                data: data,
                rowCount: data.length,
                columns: data.length > 0 ? Object.keys(data[0]) : [],
                insights: insights.length > 0 ? insights : undefined
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
     * Find first numeric column in data
     */
    _findNumericColumn(data) {
        if (!data || data.length === 0) return null;
        const columns = Object.keys(data[0]);

        for (const col of columns) {
            const sample = data.slice(0, 10).map(r => r[col]);
            const numericCount = sample.filter(v => typeof v === 'number' || !isNaN(parseFloat(v))).length;
            if (numericCount >= sample.length * 0.7) {
                return col;
            }
        }
        return null;
    }

    /**
     * Find first date column in data
     */
    _findDateColumn(data) {
        if (!data || data.length === 0) return null;
        const columns = Object.keys(data[0]);
        const dateKeywords = ['date', 'time', 'created', 'updated', 'timestamp'];

        for (const col of columns) {
            if (dateKeywords.some(kw => col.toLowerCase().includes(kw))) {
                return col;
            }
        }
        return null;
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
     * Note: Sample values are for type inference only, not for answering questions
     */
    formatSchemaForAI() {
        if (!this.schema) {
            return 'Schema not available';
        }

        let schemaStr = `File Type: ${this.dbType.toUpperCase()}\n`;
        schemaStr += `File: ${this.schema.fileName}\n`;
        schemaStr += `\n⚠️ NOTE: Sample values below are for TYPE HINTS ONLY. Do NOT use them to answer questions or compute statistics. All calculations must query the full dataset.\n`;
        schemaStr += '\nSheets/Tables:\n';

        for (const table of this.schema.tables) {
            schemaStr += `\n${table.name} (${table.rowCount} rows):\n`;
            for (const col of table.columns) {
                schemaStr += `  - ${col.name}: ${col.type}`;
                if (col.sampleValues && col.sampleValues.length > 0) {
                    schemaStr += ` [type hint: ${col.sampleValues.slice(0, 2).join(', ')}]`;
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
