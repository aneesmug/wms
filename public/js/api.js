// public/js/api.js

/**
 * Utility function to fetch data from API endpoints.
 * This function is the definitive source for fetchData.
 * Automatically handles JSON parsing, error responses, and injects warehouse_id.
 *
 * @param {string} url - The API endpoint URL.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {object|null} data - Request body data for POST/PUT/DELETE.
 * @returns {Promise<object>} - JSON response data, including on error.
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

        // Access global currentWarehouseId (defined in main.js)
        if (typeof currentWarehouseId !== 'undefined' && currentWarehouseId !== null &&
            !url.includes('api/auth.php') && !url.includes('api/warehouses_api.php')) {
            if (method === 'GET') {
                url += (url.includes('?') ? '&' : '?') + `warehouse_id=${currentWarehouseId}`;
            } else {
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
        
        // If the response is not OK, we still try to parse it for a more specific error message.
        if (!response.ok) {
            let errorPayload = { success: false, message: `API Error: Status ${response.status}` };
            try {
                // Attempt to parse the error response from the server
                const errorJson = await response.json();
                // Use the server's message if available
                errorPayload.message = errorJson.message || errorPayload.message;
            } catch (e) {
                // This catch runs if the error response is not valid JSON (e.g., HTML error page)
                console.error("Could not parse error response as JSON.", e);
            }
            
            console.error(`API Error: ${response.status} - ${errorPayload.message}`);

            // Handle specific errors that require redirection
            if (response.status === 401) { // Unauthorized
                if (typeof redirectToLogin === 'function') {
                    setTimeout(redirectToLogin, 1500);
                }
            }
            
            // CORRECTION: Always return the structured error object so the calling function doesn't crash
            return errorPayload; 
        }

        // For successful responses, return the parsed JSON
        return await response.json();
        
    } catch (error) {
        // This block catches network errors (e.g., server is down) or other exceptions
        console.error('Network or parsing error:', error);
        // On network failure, return a consistent error object to prevent crashes
        return { success: false, message: 'Network error. Please check your connection and the console.' };
    }
}
