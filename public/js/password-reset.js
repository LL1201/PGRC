document.addEventListener('DOMContentLoaded', async () =>
{
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('resetToken');
    const userId = urlParams.get('userId');

    const loadingSpinner = document.getElementById('loading-spinner');
    const passwordResetForm = document.getElementById('password-reset-form');

    if (!token)
    {
        loadingSpinner.style.display = 'none';
        //TODO - verificare se è possibile validare il token prima
        alertMsgsUtils.showError('Link di verifica mancante.');
        return;
    }

    passwordResetForm.classList.remove('d-none');
    loadingSpinner.style.display = 'none';

    passwordResetForm.addEventListener('submit', async (event) =>
    {
        event.preventDefault();

        const password = passwordResetForm['reset-password'].value;

        if (!password)
        {
            alertMsgsUtils.showError('Password mancante.');
            return;
        }

        try
        {
            let url = `/pgrc/api/v1/auth/password-reset`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    password: password,
                    resetToken: token
                })
            });

            const data = await response.json();

            if (response.ok)
            {
                alertMsgsUtils.showSuccess(data.message || 'Password reimpostata con successo!');
                setTimeout(() =>
                {
                    window.location.href = 'login.html';
                }, 2000)
            }
            else
                alertMsgsUtils.showError(data.message || 'Si è verificato un errore durante la reimpostazione della password.');

        } catch (error)
        {
            console.error('Errore di rete durante la reimpostazione della password:', error);
            loadingSpinner.style.display = 'none';
            alertMsgsUtils.showError('Si è verificato un errore di rete. Controlla la tua connessione.');
        }
    });
});