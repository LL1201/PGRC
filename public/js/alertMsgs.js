//utility per mostrare alert o prompt usando Bootstrap

function ensureAlertBannerContainer()
{
    let container = document.getElementById('alert-banner-container');
    if (!container)
    {
        container = document.createElement('div');
        container.id = 'alert-banner-container';
        document.body.appendChild(container);
    }
    return container;
}

function showAlert(message, type = 'info', duration = 5000)
{
    hideAlert();

    // Usa il container in alto a destra
    const container = ensureAlertBannerContainer();

    // Crea il banner custom
    const alertDiv = document.createElement('div');
    let typeClass = '';
    switch (type)
    {
        case 'success': typeClass = 'success'; break;
        case 'danger': typeClass = 'error'; break;
        case 'error': typeClass = 'error'; break;
        case 'warning': typeClass = 'warning'; break;
        default: typeClass = '';
    }
    alertDiv.className = `message${typeClass ? ' ' + typeClass : ''}`;
    alertDiv.innerHTML = `
        <span>${message}</span>
        <button type="button" class="btn-close" aria-label="Chiudi" style="float:right; margin-left:10px;"></button>
    `;

    // Chiudi manualmente
    alertDiv.querySelector('.btn-close').onclick = () =>
    {
        alertDiv.remove();
    };

    container.appendChild(alertDiv);

    // Auto-hide dopo duration
    if (duration > 0)
    {
        setTimeout(() =>
        {
            alertDiv.remove();
        }, duration);
    }
}

function hideAlert()
{
    const container = document.getElementById('alert-banner-container');
    if (container)
    {
        container.innerHTML = '';
    }
}

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

function showConfirmation(message, onConfirm, onCancel = null, confirmText = 'Conferma', cancelText = 'Annulla')
{
    hideConfirmation();

    //crea il prompt di conferma
    let modalDiv = document.getElementById('alertMsgs-confirm-modal');
    if (!modalDiv)
    {
        modalDiv = document.createElement('div');
        modalDiv.id = 'alertMsgs-confirm-modal';
        modalDiv.className = 'modal fade';
        modalDiv.tabIndex = -1;
        modalDiv.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Conferma azione</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p id="alertMsgs-confirm-message"></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="alertMsgs-cancel-btn" data-bs-dismiss="modal">${cancelText}</button>
                        <button type="button" class="btn btn-danger" id="alertMsgs-confirm-btn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    }

    //imposta il messaggio e i pulsanti
    modalDiv.querySelector('#alertMsgs-confirm-message').textContent = message;
    modalDiv.querySelector('#alertMsgs-confirm-btn').textContent = confirmText;
    modalDiv.querySelector('#alertMsgs-cancel-btn').textContent = cancelText;

    //event listeners
    const confirmBtn = modalDiv.querySelector('#alertMsgs-confirm-btn');
    const cancelBtn = modalDiv.querySelector('#alertMsgs-cancel-btn');
    confirmBtn.onclick = () =>
    {
        hideConfirmation();
        if (onConfirm) onConfirm();
    };
    cancelBtn.onclick = () =>
    {
        hideConfirmation();
        if (onCancel) onCancel();
    };

    const bsModal = new bootstrap.Modal(modalDiv);
    bsModal.show();

    modalDiv.addEventListener('hidden.bs.modal', () =>
    {
        hideConfirmation();
        if (onCancel) onCancel();
    }, { once: true });
}

function hideConfirmation()
{
    const modalDiv = document.getElementById('alertMsgs-confirm-modal');
    if (modalDiv)
    {
        const modal = bootstrap.Modal.getInstance(modalDiv);
        if (modal) modal.hide();
        modalDiv.remove();
    }
}

//prompt con text box
function showPrompt(message, defaultValue = '', onConfirm, onCancel = null, confirmText = 'Conferma', cancelText = 'Annulla', placeholder = '')
{
    hidePrompt();

    let modalDiv = document.getElementById('alertMsgs-prompt-modal');
    if (!modalDiv)
    {
        modalDiv = document.createElement('div');
        modalDiv.id = 'alertMsgs-prompt-modal';
        modalDiv.className = 'modal fade';
        modalDiv.tabIndex = -1;
        modalDiv.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Modifica Nota</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p id="alertMsgs-prompt-message"></p>
                        <textarea id="alertMsgs-prompt-input" class="form-control" placeholder="${placeholder}"></textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="alertMsgs-prompt-cancel-btn" data-bs-dismiss="modal">${cancelText}</button>
                        <button type="button" class="btn btn-primary" id="alertMsgs-prompt-confirm-btn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    }

    modalDiv.querySelector('#alertMsgs-prompt-message').textContent = message;
    const input = modalDiv.querySelector('#alertMsgs-prompt-input');
    input.value = defaultValue;
    input.placeholder = placeholder;

    //event listeners
    modalDiv.querySelector('#alertMsgs-prompt-confirm-btn').onclick = () =>
    {
        hidePrompt();
        if (onConfirm) onConfirm(input.value);
    };
    modalDiv.querySelector('#alertMsgs-prompt-cancel-btn').onclick = () =>
    {
        hidePrompt();
        if (onCancel) onCancel();
    };

    input.onkeydown = (e) =>
    {
        if (e.key === 'Enter' && e.ctrlKey)
        {
            hidePrompt();
            if (onConfirm) onConfirm(input.value);
        }
        if (e.key === 'Escape')
        {
            hidePrompt();
            if (onCancel) onCancel();
        }
    };

    const bsModal = new bootstrap.Modal(modalDiv);
    bsModal.show();

    //focus sull'input e posiziona il cursore alla fine in modo da poter modificare la nota già esistente
    setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 300);

    modalDiv.addEventListener('hidden.bs.modal', () =>
    {
        hidePrompt();
        if (onCancel) onCancel();
    }, { once: true });
}

function hidePrompt()
{
    const modalDiv = document.getElementById('alertMsgs-prompt-modal');
    if (modalDiv)
    {
        const modal = bootstrap.Modal.getInstance(modalDiv);
        if (modal) modal.hide();
        modalDiv.remove();
    }
}

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