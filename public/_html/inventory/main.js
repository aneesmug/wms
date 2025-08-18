// public/js/main.js

// Global variables to store current session info, sourced from localStorage
let currentWarehouseId = localStorage.getItem('current_warehouse_id') || null;
let currentWarehouseName = localStorage.getItem('current_warehouse_name') || null;
let currentWarehouseRole = localStorage.getItem('current_warehouse_role') || null;

/**
 * Fetches data from an API endpoint.
 * @param {string} url - The API endpoint URL.
 * @param {string} method - HTTP method.
 * @param {object|null} data - Request body data.
 * @returns {Promise<object|null>} JSON response data or null on error.
 */
async function fetchData(url, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            console.error(`API Error: ${response.status} - ${result.message || 'Unknown error'}`);
            showMessageBox(result.message || `An error occurred (Status: ${response.status})`, 'error');

            if (response.status === 401) {
                setTimeout(redirectToLogin, 1500);
            } else if (response.status === 400 && result.message && result.message.includes('No warehouse selected')) {
                if (!window.location.pathname.includes('dashboard.html')) {
                    setTimeout(redirectToDashboard, 1500);
                }
            }
            return null;
        }
        return result;
    } catch (error) {
        console.error('Network or parsing error:', error);
        showMessageBox('Network error. Please check your internet connection.', 'error');
        return null;
    }
}

/**
 * Displays a Bootstrap 5 Toast message.
 * @param {string} message - The message to display.
 * @param {string} type - 'info', 'success', 'warning', or 'error'.
 * @param {number} duration - How long the toast should be visible.
 */
function showMessageBox(message, type = 'info', duration = 5000) {
    const messageBoxContainer = document.getElementById('messageBox');
    if (!messageBoxContainer) return;

    const toastId = 'toast-' + Date.now();
    const toastHeaderClass = {
        success: 'bg-success text-white',
        error: 'bg-danger text-white',
        warning: 'bg-warning text-dark',
        info: 'bg-info text-white'
    }[type] || 'bg-secondary text-white';

    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${duration}">
            <div class="toast-header ${toastHeaderClass}">
                <i class="bi bi-info-circle-fill me-2"></i>
                <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;

    messageBoxContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });

    toast.show();
}

/**
 * Shows a generic confirmation modal.
 * @param {string} title - The title of the modal.
 * @param {string} body - The message/body of the modal.
 * @param {function} onConfirm - The callback function to execute if confirmed.
 */
function showConfirmationModal(title, body, onConfirm) {
    let modalElement = document.getElementById('confirmationModal');
    if (!modalElement) {
        const modalHtml = `
            <div class="modal fade" id="confirmationModal" tabindex="-1" aria-labelledby="confirmationModalLabel" aria-hidden="true">
              <div class="modal-dialog">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title" id="confirmationModalLabel"></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body" id="confirmationModalBody"></div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" id="confirmActionBtn" class="btn btn-primary">Confirm</button>
                  </div>
                </div>
              </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modalElement = document.getElementById('confirmationModal');
    }
    
    const modalTitle = modalElement.querySelector('.modal-title');
    const modalBody = modalElement.querySelector('.modal-body');
    const confirmBtn = modalElement.querySelector('#confirmActionBtn');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    // Clone and replace the button to remove old event listeners safely
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        if(typeof onConfirm === 'function') {
            onConfirm();
        }
        modal.hide();
    }, { once: true }); // Ensure the listener only fires once

    modal.show();
}

// Redirect and state management functions
function redirectToLogin() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function redirectToDashboard() {
    window.location.href = 'dashboard.html';
}

async function setCurrentWarehouse(id, name) {
    const result = await fetchData('api/auth.php?action=set_warehouse', 'POST', { warehouse_id: id });
    if (result && result.success) {
        localStorage.setItem('current_warehouse_id', id);
        localStorage.setItem('current_warehouse_name', name);
        localStorage.setItem('current_warehouse_role', result.role);
        window.location.reload();
        return true;
    }
    return false;
}

function updateWarehouseDisplay() {
    const displayElement = document.getElementById('currentWarehouseNameDisplay');
    if (displayElement) {
        currentWarehouseName = localStorage.getItem('current_warehouse_name');
        currentWarehouseRole = localStorage.getItem('current_warehouse_role');
        if (currentWarehouseName && currentWarehouseRole) {
            displayElement.textContent = `${currentWarehouseName} (Role: ${currentWarehouseRole})`;
        } else {
            displayElement.textContent = 'No Warehouse Selected';
        }
    }
}

// Common setup for all pages
document.addEventListener('DOMContentLoaded', () => {
    updateWarehouseDisplay();
    const isProtectedPage = !window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('index.html');
    if (isProtectedPage) {
        fetchData('api/auth.php?action=check_auth').then(authStatus => {
            if (!authStatus || !authStatus.authenticated) {
                redirectToLogin();
            }
        });
    }
});
