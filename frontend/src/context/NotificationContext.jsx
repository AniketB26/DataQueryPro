/**
 * Notification Context
 * 
 * Provides a centralized way to manage persistent error notifications.
 * Error notifications remain visible until manually dismissed.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import ErrorToast from '../components/ErrorToast';

const NotificationContext = createContext(null);

let notificationId = 0;

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);

    /**
     * Show a persistent error notification
     * @param {string} message - Error message to display
     * @returns {number} - Notification ID for manual dismissal
     */
    const showError = useCallback((message) => {
        const id = ++notificationId;
        setNotifications((prev) => [...prev, { id, message, type: 'error' }]);
        return id;
    }, []);

    /**
     * Show a success notification (auto-dismisses after 4 seconds)
     * @param {string} message - Success message to display
     */
    const showSuccess = useCallback((message) => {
        const id = ++notificationId;
        setNotifications((prev) => [...prev, { id, message, type: 'success' }]);

        // Auto-dismiss success messages after 4 seconds
        setTimeout(() => {
            dismissNotification(id);
        }, 4000);

        return id;
    }, []);

    /**
     * Dismiss a notification by ID
     * @param {number} id - Notification ID to dismiss
     */
    const dismissNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    /**
     * Clear all notifications
     */
    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const value = {
        showError,
        showSuccess,
        dismissNotification,
        clearAll,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
            {/* Notification Container */}
            <div
                className="notification-container"
                role="region"
                aria-label="Notifications"
            >
                {notifications.map((notification) => (
                    notification.type === 'error' ? (
                        <ErrorToast
                            key={notification.id}
                            id={notification.id}
                            message={notification.message}
                            onDismiss={dismissNotification}
                        />
                    ) : (
                        <div
                            key={notification.id}
                            className="success-toast"
                            role="status"
                            aria-live="polite"
                        >
                            <span>{notification.message}</span>
                        </div>
                    )
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

/**
 * Hook to use notification context
 */
export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
