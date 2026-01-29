/**
 * ErrorToast Component
 * 
 * An accessible, persistent error notification that remains visible
 * until the user manually dismisses it.
 * 
 * Features:
 * - ARIA roles for screen readers
 * - Keyboard dismissible (Escape key)
 * - Close button with focus management
 * - Responsive design
 */

import React, { useEffect, useRef } from 'react';
import { FiX, FiAlertCircle } from 'react-icons/fi';

function ErrorToast({ message, onDismiss, id }) {
  const closeButtonRef = useRef(null);

  // Handle Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onDismiss(id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, id]);

  // Focus the close button when toast appears for accessibility
  useEffect(() => {
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, []);

  return (
    <div
      className="error-toast"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="error-toast-content">
        <FiAlertCircle className="error-toast-icon" aria-hidden="true" />
        <span className="error-toast-message">{message}</span>
      </div>
      <button
        ref={closeButtonRef}
        className="error-toast-close"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss error notification"
        type="button"
      >
        <FiX aria-hidden="true" />
      </button>
    </div>
  );
}

export default ErrorToast;
