/**
 * Signup Page Component
 * 
 * Handles new user registration with email/password and Google OAuth.
 * Error notifications are persistent and require manual dismissal.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiUserPlus, FiDatabase } from 'react-icons/fi';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useNotification } from '../context/NotificationContext';

function Signup() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup, loginWithGoogle } = useAuth();
  const { showError } = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await signup(email, password, username, name);
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
    showError(error || 'Google sign-up failed');
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
          <h2>Create Account</h2>

          {/* Google Sign-Up Button */}
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            disabled={loading || googleLoading}
          />

          {/* Divider */}
          <div className="auth-divider">
            <span>or sign up with email</span>
          </div>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">
              <FiUser /> Full Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">
              <FiUser /> Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
            />
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
              placeholder="Create a password (min 6 characters)"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              <FiLock /> Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
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
                <FiUserPlus /> Create Account
              </>
            )}
          </button>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Signup;
