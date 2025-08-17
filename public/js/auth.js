/*
* MODIFICATION SUMMARY:
* 1. The `handleLogin` function now checks for the new `error_code` from the API.
* 2. If the error is 'USERNAME_NOT_FOUND', it displays the message, clears both fields, and reloads the page as requested.
* 3. If the error is 'INCORRECT_PASSWORD', it displays the message and clears only the password field, without reloading.
* 4. This provides the specific user experience you requested for different types of login failures.
*/

// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = loginForm.querySelector('button[type="submit"]');

    if (usernameInput) {
        usernameInput.addEventListener('input', () => {
            usernameInput.value = usernameInput.value.replace(/\s/g, '');
        });
    }

    /**
     * Handles the login form submission.
     * @param {Event} event - The form submission event.
     */
    async function handleLogin(event) {
        event.preventDefault();

        const username = usernameInput.value;
        const password = passwordInput.value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!username || !password) {
            showMessageBox('Please enter both username and password.', 'warning');
            return;
        }

        const originalButtonHTML = loginButton.innerHTML;
        loginButton.disabled = true;
        loginButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Signing In...`;

        const data = { 
            username, 
            password,
            remember_me: rememberMe 
        };

        const result = await fetchData('api/auth.php?action=login', 'POST', data);

        loginButton.disabled = false;
        loginButton.innerHTML = originalButtonHTML;

        if (result && result.success) {
            showMessageBox('Login successful! Redirecting...', 'success');
            window.location.href = 'dashboard.php';
        } else if (result && result.error_code) {
            // Handle specific errors
            showMessageBox(result.message, 'error');
            if (result.error_code === 'USERNAME_NOT_FOUND') {
                // Clear both fields and reload
                usernameInput.value = '';
                passwordInput.value = '';
                // Use a short timeout to allow the user to see the message before reload
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else if (result.error_code === 'INCORRECT_PASSWORD') {
                // Clear only password and focus
                passwordInput.value = '';
                passwordInput.focus();
            }
        } else {
            // Fallback for generic or network errors
            showMessageBox(result.message || 'An unexpected error occurred.', 'error');
        }
    }

    /**
     * Checks if a user is already logged in and redirects them to the dashboard.
     */
    async function checkAuthAndRedirect() {
        const result = await fetchData('api/auth.php?action=check_auth');
        if (result && result.authenticated) {
            window.location.href = 'dashboard.php';
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    checkAuthAndRedirect();
});
