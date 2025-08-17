/*
* MODIFICATION SUMMARY:
* 1. Added a selector for the new "rememberMe" checkbox.
* 2. In `handleLogin`, the state of the checkbox is now captured.
* 3. The `remember_me` boolean value is added to the data payload sent to the login API endpoint.
*/

// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    /**
     * Handles the login form submission.
     * @param {Event} event - The form submission event.
     */
    async function handleLogin(event) {
        event.preventDefault(); // Prevent default form submission

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const rememberMeInput = document.getElementById('rememberMe'); // Get the checkbox
        
        const username = usernameInput.value;
        const password = passwordInput.value;
        const rememberMe = rememberMeInput.checked; // Check if it's checked

        if (!username || !password) {
            showMessageBox('Please enter both username and password.', 'warning');
            return;
        }

        // Add rememberMe to the data payload
        const data = { 
            username, 
            password,
            remember_me: rememberMe 
        };

        // Use the global fetchData utility from main.js
        const result = await fetchData('api/auth.php?action=login', 'POST', data);

        // After a successful login, always redirect to the dashboard.
        // The dashboard's own logic (in main.js) will handle prompting for a warehouse if needed.
        if (result && result.success) {
            showMessageBox('Login successful! Redirecting...', 'success');
            window.location.href = 'dashboard.php';
        } else if (result && result.message) {
            // Display the specific error message from the server
            showMessageBox(result.message, 'error');
        } else {
            // Fallback for unexpected errors
            showMessageBox('An unexpected error occurred during login.', 'error');
        }
    }

    /**
     * Checks if a user is already logged in (via session or remember-me cookie) 
     * and redirects them to the dashboard.
     */
    async function checkAuthAndRedirect() {
        // This call doesn't need error handling as it's just a check.
        // If it fails, the user simply stays on the login page.
        const result = await fetchData('api/auth.php?action=check_auth');
        if (result && result.authenticated) {
            window.location.href = 'dashboard.php';
        }
    }

    // Attach the login handler to the form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Check for an existing session or valid remember-me token when the page loads
    checkAuthAndRedirect();
});
