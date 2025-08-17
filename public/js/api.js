/*
* MODIFICATION SUMMARY:
* 1. The global `fetchData` function has been modified to be activity-aware.
* 2. Before making any API call, it now checks for the existence of `resetInactivityTimer`.
* 3. If the function exists (i.e., on a protected page), it calls it.
* 4. This ensures that any action resulting in a server request (saving, fetching data, etc.) is treated as user activity and resets the 30-minute session lock timer.
*/

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
    // Any API call is considered user activity, so reset the inactivity timer.
    if (typeof resetInactivityTimer === 'function') {
        resetInactivityTimer();
    }

    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const currentWarehouseId = localStorage.getItem('current_warehouse_id');
        if (currentWarehouseId && !url.includes('api/auth.php') && !url.includes('api/warehouses_api.php')) {
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
        
        if (!response.ok) {
            let errorPayload = { success: false, message: `API Error: Status ${response.status}` };
            try {
                const errorJson = await response.json();
                errorPayload.message = errorJson.message || errorPayload.message;
            } catch (e) {
                console.error("Could not parse error response as JSON.", e);
            }
            
            console.error(`API Error: ${response.status} - ${errorPayload.message}`);

            if (response.status === 401) {
                if (typeof redirectToLogin === 'function') {
                    setTimeout(redirectToLogin, 1500);
                }
            }
            
            return errorPayload; 
        }

        return await response.json();
        
    } catch (error) {
        console.error('Network or parsing error:', error);
        return { success: false, message: 'Network error. Please check your connection and the console.' };
    }
}
