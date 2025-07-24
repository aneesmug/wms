// public/js/inventory.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const searchProductInput = document.getElementById('searchProductInput');
    const searchLocationSelect = document.getElementById('searchLocationSelect');
    // MODIFICATION: Get the new tire type select element
    const searchTireTypeSelect = document.getElementById('searchTireTypeSelect');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    let allProducts = [];
    let inventoryDataTable;
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');

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
    
    initializePage();

    // --- Event Listeners ---
    if (searchBtn) searchBtn.addEventListener('click', loadInventory);
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchProductInput.value = '';
            searchLocationSelect.value = '';
            // MODIFICATION: Clear the tire type filter
            searchTireTypeSelect.value = '';
            loadInventory();
        });
    }
    if (searchLocationSelect) searchLocationSelect.addEventListener('change', loadInventory);
    // MODIFICATION: Add event listener for the new filter
    if (searchTireTypeSelect) searchTireTypeSelect.addEventListener('change', loadInventory);

    async function initializePage() {
        initializeDataTable();
        if (currentWarehouseId) {
            await loadProductsForDropdown();
            await loadLocationsForFilterDropdown(currentWarehouseId);
            // MODIFICATION: Load tire types for the new filter
            await loadTireTypesForFilter();
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
            responsive: true, searching: false, lengthChange: true,
            pageLength: 10, order: [[1, 'asc']],
            columns: [
                { data: 'sku' }, { data: 'product_name' }, { data: 'barcode' },
                { data: 'location' }, { data: 'quantity' }, { data: 'batch_expiry' },
                { data: 'last_moved' }, { data: 'actions', orderable: false, searchable: false }
            ],
            processing: true, serverSide: false
        });
    }

    async function loadProductsForDropdown() {
        try {
            const productsResponse = await fetchData('api/products_api.php');
            allProducts = productsResponse.data || [];
        } catch (error) {
            console.error('Error loading products:', error);
            Toast.fire({ icon: 'error', title: 'Error loading product data.' });
        }
    }

    async function loadLocationsForFilterDropdown(warehouseId) {
        if (!searchLocationSelect || !warehouseId) return;
        try {
            const response = await fetchData(`api/locations_api.php?warehouse_id=${warehouseId}`);
            if (response.success && Array.isArray(response.data)) {
                searchLocationSelect.innerHTML = '<option value="">All Locations</option>';
                response.data
                    .filter(loc => loc.is_active)
                    .sort((a, b) => a.location_code.localeCompare(b.location_code))
                    .forEach(location => {
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

    // MODIFICATION: New function to load and populate the tire type filter
    async function loadTireTypesForFilter() {
        if (!searchTireTypeSelect) return;
        try {
            // This API endpoint already exists in products_api.php
            const response = await fetchData('api/products_api.php?action=get_tire_types');
            if (response.success && Array.isArray(response.data)) {
                searchTireTypeSelect.innerHTML = '<option value="">All Tire Types</option>';
                response.data.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.tire_type_id; // Use ID for filtering
                    option.textContent = type.tire_type_name;
                    searchTireTypeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading tire types:', error);
        }
    }

    async function loadInventory() {
        if (!currentWarehouseId) return;
        $('.dataTables_processing', inventoryDataTable.table().container()).show();
        const product_search_barcode = searchProductInput.value.trim();
        const location_search_code = searchLocationSelect.value;
        // MODIFICATION: Get the selected tire type ID
        const tire_type_id = searchTireTypeSelect.value;

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
        // MODIFICATION: Add tire_type_id to the query parameters if selected
        if (tire_type_id) {
            queryParams.push(`tire_type_id=${tire_type_id}`);
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

    // ... rest of the file remains the same (populateDataTable, openAdjustmentModal, etc.)
    // ... I am omitting it for brevity but it should be included in the final file.
    
    function populateDataTable(inventoryItems) {
        const rows = inventoryItems.map(item => {
            const lastMovedDate = item.last_moved_at ? new Date(item.last_moved_at).toLocaleDateString() : 'N/A';
            const canAdjust = currentWarehouseRole === 'manager';
            let expiryHtml = '';
            if (item.dot_code) {
                expiryHtml += `DOT: ${item.dot_code}`;
                if (item.calculated_expiry_date) {
                    const expiryDate = new Date(item.calculated_expiry_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    let badgeClass = 'bg-success';
                    if (expiryDate < today) badgeClass = 'bg-danger';
                    else {
                        const oneMonthFromNow = new Date(today);
                        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
                        if (expiryDate < oneMonthFromNow) badgeClass = 'bg-warning text-dark';
                    }
                    expiryHtml += ` <span class="badge ${badgeClass}">Expires: ${item.calculated_expiry_date}</span>`;
                }
            } else {
                expiryHtml = 'N/A';
            }
            const batchExpiry = `<div>${item.batch_number || 'N/A'}</div><div>${expiryHtml}</div>`;
            return {
                sku: item.sku || '<span class="text-danger">Missing Product</span>',
                product_name: item.product_name || '<span class="text-danger">Missing Product</span>',
                barcode: item.barcode || 'N/A',
                location: item.location_code || '<span class="text-danger">Missing Location</span>',
                quantity: item.quantity,
                batch_expiry: batchExpiry,
                last_moved: lastMovedDate,
                actions: canAdjust ? `<button class="btn btn-sm btn-info text-white adjust-btn" 
                                data-product-id="${item.product_id}" data-product-barcode="${item.barcode || ''}" 
                                data-location-code="${item.location_code || ''}" data-batch-number="${item.batch_number || ''}"
                                data-dot-code="${item.dot_code || ''}" data-current-quantity="${item.quantity}"
                                title="Adjust/Transfer">
                                <i class="bi bi-gear"></i></button>` : '<span class="text-muted">View Only</span>'
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
        const dotCode = button.dataset.dotCode;
        const currentQuantity = button.dataset.currentQuantity;

        if (!locationCode) {
            Swal.fire('Action Denied', 'Cannot adjust an item with a missing or invalid location.', 'error');
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: 'Inventory Adjustment / Transfer',
            html: `
                <form id="adjustForm" class="text-start">
                    <input type="hidden" id="swalProductId" value="${productId}">
                    <div class="mb-3">
                        <label for="swalAdjustmentType" class="form-label">Action</label>
                        <select id="swalAdjustmentType" class="form-select">
                            <option value="adjust_quantity" selected>Adjust Quantity</option>
                            <option value="transfer">Transfer (Same Warehouse)</option>
                            <option value="transfer_inter_warehouse">Transfer Warehouse</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustProductBarcode" class="form-label">Product Barcode</label>
                        <input type="text" id="swalAdjustProductBarcode" class="form-control" value="${productBarcode}" readonly>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="swalAdjustCurrentLocation" class="form-label">From Location</label>
                            <input type="text" id="swalAdjustCurrentLocation" class="form-control" value="${locationCode}" readonly>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Current Qty at Location</label>
                            <input type="text" class="form-control" value="${currentQuantity}" readonly style="font-weight: bold; background-color: #e9ecef;">
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustQuantity" class="form-label">Quantity to Move</label>
                        <input type="number" id="swalAdjustQuantity" class="form-control" placeholder="e.g., 5 for add/transfer, -2 for remove" required>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swalAdjustBatchNumber" class="form-label">Batch Number</label><input type="text" id="swalAdjustBatchNumber" class="form-control" value="${batchNumber}" readonly></div>
                        <div class="col-md-6 mb-3"><label for="swalAdjustDotCode" class="form-label">DOT Code</label><input type="text" id="swalAdjustDotCode" value="${dotCode}" class="form-control" readonly></div>
                    </div>
                    <div id="swalNewLocationContainer" class="d-none">
                        <div id="swalDestWarehouseField" class="mb-3 d-none"><label for="swalDestWarehouse" class="form-label">To Warehouse</label><select id="swalDestWarehouse" class="form-select" style="width:100%;"></select></div>
                        <div class="mb-3"><label for="swalAdjustNewLocation" class="form-label">To Location</label><select id="swalAdjustNewLocation" class="form-select" style="width:100%;"></select></div>
                    </div>
                </form>`,
            confirmButtonText: 'Submit', showCancelButton: true, focusConfirm: false,
            didOpen: async () => {
                const popup = Swal.getPopup();
                const adjustmentTypeSelect = popup.querySelector('#swalAdjustmentType');
                const newLocationContainer = popup.querySelector('#swalNewLocationContainer');
                const destWarehouseField = popup.querySelector('#swalDestWarehouseField');
                const quantityInput = popup.querySelector('#swalAdjustQuantity');
                
                const newLocationSelect = $('#swalAdjustNewLocation');
                const destWarehouseSelect = $('#swalDestWarehouse');

                const initializeSelect2 = (selector, placeholder) => selector.select2({ 
                    placeholder, 
                    dropdownParent: $('.swal2-popup'), 
                    theme: 'bootstrap-5', 
                    templateResult: formatLocation, 
                    templateSelection: (loc) => loc.text,
                    dropdownCssClass: 'select2-dropdown-above'
                });
                
                initializeSelect2(newLocationSelect, 'Select destination location...');
                initializeSelect2(destWarehouseSelect, 'Select destination warehouse...');

                const updateLocationCapacity = () => {
                    const quantity = parseInt(quantityInput.value, 10) || 0;
                    
                    newLocationSelect.find('option').each(function() {
                        const option = $(this);
                        if (!option.val()) return;
                        const available = parseInt(option.data('available'), 10);
                        
                        if (quantity > 0 && !isNaN(available) && quantity > available) {
                            option.prop('disabled', true);
                            option.data('html', `<span class="badge bg-danger">No Space (Avail: ${available})</span>`);
                        } else {
                            option.prop('disabled', false);
                            option.data('html', option.data('original-html'));
                        }
                    });

                    newLocationSelect.select2({
                        placeholder: 'Select destination location...',
                        dropdownParent: $('.swal2-popup'),
                        theme: 'bootstrap-5',
                        templateResult: formatLocation,
                        templateSelection: (loc) => loc.text,
                        dropdownCssClass: 'select2-dropdown-above'
                    });
                };

                quantityInput.addEventListener('input', updateLocationCapacity);

                const loadAndPopulateLocations = async (warehouseId, excludeLocCode, prodId) => {
                    const locations = await fetchData(`api/inventory_api.php?action=location_stock&warehouse_id=${warehouseId}&product_id=${prodId}`);
                    if (locations.success) {
                        populateLocationSelect(newLocationSelect, locations.data, excludeLocCode);
                    }
                };

                adjustmentTypeSelect.addEventListener('change', async (e) => {
                    const action = e.target.value;
                    newLocationContainer.classList.toggle('d-none', action === 'adjust_quantity');
                    destWarehouseField.classList.toggle('d-none', action !== 'transfer_inter_warehouse');
                    newLocationSelect.empty().trigger('change');
                    destWarehouseSelect.empty().trigger('change');

                    if (action === 'transfer') {
                        await loadAndPopulateLocations(currentWarehouseId, locationCode, productId);
                    } else if (action === 'transfer_inter_warehouse') {
                        const warehouses = await fetchData('api/warehouses_api.php?action=get_transfer_targets');
                        if (warehouses.success) populateWarehouseSelect(destWarehouseSelect, warehouses.data);
                    }
                });

                destWarehouseSelect.on('change', async function() {
                    const selectedWarehouseId = $(this).val();
                    newLocationSelect.empty().trigger('change');
                    if (selectedWarehouseId) {
                        await loadAndPopulateLocations(selectedWarehouseId, null, productId);
                    }
                });
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                const actionType = popup.querySelector('#swalAdjustmentType').value;
                const quantity = popup.querySelector('#swalAdjustQuantity').value;

                if (!quantity || (actionType !== 'adjust_quantity' && parseInt(quantity) <= 0)) {
                    Swal.showValidationMessage('A positive quantity is required for transfers.');
                    return false;
                }
                if (actionType.startsWith('transfer') && !$('#swalAdjustNewLocation').val()) {
                    Swal.showValidationMessage('A destination location is required.');
                    return false;
                }
                if (actionType === 'transfer_inter_warehouse' && !$('#swalDestWarehouse').val()) {
                    Swal.showValidationMessage('A destination warehouse is required.');
                    return false;
                }

                return {
                    action_type: actionType,
                    product_id: popup.querySelector('#swalProductId').value,
                    current_location_barcode: popup.querySelector('#swalAdjustCurrentLocation').value,
                    quantity_change: quantity,
                    new_location_barcode: $('#swalAdjustNewLocation').val(),
                    to_warehouse_id: $('#swalDestWarehouse').val(),
                    batch_number: popup.querySelector('#swalAdjustBatchNumber').value,
                    dot_code: popup.querySelector('#swalAdjustDotCode').value,
                };
            }
        });

        if (formValues) {
            handleInventoryAdjustment(formValues);
        }
    }
    
    function populateLocationSelect(selectElement, locations, excludeLocationCode) {
        selectElement.empty().append(new Option('', '', true, true)).trigger('change');
        locations.forEach(loc => {
            if (loc.location_code !== excludeLocationCode) {
                const option = new Option(loc.location_code, loc.location_code, false, false);
                $(option).data('available', loc.available_capacity);
                $(option).data('html', loc.availability_html);
                $(option).data('original-html', loc.availability_html);
                selectElement.append(option);
            }
        });
        selectElement.trigger('change');
    }

    function populateWarehouseSelect(selectElement, warehouses) {
        selectElement.empty().append(new Option('', '', true, true)).trigger('change');
        warehouses.forEach(wh => {
            const option = new Option(wh.warehouse_name, wh.warehouse_id, false, false);
            selectElement.append(option);
        });
        selectElement.trigger('change');
    }

    function formatLocation(location) {
        if (!location.id) return location.text;
        const html = $(location.element).data('html');
        return $(`<div class="d-flex justify-content-between"><span>${location.text}</span>${html || ''}</div>`);
    }

    async function handleInventoryAdjustment(data) {
        try {
            const result = await fetchData('api/inventory_api.php', 'POST', data);
            if (result && result.success) {
                Swal.fire('Success!', result.message, 'success');
                await loadInventory();
            } else {
                 Swal.fire('Error!', result ? result.message : 'An unknown error occurred.', 'error');
            }
        } catch (error) {
            console.error('Error during inventory adjustment:', error);
            Swal.fire('API Error', error.message || 'Failed to perform adjustment.', 'error');
        }
    }
});
