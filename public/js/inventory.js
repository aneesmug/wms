// public/js/inventory.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const searchProductInput = document.getElementById('searchProductInput');
    const searchLocationSelect = document.getElementById('searchLocationSelect');
    const searchTireTypeSelect = document.getElementById('searchTireTypeSelect');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    let allProducts = [];
    let inventoryDataTable;
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let dotCodeOptions = []; 

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
            searchTireTypeSelect.value = '';
            loadInventory();
        });
    }
    if (searchLocationSelect) searchLocationSelect.addEventListener('change', loadInventory);
    if (searchTireTypeSelect) searchTireTypeSelect.addEventListener('change', loadInventory);

    async function initializePage() {
        initializeDataTable();
        if (currentWarehouseId) {
            generateDotCodeOptions();
            await loadProductsForDropdown();
            await loadLocationsForFilterDropdown(currentWarehouseId);
            await loadTireTypesForFilter();
            await loadInventory();
        } else {
            Toast.fire({ icon: 'warning', title: 'Please select a warehouse on the Dashboard.' });
            if (searchLocationSelect) searchLocationSelect.innerHTML = '<option value="">Select a warehouse first.</option>';
        }
    }
    
    function generateDotCodeOptions() {
        if (dotCodeOptions.length > 0) return;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentYearShort = parseInt(currentYear.toString().slice(-2));

        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        const currentWeek = Math.ceil((startOfYear.getDay() + 1 + days) / 7);

        for (let y = currentYearShort; y >= currentYearShort - 5; y--) {
            const weeksInYear = (y === currentYearShort) ? currentWeek : 53;
            
            for (let w = weeksInYear; w >= 1; w--) {
                const weekStr = String(w).padStart(2, '0');
                const yearStr = String(y).padStart(2, '0');
                const value = `${weekStr}${yearStr}`;
                const text = `Week ${weekStr} / 20${yearStr}`;
                dotCodeOptions.push({ id: value, text: text });
            }
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
                { data: 'sku' }, 
                { data: 'product_name' }, 
                { data: 'article_no' },
                { data: 'location' }, 
                { data: 'quantity' }, 
                { data: 'batch_expiry' },
                { data: 'last_moved' }, 
                { data: 'actions', orderable: false, searchable: false },
                // Add location_type and is_active to data but keep them hidden
                { data: 'location_type', visible: false },
                { data: 'is_active', visible: false }
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

    async function loadTireTypesForFilter() {
        if (!searchTireTypeSelect) return;
        try {
            const response = await fetchData('api/products_api.php?action=get_tire_types');
            if (response.success && Array.isArray(response.data)) {
                searchTireTypeSelect.innerHTML = '<option value="">All Tire Types</option>';
                response.data.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.tire_type_id;
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
        const product_search_article_no = searchProductInput.value.trim();
        const location_search_code = searchLocationSelect.value;
        const tire_type_id = searchTireTypeSelect.value;

        let url = 'api/inventory_api.php?';
        const queryParams = [];

        if (product_search_article_no) {
            const product = allProducts.find(p => p.article_no === product_search_article_no || p.sku === product_search_article_no);
            if (product) {
                queryParams.push(`product_id=${product.product_id}`);
            } else {
                Toast.fire({ icon: 'warning', title: `Product "${product_search_article_no}" not found.` });
                inventoryDataTable.clear().draw();
                $('.dataTables_processing', inventoryDataTable.table().container()).hide();
                return;
            }
        }
        if (location_search_code) {
            queryParams.push(`location_code=${encodeURIComponent(location_search_code)}`);
        }
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

            let actionButton = '<span class="text-muted">View Only</span>';
            if (canAdjust) {
                if (item.quantity > 0) {
                    actionButton = `<button class="btn btn-sm btn-info text-white adjust-btn" 
                                    title="Adjust/Transfer">
                                    <i class="bi bi-gear"></i></button>`;
                } else {
                    actionButton = `<button class="btn btn-sm btn-success text-white add-stock-btn"
                                    title="Add Stock">
                                    <i class="bi bi-plus-circle"></i></button>`;
                }
            }

            let productNameHtml = item.product_name || '<span class="text-danger">Missing Product</span>';
            if (item.location_type === 'block_area') {
                productNameHtml += ' <span class="badge bg-danger ms-2">Blocked</span>';
            }

            // MODIFICATION: The object returned for each row now includes all raw data fields
            // needed by the modal functions. This ensures the correct data is passed.
            return {
                // Raw data for modals
                product_id: item.product_id,
                product_article_no: item.article_no || '',
                location_code: item.location_code || '',
                batch_number: item.batch_number || '',
                dot_code: item.dot_code || '',
                location_type: item.location_type,
                is_active: item.is_active,

                // Data for display in the table
                sku: item.sku || '<span class="text-danger">Missing Product</span>',
                product_name: productNameHtml,
                article_no: item.article_no || 'N/A',
                location: item.location_code || (item.quantity > 0 ? '<span class="text-danger">Missing Location</span>' : 'No Stock'),
                quantity: item.quantity,
                batch_expiry: batchExpiry,
                last_moved: lastMovedDate,
                actions: actionButton,
            };
        });
        inventoryDataTable.clear();
        inventoryDataTable.rows.add(rows).draw();
        
        // Pass the full row data to the modal function
        $('#inventoryTable tbody').off('click', '.adjust-btn').on('click', '.adjust-btn', function() {
            const rowData = inventoryDataTable.row($(this).closest('tr')).data();
            openAdjustmentModal(rowData);
        });
        $('#inventoryTable tbody').off('click', '.add-stock-btn').on('click', '.add-stock-btn', function() {
            const rowData = inventoryDataTable.row($(this).closest('tr')).data();
            openAddStockModal(rowData);
        });
    }

    async function openAdjustmentModal(item) {
        const {
            product_id, product_article_no, location_code, batch_number, dot_code, quantity, location_type
        } = item;

        if (!location_code) {
            Swal.fire('Action Denied', 'Cannot adjust an item with a missing or invalid location.', 'error');
            return;
        }
        
        const isBlocked = location_type === 'block_area';

        const { value: formValues } = await Swal.fire({
            title: 'Inventory Adjustment / Transfer',
            html: `
                <form id="adjustForm" class="text-start">
                    <input type="hidden" id="swalProductId" value="${product_id}">
                    <div class="mb-3">
                        <label for="swalAdjustmentType" class="form-label">Action</label>
                        <select id="swalAdjustmentType" class="form-select">
                            <option value="adjust_quantity">Adjust Quantity</option>
                            <option value="transfer">Transfer / Unblock</option>
                            <option value="block_item">Block Item</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustProductarticle_no" class="form-label">Product Article No</label>
                        <input type="text" id="swalAdjustProductarticle_no" class="form-control" value="${product_article_no}" readonly>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="swalAdjustCurrentLocation" class="form-label">From Location</label>
                            <input type="text" id="swalAdjustCurrentLocation" class="form-control" value="${location_code}" readonly>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Current Qty at Location</label>
                            <input type="text" class="form-control" value="${quantity}" readonly style="font-weight: bold; background-color: #e9ecef;">
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustQuantity" class="form-label">Quantity to Move</label>
                        <input type="number" id="swalAdjustQuantity" class="form-control" placeholder="e.g., 5 for add/transfer, -2 for remove" required>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swalAdjustBatchNumber" class="form-label">Batch Number</label><input type="text" id="swalAdjustBatchNumber" class="form-control" value="${batch_number}" readonly></div>
                        <div class="col-md-6 mb-3"><label for="swalAdjustDotCode" class="form-label">DOT Code</label><input type="text" id="swalAdjustDotCode" value="${dot_code}" class="form-control" readonly></div>
                    </div>
                    <div id="swalNewLocationContainer" class="d-none">
                        <div class="mb-3"><label for="swalAdjustNewLocation" class="form-label">To Location</label><select id="swalAdjustNewLocation" class="form-select" style="width:100%;"></select></div>
                    </div>
                </form>`,
            confirmButtonText: 'Submit', showCancelButton: true, focusConfirm: false, allowOutsideClick: false,
            didOpen: async () => {
                const popup = Swal.getPopup();
                const adjustmentTypeSelect = popup.querySelector('#swalAdjustmentType');
                const newLocationContainer = popup.querySelector('#swalNewLocationContainer');
                const quantityInput = popup.querySelector('#swalAdjustQuantity');
                
                const newLocationSelect = $('#swalAdjustNewLocation');

                const initializeSelect2 = (selector, placeholder) => selector.select2({ 
                    placeholder, 
                    dropdownParent: $('.swal2-popup'), 
                    theme: 'bootstrap-5', 
                    templateResult: formatLocation, 
                    templateSelection: (loc) => loc.text,
                    dropdownCssClass: 'select2-dropdown-above'
                });
                
                initializeSelect2(newLocationSelect, 'Select destination location...');

                const loadAndPopulateLocations = async (filter = null) => {
                    const locationsResponse = await fetchData(`api/inventory_api.php?action=location_stock&warehouse_id=${currentWarehouseId}&product_id=${product_id}`);
                    if (locationsResponse.success) {
                        let filteredLocations = locationsResponse.data;
                        if (filter === 'block_only') {
                            filteredLocations = filteredLocations.filter(loc => loc.type_name === 'block_area');
                        } else if (filter === 'non_block') {
                            filteredLocations = filteredLocations.filter(loc => loc.type_name !== 'block_area');
                        }
                        populateLocationSelect(newLocationSelect, filteredLocations, location_code);
                    }
                };

                adjustmentTypeSelect.addEventListener('change', async (e) => {
                    const action = e.target.value;
                    newLocationContainer.classList.toggle('d-none', action === 'adjust_quantity');
                    quantityInput.placeholder = (action === 'adjust_quantity') ? 'e.g., 5 for add, -2 for remove' : 'e.g., 5';
                    
                    newLocationSelect.empty().trigger('change');

                    if (action === 'transfer') {
                        await loadAndPopulateLocations('non_block');
                    } else if (action === 'block_item') {
                        await loadAndPopulateLocations('block_only');
                    }
                });

                // If the item is already blocked, default to the transfer/unblock view
                if (isBlocked) {
                    adjustmentTypeSelect.value = 'transfer';
                    adjustmentTypeSelect.dispatchEvent(new Event('change'));
                }
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                const actionType = popup.querySelector('#swalAdjustmentType').value;
                const quantityChange = popup.querySelector('#swalAdjustQuantity').value;

                if (!quantityChange || (actionType !== 'adjust_quantity' && parseInt(quantityChange) <= 0)) {
                    Swal.showValidationMessage('A positive quantity is required for transfers or blocking.');
                    return false;
                }
                if ((actionType === 'transfer' || actionType === 'block_item') && !$('#swalAdjustNewLocation').val()) {
                    Swal.showValidationMessage('A destination location is required.');
                    return false;
                }

                return {
                    action_type: actionType,
                    product_id: product_id,
                    current_location_article_no: location_code,
                    quantity_change: quantityChange,
                    new_location_article_no: $('#swalAdjustNewLocation').val(),
                    batch_number: batch_number,
                    dot_code: dot_code,
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

    async function openAddStockModal(item) {
        const { product_id, product_article_no } = item;

        const { value: formValues } = await Swal.fire({
            title: 'Add Stock to Inventory',
            html: `
                <form id="addStockForm" class="text-start">
                    <input type="hidden" id="swalProductId" value="${product_id}">
                    <div class="mb-3">
                        <label for="swalAddProductArticleNo" class="form-label">Product Article No</label>
                        <input type="text" id="swalAddProductArticleNo" class="form-control" value="${product_article_no}" readonly>
                    </div>
                    <div class="mb-3">
                        <label for="swalAddLocation" class="form-label">To Location</label>
                        <select id="swalAddLocation" class="form-select" style="width:100%;" required></select>
                    </div>
                    <div class="mb-3">
                        <label for="swalAddQuantity" class="form-label">Quantity to Add</label>
                        <input type="number" id="swalAddQuantity" class="form-control" placeholder="e.g., 10" required min="1">
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="swalAddBatchNumber" class="form-label">Batch Number</label>
                            <input type="text" id="swalAddBatchNumber" class="form-control" placeholder="Optional (Auto-generates)">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="swalAddDotCode" class="form-label">DOT Code</label>
                            <select id="swalAddDotCode" class="form-select" style="width:100%;" required></select>
                        </div>
                    </div>
                </form>`,
            confirmButtonText: 'Add Stock',
            showCancelButton: true,
            focusConfirm: false,
            allowOutsideClick: false,
            didOpen: async () => {
                const popup = Swal.getPopup();
                const locationSelect = $('#swalAddLocation');
                const quantityInput = popup.querySelector('#swalAddQuantity');
                const dotCodeSelect = $('#swalAddDotCode');

                const initializeSelect2 = (selector, placeholder, data = null) => {
                    const config = {
                        placeholder,
                        dropdownParent: $('.swal2-popup'),
                        theme: 'bootstrap-5',
                    };
                    if (data) {
                        config.data = data;
                    }
                    return selector.select2(config);
                };
                
                initializeSelect2(dotCodeSelect, 'Select a DOT code...', dotCodeOptions).val(null).trigger('change');
                initializeSelect2(locationSelect, 'Select destination location...');
                
                const updateLocationCapacity = () => {
                    const quantity = parseInt(quantityInput.value, 10) || 0;
                    
                    locationSelect.find('option').each(function() {
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

                    locationSelect.select2('destroy').select2({
                        placeholder: 'Select destination location...',
                        dropdownParent: $('.swal2-popup'),
                        theme: 'bootstrap-5',
                        templateResult: formatLocation,
                        templateSelection: (loc) => loc.text,
                        dropdownCssClass: 'select2-dropdown-above'
                    });
                };

                quantityInput.addEventListener('input', updateLocationCapacity);

                const locations = await fetchData(`api/inventory_api.php?action=location_stock&warehouse_id=${currentWarehouseId}&product_id=${product_id}`);
                if (locations.success) {
                    const nonBlockLocations = locations.data.filter(loc => loc.type_name !== 'block_area');
                    populateLocationSelect(locationSelect, nonBlockLocations, null);
                }
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                const location = $('#swalAddLocation').val();
                const quantity = popup.querySelector('#swalAddQuantity').value;
                const dot_code = $('#swalAddDotCode').val();

                if (!location) {
                    Swal.showValidationMessage('A destination location is required.');
                    return false;
                }
                if (!quantity || parseInt(quantity) <= 0) {
                    Swal.showValidationMessage('A positive quantity is required.');
                    return false;
                }
                if (!dot_code) {
                    Swal.showValidationMessage('DOT Code is a required field.');
                    return false;
                }
                
                return {
                    action_type: 'adjust_quantity',
                    product_id: product_id,
                    current_location_article_no: location,
                    quantity_change: quantity,
                    batch_number: popup.querySelector('#swalAddBatchNumber').value,
                    dot_code: dot_code,
                };
            }
        });

        if (formValues) {
            handleInventoryAdjustment(formValues);
        }
    }
});
