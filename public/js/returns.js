// public/js/returns.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const returnProcessingArea = document.getElementById('returnProcessingArea');
    const selectedReturnNumber = document.getElementById('selectedReturnNumber');
    const currentReturnIdInput = document.getElementById('currentReturnId');
    const returnItemsTableBody = document.getElementById('returnItemsTableBody');

    // --- State Variables ---
    let returnsTable = null;
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    
    initializePage();

    // --- Functions ---
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
        const canManageReturns = ['operator', 'manager'].includes(currentWarehouseRole);
        if (!canManageReturns) {
            $('button').prop('disabled', true);
            showMessageBox(__('view_only_permissions'), 'info');
        }

        initializeReturnsDataTable();
        await loadReturns();
    }

    function initializeReturnsDataTable() {
        returnsTable = $('#returnsTable').DataTable({
            responsive: true,
            order: [[5, 'desc']],
            columns: [
                { data: 'return_number' },
                { data: 'order_number' },
                { data: 'customer_name' },
                { data: 'reason', defaultContent: __('n_a') },
                { data: 'status' },
                { data: 'created_at' },
                { data: 'actions', orderable: false, searchable: false }
            ],
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
                zeroRecords: __('no_matching_records_found')
            }
        });
        $('#returnsTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadReturns() {
        try {
            const response = await fetchData('api/returns_api.php');
            if (response.success && Array.isArray(response.data)) {
                const tableData = response.data.map(ret => {
                    let actionButtons = '';
                    const canProcess = ['operator', 'manager'].includes(currentWarehouseRole) && !['Completed', 'Cancelled'].includes(ret.status);
                    const statusKey = ret.status.toLowerCase().replace(/\s+/g, '_');
                    const statusClassMap = {
                        'completed': 'bg-success',
                        'processing': 'bg-primary',
                        'pending': 'bg-warning text-dark',
                        'cancelled': 'bg-danger'
                    };

                    if (canProcess) {
                        actionButtons = `<button class="btn btn-sm btn-primary process-return-btn" data-return-id="${ret.return_id}" data-return-number="${ret.return_number}" title="${__('process_return')}"><i class="bi bi-gear"></i></button>`;
                    } else if (['Completed', 'Processing'].includes(ret.status)) {
                        actionButtons = `<button class="btn btn-sm btn-outline-secondary view-details-btn" data-return-id="${ret.return_id}" data-return-number="${ret.return_number}" title="${__('view_details')}"><i class="bi bi-eye"></i></button>`;
                    } else {
                        actionButtons = `<span class="text-muted">${__('view_only')}</span>`;
                    }

                    return {
                        return_number: ret.return_number,
                        order_number: ret.order_number,
                        customer_name: ret.customer_name,
                        reason: ret.reason,
                        status: `<span class="badge ${statusClassMap[statusKey] || 'bg-secondary'}">${__(statusKey, ret.status)}</span>`,
                        created_at: new Date(ret.created_at).toLocaleDateString(),
                        actions: actionButtons
                    };
                });
                returnsTable.clear().rows.add(tableData).draw();
            }
        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_load_returns')}: ${error.message}`, 'error');
        }
    }

    function addTableButtonListeners() {
        $('#returnsTable tbody').off('click', '.process-return-btn, .view-details-btn').on('click', '.process-return-btn, .view-details-btn', function() {
            const returnId = this.dataset.returnId;
            const returnNumber = this.dataset.returnNumber;

            currentReturnIdInput.value = returnId;
            selectedReturnNumber.textContent = `#${returnNumber}`;
            returnProcessingArea.classList.remove('d-none');
            
            loadReturnItems(returnId);
            
            $('html, body').animate({
                scrollTop: $("#returnProcessingArea").offset().top
            }, 500);
        });
    }

    async function loadReturnItems(returnId) {
        returnItemsTableBody.innerHTML = `<tr><td colspan="10" class="text-center p-4">${__('loading_items')}...</td></tr>`;
        try {
            const response = await fetchData(`api/returns_api.php?return_id=${returnId}`);
            if (response.success && response.data) {
                populateReturnItemsTable(response.data.items);
            } else {
                returnItemsTableBody.innerHTML = `<tr><td colspan="10" class="text-center p-4">${__('could_not_load_items')}</td></tr>`;
            }
        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_load_return_items')}: ${error.message}`, 'error');
        }
    }

    function populateReturnItemsTable(items) {
        returnItemsTableBody.innerHTML = '';
        if (items.length === 0) {
            returnItemsTableBody.innerHTML = `<tr><td colspan="10" class="text-center p-4">${__('no_items_found_for_return')}</td></tr>`;
            return;
        }

        items.forEach(item => {
            const isFullyProcessed = item.processed_quantity >= item.expected_quantity;
            const mainRow = returnItemsTableBody.insertRow();
            mainRow.className = isFullyProcessed ? 'table-success fw-bold' : 'fw-bold';

            mainRow.innerHTML = `
                <td>${item.sku}</td>
                <td>${item.product_name}</td>
                <td>${item.article_no || __('n_a')}</td>
                <td><span class="badge bg-info">${item.expected_dot_code || __('n_a')}</span></td>
                <td><span class="badge bg-secondary">${item.received_dot_code || __('n_a')}</span></td>
                <td>${item.expected_quantity}</td>
                <td>${item.processed_quantity}</td>
                <td>${item.condition || __('n_a')}</td>
                <td>${item.putaway_location_code || __('n_a')}</td>
                <td class="text-center">
                    ${!isFullyProcessed ? `<button class="btn btn-sm btn-info inspect-item-btn" 
                                            data-return-item-id="${item.return_item_id}" 
                                            data-product-id="${item.product_id}"
                                            data-expected-dot="${item.expected_dot_code || ''}"
                                            data-remaining-qty="${item.expected_quantity - item.processed_quantity}"
                                            title="${__('inspect_and_putaway')}">
                                            <i class="bi bi-box-arrow-in-down"></i>
                                         </button>` : `<span class="badge bg-success">${__('complete')}</span>`}
                </td>
            `;

            if (item.putaways && item.putaways.length > 0) {
                item.putaways.forEach(putaway => {
                    const putawayRow = returnItemsTableBody.insertRow();
                    putawayRow.className = 'table-light';
                    putawayRow.innerHTML = `
                        <td colspan="8" class="text-end fst-italic py-1">
                            ↳ ${__('putaway_to')} <strong>${putaway.location_code}</strong>
                        </td>
                        <td class="py-1">${putaway.quantity}</td>
                        <td class="text-center py-1">
                            <button class="btn btn-sm btn-outline-secondary reprint-sticker-btn" data-inventory-id="${putaway.inventory_id}" title="${__('reprint_sticker')}">
                                <i class="bi bi-printer"></i>
                            </button>
                        </td>
                    `;
                });
            }
        });

        $('.inspect-item-btn').off('click').on('click', showInspectionModal);
        $('.reprint-sticker-btn').off('click').on('click', function() {
            const inventoryId = $(this).data('inventory-id');
            $('#print-frame-returns').attr('src', `print_label_returns.php?inventory_id=${inventoryId}`);
        });
    }

    async function showInspectionModal(event) {
        const button = event.currentTarget;
        const returnItemId = button.dataset.returnItemId;
        const productId = button.dataset.productId;
        const remainingQty = button.dataset.remainingQty;
        const expectedDot = button.dataset.expectedDot;

        const { value: formValues } = await Swal.fire({
            title: __('inspect_and_putaway_item'),
            html: `
                <form id="inspectForm" class="text-start mt-3">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="swal-quantity" class="form-label">${__('quantity_to_process')}</label>
                            <input type="number" id="swal-quantity" class="form-control" value="${remainingQty}" min="1" max="${remainingQty}" required>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="swal-condition" class="form-label">${__('condition')}</label>
                            <select id="swal-condition" class="form-select">
                                <option value="Good" selected>${__('good_condition')}</option>
                                <option value="Damaged">${__('damaged')}</option>
                                <option value="Scrap">${__('scrap')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">${__('expected_dot')}</label>
                            <input type="text" class="form-control" value="${expectedDot}" disabled readonly>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="swal-received-dot" class="form-label">${__('received_dot_code')}*</label>
                            <input type="text" id="swal-received-dot" class="form-control" placeholder="WWYY" maxlength="4" required>
                        </div>
                    </div>
                    <div id="putaway-group" class="mb-3">
                        <div class="mb-3">
                            <label for="swal-putaway-type" class="form-label">${__('putaway_destination')}</label>
                            <select id="swal-putaway-type" class="form-select">
                                <option value="same" selected>${__('same_warehouse')}</option>
                                <option value="other">${__('another_warehouse')}</option>
                            </select>
                        </div>
                        <div class="mb-3" id="warehouse-select-container" style="display: none;">
                           <label for="swal-warehouse-select" class="form-label">${__('select_another_warehouse')}</label>
                           <select id="swal-warehouse-select" class="form-select" style="width:100%"></select>
                        </div>
                        <div id="putaway-location-group" class="mb-3">
                           <label for="swal-location-select" class="form-label">${__('putaway_location')}</label>
                           <select id="swal-location-select" class="form-select" style="width:100%"></select>
                        </div>
                    </div>
                </form>`,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            confirmButtonText: __('submit_inspection'),
            allowOutsideClick: false,
            didOpen: async () => {
                const conditionSelect = document.getElementById('swal-condition');
                const putawayGroup = document.getElementById('putaway-group');
                const quantityInput = document.getElementById('swal-quantity');
                const $locationSelect = $('#swal-location-select');
                const $warehouseSelect = $('#swal-warehouse-select');
                const $putawayTypeSelect = $('#swal-putaway-type');
                const $warehouseSelectContainer = $('#warehouse-select-container');

                let allWarehouses = [];

                const formatLocation = (location) => {
                    if (!location.id) return location.text;
                    const $option = $(location.element);
                    const availableStr = $option.data('available');
                    const available = (availableStr === null || typeof availableStr === 'undefined') ? null : parseInt(availableStr, 10);
                    const quantity = parseInt(quantityInput.value, 10);
                    const quantityToMove = (!isNaN(quantity) && quantity > 0) ? quantity : 0;
                    let badge = '';
                    if (available === null || isNaN(available)) {
                        badge = `<span class="badge bg-secondary float-end">${__('availability_not_set')}</span>`;
                    } else if (quantityToMove > 0 && quantityToMove > available) {
                        badge = `<span class="badge bg-danger float-end">${__('space_not_available')} (${__('avail')}: ${available})</span>`;
                    } else {
                        badge = `<span class="badge bg-success float-end">${__('available')}: ${available}</span>`;
                    }
                    return $(`<div>${location.text} ${badge}</div>`);
                };

                const validateLocationCapacity = () => {
                    const quantity = parseInt(quantityInput.value, 10);
                    const quantityToValidate = (!isNaN(quantity) && quantity > 0) ? quantity : 1;
                    let isSelectedDisabled = false;
                    $locationSelect.find('option').each(function() {
                        const option = $(this);
                        if (!option.val()) return;
                        const availableStr = option.data('available');
                        const available = (availableStr === null || typeof availableStr === 'undefined') ? null : parseInt(availableStr, 10);
                        if (available === null || isNaN(available) || quantityToValidate > available) {
                            option.prop('disabled', true);
                            if(option.is(':selected')) {
                                isSelectedDisabled = true;
                            }
                        } else {
                            option.prop('disabled', false);
                        }
                    });
                    if(isSelectedDisabled) {
                        $locationSelect.val(null);
                    }
                    $locationSelect.select2('destroy').select2({
                        placeholder: __('scan_or_select_location'),
                        theme: 'bootstrap-5',
                        dropdownParent: $('.swal2-container'),
                        templateResult: formatLocation,
                        templateSelection: formatLocation,
                        escapeMarkup: m => m
                    });
                }

                const loadLocations = async (warehouseId) => {
                    $locationSelect.empty().select2({
                        placeholder: __('loading_locations'),
                        theme: 'bootstrap-5',
                        dropdownParent: $('.swal2-container')
                    });
                    try {
                        const response = await fetchData(`api/returns_api.php?action=get_putaway_locations&warehouse_id=${warehouseId}`);
                        $locationSelect.empty().append(new Option('', '', true, true));
                        if (response.success && Array.isArray(response.data)) {
                            response.data.forEach(loc => {
                                const option = new Option(loc.location_code, loc.location_code, false, false);
                                option.dataset.available = loc.available_capacity;
                                option.dataset.full = loc.is_full;
                                $locationSelect.append(option);
                            });
                        }
                        validateLocationCapacity();
                    } catch (e) {
                        console.error("Failed to load locations", e);
                        $locationSelect.select2({ placeholder: __('error_loading_locations'), theme: 'bootstrap-5', dropdownParent: $('.swal2-container') });
                    }
                };
                
                const populateWarehouseSelect = (excludeCurrent = false) => {
                    $warehouseSelect.empty();
                    const warehousesToShow = excludeCurrent 
                        ? allWarehouses.filter(wh => wh.warehouse_id != currentWarehouseId)
                        : allWarehouses;
                    warehousesToShow.forEach(wh => {
                        const option = new Option(wh.warehouse_name, wh.warehouse_id, false, false);
                        $warehouseSelect.append(option);
                    });
                    $warehouseSelect.val(null).select2({
                        placeholder: __('select_a_warehouse'),
                        theme: 'bootstrap-5',
                        dropdownParent: $('.swal2-container')
                    }).trigger('change');
                };
                
                $locationSelect.select2({ placeholder: __('select_a_warehouse_first'), theme: 'bootstrap-5', dropdownParent: $('.swal2-container') });

                try {
                    const response = await fetchData('api/returns_api.php?action=get_warehouses');
                    if(response.success && Array.isArray(response.data)) {
                        allWarehouses = response.data;
                        loadLocations(currentWarehouseId);
                    }
                } catch(e) {
                     console.error("Failed to load warehouses", e);
                }

                quantityInput.addEventListener('input', validateLocationCapacity);
                
                $warehouseSelect.on('change', function() {
                    const selectedWarehouseId = $(this).val();
                    if(selectedWarehouseId) {
                        loadLocations(selectedWarehouseId);
                    } else {
                        $locationSelect.empty().select2({ placeholder: __('select_a_warehouse_first'), theme: 'bootstrap-5', dropdownParent: $('.swal2-container') });
                    }
                });

                conditionSelect.addEventListener('change', (e) => {
                    putawayGroup.style.display = e.target.value === 'Good' ? 'block' : 'none';
                });

                $putawayTypeSelect.on('change', function() {
                    const type = $(this).val();
                    if (type === 'other') {
                        $warehouseSelectContainer.show();
                        populateWarehouseSelect(true);
                    } else {
                        $warehouseSelectContainer.hide();
                        loadLocations(currentWarehouseId);
                    }
                });
            },
            preConfirm: () => {
                const quantity = document.getElementById('swal-quantity').value;
                const condition = document.getElementById('swal-condition').value;
                const putawayType = document.getElementById('swal-putaway-type').value;
                const locationCode = document.getElementById('swal-location-select').value;
                const receivedDot = document.getElementById('swal-received-dot').value;

                let warehouseId;
                if (putawayType === 'same') {
                    warehouseId = currentWarehouseId;
                } else {
                    warehouseId = document.getElementById('swal-warehouse-select').value;
                }

                if (!quantity || parseInt(quantity) <= 0 || parseInt(quantity) > remainingQty) {
                    Swal.showValidationMessage(`${__('please_enter_quantity_between')} 1 ${__('and')} ${remainingQty}.`);
                    return false;
                }
                if (!receivedDot || receivedDot.length !== 4 || isNaN(receivedDot)) {
                    Swal.showValidationMessage(__('please_enter_valid_4_digit_dot'));
                    return false;
                }
                if (condition === 'Good' && !locationCode) {
                    Swal.showValidationMessage(__('putaway_location_required_for_good_items'));
                    return false;
                }
                if (condition === 'Good' && !warehouseId) {
                    Swal.showValidationMessage(__('putaway_warehouse_must_be_selected'));
                    return false;
                }
                
                return {
                    return_item_id: returnItemId,
                    quantity: parseInt(quantity),
                    condition: condition,
                    location_barcode: locationCode,
                    received_dot_code: receivedDot,
                    putaway_warehouse_id: parseInt(warehouseId)
                };
            }
        });

        if (formValues) {
            handleProcessItem(formValues);
        }
    }

    async function handleProcessItem(data) {
        try {
            const result = await fetchData('api/returns_api.php?action=process_item', 'POST', data);
            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: __('putaway_successful'),
                    text: result.message,
                    showCancelButton: true,
                    confirmButtonText: `<i class="bi bi-printer"></i> ${__('print_stickers')}`,
                    cancelButtonText: __('close'),
                    allowOutsideClick: false,
                }).then((dialogResult) => {
                    if (dialogResult.isConfirmed && result.inventory_id) {
                        $('#print-frame-returns').attr('src', `print_label_returns.php?inventory_id=${result.inventory_id}`);
                    }
                });

                const currentReturnId = currentReturnIdInput.value;
                if (currentReturnId) {
                    await loadReturnItems(currentReturnId);
                }
                await loadReturns();
            }
        } catch (error) {
            Swal.fire(__('error'), `${__('failed_to_process_item')}: ${error.message}`, 'error');
        }
    }
});
