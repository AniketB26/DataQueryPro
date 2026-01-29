/**
 * API Service
 * 
 * Centralized API client using Axios.
 * Handles authentication headers and error responses.
 */

import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - clear token and redirect
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============== Authentication API ==============

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (idToken) => api.post('/auth/google', { idToken }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data),
};

// ============== Database Connection API ==============

export const dbAPI = {
  /**
   * Connect to a database
   * @param {string} dbType - Database type
   * @param {Object} config - Connection configuration
   * @param {File} file - Optional file for Excel/CSV
   */
  connect: async (dbType, config, file = null) => {
    if (file) {
      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('dbType', dbType);
      formData.append('config', JSON.stringify(config));
      formData.append('file', file);

      return api.post('/db/connect', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    }

    return api.post('/db/connect', { dbType, config });
  },

  getSchema: (sessionId) => api.get(`/db/schema?sessionId=${sessionId}`),

  disconnect: (sessionId) => api.post('/db/disconnect', { sessionId }),

  getConnections: () => api.get('/db/connections'),

  /**
   * Execute a natural language query
   */
  query: (sessionId, message, chatSessionId = null) =>
    api.post('/db/query', { sessionId, message, chatSessionId }),
};

// ============== Chat API ==============

export const chatAPI = {
  createSession: (sessionId) => api.post('/chat/new', { sessionId }),

  getHistory: (chatSessionId) => api.get(`/chat/history?chatSessionId=${chatSessionId}`),

  getSuggestions: (sessionId) => api.get(`/chat/suggestions?sessionId=${sessionId}`),

  clearHistory: (chatSessionId) => api.post('/chat/clear', { chatSessionId }),

  exportChat: (chatSessionId) => api.get(`/chat/export?chatSessionId=${chatSessionId}`),
};

export default api;
