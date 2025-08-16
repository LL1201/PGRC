//utility per la gestione in comodità delle richieste autenticate

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

//fetch autenticato automatico con eventuale rinnovo del refresh token
async function authenticatedFetch(url, options = {})
{
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');

    if (!token || !userId)
    {
        window.location.href = 'login.html';
        return null;
    }

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

        //se la richiesta precedente non va a buon fine per errori di autenticazione
        //allora prova a fare il refresh del token
        if (response.status === 401 || response.status === 403)
        {
            const newToken = await refreshAccessToken();

            if (newToken)
            {
                //riprova la richiesta con il nuovo token
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

function isAuthenticated()
{
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');
    return !!(token && userId);
}

//controlla se l'utente è loggato, in caso contrario manda al login
function requireAuth()
{
    if (!isAuthenticated())
    {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function logout()
{
    try
    {
        await fetch('/pgrc/api/auth/logout', {
            method: 'POST',
            credentials: 'include' //per includere il cookie che contiene il refresh token
        });
    } catch (error)
    {
        console.error('Error during logout:', error);
    } finally
    {
        //pulizia local storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        window.accessToken = null;
        window.location.href = 'login.html';
    }
}

window.authUtils = {
    refreshAccessToken,
    authenticatedFetch,
    isAuthenticated,
    requireAuth,
    logout
};
