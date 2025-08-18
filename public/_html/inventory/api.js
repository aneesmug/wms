// public/js/api.js

/**
 * Utility function to fetch data from API endpoints.
 * This function is the definitive source for fetchData.
 * Automatically handles JSON parsing, error responses, and injects warehouse_id.
 *
 * @param {string} url - The API endpoint URL.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {object|null} data - Request body data for POST/PUT/DELETE.
 * @returns {Promise<object|null>} - JSON response data on success, null on error.
 */
async function fetchData(url, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                // Add any necessary authentication headers (e.g., token) here if using token-based auth
            },
        };

        // Access global currentWarehouseId (defined in main.js, which should load after api.js)
        // Ensure this logic is only applied if currentWarehouseId is defined and not for auth/warehouses APIs
        if (typeof currentWarehouseId !== 'undefined' && currentWarehouseId !== null &&
            !url.includes('api/auth.php') && !url.includes('api/warehouses.php')) {
            // For GET requests, add as query parameter
            if (method === 'GET') {
                url += (url.includes('?') ? '&' : '?') + `warehouse_id=${currentWarehouseId}`;
            } else { // For POST, PUT, DELETE, add to body
                if (data) {
                    data.warehouse_id = currentWarehouseId;
                } else {
                    data = { warehouse_id: currentWarehouseId };
                }
            }
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const result = await response.json(); // Attempt to parse JSON even on error status

        if (!response.ok) {
            console.error(`API Error: ${response.status} - ${result.message || 'Unknown error'}`, result);
            showMessageBox(result.message || 'An error occurred.', 'error');

            // Handle specific multi-warehouse errors that need user intervention
            if (response.status === 400 && (result.message === 'No warehouse selected. Please select a warehouse to proceed.' || result.message === 'No warehouse selected for operation.')) {
                // If the user isn't on dashboard (where selector is), redirect to dashboard
                // Check for existence of redirectToDashboard, as it's defined in main.js
                if (typeof redirectToDashboard === 'function' && !window.location.pathname.includes('dashboard.html')) {
                    setTimeout(redirectToDashboard, 1500); // Small delay to show message
                }
            } else if (response.status === 401) { // Unauthorized, possibly session expired
                if (typeof redirectToLogin === 'function') {
                    setTimeout(redirectToLogin, 1500); // Small delay to show message
                }
            }
            return null; // Return null on any non-OK response
        }

        return result; // Return the parsed JSON data on success
    } catch (error) {
        console.error('Network or parsing error:', error);
        showMessageBox('Network error. Please check your internet connection.', 'error');
        return null; // Return null on network/parsing errors
    }
}
