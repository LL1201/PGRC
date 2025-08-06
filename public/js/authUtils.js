// Utility functions for authentication and token management

// Refresh access token using refresh token
async function refreshAccessToken()
{
    try
    {
        const response = await fetch('/pgrc/api/auth/access-token/refresh', {
            method: 'POST',
            credentials: 'include', // Include cookies            
        });

        if (response.ok)
        {
            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            return data.accessToken;
        } else
        {
            // Refresh failed, redirect to login
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userId');
            window.location.href = 'login.html';
            return null;
        }
    } catch (error)
    {
        console.error('Error refreshing token:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        window.location.href = 'login.html';
        return null;
    }
}

// Make authenticated fetch request with automatic token refresh
async function authenticatedFetch(url, options = {})
{
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (!token || !userId)
    {
        window.location.href = 'login.html';
        return null;
    }

    // Add authorization header
    const authOptions = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    };

    try
    {
        let response = await fetch(url, authOptions);

        // If unauthorized, try to refresh token once
        if (response.status === 401 || response.status === 403)
        {
            const newToken = await refreshAccessToken();

            if (newToken)
            {
                // Retry the request with new token
                authOptions.headers['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, authOptions);
            } else
            {
                return null;
            }
        }

        return response;
    } catch (error)
    {
        console.error('Network error in authenticated fetch:', error);
        throw error;
    }
}

// Check if user is authenticated
function isAuthenticated()
{
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');
    console.log('isAuthenticated:', token, userId);
    return !!(token && userId);
}

// Redirect to login if not authenticated
function requireAuth()
{
    if (!isAuthenticated())
    {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Logout user by clearing tokens and calling logout endpoint
async function logout()
{
    try
    {
        // Call logout endpoint to invalidate refresh token
        await fetch('/pgrc/api/auth/logout', {
            method: 'POST',
            credentials: 'include' // Include cookies
        });
    } catch (error)
    {
        console.error('Error during logout:', error);
    } finally
    {
        // Clear local storage regardless of API call result
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        window.accessToken = null;
        window.location.href = 'login.html';
    }
}

// Export functions for use in other modules
window.authUtils = {
    refreshAccessToken,
    authenticatedFetch,
    isAuthenticated,
    requireAuth,
    logout
};
