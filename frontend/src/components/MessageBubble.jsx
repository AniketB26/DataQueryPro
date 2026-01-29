/**
 * Message Bubble Component
 * 
 * Displays a single chat message with appropriate styling for user/assistant.
 */

import React, { useState } from 'react';
import { FiUser, FiCpu, FiCode, FiCopy, FiCheck } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

function MessageBubble({ message }) {
  const [showQuery, setShowQuery] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const isError = message.error;

  const copyQuery = async () => {
    if (message.query) {
      await navigator.clipboard.writeText(message.query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
      <div className="message-avatar">
        {isUser ? <FiUser /> : <FiCpu />}
      </div>

      <div className="message-content">
        <div className="message-text">
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>

        {/* Show generated query for assistant messages */}
        {!isUser && message.query && (
          <div className="message-query">
            <button
              className="query-toggle"
              onClick={() => setShowQuery(!showQuery)}
            >
              <FiCode />
              {showQuery ? 'Hide' : 'Show'} Generated Query
              {message.wasFixed && (
                <span className="query-fixed-badge">Auto-fixed</span>
              )}
            </button>

            {showQuery && (
              <div className="query-code">
                <button
                  className="copy-btn"
                  onClick={copyQuery}
                  title="Copy query"
                >
                  {copied ? <FiCheck /> : <FiCopy />}
                </button>
                <pre>
                  <code>{message.query}</code>
                </pre>
                {message.queryExplanation && (
                  <p className="query-explanation">
                    {message.queryExplanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="message-meta">
          <span className="message-time">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
