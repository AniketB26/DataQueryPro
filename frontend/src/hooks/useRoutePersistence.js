/**
 * Route Persistence Hook
 * 
 * Saves current route to localStorage and restores on reload.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ROUTE_KEY = 'dataquery_lastRoute';

/**
 * Hook to persist and restore route on page reload
 * @param {boolean} shouldRestore - Whether to restore route on mount
 */
export function useRoutePersistence(shouldRestore = true) {
    const location = useLocation();
    const navigate = useNavigate();

    // Save current route (skip auth routes)
    useEffect(() => {
        const path = location.pathname;
        // Only save actual app routes, not login/signup
        if (!['/login', '/signup'].includes(path)) {
            localStorage.setItem(ROUTE_KEY, path);
        }
    }, [location.pathname]);

    // Restore route on mount
    useEffect(() => {
        if (shouldRestore) {
            const savedRoute = localStorage.getItem(ROUTE_KEY);
            const currentPath = location.pathname;

            // If we're on landing page but have a saved route (and its /chat)
            // redirect there if we have an active connection
            if (currentPath === '/' && savedRoute === '/chat') {
                const isConnected = localStorage.getItem('dataquery_isConnected');
                if (isConnected === 'true') {
                    navigate(savedRoute, { replace: true });
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}

/**
 * Clear saved route
 */
export function clearSavedRoute() {
    localStorage.removeItem(ROUTE_KEY);
}
