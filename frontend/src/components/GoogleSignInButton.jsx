/**
 * Google Sign-In Button Component
 * 
 * Uses Google Identity Services with the rendered button approach
 * for reliable OAuth authentication on localhost and production.
 * 
 * FIXES:
 * - Uses refs for callbacks to prevent re-initialization on every render
 * - Tracks initialization state to avoid calling google.accounts.id.initialize() multiple times
 * - Properly cleans up on unmount
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Google Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Module-level flag to prevent multiple initializations across component remounts
let isGoogleInitialized = false;

function GoogleSignInButton({ onSuccess, onError, disabled = false }) {
    const buttonContainerRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);

    // Use refs for callbacks so the useEffect doesn't re-run when they change
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    // Keep refs up-to-date without triggering re-renders
    useEffect(() => {
        onSuccessRef.current = onSuccess;
    }, [onSuccess]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        // Don't initialize if no client ID
        if (!GOOGLE_CLIENT_ID) {
            console.warn('Google Client ID not configured');
            setIsLoading(false);
            return;
        }

        let checkInterval = null;
        let checkTimeout = null;
        let isMounted = true;

        // Handle the credential response from Google
        const handleCredentialResponse = (response) => {
            if (response.credential) {
                onSuccessRef.current(response.credential);
            } else {
                onErrorRef.current('Failed to get Google credentials');
            }
        };

        // Initialize Google Identity Services
        const initializeGoogle = () => {
            if (!window.google?.accounts) return;

            try {
                // Only initialize once globally
                if (!isGoogleInitialized) {
                    window.google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: handleCredentialResponse,
                        auto_select: false,
                        cancel_on_tap_outside: true,
                    });
                    isGoogleInitialized = true;
                }

                // Render the Google Sign-In button
                if (buttonContainerRef.current && isMounted) {
                    // Clear any existing button content before re-rendering
                    buttonContainerRef.current.innerHTML = '';

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

                if (isMounted) {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Google Sign-In initialization error:', error);
                if (isMounted) {
                    onErrorRef.current('Failed to initialize Google Sign-In');
                    setIsLoading(false);
                }
            }
        };

        // Check if script is already loaded
        if (window.google?.accounts) {
            initializeGoogle();
        } else {
            // Wait for script to load
            checkInterval = setInterval(() => {
                if (window.google?.accounts) {
                    clearInterval(checkInterval);
                    clearTimeout(checkTimeout);
                    initializeGoogle();
                }
            }, 100);

            // Timeout after 5 seconds
            checkTimeout = setTimeout(() => {
                clearInterval(checkInterval);
                if (!window.google?.accounts && isMounted) {
                    console.error('Google Identity Services failed to load');
                    setIsLoading(false);
                }
            }, 5000);
        }

        return () => {
            isMounted = false;
            if (checkInterval) clearInterval(checkInterval);
            if (checkTimeout) clearTimeout(checkTimeout);
        };
    }, []); // Empty dependency array — initialize only once

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
