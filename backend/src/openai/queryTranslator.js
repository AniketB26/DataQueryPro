/**
 * Groq Query Translator Module
 * 
 * Uses Groq API (OpenAI-compatible) to translate natural language
 * questions into executable database queries. Supports SQL, MongoDB, and
 * file-based (Pandas-like) operations.
 */

const OpenAI = require('openai');
const config = require('../config');
const { generateFieldMappingHints } = require('../utils/fieldMapper');

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
 * System prompts for different database types
 */
const SYSTEM_PROMPTS = {
    sql: `CRITICAL: You MUST return ONLY a valid JSON object. Do NOT include any text, explanations, or markdown. Start with { and end with }.

You are an expert SQL query generator.

FIELD MAPPING:
- "name" → "fullName", "full_name", "firstName", "lastName", "username"
- "id" → "id", "_id", "userId"
- "email" → "email"
- "active" → filter by "isActive = true" or "is_active = 1"

RETURN THIS JSON FORMAT:
{"query":"SELECT fullName, _id FROM users WHERE isActive = true LIMIT 100","explanation":"description","confidence":0.9}

NEVER include any text before or after the JSON. ONLY output the JSON object.`,

    mongodb: `CRITICAL: You MUST return ONLY a valid JSON object. Do NOT include any text, explanations, or markdown. Start your response with { and end with }.

You are an expert MongoDB query generator.

FIELD MAPPING (use these to map user terms to schema fields):
- "name" → "fullName", "firstName", "lastName", "username"
- "id" → "_id"
- "email" → "email"
- "active" / "active users" → filter by {"isActive": true}
- "password" → "password"

OPERATIONS:
- READ: find, aggregate, count, distinct
- WRITE: insertOne, updateOne, updateMany, deleteOne, deleteMany

FOR READ QUERIES - return this JSON:
{"query":{"collection":"users","operation":"find","filter":{},"projection":{"fullName":1,"_id":1},"limit":100},"explanation":"description","confidence":0.9}

FOR INSERT - return this JSON:
{"query":{"collection":"users","operation":"insertOne","document":{"fullName":"value","email":"value","password":"value","username":"value","isActive":true}},"explanation":"description","confidence":0.9}

FOR UPDATE - return this JSON:
{"query":{"collection":"users","operation":"updateOne","filter":{"username":"value"},"update":{"$set":{"email":"newvalue"}}},"explanation":"description","confidence":0.9}

FOR DELETE - return this JSON:
{"query":{"collection":"users","operation":"deleteOne","filter":{"username":"value"}},"explanation":"description","confidence":0.9}

NEVER include any text before or after the JSON. ONLY output the JSON object.`,

    file: `CRITICAL: You MUST return ONLY a valid JSON object. Do NOT include any text before or after the JSON.

You are an expert data analyst for Excel/CSV files.

IMPORTANT RULES:
1. COLUMN NAMES ARE CASE-INSENSITIVE - match user input to schema columns regardless of case
   Example: "leetcode" matches "Leetcode", "LEETCODE", "LeetCode"
2. TABLE/SHEET NAMES ARE CASE-INSENSITIVE - match user input regardless of case
   Example: "linked list" matches "Linked List"
3. For NULL checks, use "IS NULL" or "IS NOT NULL" operators
4. When user says "all data" without specifying a table, use the first table in schema
5. Use column names EXACTLY as they appear in the schema (preserve original case)

NULL VALUE HANDLING:
- "where X is null" → {"column": "X", "operator": "IS NULL", "value": null}
- "where X is not null" → {"column": "X", "operator": "IS NOT NULL", "value": null}
- "where X is empty" → {"column": "X", "operator": "IS NULL", "value": null}

OUTPUT FORMAT - Return ONLY this JSON:
{
    "query": {
        "table": "exact_sheet_name_from_schema",
        "select": ["column1", "column2"] or "*",
        "filter": [{"column": "exact_column_name", "operator": "=|!=|>|<|>=|<=|LIKE|IN|IS NULL|IS NOT NULL", "value": "val"}],
        "orderBy": {"column": "col", "direction": "ASC|DESC"},
        "limit": 100
    },
    "explanation": "Brief description",
    "confidence": 0.9
}

EXAMPLES:
- "show all linked list" → {"query":{"table":"Linked List","select":"*","limit":100},"explanation":"Get all data from Linked List","confidence":0.95}
- "where leetcode is null" → {"query":{"table":"TableName","select":"*","filter":[{"column":"Leetcode","operator":"IS NULL","value":null}],"limit":100},"explanation":"Filter where Leetcode is null","confidence":0.9}

NEVER include text outside the JSON. Start with { and end with }.`
};

/**
 * Generate a database query from natural language
 * @param {string} question - Natural language question
 * @param {string} schema - Database schema formatted for AI
 * @param {string} dbType - Database type (sql, mongodb, file)
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Object} - Generated query and metadata
 */
async function generateQuery(question, schema, dbType, conversationHistory = []) {
    const systemPrompt = getSystemPrompt(dbType);

    // Build messages array
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATABASE SCHEMA: \n${schema} ` }
    ];

    // Add conversation history for context
    for (const msg of conversationHistory.slice(-6)) { // Last 6 messages for context
        messages.push({
            role: msg.role,
            content: msg.content
        });
    }

    // Add the current question
    messages.push({
        role: 'user',
        content: `QUESTION: ${question} \n\nGenerate the appropriate query to answer this question.`
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
        { role: 'user', content: `DATABASE SCHEMA: \n${schema} ` },
        { role: 'user', content: `ORIGINAL QUESTION: ${originalQuestion} ` },
        { role: 'assistant', content: JSON.stringify({ query: failedQuery }) },
        {
            role: 'user',
            content: `The query failed with this error: ${errorMessage}

Please analyze the error and generate a corrected query.Common issues to check:
1. Table or column names might be misspelled
2. Data types might not match
3. Syntax might be incorrect for this database type
4. JOIN conditions might be wrong

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
            error: `Could not fix query: ${error.message} `,
            query: null
        };
    }
}

/**
 * Generate a natural language response from query results
 * @param {string} question - Original question
 * @param {Object} queryResult - Query execution result
 * @param {string} query - The executed query
 * @returns {string} - Natural language response
 */
async function generateResponse(question, queryResult, query) {
    const messages = [
        {
            role: 'system',
            content: `You are a database query assistant.Your ONLY purpose is to present database query results.

STRICT RULES:
1. ONLY respond to questions about the connected database and its data
2. If asked anything NOT related to the database(like general knowledge, coding help, conversation, etc.), respond ONLY with: "I can only help with questions about the connected database."
3. Present data EXACTLY as returned by the query - do not add extra formatting or analysis
4. Keep responses short and data - focused
5. If the result is empty, say "No matching records found."
6. If there's an error, briefly explain what went wrong

OUTPUT FORMAT:
- For single values: Just state the value
    - For tables: Present as a simple summary of the data
        - Never add insights, patterns, or analysis unless explicitly asked`
        },
        {
            role: 'user',
            content: `QUESTION: ${question}

QUERY EXECUTED: ${typeof query === 'string' ? query : JSON.stringify(query, null, 2)}

RESULTS(${queryResult.rowCount} rows):
${JSON.stringify(queryResult.data?.slice(0, 10), null, 2)}
${queryResult.rowCount > 10 ? `\n... and ${queryResult.rowCount - 10} more rows` : ''}

Please provide a natural language response to the user's question based on these results.`
        }
    ];

    try {
        const response = await groq.chat.completions.create({
            model: config.groq.model,
            messages,
            temperature: 0.5,
            max_tokens: 500
        });

        return response.choices[0].message.content;
    } catch (error) {
        // Fallback to basic response
        if (queryResult.success && queryResult.data) {
            return `Found ${queryResult.rowCount} results for your query.`;
        }
        return `There was an issue processing your question: ${error.message}`;
    }
}

/**
 * Generate query suggestions based on schema (deterministic, no AI)
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
        const priorityNames = ['users', 'user', 'customers', 'customer', 'orders', 'order', 'products', 'product', 'items', 'item'];
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
            const fieldNames = fields.map(f => f.name);

            // 1. Basic show all
            suggestions.push({
                question: `Show all ${tableName}`,
                description: `Display all records from ${tableName}`
            });

            // 2. Count total
            suggestions.push({
                question: `Count total ${tableName}`,
                description: `Get the total number of ${tableName} entries`
            });

            // 3. List specific fields (pick 2 important ones)
            const importantFields = fieldNames.filter(f =>
                ['name', 'fullname', 'email', 'title', 'username', 'status', 'amount', 'price'].some(
                    key => f.toLowerCase().includes(key)
                )
            );
            if (importantFields.length >= 2) {
                suggestions.push({
                    question: `List ${importantFields[0]} and ${importantFields[1]} from ${tableName}`,
                    description: `Show only selected fields from ${tableName}`
                });
            } else if (fieldNames.length >= 2) {
                const f1 = fieldNames.find(f => f !== '_id' && f !== 'id') || fieldNames[0];
                const f2 = fieldNames.find(f => f !== '_id' && f !== 'id' && f !== f1) || fieldNames[1];
                if (f1 && f2) {
                    suggestions.push({
                        question: `List ${f1} and ${f2} from ${tableName}`,
                        description: `Show only selected fields from ${tableName}`
                    });
                }
            }

            // 4. Active filter (if isActive field exists)
            if (fieldNames.some(f => f.toLowerCase() === 'isactive' || f.toLowerCase() === 'active')) {
                suggestions.push({
                    question: `Show active ${tableName}`,
                    description: `Filter ${tableName} where status is active`
                });
            }

            // 5. Recent records (if createdAt exists)
            if (fieldNames.some(f => f.toLowerCase() === 'createdat' || f.toLowerCase() === 'created_at' || f.toLowerCase() === 'date')) {
                suggestions.push({
                    question: `Show ${tableName} from last 30 days`,
                    description: `Display recently created ${tableName}`
                });
            }
        }

        // Return max 5 suggestions
        return suggestions.slice(0, 5);

    } catch (error) {
        console.error('Error generating suggestions:', error);
        return [
            { question: "Show all records", description: "Display all available data" },
            { question: "Count total records", description: "Get the total count of entries" }
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

module.exports = {
    generateQuery,
    fixQuery,
    generateResponse,
    generateQuerySuggestions,
    streamQueryGeneration
};
