// public/js/inventory.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const searchProductInput = document.getElementById('searchProductInput');
    const searchLocationSelect = document.getElementById('searchLocationSelect');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let allProducts = [];
    let allLocationsData = [];
    let inventoryDataTable;

    // --- SweetAlert2 Toast Notification ---
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
    
    // Initialize page
    initializePage();

    // --- Event Listeners ---
    if (searchBtn) searchBtn.addEventListener('click', loadInventory);
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchProductInput.value = '';
            searchLocationSelect.value = '';
            loadInventory();
        });
    }
    if (searchLocationSelect) searchLocationSelect.addEventListener('change', loadInventory);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);


    // --- Core Initialization Function ---
    async function initializePage() {
        initializeDataTable();
        if (currentWarehouseId) {
            await loadProductsForDropdown();
            await loadAllLocationsData(currentWarehouseId);
            await loadLocationsForFilterDropdown(currentWarehouseId);
            await loadInventory();
        } else {
            Toast.fire({ icon: 'warning', title: 'Please select a warehouse on the Dashboard.' });
            if (searchLocationSelect) searchLocationSelect.innerHTML = '<option value="">Select a warehouse first.</option>';
        }
    }

    function initializeDataTable() {
        if ($.fn.DataTable.isDataTable('#inventoryTable')) {
            $('#inventoryTable').DataTable().destroy();
        }
        
        inventoryDataTable = $('#inventoryTable').DataTable({
            responsive: true,
            searching: false,
            lengthChange: true,
            pageLength: 10,
            order: [[1, 'asc']],
            columns: [
                { data: 'sku' },
                { data: 'product_name' },
                { data: 'barcode' },
                { data: 'location' },
                { data: 'quantity' },
                { data: 'batch_expiry' },
                { data: 'last_moved' },
                { data: 'actions', orderable: false, searchable: false }
            ],
            processing: true, 
            serverSide: false
        });
    }

    // --- Data Loading Functions ---
    async function loadProductsForDropdown() {
        try {
            const productsResponse = await fetchData('api/products_api.php');
            allProducts = productsResponse.data || [];
        } catch (error) {
            console.error('Error loading products:', error);
            Toast.fire({ icon: 'error', title: 'Error loading product data.' });
        }
    }

    async function loadAllLocationsData(warehouseId) {
        if (!warehouseId) return;
        try {
            const locationsResponse = await fetchData(`api/locations_api.php?warehouse_id=${warehouseId}`);
            allLocationsData = locationsResponse.data || [];
        } catch (error) {
            console.error('Error loading locations data:', error);
            Toast.fire({ icon: 'error', title: 'Error loading location data.' });
        }
    }

    async function loadLocationsForFilterDropdown(warehouseId) {
        if (!searchLocationSelect || !warehouseId) return;
        searchLocationSelect.innerHTML = '<option value="">All Locations</option>';

        if (Array.isArray(allLocationsData)) {
            allLocationsData
                .filter(loc => loc.is_active)
                .sort((a, b) => a.location_code.localeCompare(b.location_code))
                .forEach(location => {
                    const option = document.createElement('option');
                    option.value = location.location_code;
                    option.textContent = location.location_code;
                    searchLocationSelect.appendChild(option);
                });
        }
    }

    async function loadInventory() {
        if (!currentWarehouseId) return;
        
        $('.dataTables_processing', inventoryDataTable.table().container()).show();

        const product_search_barcode = searchProductInput.value.trim();
        const location_search_code = searchLocationSelect.value;

        let url = 'api/inventory_api.php?';
        const queryParams = [];

        if (product_search_barcode) {
            const product = allProducts.find(p => p.barcode === product_search_barcode || p.sku === product_search_barcode);
            if (product) {
                queryParams.push(`product_id=${product.product_id}`);
            } else {
                Toast.fire({ icon: 'warning', title: `Product "${product_search_barcode}" not found.` });
                inventoryDataTable.clear().draw();
                $('.dataTables_processing', inventoryDataTable.table().container()).hide();
                return;
            }
        }
        if (location_search_code) {
            queryParams.push(`location_code=${encodeURIComponent(location_search_code)}`);
        }
        
        url += queryParams.join('&');
        
        try {
            const response = await fetchData(url);
            if (response.success && Array.isArray(response.data)) {
                populateDataTable(response.data);
            } else {
                 Toast.fire({ icon: 'error', title: response.message || 'Failed to load inventory.' });
                 inventoryDataTable.clear().draw();
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
            Toast.fire({ icon: 'error', title: 'An error occurred while loading inventory.' });
            inventoryDataTable.clear().draw();
        } finally {
            $('.dataTables_processing', inventoryDataTable.table().container()).hide();
        }
    }

    function populateDataTable(inventoryItems) {
        const rows = inventoryItems.map(item => {
            const lastMovedDate = item.last_moved_at ? new Date(item.last_moved_at).toLocaleDateString() : 'N/A';
            const batchExpiry = `${item.batch_number || 'N/A'}${item.expiry_date ? ` (${item.expiry_date})` : ''}`;
            const canAdjust = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';

            return {
                sku: item.sku,
                product_name: item.product_name,
                barcode: item.barcode || 'N/A',
                location: item.location_code,
                quantity: item.quantity,
                batch_expiry: batchExpiry,
                last_moved: lastMovedDate,
                actions: canAdjust ? `<button class="btn btn-sm btn-info text-white adjust-btn" 
                                data-product-id="${item.product_id}"
                                data-product-barcode="${item.barcode}" 
                                data-location-code="${item.location_code}"
                                data-batch-number="${item.batch_number || ''}"
                                data-expiry-date="${item.expiry_date || ''}"
                                title="Adjust/Transfer">
                                <i class="bi bi-gear"></i>
                         </button>` : '<span class="text-muted">View Only</span>'
            };
        });

        inventoryDataTable.clear();
        inventoryDataTable.rows.add(rows).draw();
        
        $('#inventoryTable tbody').off('click', '.adjust-btn').on('click', '.adjust-btn', openAdjustmentModal);
    }

    async function openAdjustmentModal(event) {
        const button = event.currentTarget;
        const productId = button.dataset.productId;
        const productBarcode = button.dataset.productBarcode;
        const locationCode = button.dataset.locationCode;
        const batchNumber = button.dataset.batchNumber;
        const expiryDate = button.dataset.expiryDate;

        const { value: formValues } = await Swal.fire({
            title: 'Inventory Adjustment / Transfer',
            html: `
                <form id="adjustForm" class="text-start">
                    <input type="hidden" id="swalProductId" value="${productId}">
                    <div class="mb-3">
                        <label for="swalAdjustmentType" class="form-label">Adjustment Type</label>
                        <select id="swalAdjustmentType" class="form-select">
                            <option value="adjust_quantity" selected>Adjust Quantity</option>
                            <option value="transfer">Transfer Location</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustProductBarcode" class="form-label">Product Barcode</label>
                        <input type="text" id="swalAdjustProductBarcode" class="form-control" value="${productBarcode}" readonly>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustCurrentLocation" class="form-label">Current Location</label>
                        <select id="swalAdjustCurrentLocation" class="form-select" style="width:100%;"></select>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustQuantity" class="form-label">Quantity</label>
                        <input type="number" id="swalAdjustQuantity" class="form-control" placeholder="e.g., 5 for add/transfer, -2 for remove" required>
                    </div>
                     <div class="mb-3">
                        <label for="swalAdjustBatchNumber" class="form-label">Batch Number</label>
                        <input type="text" id="swalAdjustBatchNumber" class="form-control" value="${batchNumber}" readonly>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustExpiryDate" class="form-label">Expiry Date</label>
                        <input type="date" id="swalAdjustExpiryDate" value="${expiryDate}" class="form-control" readonly>
                    </div>
                    <div id="swalNewLocationField" class="mb-3 d-none">
                        <label for="swalAdjustNewLocation" class="form-label">New Location</label>
                        <select id="swalAdjustNewLocation" class="form-select" style="width:100%;"></select>
                    </div>
                </form>`,
            confirmButtonText: 'Submit',
            showCancelButton: true,
            focusConfirm: false,
            didOpen: async () => {
                const popup = Swal.getPopup();
                const adjustmentTypeSelect = popup.querySelector('#swalAdjustmentType');
                const newLocationField = popup.querySelector('#swalNewLocationField');
                const currentLocationSelect = $('#swalAdjustCurrentLocation');
                const newLocationSelect = $('#swalAdjustNewLocation');

                const initializeSelect2 = (selector, placeholder) => {
                    selector.select2({
                        placeholder: placeholder,
                        dropdownParent: $('.swal2-popup'),
                        theme: 'bootstrap-5',
                        templateResult: formatLocation,
                        templateSelection: formatLocationSelection,
                        escapeMarkup: function(markup) { return markup; } // Allow HTML in results
                    });
                };
                
                initializeSelect2(currentLocationSelect, 'Select current location');
                initializeSelect2(newLocationSelect, 'Select new location');

                const locationStock = await fetchData(`api/inventory_api.php?action=location_stock&product_id=${productId}`);
                
                if(locationStock.success) {
                    populateLocationSelect(currentLocationSelect, locationStock.data, locationCode);
                    populateLocationSelect(newLocationSelect, locationStock.data, null);
                }

                adjustmentTypeSelect.addEventListener('change', (e) => {
                    if (e.target.value === 'transfer') {
                        newLocationField.classList.remove('d-none');
                    } else {
                        newLocationField.classList.add('d-none');
                    }
                });
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                return {
                    action_type: popup.querySelector('#swalAdjustmentType').value,
                    product_id: popup.querySelector('#swalProductId').value,
                    product_barcode: popup.querySelector('#swalAdjustProductBarcode').value,
                    current_location_barcode: $('#swalAdjustCurrentLocation').val(),
                    quantity_change: popup.querySelector('#swalAdjustQuantity').value,
                    new_location_barcode: $('#swalAdjustNewLocation').val(),
                    batch_number: popup.querySelector('#swalAdjustBatchNumber').value,
                    expiry_date: popup.querySelector('#swalAdjustExpiryDate').value,
                };
            }
        });

        if (formValues) {
            handleInventoryAdjustment(formValues);
        }
    }

    function populateLocationSelect(selectElement, locations, selectedValue) {
        selectElement.empty();
        selectElement.append(new Option('', '', false, false));

        locations.forEach(loc => {
            const option = new Option(loc.location_code, loc.location_code, false, false);
            option.dataset.html = loc.availability_html;
            option.dataset.available = loc.available_capacity;

            if (loc.available_capacity !== null && loc.available_capacity <= 0 && loc.location_code !== selectedValue) {
                option.disabled = true;
            }

            selectElement.append(option);
        });

        if (selectedValue) {
            selectElement.val(selectedValue).trigger('change');
        }
    }

    function formatLocation(location) {
        if (!location.id) {
            return location.text;
        }
        
        const html = location.element.dataset.html;
        return $(`<div class="d-flex justify-content-between"><span>${location.text}</span>${html}</div>`);
    }

    function formatLocationSelection(location) {
        return location.id || location.text;
    }

    async function handleInventoryAdjustment(data) {
        const quantityChange = parseInt(data.quantity_change, 10);
        if (isNaN(quantityChange) || quantityChange === 0) {
            Toast.fire({ icon: 'error', title: 'Quantity must be a valid non-zero number.' });
            return;
        }
        
        if(data.action_type === 'transfer' && quantityChange <= 0) {
             Toast.fire({ icon: 'error', title: 'Transfer quantity must be a positive number.' });
            return;
        }

        try {
            // A properly implemented fetchData will throw an exception for non-2xx responses,
            // which will be caught by the catch block below.
            const result = await fetchData('api/inventory_api.php', 'POST', data);
            
            // This block only executes for successful (2xx) responses from the server.
            if (result && result.success) {
                Swal.fire('Success!', result.message, 'success');
                await loadInventory();
                await loadAllLocationsData(currentWarehouseId);
                await loadLocationsForFilterDropdown(currentWarehouseId);
            } else {
                 // This handles cases where the server returns 200 OK but with a logical failure.
                 Swal.fire('Error!', result ? result.message : 'An unknown error occurred.', 'error');
            }
        } catch (error) {
            // This block catches network errors and HTTP errors (like 400, 500).
            console.error('Error during inventory adjustment:', error);
            // The error.message should contain the detailed message from the server.
            Swal.fire('API Error', error.message || 'Failed to perform adjustment. Please check the console.', 'error');
        }
    }

    async function handleLogout() {
        Swal.fire({
            title: 'Are you sure you want to logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, logout!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await fetchData('api/auth.php?action=logout');
                redirectToLogin();
            }
        });
    }
});
