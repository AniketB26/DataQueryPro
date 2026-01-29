/**
 * Landing Page Component
 * 
 * Public home page showcasing the application features
 */

import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import {
  FiDatabase, FiMessageSquare, FiZap, FiShield,
  FiCode, FiTrendingUp, FiCheck, FiArrowRight,
  FiServer, FiFileText, FiCloud
} from 'react-icons/fi';
import { SiMysql, SiPostgresql, SiMongodb, SiSqlite } from 'react-icons/si';

function Landing() {
  const { user } = useAuth();
  const { isConnected } = useConnection();
  const navigate = useNavigate();

  // Redirect to chat if already connected (restores session after reload)
  useEffect(() => {
    if (user && isConnected) {
      navigate('/chat');
    }
  }, [user, isConnected, navigate]);

  const features = [
    {
      icon: FiMessageSquare,
      title: 'Natural Language Queries',
      description: 'Ask questions in plain English and get instant SQL/NoSQL queries generated automatically.'
    },
    {
      icon: FiDatabase,
      title: 'Multiple Database Support',
      description: 'Connect to MySQL, PostgreSQL, MongoDB, SQLite, Excel files, and CSV data sources.'
    },
    {
      icon: FiZap,
      title: 'Instant Results',
      description: 'Get real-time query results with beautiful data visualization and export options.'
    },
    {
      icon: FiShield,
      title: 'Secure Connections',
      description: 'Your database credentials are encrypted and never stored on our servers.'
    },
    {
      icon: FiCode,
      title: 'Query History',
      description: 'Track all your queries with full history, export to JSON or SQL formats.'
    },
    {
      icon: FiTrendingUp,
      title: 'AI-Powered Insights',
      description: 'Get intelligent suggestions and optimize your database queries automatically.'
    }
  ];

  const databases = [
    { icon: SiMysql, name: 'MySQL', color: '#4479A1' },
    { icon: SiPostgresql, name: 'PostgreSQL', color: '#336791' },
    { icon: SiMongodb, name: 'MongoDB', color: '#47A248' },
    { icon: SiSqlite, name: 'SQLite', color: '#003B57' },
    { icon: FiFileText, name: 'Excel', color: '#217346' },
    { icon: FiFileText, name: 'CSV', color: '#FF6B6B' },
  ];

  const howItWorks = [
    { step: 1, title: 'Connect', description: 'Connect to your database with secure credentials' },
    { step: 2, title: 'Ask', description: 'Type your question in plain English' },
    { step: 3, title: 'Get Results', description: 'Receive instant query results and insights' },
  ];

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo">
            <FiDatabase className="logo-icon" />
            <span>DataQuery Pro</span>
          </Link>
          <div className="landing-nav-links">
            <Link to="/tutorial" className="nav-link">Tutorial</Link>
            {user ? (
              <>
                <Link to="/work" className="nav-link">Dashboard</Link>
                <Link to="/profile" className="btn btn-primary">
                  Profile
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Login</Link>
                <Link to="/signup" className="btn btn-primary">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <h1>Query Your Database with <span className="gradient-text">Natural Language</span></h1>
          <p className="hero-subtitle">
            Transform how you interact with your data. Ask questions in plain English
            and let AI generate the perfect queries for you. No SQL expertise required.
          </p>
          <div className="hero-buttons">
            {user ? (
              <Link to="/work" className="btn btn-primary btn-lg">
                Go to Dashboard <FiArrowRight />
              </Link>
            ) : (
              <>
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Start Free Trial <FiArrowRight />
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg">
                  Sign In
                </Link>
              </>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-number">10K+</span>
              <span className="stat-label">Queries Generated</span>
            </div>
            <div className="stat">
              <span className="stat-number">500+</span>
              <span className="stat-label">Active Users</span>
            </div>
            <div className="stat">
              <span className="stat-number">99.9%</span>
              <span className="stat-label">Uptime</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="query-demo">
            <div className="demo-input">
              <FiMessageSquare />
              <span>"Show me all customers who made purchases last month"</span>
            </div>
            <div className="demo-arrow">↓</div>
            <div className="demo-output">
              <code>
                SELECT * FROM customers<br />
                WHERE purchase_date &gt;= DATE_SUB(NOW(), INTERVAL 1 MONTH);
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Databases */}
      <section className="landing-databases">
        <h2>Connect to Any Data Source</h2>
        <div className="database-grid">
          {databases.map((db, index) => (
            <div key={index} className="database-item">
              <db.icon style={{ color: db.color }} />
              <span>{db.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <div className="section-header">
          <h2>Powerful Features for Modern Data Teams</h2>
          <p>Everything you need to explore, query, and understand your data</p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">
                <feature.icon />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how-it-works">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>Get started in three simple steps</p>
        </div>
        <div className="steps-container">
          {howItWorks.map((item, index) => (
            <div key={index} className="step-card">
              <div className="step-number">{item.step}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta">
        <div className="cta-content">
          <h2>Ready to Transform Your Data Workflow?</h2>
          <p>Join thousands of developers and data analysts who are already using DataQuery Pro</p>
          {user ? (
            <Link to="/work" className="btn btn-primary btn-lg">
              Go to Dashboard <FiArrowRight />
            </Link>
          ) : (
            <Link to="/signup" className="btn btn-primary btn-lg">
              Get Started Free <FiArrowRight />
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <FiDatabase className="logo-icon" />
            <span>DataQuery Pro</span>
          </div>
          <div className="footer-links">
            <Link to="/tutorial">Tutorial</Link>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>
          </div>
          <p className="footer-copyright">© 2026 DataQuery Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
