import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ConnectionProvider } from './context/ConnectionContext';
import { NotificationProvider } from './context/NotificationContext';
import './styles/index.css';
import './styles/notifications.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <ConnectionProvider>
            <App />
            {/* Toaster kept for success messages only - errors use NotificationProvider */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#333',
                  color: '#fff',
                },
                // Only show success toasts through react-hot-toast
                success: {
                  duration: 4000,
                },
              }}
            />
          </ConnectionProvider>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);
