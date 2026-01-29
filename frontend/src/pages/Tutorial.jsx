/**
 * Tutorial Page Component
 * 
 * Database connection tutorials and guides
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FiDatabase, FiHome, FiUser, FiBriefcase, FiBook,
  FiChevronDown, FiChevronRight, FiCheck, FiCopy,
  FiServer, FiFileText, FiCloud, FiTerminal
} from 'react-icons/fi';
import { SiMysql, SiPostgresql, SiMongodb, SiSqlite } from 'react-icons/si';
import toast from 'react-hot-toast';

function Tutorial() {
  const { user } = useAuth();
  const [activeDb, setActiveDb] = useState('mysql');

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const databases = [
    {
      id: 'mysql',
      name: 'MySQL',
      icon: SiMysql,
      color: '#4479A1',
      description: 'Popular open-source relational database management system',
      fields: [
        { name: 'Host', example: 'localhost or your-server.com', required: true },
        { name: 'Port', example: '3306 (default)', required: true },
        { name: 'Database', example: 'your_database_name', required: true },
        { name: 'Username', example: 'your_username', required: true },
        { name: 'Password', example: 'your_password', required: true },
      ],
      exampleConnection: `{
  "host": "localhost",
  "port": 3306,
  "database": "my_database",
  "user": "root",
  "password": "your_password"
}`,
      tips: [
        'Ensure MySQL server is running',
        'Default port is 3306',
        'For remote connections, whitelist your IP in MySQL',
        'Use SSL for production environments'
      ]
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL',
      icon: SiPostgresql,
      color: '#336791',
      description: 'Advanced open-source relational database with powerful features',
      fields: [
        { name: 'Host', example: 'localhost or your-server.com', required: true },
        { name: 'Port', example: '5432 (default)', required: true },
        { name: 'Database', example: 'your_database_name', required: true },
        { name: 'Username', example: 'your_username', required: true },
        { name: 'Password', example: 'your_password', required: true },
      ],
      exampleConnection: `{
  "host": "localhost",
  "port": 5432,
  "database": "my_database",
  "user": "postgres",
  "password": "your_password"
}`,
      tips: [
        'Default port is 5432',
        'Check pg_hba.conf for connection permissions',
        'PostgreSQL supports schemas - specify if needed',
        'Use connection pooling for better performance'
      ]
    },
    {
      id: 'mongodb',
      name: 'MongoDB',
      icon: SiMongodb,
      color: '#47A248',
      description: 'NoSQL document database for flexible, scalable applications',
      fields: [
        { name: 'Connection String', example: 'mongodb://localhost:27017/mydb', required: true },
        { name: 'Database', example: 'your_database_name', required: true },
      ],
      exampleConnection: `{
  "connectionString": "mongodb://localhost:27017",
  "database": "my_database"
}

// Or with authentication:
{
  "connectionString": "mongodb://user:pass@localhost:27017",
  "database": "my_database"
}`,
      tips: [
        'Default port is 27017',
        'For MongoDB Atlas, use the connection string from dashboard',
        'Include authentication in the connection string',
        'Specify the database name separately'
      ]
    },
    {
      id: 'sqlite',
      name: 'SQLite',
      icon: SiSqlite,
      color: '#003B57',
      description: 'Lightweight, file-based SQL database engine',
      fields: [
        { name: 'Database File', example: 'path/to/database.db', required: true },
      ],
      exampleConnection: `{
  "filename": "./data/my_database.db"
}`,
      tips: [
        'SQLite databases are single files',
        'No server installation required',
        'Great for development and small applications',
        'Ensure file path is accessible to the application'
      ]
    },
    {
      id: 'excel',
      name: 'Excel',
      icon: FiFileText,
      color: '#217346',
      description: 'Microsoft Excel spreadsheets (.xlsx, .xls)',
      fields: [
        { name: 'File Upload', example: 'Select your .xlsx or .xls file', required: true },
      ],
      exampleConnection: `Simply upload your Excel file through the connection form.

Supported formats:
- .xlsx (Excel 2007+)
- .xls (Excel 97-2003)`,
      tips: [
        'First row should contain column headers',
        'Each sheet will be treated as a table',
        'Clean your data before uploading',
        'Large files may take longer to process'
      ]
    },
    {
      id: 'csv',
      name: 'CSV',
      icon: FiFileText,
      color: '#FF6B6B',
      description: 'Comma-separated values files',
      fields: [
        { name: 'File Upload', example: 'Select your .csv file', required: true },
      ],
      exampleConnection: `Simply upload your CSV file through the connection form.

Supported formats:
- .csv (Comma-separated values)`,
      tips: [
        'First row should contain column headers',
        'Ensure consistent data types in columns',
        'UTF-8 encoding is recommended',
        'Escape special characters properly'
      ]
    },
  ];

  const activeDatabase = databases.find(db => db.id === activeDb);

  return (
    <div className="tutorial-page">
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <FiDatabase className="logo-icon" />
            <span>DataQuery Pro</span>
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-link">
              <FiHome /> Home
            </Link>
            {user && (
              <Link to="/work" className="nav-link">
                <FiBriefcase /> Work
              </Link>
            )}
            <Link to="/tutorial" className="nav-link active">
              <FiBook /> Tutorial
            </Link>
            {user ? (
              <Link to="/profile" className="nav-link">
                <FiUser /> Profile
              </Link>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="tutorial-container">
        {/* Hero Section */}
        <div className="tutorial-hero">
          <h1>Database Connection Tutorials</h1>
          <p>Learn how to connect DataQuery Pro to your favorite databases</p>
        </div>

        {/* Database Selector */}
        <div className="db-selector">
          {databases.map(db => (
            <button
              key={db.id}
              className={`db-selector-btn ${activeDb === db.id ? 'active' : ''}`}
              onClick={() => setActiveDb(db.id)}
              style={{ '--db-color': db.color }}
            >
              <db.icon style={{ color: db.color }} />
              <span>{db.name}</span>
            </button>
          ))}
        </div>

        {/* Tutorial Content */}
        {activeDatabase && (
          <div className="tutorial-content">
            {/* Database Header */}
            <div className="db-header" style={{ borderColor: activeDatabase.color }}>
              <activeDatabase.icon className="db-icon" style={{ color: activeDatabase.color }} />
              <div>
                <h2>{activeDatabase.name}</h2>
                <p>{activeDatabase.description}</p>
              </div>
            </div>

            {/* Connection Fields */}
            <section className="tutorial-section">
              <h3>Required Connection Fields</h3>
              <div className="fields-table">
                <div className="fields-header">
                  <span>Field</span>
                  <span>Example</span>
                  <span>Required</span>
                </div>
                {activeDatabase.fields.map((field, index) => (
                  <div key={index} className="fields-row">
                    <span className="field-name">{field.name}</span>
                    <span className="field-example">{field.example}</span>
                    <span className="field-required">
                      {field.required ? <FiCheck className="check" /> : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Example Connection */}
            <section className="tutorial-section">
              <h3>Example Configuration</h3>
              <div className="code-block">
                <button 
                  className="copy-btn"
                  onClick={() => copyToClipboard(activeDatabase.exampleConnection)}
                >
                  <FiCopy /> Copy
                </button>
                <pre><code>{activeDatabase.exampleConnection}</code></pre>
              </div>
            </section>

            {/* Tips */}
            <section className="tutorial-section">
              <h3>Tips & Best Practices</h3>
              <ul className="tips-list">
                {activeDatabase.tips.map((tip, index) => (
                  <li key={index}>
                    <FiCheck className="tip-icon" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Getting Started */}
            <section className="tutorial-section">
              <h3>Getting Started</h3>
              <div className="steps-list">
                <div className="step-item">
                  <div className="step-num">1</div>
                  <div className="step-content">
                    <h4>Navigate to Work Page</h4>
                    <p>Go to the Work page by clicking "Work" in the navigation or the button below.</p>
                  </div>
                </div>
                <div className="step-item">
                  <div className="step-num">2</div>
                  <div className="step-content">
                    <h4>Select {activeDatabase.name}</h4>
                    <p>Click on the {activeDatabase.name} card in the database selection grid.</p>
                  </div>
                </div>
                <div className="step-item">
                  <div className="step-num">3</div>
                  <div className="step-content">
                    <h4>Enter Connection Details</h4>
                    <p>Fill in the required fields with your database credentials.</p>
                  </div>
                </div>
                <div className="step-item">
                  <div className="step-num">4</div>
                  <div className="step-content">
                    <h4>Connect & Query</h4>
                    <p>Click "Connect" and start asking questions about your data!</p>
                  </div>
                </div>
              </div>
            </section>

            {/* CTA */}
            <div className="tutorial-cta">
              {user ? (
                <Link to="/work" className="btn btn-primary btn-lg">
                  Connect to {activeDatabase.name} <FiChevronRight />
                </Link>
              ) : (
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Sign Up to Get Started <FiChevronRight />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Tutorial;
