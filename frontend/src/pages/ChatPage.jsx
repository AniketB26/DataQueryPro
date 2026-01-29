/**
 * Chat Page Component
 * 
 * Main query interface with sidebar showing schema and chat area.
 * Similar to ChatGPT UI for natural language database queries.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import Sidebar from '../components/Sidebar';
import MessageBubble from '../components/MessageBubble';
import ResultTable from '../components/ResultTable';
import {
  FiSend, FiDatabase, FiLogOut, FiMenu,
  FiX, FiTrash2, FiDownload, FiPlus
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function ChatPage() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { user, logout } = useAuth();
  const {
    isConnected,
    dbType,
    schema,
    messages,
    suggestions,
    sendQuery,
    disconnect,
    clearChat,
    newChat,
    loadSuggestions,
    loadingSuggestions
  } = useConnection();
  const navigate = useNavigate();

  // Redirect if not connected (removed - now allows staying on page with reconnect option)
  // The connection state is persisted in localStorage, so reload should restore it
  // Only navigate away if user explicitly disconnects

  // Load suggestions on mount
  useEffect(() => {
    if (isConnected && suggestions.length === 0) {
      loadSuggestions();
    }
  }, [isConnected, loadSuggestions, suggestions.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const query = input.trim();
    if (!query || sending) return;

    setInput('');
    setSending(true);

    await sendQuery(query);

    setSending(false);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion.question);
    inputRef.current?.focus();
  };

  const handleDisconnect = async () => {
    await disconnect();
    navigate('/');
  };

  const handleLogout = async () => {
    await disconnect();
    await logout();
    navigate('/login');
  };

  const handleExport = () => {
    // Export messages as JSON
    const exportData = {
      exportedAt: new Date().toISOString(),
      dbType,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        query: m.query,
        timestamp: m.timestamp,
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported successfully');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show reconnection prompt if not connected
  if (!isConnected) {
    return (
      <div className="chat-page">
        <div className="chat-reconnect">
          <h2>Connection Required</h2>
          <p>Please connect to a database to continue.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go to Connection Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        schema={schema}
        dbType={dbType}
      />

      {/* Main Chat Area */}
      <div className={`chat-main ${sidebarOpen ? '' : 'sidebar-closed'}`}>
        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            <button
              className="btn btn-icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <FiX /> : <FiMenu />}
            </button>
            <div className="logo">
              <FiDatabase className="logo-icon" />
              <span>DataQuery Pro</span>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-ghost"
              onClick={newChat}
              title="New chat"
            >
              <FiPlus /> New Chat
            </button>
            <button
              className="btn btn-ghost"
              onClick={clearChat}
              title="Clear chat"
            >
              <FiTrash2 />
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleExport}
              title="Export chat"
            >
              <FiDownload />
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleDisconnect}
              title="Disconnect"
            >
              Disconnect
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleLogout}
              title="Logout"
            >
              <FiLogOut />
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <h2>Ask questions about your data</h2>
              <p>
                Type a question in plain English and I'll translate it into a database query,
                execute it, and show you the results.
              </p>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="suggestions">
                  <h3>Try these questions:</h3>
                  <div className="suggestion-list">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="suggestion-card"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <span className="suggestion-question">
                          {suggestion.question}
                        </span>
                        <span className="suggestion-description">
                          {suggestion.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loadingSuggestions && (
                <div className="suggestions-loading">
                  <div className="spinner-small"></div>
                  <span>Loading suggestions...</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className="message-wrapper">
                  <MessageBubble message={message} />

                  {/* Show result table if available (only for read queries with array data) */}
                  {message.result &&
                    Array.isArray(message.result.data) &&
                    message.result.data.length > 0 &&
                    Array.isArray(message.result.columns) &&
                    message.result.columns.length > 0 && (
                      <ResultTable
                        data={message.result.data}
                        columns={message.result.columns}
                        rowCount={message.result.rowCount || message.result.data.length}
                      />
                    )}
                </div>
              ))}

              {sending && (
                <div className="message-wrapper">
                  <div className="message assistant">
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="chat-input-container">
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your data..."
              rows={1}
              disabled={sending}
            />
            <button
              type="submit"
              className="btn btn-primary btn-send"
              disabled={!input.trim() || sending}
            >
              <FiSend />
            </button>
          </form>
          <p className="input-hint">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;
