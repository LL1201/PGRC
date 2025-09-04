function getJwtPayload(token)
{
    //essendo il JWT codificato in base64, atob decodifica base64
    //formato JWT: header.payload.signature quindi prendo solo il payload con [1]
    try
    {
        return JSON.parse(atob(token.split('.')[1]))
    } catch (error)
    {
        return undefined
    }
}

function getAuthMethod()
{
    const token = localStorage.getItem('accessToken');
    if (!token) return null;

    const payload = getJwtPayload(token);
    if (!payload || !payload.authMethod) return null;

    return payload.authMethod;
}

async function refreshAccessToken()
{
    const userId = localStorage.getItem('userId');

    if (!userId)
        return null;

    try
    {
        const response = await fetch(`/pgrc/api/v1/users/${userId}/access-token`, {
            method: 'POST',
            credentials: 'include', //include cookies            
        });

        if (response.ok)
        {
            const data = await response.json();
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('userId', data.userId);
            return { accessToken: data.accessToken, userId: data.userId };
        } else
        {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userId');
            //window.location.href = 'login.html';
            return null;
        }
    } catch (error)
    {
        console.error('Error refreshing token:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        //window.location.href = 'login.html';
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
        console.log('Making authenticated fetch request to:', authOptions);
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
                window.location.href = 'login.html';
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

async function isAuthenticated()
{
    let token = localStorage.getItem('accessToken');
    let userId = localStorage.getItem('userId');

    //se non ci sono questi token prova a fare un refresh
    if (!token || !userId)
    {
        const response = await refreshAccessToken();
        if (!response)
            return null;

        token = response.accessToken;
        userId = response.userId;
    }

    try
    {
        //uso l'endpoint per ottenere le info dell'utente per capire se l'utente è autenticato
        let response = await fetch(`/pgrc/api/v1/users/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403)
        {
            if (!await refreshAccessToken())
                return false;
            else
                return true;
        }

        if (response.ok)
            return true;
        else
            return false;
    } catch (error)
    {
        console.error('Error during token verification:', error);
        return false;
    }
}

//controlla se l'utente è loggato, in caso contrario manda al login
async function requireAuth()
{
    if (!await isAuthenticated())
    {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function logout()
{
    const userId = localStorage.getItem('userId');

    if (!userId)
    {
        window.location.href = 'login.html';
        return null;
    }

    try
    {
        await fetch(`/pgrc/api/v1/users/${userId}/access-token`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
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
    logout,
    getAuthMethod
};
