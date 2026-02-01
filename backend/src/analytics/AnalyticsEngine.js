/**
 * Analytics Engine
 * 
 * Central orchestrator for the AI Data Analyst Engine.
 * Coordinates semantic mapping, query planning, statistical analysis,
 * and response generation.
 */

const SemanticMapper = require('./SemanticMapper');
const StatisticalEngine = require('./StatisticalEngine');
const DataCleaner = require('./DataCleaner');
const QueryPlanner = require('./QueryPlanner');

/**
 * Main Analytics Engine class
 */
class AnalyticsEngine {
    constructor() {
        this.conversationHistory = [];
        this.previousIntent = null;
        this.cachedData = null;
        this.cachedSchema = null;
    }

    /**
     * Main entry point for analyzing a query
     * @param {string} question - Natural language question
     * @param {Object} schema - Database schema
     * @param {string} dbType - Database type (sql, mongodb, file)
     * @param {Array} data - Optional data for file-based analysis
     * @returns {Object} - Analysis result
     */
    async analyzeQuery(question, schema, dbType, data = null) {
        // Parse intent from natural language
        const intent = QueryPlanner.parseQueryIntent(question, schema);

        // Merge with previous context for follow-up questions
        const mergedIntent = QueryPlanner.mergeConversationContext(intent, this.previousIntent);

        // Generate semantic hints for AI
        const semanticHints = SemanticMapper.generateSemanticHints(question, schema);

        // Create execution plan
        const plan = QueryPlanner.createExecutionPlan(mergedIntent, dbType);

        // Store for follow-up context
        this.previousIntent = mergedIntent;
        this.conversationHistory.push({ question, intent: mergedIntent });

        return {
            intent: mergedIntent,
            plan,
            semanticHints,
            clarificationNeeded: mergedIntent.clarificationNeeded,
            suggestedClarification: mergedIntent.suggestedClarification
        };
    }

    /**
     * Execute analytics operations on data
     * @param {Array} data - Data to analyze
     * @param {Object} plan - Execution plan from analyzeQuery
     * @returns {Object} - Analysis results
     */
    async executeAnalytics(data, plan) {
        if (!data || data.length === 0) {
            return { success: false, error: 'No data provided', data: [] };
        }

        let result = [...data];
        const executionLog = [];

        try {
            // Clean data first
            const { cleanedData, columnTypes, report } = DataCleaner.cleanDataset(result, {
                inferTypes: true,
                normalizeNulls: true,
                convertTypes: true
            });
            result = cleanedData;
            executionLog.push({ step: 'Data Cleaning', result: report });

            // Execute each step in the plan
            for (const step of plan.steps) {
                const stepResult = await this._executeStep(result, step, plan.intent);
                result = stepResult.data;
                executionLog.push({ step: step.description, rowCount: result.length });
            }

            // Generate insights
            const insights = this._generateInsights(result, plan.intent);

            return {
                success: true,
                data: result,
                rowCount: result.length,
                executionLog,
                insights,
                complexity: plan.estimatedComplexity
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                data: result,
                executionLog
            };
        }
    }

    /**
     * Execute a single step of the plan
     */
    async _executeStep(data, step, intent) {
        const { OPERATION_TYPES } = QueryPlanner;

        switch (step.operation) {
            case OPERATION_TYPES.FILTER:
                return this._executeFilter(data, step, intent);

            case OPERATION_TYPES.GROUP:
                return this._executeGroup(data, step, intent);

            case OPERATION_TYPES.AGGREGATE:
                return this._executeAggregate(data, step, intent);

            case OPERATION_TYPES.WINDOW:
                return this._executeWindow(data, step, intent);

            case OPERATION_TYPES.ORDER:
                return this._executeOrder(data, step, intent);

            case OPERATION_TYPES.LIMIT:
                return { data: data.slice(0, step.config.value) };

            case OPERATION_TYPES.STATISTICAL:
                return this._executeStatistical(data, step, intent);

            default:
                return { data };
        }
    }

    /**
     * Execute filter operation
     */
    _executeFilter(data, step, intent) {
        if (!step.config.semantic) {
            return { data };
        }

        const filter = step.config.filter;
        const ratingColumns = ['rating', 'score', 'stars', 'rate', 'value'];

        // Find rating column
        const columns = Object.keys(data[0] || {});
        let ratingCol = null;
        for (const col of columns) {
            if (ratingColumns.some(rc => col.toLowerCase().includes(rc))) {
                ratingCol = col;
                break;
            }
        }

        if (!ratingCol) {
            return { data };
        }

        const { operator, threshold } = filter.suggestedFilter;
        const filtered = data.filter(row => {
            const val = parseFloat(row[ratingCol]);
            if (isNaN(val)) return false;
            return operator === '<=' ? val <= threshold : val >= threshold;
        });

        return { data: filtered };
    }

    /**
     * Execute grouping operation
     */
    _executeGroup(data, step, intent) {
        const groupCols = step.config.columns;
        const timeInterval = step.config.timeInterval;

        if (timeInterval) {
            // Time-based grouping
            const dateColumns = ['date', 'created', 'timestamp', 'created_at', 'time'];
            const columns = Object.keys(data[0] || {});
            let dateCol = null;

            for (const col of columns) {
                if (dateColumns.some(dc => col.toLowerCase().includes(dc))) {
                    dateCol = col;
                    break;
                }
            }

            if (dateCol) {
                // Find a numeric column to aggregate
                const numericCol = columns.find(c => {
                    const sample = data.slice(0, 10).map(r => r[c]);
                    return sample.some(v => typeof v === 'number' || !isNaN(parseFloat(v)));
                });

                const aggFunc = intent.aggregations.length > 0
                    ? intent.aggregations[0].function.toLowerCase()
                    : 'count';

                return {
                    data: StatisticalEngine.groupByTimeInterval(
                        data, dateCol, timeInterval, numericCol || dateCol, aggFunc
                    )
                };
            }
        }

        if (groupCols.length === 0) {
            return { data };
        }

        // Standard grouping
        const groups = new Map();
        for (const row of data) {
            const key = groupCols.map(c => row[c]).join('|||');
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(row);
        }

        const result = [];
        for (const [key, rows] of groups) {
            const groupRow = {};
            groupCols.forEach((col, i) => {
                groupRow[col] = key.split('|||')[i];
            });
            groupRow.count = rows.length;
            result.push(groupRow);
        }

        return { data: result };
    }

    /**
     * Execute aggregation operation
     */
    _executeAggregate(data, step, intent) {
        if (data.length === 0) return { data: [] };

        const functions = step.config.functions;
        const columns = Object.keys(data[0]);

        // Find numeric columns
        const numericCols = columns.filter(col => {
            const sample = data.slice(0, 10).map(r => r[col]);
            return sample.some(v => typeof v === 'number' || !isNaN(parseFloat(v)));
        });

        if (numericCols.length === 0) {
            return { data };
        }

        const targetCol = numericCols[0];
        const values = data.map(r => parseFloat(r[targetCol])).filter(v => !isNaN(v));

        const result = {};
        for (const func of functions) {
            switch (func) {
                case 'AVG':
                    result.average = StatisticalEngine.mean(values);
                    break;
                case 'SUM':
                    result.sum = values.reduce((a, b) => a + b, 0);
                    break;
                case 'COUNT':
                    result.count = values.length;
                    break;
                case 'MAX':
                    result.max = Math.max(...values);
                    break;
                case 'MIN':
                    result.min = Math.min(...values);
                    break;
                case 'MEDIAN':
                    result.median = StatisticalEngine.median(values);
                    break;
                case 'STDEV':
                    result.stdev = StatisticalEngine.standardDeviation(values);
                    break;
            }
        }

        result.column = targetCol;
        return { data: [result] };
    }

    /**
     * Execute window function
     */
    _executeWindow(data, step, intent) {
        const func = step.config.function;
        const columns = Object.keys(data[0] || {});

        // Find the order column (usually numeric or the one mentioned in query)
        const orderCol = intent.columns.length > 0
            ? intent.columns[0].column
            : columns.find(c => {
                const sample = data.slice(0, 10).map(r => r[c]);
                return sample.some(v => typeof v === 'number');
            }) || columns[0];

        const direction = intent.orderDirection || 'DESC';

        switch (func) {
            case 'RANK':
                return { data: StatisticalEngine.rank(data, orderCol, direction) };
            case 'DENSE_RANK':
                return { data: StatisticalEngine.denseRank(data, orderCol, direction) };
            case 'ROW_NUMBER':
                return { data: StatisticalEngine.rowNumber(data, orderCol, direction) };
            case 'PERCENT_RANK':
                return { data: StatisticalEngine.percentRank(data, orderCol, direction) };
            case 'RUNNING_TOTAL':
                return { data: StatisticalEngine.runningTotal(data, orderCol) };
            case 'RUNNING_AVG':
                return { data: StatisticalEngine.runningAverage(data, orderCol) };
            case 'ROLLING_AVG':
                return { data: StatisticalEngine.rollingAverage(data, orderCol, 7) };
            case 'LAG':
                return { data: StatisticalEngine.lag(data, orderCol, 1, null, orderCol, direction) };
            case 'LEAD':
                return { data: StatisticalEngine.lead(data, orderCol, 1, null, orderCol, direction) };
            default:
                return { data };
        }
    }

    /**
     * Execute ordering operation
     */
    _executeOrder(data, step, intent) {
        const columns = Object.keys(data[0] || {});
        const direction = step.config.direction || 'DESC';

        // Find column to order by
        const orderCol = intent.columns.length > 0
            ? intent.columns[0].column
            : columns.find(c => {
                const sample = data.slice(0, 10).map(r => r[c]);
                return sample.some(v => typeof v === 'number');
            }) || columns[0];

        const sorted = [...data].sort((a, b) => {
            const valA = a[orderCol];
            const valB = b[orderCol];
            const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
            return direction === 'DESC' ? -cmp : cmp;
        });

        return { data: sorted };
    }

    /**
     * Execute statistical operation
     */
    _executeStatistical(data, step, intent) {
        if (step.config.operation === 'percentile_filter') {
            const columns = Object.keys(data[0] || {});
            const numericCol = intent.columns.length > 0
                ? intent.columns[0].column
                : columns.find(c => {
                    const sample = data.slice(0, 10).map(r => r[c]);
                    return sample.some(v => typeof v === 'number');
                });

            if (numericCol) {
                return {
                    data: StatisticalEngine.filterByPercentile(
                        data, numericCol, step.config.value, step.config.direction
                    )
                };
            }
        }
        return { data };
    }

    /**
     * Generate insights from analysis results
     */
    _generateInsights(data, intent) {
        const insights = [];

        if (!data || data.length === 0) {
            return ['No data available for analysis'];
        }

        const columns = Object.keys(data[0]);

        // Basic count insight
        insights.push(`Found ${data.length} results`);

        // Look for numeric columns and provide stats
        for (const col of columns) {
            const values = data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
            if (values.length > 0) {
                const stats = StatisticalEngine.describe(values);
                if (stats.mean !== null) {
                    insights.push(
                        `${col}: avg=${stats.mean.toFixed(2)}, min=${stats.min}, max=${stats.max}`
                    );

                    // Check for outliers
                    const outlierInfo = StatisticalEngine.detectOutliers(values);
                    if (outlierInfo.outliers.length > 0) {
                        insights.push(`${outlierInfo.outliers.length} potential outliers detected in ${col}`);
                    }
                }
                break; // Only analyze first numeric column for insights
            }
        }

        // Trend insight if time-based
        if (intent.timeAnalysis && data.length >= 3) {
            const firstValue = Object.values(data[0]).find(v => typeof v === 'number');
            const lastValue = Object.values(data[data.length - 1]).find(v => typeof v === 'number');
            if (firstValue && lastValue) {
                const change = ((lastValue - firstValue) / firstValue * 100).toFixed(1);
                insights.push(`Trend: ${change > 0 ? '+' : ''}${change}% change from first to last period`);
            }
        }

        return insights;
    }

    /**
     * Enhanced query generation for AI
     * Returns enriched prompt information for the AI translator
     */
    getEnhancedPromptData(question, schema, dbType) {
        const analysis = QueryPlanner.parseQueryIntent(question, schema);
        const semanticHints = SemanticMapper.generateSemanticHints(question, schema);
        const intents = SemanticMapper.detectAnalyticsIntent(question);

        return {
            originalQuestion: question,
            parsedIntent: analysis,
            semanticHints,
            analyticsIntents: intents,
            suggestedApproach: this._getSuggestedApproach(analysis, dbType),
            requiredOperations: analysis.operations.map(op => op.type)
        };
    }

    /**
     * Get suggested approach based on intent and db type
     */
    _getSuggestedApproach(intent, dbType) {
        const approaches = [];

        if (intent.aggregations.length > 0) {
            approaches.push('Use aggregation functions');
        }
        if (intent.groupBy.length > 0) {
            approaches.push('Group results by category');
        }
        if (intent.window) {
            approaches.push(`Apply ${intent.window.function} window function`);
        }
        if (intent.timeAnalysis) {
            approaches.push(`Analyze by ${intent.timeAnalysis.interval}`);
        }
        if (intent.semanticFilter) {
            approaches.push(`Filter for ${intent.semanticFilter.type} sentiment`);
        }
        if (intent.percentileFilter) {
            approaches.push(`Get ${intent.percentileFilter.type} ${intent.percentileFilter.value}%`);
        }

        return approaches;
    }

    /**
     * Clear conversation context
     */
    clearContext() {
        this.conversationHistory = [];
        this.previousIntent = null;
    }
}

// Export singleton instance and class
const analyticsEngine = new AnalyticsEngine();

module.exports = {
    AnalyticsEngine,
    analyticsEngine,
    // Re-export sub-modules for direct access
    SemanticMapper,
    StatisticalEngine,
    DataCleaner,
    QueryPlanner
};
