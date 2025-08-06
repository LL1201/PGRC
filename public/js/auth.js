//TODO se in qualche modo l'utente arriva qua da loggato reindirizzarlo alla pagina del mio profilo

document.addEventListener('DOMContentLoaded', () =>
{
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');

    // Funzione per mostrare/nascondere i messaggi
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

    // Funzione di validazione email
    function isValidEmail(email)
    {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Gestione del cambio tab
    loginTab.addEventListener('click', () =>
    {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');

        //pulisce eventuali messaggi quando si cambia tab
        loginMessage.classList.remove('show');
        registerMessage.classList.remove('show');
    });

    registerTab.addEventListener('click', () =>
    {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');

        //pulisce eventuali messaggi quando si cambia tab
        loginMessage.classList.remove('show');
        registerMessage.classList.remove('show');
    });


    loginForm.addEventListener('submit', async (event) =>
    {
        event.preventDefault(); // Previene il ricaricamento della pagina

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
                //salva l'access token in memoria
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('userId', data.userId);
                showMessage(loginMessage, data.message, 'success');
                // Reindirizza l'utente dopo un breve ritardo per mostrare il messaggio
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

    // --- Gestione del form di Registrazione ---
    registerForm.addEventListener('submit', async (event) =>
    {
        event.preventDefault(); // Previene il ricaricamento della pagina

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