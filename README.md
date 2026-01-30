# DataQuery Pro

A full-stack web application that allows users to connect their databases and query them using natural language. The application uses **Groq AI (LLaMA 3.3 70B)** to translate English questions into executable database queries.

## Features

### Core Features
- **User Authentication** - JWT-based login/signup with password hashing + Google OAuth Sign-In
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
- **Groq AI Integration** - Fast LLaMA 3.3 70B inference via Groq API
- **MongoDB Atlas** - Cloud-based user persistence
- **Unified Connector Interface** - `connect()`, `getSchema()`, `runQuery()`, `close()`
- **Session-based Connections** - Database credentials stored only in memory
- **Query Validation** - Prevents destructive operations by default

## Project Structure

```
DataBaseProject/
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── index.js           # Entry point
│   │   ├── config/            # Configuration
│   │   ├── controllers/       # Request handlers
│   │   ├── db/                # MongoDB connection
│   │   ├── db_connectors/     # Database connectors
│   │   │   ├── BaseConnector.js
│   │   │   ├── SQLConnector.js
│   │   │   ├── MongoConnector.js
│   │   │   └── FileConnector.js
│   │   ├── middleware/        # Auth & error handling
│   │   ├── models/            # Mongoose models (User, etc.)
│   │   ├── routes/            # API routes
│   │   └── services/          # Business logic (auth, AI)
│   ├── package.json
│   └── .env.example
│
└── frontend/                   # React + Vite frontend
    ├── src/
    │   ├── main.jsx           # Entry point
    │   ├── App.jsx            # Main app with routing
    │   ├── components/        # Reusable components
    │   ├── context/           # React context providers
    │   ├── pages/             # Page components
    │   ├── services/          # API client
    │   └── styles/            # CSS styles
    ├── package.json
    └── vite.config.js
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Groq API key (free at [console.groq.com](https://console.groq.com/keys))
- MongoDB Atlas account (free tier available)

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

4. Edit `.env` and configure:
   ```env
   # Groq AI (REQUIRED)
   GROQ_API_KEY=your-groq-api-key-here
   
   # MongoDB Atlas (REQUIRED)
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/DataQueryPro
   
   # Google OAuth (for Google Sign-In)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
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

3. Create `.env` file:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The app will open at `http://localhost:3000`

## API Endpoints

### Authentication
```
POST /api/auth/signup    - Register new user
POST /api/auth/login     - Login and get token
POST /api/auth/google    - Google OAuth login
GET  /api/auth/me        - Get current user
POST /api/auth/logout    - Logout user
PUT  /api/auth/profile   - Update user profile
PUT  /api/auth/password  - Change password
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

## Environment Variables

### Backend (.env)
```env
# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# Groq AI (REQUIRED)
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile

# MongoDB Atlas (REQUIRED)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/DataQueryPro

# File Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# CORS
CORS_ORIGIN=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Usage

1. **Sign Up/Login** - Create an account or sign in with Google
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

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Create an **OAuth 2.0 Client ID** (Web application)
5. Add authorized origins:
   - Development: `http://localhost:3000`
   - Production: Your frontend domain
6. Copy the **Client ID** and **Client Secret**
7. Add to your `.env` files (both backend and frontend)

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set root directory to `frontend`
4. Set environment variables:
   - `VITE_API_URL`: Your backend URL
   - `VITE_GOOGLE_CLIENT_ID`: Your Google Client ID
5. Deploy

### Frontend (Netlify)

1. Push code to GitHub
2. Import project in [Netlify](https://netlify.com)
3. Base directory: `frontend`
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Set environment variables in Site Settings
7. Deploy

### Backend (Railway) ⭐ Recommended

Railway provides easy Node.js deployment with free tier.

1. Push code to GitHub
2. Go to [Railway](https://railway.app) and create new project
3. Select **Deploy from GitHub repo**
4. Choose your repository and select `backend` folder as root
5. Railway will auto-detect Node.js
6. Add environment variables in the **Variables** tab:
   ```
   NODE_ENV=production
   PORT=5000
   JWT_SECRET=your-secure-random-string
   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/DataQueryPro
   GROQ_API_KEY=your-groq-api-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   CORS_ORIGIN=https://your-frontend-domain.vercel.app
   ```
7. Deploy and copy the generated Railway URL
8. Update your frontend's `VITE_API_URL` to use the Railway URL

### Backend (Render)

1. Push code to GitHub
2. Create a new **Web Service** in [Render](https://render.com)
3. Connect your repository
4. Root directory: `backend`
5. Build command: `npm install`
6. Start command: `npm start`
7. Set environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `JWT_SECRET`: A secure random string
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `GROQ_API_KEY`: Your Groq API key
   - `GOOGLE_CLIENT_ID`: Your Google Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google Client Secret
   - `CORS_ORIGIN`: Your frontend URL
8. Deploy

### Backend (Docker)

```bash
cd backend
docker build -t dataquery-pro-backend .
docker run -p 5000:5000 --env-file .env dataquery-pro-backend
```

## Production Checklist

- [x] Use MongoDB Atlas for cloud database
- [x] Configure Groq AI for query generation
- [ ] Set strong `JWT_SECRET` (use `openssl rand -hex 32`)
- [ ] Configure CORS for your frontend domain
- [ ] Enable HTTPS on both frontend and backend
- [ ] Set up proper error monitoring (Sentry, etc.)
- [ ] Configure rate limiting for production traffic
- [ ] Update Google OAuth authorized origins for production

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express |
| Database | MongoDB Atlas (users), Any SQL/NoSQL (queries) |
| AI | Groq API (LLaMA 3.3 70B) |
| Auth | JWT, bcrypt, Google OAuth |

## License

MIT
