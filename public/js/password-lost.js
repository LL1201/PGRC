document.addEventListener('DOMContentLoaded', () =>
{
    const form = document.getElementById('password-lost-form');
    const emailInput = document.getElementById('lost-email');

    form.addEventListener('submit', async (e) =>
    {
        e.preventDefault();
        const email = emailInput.value.trim();

        if (!email)
        {
            alertMsgsUtils.showError('Insert your email.');
            return;
        }

        try
        {
            const response = await fetch('/pgrc/api/v1/auth/password-lost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok)
            {
                alertMsgsUtils.showSuccess(data.message || 'Password recovery email sent. Check your inbox.');
                form.reset();
            }
            else
            {
                alertMsgsUtils.showError(data.message || 'Error occurred while requesting password recovery.');
            }
        }
        catch (err)
        {
            alertMsgsUtils.showError('A network error occurred. Please try again later.');
        }
    });
});
