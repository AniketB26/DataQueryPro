# DataQuery Pro — Complete Interview Preparation Guide

> A comprehensive Q&A covering every aspect of the project: architecture, backend logic, APIs, AI integration, security, databases, and design decisions. Tailored for a **Backend Intern** interview.

---

## Table of Contents

1. [Project Overview & Motivation](#1-project-overview--motivation)
2. [System Architecture & Flow](#2-system-architecture--flow)
3. [Backend Stack & Technology Choices](#3-backend-stack--technology-choices)
4. [REST API Design](#4-rest-api-design)
5. [Authentication & Security](#5-authentication--security)
6. [Database Connectors & Abstraction Layer](#6-database-connectors--abstraction-layer)
7. [AI Integration (Google Gemini / Groq)](#7-ai-integration-google-gemini--groq)
8. [Session & Connection Management](#8-session--connection-management)
9. [Query Auto-Fixing & Error Handling](#9-query-auto-fixing--error-handling)
10. [MongoDB (User Persistence)](#10-mongodb-user-persistence)
11. [Middleware & Request Pipeline](#11-middleware--request-pipeline)
12. [Semantic Field Mapping & Analytics Engine](#12-semantic-field-mapping--analytics-engine)
13. [Code Quality & Architecture Decisions](#13-code-quality--architecture-decisions)
14. [Scalability, Performance & Production Readiness](#14-scalability-performance--production-readiness)
15. [Tricky / Behavioral Questions](#15-tricky--behavioral-questions)

---

## 1. Project Overview & Motivation

### Q1. What is DataQuery Pro and why did you build it?
**A:** DataQuery Pro is a full-stack web application that lets users connect to any database — SQL (MySQL, PostgreSQL, SQLite), NoSQL (MongoDB), or even file-based sources (Excel, CSV) — and query that data using plain English. Instead of writing SQL or MongoDB aggregation pipelines, a user can type *"Show me the top 10 customers by revenue this quarter"* and the system generates and executes the correct query automatically.

I built it to solve a real problem: non-technical users (analysts, product managers, business stakeholders) are often blocked by their dependence on engineers to pull data. By abstracting the query layer behind natural language, anyone can independently explore data. It also gave me deep, hands-on experience with backend system design — building REST APIs, multi-DB connectors, AI integration, JWT auth, and secure session management all in one project.

---

### Q2. What problem does this solve at scale?
**A:** In any data-driven company, the bottleneck is often "I need to answer a business question but I can't write SQL." Engineers become accidental data analysts. DataQuery Pro fixes this by:
- Eliminating the need for technical query knowledge.
- Providing a unified interface for diverse data sources (no need to learn different query languages for SQL vs MongoDB vs Excel).
- Reducing turnaround time for data questions from hours (waiting for an engineer) to seconds.

---

### Q3. What is the scope of the project?
**A:** The scope includes:
- **Authentication system**: JWT + Google OAuth, bcrypt password hashing.
- **Multi-DB connector engine**: A plugin-style abstraction supporting MySQL, PostgreSQL, SQLite, MongoDB, Excel, and CSV.
- **Natural language → Query pipeline**: Sends user questions + schema context to a Gemini AI model, receives structured query JSON, executes it against the connected DB.
- **Auto-fix pipeline**: If a generated query fails, the system automatically sends the error back to the AI for correction.
- **In-memory session management**: Database credentials are never persisted — they're held in a `Map` only for the duration of the session.
- **Chat history**: Per-session conversation context fed back to the AI for follow-up questions.
- **REST API**: 15+ well-defined endpoints across Auth, DB, Chat, and History modules.

---

## 2. System Architecture & Flow

### Q4. Walk me through the end-to-end flow of a query from the user typing a question to seeing the result.

**A:** Here is the exact flow:

```
User types: "Show me all reviews with a rating below 2"
         │
         ▼
[Frontend] → POST /api/chat/message
         │ { chatSessionId, connectionSessionId, message }
         │
         ▼
[chatController] → chatService.processMessage()
         │
         ├─ Gets active DB connection from in-memory Map using connectionSessionId
         ├─ Gets the pre-fetched database schema (already stored in the Map)
         │
         ▼
[queryTranslator.generateQuery()]
         │ Builds a prompt:
         │  - System prompt (DB-type specific: SQL / MongoDB / File)
         │  - Database schema (tables, columns, types)
         │  - Semantic field mapping hints (fieldMapper.js)
         │  - Last 6 messages from chat history (for follow-up context)
         │  - Current user question
         │
         ▼
[Google Gemini API] returns structured JSON:
         { query: "SELECT * FROM reviews WHERE rating <= 2", explanation: "...", confidence: 0.95 }
         │
         ▼
[connector.runQuery(query)]
         │ - Validates query (blocks DROP, DELETE, etc.)
         │ - Executes against the connected DB (MySQL pool, Mongo, XLSX parser, etc.)
         │
         ▼
[If query fails → fixQuery()]
         │ Sends: original question + failed query + error message back to Gemini
         │ Gemini returns corrected query
         │ Re-executes corrected query
         │
         ▼
[generateResponse()] → Gemini converts raw results into a human-friendly paragraph
         │
         ▼
[Response to Frontend]:
{
  success: true,
  message: "Found 42 reviews with ratings of 1 or 2. The lowest rated reviewer was...",
  query: "SELECT * FROM reviews WHERE rating <= 2",
  result: { data: [...], rowCount: 42, columns: [...] },
  wasFixed: false
}
```

---

### Q5. What is the layered architecture of the backend?
**A:** The backend follows a clean, layered separation of concerns:

| Layer | Folder | Responsibility |
|---|---|---|
| **Routes** | `routes/` | Maps HTTP methods & paths to controller functions |
| **Controllers** | `controllers/` | Parses request, validates input, calls services, sends response |
| **Services** | `services/` | Owns business logic (auth, chat, connections, history) |
| **Connectors** | `db_connectors/` | Low-level DB drivers wrapped in a unified interface |
| **AI Layer** | `openai/` | Prompt construction, Gemini API calls, response parsing |
| **Models** | `models/` | Mongoose schemas for User, Connection, QueryHistory |
| **Middleware** | `middleware/` | JWT auth guard, global error handler |
| **Utils** | `utils/` | Field mapper, shared helpers |

This separation means if we swap Gemini for a different AI model, only `queryTranslator.js` changes. If we add a new DB type, we only add a connector class.

---

## 3. Backend Stack & Technology Choices

### Q6. Why Node.js and Express?
**A:**
- **Node.js**: I/O intensive tasks (DB queries, external API calls) are exactly where Node.js shines due to its non-blocking, event-loop-based architecture. A query to Gemini, while waiting for the AI response, doesn't block other incoming requests.
- **Express**: Minimal, highly flexible, widely supported. It gives fine-grained control over middleware ordering, which was important for setting up CORS *before* Helmet (to properly handle preflight OPTIONS requests from browsers), then auth middleware only on protected routes.

---

### Q7. Why MongoDB Atlas for user persistence?
**A:** MongoDB is schema-flexible, which suits the User model since OAuth users (Google) have different fields than local users — no `password`, but have `googleId`, `profilePicture`, etc. MongoDB's `sparse: true` index on `googleId` handles this elegantly — it enforces uniqueness only where the field isn't null. MongoDB Atlas also provides a free-tier cloud instance, so there's no need to manage a database server for this use case.

---

### Q8. Why Google Gemini instead of OpenAI or Groq?
**A:** The project originally used Groq (LLaMA 3.3 70B), but was migrated to Google Gemini. Key reasons:
- **Structured output**: Gemini supports `responseMimeType: "application/json"`, which forces the model to respond with valid JSON. This eliminates a whole class of parsing failures.
- **Context window**: Gemini has a large context window — important for feeding extensive database schemas alongside conversation history.
- **Performance vs cost**: The Gemini API has a generous free tier and excellent latency for the query-generation use case.
- **Multi-turn chat**: Gemini's `startChat({ history })` API maps naturally to our conversation history model.

---

## 4. REST API Design

### Q9. Describe all your API endpoints and what each does.

**A:**

**Auth Routes** (`/api/auth`):
| Method | Path | What it does |
|---|---|---|
| POST | `/signup` | Creates new user, hashes password, returns user object |
| POST | `/login` | Validates credentials, returns JWT token + user |
| POST | `/google` | Verifies Google ID token, creates/finds user, returns JWT |
| GET | `/me` | Returns current user from JWT (auth guarded) |
| POST | `/logout` | Client-side token discard (stateless JWT) |
| PUT | `/profile` | Updates fullName, profilePicture (not email/password) |
| PUT | `/password` | Changes password with current password verification |

**Database Routes** (`/api/db`):
| Method | Path | What it does |
|---|---|---|
| POST | `/connect` | Creates live DB connection, extracts schema, returns sessionId |
| GET | `/schema` | Returns schema for active session |
| POST | `/query` | Directly executes a raw query on active session |
| POST | `/disconnect` | Closes connection, removes from Map, cleans up uploaded files |
| GET | `/connections` | Lists user's saved connections from MongoDB |

**Chat Routes** (`/api/chat`):
| Method | Path | What it does |
|---|---|---|
| POST | `/new` | Creates a new chat session linked to a DB session |
| POST | `/message` | Core endpoint — processes NL query, runs full pipeline |
| GET | `/history` | Returns chat message history for a session |
| GET | `/suggestions` | Schema-aware suggested questions (no AI, deterministic) |
| POST | `/clear` | Clears messages for a chat session |
| GET | `/export` | Exports full chat as JSON |

**Health Check**: `GET /api/health` — returns status, timestamp, version.

---

### Q10. What is a RESTful API? Does your API follow REST principles?
**A:** REST (Representational State Transfer) is an architectural style with these principles:
1. **Stateless**: Each request contains all necessary info. ✅ We use JWT; no server-side session for auth.
2. **Client-Server separation**: Frontend and backend are fully decoupled. ✅
3. **Uniform interface**: Resources are identified by URLs using standard HTTP verbs. ✅
4. **Layered system**: Client doesn't know about internal layers. ✅

One deviation to note honestly: some state *does* exist on the server — the active DB connections and chat history are stored in in-memory Maps. This is a pragmatic trade-off for performance (not having to re-connect to the DB on every message), but it means the server is not 100% stateless. In production at scale, this would be moved to a shared cache like Redis.

---

### Q11. How do you handle input validation in your API?
**A:** At multiple layers:
1. **Controller-level validation**: The `dbController.connect()` function checks that `dbType` is present and calls `validateConnectionConfig()` which has switch-case validation per DB type (e.g., MySQL requires `host`, `database`, `username`; MongoDB requires `connectionString` or `host` + `database`).
2. **Middleware-level**: `authenticateToken` validates JWT tokens before protected routes execute.
3. **Model-level**: Mongoose schemas enforce types, required fields, min/max length, regex patterns (e.g., email format on the User schema).
4. **AI output validation**: `extractJSON()` in `queryTranslator.js` robustly parses AI responses, handling markdown code blocks, trailing commas, and malformed JSON.

---

## 5. Authentication & Security

### Q12. How does JWT authentication work in your backend?

**A:** JWT (JSON Web Token) is a stateless authentication mechanism. Here's the exact flow:

**Login:**
1. User sends `POST /api/auth/login` with email + password.
2. Service fetches user from MongoDB (with `select('+password')` to include the normally-hidden field).
3. bcrypt compares the submitted password against the stored hash.
4. On success, `jwt.sign({ userId, email, username }, JWT_SECRET, { expiresIn: '24h' })` creates a signed token containing user identifiers but NO sensitive info.
5. Token is returned to the client.

**Subsequent Requests:**
1. Client sends `Authorization: Bearer <token>` header.
2. `authenticateToken` middleware extracts the token via `authHeader.split(' ')[1]`.
3. `jwt.verify(token, config.jwt.secret)` validates the signature and expiry.
4. The decoded payload is attached to `req.user` and `next()` is called.
5. Controller accesses `req.user.userId` for user-specific operations.

**Why JWT over sessions?**: JWTs are stateless — no need to store session data in a database or cache. This scales horizontally (multiple server instances) without a shared session store.

---

### Q13. How does bcrypt password hashing work?
**A:** bcrypt is a password-hashing algorithm designed to be computationally expensive (slow), which makes brute-force attacks impractical.

In the User Mongoose schema, there's a `pre('save')` hook:
```javascript
userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) return;
    const salt = await bcrypt.genSalt(10); // 10 rounds = 2^10 iterations
    this.password = await bcrypt.hash(this.password, salt);
});
```

- `genSalt(10)` generates a random salt with 10 work factor rounds. This means the hash computation runs 2^10 = 1024 iterations, making each hash take ~100ms.
- The salt is embedded in the hash output, so `bcrypt.compare()` can extract it automatically.
- The schema has `select: false` on the password field, meaning it's never returned in queries by default — you must explicitly `.select('+password')`.

---

### Q14. How does Google OAuth work in your backend?
**A:** We use the Google Identity Services (One Tap) popup on the frontend. When a user signs in with Google:

1. The frontend receives a Google **ID token** (a JWT issued by Google).
2. Frontend sends this token to `POST /api/auth/google`.
3. Backend calls `verifyGoogleToken(idToken)` which uses `google-auth-library` to verify the token's signature against Google's public keys and check the audience (our Client ID).
4. If valid, we extract `email`, `name`, `sub` (Google's user ID), `picture` from the payload.
5. We look up if a user already exists (by `googleId` or `email`). If yes, update `lastLogin`. If no, create a new user account with `authProvider: 'google'` (no password needed).
6. Issue our own JWT and return it.

This is the **Authorization Code flow in the implicit variant** — we don't handle auth codes server-side; Google handles it in the popup and gives us an ID token.

---

### Q15. What security mechanisms does your Express server use?
**A:**
- **Helmet.js**: Sets 14+ security HTTP headers (X-Frame-Options, Content-Security-Policy, etc.) to mitigate XSS, clickjacking, and other attacks. We customized `crossOriginOpenerPolicy` to `same-origin-allow-popups` to allow Google's OAuth popup `postMessage` communication.
- **CORS**: Strict allowlist of origins (from `CORS_ORIGIN` env variable, supports comma-separated list for multi-origin deploys). Blocks unexpected origins with a warning log.
- **Rate Limiting**: `express-rate-limit` — 100 requests per 15 minutes per IP. Applied to all `/api/` routes. `app.set('trust proxy', 1)` correctly identifies the real client IP behind Render's load balancer.
- **Query Validation (Destructive Operations Blocked)**: `BaseConnector.validateQuery()` checks the generated SQL against a list of dangerous patterns (`DROP TABLE`, `DELETE FROM`, `TRUNCATE`, `ALTER TABLE`, etc.) and rejects them.
- **In-Memory Credentials**: Database connection credentials (username, password) are never written to MongoDB — only held in an in-memory `Map`. They disappear when the session ends or the server restarts.
- **JWT Expiry**: Tokens expire after 24 hours.
- **HTTPS Enforcement**: Deployed backends (Render/Railway) serve over HTTPS.

---

## 6. Database Connectors & Abstraction Layer

### Q16. Explain the Connector abstraction pattern you used.
**A:** I implemented an **Abstract Base Class** pattern (similar to interfaces in typed languages). `BaseConnector` defines the contract:

```javascript
class BaseConnector {
    async connect() { throw new Error('Must implement connect()'); }
    async getSchema() { throw new Error('Must implement getSchema()'); }
    async runQuery(query) { throw new Error('Must implement runQuery()'); }
    async close() { throw new Error('Must implement close()'); }
    formatSchemaForAI() { throw new Error('Must implement formatSchemaForAI()'); }
    validateQuery(query, options) { /* shared safety validation */ }
}
```

Subclasses (`SQLConnector`, `MongoConnector`, `FileConnector`) extend this and implement each method for their specific database driver. The rest of the application only ever calls the four standard methods — it doesn't know what database it's talking to.

**Why this matters**: When the `chatService` calls `connector.runQuery(query)`, it works identically whether the connector is MySQL, MongoDB, or a CSV file. Adding a new DB type (e.g., DynamoDB) would only require creating `DynamoConnector extends BaseConnector` — zero changes to business logic.

This is the **Strategy Pattern** from OOP design patterns — the algorithm (DB interaction) is encapsulated and interchangeable.

---

### Q17. How does the SQL connector handle multiple database types internally?
**A:** `SQLConnector` receives a `config.type` property (`'mysql'`, `'postgresql'`, `'sqlite'`) and uses `switch` statements to call type-specific private methods:

- **MySQL**: Uses `mysql2/promise` with a **connection pool** (`createPool`) — efficient for concurrent requests. Schema extraction queries `INFORMATION_SCHEMA.TABLES` and `INFORMATION_SCHEMA.COLUMNS`.
- **PostgreSQL**: Uses `pg` (node-postgres) with a `Pool`. Schema queries use `information_schema.tables` filtered to `table_schema = 'public'`. Uses `$1` parameterized queries for PostgreSQL syntax.
- **SQLite**: Uses `sql.js` (WebAssembly SQLite port, runs entirely in-process — no server needed). Reads the `.db` file into a buffer, creates an in-memory DB object. Schema via `sqlite_master` and `PRAGMA table_info()`.

The `runQuery` method also handles the different return shapes — MySQL returns `[rows, fields]`, PostgreSQL returns `{ rows, rowCount }`, SQLite returns `[{ columns, values }]` — and normalizes them all to `{ success, data, rowCount, columns }`.

---

### Q18. How does the file connector (Excel/CSV) work?
**A:** The `FileConnector` handles `xlsx` and `csv` files uploaded via `multipart/form-data`. It:
1. Parses the file using the `xlsx` package (`XLSX.readFile()`) to get sheet data as arrays of objects.
2. Stores the parsed data in memory (organized by sheet name).
3. For `getSchema()`, it samples the first few rows to infer column types (string, number, date).
4. For `runQuery()`, instead of SQL, the AI returns a structured JSON query object (filter, groupBy, aggregates, orderBy, windowFunction, etc.). The `FileConnector.runQuery()` implements a custom in-memory query execution engine that:
   - Applies filters (`WHERE` equivalent)
   - Groups and aggregates (`GROUP BY`, `AVG`, `SUM`, etc.)
   - Applies window functions (`RANK`, `ROW_NUMBER`)
   - Computes statistical metrics (`STDEV`, correlation, percentile)
   - Handles time-based grouping (month, year, quarter)

This makes Excel/CSV querying extremely powerful without any SQL engine dependency.

---

### Q19. What is a connection pool and why did you use it?
**A:** A connection pool is a cache of pre-established database connections that can be reused, rather than opening a new connection for every query. Opening a DB connection is expensive (TCP handshake, auth, etc.) — it can take 50-500ms.

With a pool (`connectionLimit: 5` for MySQL), 5 connections are established when the session starts. Each query borrows a connection, executes, then returns it to the pool. This makes subsequent queries fast (~1-5ms overhead vs 200ms+ for a fresh connection).

If all 5 connections are busy and a 6th query comes in, it waits in a queue (`queueLimit: 0` = infinite queue). This prevents overwhelming the DB server.

---

## 7. AI Integration (Google Gemini / Groq)

### Q20. How exactly do you construct AI prompts to generate accurate queries?
**A:** Prompt engineering is critical. For each query request, I construct a message array with several components:

1. **System Prompt** (DB-type specific): A detailed instruction that tells Gemini it's an expert SQL/MongoDB/data analyst. It includes:
   - Semantic column matching rules (e.g., "harsh" = rating ≤ 2, "name" → fullName/username)
   - Supported SQL features (window functions, percentiles, CTEs)
   - The exact output JSON format it must return
   - Explicit instruction: "NEVER include text outside JSON. Start with { and end with }."

2. **Schema Context**: The full database schema (all table/collection names, column names, data types) formatted as a string.

3. **Semantic Hints**: The `fieldMapper.generateFieldMappingHints()` function analyzes which fields in the real schema match known synonyms and injects hints like: *`"rating", "score" → use field "Rating"`*.

4. **Conversation History**: Last 6 messages from the chat session — so follow-up questions like "Now filter for the last month" work correctly with context from previous exchanges.

5. **Current Question**: The user's natural language question.

By constructing rich, structured prompts, the AI generates far more accurate queries than a simple "translate this to SQL" prompt would.

---

### Q21. How do you handle the Gemini API's conversation format?
**A:** Gemini requires a specific format: alternating `user`/`model` roles with no consecutive same-role messages. Our chat history can violate this (e.g., we add two "user" messages — the schema and then the question). 

The `callGemini()` function handles this with a **merge step**:
```javascript
for (const msg of validMessages) {
    const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
    if (mergedHistory.length > 0 && mergedHistory[mergedHistory.length - 1].role === geminiRole) {
        // Merge with previous message instead of adding a new one
        mergedHistory[mergedHistory.length - 1].parts[0].text += '\n\n' + msg.content;
    } else {
        mergedHistory.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }
}
```

The last message is then popped from history and sent via `chat.sendMessage()` (for multi-turn) or `model.generateContent()` (for single-turn). `system` role messages are filtered out and passed as `systemInstruction` instead.

---

### Q22. How do you parse the AI's JSON response reliably?
**A:** AI models sometimes wrap JSON in markdown code blocks (` ```json ... ``` `), add explanatory text before/after, or generate trailing commas. The `extractJSON()` function handles all of these:

1. Removes markdown code block wrappers via regex: `` /```(?:json)?\s*\n?([\s\S]*?)\n?```/ ``
2. Uses a **brace-counting algorithm** (respecting quoted strings to avoid false counts) to find the exact start and end of the JSON object.
3. Tries `JSON.parse()`.
4. If that fails, tries removing trailing commas with regex (`/,\s*}/g` → `}`) and retries.
5. If all else fails, throws a descriptive error.

Using `responseMimeType: "application/json"` in the Gemini config also forces JSON-only responses, reducing parsing failures significantly.

---

### Q23. What is the `fixQuery` function and how does it work?
**A:** `fixQuery()` is a self-healing mechanism. If `connector.runQuery()` returns `success: false`, the chatService automatically calls this:

```javascript
const fixedQuery = await openai.fixQuery(
    userMessage,          // original user question  
    queryResult.query,    // the failed query
    execResult.error,     // the error message from the DB
    schema,               // database schema
    dbType
);
```

This sends a new Gemini prompt that includes the original question, the failed query AS A "model" response, and the error message. The AI analyzes the error (wrong column name? incorrect syntax? type mismatch?) and generates a corrected query. Lower temperature (`0.2`) is used for correction to make responses more deterministic.

If the corrected query succeeds, `wasFixed: true` is flagged in the response so the frontend can indicate the query was auto-corrected.

---

### Q24. How do query suggestions work?
**A:** Query suggestions (`generateQuerySuggestions()`) are **fully deterministic — no AI involved**. This is a deliberate choice:

- AI calls cost money and take time. Suggestions are displayed immediately when a user connects.
- The function analyzes the schema object, detects numeric columns (by type or name patterns like "rating", "score", "amount"), date columns, categorical columns, and generates contextual suggestions like:
  - "What is the average rating?"
  - "Show top 10 by score"
  - "Show trend over time"
  - "Average rating by country"
- Tables with common names (users, orders, products) are prioritized using a sorted priority list.

Maximum 6 suggestions are returned. This is fast, free, and always relevant to the connected database.

---

## 8. Session & Connection Management

### Q25. How do you manage active database connections across requests?
**A:** Active connections are stored in a module-level `Map`:

```javascript
const activeConnections = new Map();
// Key: sessionId (string)
// Value: { connector, schema, dbType, connectionId, userId, createdAt }
```

When a user connects (`POST /api/db/connect`):
1. `createActiveConnection()` creates a `sessionId = "${userId}-${uuidv4()}"`.
2. The connector is instantiated and `connector.connect()` is called.
3. `connector.getSchema()` is called — the schema is cached in the Map entry.
4. The `sessionId` is returned to the frontend.

On all subsequent chat requests, the frontend sends `connectionSessionId`. The service does `activeConnections.get(connectionSessionId)` — O(1) lookup. Both the live connector and the cached schema are immediately available with no additional DB or API calls.

**Why in-memory Map over a database?**: Speed. A Redis/DB lookup adds latency on EVERY query. An in-memory Map lookup is sub-millisecond. The trade-off is that connections don't survive server restarts — acceptable for this use case.

---

### Q26. How do you prevent memory leaks from stale connections?
**A:** A periodic cleanup interval runs every 5 minutes:

```javascript
const CONNECTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, conn] of activeConnections) {
        if (now - conn.createdAt > CONNECTION_TIMEOUT) {
            closeActiveConnection(sessionId); // calls connector.close() + Map.delete()
        }
    }
}, 5 * 60 * 1000);
```

Any session inactive for 30 minutes is cleaned up automatically. `closeActiveConnection()` calls `connector.close()` (which ends the connection pool / closes the file handle) and then removes the entry from the Map. This prevents both memory leaks and dangling database connections.

---

### Q27. How are uploaded files (Excel/CSV) cleaned up?
**A:** At two points:
1. **On error**: In `dbController.connect()`, if an error occurs after file upload, `fs.unlink(req.file.path, () => {})` deletes the temporary file.
2. **On disconnect**: `dbController.disconnect()` checks if the connection type is `'file'` and the `filePath` is within the uploads directory, then calls `fs.unlink()` to clean it up.

Uploaded files are stored in a configurable `UPLOAD_DIR` (default `./uploads`). The check `filePath.startsWith(config.upload.dir)` ensures we only delete files within our managed directory, not arbitrary system paths.

---

## 9. Query Auto-Fixing & Error Handling

### Q28. How does your global error handler work?

**A:** In `middleware/errorHandler.js`, the global error handler is registered as the last middleware with 4 parameters (which Express recognizes as an error handler):

```javascript
app.use(errorHandler); // Must be last
```

It catches any error passed via `next(error)` from any route or middleware. It:
- Logs the error stack in development.
- Returns consistent JSON: `{ success: false, error: "..." }`.
- Differentiates status codes (400 for validation, 401 for auth, 500 for server errors).

This prevents sensitive stack traces from leaking to clients in production.

---

### Q29. How did you handle different connection errors gracefully?
**A:** In `connectionService.createActiveConnection()`, after the `connect()` call fails, the raw error message is inspected with `includes()` checks for common error patterns:

| Error Pattern | User-Friendly Message |
|---|---|
| `ETIMEDOUT` / `timeout` | "Connection timed out. Server not responding. Verify host/port/firewall." |
| `ECONNREFUSED` | "Connection refused. Database server may not be running." |
| `ENOTFOUND` / `getaddrinfo` | "Could not resolve hostname. Check spelling." |
| `Access denied` / `authentication failed` | "Authentication failed. Verify username and password." |
| `Unknown database` / `does not exist` | "Database not found. Verify database name." |
| `SSL` | "SSL required. Enable 'Use SSL' option." |
| Any other | "Connection failed: [original message]" |

This dramatically improves user experience — instead of seeing a cryptic `ETIMEDOUT` Node.js error, users see a clear action they can take.

---

## 10. MongoDB (User Persistence)

### Q30. What Mongoose models do you have and what do they store?
**A:** Three models:

**User** (`User.js`):
- `email` (unique, indexed, trimmed, regex validated)
- `username` (unique, 3-30 chars)
- `password` (hashed, `select: false`, only for local auth)
- `googleId` (sparse index — unique but allows null)
- `authProvider` (enum: `'local'` | `'google'`)
- `isActive`, `lastLogin`, `profilePicture`, `fullName`
- `timestamps: true` → auto `createdAt` / `updatedAt`
- `pre('save')` hook for password hashing
- `matchPassword()` method for bcrypt comparison
- `toJSON()` override strips password from output

**Connection** (`Connection.js`):
- Links to a User (`userId`)
- Stores `name`, `dbType`, `host`, `database`, `username` (NOT password — credentials are only in session memory)
- `schema` (cached DB structure JSON)
- `lastUsed`, `useCount`, `isDefault`

**QueryHistory** (`QueryHistory.js`):
- Stores past queries with `question`, `query`, `dbType`, `rowCount`, `executionTime`, `wasFixed`, `success`

---

### Q31. What is a Mongoose `sparse` index and why did you use it for `googleId`?
**A:** A regular unique index in MongoDB means every document must have a unique value AND only one document can have `null`. If two local users (without Google accounts) both have `googleId: null`, MongoDB would throw a duplicate key error.

A `sparse: true` index **only indexes documents where the field exists and is not null**. So:
- Multiple local users can all have `googleId: undefined/null` — the sparse index ignores them.
- Google users have a unique `googleId` — the index enforces uniqueness among them.

This is exactly the right tool for optional uniqueness.

---

## 11. Middleware & Request Pipeline

### Q32. Explain the order of middleware in your Express app and why order matters.

**A:** The order in `index.js` is deliberate:

```
1. app.set('trust proxy', 1)      → Must be first: enables correct IP for rate limiting
2. CORS middleware                 → Must come BEFORE Helmet: handles OPTIONS preflight first
3. app.options('*', cors())        → Explicitly handle all preflight OPTIONS
4. Helmet.js                       → Adds security headers after CORS
5. Rate limiter (express-rate-limit) → Applied to /api/ routes
6. express.json() parser           → Parse request body
7. express.urlencoded() parser     → Parse form data
8. Route handlers                  → Routes (auth, db, chat, history)
9. 404 handler                     → Catches any unmatched route
10. Global error handler            → Must be last, catches all errors
```

**Why CORS before Helmet?**: When a browser makes a cross-origin request, it first sends an `OPTIONS` preflight request. If Helmet runs before CORS, some Helmet headers might block or confuse the preflight response. CORS must handle OPTIONS first and set `Access-Control-Allow-*` headers before Helmet modifies them.

---

### Q33. What is the difference between `authenticateToken` and `optionalAuth`?
**A:**
- `authenticateToken`: Used on all protected routes. If no token or invalid token → returns 401/403. Blocks the request entirely.
- `optionalAuth`: Used on routes that have different behavior for authenticated vs. anonymous users but don't require auth. If token exists, decodes it and attaches `req.user`. If not, simply sets `req.user = null` and calls `next()`. Currently scaffolded for public-facing query endpoints that might be added in the future.

---

## 12. Semantic Field Mapping & Analytics Engine

### Q34. What is the `fieldMapper.js` utility and why is it needed?
**A:** Users rarely use the exact column names from their database. They might say "name" when the column is `fullName`, or "harsh review" when they mean `rating <= 2`.

`fieldMapper.js` defines:
1. **`FIELD_SYNONYMS`**: A dictionary mapping common user terms to database field name variants.
   - `"rating"` → `['rating', 'score', 'stars', 'rate', 'value', 'Rating', 'Score']`
   - `"name"` → `['fullName', 'firstName', 'lastName', 'username', 'displayName']`

2. **`VALUE_MAPPINGS`**: Maps sentiment/qualitative terms to actual filter conditions:
   - `"harsh"` → `{ field: 'rating', operator: '<=', value: 2 }`
   - `"excellent"` → `{ field: 'rating', operator: '=', value: 5 }`

3. **`generateFieldMappingHints(schema)`**: Given the actual schema, generates human-readable hints for the AI prompt: *`"rating", "score" → use field "Rating"`*. This tells the AI to use the *exact* column name from the schema when it sees any synonym.

4. **`findBestMatch(userTerm, schemaFields)`**: A 3-level matching algorithm:
   - Exact match (case-normalized)
   - Synonym lookup
   - Partial string match (contains)

This bridges the gap between natural language and precise database field names.

---

## 13. Code Quality & Architecture Decisions

### Q35. How did you ensure clean, maintainable code?
**A:**
- **JSDoc comments**: Every function has a docblock with `@param` and `@returns` descriptions.
- **Clear naming**: Functions say exactly what they do: `createActiveConnection`, `closeActiveConnection`, `validateConnectionConfig`.
- **Single Responsibility**: Each file has one job. `chatService` orchestrates the flow; `queryTranslator` handles AI; `connectionService` manages DB sessions.
- **Constants over magic strings**: Dangerous SQL patterns are stored in an array `dangerousPatterns`. System prompts are in a `SYSTEM_PROMPTS` object keyed by DB type. Timeout values are named constants (`CONNECTION_TIMEOUT`).
- **DRY principle**: The `BaseConnector` shares `validateQuery()` so it doesn't need to be reimplemented in every connector.
- **Consistent error responses**: All endpoints return `{ success: boolean, error?: string, data?: any }` — consistent contract the frontend can rely on.

---

### Q36. If you were to scale this for 10,000 concurrent users, what would you change?
**A:** Several things:
1. **Move in-memory Map to Redis**: Active connections and chat history are currently per-process. With multiple server instances, users would lose context if load-balanced to a different instance. Redis would provide shared state.
2. **Connection Pooling per user session → Connection Pool Manager**: Instead of holding full pools per session, implement a smarter pool that recycles connections across users with the same DB config.
3. **Async job queue for AI calls**: Gemini calls can take 2-5 seconds. Under heavy load, a message queue (Bull + Redis) would allow the backend to accept requests, process AI calls asynchronously, and notify clients via WebSockets when ready.
4. **Horizontal scaling**: The Express app is stateless (aside from the Map). Moving state to Redis enables deploying multiple instances behind a load balancer.
5. **Database indexes**: Add indexes on `userId` for Connection and QueryHistory collections to speed up user-specific queries.
6. **CDN for file uploads**: Move uploaded Excel/CSV files to S3 instead of local disk, making the app server stateless.

---

## 14. Scalability, Performance & Production Readiness

### Q37. How does rate limiting protect your API?
**A:** `express-rate-limit` middleware tracks how many requests each IP makes in a 15-minute window. After 100 requests, it returns:

```json
{ "error": "Too many requests, please try again later." }
```

With `app.set('trust proxy', 1)`, Express trusts the `X-Forwarded-For` header from Render's load balancer to get the real client IP, not the proxy's IP (otherwise every user would appear as the same IP and rate-limiting would break).

This protects against:
- Brute-force attacks on `/api/auth/login`
- DDoS attacks that spam endpoints
- Excessive AI API usage triggered by a single bot

---

### Q38. How did you configure the backend for deployment?
**A:** The project includes:
- **`render.yaml`**: Infrastructure-as-code for one-click Render deployment, specifying `buildCommand: npm install`, `startCommand: npm start`, and env variable placeholders.
- **`Dockerfile`**: Multi-stage build for containerized deployment.
- **Environment variables**: All sensitive config (API keys, DB URI, JWT secret) are externalized via `.env`. The `config/` directory centralizes all env reading.
- **Health check endpoint**: `GET /api/health` returns status so Render/Railway can verify the server is running before routing traffic.
- **`trust proxy`**: Correctly configured for Render's proxy layer.
- **CORS origins**: Comma-separated `.env` value allows multiple production domains.

---

## 15. Tricky / Behavioral Questions

### Q39. What was the hardest technical challenge you faced in this project?
**A:** The hardest challenge was building the **Gemini conversation format adapter**. Gemini's chat API strictly requires alternating `user`/`model` roles. But our prompt construction naturally created consecutive `user` messages (schema, then semantic hints, then the actual question). 

A naïve implementation would trigger a Gemini API error. I debugged this by reading the API docs carefully, then wrote the merge algorithm that concatenates consecutive same-role messages with double newlines. I also had to handle the edge case where the "last message" needs to be sent separately via `chat.sendMessage()` vs `model.generateContent()` depending on whether there's history. This required careful testing with various conversation states.

---

### Q40. Did you make any mistakes in the project? What would you do differently?
**A:** A few honest reflections:
- **In-memory state**: Using a `Map` for active connections and chat history works for a single-server deployment but won't scale to multiple instances. I would use Redis from the start in a production system.
- **File connector query engine**: I built an in-memory query executor from scratch for Excel/CSV. This became complex. A better approach might be to load the CSV into an in-process SQLite database (which I'm already using for regular SQLite connections) and use SQL for querying.
- **Testing**: This project lacks automated unit/integration tests. For production, I'd add Jest tests for the connector logic, mock the Gemini API in tests, and use Supertest for API endpoint testing.

---

### Q41. How did you handle the case where the AI generates a query for the wrong table or misspells a column?
**A:** Two layers:
1. **Proactive (field mapping hints)**: `generateFieldMappingHints()` gives the AI explicit column-name → user-term mappings before it generates the query. This prevents most misspellings.
2. **Reactive (fixQuery)**: If execution fails with `"column 'fullname' doesn't exist"`, `fixQuery()` sends this error back to the AI. Gemini sees the exact error message and can infer the correct column name from the schema and error context.

The AI also returns a `confidence` score (0-1) with each query. Low-confidence queries could in theory trigger clarification requests (the `generateClarification()` function is built for this), though currently the auto-fix path handles most cases.

---

### Q42. How does the chat service maintain context for follow-up questions?
**A:** Each chat session maintains a `messages` array in the in-memory Map:
```javascript
chatHistory.set(chatSessionId, {
    connectionSessionId,
    messages: [ 
        { role: 'user', content: '...', timestamp, query, result },
        { role: 'assistant', content: '...', timestamp },
        ...
    ]
});
```

When processing a new message, the last 10 messages from this array are included in the Gemini prompt. For the AI call specifically, the last 6 messages are used (balancing context vs. token usage).

This means if a user asks "Show me all reviews" and then "Now filter for only 5-star ones", the second query is sent to Gemini with the context of the first — so Gemini understands "reviews" refers to the same table previously queried, and knows to add `WHERE rating = 5`.

---

### Q43. Why did you include a health check endpoint?
**A:** `GET /api/health` is a production best practice:
- **Deployment platforms** (Render, Railway, Kubernetes) use health checks to verify the server is alive before routing traffic. If the endpoint returns a non-200, traffic is diverted.
- **Monitoring tools** can ping this endpoint every minute to measure uptime and alert on failures.
- **Development convenience**: A quick `curl /api/health` tells you the server is running and what version is deployed without needing to test a real endpoint.

---

### Q44. What is the difference between a `connection session` and a `chat session`?
**A:** These are two separate but linked concepts:

- **Connection Session** (`connectionSessionId`): Created when the user connects to their database (`POST /api/db/connect`). Stores the live DB connector and cached schema. Lifetime: up to 30 minutes idle.
- **Chat Session** (`chatSessionId`): Created when the user starts a new conversation (`POST /api/chat/new`). Stores the message array for AI context. References the `connectionSessionId` it's associated with.

One connection session can have multiple chat sessions (user can start a "new conversation" without reconnecting). When the user disconnects from the DB, the connection session is destroyed, but chat history can still be viewed (though new queries won't work).

---

### Q45. What is your `getUserConnections` function not returning and why?
**A:** The function:
```javascript
return await Connection.find({ userId }).sort({ createdAt: -1 }).select('-password');
```

`.select('-password')` explicitly excludes the `password` field from results. This is a security measure — even though passwords should be excluded at the schema level for queries via `select: false`, this is a double-safety measure when returning lists of connections. Saved connection configs may include DB passwords, which should never be transmitted back to the client unnecessarily.

---

*This document covers all major aspects of the DataQuery Pro backend. For the interview, focus on being able to explain the end-to-end flow (Q4), the connector abstraction (Q16-Q17), the AI pipeline (Q20-Q23), and the session management pattern (Q25-Q26). These are the most technically interesting parts that demonstrate real backend engineering thinking.*
