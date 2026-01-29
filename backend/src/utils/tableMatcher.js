/**
 * Table Matcher Utility
 * 
 * Provides fuzzy/semantic matching for table/sheet names.
 * Handles natural language variants like "linked list" vs "Linked List".
 */

// Noise words to remove from user input
const NOISE_WORDS = [
    'sheet', 'table', 'tab', 'data', 'records', 'all', 'from', 'the',
    'of', 'in', 'show', 'get', 'give', 'me', 'display', 'list', 'print'
];

/**
 * Normalize text for comparison
 * - Lowercase
 * - Remove noise words
 * - Remove punctuation
 * - Remove extra spaces
 * - Convert camelCase to spaced words
 */
function normalizeTableName(name) {
    if (!name || typeof name !== 'string') return '';

    let normalized = name
        // Convert camelCase to spaces (LinkedList → Linked List)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Lowercase
        .toLowerCase()
        // Remove punctuation
        .replace(/[^\w\s]/g, '')
        // Split, filter noise, rejoin
        .split(/\s+/)
        .filter(word => !NOISE_WORDS.includes(word))
        .join(' ')
        // Remove extra spaces
        .trim();

    return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return dp[m][n];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const norm1 = normalizeTableName(str1);
    const norm2 = normalizeTableName(str2);

    if (norm1 === norm2) return 1.0;

    // Check if one contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
        return 0.9;
    }

    // Check word overlap
    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');
    const commonWords = words1.filter(w => words2.includes(w));
    const wordOverlap = (2 * commonWords.length) / (words1.length + words2.length);
    if (wordOverlap >= 0.5) {
        return 0.8 + (wordOverlap * 0.1);
    }

    // Levenshtein-based similarity
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 0;

    const distance = levenshteinDistance(norm1, norm2);
    const similarity = 1 - (distance / maxLen);

    return similarity;
}

/**
 * Find best matching table name from available tables
 * @param {string} userInput - User's table reference
 * @param {string[]} availableTables - List of actual table names
 * @param {number} threshold - Minimum similarity score (default 0.5)
 * @returns {Object} - { match: string|null, score: number, all: Array }
 */
function findBestTableMatch(userInput, availableTables, threshold = 0.5) {
    if (!userInput || !availableTables || availableTables.length === 0) {
        return { match: null, score: 0, all: [] };
    }

    const normalizedInput = normalizeTableName(userInput);
    const scores = [];

    for (const table of availableTables) {
        const score = calculateSimilarity(userInput, table);
        scores.push({ table, score });

        // Also check if normalized versions match exactly
        if (normalizeTableName(table) === normalizedInput) {
            return { match: table, score: 1.0, all: scores };
        }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return best match if above threshold
    if (scores.length > 0 && scores[0].score >= threshold) {
        return { match: scores[0].table, score: scores[0].score, all: scores };
    }

    return { match: null, score: 0, all: scores };
}

/**
 * Resolve table name from user input against schema
 * Handles fuzzy matching and returns the actual table name
 * @param {string} tableName - Table name from query
 * @param {Object} schema - Schema object with tables/collections
 * @returns {string|null} - Resolved table name or null
 */
function resolveTableName(tableName, schema) {
    if (!tableName || !schema) return null;

    // Get available tables from schema
    let availableTables = [];
    if (schema.tables) {
        availableTables = schema.tables.map(t => t.name);
    } else if (schema.collections) {
        availableTables = schema.collections.map(c => c.name);
    }

    // Try exact match first
    const exactMatch = availableTables.find(t =>
        t.toLowerCase() === tableName.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Try fuzzy match
    const { match } = findBestTableMatch(tableName, availableTables, 0.5);
    return match;
}

module.exports = {
    normalizeTableName,
    calculateSimilarity,
    findBestTableMatch,
    resolveTableName,
    NOISE_WORDS
};
