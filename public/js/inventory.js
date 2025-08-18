/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings in UI elements, alerts, and modals with the `__()` translation function.
* 2. This includes placeholders, DataTable language settings, SweetAlert2 titles and messages, and error notifications.
* 3. The entire JavaScript functionality for this page is now fully localizable.
* 4. Ensured dynamic messages with variables are constructed correctly using translated strings.
*/

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
            $('#searchLocationSelect').val(null).trigger('change');
            $('#searchTireTypeSelect').val(null).trigger('change');
        });
    }
    
    $('#searchLocationSelect').select2({
        theme: 'bootstrap-5',
        placeholder: __('filter_by_location'),
        allowClear: true
    }).on('change', loadInventory);

    $('#searchTireTypeSelect').select2({
        theme: 'bootstrap-5',
        placeholder: __('filter_by_tire_type'),
        allowClear: true
    }).on('change', loadInventory);


    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire({
                title: __('no_warehouse_selected'),
                text: __('select_warehouse_continue'),
                icon: 'error',
                confirmButtonText: __('select_warehouse'),
                confirmButtonColor: '#dc3741',
                allowOutsideClick: false
            }).then(() => {
                window.location.href = 'dashboard.php';
            });
            return;
        }
        const canManageInbound = ['operator', 'manager'].includes(currentWarehouseRole);
        if (!canManageInbound) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: __('view_only_permissions'), showConfirmButton: false, timer: 3000, timerProgressBar: true });
        }

        initializeDataTable();    
        generateDotCodeOptions();
        await loadProductsForDropdown();
        await loadLocationsForFilterDropdown(currentWarehouseId);
        await loadTireTypesForFilter();
        await loadInventory();
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
                const text = `${__('week')} ${weekStr} / 20${yearStr}`;
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
                { data: 'location_type', visible: false },
                { data: 'is_active', visible: false }
            ],
            processing: true, serverSide: false,
            language: {
                search: `<span>${__('search')}:</span> _INPUT_`,
                searchPlaceholder: `${__('search')}...`,
                lengthMenu: `${__('show')} _MENU_ ${__('entries')}`,
                info: `${__('showing')} _START_ ${__('to')} _END_ ${__('of')} _TOTAL_ ${__('entries')}`,
                infoEmpty: `${__('showing')} 0 ${__('to')} 0 ${__('of')} 0 ${__('entries')}`,
                infoFiltered: `(${__('filtered_from')} _MAX_ ${__('total_entries')})`,
                paginate: {
                    first: __('first'),
                    last: __('last'),
                    next: __('next'),
                    previous: __('previous')
                },
                emptyTable: __('no_data_available_in_table'),
                zeroRecords: __('no_matching_records_found'),
                processing: `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">${__('loading')}...</span></div>`
            }
        });
    }

    async function loadProductsForDropdown() {
        try {
            const productsResponse = await fetchData('api/products_api.php');
            allProducts = productsResponse.data || [];
        } catch (error) {
            console.error('Error loading products:', error);
            Toast.fire({ icon: 'error', title: __('error_loading_product_data') });
        }
    }

    async function loadLocationsForFilterDropdown(warehouseId) {
        if (!searchLocationSelect || !warehouseId) return;
        try {
            const response = await fetchData(`api/locations_api.php?warehouse_id=${warehouseId}`);
            if (response.success && Array.isArray(response.data)) {
                const $select = $('#searchLocationSelect');
                $select.empty().append(new Option(__('all_locations'), '', false, false));
                response.data
                    .filter(loc => loc.is_active)
                    .sort((a, b) => a.location_code.localeCompare(b.location_code))
                    .forEach(location => {
                        const option = new Option(location.location_code, location.location_code, false, false);
                        $select.append(option);
                    });
                $select.val(null).trigger('change.select2');
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
                const $select = $('#searchTireTypeSelect');
                $select.empty().append(new Option(__('all_tire_types'), '', false, false));
                response.data.forEach(type => {
                    const option = new Option(type.tire_type_name, type.tire_type_id, false, false);
                    $select.append(option);
                });
                $select.val(null).trigger('change.select2');
            }
        } catch (error) {
            console.error('Error loading tire types:', error);
        }
    }

    async function loadInventory() {
        if (!currentWarehouseId) return;
        $('.dataTables_processing', inventoryDataTable.table().container()).show();
        const product_search_article_no = searchProductInput.value.trim();
        const location_search_code = $('#searchLocationSelect').val();
        const tire_type_id = $('#searchTireTypeSelect').val();

        let url = 'api/inventory_api.php?';
        const queryParams = [];

        if (product_search_article_no) {
            const product = allProducts.find(p => p.article_no === product_search_article_no || p.sku === product_search_article_no);
            if (product) {
                queryParams.push(`product_id=${product.product_id}`);
            } else {
                Toast.fire({ icon: 'warning', title: `${__('product')} "${product_search_article_no}" ${__('product_not_found')}` });
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
                 Toast.fire({ icon: 'error', title: response.message || __('failed_to_load_inventory') });
                 inventoryDataTable.clear().draw();
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
            Toast.fire({ icon: 'error', title: __('error_loading_inventory') });
            inventoryDataTable.clear().draw();
        } finally {
            $('.dataTables_processing', inventoryDataTable.table().container()).hide();
        }
    }
    
    function populateDataTable(inventoryItems) {
        const rows = inventoryItems.map(item => {
            const lastMovedDate = item.last_moved_at ? new Date(item.last_moved_at).toLocaleDateString() : __('n_a');
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
                    expiryHtml += ` <span class="badge ${badgeClass}">${__('expires')}: ${item.calculated_expiry_date}</span>`;
                }
            } else {
                expiryHtml = __('n_a');
            }
            const batchExpiry = `<div>${item.batch_number || __('n_a')}</div><div>${expiryHtml}</div>`;

            let actionButtons = `<small class="text-muted">${__('view_only')}</small>`;
            if (canAdjust) {
                if (item.quantity > 0) {
                    actionButtons = `<button class="btn btn-sm btn-info text-white adjust-btn" title="${__('adjust_transfer')}"><i class="bi bi-gear"></i></button>
                                     <button class="btn btn-sm btn-secondary reprint-btn ms-1" title="${__('reprint_stickers')}"><i class="bi bi-printer"></i></button>`;
                } else {
                    actionButtons = `<button class="btn btn-sm btn-success text-white add-stock-btn" title="${__('add_stock')}"><i class="bi bi-plus-circle"></i></button>`;
                }
            }

            let productNameHtml = item.product_name || `<span class="text-danger">${__('missing_product')}</span>`;
            if (item.location_type === 'block_area') {
                productNameHtml += ` <span class="badge bg-danger ms-2">${__('blocked')}</span>`;
            }

            return {
                inventory_id: item.inventory_id,
                product_id: item.product_id,
                product_article_no: item.article_no || '',
                location_code: item.location_code || '',
                batch_number: item.batch_number || '',
                dot_code: item.dot_code || '',
                location_type: item.location_type,
                is_active: item.is_active,
                sku: item.sku || `<span class="text-danger">${__('missing_product')}</span>`,
                product_name: productNameHtml,
                article_no: item.article_no || __('n_a'),
                location: item.location_code || (item.quantity > 0 ? `<span class="text-danger">${__('missing_location')}</span>` : __('no_stock')),
                quantity: item.quantity,
                batch_expiry: batchExpiry,
                last_moved: lastMovedDate,
                actions: actionButtons,
            };
        });
        inventoryDataTable.clear();
        inventoryDataTable.rows.add(rows).draw();
        
        $('#inventoryTable tbody').off('click', '.adjust-btn').on('click', '.adjust-btn', function() {
            const rowData = inventoryDataTable.row($(this).closest('tr')).data();
            openAdjustmentModal(rowData);
        });
        $('#inventoryTable tbody').off('click', '.add-stock-btn').on('click', '.add-stock-btn', function() {
            const rowData = inventoryDataTable.row($(this).closest('tr')).data();
            openAddStockModal(rowData);
        });
        $('#inventoryTable tbody').off('click', '.reprint-btn').on('click', '.reprint-btn', function() {
            const rowData = inventoryDataTable.row($(this).closest('tr')).data();
            if (rowData.inventory_id) {
                $('#print-frame').remove();
                $('<iframe>', {
                    id: 'print-frame',
                    src: `print_label.php?inventory_id=${rowData.inventory_id}`,
                    style: 'display:none;'
                }).appendTo('body');
            } else {
                Swal.fire(__('error'), __('could_not_find_inventory_id'), 'error');
            }
        });
    }

    async function openAdjustmentModal(item) {
        const {
            product_id, product_article_no, location_code, batch_number, dot_code, quantity, location_type
        } = item;

        if (!location_code) {
            Swal.fire(__('action_denied'), __('cannot_adjust_missing_location'), 'error');
            return;
        }
        
        const isBlocked = location_type === 'block_area';

        const { value: formValues } = await Swal.fire({
            title: __('inventory_adjustment_transfer'),
            html: `
                <form id="adjustForm" class="text-start">
                    <input type="hidden" id="swalProductId" value="${product_id}">
                    <div class="mb-3">
                        <label for="swalAdjustmentType" class="form-label">${__('action')}</label>
                        <select id="swalAdjustmentType" class="form-select">
                            <option value="adjust_quantity">${__('adjust_quantity')}</option>
                            <option value="transfer">${__('transfer_unblock')}</option>
                            <option value="block_item">${__('block_item')}</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustProductarticle_no" class="form-label">${__('article_no')}</label>
                        <input type="text" id="swalAdjustProductarticle_no" class="form-control" value="${product_article_no}" readonly>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="swalAdjustCurrentLocation" class="form-label">${__('from_location')}</label>
                            <input type="text" id="swalAdjustCurrentLocation" class="form-control" value="${location_code}" readonly>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">${__('current_qty_at_location')}</label>
                            <input type="text" class="form-control" value="${quantity}" readonly style="font-weight: bold; background-color: #e9ecef;">
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="swalAdjustQuantity" class="form-label">${__('quantity_to_move')}</label>
                        <input type="number" id="swalAdjustQuantity" class="form-control numeric-only" placeholder="${__('qty_move_placeholder_adjust')}" required>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swalAdjustBatchNumber" class="form-label">${__('batch_number')}</label><input type="text" id="swalAdjustBatchNumber" class="form-control" value="${batch_number}" readonly></div>
                        <div class="col-md-6 mb-3"><label for="swalAdjustDotCode" class="form-label">${__('dot_code')}</label><input type="text" id="swalAdjustDotCode" value="${dot_code}" class="form-control" readonly></div>
                    </div>
                    <div id="swalNewLocationContainer" class="d-none">
                        <div class="mb-3"><label for="swalAdjustNewLocation" class="form-label">${__('to_location')}</label><select id="swalAdjustNewLocation" class="form-select" style="width:100%;"></select></div>
                    </div>
                </form>`,
            confirmButtonText: __('submit'), showCancelButton: true, cancelButtonText: __('cancel'), focusConfirm: false, allowOutsideClick: false,
            didOpen: async () => {
                const popup = Swal.getPopup();
                const adjustmentTypeSelect = popup.querySelector('#swalAdjustmentType');
                const newLocationContainer = popup.querySelector('#swalNewLocationContainer');
                const quantityInput = popup.querySelector('#swalAdjustQuantity');
                const newLocationSelect = $('#swalAdjustNewLocation');

                const formatLocation = (location) => {
                    if (!location.id) return location.text;
                    const $option = $(location.element);
                    const availableStr = $option.data('available');
                    const available = (availableStr === null || typeof availableStr === 'undefined') ? null : parseInt(availableStr, 10);
                    const quantityToMove = parseInt(quantityInput.value, 10) || 0;
                    
                    let badge = '';
                    if (available === null || isNaN(available)) {
                        badge = `<span class="badge bg-secondary float-end">${__('availability_not_set')}</span>`;
                    } else if (quantityToMove > 0 && quantityToMove > available) {
                        badge = `<span class="badge bg-danger float-end">${__('space_not_available_avail', { available: available })}</span>`;
                    } else {
                        badge = `<span class="badge bg-success float-end">${__('available_space', { available: available })}</span>`;
                    }
                    return $(`<div>${location.text} ${badge}</div>`);
                };

                newLocationSelect.select2({
                    placeholder: __('select_destination_location'),
                    dropdownParent: $('.swal2-popup'),
                    theme: 'bootstrap-5',
                    templateResult: formatLocation,
                    templateSelection: formatLocation,
                    escapeMarkup: m => m
                });

                const validateLocationCapacity = () => {
                    const quantityToValidate = parseInt(quantityInput.value, 10) || 0;
                    if (quantityToValidate <= 0 && adjustmentTypeSelect.value !== 'adjust_quantity') return;

                    let isSelectedDisabled = false;
                    newLocationSelect.find('option').each(function() {
                        const option = $(this);
                        if (!option.val()) return;
                        const availableStr = option.data('available');
                        const available = (availableStr === null || typeof availableStr === 'undefined') ? null : parseInt(availableStr, 10);

                        if (available === null || isNaN(available) || quantityToValidate > available) {
                            option.prop('disabled', true);
                            if (option.is(':selected')) isSelectedDisabled = true;
                        } else {
                            option.prop('disabled', false);
                        }
                    });

                    if (isSelectedDisabled) newLocationSelect.val(null);
                    
                    newLocationSelect.trigger('change.select2');
                };
                
                quantityInput.addEventListener('input', validateLocationCapacity);
                
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
                        validateLocationCapacity();
                    }
                };

                adjustmentTypeSelect.addEventListener('change', async (e) => {
                    const action = e.target.value;
                    newLocationContainer.classList.toggle('d-none', action === 'adjust_quantity');
                    quantityInput.placeholder = (action === 'adjust_quantity') ? __('qty_move_placeholder_adjust') : __('qty_placeholder_positive');
                    
                    newLocationSelect.empty().trigger('change');

                    if (action === 'transfer' || action === 'block_item') {
                        await loadAndPopulateLocations(action === 'block_item' ? 'block_only' : 'non_block');
                    }
                });

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
                    Swal.showValidationMessage(__('positive_quantity_required_transfer'));
                    return false;
                }
                if ((actionType === 'transfer' || actionType === 'block_item') && !$('#swalAdjustNewLocation').val()) {
                    Swal.showValidationMessage(__('destination_location_required'));
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
        selectElement.empty().append(new Option('', '', true, true));
        locations.forEach(loc => {
            if (loc.location_code !== excludeLocationCode) {
                const option = new Option(loc.location_code, loc.location_code, false, false);
                $(option).data('available', loc.available_capacity);
                selectElement.append(option);
            }
        });
        selectElement.trigger('change');
    }

    async function handleInventoryAdjustment(data) {
        try {
            const result = await fetchData('api/inventory_api.php', 'POST', data);
            if (result && result.success) {
                if (result.inventory_id && data.quantity_change > 0) {
                    Swal.fire({
                        icon: 'success',
                        title: __('stock_added_successfully'),
                        text: result.message,
                        showCancelButton: true,
                        confirmButtonText: `<i class="bi bi-printer"></i> ${__('print_stickers')}`,
                        cancelButtonText: __('close'),
                        allowOutsideClick: false,
                    }).then((dialogResult) => {
                        if (dialogResult.isConfirmed) {
                            $('#print-frame').remove(); 
                            $('<iframe>', {
                                id: 'print-frame',
                                src: `print_label.php?inventory_id=${result.inventory_id}`,
                                style: 'display:none;'
                            }).appendTo('body');
                        }
                        loadInventory();
                    });
                } else {
                    Swal.fire(__('success'), result.message, 'success');
                    await loadInventory();
                }
            } else {
                 Swal.fire(__('error'), result ? result.message : __('an_unknown_error_occurred'), 'error');
            }
        } catch (error) {
            console.error('Error during inventory adjustment:', error);
            Swal.fire(__('api_error'), error.message || __('failed_to_perform_adjustment'), 'error');
        }
    }

    async function openAddStockModal(item) {
        const { product_id, product_article_no } = item;
        let modalLocations = [];

        const { value: formValues } = await Swal.fire({
            title: __('add_stock_to_inventory'),
            html: `
                <form id="addStockForm" class="text-start">
                    <input type="hidden" id="swalProductId" value="${product_id}">
                    <div class="mb-3">
                        <label for="swalAddProductArticleNo" class="form-label">${__('article_no')}</label>
                        <input type="text" id="swalAddProductArticleNo" class="form-control" value="${product_article_no}" readonly>
                    </div>
                    <div class="mb-3">
                        <label for="swalAddQuantity" class="form-label">${__('quantity_to_add')}</label>
                        <input type="number" id="swalAddQuantity" class="form-control numeric-only" placeholder="${__('qty_placeholder_10')}" required min="1">
                    </div>
                    <div class="mb-3">
                        <label for="swalAddLocation" class="form-label">${__('to_location')}</label>
                        <select id="swalAddLocation" class="form-select" style="width:100%;" required></select>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="swalAddBatchNumber" class="form-label">${__('batch_number')}</label>
                            <input type="text" id="swalAddBatchNumber" class="form-control" placeholder="${__('optional_auto_generates')}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="swalAddDotCode" class="form-label">${__('dot_code')}</label>
                            <select id="swalAddDotCode" class="form-select" style="width:100%;" required></select>
                        </div>
                    </div>
                </form>`,
            confirmButtonText: __('add_stock'),
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            focusConfirm: false,
            allowOutsideClick: false,
            didOpen: async () => {
                const popup = Swal.getPopup();
                const locationSelect = $('#swalAddLocation');
                const quantityInput = popup.querySelector('#swalAddQuantity');
                const dotCodeSelect = $('#swalAddDotCode');

                dotCodeSelect.select2({
                    placeholder: __('select_dot_code'),
                    dropdownParent: $('.swal2-popup'),
                    theme: 'bootstrap-5',
                    data: dotCodeOptions
                }).val(null).trigger('change');

                const formatLocation = (location) => {
                    if (!location.id) return location.text;
                    const $option = $(location.element);
                    const availableStr = $option.data('available');
                    const available = (availableStr === null || typeof availableStr === 'undefined') ? null : parseInt(availableStr, 10);
                    const quantityToMove = parseInt(quantityInput.value, 10) || 0;
                    
                    let badge = '';
                    if (available === null || isNaN(available)) {
                        badge = `<span class="badge bg-secondary float-end">${__('availability_not_set')}</span>`;
                    } else if (quantityToMove > 0 && quantityToMove > available) {
                        badge = `<span class="badge bg-danger float-end">${__('space_not_available_avail', { available: available })}</span>`;
                    } else {
                        badge = `<span class="badge bg-success float-end">${__('available_space', { available: available })}</span>`;
                    }
                    return $(`<div>${location.text} ${badge}</div>`);
                };
                
                locationSelect.select2({
                    placeholder: __('select_destination_location'),
                    dropdownParent: $('.swal2-popup'),
                    theme: 'bootstrap-5',
                    templateResult: formatLocation,
                    templateSelection: formatLocation,
                    escapeMarkup: m => m
                });

                const validateLocationCapacity = () => {
                    const quantityToValidate = parseInt(quantityInput.value, 10) || 0;
                    if (quantityToValidate <= 0) return;

                    let isSelectedDisabled = false;
                    locationSelect.find('option').each(function() {
                        const option = $(this);
                        if (!option.val()) return;
                        const availableStr = option.data('available');
                        const available = (availableStr === null || typeof availableStr === 'undefined') ? null : parseInt(availableStr, 10);

                        if (available === null || isNaN(available) || quantityToValidate > available) {
                            option.prop('disabled', true);
                            if (option.is(':selected')) isSelectedDisabled = true;
                        } else {
                            option.prop('disabled', false);
                        }
                    });

                    if (isSelectedDisabled) locationSelect.val(null);
                    
                    locationSelect.trigger('change.select2');
                };

                quantityInput.addEventListener('input', validateLocationCapacity);

                const locations = await fetchData(`api/inventory_api.php?action=location_stock&warehouse_id=${currentWarehouseId}&product_id=${product_id}`);
                if (locations.success) {
                    modalLocations = locations.data;
                    const nonBlockLocations = locations.data.filter(loc => loc.type_name !== 'block_area');
                    populateLocationSelect(locationSelect, nonBlockLocations, null);
                    validateLocationCapacity();
                }
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                const location = $('#swalAddLocation').val();
                const quantity = parseInt(popup.querySelector('#swalAddQuantity').value, 10) || 0;
                const dot_code = $('#swalAddDotCode').val();

                const selectedLocationData = modalLocations.find(loc => loc.location_code === location);
                if (selectedLocationData) {
                    const available = selectedLocationData.available_capacity;
                    if (available !== null && quantity > available) {
                        Swal.showValidationMessage(`${__('not_enough_space')}. ${__('location')} ${__('only')} ${__('has_space_for')} ${available} ${__('units')}.`);
                        return false;
                    }
                }

                if (!location) {
                    Swal.showValidationMessage(__('destination_location_required'));
                    return false;
                }
                if (!quantity || quantity <= 0) {
                    Swal.showValidationMessage(__('positive_quantity_required'));
                    return false;
                }
                if (!dot_code) {
                    Swal.showValidationMessage(__('dot_code_required'));
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
