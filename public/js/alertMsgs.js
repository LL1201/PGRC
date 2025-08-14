// Alert message utility functions
//TODO - vedere bene e capire il codice scritto e semplificare il css magari

// Show alert message with different types
function showAlert(message, type = 'info', duration = 5000)
{
    // Remove existing alert if present
    hideAlert();

    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <span class="closebtn" onclick="hideAlert()">&times;</span>
        ${message}
    `;

    // Add to document body
    document.body.appendChild(alertDiv);

    // Auto-hide after duration
    if (duration > 0)
    {
        setTimeout(() =>
        {
            hideAlert();
        }, duration);
    }
}

// Hide alert message
function hideAlert()
{
    const existingAlert = document.querySelector('.alert');
    if (existingAlert)
    {
        existingAlert.remove();
    }
}

// Convenience functions for different alert types
function showSuccess(message, duration = 5000)
{
    showAlert(message, 'success', duration);
}

function showError(message, duration = 5000)
{
    showAlert(message, 'danger', duration);
}

function showWarning(message, duration = 5000)
{
    showAlert(message, 'warning', duration);
}

function showInfo(message, duration = 5000)
{
    showAlert(message, 'info', duration);
}

// Show confirmation dialog
function showConfirmation(message, onConfirm, onCancel = null, confirmText = 'Conferma', cancelText = 'Annulla')
{
    // Remove existing dialogs
    hideAlert();
    hideConfirmation();

    // Create confirmation overlay
    //TODO - vedere cos'è overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirmation-overlay';

    // Create confirmation dialog
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'confirmation-dialog';
    confirmDialog.innerHTML = `
        <div class="confirmation-content">
            <h3>Conferma azione</h3>
            <p>${message}</p>
            <div class="confirmation-buttons">
                <button class="btn btn-confirm">${confirmText}</button>
                <button class="btn btn-cancel">${cancelText}</button>
            </div>
        </div>
    `;

    overlay.appendChild(confirmDialog);
    document.body.appendChild(overlay);

    // Add event listeners
    const confirmBtn = confirmDialog.querySelector('.btn-confirm');
    const cancelBtn = confirmDialog.querySelector('.btn-cancel');

    confirmBtn.addEventListener('click', () =>
    {
        hideConfirmation();
        if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener('click', () =>
    {
        hideConfirmation();
        if (onCancel) onCancel();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) =>
    {
        if (e.target === overlay)
        {
            hideConfirmation();
            if (onCancel) onCancel();
        }
    });
}

// Hide confirmation dialog
function hideConfirmation()
{
    const existingConfirmation = document.querySelector('.confirmation-overlay');
    if (existingConfirmation)
    {
        existingConfirmation.remove();
    }
}

// Show custom prompt dialog
function showPrompt(message, defaultValue = '', onConfirm, onCancel = null, confirmText = 'Conferma', cancelText = 'Annulla', placeholder = '')
{
    // Remove existing dialogs
    hideAlert();
    hideConfirmation();
    hidePrompt();

    // Create prompt overlay
    const overlay = document.createElement('div');
    overlay.className = 'prompt-overlay';

    // Create prompt dialog
    const promptDialog = document.createElement('div');
    promptDialog.className = 'prompt-dialog';
    promptDialog.innerHTML = `
        <div class="prompt-content">
            <h3>Modifica Nota</h3>
            <p>${message}</p>
            <textarea class="prompt-input" placeholder="${placeholder}">${defaultValue}</textarea>
            <div class="prompt-buttons">
                <button class="btn btn-confirm">${confirmText}</button>
                <button class="btn btn-cancel">${cancelText}</button>
            </div>
        </div>
    `;

    overlay.appendChild(promptDialog);
    document.body.appendChild(overlay);

    // Focus on input
    const input = promptDialog.querySelector('.prompt-input');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    // Add event listeners
    const confirmBtn = promptDialog.querySelector('.btn-confirm');
    const cancelBtn = promptDialog.querySelector('.btn-cancel');

    confirmBtn.addEventListener('click', () =>
    {
        const value = input.value;
        hidePrompt();
        if (onConfirm) onConfirm(value);
    });

    cancelBtn.addEventListener('click', () =>
    {
        hidePrompt();
        if (onCancel) onCancel();
    });

    // Submit on Enter (Ctrl+Enter for multiline)
    input.addEventListener('keydown', (e) =>
    {
        if (e.key === 'Enter' && e.ctrlKey)
        {
            const value = input.value;
            hidePrompt();
            if (onConfirm) onConfirm(value);
        }
        if (e.key === 'Escape')
        {
            hidePrompt();
            if (onCancel) onCancel();
        }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) =>
    {
        if (e.target === overlay)
        {
            hidePrompt();
            if (onCancel) onCancel();
        }
    });
}

// Hide prompt dialog
function hidePrompt()
{
    const existingPrompt = document.querySelector('.prompt-overlay');
    if (existingPrompt)
    {
        existingPrompt.remove();
    }
}

// Export functions for use in other modules
window.alertMsgs = {
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirmation,
    hideConfirmation,
    showPrompt,
    hidePrompt
};