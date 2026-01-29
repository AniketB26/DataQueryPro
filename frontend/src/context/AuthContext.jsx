/**
 * Authentication Context
 * 
 * Provides authentication state and methods to the entire app.
 * Handles login, signup, logout, and persistent sessions.
 * 
 * Error notifications are now persistent and require manual dismissal.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useNotification } from './NotificationContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use persistent notifications for errors
  const { showError } = useNotification();

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Verify token is still valid
      authAPI.getMe()
        .then(response => {
          setUser(response.data.user);
        })
        .catch(() => {
          // Token invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Sign up a new user
   */
  const signup = async (email, password, username, fullName = '') => {
    try {
      const response = await authAPI.signup({
        email,
        password,
        username,
        fullName
      });
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Signup failed';
      // Use persistent error notification that requires manual dismissal
      showError(message);
      return { success: false, error: message };
    }
  };

  /**
   * Log in an existing user
   */
  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      toast.success('Welcome back!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      // Use persistent error notification that requires manual dismissal
      showError(message);
      return { success: false, error: message };
    }
  };

  /**
   * Log out the current user
   */
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Ignore errors, we're logging out anyway
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  /**
   * Login with Google OAuth
   * @param {string} idToken - Google ID token from Google Identity Services
   */
  const loginWithGoogle = async (idToken) => {
    try {
      const response = await authAPI.googleLogin(idToken);
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      toast.success('Welcome!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Google login failed';
      // Use persistent error notification
      showError(message);
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
