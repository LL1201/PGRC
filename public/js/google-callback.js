document.addEventListener('DOMContentLoaded', async () =>
{
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user-id');

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

    sessionStorage.setItem('userId', userId);

    if (await authUtils.isAuthenticated())
        window.location.href = 'my-profile.html';
    else
        window.location.href = 'login.html';
});
