/**
 * Database Connection Context
 * 
 * Provides database connection state and methods to the app.
 * Manages active connection, schema, and chat sessions.
 * Persists state to localStorage for page reload survival.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { dbAPI, chatAPI } from '../services/api';
import toast from 'react-hot-toast';

const ConnectionContext = createContext(null);

// Storage keys
const STORAGE_KEYS = {
  SESSION_ID: 'dataquery_sessionId',
  CHAT_SESSION_ID: 'dataquery_chatSessionId',
  DB_TYPE: 'dataquery_dbType',
  SCHEMA: 'dataquery_schema',
  IS_CONNECTED: 'dataquery_isConnected',
  MESSAGES: 'dataquery_messages',
};

// Helper to safely get from localStorage
const getStoredValue = (key, defaultValue = null) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
};

// Helper to safely set to localStorage
const setStoredValue = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

// Helper to clear all stored values
const clearStoredValues = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

export function ConnectionProvider({ children }) {
  // Connection state - restore from localStorage
  const [sessionId, setSessionId] = useState(() => getStoredValue(STORAGE_KEYS.SESSION_ID));
  const [chatSessionId, setChatSessionId] = useState(() => getStoredValue(STORAGE_KEYS.CHAT_SESSION_ID));
  const [dbType, setDbType] = useState(() => getStoredValue(STORAGE_KEYS.DB_TYPE));
  const [schema, setSchema] = useState(() => getStoredValue(STORAGE_KEYS.SCHEMA));
  const [isConnected, setIsConnected] = useState(() => getStoredValue(STORAGE_KEYS.IS_CONNECTED, false));
  const [connecting, setConnecting] = useState(false);

  // Chat state - restore messages from localStorage
  const [messages, setMessages] = useState(() => getStoredValue(STORAGE_KEYS.MESSAGES, []));
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Persist state changes to localStorage
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.SESSION_ID, sessionId);
  }, [sessionId]);

  useEffect(() => {
    setStoredValue(STORAGE_KEYS.CHAT_SESSION_ID, chatSessionId);
  }, [chatSessionId]);

  useEffect(() => {
    setStoredValue(STORAGE_KEYS.DB_TYPE, dbType);
  }, [dbType]);

  useEffect(() => {
    setStoredValue(STORAGE_KEYS.SCHEMA, schema);
  }, [schema]);

  useEffect(() => {
    setStoredValue(STORAGE_KEYS.IS_CONNECTED, isConnected);
  }, [isConnected]);

  useEffect(() => {
    setStoredValue(STORAGE_KEYS.MESSAGES, messages);
  }, [messages]);

  /**
   * Connect to a database
   */
  const connect = useCallback(async (type, config, file = null) => {
    setConnecting(true);
    try {
      const response = await dbAPI.connect(type, config, file);
      const { sessionId: newSessionId, schema: newSchema, dbType: connectedDbType } = response.data;

      setSessionId(newSessionId);
      setDbType(connectedDbType);
      setSchema(newSchema);
      setIsConnected(true);

      // Create a new chat session
      const chatResponse = await chatAPI.createSession(newSessionId);
      setChatSessionId(chatResponse.data.chatSessionId);

      // Reset messages for new connection
      setMessages([]);

      toast.success('Connected to database successfully!');
      return { success: true, sessionId: newSessionId };
    } catch (error) {
      const message = error.response?.data?.error || 'Connection failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setConnecting(false);
    }
  }, []);

  /**
   * Disconnect from the current database
   */
  const disconnect = useCallback(async () => {
    if (!sessionId) return;

    try {
      await dbAPI.disconnect(sessionId);
      toast.success('Disconnected successfully');
    } catch (error) {
      // Ignore errors on disconnect
    } finally {
      // Clear state
      setSessionId(null);
      setChatSessionId(null);
      setDbType(null);
      setSchema(null);
      setIsConnected(false);
      setMessages([]);
      setSuggestions([]);
      // Clear localStorage
      clearStoredValues();
    }
  }, [sessionId]);

  /**
   * Send a natural language query
   */
  const sendQuery = useCallback(async (message) => {
    if (!sessionId) {
      toast.error('No active database connection');
      return { success: false, error: 'Not connected' };
    }

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await dbAPI.query(sessionId, message, chatSessionId);
      const data = response.data;

      // Update chat session ID if returned
      if (data.chatSessionId && data.chatSessionId !== chatSessionId) {
        setChatSessionId(data.chatSessionId);
      }

      // Add assistant message to chat
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        query: data.query,
        queryExplanation: data.queryExplanation,
        result: data.result,
        error: data.error,
        wasFixed: data.wasFixed,
      };
      setMessages(prev => [...prev, assistantMessage]);

      return { success: data.success, data };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Query failed';

      // Add error message to chat
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        error: true,
      };
      setMessages(prev => [...prev, errorMsg]);

      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [sessionId, chatSessionId]);

  /**
   * Load query suggestions
   */
  const loadSuggestions = useCallback(async () => {
    if (!sessionId) return;

    setLoadingSuggestions(true);
    try {
      const response = await chatAPI.getSuggestions(sessionId);
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [sessionId]);

  /**
   * Clear chat history
   */
  const clearChat = useCallback(async () => {
    if (chatSessionId) {
      try {
        await chatAPI.clearHistory(chatSessionId);
      } catch (error) {
        // Ignore errors
      }
    }
    setMessages([]);
    toast.success('Chat history cleared');
  }, [chatSessionId]);

  /**
   * Start a new chat session
   */
  const newChat = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await chatAPI.createSession(sessionId);
      setChatSessionId(response.data.chatSessionId);
      setMessages([]);
    } catch (error) {
      toast.error('Failed to create new chat session');
    }
  }, [sessionId]);

  const value = {
    // Connection state
    sessionId,
    chatSessionId,
    dbType,
    schema,
    isConnected,
    connecting,

    // Chat state
    messages,
    suggestions,
    loadingSuggestions,

    // Methods
    connect,
    disconnect,
    sendQuery,
    loadSuggestions,
    clearChat,
    newChat,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

/**
 * Hook to use connection context
 */
export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}
