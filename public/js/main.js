// public/js/main.js

// --- Authentication and State Management Functions ---

/**
 * Clears all session and local storage and redirects to the login page.
 */
function redirectToLogin() {
    localStorage.clear();
    window.location.href = 'index.php';
}

/**
 * Handles the logout process by showing a confirmation dialog and then calling the API.
 */
async function handleLogout() {
    // Use the SweetAlert2 confirmation modal for a better user experience.
    showConfirmationModal('Confirm Logout', 'Are you sure you want to log out?', async () => {
        const result = await fetchData('api/auth.php?action=logout', 'POST');
        if (result && result.success) {
            redirectToLogin();
        }
    });
}

/**
 * Sets the user's currently active warehouse, stores it, and reloads the page.
 * @param {string|number} id - The ID of the warehouse.
 * @param {string} name - The name of the warehouse.
 */
async function setCurrentWarehouse(id, name) {
    const result = await fetchData('api/auth.php?action=set_warehouse', 'POST', { warehouse_id: id });
    if (result && result.success) {
        localStorage.setItem('current_warehouse_id', id);
        localStorage.setItem('current_warehouse_name', name);
        localStorage.setItem('current_warehouse_role', result.role);
        window.location.reload(); // Reload to apply new role permissions and data
        return true;
    }
    return false;
}

// --- Utility Functions ---

/**
 * Fetches data from an API endpoint. This is the primary function for all server communication.
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

            if (response.status === 401) { // Unauthorized
                setTimeout(redirectToLogin, 1500);
            }
            // **FIX:** Return the result even on error so the calling function can read the message.
            return result; 
        }
        return result;
    } catch (error) {
        console.error('Network or parsing error:', error);
        showMessageBox('Network error. Please check your internet connection.', 'error');
        return null;
    }
}

/**
 * Displays a SweetAlert2 Toast message for brief notifications.
 * @param {string} message - The message to display.
 * @param {string} type - 'info', 'success', 'warning', or 'error'.
 */
function showMessageBox(message, type = 'info') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    Toast.fire({
        icon: type,
        title: message
    });
}

/**
 * Shows a generic confirmation modal using SweetAlert2.
 * @param {string} title - The title of the modal.
 * @param {string} body - The message/body of the modal.
 * @param {function} onConfirm - The callback function to execute if confirmed.
 */
function showConfirmationModal(title, body, onConfirm) {
    Swal.fire({
        title: title,
        html: body,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, confirm it!'
    }).then((result) => {
        if (result.isConfirmed) {
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        }
    });
}

// --- Common Page Setup ---

/**
 * Checks authentication status on protected pages and redirects to login if necessary.
 */
async function enforceAuthentication() {
    const isProtectedPage = !window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('index.php');
    if (isProtectedPage) {
        const authStatus = await fetchData('api/auth.php?action=check_auth');
        if (!authStatus || !authStatus.authenticated) {
            redirectToLogin();
        }
    }
}

/**
 * Attaches event listeners to common elements like logout buttons.
 */
function setupCommonEventListeners() {
    const logoutButtons = document.querySelectorAll('#logoutBtn, #logoutBtnDesktop, #logoutBtnMobile');
    logoutButtons.forEach(btn => {
        if (btn) btn.addEventListener('click', handleLogout);
    });
}

// This runs on every page load.
document.addEventListener('DOMContentLoaded', () => {
    enforceAuthentication();
    setupCommonEventListeners();
});
