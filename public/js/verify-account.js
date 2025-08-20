document.addEventListener('DOMContentLoaded', async () =>
{
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const loadingSpinner = document.getElementById('loading-spinner');
    const verificationMessage = document.getElementById('verification-message');
    const loginRedirectLink = document.getElementById('login-redirect-link');

    if (!token)
    {
        loadingSpinner.style.display = 'none';
        verificationMessage.textContent = 'Link di verifica non valido o mancante.';
        verificationMessage.classList.add('message', 'error');
        loginRedirectLink.style.display = 'block';
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

        loadingSpinner.style.display = 'none'; // Nasconde lo spinner
        loginRedirectLink.style.display = 'block'; // Mostra il link al login

        if (response.ok)
        { // Status 2xx
            verificationMessage.textContent = data.message || 'Account verificato con successo!';
            verificationMessage.classList.add('message', 'success');
        } else
        { // Status 4xx, 5xx
            verificationMessage.textContent = data.message || 'Si è verificato un errore durante la verifica dell\'account.';
            verificationMessage.classList.add('message', 'error');
        }
    } catch (error)
    {
        console.error('Errore di rete durante la verifica dell\'account:', error);
        loadingSpinner.style.display = 'none';
        verificationMessage.textContent = 'Si è verificato un errore di rete. Controlla la tua connessione.';
        verificationMessage.classList.add('message', 'error');
        loginRedirectLink.style.display = 'block';
    }
});