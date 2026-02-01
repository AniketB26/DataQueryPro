/**
 * Semantic Mapper
 * 
 * Enhanced fuzzy matching for column names with semantic understanding.
 * Supports synonyms, pluralization, tokenization, and context-aware inference.
 */

// Levenshtein distance for fuzzy string matching
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase()) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}

// Calculate similarity score (0-1, higher is better)
function similarityScore(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    return 1 - levenshteinDistance(str1, str2) / maxLen;
}

// Comprehensive synonym dictionary for analytics
const SEMANTIC_SYNONYMS = {
    // Rating/Score related
    'rating': ['rating', 'score', 'stars', 'rate', 'points', 'grade', 'rank', 'value'],
    'score': ['score', 'rating', 'points', 'grade', 'value', 'marks'],

    // Sentiment related
    'harsh': ['low', 'bad', 'negative', 'poor', 'worst', 'terrible', 'awful'],
    'positive': ['high', 'good', 'great', 'excellent', 'best', 'top'],
    'negative': ['low', 'bad', 'poor', 'worst', 'harsh', 'terrible'],

    // User/Person related
    'user': ['user', 'customer', 'client', 'person', 'member', 'account', 'reviewer', 'author'],
    'reviewer': ['reviewer', 'user', 'author', 'commenter', 'rater', 'customer'],
    'customer': ['customer', 'client', 'user', 'buyer', 'shopper', 'consumer'],
    'author': ['author', 'writer', 'creator', 'user', 'reviewer'],

    // Name related
    'name': ['name', 'fullname', 'full_name', 'username', 'title', 'label'],
    'username': ['username', 'user_name', 'login', 'handle', 'nickname'],
    'fullname': ['fullname', 'full_name', 'name', 'display_name'],

    // ID related
    'id': ['id', '_id', 'user_id', 'userid', 'identifier', 'key'],

    // Date/Time related
    'date': ['date', 'time', 'timestamp', 'created', 'created_at', 'datetime', 'day'],
    'month': ['month', 'date', 'period', 'time'],
    'year': ['year', 'date', 'period', 'annual'],
    'created': ['created', 'created_at', 'date_created', 'timestamp', 'date'],
    'updated': ['updated', 'updated_at', 'modified', 'last_modified'],

    // Review/Feedback related
    'review': ['review', 'feedback', 'comment', 'text', 'content', 'description', 'body'],
    'comment': ['comment', 'review', 'feedback', 'text', 'note', 'remarks'],
    'feedback': ['feedback', 'review', 'response', 'comment'],

    // Engagement metrics
    'thumbs_up': ['thumbs_up', 'likes', 'upvotes', 'helpful', 'positive_votes'],
    'thumbs_down': ['thumbs_down', 'dislikes', 'downvotes', 'negative_votes'],
    'likes': ['likes', 'thumbs_up', 'upvotes', 'favorites', 'hearts'],
    'views': ['views', 'impressions', 'visits', 'hits', 'seen'],

    // Location related
    'country': ['country', 'nation', 'region', 'location', 'geo', 'place'],
    'city': ['city', 'town', 'location', 'place'],
    'location': ['location', 'place', 'address', 'geo', 'region'],

    // Category/Type related
    'category': ['category', 'type', 'class', 'group', 'kind', 'tag'],
    'type': ['type', 'category', 'kind', 'class', 'genre'],
    'status': ['status', 'state', 'condition', 'active'],

    // Quantity related
    'count': ['count', 'number', 'total', 'quantity', 'amount'],
    'amount': ['amount', 'total', 'sum', 'value', 'price', 'cost'],
    'price': ['price', 'cost', 'amount', 'value', 'rate'],

    // Product related
    'product': ['product', 'item', 'goods', 'article', 'merchandise'],
    'app': ['app', 'application', 'software', 'program', 'product'],
    'version': ['version', 'ver', 'release', 'build']
};

// Analytics operation keywords
const ANALYTICS_KEYWORDS = {
    aggregation: ['average', 'avg', 'mean', 'sum', 'total', 'count', 'max', 'min', 'median', 'mode'],
    ranking: ['top', 'bottom', 'best', 'worst', 'highest', 'lowest', 'rank', 'first', 'last'],
    percentile: ['percentile', 'percent', 'top 5%', 'top 10%', 'bottom 10%', 'quartile'],
    trend: ['trend', 'over time', 'monthly', 'yearly', 'weekly', 'daily', 'growth', 'decline'],
    comparison: ['compare', 'versus', 'vs', 'than', 'more than', 'less than', 'between'],
    grouping: ['by', 'per', 'each', 'group', 'grouped', 'breakdown'],
    filtering: ['where', 'with', 'having', 'only', 'just', 'filter', 'contains', 'includes']
};

// Pluralization rules
function singularize(word) {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

function pluralize(word) {
    if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
        return word + 'es';
    }
    return word + 's';
}

// Normalize text for comparison
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[_\-\s]+/g, '')
        .replace(/[^a-z0-9]/g, '');
}

// Tokenize a query into meaningful words
function tokenize(query) {
    return query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1);
}

/**
 * Find the best matching column for a user term
 * @param {string} userTerm - The term from user query
 * @param {Array} columns - Available column names
 * @param {number} threshold - Minimum similarity score (0-1)
 * @returns {Object} - { match: string|null, score: number, type: string }
 */
function findBestColumnMatch(userTerm, columns, threshold = 0.5) {
    const normalizedTerm = normalize(userTerm);
    const singularTerm = singularize(normalizedTerm);

    let bestMatch = null;
    let bestScore = 0;
    let matchType = 'none';

    for (const column of columns) {
        const normalizedCol = normalize(column);
        const singularCol = singularize(normalizedCol);

        // 1. Exact match (highest priority)
        if (normalizedCol === normalizedTerm || singularCol === singularTerm) {
            return { match: column, score: 1.0, type: 'exact' };
        }

        // 2. Synonym match
        const synonyms = SEMANTIC_SYNONYMS[singularTerm] || [];
        for (const syn of synonyms) {
            const normalizedSyn = normalize(syn);
            if (normalizedCol === normalizedSyn || normalizedCol.includes(normalizedSyn) || normalizedSyn.includes(normalizedCol)) {
                if (0.95 > bestScore) {
                    bestScore = 0.95;
                    bestMatch = column;
                    matchType = 'synonym';
                }
            }
        }

        // 3. Contains match (column contains term or vice versa)
        if (normalizedCol.includes(normalizedTerm) || normalizedTerm.includes(normalizedCol)) {
            const score = 0.85;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = column;
                matchType = 'contains';
            }
        }

        // 4. Levenshtein similarity
        const simScore = similarityScore(normalizedTerm, normalizedCol);
        if (simScore > bestScore && simScore >= threshold) {
            bestScore = simScore;
            bestMatch = column;
            matchType = 'fuzzy';
        }
    }

    return { match: bestMatch, score: bestScore, type: matchType };
}

/**
 * Extract column references from a natural language query
 * @param {string} query - User's natural language query
 * @param {Array} columns - Available column names
 * @returns {Array} - Array of { term, column, score, type }
 */
function extractColumnReferences(query, columns) {
    const tokens = tokenize(query);
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
        'show', 'display', 'list', 'get', 'find', 'give', 'me', 'all', 'each',
        'every', 'any', 'some', 'many', 'much', 'more', 'most', 'other', 'another',
        'which', 'what', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
        'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    const references = [];
    const seen = new Set();

    for (const token of tokens) {
        if (stopWords.has(token) || token.length < 2) continue;

        const result = findBestColumnMatch(token, columns);
        if (result.match && result.score >= 0.5 && !seen.has(result.match)) {
            references.push({
                term: token,
                column: result.match,
                score: result.score,
                type: result.type
            });
            seen.add(result.match);
        }
    }

    return references;
}

/**
 * Detect analytics intent from query
 * @param {string} query - User's natural language query
 * @returns {Object} - Detected intents (aggregation, ranking, trend, etc.)
 */
function detectAnalyticsIntent(query) {
    const lowerQuery = query.toLowerCase();
    const intents = {};

    for (const [category, keywords] of Object.entries(ANALYTICS_KEYWORDS)) {
        const matched = keywords.filter(kw => lowerQuery.includes(kw));
        if (matched.length > 0) {
            intents[category] = matched;
        }
    }

    // Detect specific patterns
    if (/top\s+\d+%?/i.test(query)) {
        intents.topN = query.match(/top\s+(\d+)(%)?/i);
    }
    if (/bottom\s+\d+%?/i.test(query)) {
        intents.bottomN = query.match(/bottom\s+(\d+)(%)?/i);
    }
    if (/per\s+(month|year|week|day)/i.test(query)) {
        intents.timeGrouping = query.match(/per\s+(month|year|week|day)/i)[1];
    }
    if (/over\s+time/i.test(query)) {
        intents.timeSeries = true;
    }

    return intents;
}

/**
 * Infer sentiment filter from query terms
 * @param {string} query - User query
 * @returns {Object|null} - Sentiment filter configuration
 */
function inferSentimentFilter(query) {
    const lowerQuery = query.toLowerCase();

    const negativeTerms = ['harsh', 'harshest', 'negative', 'bad', 'worst', 'low', 'lowest', 'poor', 'terrible'];
    const positiveTerms = ['positive', 'good', 'best', 'high', 'highest', 'great', 'excellent', 'top'];

    for (const term of negativeTerms) {
        if (lowerQuery.includes(term)) {
            return { type: 'negative', term, suggestedFilter: { operator: '<=', threshold: 2 } };
        }
    }

    for (const term of positiveTerms) {
        if (lowerQuery.includes(term)) {
            return { type: 'positive', term, suggestedFilter: { operator: '>=', threshold: 4 } };
        }
    }

    return null;
}

/**
 * Generate enhanced AI prompt hints based on schema and query
 * @param {string} query - User query
 * @param {Object} schema - Database schema
 * @returns {string} - Enhanced hints for AI
 */
function generateSemanticHints(query, schema) {
    const columns = [];

    // Extract all column names from schema
    if (schema.tables) {
        for (const table of schema.tables) {
            if (table.columns) {
                columns.push(...table.columns.map(c => c.name || c));
            }
        }
    } else if (schema.collections) {
        for (const coll of schema.collections) {
            if (coll.fields) {
                columns.push(...coll.fields.map(f => f.name || f));
            }
        }
    }

    const references = extractColumnReferences(query, columns);
    const intents = detectAnalyticsIntent(query);
    const sentiment = inferSentimentFilter(query);

    let hints = 'SEMANTIC ANALYSIS:\n';

    if (references.length > 0) {
        hints += 'Column Mappings:\n';
        for (const ref of references) {
            hints += `  - "${ref.term}" → "${ref.column}" (${ref.type}, confidence: ${(ref.score * 100).toFixed(0)}%)\n`;
        }
    }

    if (Object.keys(intents).length > 0) {
        hints += '\nAnalytics Intents:\n';
        for (const [intent, keywords] of Object.entries(intents)) {
            if (Array.isArray(keywords)) {
                hints += `  - ${intent}: [${keywords.join(', ')}]\n`;
            } else {
                hints += `  - ${intent}: ${JSON.stringify(keywords)}\n`;
            }
        }
    }

    if (sentiment) {
        hints += `\nSentiment Filter Detected:\n`;
        hints += `  - Type: ${sentiment.type}\n`;
        hints += `  - Term: "${sentiment.term}"\n`;
        hints += `  - Suggested: rating/score ${sentiment.suggestedFilter.operator} ${sentiment.suggestedFilter.threshold}\n`;
    }

    return hints;
}

module.exports = {
    levenshteinDistance,
    similarityScore,
    singularize,
    pluralize,
    normalize,
    tokenize,
    findBestColumnMatch,
    extractColumnReferences,
    detectAnalyticsIntent,
    inferSentimentFilter,
    generateSemanticHints,
    SEMANTIC_SYNONYMS,
    ANALYTICS_KEYWORDS
};
