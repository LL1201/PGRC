document.addEventListener('DOMContentLoaded', async () =>
{
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('delete-token');
    const userId = urlParams.get('user-id');

    const verificationMessage = document.getElementById('verification-message');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    if (!token)
    {
        verificationMessage.textContent = 'Verification link is invalid or missing.';
        verificationMessage.classList.add('message', 'error');
        return;
    }

    confirmDeleteBtn.addEventListener('click', async () =>
    {
        try
        {
            const options = {
                method: 'DELETE',
                headers: {
                    'X-User-Delete-Token': token
                }
            };

            const response = await fetch(`/api/v1/users/${userId}`, options);

            const data = await response.json();
            if (response.ok)
            {
                alertMsgsUtils.showSuccess(data.message || 'User successfully deleted.');

                verificationMessage.textContent = data.message || 'Account successfully deleted!';
                verificationMessage.classList.add('message', 'success');

                setTimeout(async () =>
                {
                    window.location.href = '/';
                }, 2000);
            }
            else
            {
                alertMsgsUtils.showError(data.message || 'Error occurred while deleting account.');
            }
        }
        catch (e)
        {
            alertMsgsUtils.showError('Network error');
            verificationMessage.textContent = 'A network error occurred. Check your connection.';
            verificationMessage.classList.add('message', 'error');
        }
    });
});
