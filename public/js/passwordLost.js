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
            alertMsgs.showError('Inserisci la tua email.');
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
                alertMsgs.showSuccess(data.message || 'Email di recupero inviata. Controlla la tua casella di posta.');
                form.reset();
            }
            else
            {
                alertMsgs.showError(data.message || 'Errore durante la richiesta di recupero password.');
            }
        }
        catch (err)
        {
            alertMsgs.showError('Errore di rete. Riprova più tardi.');
        }
    });
});
