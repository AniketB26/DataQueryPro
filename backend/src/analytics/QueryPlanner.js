/**
 * Query Planner
 * 
 * Multi-step query decomposition and execution planning.
 * Breaks complex analytical queries into executable steps.
 */

const SemanticMapper = require('./SemanticMapper');

// Query operation types
const OPERATION_TYPES = {
    SELECT: 'select',
    FILTER: 'filter',
    GROUP: 'group',
    AGGREGATE: 'aggregate',
    ORDER: 'order',
    LIMIT: 'limit',
    JOIN: 'join',
    WINDOW: 'window',
    TRANSFORM: 'transform',
    STATISTICAL: 'statistical',
    COMPUTED_STATISTICAL: 'computed_statistical' // Compute metrics from raw data
};

// Aggregation function mappings (includes computed statistical metrics)
const AGGREGATION_KEYWORDS = {
    'average': 'AVG', 'avg': 'AVG', 'mean': 'AVG',
    'sum': 'SUM', 'total': 'SUM',
    'count': 'COUNT', 'number of': 'COUNT', 'how many': 'COUNT',
    'maximum': 'MAX', 'max': 'MAX', 'highest': 'MAX', 'largest': 'MAX',
    'minimum': 'MIN', 'min': 'MIN', 'lowest': 'MIN', 'smallest': 'MIN',
    'median': 'MEDIAN',
    'mode': 'MODE',
    'stdev': 'STDEV', 'standard deviation': 'STDEV', 'sd': 'STDEV', 'std': 'STDEV',
    'variance': 'VARIANCE', 'var': 'VARIANCE',
    'correlation': 'CORRELATION', 'correlate': 'CORRELATION',
    'covariance': 'COVARIANCE'
};

// Window function mappings
const WINDOW_KEYWORDS = {
    'rank': 'RANK', 'ranking': 'RANK',
    'dense rank': 'DENSE_RANK',
    'row number': 'ROW_NUMBER',
    'running total': 'RUNNING_TOTAL', 'cumulative sum': 'RUNNING_TOTAL',
    'running average': 'RUNNING_AVG', 'cumulative average': 'RUNNING_AVG',
    'moving average': 'ROLLING_AVG', 'rolling average': 'ROLLING_AVG',
    'previous': 'LAG', 'lag': 'LAG',
    'next': 'LEAD', 'lead': 'LEAD',
    'percentile': 'PERCENTILE', 'percent rank': 'PERCENT_RANK',
    'ntile': 'NTILE', 'quartile': 'NTILE'
};

// Time grouping patterns
const TIME_PATTERNS = {
    'per month': { interval: 'month', groupBy: true },
    'monthly': { interval: 'month', groupBy: true },
    'per year': { interval: 'year', groupBy: true },
    'yearly': { interval: 'year', groupBy: true },
    'annually': { interval: 'year', groupBy: true },
    'per week': { interval: 'week', groupBy: true },
    'weekly': { interval: 'week', groupBy: true },
    'per day': { interval: 'day', groupBy: true },
    'daily': { interval: 'day', groupBy: true },
    'per quarter': { interval: 'quarter', groupBy: true },
    'quarterly': { interval: 'quarter', groupBy: true },
    'over time': { timeSeries: true },
    'trend': { timeSeries: true, showTrend: true }
};

/**
 * Parse a natural language query into structured intent
 */
function parseQueryIntent(query, schema) {
    const lowerQuery = query.toLowerCase();
    const intent = {
        originalQuery: query,
        operations: [],
        columns: [],
        aggregations: [],
        filters: [],
        groupBy: [],
        orderBy: null,
        limit: null,
        window: null,
        timeAnalysis: null,
        clarificationNeeded: false,
        suggestedClarification: null
    };

    // Extract columns from schema
    const availableColumns = extractColumnsFromSchema(schema);

    // Find column references
    const columnRefs = SemanticMapper.extractColumnReferences(query, availableColumns);
    intent.columns = columnRefs;

    // Detect aggregation intent
    for (const [keyword, func] of Object.entries(AGGREGATION_KEYWORDS)) {
        if (lowerQuery.includes(keyword)) {
            intent.aggregations.push({ keyword, function: func });
        }
    }

    // Detect window function intent
    for (const [keyword, func] of Object.entries(WINDOW_KEYWORDS)) {
        if (lowerQuery.includes(keyword)) {
            intent.window = { keyword, function: func };
            break;
        }
    }

    // Detect time-based analysis
    for (const [pattern, config] of Object.entries(TIME_PATTERNS)) {
        if (lowerQuery.includes(pattern)) {
            intent.timeAnalysis = { pattern, ...config };
            break;
        }
    }

    // Detect limit/top patterns
    const topMatch = lowerQuery.match(/(?:top|first|best|highest)\s+(\d+)/);
    const bottomMatch = lowerQuery.match(/(?:bottom|last|worst|lowest)\s+(\d+)/);
    const percentMatch = lowerQuery.match(/(?:top|bottom)\s+(\d+)\s*%/);

    if (percentMatch) {
        intent.percentileFilter = {
            value: parseInt(percentMatch[1]),
            type: lowerQuery.includes('bottom') ? 'bottom' : 'top'
        };
    } else if (topMatch) {
        intent.limit = parseInt(topMatch[1]);
        intent.orderDirection = 'DESC';
    } else if (bottomMatch) {
        intent.limit = parseInt(bottomMatch[1]);
        intent.orderDirection = 'ASC';
    }

    // Detect ordering patterns
    if (lowerQuery.includes('ascending') || lowerQuery.includes('asc') || lowerQuery.includes('lowest first')) {
        intent.orderDirection = 'ASC';
    }
    if (lowerQuery.includes('descending') || lowerQuery.includes('desc') || lowerQuery.includes('highest first')) {
        intent.orderDirection = 'DESC';
    }

    // Detect sentiment/semantic filters
    const sentimentFilter = SemanticMapper.inferSentimentFilter(query);
    if (sentimentFilter) {
        intent.semanticFilter = sentimentFilter;
    }

    // Detect grouping patterns
    const groupByMatch = lowerQuery.match(/(?:by|per|for each|group by|grouped by)\s+(\w+)/);
    if (groupByMatch) {
        const groupCol = SemanticMapper.findBestColumnMatch(groupByMatch[1], availableColumns);
        if (groupCol.match) {
            intent.groupBy.push(groupCol.match);
        }
    }

    // Build operations list
    intent.operations = buildOperationsList(intent);

    // Check if clarification is needed
    if (intent.columns.length === 0 && intent.aggregations.length === 0) {
        intent.clarificationNeeded = true;
        intent.suggestedClarification = "Could you please specify which columns or metrics you'd like to analyze?";
    }

    return intent;
}

/**
 * Extract all column names from schema
 */
function extractColumnsFromSchema(schema) {
    const columns = [];

    if (!schema) return columns;

    // Handle string schema
    if (typeof schema === 'string') {
        try {
            schema = JSON.parse(schema);
        } catch {
            return columns;
        }
    }

    // SQL/File format
    if (schema.tables) {
        for (const table of schema.tables) {
            if (table.columns) {
                columns.push(...table.columns.map(c => c.name || c));
            }
        }
    }

    // MongoDB format
    if (schema.collections) {
        for (const coll of schema.collections) {
            if (coll.fields) {
                columns.push(...coll.fields.map(f => f.name || f));
            }
        }
    }

    return [...new Set(columns)];
}

/**
 * Build a list of execution operations from parsed intent
 */
function buildOperationsList(intent) {
    const ops = [];

    // 1. Data selection/source
    ops.push({
        type: OPERATION_TYPES.SELECT,
        columns: intent.columns.map(c => c.column),
        priority: 1
    });

    // 2. Filters (before aggregation)
    if (intent.semanticFilter) {
        ops.push({
            type: OPERATION_TYPES.FILTER,
            semantic: true,
            filter: intent.semanticFilter,
            priority: 2
        });
    }

    // 3. Grouping
    if (intent.groupBy.length > 0 || intent.timeAnalysis?.groupBy) {
        ops.push({
            type: OPERATION_TYPES.GROUP,
            columns: intent.groupBy,
            timeInterval: intent.timeAnalysis?.interval,
            priority: 3
        });
    }

    // 4. Aggregations
    if (intent.aggregations.length > 0) {
        ops.push({
            type: OPERATION_TYPES.AGGREGATE,
            functions: intent.aggregations.map(a => a.function),
            priority: 4
        });
    }

    // 5. Window functions
    if (intent.window) {
        ops.push({
            type: OPERATION_TYPES.WINDOW,
            function: intent.window.function,
            priority: 5
        });
    }

    // 6. Percentile filtering
    if (intent.percentileFilter) {
        ops.push({
            type: OPERATION_TYPES.STATISTICAL,
            operation: 'percentile_filter',
            value: intent.percentileFilter.value,
            direction: intent.percentileFilter.type,
            priority: 6
        });
    }

    // 7. Ordering
    if (intent.orderDirection || intent.limit) {
        ops.push({
            type: OPERATION_TYPES.ORDER,
            direction: intent.orderDirection || 'DESC',
            priority: 7
        });
    }

    // 8. Limit
    if (intent.limit) {
        ops.push({
            type: OPERATION_TYPES.LIMIT,
            value: intent.limit,
            priority: 8
        });
    }

    return ops.sort((a, b) => a.priority - b.priority);
}

/**
 * Create an execution plan from parsed intent
 */
function createExecutionPlan(intent, dbType) {
    const plan = {
        type: dbType,
        intent: intent,
        steps: [],
        estimatedComplexity: 'simple'
    };

    // Calculate complexity
    let complexity = 0;
    if (intent.aggregations.length > 0) complexity++;
    if (intent.groupBy.length > 0) complexity++;
    if (intent.window) complexity += 2;
    if (intent.timeAnalysis) complexity++;
    if (intent.percentileFilter) complexity++;
    if (intent.semanticFilter) complexity++;

    if (complexity >= 4) {
        plan.estimatedComplexity = 'complex';
    } else if (complexity >= 2) {
        plan.estimatedComplexity = 'moderate';
    }

    // Build step-by-step execution plan
    for (const op of intent.operations) {
        plan.steps.push({
            operation: op.type,
            description: describeOperation(op),
            config: op
        });
    }

    return plan;
}

/**
 * Generate a human-readable description of an operation
 */
function describeOperation(op) {
    switch (op.type) {
        case OPERATION_TYPES.SELECT:
            return op.columns.length > 0
                ? `Select columns: ${op.columns.join(', ')}`
                : 'Select all columns';
        case OPERATION_TYPES.FILTER:
            return op.semantic
                ? `Apply semantic filter: ${op.filter.type} (${op.filter.term})`
                : 'Apply filters';
        case OPERATION_TYPES.GROUP:
            return op.timeInterval
                ? `Group by time interval: ${op.timeInterval}`
                : `Group by: ${op.columns.join(', ')}`;
        case OPERATION_TYPES.AGGREGATE:
            return `Calculate: ${op.functions.join(', ')}`;
        case OPERATION_TYPES.WINDOW:
            return `Apply window function: ${op.function}`;
        case OPERATION_TYPES.ORDER:
            return `Order by ${op.direction}`;
        case OPERATION_TYPES.LIMIT:
            return `Limit to ${op.value} results`;
        case OPERATION_TYPES.STATISTICAL:
            return `Filter ${op.direction} ${op.value}%`;
        default:
            return `Execute: ${op.type}`;
    }
}

/**
 * Merge context from follow-up questions
 */
function mergeConversationContext(currentIntent, previousIntent) {
    if (!previousIntent) return currentIntent;

    const merged = { ...currentIntent };

    // Inherit table/columns if not specified
    if (merged.columns.length === 0 && previousIntent.columns.length > 0) {
        merged.columns = previousIntent.columns;
        merged.inheritedContext = true;
    }

    // Inherit grouping if asking about same topic
    if (merged.groupBy.length === 0 && previousIntent.groupBy.length > 0) {
        merged.groupBy = previousIntent.groupBy;
    }

    return merged;
}

/**
 * Generate clarifying questions when intent is ambiguous
 */
function generateClarifyingQuestions(intent, schema) {
    const questions = [];
    const columns = extractColumnsFromSchema(schema);

    if (intent.columns.length === 0) {
        questions.push({
            type: 'column_selection',
            question: 'Which column(s) would you like to analyze?',
            options: columns.slice(0, 10)
        });
    }

    if (intent.aggregations.length > 0 && intent.groupBy.length === 0) {
        const categoricalColumns = columns.filter(c =>
            !c.toLowerCase().includes('id') &&
            !c.toLowerCase().includes('date')
        );
        if (categoricalColumns.length > 0) {
            questions.push({
                type: 'grouping',
                question: 'Would you like to group the results by any category?',
                options: ['No grouping', ...categoricalColumns.slice(0, 5)]
            });
        }
    }

    if (intent.aggregations.length === 0 && intent.columns.length > 0) {
        questions.push({
            type: 'aggregation',
            question: 'What calculation would you like to perform?',
            options: ['Show all values', 'Count', 'Average', 'Sum', 'Min/Max']
        });
    }

    return questions;
}

/**
 * Suggest related queries based on current intent
 */
function suggestRelatedQueries(intent, schema) {
    const suggestions = [];
    const columns = extractColumnsFromSchema(schema);

    // Suggest aggregation variants
    if (intent.aggregations.length > 0) {
        const currentFunc = intent.aggregations[0].function;
        if (currentFunc === 'AVG') {
            suggestions.push('What is the median value?');
            suggestions.push('Show the distribution of values');
        }
        if (currentFunc === 'COUNT') {
            suggestions.push('What percentage does each group represent?');
        }
    }

    // Suggest grouping variants
    if (intent.groupBy.length > 0) {
        suggestions.push(`Show this as a trend over time`);
        suggestions.push(`What are the top 5 ${intent.groupBy[0]} by count?`);
    }

    // Suggest statistical analysis
    if (intent.columns.length > 0) {
        const numericCols = columns.filter(c =>
            c.toLowerCase().includes('rating') ||
            c.toLowerCase().includes('score') ||
            c.toLowerCase().includes('amount') ||
            c.toLowerCase().includes('price')
        );
        if (numericCols.length > 0) {
            suggestions.push(`Are there any outliers in ${numericCols[0]}?`);
            suggestions.push(`Show the correlation between columns`);
        }
    }

    return suggestions.slice(0, 3);
}

module.exports = {
    parseQueryIntent,
    extractColumnsFromSchema,
    buildOperationsList,
    createExecutionPlan,
    describeOperation,
    mergeConversationContext,
    generateClarifyingQuestions,
    suggestRelatedQueries,
    OPERATION_TYPES,
    AGGREGATION_KEYWORDS,
    WINDOW_KEYWORDS,
    TIME_PATTERNS
};
