/**
 * Login Page Component
 * 
 * Handles user authentication with email/password and Google OAuth.
 * Error notifications are persistent and require manual dismissal.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiLogIn, FiDatabase } from 'react-icons/fi';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useNotification } from '../context/NotificationContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const { showError } = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    }
  };

  /**
   * Handle Google Sign-In success
   */
  const handleGoogleSuccess = async (idToken) => {
    setGoogleLoading(true);
    const result = await loginWithGoogle(idToken);
    setGoogleLoading(false);

    if (result.success) {
      navigate('/');
    }
  };

  /**
   * Handle Google Sign-In error
   */
  const handleGoogleError = (error) => {
    showError(error || 'Google sign-in failed');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="logo">
            <FiDatabase className="logo-icon" />
            <h1>DataQuery Pro</h1>
          </div>
          <p>Natural Language Database Queries</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Welcome Back</h2>

          {/* Google Sign-In Button */}
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            disabled={loading || googleLoading}
          />

          {/* Divider */}
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          <div className="form-group">
            <label htmlFor="email">
              <FiMail /> Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <FiLock /> Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || googleLoading}
          >
            {loading ? (
              <span className="spinner-small"></span>
            ) : (
              <>
                <FiLogIn /> Sign In
              </>
            )}
          </button>

          <p className="auth-footer">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
