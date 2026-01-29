/**
 * Google Sign-In Button Component
 * 
 * Uses Google Identity Services with the rendered button approach
 * for reliable OAuth authentication on localhost and production.
 */

import React, { useEffect, useRef, useState } from 'react';

// Google Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleSignInButton({ onSuccess, onError, disabled = false }) {
    const buttonContainerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Don't initialize if no client ID
        if (!GOOGLE_CLIENT_ID) {
            console.warn('Google Client ID not configured');
            setIsLoading(false);
            return;
        }

        // Handle the credential response from Google
        const handleCredentialResponse = (response) => {
            if (response.credential) {
                onSuccess(response.credential);
            } else {
                onError('Failed to get Google credentials');
            }
        };

        // Initialize Google Identity Services
        const initializeGoogle = () => {
            if (window.google && window.google.accounts) {
                try {
                    window.google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: handleCredentialResponse,
                        auto_select: false,
                        cancel_on_tap_outside: true,
                    });

                    // Render the Google Sign-In button
                    if (buttonContainerRef.current) {
                        window.google.accounts.id.renderButton(
                            buttonContainerRef.current,
                            {
                                type: 'standard',
                                theme: 'outline',
                                size: 'large',
                                text: 'signin_with',
                                shape: 'rectangular',
                                width: buttonContainerRef.current.offsetWidth || 300,
                            }
                        );
                    }

                    setIsLoading(false);
                } catch (error) {
                    console.error('Google Sign-In initialization error:', error);
                    onError('Failed to initialize Google Sign-In');
                    setIsLoading(false);
                }
            }
        };

        // Check if script is already loaded
        if (window.google && window.google.accounts) {
            initializeGoogle();
        } else {
            // Wait for script to load
            const checkGoogle = setInterval(() => {
                if (window.google && window.google.accounts) {
                    clearInterval(checkGoogle);
                    initializeGoogle();
                }
            }, 100);

            // Timeout after 5 seconds
            const timeout = setTimeout(() => {
                clearInterval(checkGoogle);
                if (!window.google || !window.google.accounts) {
                    console.error('Google Identity Services failed to load');
                    setIsLoading(false);
                }
            }, 5000);

            return () => {
                clearInterval(checkGoogle);
                clearTimeout(timeout);
            };
        }
    }, [onSuccess, onError]);

    // If no client ID, show disabled message
    if (!GOOGLE_CLIENT_ID) {
        return (
            <div className="google-signin-container">
                <button
                    type="button"
                    className="btn btn-google btn-block"
                    disabled
                    title="Google Sign-In not configured"
                >
                    <span>Google Sign-In not configured</span>
                </button>
            </div>
        );
    }

    return (
        <div className="google-signin-container">
            {isLoading && (
                <div className="google-signin-loading">
                    <span className="spinner-small"></span>
                    <span>Loading Google Sign-In...</span>
                </div>
            )}
            {/* Google will render its button here */}
            <div
                ref={buttonContainerRef}
                className={`google-button-wrapper ${disabled ? 'disabled' : ''}`}
                style={{ display: isLoading ? 'none' : 'flex', justifyContent: 'center' }}
            />
        </div>
    );
}

export default GoogleSignInButton;
