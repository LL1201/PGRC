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
    const userId = localStorage.getItem('userId');

    async function loadProfile()
    {
        try
        {
            const response = await authUtils.authenticatedFetch(`/pgrc/api/v1/users/${userId}`);
            if (!response) return;

            if (response.ok)
            {
                //alertMsgs.showError(response.statusText || 'Errore nel caricamento dati utente');
                const data = await response.json();
                userIdInput.value = data.userId;
                usernameInput.value = data.username;
                emailInput.value = data.email;
            }
            else
            {
                alertMsgs.showError((await response.json()).message || 'Errore nel caricamento dati utente');
            }
        }
        catch (e)
        {
            alertMsgs.showError('Errore di rete');
        }
    }

    profileForm.addEventListener('submit', async (e) =>
    {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();

        if (!username || !email)
        {
            alertMsgs.showError('Username o email sono obbligatori.');
            return;
        }

        try
        {
            const response = await authUtils.authenticatedFetch(`/pgrc/api/v1/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email })
            });
            const data = await response.json();
            if (response.ok)
            {
                alertMsgs.showSuccess('Dati aggiornati con successo!');
            }
            else
            {
                alertMsgs.showError(data.message || 'Errore durante l\'aggiornamento.');
            }
        }
        catch (e)
        {
            alertMsgs.showError('Errore di rete');
        }
    });

    deleteAccountBtn.addEventListener('click', () =>
    {
        deletePasswordInput.value = '';
        deleteAccountAlert.classList.add('d-none');
        deleteAccountModal.show();
    });

    deleteAccountForm.addEventListener('submit', async (e) =>
    {
        e.preventDefault();
        const password = deletePasswordInput.value;
        if (!password)
        {
            alertMsgs.showError('Inserisci la password.');
            return;
        }
        try
        {
            const response = await authUtils.authenticatedFetch(`/pgrc/api/v1/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            if (response.ok)
            {
                // Logout e redirect
                await authUtils.logout();
            }
            else
            {
                alertMsgs.showError(data.message || 'Errore durante l\'eliminazione.');
            }
        }
        catch (e)
        {
            alertMsgs.showError('Errore di rete');
        }
    });

    //richiesta autenticazione obv
    if (await authUtils.requireAuth())
        await loadProfile();
});
