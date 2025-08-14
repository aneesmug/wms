document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Element Selectors ---
    const warehouseSelector = document.getElementById('warehouseSelector');
    
    // Stat Card Elements
    const totalProductsElement = document.getElementById('totalProducts');
    const openInboundsElement = document.getElementById('openInbounds');
    const pendingOutboundsElement = document.getElementById('pendingOutbounds');
    const shippedTodayElement = document.getElementById('shippedToday');
    const receivedTodayElement = document.getElementById('receivedToday');
    const activeLocationsElement = document.getElementById('activeLocations');
    const stockValueElement = document.getElementById('stockValue');
    const returnsTodayElement = document.getElementById('returnsToday');
    const pendingPickElement = document.getElementById('pendingPick');

    
    // Chart and Table Elements
    const activityChartCanvas = document.getElementById('activityChart');
    let activityChart = null; // To hold the chart instance
    const fastMovingItemsTableBody = document.getElementById('fastMovingItemsTableBody');


    // --- Main Initialization Function ---
    const initializeDashboard = async () => {
        const authStatus = await fetchData('api/auth.php?action=check_auth');
        if (!authStatus || !authStatus.authenticated) {
            return; 
        }

        await populateWarehouseSelector();

        await setupQuickActionsVisibility();

        const currentWarehouseId = localStorage.getItem('current_warehouse_id');
        if (currentWarehouseId) {
            await loadDashboardData();
        } else {
            resetAllStats();
            clearChart();
            if (fastMovingItemsTableBody) fastMovingItemsTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Please select a warehouse.</td></tr>';
            showMessageBox('Please select a warehouse to view dashboard data.', 'info');
        }
    };

    // --- Data Loading Functions ---

    const populateWarehouseSelector = async () => {
        if (!warehouseSelector) return;

        const result = await fetchData('api/auth.php?action=get_user_warehouses');
        
        warehouseSelector.innerHTML = '<option value="">Select a Warehouse...</option>';
        
        if (result && result.success && result.warehouses.length > 0) {
            result.warehouses.forEach(wh => {
                const option = document.createElement('option');
                option.value = wh.warehouse_id;
                option.textContent = wh.warehouse_name;
                warehouseSelector.appendChild(option);
            });

            const storedWarehouseId = localStorage.getItem('current_warehouse_id');

            if (result.warehouses.length === 1) {
                const singleWarehouse = result.warehouses[0];
                if (storedWarehouseId != singleWarehouse.warehouse_id) {
                    await setCurrentWarehouse(singleWarehouse.warehouse_id, singleWarehouse.warehouse_name);
                } else {
                    warehouseSelector.value = storedWarehouseId;
                }
            } else {
                if (storedWarehouseId) {
                    warehouseSelector.value = storedWarehouseId;
                }
            }
        } else {
            warehouseSelector.innerHTML = '<option value="">No warehouses assigned</option>';
            warehouseSelector.disabled = true;
        }
    };

    const loadDashboardData = async () => {
        await loadDashboardSummary();
        await loadActivityChart();
        await loadFastMovingItems();
    };

    const loadDashboardSummary = async () => {
        const result = await fetchData('api/reports_api.php?action=dashboardSummary');
        
        if (result && result.success && result.data) {
            const data = result.data;
            totalProductsElement.textContent = data.totalProducts || '0';
            openInboundsElement.textContent = data.openInbounds || '0';
            pendingOutboundsElement.textContent = data.pendingOutbounds || '0';
            shippedTodayElement.textContent = data.shippedToday || '0';
            receivedTodayElement.textContent = data.receivedToday || '0';
            activeLocationsElement.textContent = data.activeLocations || '0';

            // New Stats
            stockValueElement.textContent = data.stockValue ? `SAR ${parseFloat(data.stockValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'SAR 0.00';
            returnsTodayElement.textContent = data.returnsToday || '0';
            pendingPickElement.textContent = data.pendingPick || '0';

        } else {
            resetAllStats();
            console.error('Failed to load dashboard summary:', result?.message);
        }
    };

    const loadActivityChart = async () => {
        if (!activityChartCanvas) return;

        if (activityChart) {
            activityChart.destroy();
        }

        const result = await fetchData('api/reports_api.php?action=getWeeklyActivity');

        if (result && result.success && result.data) {
            const chartData = result.data;
            activityChart = new Chart(activityChartCanvas, {
                type: 'bar',
                data: {
                    labels: chartData.labels.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                    datasets: chartData.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: { mode: 'index', intersect: false }
                    }
                }
            });
        } else {
            clearChart();
            console.error('Failed to load chart data:', result?.message);
        }
    };

    const loadFastMovingItems = async () => {
        if (!fastMovingItemsTableBody) return;
        fastMovingItemsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Loading...</td></tr>';
        try {
            const response = await fetchData('api/reports_api.php?action=getFastMovingItems');
            fastMovingItemsTableBody.innerHTML = '';
            if (response?.success && Array.isArray(response.data)) {
                if (response.data.length === 0) {
                    fastMovingItemsTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No picking data from the last 30 days.</td></tr>';
                    return;
                }
                response.data.forEach(item => {
                    const row = fastMovingItemsTableBody.insertRow();
                    row.innerHTML = `
                        <td>${item.sku}</td>
                        <td>${item.product_name}</td>
                        <td class="text-end fw-bold">${item.total_units_picked}</td>
                    `;
                });
            } else {
                 fastMovingItemsTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Could not load data.</td></tr>`;
            }
        } catch (error) {
            console.error("Failed to load fast-moving items:", error);
            fastMovingItemsTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error loading data.</td></tr>`;
        }
    };

    // --- UI Helper Functions ---

    const resetAllStats = () => {
        const allStatElements = [
            totalProductsElement, openInboundsElement, pendingOutboundsElement,
            shippedTodayElement, receivedTodayElement, activeLocationsElement,
            stockValueElement, returnsTodayElement, pendingPickElement
        ];
        allStatElements.forEach(el => {
            if (el) {
                if (el.id === 'stockValue') {
                    el.textContent = '---';
                } else {
                    el.textContent = '---';
                }
            }
        });
    };

    const clearChart = () => {
        if (!activityChartCanvas) return;
        const ctx = activityChartCanvas.getContext('2d');
        ctx.clearRect(0, 0, activityChartCanvas.width, activityChartCanvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6c757d';
        ctx.fillText('No data to display. Please select a warehouse.', activityChartCanvas.width / 2, 50);
    };

    // --- Event Listeners ---
    
    const handleWarehouseChange = async () => {
        const warehouseId = warehouseSelector.value;
        if (warehouseId) {
            const warehouseName = warehouseSelector.options[warehouseSelector.selectedIndex].text;
            await setCurrentWarehouse(warehouseId, warehouseName);
        }
    };

    if (warehouseSelector) {
        warehouseSelector.addEventListener('change', handleWarehouseChange);
    }

    async function setupQuickActionsVisibility() {
        const quickActionsSection = document.getElementById('quickActionsSection');
        if (!quickActionsSection) {
            console.error('Quick Actions section not found.');
            return;
        }

        // Fetch the latest authentication status from the server.
        // This provides both the global admin status and the current role for the selected warehouse.
        const authStatus = await fetchData('api/auth.php?action=check_auth');

        if (authStatus && authStatus.authenticated) {
            const isGlobalAdmin = authStatus.user.is_global_admin;
            const userRole = authStatus.current_warehouse_role;

            // Define the roles that are allowed to see the Quick Actions.
            const allowedRoles = ['manager', 'operator'];

            // Show the section if the user is a global admin or has one of the allowed roles.
            if (isGlobalAdmin || (userRole && allowedRoles.includes(userRole))) {
                quickActionsSection.style.display = 'block';
            } else {
                quickActionsSection.style.display = 'none';
            }
        }
    }

    // --- Run Initialization ---
    initializeDashboard();
});
