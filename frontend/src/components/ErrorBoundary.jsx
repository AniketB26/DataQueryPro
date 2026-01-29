/**
 * Error Boundary Component
 * 
 * Catches React errors and prevents full app crash.
 * Shows a friendly error message instead of black screen.
 */

import React, { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <h2>⚠️ Something went wrong</h2>
                        <p>An error occurred while processing your request.</p>

                        {this.state.error && (
                            <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>
                                <summary>Error Details</summary>
                                <pre>{this.state.error.toString()}</pre>
                            </details>
                        )}

                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={this.handleReset}
                            >
                                Try Again
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => window.location.reload()}
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
