# DataQuery Pro

A full-stack web application that allows users to connect their databases and query them using natural language. The application uses OpenAI's GPT-4 to translate English questions into executable database queries.

## Features

### Core Features
- **JWT Authentication** - Secure login/signup system with password hashing
- **Multiple Database Support**:
  - SQL Databases (MySQL, PostgreSQL, SQLite)
  - NoSQL (MongoDB)
  - File-based (Excel, CSV)
- **Natural Language Queries** - Ask questions in plain English
- **ChatGPT-style Interface** - Modern chat UI with conversation history
- **Schema Explorer** - Visual sidebar showing database structure
- **Query Auto-fixing** - Automatic error correction for failed queries
- **Export Results** - Download query results as CSV

### Technical Features
- **OpenAI API Direct Integration** - No LangChain dependency
- **Unified Connector Interface** - `connect()`, `getSchema()`, `runQuery()`, `close()`
- **Session-based Connections** - Credentials stored only in memory
- **Query Validation** - Prevents destructive operations by default

## Project Structure

```
DataBaseProject/
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── index.js           # Entry point
│   │   ├── config/            # Configuration
│   │   ├── controllers/       # Request handlers
│   │   ├── db_connectors/     # Database connectors
│   │   │   ├── BaseConnector.js
│   │   │   ├── SQLConnector.js
│   │   │   ├── MongoConnector.js
│   │   │   └── FileConnector.js
│   │   ├── middleware/        # Auth & error handling
│   │   ├── openai/            # OpenAI query translator
│   │   ├── routes/            # API routes
│   │   └── services/          # Business logic
│   ├── package.json
│   └── .env.example
│
└── frontend/                   # React frontend
    ├── src/
    │   ├── main.jsx           # Entry point
    │   ├── App.jsx            # Main app with routing
    │   ├── components/        # Reusable components
    │   │   ├── DBConnectionForm.jsx
    │   │   ├── MessageBubble.jsx
    │   │   ├── ResultTable.jsx
    │   │   └── Sidebar.jsx
    │   ├── context/           # React context providers
    │   │   ├── AuthContext.jsx
    │   │   └── ConnectionContext.jsx
    │   ├── pages/             # Page components
    │   │   ├── Login.jsx
    │   │   ├── Signup.jsx
    │   │   ├── Home.jsx
    │   │   └── ChatPage.jsx
    │   ├── services/          # API client
    │   └── styles/            # CSS styles
    ├── package.json
    └── vite.config.js
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your-openai-api-key-here
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

   The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app will open at `http://localhost:3000`

## API Endpoints

### Authentication
```
POST /api/auth/signup    - Register new user
POST /api/auth/login     - Login and get token
GET  /api/auth/me        - Get current user
POST /api/auth/logout    - Logout user
```

### Database Connections
```
POST /api/db/connect     - Connect to a database
GET  /api/db/schema      - Get database schema
POST /api/db/query       - Execute natural language query
POST /api/db/disconnect  - Disconnect from database
GET  /api/db/connections - List active connections
```

### Chat
```
POST /api/chat/new       - Create new chat session
GET  /api/chat/history   - Get chat history
GET  /api/chat/suggestions - Get query suggestions
POST /api/chat/clear     - Clear chat history
GET  /api/chat/export    - Export chat data
```

## Database Connector Interface

All connectors implement a unified interface:

```javascript
class BaseConnector {
  async connect()           // Establish connection
  async getSchema()         // Get database schema
  async runQuery(query)     // Execute query
  async close()             // Close connection
  formatSchemaForAI()       // Format schema for OpenAI
  validateQuery(query)      // Validate query safety
}
```

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-1106-preview
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

## Usage

1. **Sign Up/Login** - Create an account or login
2. **Connect Database** - Select your database type and enter connection details
3. **Ask Questions** - Type natural language questions in the chat
4. **View Results** - See formatted results in tables
5. **Export Data** - Download results as CSV

### Example Questions

For a SQL database with users and orders tables:
- "Show me all users who signed up this month"
- "What's the total revenue by product category?"
- "Find the top 10 customers by order count"

For Excel/CSV:
- "What's the average sales by region?"
- "Show rows where status is 'pending'"
- "Count how many entries have null values"

## Security Notes

- User passwords are hashed with bcrypt
- Database credentials are stored only in session memory
- JWT tokens expire after 24 hours
- Destructive queries (DROP, DELETE) are blocked by default
- File uploads are validated and size-limited

## Google OAuth Setup

To enable "Sign in with Google":

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Create an **OAuth 2.0 Client ID** (Web application)
5. Add authorized origins:
   - Development: `http://localhost:3000`
   - Production: Your frontend domain
6. Add authorized redirect URIs as needed
7. Copy the **Client ID** and **Client Secret**
8. Add to your `.env` files:

**Backend (.env):**
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Frontend (.env):**
```
VITE_GOOGLE_CLIENT_ID=your-client-id
```

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set environment variables:
   - `VITE_API_URL`: Your backend URL (e.g., `https://api.yourdomain.com/api`)
   - `VITE_GOOGLE_CLIENT_ID`: Your Google Client ID
4. Deploy

### Frontend (Netlify)

1. Push code to GitHub
2. Import project in [Netlify](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Set environment variables in Site Settings
6. Deploy

### Backend (Render)

1. Push code to GitHub
2. Create a new **Web Service** in [Render](https://render.com)
3. Connect your repository
4. Set environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `JWT_SECRET`: A secure random string
   - `MONGODB_URI`: Your MongoDB connection string
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GOOGLE_CLIENT_ID`: Your Google Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google Client Secret
   - `CORS_ORIGIN`: Your frontend URL
5. Deploy

### Backend (Docker)

```bash
cd backend
docker build -t dataquery-pro-backend .
docker run -p 5000:5000 --env-file .env dataquery-pro-backend
```

## Production Checklist

- [ ] Set strong `JWT_SECRET` (use `openssl rand -hex 32`)
- [ ] Configure CORS for your frontend domain
- [ ] Use MongoDB Atlas or managed database
- [ ] Enable HTTPS on both frontend and backend
- [ ] Set up proper error monitoring (Sentry, etc.)
- [ ] Configure rate limiting for production traffic

## License

MIT

