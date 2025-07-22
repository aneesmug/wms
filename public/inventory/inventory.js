// public/js/inventory.js

document.addEventListener('DOMContentLoaded', () => {
    // Main elements
    const searchProductInput = document.getElementById('searchProductInput');
    const searchLocationSelect = document.getElementById('searchLocationSelect');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const openAdjustmentModalBtn = document.getElementById('openAdjustmentModalBtn');

    // DataTable instance
    let inventoryTable;

    // --- Event Listeners ---
    searchBtn.addEventListener('click', loadInventory);
    clearSearchBtn.addEventListener('click', () => {
        searchProductInput.value = '';
        searchLocationSelect.value = '';
        loadInventory();
    });
    searchLocationSelect.addEventListener('change', loadInventory);
    logoutBtn.addEventListener('click', handleLogout);
    openAdjustmentModalBtn.addEventListener('click', () => openAdjustmentModal());

    // Initialize page
    initializePage();

    // --- Core Functions ---

    /**
     * Initializes the page, loads necessary data, and sets up the DataTable.
     */
    async function initializePage() {
        if (currentWarehouseId) {
            await loadLocationsForFilterDropdown(currentWarehouseId);
            initializeDataTable();
            loadInventory(); // Initial data load
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'No Warehouse Selected',
                text: 'Please select a warehouse on the Dashboard to view inventory.',
                timer: 5000,
                timerProgressBar: true
            });
            initializeDataTable(); // Initialize empty table
        }
    }

    /**
     * Sets up the DataTable with initial configuration.
     */
    function initializeDataTable() {
        inventoryTable = $('#inventoryTable').DataTable({
            processing: true, // This enables the "Processing..." indicator element
            responsive: true,
            data: [], // Start with empty data
            columns: [
                { data: 'sku', defaultContent: 'N/A' },
                { data: 'product_name', defaultContent: 'N/A' },
                { data: 'barcode', defaultContent: 'N/A' },
                { data: 'location_code', defaultContent: 'N/A' },
                { data: 'quantity', defaultContent: '0' },
                { 
                    data: null, 
                    render: (data, type, row) => {
                        let batch = row.batch_number || 'N/A';
                        let expiry = row.expiry_date ? ` (${row.expiry_date})` : '';
                        return `${batch}${expiry}`;
                    }
                },
                { 
                    data: 'last_moved_at',
                    render: (data) => data ? new Date(data).toLocaleDateString() : 'N/A'
                },
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    render: (data, type, row) => `
                        <button class="btn btn-sm btn-primary adjust-btn" title="Adjust/Transfer this Item">
                            <i class="bi bi-pencil-square"></i>
                        </button>`
                }
            ]
        });

        // Add event listener for the action buttons inside the table
        $('#inventoryTable tbody').on('click', '.adjust-btn', function () {
            const rowData = inventoryTable.row($(this).parents('tr')).data();
            openAdjustmentModal(rowData);
        });
    }

    /**
     * Fetches inventory data from the API and refreshes the DataTable.
     */
    async function loadInventory() {
        if (!currentWarehouseId) return;

        const processingIndicator = $('#inventoryTable_processing');
        
        inventoryTable.clear().draw();
        processingIndicator.show(); // Manually show the indicator

        const product_search = searchProductInput.value.trim();
        const location_search_code = searchLocationSelect.value;

        let url = `api/inventory.php?warehouse_id=${currentWarehouseId}`;
        if (product_search) url += `&barcode=${encodeURIComponent(product_search)}`;
        if (location_search_code) url += `&location_code=${encodeURIComponent(location_search_code)}`;

        try {
            const response = await fetchData(url);
            if (response.success && Array.isArray(response.data)) {
                inventoryTable.rows.add(response.data).draw();
            } else {
                showToast('Error', response.message || 'Failed to load inventory data.', 'error');
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
            showToast('Error', 'An unexpected error occurred while fetching inventory.', 'error');
        } finally {
            processingIndicator.hide(); // Manually hide the indicator
        }
    }

    /**
     * Loads location data for the filter dropdown.
     */
    async function loadLocationsForFilterDropdown(warehouseId) {
        if (!searchLocationSelect || !warehouseId) return;
        searchLocationSelect.innerHTML = '<option value="">All Locations</option>'; // Reset
        try {
            const locationsResponse = await fetchData(`api/locations.php?warehouse_id=${warehouseId}`);
            if (locationsResponse.success && Array.isArray(locationsResponse.data)) {
                const activeLocations = locationsResponse.data.filter(loc => loc.is_active);
                activeLocations.sort((a, b) => a.location_code.localeCompare(b.location_code));
                activeLocations.forEach(location => {
                    const option = document.createElement('option');
                    option.value = location.location_code;
                    option.textContent = location.location_code;
                    searchLocationSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading locations:', error);
        }
    }

    /**
     * Opens the SweetAlert2 modal for inventory adjustment or transfer.
     * @param {object} [itemData=null] - Optional data from the selected table row.
     */
    function openAdjustmentModal(itemData = null) {
        Swal.fire({
            title: itemData ? 'Adjust / Transfer Item' : 'New Adjustment',
            html: `
                <form id="adjustForm" class="text-start">
                    <div class="row g-3">
                        <div class="col-12">
                            <label for="swal-adjustmentType" class="form-label">Adjustment Type</label>
                            <select id="swal-adjustmentType" class="form-select">
                                <option value="adjust_quantity">Adjust Quantity</option>
                                <option value="transfer">Transfer Location</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="swal-productBarcode" class="form-label">Product Barcode</label>
                            <input type="text" id="swal-productBarcode" class="form-control" value="${itemData?.barcode || ''}" required>
                        </div>
                        <div class="col-md-6">
                            <label for="swal-currentLocation" class="form-label">Current Location</label>
                            <input type="text" id="swal-currentLocation" class="form-control" value="${itemData?.location_code || ''}" required>
                        </div>
                        <div class="col-md-6">
                            <label for="swal-quantityChange" class="form-label">Quantity Change (+/-)</label>
                            <input type="number" id="swal-quantityChange" class="form-control" placeholder="e.g., 5 or -2" required>
                        </div>
                         <div class="col-md-6">
                            <label for="swal-batchNumber" class="form-label">Batch Number</label>
                            <input type="text" id="swal-batchNumber" class="form-control" value="${itemData?.batch_number || ''}">
                        </div>
                        <div id="swal-newLocationField" class="col-12" style="display: none;">
                            <label for="swal-newLocation" class="form-label">New Location Barcode</label>
                            <input type="text" id="swal-newLocation" class="form-control">
                        </div>
                    </div>
                </form>
            `,
            didOpen: () => {
                const adjustmentTypeSelect = document.getElementById('swal-adjustmentType');
                const newLocationField = document.getElementById('swal-newLocationField');
                adjustmentTypeSelect.addEventListener('change', (e) => {
                    newLocationField.style.display = e.target.value === 'transfer' ? 'block' : 'none';
                });
            },
            preConfirm: () => {
                // Collect and validate data from the modal's form before submission
                const form = Swal.getPopup().querySelector('#adjustForm');
                const data = {
                    action_type: form.querySelector('#swal-adjustmentType').value,
                    product_barcode: form.querySelector('#swal-productBarcode').value.trim(),
                    current_location_barcode: form.querySelector('#swal-currentLocation').value.trim(),
                    quantity_change: parseInt(form.querySelector('#swal-quantityChange').value, 10),
                    batch_number: form.querySelector('#swal-batchNumber').value.trim() || null,
                    new_location_barcode: form.querySelector('#swal-newLocation').value.trim() || null
                };

                if (!data.product_barcode || !data.current_location_barcode || isNaN(data.quantity_change) || data.quantity_change === 0) {
                    Swal.showValidationMessage('Product, Current Location, and a valid non-zero Quantity are required.');
                    return false;
                }
                if (data.action_type === 'transfer' && !data.new_location_barcode) {
                     Swal.showValidationMessage('New Location is required for a transfer.');
                    return false;
                }
                return data;
            },
            showCancelButton: true,
            confirmButtonText: 'Submit',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                handleInventoryAdjustment(result.value);
            }
        });
    }

    /**
     * Submits the adjustment data to the API.
     * @param {object} data - The adjustment data collected from the modal.
     */
    async function handleInventoryAdjustment(data) {
        try {
            const result = await fetchData('api/inventory.php', 'POST', data);
            if (result.success) {
                showToast('Success!', result.message, 'success');
                loadInventory(); // Refresh the table
            } else {
                showToast('Error', result.message || 'Failed to perform adjustment.', 'error');
            }
        } catch (error) {
            console.error('Error during inventory adjustment:', error);
            showToast('Error', 'An unexpected error occurred.', 'error');
        }
    }

    /**
     * Handles user logout.
     */
    async function handleLogout() {
        try {
            const result = await fetchData('api/auth.php?action=logout');
            if (result.success) {
                await showToast('Logged Out', 'You have been logged out successfully.', 'success', 1500);
                window.location.href = 'index.html';
            } else {
                showToast('Logout Failed', result.message, 'error');
            }
        } catch (error) {
            showToast('Logout Failed', 'An error occurred during logout.', 'error');
        }
    }

    /**
     * Displays a SweetAlert2 toast notification.
     */
    function showToast(title, text, icon = 'info', timer = 3000) {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: timer,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });
        return Toast.fire({ icon, title, text });
    }
});
