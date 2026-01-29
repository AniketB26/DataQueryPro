/**
 * Home Page Component
 * 
 * Database connection selection and configuration.
 * Displays all supported data source types and connection forms.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import DBConnectionForm from '../components/DBConnectionForm';
import { 
  FiDatabase, FiFileText, FiServer, FiLogOut, 
  FiGrid, FiHardDrive, FiCloud 
} from 'react-icons/fi';
import { SiMysql, SiPostgresql, SiMongodb, SiSqlite } from 'react-icons/si';

// Database type configurations
const DB_TYPES = [
  {
    id: 'mysql',
    name: 'MySQL',
    description: 'Popular open-source relational database',
    icon: SiMysql,
    color: '#4479A1',
    category: 'sql',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description: 'Advanced open-source relational database',
    icon: SiPostgresql,
    color: '#336791',
    category: 'sql',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Lightweight file-based SQL database',
    icon: SiSqlite,
    color: '#003B57',
    category: 'sql',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'NoSQL document database',
    icon: SiMongodb,
    color: '#47A248',
    category: 'nosql',
  },
  {
    id: 'excel',
    name: 'Excel',
    description: 'Microsoft Excel spreadsheets (.xlsx, .xls)',
    icon: FiFileText,
    color: '#217346',
    category: 'file',
  },
  {
    id: 'csv',
    name: 'CSV',
    description: 'Comma-separated values files',
    icon: FiGrid,
    color: '#FF6B6B',
    category: 'file',
  },
];

function Home() {
  const [selectedDB, setSelectedDB] = useState(null);
  const { user, logout } = useAuth();
  const { connect, connecting, isConnected } = useConnection();
  const navigate = useNavigate();

  // If already connected, redirect to chat
  React.useEffect(() => {
    if (isConnected) {
      navigate('/chat');
    }
  }, [isConnected, navigate]);

  const handleDBSelect = (dbType) => {
    setSelectedDB(dbType);
  };

  const handleConnect = async (config, file) => {
    const result = await connect(selectedDB.id, config, file);
    if (result.success) {
      navigate('/chat');
    }
  };

  const handleCancel = () => {
    setSelectedDB(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="logo">
          <FiDatabase className="logo-icon" />
          <h1>DataQuery Pro</h1>
        </div>
        <div className="header-right">
          <span className="user-greeting">Hello, {user?.fullName || user?.username}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        {!selectedDB ? (
          <>
            <div className="home-intro">
              <h2>Connect Your Data Source</h2>
              <p>
                Select a database or file type to connect. Once connected, 
                you can ask questions in plain English and get instant answers.
              </p>
            </div>

            {/* Database Categories */}
            <div className="db-categories">
              {/* SQL Databases */}
              <section className="db-category">
                <h3>
                  <FiServer /> SQL Databases
                </h3>
                <div className="db-grid">
                  {DB_TYPES.filter(db => db.category === 'sql').map(db => (
                    <button
                      key={db.id}
                      className="db-card"
                      onClick={() => handleDBSelect(db)}
                    >
                      <db.icon 
                        className="db-icon" 
                        style={{ color: db.color }} 
                      />
                      <h4>{db.name}</h4>
                      <p>{db.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* NoSQL Databases */}
              <section className="db-category">
                <h3>
                  <FiCloud /> NoSQL Databases
                </h3>
                <div className="db-grid">
                  {DB_TYPES.filter(db => db.category === 'nosql').map(db => (
                    <button
                      key={db.id}
                      className="db-card"
                      onClick={() => handleDBSelect(db)}
                    >
                      <db.icon 
                        className="db-icon" 
                        style={{ color: db.color }} 
                      />
                      <h4>{db.name}</h4>
                      <p>{db.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* File-based */}
              <section className="db-category">
                <h3>
                  <FiHardDrive /> File-Based Data
                </h3>
                <div className="db-grid">
                  {DB_TYPES.filter(db => db.category === 'file').map(db => (
                    <button
                      key={db.id}
                      className="db-card"
                      onClick={() => handleDBSelect(db)}
                    >
                      <db.icon 
                        className="db-icon" 
                        style={{ color: db.color }} 
                      />
                      <h4>{db.name}</h4>
                      <p>{db.description}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="connection-form-container">
            <DBConnectionForm
              dbType={selectedDB}
              onConnect={handleConnect}
              onCancel={handleCancel}
              loading={connecting}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default Home;
