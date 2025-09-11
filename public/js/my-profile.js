document.addEventListener('DOMContentLoaded', async () =>
{
    const profileForm = document.getElementById('profile-form');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const userIdInput = document.getElementById('userId');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteAccountModal = new bootstrap.Modal(document.getElementById('deleteAccountModal'));
    const deleteAccountForm = document.getElementById('delete-account-form');
    const deletePasswordInput = document.getElementById('delete-password');
    const deleteAccountAlert = document.getElementById('delete-account-alert');
    const changePasswordBtn = document.getElementById('change-password-btn');

    let userId = null;

    async function loadProfile()
    {
        //lo devo assegnare qua perché se il controllo precedente isAuthenticaed
        //dovesse aggiornare l'access token, dichiarandolo come const al caricamento del DOM
        //qua lo avrei al valore letto in precedenza e non quello aggiornato
        userId = sessionStorage.getItem('userId');

        try
        {
            const response = await authUtils.authenticatedFetch(`/api/v1/users/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            //const response = await authUtils.authenticatedFetch(`/api/v1/users/${userId}`);
            if (!response) return;

            if (response.ok)
            {
                //alertMsgsUtils.showError(response.statusText || 'Errore nel caricamento dati utente');
                const data = await response.json();
                userIdInput.value = data.userId;
                usernameInput.value = data.username;
                emailInput.value = data.email;
            }
            else
            {
                alertMsgsUtils.showError((await response.json()).message || 'Error loading user data');
            }
        }
        catch (e)
        {
            alertMsgsUtils.showError('Network error');
        }
    }

    profileForm.addEventListener('submit', async (e) =>
    {
        e.preventDefault();
        const username = usernameInput.value.trim();

        if (!username)
        {
            alertMsgsUtils.showError('Username is required.');
            return;
        }

        try
        {
            const response = await authUtils.authenticatedFetch(`/api/v1/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await response.json();
            if (response.ok)
            {
                alertMsgsUtils.showSuccess('Data successfully updated!');
            }
            else
            {
                alertMsgsUtils.showError(data.message || 'Error occurred while updating profile.');
            }
        }
        catch (e)
        {
            alertMsgsUtils.showError('Network error');
        }
    });

    deleteAccountBtn.addEventListener('click', async () =>
    {
        if (authUtils.getAuthMethod() === 'email')
        {
            deletePasswordInput.value = '';
            deleteAccountAlert.classList.add('d-none');
            deleteAccountModal.show();
        } else
        {
            alertMsgsUtils.showConfirmation(
                'Are you sure you want to delete your account? This action is irreversible.',
                deleteAccountRequest,
                null,
                'Confirm account deletion',
                'danger',
                'Confirm',
                'Cancel'
            );
        }

    });

    deleteAccountForm.addEventListener('submit', async (e) =>
    {
        e.preventDefault();
        const password = deletePasswordInput.value;
        if (!password)
        {
            alertMsgsUtils.showError('Insert your password.');
            return;
        }
        await deleteAccountRequest(password);

    });

    changePasswordBtn.addEventListener('click', () =>
    {
        alertMsgsUtils.showConfirmation("Are you sure to change your password? You'll receive an email.", async () =>
        {
            try
            {
                const userEmailResult = await authUtils.authenticatedFetch(`/api/v1/users/${userId}`, {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });

                if (userEmailResult.ok)
                {
                    const userEmail = (await userEmailResult.json()).email;

                    const response = await fetch("/api/v1/password-reset-tokens", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ email: userEmail })
                    });

                    if (response.ok)
                        alertMsgsUtils.showSuccess("Check your email inbox.");
                    else
                        alertMsgsUtils.showError("Error. Retry");
                }
            }
            catch (e)
            {
                alertMsgsUtils.showError('Network error');
            }


        }, undefined, "Confirm you password change", undefined, "Confirm", "Cancel");
    });

    async function deleteAccountRequest(password)
    {
        try
        {
            const options = {
                method: 'DELETE',
                headers: {}
            };

            if (authUtils.getAuthMethod() === 'email')
                options.headers['X-User-Password'] = password;

            const response = await authUtils.authenticatedFetch(`/api/v1/users/${userId}`, options);
            const data = await response.json();
            if (response.ok)
            {
                alertMsgsUtils.showSuccess(data.message || 'Confirmation email sent.');

                setTimeout(async () =>
                {
                    await authUtils.logout();
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
        }
    }

    //richiesta autenticazione obv
    if (await authUtils.requireAuth())
        await loadProfile();
});
