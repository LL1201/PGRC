document.addEventListener('DOMContentLoaded', async () =>
{


    if (await authUtils.isAuthenticated())
        window.location.href = 'my-profile.html';

    const loginForm = document.getElementById('login-form-element');
    const registerForm = document.getElementById('register-form-element');
    const continueWithGoogleButton = document.getElementById('continue-with-google-button');

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
            alertMsgsUtils.showError('Missing credentials.');
            return;
        }
        if (!isValidEmail(email))
        {
            alertMsgsUtils.showError('Invalid email format.');
            return;
        }

        try
        {
            const response = await fetch('/api/v1/access-tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok)
            {
                sessionStorage.setItem('accessToken', data.accessToken);
                sessionStorage.setItem('userId', data.userId);

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
            alertMsgsUtils.showError('All fields are required.');
            return;
        }
        if (!isValidEmail(email))
        {
            alertMsgsUtils.showError('Invalid email format.');
            return;
        }
        if (password !== confirmPassword)
        {
            alertMsgsUtils.showError('Passwords do not match.');
            return;
        }

        try
        {
            const response = await fetch('/api/v1/users', {
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

    continueWithGoogleButton.addEventListener('click', async () =>
    {
        const res = await fetch("/api/v1/access-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authProvider: "google" })
        });
        const data = await res.json();
        window.location.href = data.redirectUrl;
    });
});