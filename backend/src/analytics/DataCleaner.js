/**
 * Data Cleaner
 * 
 * Automated data preprocessing and cleaning utilities.
 * Handles type detection, normalization, and data quality improvements.
 */

// Date format patterns for detection
const DATE_PATTERNS = [
    { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' },
    { pattern: /^\d{4}\/\d{2}\/\d{2}$/, format: 'YYYY/MM/DD' },
    { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'DD-MM-YYYY' },
    { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'DD/MM/YYYY' },
    { pattern: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, format: 'M/D/YYYY' },
    { pattern: /^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$/, format: 'Mon DD, YYYY' },
    { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'ISO' }
];

// Currency symbols to remove
const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹', '₽', 'USD', 'EUR', 'GBP'];

// Common null representations
const NULL_VALUES = [
    null, undefined, '', 'null', 'NULL', 'Null',
    'none', 'None', 'NONE', 'n/a', 'N/A', 'NA',
    'nan', 'NaN', 'NAN', '-', '--', 'undefined',
    'missing', 'Missing', 'MISSING', '#N/A', '#REF!', '#VALUE!'
];

/**
 * Detect the data type of a column based on sample values
 * @param {Array} values - Sample values from a column
 * @returns {Object} - { type, confidence, format? }
 */
function detectColumnType(values) {
    if (!values || values.length === 0) {
        return { type: 'unknown', confidence: 0 };
    }

    // Filter out nulls for analysis
    const nonNull = values.filter(v => !isNullValue(v));
    if (nonNull.length === 0) {
        return { type: 'null', confidence: 1 };
    }

    const sampleSize = Math.min(nonNull.length, 100);
    const sample = nonNull.slice(0, sampleSize);

    const typeScores = {
        number: 0,
        integer: 0,
        float: 0,
        date: 0,
        boolean: 0,
        id: 0,
        email: 0,
        url: 0,
        text: 0,
        category: 0
    };

    for (const val of sample) {
        const strVal = String(val).trim();

        // Check for numeric
        const cleaned = cleanNumericString(strVal);
        if (!isNaN(parseFloat(cleaned)) && isFinite(cleaned)) {
            typeScores.number++;
            if (Number.isInteger(parseFloat(cleaned))) {
                typeScores.integer++;
            } else {
                typeScores.float++;
            }
        }

        // Check for date
        if (isDateLike(strVal)) {
            typeScores.date++;
        }

        // Check for boolean
        if (['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(strVal.toLowerCase())) {
            typeScores.boolean++;
        }

        // Check for email
        if (/^[\w.-]+@[\w.-]+\.\w+$/.test(strVal)) {
            typeScores.email++;
        }

        // Check for URL
        if (/^https?:\/\//i.test(strVal)) {
            typeScores.url++;
        }

        // Check for ID-like (alphanumeric, consistent format)
        if (/^[a-f0-9]{24}$/i.test(strVal) || /^[a-f0-9-]{36}$/i.test(strVal)) {
            typeScores.id++;
        }
    }

    // Calculate percentages
    const total = sample.length;
    for (const key of Object.keys(typeScores)) {
        typeScores[key] = typeScores[key] / total;
    }

    // Determine best type
    if (typeScores.date > 0.8) {
        return { type: 'date', confidence: typeScores.date };
    }
    if (typeScores.email > 0.8) {
        return { type: 'email', confidence: typeScores.email };
    }
    if (typeScores.url > 0.8) {
        return { type: 'url', confidence: typeScores.url };
    }
    if (typeScores.boolean > 0.8) {
        return { type: 'boolean', confidence: typeScores.boolean };
    }
    if (typeScores.id > 0.8) {
        return { type: 'id', confidence: typeScores.id };
    }
    if (typeScores.integer > 0.8) {
        return { type: 'integer', confidence: typeScores.integer };
    }
    if (typeScores.number > 0.7) {
        return { type: 'number', confidence: typeScores.number };
    }

    // Check if categorical (few unique values relative to sample size)
    const uniqueRatio = new Set(sample).size / sample.length;
    if (uniqueRatio < 0.3 && sample.length >= 10) {
        return { type: 'category', confidence: 1 - uniqueRatio };
    }

    return { type: 'text', confidence: 0.5 };
}

/**
 * Check if a value represents null/missing data
 */
function isNullValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        return NULL_VALUES.some(n =>
            n !== null && n !== undefined &&
            String(n).toLowerCase() === trimmed
        );
    }
    return false;
}

/**
 * Check if a string looks like a date
 */
function isDateLike(str) {
    if (typeof str !== 'string') return false;

    // Check against known patterns
    for (const { pattern } of DATE_PATTERNS) {
        if (pattern.test(str)) return true;
    }

    // Try parsing
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        // Make sure it's not just a number
        if (!/^\d+$/.test(str)) {
            return true;
        }
    }

    return false;
}

/**
 * Clean a numeric string (remove currency, commas, etc.)
 */
function cleanNumericString(str) {
    if (typeof str !== 'string') return str;
    let cleaned = str.trim();

    // Remove currency symbols
    for (const symbol of CURRENCY_SYMBOLS) {
        cleaned = cleaned.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }

    // Remove thousands separators (commas)
    cleaned = cleaned.replace(/,/g, '');

    // Handle percentage
    if (cleaned.endsWith('%')) {
        cleaned = cleaned.slice(0, -1);
    }

    // Handle parentheses for negative numbers
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        cleaned = '-' + cleaned.slice(1, -1);
    }

    return cleaned.trim();
}

/**
 * Parse and normalize a date value
 */
function parseDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

    const str = String(value).trim();

    // Try ISO format first
    let date = new Date(str);
    if (!isNaN(date.getTime())) return date;

    // Try common formats
    // MM/DD/YYYY or M/D/YYYY
    const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdyMatch) {
        let year = parseInt(mdyMatch[3]);
        if (year < 100) year += year > 50 ? 1900 : 2000;
        date = new Date(year, parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]));
        if (!isNaN(date.getTime())) return date;
    }

    // DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyMatch) {
        date = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
        if (!isNaN(date.getTime())) return date;
    }

    return null;
}

/**
 * Normalize a numeric value
 */
function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return isNaN(value) ? null : value;

    const cleaned = cleanNumericString(String(value));
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Normalize a boolean value
 */
function parseBoolean(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;

    const str = String(value).trim().toLowerCase();
    if (['true', 'yes', '1', 'y', 'on'].includes(str)) return true;
    if (['false', 'no', '0', 'n', 'off'].includes(str)) return false;
    return null;
}

/**
 * Clean text field (trim, normalize whitespace, handle special chars)
 */
function cleanText(value) {
    if (value === null || value === undefined) return null;

    let text = String(value);

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Remove common HTML entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Convert common emojis to text (basic handling)
    const emojiMap = {
        '👍': '[thumbs_up]',
        '👎': '[thumbs_down]',
        '❤️': '[heart]',
        '⭐': '[star]',
        '😀': '[happy]',
        '😢': '[sad]',
        '😡': '[angry]'
    };
    for (const [emoji, text_rep] of Object.entries(emojiMap)) {
        text = text.replace(new RegExp(emoji, 'g'), text_rep);
    }

    return text || null;
}

/**
 * Clean an entire dataset
 * @param {Array} data - Array of row objects
 * @param {Object} options - Cleaning options
 * @returns {Object} - { cleanedData, columnTypes, report }
 */
function cleanDataset(data, options = {}) {
    if (!data || data.length === 0) {
        return { cleanedData: [], columnTypes: {}, report: { rows: 0 } };
    }

    const {
        inferTypes = true,
        normalizeNulls = true,
        cleanStrings = true,
        convertTypes = true,
        sampleSize = 100
    } = options;

    // Get column names
    const columns = Object.keys(data[0]);
    const columnTypes = {};
    const report = {
        rows: data.length,
        columns: columns.length,
        nullsFound: 0,
        typeConversions: 0,
        columnsAnalyzed: {}
    };

    // Analyze and detect types for each column
    if (inferTypes) {
        for (const col of columns) {
            const sampleValues = data.slice(0, sampleSize).map(row => row[col]);
            const typeInfo = detectColumnType(sampleValues);
            columnTypes[col] = typeInfo;
            report.columnsAnalyzed[col] = typeInfo;
        }
    }

    // Clean the data
    const cleanedData = data.map(row => {
        const cleanedRow = {};

        for (const col of columns) {
            let value = row[col];

            // Handle null values
            if (normalizeNulls && isNullValue(value)) {
                cleanedRow[col] = null;
                report.nullsFound++;
                continue;
            }

            // Convert types based on detection
            if (convertTypes && columnTypes[col]) {
                const type = columnTypes[col].type;

                switch (type) {
                    case 'number':
                    case 'integer':
                    case 'float':
                        const num = parseNumber(value);
                        if (num !== null) {
                            value = num;
                            report.typeConversions++;
                        }
                        break;
                    case 'date':
                        const date = parseDate(value);
                        if (date !== null) {
                            value = date;
                            report.typeConversions++;
                        }
                        break;
                    case 'boolean':
                        const bool = parseBoolean(value);
                        if (bool !== null) {
                            value = bool;
                            report.typeConversions++;
                        }
                        break;
                    case 'text':
                    case 'category':
                        if (cleanStrings && typeof value === 'string') {
                            value = cleanText(value);
                        }
                        break;
                }
            } else if (cleanStrings && typeof value === 'string') {
                value = cleanText(value);
            }

            cleanedRow[col] = value;
        }

        return cleanedRow;
    });

    return { cleanedData, columnTypes, report };
}

/**
 * Handle missing values in a dataset
 * @param {Array} data - Dataset
 * @param {Object} strategies - Column-specific strategies { column: 'mean'|'median'|'mode'|'drop'|value }
 */
function handleMissingValues(data, strategies = {}) {
    if (!data || data.length === 0) return data;

    const columns = Object.keys(data[0]);
    const stats = require('./StatisticalEngine');

    // Pre-calculate column statistics for imputation
    const columnStats = {};
    for (const col of columns) {
        const values = data.map(row => row[col]).filter(v => !isNullValue(v));
        columnStats[col] = {
            mean: stats.mean(values.filter(v => typeof v === 'number')),
            median: stats.median(values.filter(v => typeof v === 'number')),
            mode: stats.mode(values)
        };
    }

    // Apply strategies
    return data.map(row => {
        const newRow = { ...row };

        for (const col of columns) {
            if (isNullValue(row[col]) && strategies[col]) {
                const strategy = strategies[col];

                if (strategy === 'mean') {
                    newRow[col] = columnStats[col].mean;
                } else if (strategy === 'median') {
                    newRow[col] = columnStats[col].median;
                } else if (strategy === 'mode') {
                    newRow[col] = columnStats[col].mode;
                } else if (strategy !== 'drop') {
                    newRow[col] = strategy; // Use provided default value
                }
            }
        }

        return newRow;
    }).filter(row => {
        // Remove rows where 'drop' strategy was specified for null columns
        for (const col of columns) {
            if (strategies[col] === 'drop' && isNullValue(row[col])) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Generate data quality report
 */
function generateQualityReport(data) {
    if (!data || data.length === 0) {
        return { quality: 'empty', issues: ['Dataset is empty'] };
    }

    const columns = Object.keys(data[0]);
    const report = {
        totalRows: data.length,
        totalColumns: columns.length,
        columns: {},
        overallQuality: 100,
        issues: []
    };

    for (const col of columns) {
        const values = data.map(row => row[col]);
        const nullCount = values.filter(v => isNullValue(v)).length;
        const nullPercent = (nullCount / values.length) * 100;
        const uniqueCount = new Set(values.filter(v => !isNullValue(v))).size;
        const typeInfo = detectColumnType(values);

        report.columns[col] = {
            type: typeInfo.type,
            typeConfidence: typeInfo.confidence,
            nullCount,
            nullPercent: nullPercent.toFixed(2) + '%',
            uniqueValues: uniqueCount,
            uniqueRatio: (uniqueCount / (values.length - nullCount)).toFixed(2)
        };

        // Flag issues
        if (nullPercent > 50) {
            report.issues.push(`Column "${col}" has ${nullPercent.toFixed(0)}% missing values`);
            report.overallQuality -= 5;
        }
        if (typeInfo.confidence < 0.5) {
            report.issues.push(`Column "${col}" has inconsistent data types`);
            report.overallQuality -= 3;
        }
    }

    report.overallQuality = Math.max(0, report.overallQuality);
    return report;
}

module.exports = {
    detectColumnType,
    isNullValue,
    isDateLike,
    cleanNumericString,
    parseDate,
    parseNumber,
    parseBoolean,
    cleanText,
    cleanDataset,
    handleMissingValues,
    generateQualityReport,
    NULL_VALUES,
    DATE_PATTERNS
};
