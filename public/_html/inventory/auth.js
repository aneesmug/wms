// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    // Only set up event listener if the login form exists (i.e., we are on index.html)
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    async function handleLogin(event) {
        event.preventDefault(); // Prevent default form submission

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const data = { username, password };

        // Use the fetchData utility from main.js
        const result = await fetchData('api/auth.php?action=login', 'POST', data);

        if (result && result.success) {
            showMessageBox('Login successful!', 'success');
            // Redirect to dashboard on success. The dashboard will handle warehouse selection.
            window.location.href = 'dashboard.html';
        } 
        // Error messages are now handled globally by the fetchData function.
    }

    // Check if already authenticated on page load for index.html
    // This prevents showing the login form if a valid session already exists.
    async function checkAuthAndRedirect() {
        const result = await fetchData('api/auth.php?action=check_auth');
        if (result && result.authenticated) {
            // If authenticated, redirect to dashboard immediately
            window.location.href = 'dashboard.html';
        }
    }

    // Call this on page load only if we are on the index.html page (or the root path)
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
         checkAuthAndRedirect();
    }
});