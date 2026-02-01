/**
 * Field Mapper Utility
 * 
 * Maps common user terms to actual database column names.
 * Helps AI understand user intent when they don't use exact column names.
 * Enhanced with analytics and sentiment-related mappings.
 */

// Common synonyms for field names (expanded for analytics)
const FIELD_SYNONYMS = {
    // Name variations
    'name': ['fullName', 'firstName', 'lastName', 'username', 'displayName', 'name', 'full_name', 'user_name'],
    'fullname': ['fullName', 'full_name', 'name'],
    'firstname': ['firstName', 'first_name', 'fname'],
    'lastname': ['lastName', 'last_name', 'lname', 'surname'],
    'username': ['username', 'user_name', 'login', 'userName', 'user'],

    // ID variations
    'id': ['_id', 'id', 'Id', 'ID', 'userId', 'user_id'],
    'userid': ['userId', 'user_id', '_id', 'id'],

    // Email variations
    'email': ['email', 'emailAddress', 'email_address', 'mail'],
    'emailid': ['email', 'emailAddress'],
    'mail': ['email', 'emailAddress'],

    // Status variations
    'active': ['isActive', 'is_active', 'active', 'status', 'enabled'],
    'status': ['status', 'isActive', 'state', 'enabled'],
    'enabled': ['enabled', 'isActive', 'active'],

    // Date variations (expanded for time-series analytics)
    'created': ['createdAt', 'created_at', 'dateCreated', 'createDate', 'date', 'timestamp'],
    'updated': ['updatedAt', 'updated_at', 'dateUpdated', 'modifiedAt', 'modified'],
    'date': ['createdAt', 'date', 'timestamp', 'created_at', 'time', 'datetime'],
    'time': ['time', 'timestamp', 'datetime', 'createdAt', 'date'],
    'lastlogin': ['lastLogin', 'last_login', 'lastLoginAt'],

    // Password (usually excluded)
    'password': ['password', 'passwordHash', 'pwd'],

    // Profile
    'picture': ['profilePicture', 'avatar', 'photo', 'image'],
    'avatar': ['profilePicture', 'avatar', 'photo'],
    'photo': ['profilePicture', 'photo', 'picture'],

    // Auth
    'provider': ['authProvider', 'provider', 'loginProvider'],
    'google': ['googleId', 'google_id'],

    // ========== ANALYTICS & RATINGS (NEW) ==========

    // Rating/Score variations
    'rating': ['rating', 'score', 'stars', 'rate', 'value', 'Rating', 'Score'],
    'score': ['score', 'rating', 'points', 'grade', 'value', 'stars'],
    'stars': ['stars', 'rating', 'star_rating', 'star_count'],
    'grade': ['grade', 'score', 'rating', 'mark'],

    // User/Reviewer variations
    'user': ['user', 'username', 'author', 'reviewer', 'customer', 'member', 'account'],
    'reviewer': ['reviewer', 'user', 'author', 'commenter', 'rater'],
    'author': ['author', 'user', 'writer', 'creator', 'reviewer'],
    'customer': ['customer', 'client', 'user', 'buyer', 'shopper'],

    // Review/Feedback content
    'review': ['review', 'feedback', 'comment', 'text', 'content', 'description', 'body'],
    'comment': ['comment', 'review', 'feedback', 'text', 'note', 'remarks'],
    'feedback': ['feedback', 'review', 'response', 'comment'],
    'text': ['text', 'content', 'body', 'description', 'review'],

    // Engagement metrics
    'thumbsup': ['thumbs_up', 'thumbsUp', 'likes', 'upvotes', 'helpful', 'positive_votes'],
    'thumbsdown': ['thumbs_down', 'thumbsDown', 'dislikes', 'downvotes', 'negative_votes'],
    'likes': ['likes', 'thumbs_up', 'upvotes', 'favorites', 'hearts'],
    'dislikes': ['dislikes', 'thumbs_down', 'downvotes'],
    'views': ['views', 'impressions', 'visits', 'hits', 'seen'],
    'helpful': ['helpful', 'useful', 'thumbs_up', 'positive'],

    // Location/Geography
    'country': ['country', 'nation', 'region', 'location', 'geo', 'country_code'],
    'city': ['city', 'town', 'location', 'place'],
    'location': ['location', 'place', 'address', 'geo', 'region', 'country'],
    'region': ['region', 'area', 'zone', 'territory', 'country'],

    // Category/Type
    'category': ['category', 'type', 'class', 'group', 'kind', 'tag'],
    'type': ['type', 'category', 'kind', 'class', 'genre'],
    'tag': ['tag', 'label', 'category', 'keyword'],

    // Product/App
    'product': ['product', 'item', 'app', 'application', 'software'],
    'app': ['app', 'application', 'software', 'program', 'product'],
    'version': ['version', 'ver', 'release', 'build']
};

// Value mappings for filters (expanded for sentiment analysis)
const VALUE_MAPPINGS = {
    // Status filters
    'active': { field: 'isActive', value: true },
    'inactive': { field: 'isActive', value: false },
    'enabled': { field: 'isActive', value: true },
    'disabled': { field: 'isActive', value: false },
    'verified': { field: 'isVerified', value: true },
    'unverified': { field: 'isVerified', value: false },

    // Sentiment-based value mappings for ratings (1-5 scale)
    'harsh': { field: 'rating', operator: '<=', value: 2 },
    'harshest': { field: 'rating', operator: '<=', value: 1 },
    'negative': { field: 'rating', operator: '<=', value: 2 },
    'bad': { field: 'rating', operator: '<=', value: 2 },
    'poor': { field: 'rating', operator: '<=', value: 2 },
    'worst': { field: 'rating', operator: '=', value: 1 },
    'terrible': { field: 'rating', operator: '<=', value: 1 },
    'low': { field: 'rating', operator: '<=', value: 2 },
    'lowest': { field: 'rating', operator: '=', value: 1 },

    'positive': { field: 'rating', operator: '>=', value: 4 },
    'good': { field: 'rating', operator: '>=', value: 4 },
    'great': { field: 'rating', operator: '>=', value: 4 },
    'excellent': { field: 'rating', operator: '>=', value: 5 },
    'best': { field: 'rating', operator: '=', value: 5 },
    'high': { field: 'rating', operator: '>=', value: 4 },
    'highest': { field: 'rating', operator: '=', value: 5 },
    'top': { field: 'rating', operator: '>=', value: 4 }
};

/**
 * Normalize a field name for comparison
 */
function normalizeFieldName(name) {
    return name
        .toLowerCase()
        .replace(/[_\-\s]/g, '')  // Remove underscores, hyphens, spaces
        .replace(/id$/i, 'id');    // Normalize ID suffix
}

/**
 * Find the best matching field from schema for a user term
 */
function findBestMatch(userTerm, schemaFields) {
    const normalized = normalizeFieldName(userTerm);

    // 1. Exact match (case-insensitive)
    for (const field of schemaFields) {
        if (normalizeFieldName(field) === normalized) {
            return field;
        }
    }

    // 2. Check synonyms
    const synonyms = FIELD_SYNONYMS[normalized] || [];
    for (const synonym of synonyms) {
        for (const field of schemaFields) {
            if (normalizeFieldName(field) === normalizeFieldName(synonym)) {
                return field;
            }
        }
    }

    // 3. Partial match (field contains term or term contains field)
    for (const field of schemaFields) {
        const normalizedField = normalizeFieldName(field);
        if (normalizedField.includes(normalized) || normalized.includes(normalizedField)) {
            return field;
        }
    }

    return null;
}

/**
 * Generate field mapping hints for AI from schema
 */
function generateFieldMappingHints(schema) {
    const hints = [];
    let fields = [];

    // Extract fields from schema
    if (schema.collections) {
        // MongoDB
        for (const collection of schema.collections) {
            fields = fields.concat(collection.fields.map(f => f.name || f));
        }
    } else if (schema.tables) {
        // SQL
        for (const table of schema.tables) {
            fields = fields.concat(table.columns.map(c => c.name || c));
        }
    }

    // Get unique field names (without nested paths)
    const uniqueFields = [...new Set(fields.map(f => f.split('.')[0]))];

    // Generate mapping hints
    hints.push('FIELD MAPPING HINTS (use these to interpret user requests):');

    for (const field of uniqueFields) {
        const normalized = normalizeFieldName(field);
        const mappings = [];

        // Find what user terms map to this field
        for (const [userTerm, synonyms] of Object.entries(FIELD_SYNONYMS)) {
            if (synonyms.some(s => normalizeFieldName(s) === normalized)) {
                mappings.push(userTerm);
            }
        }

        if (mappings.length > 0) {
            hints.push(`- "${mappings.join('", "')}" → use field "${field}"`);
        }
    }

    // Add common patterns
    hints.push('');
    hints.push('COMMON PATTERNS:');
    hints.push('- "name" usually means "fullName" or "username"');
    hints.push('- "id" usually means "_id"');
    hints.push('- "active users" means filter where isActive = true');
    hints.push('- "email" means the email field');

    return hints.join('\n');
}

/**
 * Analyze user question and extract field references
 */
function extractFieldReferences(question, schemaFields) {
    const words = question.toLowerCase().split(/\s+/);
    const mappings = [];

    for (const word of words) {
        // Skip common words
        if (['and', 'or', 'the', 'of', 'all', 'show', 'write', 'get', 'display', 'print', 'list', 'to', 'from', 'with', 'users', 'user', 'me'].includes(word)) {
            continue;
        }

        const match = findBestMatch(word, schemaFields);
        if (match && !mappings.some(m => m.actual === match)) {
            mappings.push({ userTerm: word, actual: match });
        }
    }

    return mappings;
}

module.exports = {
    FIELD_SYNONYMS,
    VALUE_MAPPINGS,
    normalizeFieldName,
    findBestMatch,
    generateFieldMappingHints,
    extractFieldReferences
};
