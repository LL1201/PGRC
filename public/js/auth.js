document.addEventListener('DOMContentLoaded', async () =>
{
    //se l'utente finisce in questa pagina di login quando autenticato viene reindirizzato alla pagina del profilo
    if (await authUtils.isAuthenticated())
        window.location.href = 'my-profile.html';

    const loginForm = document.getElementById('login-form-element');
    const registerForm = document.getElementById('register-form-element');

    function isValidEmail(email)
    {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    //pulisce le text box al cambio di pagina
    /*document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab =>
    {
        tab.addEventListener('shown.bs.tab', () =>
        {
            loginForm['login-email'].value = '';
            loginForm['login-password'].value = '';
        });
    });*/

    loginForm.addEventListener('submit', async (event) =>
    {
        event.preventDefault();

        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;

        if (!email || !password)
        {
            alertMsgsUtils.showError('Credenziali mancanti.');
            return;
        }
        if (!isValidEmail(email))
        {
            alertMsgsUtils.showError('Formato email non valido.');
            return;
        }

        try
        {
            const response = await fetch('/pgrc/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok)
            {
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('userId', data.userId);
                alertMsgsUtils.showSuccess(data.message);
                setTimeout(() =>
                {
                    window.location.href = 'index.html';
                }, 1000);
            } else
            {
                alertMsgsUtils.showError(data.message || 'Login failed.');
            }
        } catch (error)
        {
            console.error('Error during login:', error);
            alertMsgsUtils.showError('An error occurred during login. Please try again later.');
        }
    });

    registerForm.addEventListener('submit', async (event) =>
    {
        event.preventDefault();

        const username = registerForm['register-username'].value;
        const email = registerForm['register-email'].value;
        const password = registerForm['register-password'].value;
        const confirmPassword = registerForm['register-confirm-password'].value;

        if (!username || !email || !password || !confirmPassword)
        {
            alertMsgsUtils.showError('Tutti i campi sono obbligatori.');
            return;
        }
        if (!isValidEmail(email))
        {
            alertMsgsUtils.showError('Formato email non valido.');
            return;
        }
        if (password !== confirmPassword)
        {
            alertMsgsUtils.showError('Le password non coincidono.');
            return;
        }

        try
        {
            const response = await fetch('/pgrc/api/v1/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok)
                alertMsgsUtils.showSuccess(data.message);
            else
                alertMsgsUtils.showError(data.message || 'Registration failed.');

        } catch (error)
        {
            console.error('Error during registration:', error);
            alertMsgsUtils.showError('An error occurred during registration. Please try again later.');
        }
    });
});