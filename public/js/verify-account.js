document.addEventListener('DOMContentLoaded', async () =>
{
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    //TODO - veder se si possono usare gli alert dell'utility
    const loadingSpinner = document.getElementById('loading-spinner');
    const verificationMessage = document.getElementById('verification-message');
    const loginRedirectLink = document.getElementById('login-redirect-link');
    loginRedirectLink.style.display = 'none';

    if (!token)
    {
        loadingSpinner.style.display = 'none';
        verificationMessage.textContent = 'Verification link is invalid or missing.';
        verificationMessage.classList.add('message', 'error');
        //loginRedirectLink.style.display = 'block';
        return;
    }

    try
    {
        const response = await fetch('/pgrc/api/v1/auth/confirm-account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token })
        });

        const data = await response.json();

        loadingSpinner.style.display = 'none';

        if (response.ok)
        {
            verificationMessage.textContent = data.message || 'Account successfully verified!';
            verificationMessage.classList.add('message', 'success');
            loginRedirectLink.style.display = 'block';
        } else
        {
            verificationMessage.textContent = data.message || 'An error occurred while verifying the account.';
            verificationMessage.classList.add('message', 'error');
        }
    } catch (error)
    {
        console.error('Errore di rete durante la verifica dell\'account:', error);
        loadingSpinner.style.display = 'none';
        verificationMessage.textContent = 'A network error occurred. Check your connection.';
        verificationMessage.classList.add('message', 'error');
        loginRedirectLink.style.display = 'block';
    }
});
