// public/js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const warehouseSelect = document.getElementById('warehouseSelector');
    const welcomeMessageElement = document.getElementById('welcomeMessage');
    const totalProductsElement = document.getElementById('totalProducts');
    const openInboundsElement = document.getElementById('openInbounds');
    const pendingOutboundsElement = document.getElementById('pendingOutbounds');
    const logoutBtn = document.getElementById('logoutBtn');

    // --- Initial Authentication and State Synchronization ---
    const authStatus = await fetchData('api/auth.php?action=check_auth');
    if (!authStatus || !authStatus.authenticated) {
        redirectToLogin();
        return; // Stop execution
    }

    // --- Sync Client State with Server Session ---
    if (welcomeMessageElement && authStatus.user) {
        welcomeMessageElement.textContent = `Welcome, ${authStatus.user.username}!`;
    }

    // This avoids a reload loop by syncing state from the server session first.
    currentWarehouseId = authStatus.current_warehouse_id;
    currentWarehouseName = authStatus.current_warehouse_name;
    currentWarehouseRole = authStatus.current_warehouse_role;

    if (currentWarehouseId) {
        localStorage.setItem('current_warehouse_id', currentWarehouseId);
        localStorage.setItem('current_warehouse_name', currentWarehouseName);
        localStorage.setItem('current_warehouse_role', currentWarehouseRole);
    } else {
        localStorage.clear();
    }
    
    updateWarehouseDisplay();
    // --- End Sync ---

    // --- Load Page Content ---
    await loadWarehousesForSelector();
    await loadDashboardSummary();

    // --- Event Listeners ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            await fetchData('api/auth.php?action=logout');
            redirectToLogin();
        });
    }

    if (warehouseSelect) {
        warehouseSelect.addEventListener('change', async (event) => {
            const selectedOption = event.target.options[event.target.selectedIndex];
            const id = selectedOption.value;
            const name = selectedOption.textContent;

            if (id) {
                await setCurrentWarehouse(parseInt(id), name);
            }
        });
    }

    // --- Helper Functions for Dashboard ---

    /**
     * Fetches and populates the warehouse selector dropdown.
     */
    async function loadWarehousesForSelector() {
        if (!warehouseSelect) return;

        const response = await fetchData('api/warehouses.php'); 
        warehouseSelect.innerHTML = '<option value="">Select Warehouse</option>';

        if (response && Array.isArray(response) && response.length > 0) {
            response.forEach(wh => {
                const option = document.createElement('option');
                option.value = wh.warehouse_id;
                option.textContent = wh.warehouse_name;
                
                if (currentWarehouseId && wh.warehouse_id == currentWarehouseId) {
                    option.selected = true;
                }
                warehouseSelect.appendChild(option);
            });
        } else if (response && Array.isArray(response)) {
            warehouseSelect.innerHTML = '<option value="">No warehouses assigned</option>';
            warehouseSelect.disabled = true;
        } else {
            warehouseSelect.innerHTML = '<option value="">Error loading warehouses</option>';
            warehouseSelect.disabled = true;
        }
    }

    /**
     * Fetches and updates the dashboard summary data for the current warehouse.
     */
    async function loadDashboardSummary() {
        if (!currentWarehouseId) {
            if (totalProductsElement) totalProductsElement.textContent = 'N/A';
            if (openInboundsElement) openInboundsElement.textContent = 'N/A';
            if (pendingOutboundsElement) pendingOutboundsElement.textContent = 'N/A';
            return;
        }

        const response = await fetchData('api/reports.php?action=dashboardSummary');
        
        // *** FIX: Access the summary data from the 'data' property of the response ***
        if (response?.success && response.data) {
            const summaryData = response.data;
            if (totalProductsElement) totalProductsElement.textContent = summaryData.totalProducts || '0';
            if (openInboundsElement) openInboundsElement.textContent = summaryData.openInbounds || '0';
            if (pendingOutboundsElement) pendingOutboundsElement.textContent = summaryData.pendingOutbounds || '0';
        } else {
            if (totalProductsElement) totalProductsElement.textContent = 'Error';
            if (openInboundsElement) openInboundsElement.textContent = 'Error';
            if (pendingOutboundsElement) pendingOutboundsElement.textContent = 'Error';
            showMessageBox(response?.message || 'Failed to load dashboard summary.', 'error');
        }
    }
});
