'use client';

import { useEffect } from 'react';

const SESSION_ENDPOINTS = ['/api/auth/login', '/api/auth/logout'];

function getRequestPath(input) {
  if (typeof input === 'string') return input;
  if (input instanceof Request) return input.url;
  return String(input?.url || '');
}

export default function SessionGuard({ children }) {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let redirecting = false;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const requestPath = getRequestPath(args[0]);
      const isAuthEndpoint = SESSION_ENDPOINTS.some((path) => requestPath.includes(path));

      if (response.status === 401 && !isAuthEndpoint && !redirecting) {
        redirecting = true;
        try {
          await originalFetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch {
          // Redirect even if the cleanup request cannot complete.
        }
        window.location.assign('/login');
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return children;
}
