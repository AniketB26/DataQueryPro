/**
 * Statistical Engine
 * 
 * Advanced statistical computation engine for data analytics.
 * Supports aggregations, window functions, percentiles, correlations, and more.
 */

/**
 * Calculate mean (average)
 */
function mean(values) {
    if (!values || values.length === 0) return null;
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Calculate median
 */
function median(values) {
    if (!values || values.length === 0) return null;
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
    if (nums.length === 0) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * Calculate mode (most frequent value)
 */
function mode(values) {
    if (!values || values.length === 0) return null;
    const counts = {};
    let maxCount = 0;
    let modeValue = null;

    for (const val of values) {
        if (val === null || val === undefined) continue;
        counts[val] = (counts[val] || 0) + 1;
        if (counts[val] > maxCount) {
            maxCount = counts[val];
            modeValue = val;
        }
    }
    return modeValue;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values, population = false) {
    if (!values || values.length === 0) return null;
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (nums.length < 2) return 0;

    const avg = mean(nums);
    const squaredDiffs = nums.map(v => Math.pow(v - avg, 2));
    const divisor = population ? nums.length : nums.length - 1;
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / divisor);
}

/**
 * Calculate variance
 */
function variance(values, population = false) {
    const std = standardDeviation(values, population);
    return std !== null ? std * std : null;
}

/**
 * Calculate percentile
 * @param {Array} values - Array of numbers
 * @param {number} p - Percentile (0-100)
 */
function percentile(values, p) {
    if (!values || values.length === 0 || p < 0 || p > 100) return null;
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
    if (nums.length === 0) return null;

    const index = (p / 100) * (nums.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= nums.length) return nums[nums.length - 1];
    return nums[lower] * (1 - weight) + nums[upper] * weight;
}

/**
 * Calculate quartiles (Q1, Q2, Q3)
 */
function quartiles(values) {
    return {
        q1: percentile(values, 25),
        q2: percentile(values, 50),
        q3: percentile(values, 75),
        iqr: percentile(values, 75) - percentile(values, 25)
    };
}

/**
 * Detect outliers using IQR method
 */
function detectOutliers(values, multiplier = 1.5) {
    if (!values || values.length === 0) return { outliers: [], bounds: null };

    const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
    const q = quartiles(nums);
    const lowerBound = q.q1 - multiplier * q.iqr;
    const upperBound = q.q3 + multiplier * q.iqr;

    const outliers = nums.filter(v => v < lowerBound || v > upperBound);

    return {
        outliers,
        bounds: { lower: lowerBound, upper: upperBound },
        quartiles: q
    };
}

/**
 * Calculate Pearson correlation coefficient
 */
function correlation(values1, values2) {
    if (!values1 || !values2 || values1.length !== values2.length || values1.length < 2) {
        return null;
    }

    const n = values1.length;
    const mean1 = mean(values1);
    const mean2 = mean(values2);

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < n; i++) {
        const diff1 = values1[i] - mean1;
        const diff2 = values2[i] - mean2;
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
    }

    if (denom1 === 0 || denom2 === 0) return 0;
    return numerator / Math.sqrt(denom1 * denom2);
}

/**
 * Calculate descriptive statistics for a column
 */
function describe(values) {
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
    if (nums.length === 0) {
        return {
            count: values.length,
            numericCount: 0,
            unique: new Set(values).size
        };
    }

    const sorted = [...nums].sort((a, b) => a - b);
    const q = quartiles(nums);

    return {
        count: values.length,
        numericCount: nums.length,
        unique: new Set(values).size,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        range: sorted[sorted.length - 1] - sorted[0],
        sum: nums.reduce((a, b) => a + b, 0),
        mean: mean(nums),
        median: median(nums),
        mode: mode(nums),
        std: standardDeviation(nums),
        variance: variance(nums),
        q1: q.q1,
        q3: q.q3,
        iqr: q.iqr
    };
}

// ==================== WINDOW FUNCTIONS ====================

/**
 * Apply ROW_NUMBER to data
 * Assigns sequential numbers to rows in order
 */
function rowNumber(data, orderByColumn, direction = 'ASC') {
    const sorted = [...data].sort((a, b) => {
        const valA = a[orderByColumn];
        const valB = b[orderByColumn];
        const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
        return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
    });

    return sorted.map((row, idx) => ({
        ...row,
        row_number: idx + 1
    }));
}

/**
 * Apply RANK to data
 * Same values get same rank, gaps after ties
 */
function rank(data, orderByColumn, direction = 'ASC') {
    const sorted = [...data].sort((a, b) => {
        const valA = a[orderByColumn];
        const valB = b[orderByColumn];
        const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
        return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
    });

    let currentRank = 1;
    let prevValue = null;
    let sameCount = 0;

    return sorted.map((row, idx) => {
        const val = row[orderByColumn];
        if (idx === 0) {
            prevValue = val;
        } else if (val === prevValue) {
            sameCount++;
        } else {
            currentRank += sameCount + 1;
            sameCount = 0;
            prevValue = val;
        }
        return { ...row, rank: currentRank };
    });
}

/**
 * Apply DENSE_RANK to data
 * Same values get same rank, no gaps after ties
 */
function denseRank(data, orderByColumn, direction = 'ASC') {
    const sorted = [...data].sort((a, b) => {
        const valA = a[orderByColumn];
        const valB = b[orderByColumn];
        const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
        return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
    });

    let currentRank = 1;
    let prevValue = null;

    return sorted.map((row, idx) => {
        const val = row[orderByColumn];
        if (idx > 0 && val !== prevValue) {
            currentRank++;
        }
        prevValue = val;
        return { ...row, dense_rank: currentRank };
    });
}

/**
 * Apply PERCENT_RANK to data
 * Relative rank as percentage
 */
function percentRank(data, orderByColumn, direction = 'ASC') {
    const ranked = rank(data, orderByColumn, direction);
    const n = ranked.length;

    return ranked.map(row => ({
        ...row,
        percent_rank: n > 1 ? (row.rank - 1) / (n - 1) : 0
    }));
}

/**
 * Apply LAG function
 * Get value from previous row
 */
function lag(data, column, offset = 1, defaultValue = null, orderByColumn = null, direction = 'ASC') {
    let sorted = data;
    if (orderByColumn) {
        sorted = [...data].sort((a, b) => {
            const valA = a[orderByColumn];
            const valB = b[orderByColumn];
            const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
            return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
        });
    }

    return sorted.map((row, idx) => ({
        ...row,
        [`lag_${column}`]: idx >= offset ? sorted[idx - offset][column] : defaultValue
    }));
}

/**
 * Apply LEAD function
 * Get value from next row
 */
function lead(data, column, offset = 1, defaultValue = null, orderByColumn = null, direction = 'ASC') {
    let sorted = data;
    if (orderByColumn) {
        sorted = [...data].sort((a, b) => {
            const valA = a[orderByColumn];
            const valB = b[orderByColumn];
            const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
            return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
        });
    }

    return sorted.map((row, idx) => ({
        ...row,
        [`lead_${column}`]: idx + offset < sorted.length ? sorted[idx + offset][column] : defaultValue
    }));
}

/**
 * Calculate running total (cumulative sum)
 */
function runningTotal(data, column, orderByColumn = null, direction = 'ASC') {
    let sorted = data;
    if (orderByColumn) {
        sorted = [...data].sort((a, b) => {
            const valA = a[orderByColumn];
            const valB = b[orderByColumn];
            const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
            return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
        });
    }

    let cumSum = 0;
    return sorted.map(row => {
        const val = parseFloat(row[column]) || 0;
        cumSum += val;
        return { ...row, running_total: cumSum };
    });
}

/**
 * Calculate running average (cumulative average)
 */
function runningAverage(data, column, orderByColumn = null, direction = 'ASC') {
    let sorted = data;
    if (orderByColumn) {
        sorted = [...data].sort((a, b) => {
            const valA = a[orderByColumn];
            const valB = b[orderByColumn];
            const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
            return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
        });
    }

    let cumSum = 0;
    return sorted.map((row, idx) => {
        const val = parseFloat(row[column]) || 0;
        cumSum += val;
        return { ...row, running_avg: cumSum / (idx + 1) };
    });
}

/**
 * Calculate rolling/moving average
 */
function rollingAverage(data, column, windowSize, orderByColumn = null, direction = 'ASC') {
    let sorted = data;
    if (orderByColumn) {
        sorted = [...data].sort((a, b) => {
            const valA = a[orderByColumn];
            const valB = b[orderByColumn];
            const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
            return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
        });
    }

    return sorted.map((row, idx) => {
        const startIdx = Math.max(0, idx - windowSize + 1);
        const windowData = sorted.slice(startIdx, idx + 1);
        const values = windowData.map(r => parseFloat(r[column]) || 0);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { ...row, [`rolling_avg_${windowSize}`]: avg };
    });
}

/**
 * Calculate NTILE (divide into buckets)
 */
function ntile(data, n, orderByColumn, direction = 'ASC') {
    const sorted = [...data].sort((a, b) => {
        const valA = a[orderByColumn];
        const valB = b[orderByColumn];
        const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
        return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
    });

    const bucketSize = Math.ceil(sorted.length / n);

    return sorted.map((row, idx) => ({
        ...row,
        ntile: Math.floor(idx / bucketSize) + 1
    }));
}

/**
 * Filter top/bottom N percent
 */
function filterByPercentile(data, column, percentileValue, type = 'top') {
    const nums = data.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
    const threshold = percentile(nums, type === 'top' ? (100 - percentileValue) : percentileValue);

    if (type === 'top') {
        return data.filter(row => parseFloat(row[column]) >= threshold);
    } else {
        return data.filter(row => parseFloat(row[column]) <= threshold);
    }
}

/**
 * Time-based grouping and aggregation
 * Enhanced to support statistical aggregations (stdev, variance, median, percentile)
 */
function groupByTimeInterval(data, dateColumn, interval, aggregateColumn, aggregateFunc = 'count', options = {}) {
    const parseDate = (val) => {
        if (val instanceof Date) return val;
        const parsed = new Date(val);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const getIntervalKey = (date) => {
        if (!date) return 'unknown';
        switch (interval.toLowerCase()) {
            case 'year': return date.getFullYear().toString();
            case 'month': return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            case 'week': {
                const startOfYear = new Date(date.getFullYear(), 0, 1);
                const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
                return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
            }
            case 'day': return date.toISOString().split('T')[0];
            case 'quarter': return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
            default: return date.toISOString().split('T')[0];
        }
    };

    const groups = {};
    for (const row of data) {
        const date = parseDate(row[dateColumn]);
        const key = getIntervalKey(date);
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }

    const results = [];
    for (const [key, rows] of Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))) {
        const result = { [interval]: key };
        const values = rows.map(r => parseFloat(r[aggregateColumn])).filter(v => !isNaN(v));

        switch (aggregateFunc.toLowerCase()) {
            case 'count': result.count = rows.length; break;
            case 'sum': result.sum = values.reduce((a, b) => a + b, 0); break;
            case 'avg': case 'average': case 'mean': result.avg = mean(values); break;
            case 'min': result.min = Math.min(...values); break;
            case 'max': result.max = Math.max(...values); break;
            // Enhanced statistical aggregations - computed from raw data
            case 'stdev': case 'std': case 'standarddeviation': case 'sd':
                result.stdev = standardDeviation(values);
                break;
            case 'variance': case 'var':
                result.variance = variance(values);
                break;
            case 'median':
                result.median = median(values);
                break;
            case 'percentile':
                result.percentile = percentile(values, options.percentileValue || 50);
                break;
            default: result.count = rows.length;
        }
        results.push(result);
    }

    return results;
}

/**
 * Compute grouped statistics from raw data
 * @param {Array} data - Array of data rows
 * @param {string} valueColumn - Column containing values to compute statistics on
 * @param {Object} grouping - Grouping configuration { column, timeInterval }
 * @param {Array|string} statsToCompute - Statistics to compute: 'mean', 'stdev', 'variance', 'median', 'percentile', 'min', 'max', 'count', 'sum', 'all'
 * @param {Object} options - Additional options like { percentileValue: 95 }
 * @returns {Array} - Array of results with computed statistics per group
 */
function groupedStatistics(data, valueColumn, grouping = {}, statsToCompute = 'all', options = {}) {
    if (!data || data.length === 0) return [];

    const { column: groupColumn, timeInterval } = grouping;

    // Helper to get group key
    const getGroupKey = (row) => {
        if (timeInterval && groupColumn) {
            const dateVal = row[groupColumn];
            if (!dateVal) return 'unknown';
            const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
            if (isNaN(date.getTime())) return 'unknown';

            switch (timeInterval.toLowerCase()) {
                case 'year': return date.getFullYear().toString();
                case 'month': return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                case 'week': {
                    const startOfYear = new Date(date.getFullYear(), 0, 1);
                    const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
                    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
                }
                case 'day': return date.toISOString().split('T')[0];
                case 'quarter': return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
                default: return date.toISOString().split('T')[0];
            }
        }
        if (groupColumn) {
            return String(row[groupColumn] ?? 'unknown');
        }
        return '_all_'; // No grouping - compute for entire dataset
    };

    // Group data
    const groups = {};
    for (const row of data) {
        const key = getGroupKey(row);
        if (!groups[key]) groups[key] = [];
        const val = parseFloat(row[valueColumn]);
        if (!isNaN(val)) {
            groups[key].push(val);
        }
    }

    // Determine which stats to compute
    const allStats = ['count', 'sum', 'mean', 'median', 'stdev', 'variance', 'min', 'max', 'percentile'];
    let computeList = [];
    if (statsToCompute === 'all') {
        computeList = allStats;
    } else if (typeof statsToCompute === 'string') {
        computeList = [statsToCompute.toLowerCase()];
    } else if (Array.isArray(statsToCompute)) {
        computeList = statsToCompute.map(s => s.toLowerCase());
    }

    // Compute statistics for each group
    const results = [];
    const sortedKeys = Object.keys(groups).sort();

    for (const key of sortedKeys) {
        const values = groups[key];
        const result = {};

        // Add group identifier
        if (timeInterval) {
            result[timeInterval] = key;
        } else if (groupColumn) {
            result[groupColumn] = key;
        }

        // Compute requested statistics from raw values
        for (const stat of computeList) {
            switch (stat) {
                case 'count':
                    result.count = values.length;
                    break;
                case 'sum':
                    result.sum = values.reduce((a, b) => a + b, 0);
                    break;
                case 'mean': case 'avg': case 'average':
                    result.mean = mean(values);
                    break;
                case 'median':
                    result.median = median(values);
                    break;
                case 'stdev': case 'std': case 'standarddeviation': case 'sd':
                    result.stdev = standardDeviation(values);
                    break;
                case 'variance': case 'var':
                    result.variance = variance(values);
                    break;
                case 'min':
                    result.min = values.length > 0 ? Math.min(...values) : null;
                    break;
                case 'max':
                    result.max = values.length > 0 ? Math.max(...values) : null;
                    break;
                case 'percentile':
                    result[`p${options.percentileValue || 50}`] = percentile(values, options.percentileValue || 50);
                    break;
            }
        }

        results.push(result);
    }

    return results;
}

/**
 * Compute correlation between two columns from raw data
 * @param {Array} data - Array of data rows
 * @param {string} column1 - First column name
 * @param {string} column2 - Second column name
 * @returns {Object} - { correlation, column1, column2, sampleSize }
 */
function computeCorrelation(data, column1, column2) {
    if (!data || data.length < 2) return { correlation: null, error: 'Insufficient data' };

    const pairs = data
        .map(row => [parseFloat(row[column1]), parseFloat(row[column2])])
        .filter(([a, b]) => !isNaN(a) && !isNaN(b));

    if (pairs.length < 2) return { correlation: null, error: 'Insufficient numeric pairs' };

    const values1 = pairs.map(p => p[0]);
    const values2 = pairs.map(p => p[1]);

    return {
        correlation: correlation(values1, values2),
        column1,
        column2,
        sampleSize: pairs.length
    };
}

/**
 * Frequency distribution / value counts
 */
function valueCounts(data, column, normalize = false) {
    const counts = {};
    let total = 0;

    for (const row of data) {
        const val = row[column];
        if (val !== null && val !== undefined) {
            counts[val] = (counts[val] || 0) + 1;
            total++;
        }
    }

    const results = Object.entries(counts)
        .map(([value, count]) => ({
            value,
            count,
            percentage: normalize ? (count / total * 100).toFixed(2) + '%' : undefined
        }))
        .sort((a, b) => b.count - a.count);

    return results;
}

module.exports = {
    // Basic statistics
    mean,
    median,
    mode,
    standardDeviation,
    variance,
    percentile,
    quartiles,
    detectOutliers,
    correlation,
    describe,

    // Window functions
    rowNumber,
    rank,
    denseRank,
    percentRank,
    lag,
    lead,
    runningTotal,
    runningAverage,
    rollingAverage,
    ntile,

    // Filtering and grouping
    filterByPercentile,
    groupByTimeInterval,
    valueCounts,

    // Grouped statistics (computed from raw data)
    groupedStatistics,
    computeCorrelation
};
