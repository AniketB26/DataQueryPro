/**
 * Enhanced Groq Query Translator Module
 * 
 * Advanced AI-powered query translator with data analyst capabilities.
 * Uses Groq API (OpenAI-compatible) to translate natural language
 * questions into executable database queries with support for:
 * - Complex analytics (window functions, percentiles, correlations)
 * - Semantic column matching
 * - Multi-step query reasoning
 * - Follow-up question context
 * - StrataScratch-level SQL problems
 */

const OpenAI = require('openai');
const config = require('../config');
const { generateFieldMappingHints } = require('../utils/fieldMapper');
const { analyticsEngine, SemanticMapper, QueryPlanner } = require('../analytics');

// Initialize Groq client (OpenAI-compatible)
const groq = new OpenAI({
    apiKey: config.groq.apiKey,
    baseURL: config.groq.baseUrl
});

/**
 * Extract JSON from response that might be wrapped in markdown code blocks or have extra text
 * @param {string} content - Raw response content
 * @returns {object} - Parsed JSON object
 */
function extractJSON(content) {
    let cleaned = content.trim();

    // 1. Remove markdown code blocks if present (```json ... ``` or ``` ... ```)
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }

    // 2. Find the first { and extract balanced JSON using brace counting
    // Skip braces inside quoted strings
    const startIdx = cleaned.indexOf('{');
    if (startIdx !== -1) {
        let braceCount = 0;
        let endIdx = startIdx;
        let inString = false;
        let prevChar = '';

        for (let i = startIdx; i < cleaned.length; i++) {
            const char = cleaned[i];

            // Track if we're inside a JSON string (handling escaped quotes)
            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
            }

            // Only count braces outside of strings
            if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;

                if (braceCount === 0) {
                    endIdx = i;
                    break;
                }
            }

            prevChar = char;
        }

        cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    // 3. Try to parse as JSON
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Try to fix common issues like trailing commas
        try {
            const fixed = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            return JSON.parse(fixed);
        } catch (e2) {
            console.error('Failed to parse JSON:', cleaned.substring(0, 200));
            throw new Error(`Invalid JSON response from AI: ${cleaned.substring(0, 50)}...`);
        }
    }
}

/**
 * Enhanced system prompts for different database types
 * These prompts enable analyst-level query generation
 */
const SYSTEM_PROMPTS = {
    sql: `CRITICAL: You MUST return ONLY a valid JSON object. Do NOT include any text, explanations, or markdown. Start with { and end with }.

You are an EXPERT DATA ANALYST and SQL query generator capable of solving StrataScratch-hard level problems.

=== SEMANTIC COLUMN MATCHING ===
Use fuzzy matching for column names. User may say:
- "name" → match: fullName, full_name, username, firstName, lastName
- "rating/score" → match: rating, score, stars, rate, value
- "user/reviewer" → match: user, customer, reviewer, author, member
- "date/time" → match: date, created_at, timestamp, datetime
- "harsh/negative" → means LOW rating (<=2)
- "positive/good" → means HIGH rating (>=4)

=== ADVANCED SQL CAPABILITIES ===
Support these operations in your queries:
1. Window Functions:
   - ROW_NUMBER() OVER (ORDER BY col)
   - RANK() OVER (PARTITION BY x ORDER BY y)
   - DENSE_RANK() OVER (ORDER BY col DESC)
   - LAG(col, 1) OVER (ORDER BY date)
   - LEAD(col, 1) OVER (ORDER BY date)
   - SUM(col) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)

2. Aggregations:
   - COUNT, SUM, AVG, MIN, MAX
   - COUNT(DISTINCT col)
   - GROUP BY with HAVING

3. Percentiles:
   - PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY col)
   - Top 5% → WHERE col >= (SELECT PERCENTILE_CONT(0.95)...)

4. Time Analysis:
   - DATE_TRUNC('month', date)
   - EXTRACT(YEAR FROM date)
   - Monthly/yearly grouping

=== QUERY PATTERNS ===
"Which user gave the harshest review?" →
SELECT * FROM reviews ORDER BY rating ASC LIMIT 1

"Show top 5% of ratings" →
SELECT * FROM reviews WHERE rating >= (SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rating) FROM reviews)

"Average rating per month" →
SELECT DATE_TRUNC('month', date) as month, AVG(rating) FROM reviews GROUP BY 1 ORDER BY 1

"Rank users by score descending" →
SELECT *, RANK() OVER (ORDER BY score DESC) as rank FROM users

=== OUTPUT FORMAT ===
{"query":"SQL_QUERY_HERE","explanation":"Brief description","confidence":0.9}

NEVER include text outside JSON. Start with { and end with }.`,

    mongodb: `CRITICAL: You MUST return ONLY a valid JSON object. Do NOT include any text, explanations, or markdown. Start with { and end with }.

You are an EXPERT DATA ANALYST and MongoDB query generator.

=== SEMANTIC COLUMN MATCHING ===
- "name" → fullName, firstName, lastName, username
- "id" → _id
- "rating/score" → rating, score, stars
- "harsh/negative" → filter by rating <= 2
- "positive/good" → filter by rating >= 4

=== MONGODB AGGREGATION PIPELINE ===
For complex analytics, use aggregation pipeline:

1. Grouping with aggregation:
   {"$group": {"_id": "$category", "avgRating": {"$avg": "$rating"}, "count": {"$sum": 1}}}

2. Window-like operations:
   {"$setWindowFields": {"sortBy": {"date": 1}, "output": {"rank": {"$rank": {}}}}}

3. Percentile calculation:
   {"$group": {"_id": null, "p95": {"$percentile": {"input": "$rating", "p": [0.95], "method": "approximate"}}}}

4. Time grouping:
   {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$createdAt"}}, "count": {"$sum": 1}}}

=== OPERATIONS ===
- find: Simple queries with filter and projection
- aggregate: Complex analytics with pipeline stages

=== OUTPUT FORMAT ===
For aggregation:
{"query":{"collection":"reviews","operation":"aggregate","pipeline":[{"$match":{}},{"$group":{}}]},"explanation":"desc","confidence":0.9}

For simple find:
{"query":{"collection":"users","operation":"find","filter":{},"projection":{},"sort":{},"limit":100},"explanation":"desc","confidence":0.9}

NEVER include text outside JSON.`,

    file: `CRITICAL: You MUST return ONLY a valid JSON object. Do NOT include any text before or after the JSON.

You are an EXPERT DATA ANALYST for Excel/CSV files with advanced statistical capabilities.

=== CRITICAL COMPUTATION RULES ===
1. NEVER guess, estimate, or calculate values from the sample data shown in the schema
2. Sample values (e.g., "3.5, 4.2") are for TYPE INFERENCE ONLY - not for answering questions
3. ALL statistics (avg, sum, count, stdev, etc.) MUST be computed via query operations
4. When asked "what is the average?", generate a query that COMPUTES it from ALL rows
5. The query execution engine will compute the actual values from the FULL dataset

=== SEMANTIC COLUMN MATCHING ===
Match user terms to actual columns using fuzzy matching:
- "rating" → rating, score, stars, rate, value, Rating, RATING
- "user" → user, username, author, reviewer, customer
- "date" → date, time, timestamp, created_at, Date
- "harsh/harshest" → means lowest rating (sort ASC, limit 1)
- "best/highest" → means highest rating (sort DESC, limit 1)
- "negative" → rating <= 2
- "positive" → rating >= 4

=== ADVANCED ANALYTICS OPERATIONS ===
Your queries can now include these advanced operations:

1. Window Functions ("windowFunction" field):
   - "RANK" - Rank with gaps
   - "DENSE_RANK" - Rank without gaps
   - "ROW_NUMBER" - Sequential numbering
   - "PERCENT_RANK" - Percentile ranking
   - "RUNNING_TOTAL" - Cumulative sum
   - "RUNNING_AVG" - Cumulative average
   - "ROLLING_AVG" - Moving average (specify window)
   - "LAG" - Previous row value
   - "LEAD" - Next row value

2. Statistical Operations ("statistics" field):
   - "DESCRIBE" - Full statistical summary
   - "MEDIAN" - Median value
   - "MODE" - Most common value
   - "STDEV" - Standard deviation
   - "PERCENTILE" - Specific percentile (with "percentileValue")
   - "CORRELATION" - Correlation between columns
   - "OUTLIERS" - Detect outliers

3. Time-based Analysis ("timeGrouping" field):
   - "month" - Group by month
   - "year" - Group by year
   - "week" - Group by week
   - "day" - Group by day
   - "quarter" - Group by quarter

4. Aggregations in "aggregates" array:
   {"function": "AVG|SUM|COUNT|MIN|MAX|MEDIAN|STDEV|VARIANCE", "column": "col", "alias": "name"}

5. Percentile Filtering ("percentileFilter" field):
   {"type": "top|bottom", "value": 5} for top/bottom 5%

6. COMPUTED METRICS - COMPUTE FROM RAW DATA ("computedMetrics" field):
   USE THIS when user asks for statistical metrics with grouping.
   The system will compute the statistic DIRECTLY from raw data values.
   
   Format:
   "computedMetrics": {
       "type": "stdev|variance|avg|median|percentile|correlation|all",
       "column": "Rating",
       "groupBy": "Country",  // Optional: categorical grouping
       "timeGrouping": {"column": "Date", "interval": "month"},  // Optional: time grouping
       "column2": "thumbs_up",  // Required for correlation
       "percentileValue": 95  // Optional for percentile
   }
   
   EXAMPLES:
   - "Monthly standard deviation of ratings" → use computedMetrics with type:"stdev" and timeGrouping
   - "Variance of ratings by country" → use computedMetrics with type:"variance" and groupBy
   - "Correlation between rating and thumbs_up" → use computedMetrics with type:"correlation"

=== QUERY FORMAT ===
{
    "query": {
        "table": "SheetName",
        "select": ["col1", "col2"] or "*",
        "filter": [{"column": "Rating", "operator": "<=", "value": 2}],
        "groupBy": ["Country"],
        "aggregates": [{"function": "AVG", "column": "Rating", "alias": "avg_rating"}],
        "windowFunction": {"type": "RANK", "orderBy": "Rating", "direction": "DESC"},
        "statistics": {"type": "DESCRIBE", "column": "Rating"},
        "timeGrouping": {"column": "Date", "interval": "month"},
        "computedMetrics": {"type": "stdev", "column": "Rating", "timeGrouping": {"column": "Date", "interval": "month"}},
        "percentileFilter": {"type": "top", "value": 5},
        "orderBy": {"column": "Rating", "direction": "ASC"},
        "limit": 100
    },
    "explanation": "Description of what this query does",
    "confidence": 0.9,
    "insights": ["Optional insight 1", "Optional insight 2"]
}

=== EXAMPLE QUERIES ===

"Which user gave the harshest review?" →
{"query":{"table":"Reviews","select":"*","orderBy":{"column":"Rating","direction":"ASC"},"limit":1},"explanation":"Find the review with lowest rating","confidence":0.95}

"Show me top 5% of ratings" →
{"query":{"table":"Reviews","select":"*","percentileFilter":{"type":"top","value":5}},"explanation":"Filter to top 5% highest ratings","confidence":0.9}

"Average rating per month" →
{"query":{"table":"Reviews","select":"*","timeGrouping":{"column":"Date","interval":"month"},"aggregates":[{"function":"AVG","column":"Rating","alias":"avg_rating"}]},"explanation":"Monthly average rating trend","confidence":0.9}

"Monthly standard deviation of ratings" →
{"query":{"table":"Reviews","computedMetrics":{"type":"stdev","column":"Rating","timeGrouping":{"column":"Date","interval":"month"}}},"explanation":"Compute standard deviation of ratings grouped by month from raw data","confidence":0.95}

"Variance of ratings by country" →
{"query":{"table":"Reviews","computedMetrics":{"type":"variance","column":"Rating","groupBy":"Country"}},"explanation":"Compute variance of ratings for each country from raw data","confidence":0.95}

"Show correlation between rating and thumbs_up" →
{"query":{"table":"Reviews","computedMetrics":{"type":"correlation","column":"Rating","column2":"thumbs_up"}},"explanation":"Calculate Pearson correlation coefficient between Rating and thumbs_up","confidence":0.95}

"Rank all users by thumbs_up descending" →
{"query":{"table":"Reviews","select":"*","windowFunction":{"type":"RANK","orderBy":"thumbs_up","direction":"DESC"}},"explanation":"Rank users by engagement","confidence":0.9}

"Which country has the most negative reviews?" →
{"query":{"table":"Reviews","select":"*","filter":[{"column":"Rating","operator":"<=","value":2}],"groupBy":["Country"],"aggregates":[{"function":"COUNT","column":"*","alias":"negative_count"}],"orderBy":{"column":"negative_count","direction":"DESC"},"limit":1},"explanation":"Country with most low ratings","confidence":0.9}

NEVER include text outside the JSON. Start with { and end with }.`
};

/**
 * Generate a database query from natural language with advanced analytics support
 * @param {string} question - Natural language question
 * @param {string} schema - Database schema formatted for AI
 * @param {string} dbType - Database type (sql, mongodb, file)
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Object} - Generated query and metadata
 */
async function generateQuery(question, schema, dbType, conversationHistory = []) {
    const systemPrompt = getSystemPrompt(dbType);

    // Get enhanced analytics hints
    let analyticsHints = '';
    try {
        const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
        analyticsHints = SemanticMapper.generateSemanticHints(question, schemaObj);

        // Parse intent for additional context
        const intent = QueryPlanner.parseQueryIntent(question, schemaObj);
        if (intent.operations.length > 0) {
            analyticsHints += '\n\nDETECTED INTENT:\n';
            analyticsHints += intent.operations.map(op => `- ${op.type}`).join('\n');
        }
        if (intent.semanticFilter) {
            analyticsHints += `\n- Sentiment: ${intent.semanticFilter.type} (${intent.semanticFilter.term})`;
        }
    } catch (e) {
        // Continue without analytics hints if parsing fails
    }

    // Build messages array
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATABASE SCHEMA:\n${schema}` }
    ];

    // Add analytics hints if available
    if (analyticsHints) {
        messages.push({ role: 'user', content: analyticsHints });
    }

    // Add conversation history for context (for follow-up questions)
    for (const msg of conversationHistory.slice(-6)) { // Last 6 messages for context
        messages.push({
            role: msg.role,
            content: msg.content
        });
    }

    // Add the current question
    messages.push({
        role: 'user',
        content: `QUESTION: ${question}\n\nGenerate the appropriate query to answer this question. Consider using advanced analytics features if needed.`
    });

    try {
        const response = await groq.chat.completions.create({
            model: config.groq.model,
            messages,
            temperature: config.groq.temperature,
            max_tokens: config.groq.maxTokens
        });

        const content = response.choices[0].message.content;
        const result = extractJSON(content);

        return {
            success: true,
            query: result.query,
            explanation: result.explanation,
            confidence: result.confidence || 0.8,
            insights: result.insights || [],
            rawResponse: content
        };
    } catch (error) {
        console.error('Groq query generation error:', error);
        return {
            success: false,
            error: error.message,
            query: null
        };
    }
}

/**
 * Attempt to fix a failed query using error feedback
 * @param {string} originalQuestion - Original natural language question
 * @param {string} failedQuery - The query that failed
 * @param {string} errorMessage - Error message from execution
 * @param {string} schema - Database schema
 * @param {string} dbType - Database type
 * @returns {Object} - Corrected query
 */
async function fixQuery(originalQuestion, failedQuery, errorMessage, schema, dbType) {
    const systemPrompt = getSystemPrompt(dbType);

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATABASE SCHEMA:\n${schema}` },
        { role: 'user', content: `ORIGINAL QUESTION: ${originalQuestion}` },
        { role: 'assistant', content: JSON.stringify({ query: failedQuery }) },
        {
            role: 'user',
            content: `The query failed with this error: ${errorMessage}

Please analyze the error and generate a corrected query. Common issues to check:
1. Table or column names might be misspelled (use fuzzy matching)
2. Data types might not match
3. Syntax might be incorrect for this database type
4. Window function or aggregation syntax might be wrong
5. For file queries, ensure JSON format is correct

Generate a corrected query that will work.`
        }
    ];

    try {
        const response = await groq.chat.completions.create({
            model: config.groq.model,
            messages,
            temperature: 0.2, // Lower temperature for corrections
            max_tokens: config.groq.maxTokens
        });

        const content = response.choices[0].message.content;
        const result = extractJSON(content);

        return {
            success: true,
            query: result.query,
            explanation: result.explanation,
            wasFixed: true,
            originalError: errorMessage
        };
    } catch (error) {
        return {
            success: false,
            error: `Could not fix query: ${error.message}`,
            query: null
        };
    }
}

/**
 * Generate a natural language response from query results with insights
 * @param {string} question - Original question
 * @param {Object} queryResult - Query execution result
 * @param {string} query - The executed query
 * @returns {string} - Natural language response with insights
 */
async function generateResponse(question, queryResult, query) {
    const messages = [
        {
            role: 'system',
            content: `You are an expert DATA ANALYST assistant reporting EXECUTED QUERY RESULTS.

CRITICAL RULES - FOLLOW STRICTLY:
1. ONLY report values that appear in the RESULTS section below
2. NEVER estimate, guess, or infer values from schema samples or previews
3. NEVER say "based on the sample data" or "from the preview"
4. If the result is empty, say "No matching records found"
5. For aggregations (AVG, SUM, COUNT, STDEV, etc.), the query has ALREADY computed the value - just report it
6. If a calculation was requested but not in results, say "The requested calculation was not returned"

PRESENTATION FORMAT:
1. Direct answer using ONLY values from the RESULTS
2. Key insight(s) from the actual data
3. Optional: Suggested follow-up question

WHAT YOU MUST NEVER DO:
- Use sample values from the schema to answer questions
- Estimate averages, counts, or statistics from preview rows
- Say "based on the first few rows" or similar
- Make up numbers that aren't in the results`
        },
        {
            role: 'user',
            content: `QUESTION: ${question}

QUERY EXECUTED: ${typeof query === 'string' ? query : JSON.stringify(query, null, 2)}

COMPUTED RESULTS (${queryResult.rowCount} rows):
${JSON.stringify(queryResult.data?.slice(0, 15), null, 2)}
${queryResult.rowCount > 15 ? `\n... and ${queryResult.rowCount - 15} more rows` : ''}

${queryResult.insights ? `SYSTEM INSIGHTS: ${queryResult.insights.join('; ')}` : ''}

Report ONLY values from these COMPUTED RESULTS. Do not estimate or infer from any other source.`
        }
    ];

    try {
        const response = await groq.chat.completions.create({
            model: config.groq.model,
            messages,
            temperature: 0.5,
            max_tokens: 800
        });

        return response.choices[0].message.content;
    } catch (error) {
        // Fallback to basic response with insights
        if (queryResult.success && queryResult.data) {
            let response = `Found ${queryResult.rowCount} results for your query.`;
            if (queryResult.insights && queryResult.insights.length > 0) {
                response += `\n\nInsights:\n${queryResult.insights.map(i => `• ${i}`).join('\n')}`;
            }
            return response;
        }
        return `There was an issue processing your question: ${error.message}`;
    }
}

/**
 * Generate query suggestions based on schema (deterministic, no AI)
 * Now includes advanced analytics suggestions
 * @param {string|object} schema - Database schema
 * @param {string} dbType - Database type
 * @returns {Array} - List of suggested queries
 */
function generateQuerySuggestions(schema, dbType) {
    try {
        // Parse schema if string
        const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;

        // Get tables/collections
        const tables = schemaObj.tables || schemaObj.collections || [];
        if (tables.length === 0) {
            return [
                { question: "Show all records", description: "Display all available data" },
                { question: "Count total records", description: "Get the total count of entries" }
            ];
        }

        // Prioritize common tables
        const priorityNames = ['users', 'user', 'customers', 'customer', 'orders', 'order', 'products', 'product', 'reviews', 'review', 'ratings', 'items', 'item'];
        const sortedTables = [...tables].sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aIdx = priorityNames.findIndex(p => aName.includes(p));
            const bIdx = priorityNames.findIndex(p => bName.includes(p));
            if (aIdx !== -1 && bIdx === -1) return -1;
            if (aIdx === -1 && bIdx !== -1) return 1;
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            return aName.localeCompare(bName);
        });

        // Select top 2 tables for suggestions
        const selectedTables = sortedTables.slice(0, 2);
        const suggestions = [];

        for (const table of selectedTables) {
            const tableName = table.name;
            const fields = table.columns || table.fields || [];
            const fieldNames = fields.map(f => f.name || f);

            // 1. Basic show all
            suggestions.push({
                question: `Show all ${tableName}`,
                description: `Display all records from ${tableName}`
            });

            // 2. Find numeric columns for analytics suggestions
            const numericFields = fields.filter(f =>
                ['number', 'integer', 'float', 'decimal'].includes(f.type?.toLowerCase()) ||
                ['rating', 'score', 'amount', 'price', 'count', 'total'].some(n =>
                    (f.name || f).toLowerCase().includes(n)
                )
            );

            if (numericFields.length > 0) {
                const numField = numericFields[0].name || numericFields[0];

                // Analytics suggestion
                suggestions.push({
                    question: `What is the average ${numField}?`,
                    description: `Calculate average ${numField} from ${tableName}`
                });

                // Ranking suggestion
                suggestions.push({
                    question: `Show top 10 by ${numField}`,
                    description: `Rank records by highest ${numField}`
                });

                // Distribution suggestion
                suggestions.push({
                    question: `Show ${numField} distribution`,
                    description: `Analyze the spread of ${numField} values`
                });
            }

            // 3. Find categorical columns for grouping
            const categoricalFields = fieldNames.filter(f =>
                ['category', 'type', 'status', 'country', 'region', 'group'].some(c =>
                    f.toLowerCase().includes(c)
                )
            );

            if (categoricalFields.length > 0 && numericFields.length > 0) {
                suggestions.push({
                    question: `Average ${numericFields[0].name || numericFields[0]} by ${categoricalFields[0]}`,
                    description: `Breakdown analysis by category`
                });
            }

            // 4. Date-based analysis if date column exists
            const dateFields = fieldNames.filter(f =>
                ['date', 'created', 'timestamp', 'time'].some(d => f.toLowerCase().includes(d))
            );

            if (dateFields.length > 0) {
                suggestions.push({
                    question: `Show trend over time`,
                    description: `Analyze how data changes over time`
                });
            }

            // 5. Extreme value analysis
            if (numericFields.length > 0) {
                suggestions.push({
                    question: `Find the lowest ${numericFields[0].name || numericFields[0]}`,
                    description: `Identify minimum values`
                });
            }
        }

        // Return max 6 suggestions
        return suggestions.slice(0, 6);

    } catch (error) {
        console.error('Error generating suggestions:', error);
        return [
            { question: "Show all records", description: "Display all available data" },
            { question: "Count total records", description: "Get the total count of entries" },
            { question: "What is the average value?", description: "Calculate average of numeric columns" }
        ];
    }
}

/**
 * Stream a response for real-time chat experience
 * @param {string} question - User question
 * @param {string} schema - Database schema
 * @param {string} dbType - Database type
 * @param {Function} onChunk - Callback for each chunk
 */
async function* streamQueryGeneration(question, schema, dbType) {
    const systemPrompt = getSystemPrompt(dbType);

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATABASE SCHEMA:\n${schema}` },
        { role: 'user', content: `QUESTION: ${question}\n\nGenerate the appropriate query.` }
    ];

    const stream = await groq.chat.completions.create({
        model: config.groq.model,
        messages,
        temperature: config.groq.temperature,
        max_tokens: config.groq.maxTokens,
        stream: true
    });

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            yield content;
        }
    }
}

/**
 * Get the appropriate system prompt for a database type
 */
function getSystemPrompt(dbType) {
    const type = dbType.toLowerCase();

    if (['mysql', 'postgresql', 'postgres', 'sqlite', 'sql'].includes(type)) {
        return SYSTEM_PROMPTS.sql;
    }
    if (['mongodb', 'mongo'].includes(type)) {
        return SYSTEM_PROMPTS.mongodb;
    }
    if (['excel', 'csv', 'file', 'xlsx'].includes(type)) {
        return SYSTEM_PROMPTS.file;
    }

    return SYSTEM_PROMPTS.sql; // Default to SQL
}

/**
 * Generate a clarification request when query intent is unclear
 * @param {string} question - User's question
 * @param {Object} schema - Database schema
 * @returns {Object} - Clarification data
 */
function generateClarification(question, schema) {
    try {
        const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
        const intent = QueryPlanner.parseQueryIntent(question, schemaObj);

        if (intent.clarificationNeeded) {
            const questions = QueryPlanner.generateClarifyingQuestions(intent, schemaObj);
            const suggestions = QueryPlanner.suggestRelatedQueries(intent, schemaObj);

            return {
                needed: true,
                message: intent.suggestedClarification,
                questions,
                suggestedQueries: suggestions
            };
        }

        return { needed: false };
    } catch (error) {
        return { needed: false, error: error.message };
    }
}

module.exports = {
    generateQuery,
    fixQuery,
    generateResponse,
    generateQuerySuggestions,
    streamQueryGeneration,
    generateClarification,
    extractJSON,
    getSystemPrompt
};
