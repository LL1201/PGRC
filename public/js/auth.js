document.addEventListener('DOMContentLoaded', async () =>
{
    /*if (await authUtils.isAuthenticated())
    {
        //TODO - cambiare quando ci sarà la pagina con i dati dell'utente
        window.location.href = 'cookbook.html';
    }*/
    const loginForm = document.getElementById('login-form-element');
    const registerForm = document.getElementById('register-form-element');

    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');

    //funzione per mostrare/nascondere i messaggi di errore o successo
    function showMessage(element, msg, type)
    {
        element.textContent = msg;
        element.className = `message show ${type}`;
        setTimeout(() =>
        {
            element.classList.remove('show');
            element.textContent = '';
        }, 10000);
    }

    function isValidEmail(email)
    {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    //pulisce i messaggi al cambio di pagina
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab =>
    {
        tab.addEventListener('shown.bs.tab', () =>
        {
            loginMessage.classList.remove('show');
            registerMessage.classList.remove('show');
        });
    });

    loginForm.addEventListener('submit', async (event) =>
    {
        event.preventDefault();

        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;

        if (!email || !password)
        {
            showMessage(loginMessage, 'Credenziali mancanti.', 'error');
            return;
        }
        if (!isValidEmail(email))
        {
            showMessage(loginMessage, 'Formato email non valido.', 'error');
            return;
        }

        try
        {
            const response = await fetch('/pgrc/api/auth/login', {
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
                showMessage(loginMessage, data.message, 'success');
                setTimeout(() =>
                {
                    window.location.href = 'index.html';
                }, 1000);
            } else
            {
                showMessage(loginMessage, data.message || 'Login failed.', 'error');
            }
        } catch (error)
        {
            console.error('Error during login:', error);
            showMessage(loginMessage, 'An error occurred during login. Please try again later.', 'error');
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
            showMessage(registerMessage, 'Tutti i campi sono obbligatori.', 'error');
            return;
        }
        if (!isValidEmail(email))
        {
            showMessage(registerMessage, 'Formato email non valido.', 'error');
            return;
        }
        if (password !== confirmPassword)
        {
            showMessage(registerMessage, 'Le password non coincidono.', 'error');
            return;
        }

        try
        {
            const response = await fetch('/pgrc/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok)
                showMessage(registerMessage, data.message, 'success');
            else
                showMessage(registerMessage, data.message || 'Registration failed.', 'error');

        } catch (error)
        {
            console.error('Error during registration:', error);
            showMessage(registerMessage, 'An error occurred during registration. Please try again later.', 'error');
        }
    });
});