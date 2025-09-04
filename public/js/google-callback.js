document.addEventListener('DOMContentLoaded', async () =>
{
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');

    //TODO - veder se si possono usare gli alert dell'utility
    const verificationMessage = document.getElementById('verification-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    if (!userId)
    {
        loadingSpinner.style.display = 'none';
        verificationMessage.textContent = 'Link is invalid.';
        verificationMessage.classList.add('message', 'error');
        setTimeout(() =>
        {
            window.location.href = 'login.html';
        }, 1000);
        return;
    }

    localStorage.setItem('userId', userId);

    if (await authUtils.isAuthenticated())
        window.location.href = 'my-profile.html';
    else
        window.location.href = 'login.html';
});
