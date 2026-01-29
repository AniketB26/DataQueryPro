/**
 * Field Mapper Utility
 * 
 * Maps common user terms to actual database column names.
 * Helps AI understand user intent when they don't use exact column names.
 */

// Common synonyms for field names
const FIELD_SYNONYMS = {
    // Name variations
    'name': ['fullName', 'firstName', 'lastName', 'username', 'displayName', 'name'],
    'fullname': ['fullName', 'full_name', 'name'],
    'firstname': ['firstName', 'first_name', 'fname'],
    'lastname': ['lastName', 'last_name', 'lname', 'surname'],
    'username': ['username', 'user_name', 'login', 'userName'],

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

    // Date variations
    'created': ['createdAt', 'created_at', 'dateCreated', 'createDate'],
    'updated': ['updatedAt', 'updated_at', 'dateUpdated', 'modifiedAt'],
    'date': ['createdAt', 'date', 'timestamp'],
    'lastlogin': ['lastLogin', 'last_login', 'lastLoginAt'],

    // Password (usually excluded)
    'password': ['password', 'passwordHash', 'pwd'],

    // Profile
    'picture': ['profilePicture', 'avatar', 'photo', 'image'],
    'avatar': ['profilePicture', 'avatar', 'photo'],
    'photo': ['profilePicture', 'photo', 'picture'],

    // Auth
    'provider': ['authProvider', 'provider', 'loginProvider'],
    'google': ['googleId', 'google_id']
};

// Value mappings for filters
const VALUE_MAPPINGS = {
    'active': { field: 'isActive', value: true },
    'inactive': { field: 'isActive', value: false },
    'enabled': { field: 'isActive', value: true },
    'disabled': { field: 'isActive', value: false },
    'verified': { field: 'isVerified', value: true },
    'unverified': { field: 'isVerified', value: false }
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
