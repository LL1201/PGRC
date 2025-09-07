document.addEventListener('DOMContentLoaded', async () =>
{
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('reset-token');
    const userId = urlParams.get('user-id');

    const loadingSpinner = document.getElementById('loading-spinner');
    const passwordResetForm = document.getElementById('password-reset-form');

    if (!token)
    {
        loadingSpinner.style.display = 'none';
        //TODO - verificare se è possibile validare il token prima
        alertMsgsUtils.showError('Missing reset token.');
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
            alertMsgsUtils.showError('Missing password.');
            return;
        }

        try
        {
            let url = `/pgrc/api/v1/auth/users/${userId}`;
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: password,
                    resetPasswordToken: token
                })
            });

            const data = await response.json();

            if (response.ok)
            {
                alertMsgsUtils.showSuccess(data.message || 'Password successfully reset!');
                setTimeout(() =>
                {
                    window.location.href = 'login.html';
                }, 2000)
            }
            else
                alertMsgsUtils.showError(data.message || 'An error occurred while resetting the password.');

        } catch (error)
        {
            console.error('Network error while resetting the password:', error);
            loadingSpinner.style.display = 'none';
            alertMsgsUtils.showError('A network error occurred. Please check your connection.');
        }
    });
});