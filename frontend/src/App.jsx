import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

// Page imports
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';
import Work from './pages/Work';
import ChatPage from './pages/ChatPage';
import Profile from './pages/Profile';
import Tutorial from './pages/Tutorial';

/**
 * Protected Route wrapper component
 * Redirects to login if user is not authenticated
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * Public Route wrapper component
 * Redirects to home if user is already authenticated
 */
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * Main App Component
 * Defines application routes and layout
 */
function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <div className="app">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/tutorial" element={<Tutorial />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/work"
              element={
                <ProtectedRoute>
                  <Work />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
