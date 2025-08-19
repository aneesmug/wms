// public/js/inbound.js
// 014-inbound.js

/*
* MODIFICATION SUMMARY:
* 014 (2025-08-19): Implemented specific, sequential validation for the "Add Single Item" modal.
* - The `preConfirm` logic in `showAddItemModal` now checks each required field (Product, Quantity, DOT) one by one.
* - It will now display a unique error message for the first empty field it finds, rather than a single generic message.
* - This provides clearer feedback to the user about what information is missing.
*/

$(document).ready(function() {
    // --- DOM Elements ---
    const processingSection = $('#processingSection');
    const addContainerBtn = $('#addContainerBtn');
    const showAddItemModalBtn = $('#showAddItemModalBtn');
    const showBulkImportModalBtn = $('#showBulkImportModalBtn');
    const itemActionsContainer = $('#itemActionsContainer');
    const itemActionsSeparator = $('#itemActionsSeparator');
    const arrivalActionContainer = $('#arrivalActionContainer');
    const markArrivedBtn = $('#markArrivedBtn');
    const verificationActionContainer = $('#verificationActionContainer');
    const confirmVerificationBtn = $('#confirmVerificationBtn');
    const verificationSearchContainer = $('#verificationSearchContainer');
    const verificationSearchInput = $('#verificationSearchInput');
    const putawaySection = $('#putawaySection');
    const statusFilter = $('#statusFilter');
    
    const selectedReceiptNumberEl = $('#selectedReceiptNumber');
    const selectedContainerNumberEl = $('#selectedContainerNumber');

    const containerList = $('#containerList');
    const containerItemsList = $('#containerItemsList');
    const itemsListHeader = $('#itemsListHeader');
    const inboundReceiptsTable = $('#inboundReceiptsTable');
    const showCreateReceiptBtn = $('#showCreateReceiptBtn');
    
    // --- State Variables ---
    let currentReceiptId = null;
    let currentContainerId = null;
    let selectedInboundItemId = null;
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    let supplierOptionsHtml = '';
    let availableLocationsData = [];
    let table;
    let dotCodeOptions = [];
    let currentContainers = [];
    let allProductsData = [];

    // --- Initialize Page & Event Listeners ---
    initializePage();

    showCreateReceiptBtn.on('click', showCreateReceiptPopup);
    addContainerBtn.on('click', showAddContainerPopup);
    showAddItemModalBtn.on('click', showAddItemModal);
    showBulkImportModalBtn.on('click', showBulkImportModal);
    markArrivedBtn.on('click', function() {
        const container = currentContainers.find(c => c.container_id === currentContainerId);
        if (container) {
            handleMarkArrivedClick(container);
        }
    });
    confirmVerificationBtn.on('click', handleConfirmVerification);
    
    statusFilter.on('change', function() {
        if (table) {
            const selectedStatus = $(this).val();
            table.column(4).search(selectedStatus ? '^' + selectedStatus + '$' : '', true, false).draw();
        }
    });

    verificationSearchInput.on('keyup', function() {
        const searchTerm = $(this).val().toLowerCase();
        $('#containerItemsList .list-group-item[data-item-id]').filter(function() {
            $(this).toggle($(this).text().toLowerCase().indexOf(searchTerm) > -1)
        });
    });

    inboundReceiptsTable.on('click', '.select-receipt-btn', function() {
        selectReceipt($(this).data('receipt-id'), $(this).data('receipt-number'));
    });
    inboundReceiptsTable.on('click', '.view-details-btn', function() {
        handleViewDetails($(this).data('receipt-id'));
    });
    inboundReceiptsTable.on('click', '.cancel-receipt-btn', function() {
        handleCancelReceipt($(this).data('receipt-id'));
    });
    
    containerList.on('click', '.list-group-item-action', function(e) {
        if ($(e.target).closest('.container-actions').length === 0) {
            selectContainer($(this).data('container'));
        }
    });
    containerList.on('click', '.edit-container-btn', function(e) {
        e.stopPropagation();
        handleEditContainerClick($(this).closest('.list-group-item-action').data('container'));
    });
    containerList.on('click', '.delete-container-btn', function(e) {
        e.stopPropagation();
        handleDeleteContainerClick($(this).closest('.list-group-item-action').data('container'));
    });

    containerItemsList.on('click', '.list-group-item.putaway-candidate', function() {
        selectPutawayCandidate($(this).data('item'));
    });
    containerItemsList.on('click', '.edit-item-btn', function(e) {
        e.stopPropagation();
        handleEditInboundItemClick($(this).closest('.list-group-item').data('item'));
    });
    containerItemsList.on('click', '.delete-item-btn', function(e) {
        e.stopPropagation();
        handleDeleteInboundItemClick($(this).closest('.list-group-item').data('item'));
    });

    // --- Verification Checkbox Listeners ---
    containerItemsList.on('change', '#verifyCheckAll', function() {
        containerItemsList.find('.verify-item-check').prop('checked', $(this).prop('checked'));
    });

    containerItemsList.on('change', '.verify-item-check', function() {
        if ($('.verify-item-check:checked').length === $('.verify-item-check').length) {
            $('#verifyCheckAll').prop('checked', true);
        } else {
            $('#verifyCheckAll').prop('checked', false);
        }
    });


    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire({
                title: __('no_warehouse_selected'), text: __('select_warehouse_continue'), icon: 'error',
                confirmButtonText: __('select_warehouse'), confirmButtonColor: '#dc3741', allowOutsideClick: false
            }).then(() => { window.location.href = 'dashboard.php'; });
            return;
        }
        const canManageInbound = ['operator', 'manager'].includes(currentWarehouseRole);
        if (!canManageInbound) {
            $('button').prop('disabled', true);
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: __('view_only_permissions'), showConfirmButton: false, timer: 3000, timerProgressBar: true });
        }
        
        await Promise.all([
            loadSuppliersForDropdown(),
            loadInboundReceipts(),
            loadAvailableLocations(),
            populateAllProductsDropdown(),
            populateDotCodeDropdown()
        ]);
    }
    
    function selectReceipt(receiptId, receiptNumber) {
        currentReceiptId = receiptId;
        selectedReceiptNumberEl.text(`#${receiptNumber}`);
        processingSection.removeClass('d-none');
        processingSection[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        showMessageBox(`${__('selected_receipt')}: ${receiptNumber}`, 'info');
        resetContainerSelection();
        loadContainerData(receiptId);
    }
    
    function selectContainer(containerData) {
        currentContainerId = containerData.container_id;
        $('#containerList .list-group-item-action').removeClass('active');
        $(`#containerList .list-group-item-action[data-container-id="${currentContainerId}"]`).addClass('active');
        selectedContainerNumberEl.text(containerData.container_number);
        resetItemSelection();
        loadContainerItems(currentContainerId, containerData.status);

        // UI LOGIC BASED ON CONTAINER STATUS
        itemActionsContainer.addClass('d-none');
        arrivalActionContainer.addClass('d-none');
        verificationActionContainer.addClass('d-none');
        verificationSearchContainer.addClass('d-none');
        putawaySection.addClass('d-none');
        itemActionsSeparator.addClass('d-none');

        if (containerData.status === 'Expected') {
            itemActionsContainer.removeClass('d-none');
            arrivalActionContainer.removeClass('d-none');
            itemActionsSeparator.removeClass('d-none');
            itemsListHeader.text(__('expected_items'));
        } else if (containerData.status === 'Arrived') {
            verificationActionContainer.removeClass('d-none');
            verificationSearchContainer.removeClass('d-none');
            itemsListHeader.text(__('verify_received_items'));
        } else { // Processing, Partially Putaway, Completed
            putawaySection.removeClass('d-none');
            itemsListHeader.text(__('items_ready_for_putaway'));
        }
    }

    function selectPutawayCandidate(item) {
        selectedInboundItemId = item.inbound_item_id;
        const totalAvailableQty = (parseInt(item.received_quantity) || 0) - (parseInt(item.putaway_quantity) || 0);

        let locationOptionsHtml = '<option value=""></option>';
        availableLocationsData.forEach(location => {
            const disabled = location.is_locked == 1 ? 'disabled' : '';
            locationOptionsHtml += `<option value="${location.location_code}" ${disabled}>${location.location_code}</option>`;
        });

        Swal.fire({
            title: `${__('putaway_item')}: ${item.product_name}`,
            html: `
                <form id="swal-putaway-form" class="text-start">
                    <p>${__('batch')}: ${item.batch_number} | ${__('dot')}: ${item.dot_code}</p>
                     <div class="mb-3">
                        <label for="swal-putaway-quantity" class="form-label">${__('quantity_to_putaway')} (${__('available')}: ${totalAvailableQty})</label>
                        <input type="number" id="swal-putaway-quantity" class="form-control" value="${totalAvailableQty}" min="1" max="${totalAvailableQty}">
                    </div>
                    <div class="mb-3">
                        <label for="swal-putaway-location" class="form-label">${__('destination_location')}</label>
                        <select id="swal-putaway-location" class="form-select" style="width:100%">${locationOptionsHtml}</select>
                    </div>
                </form>
            `,
            confirmButtonText: __('putaway'),
            showCancelButton: true,
            didOpen: () => {
                const locationSelect = $('#swal-putaway-location');
                const quantityInput = $('#swal-putaway-quantity');

                const formatPutawayLocationOption = (option) => {
                    if (!option.id) return option.text;
                    const locationData = availableLocationsData.find(loc => loc.location_code === option.id);
                    if (!locationData) return option.text;

                    if (locationData.is_locked == 1) {
                        return $(`<div class="d-flex justify-content-between"><span>${option.text}</span><span class="badge bg-danger">${__('locked')}</span></div>`);
                    }

                    const qtyToPutaway = parseInt(quantityInput.val(), 10) || 0;
                    
                    if (!locationData.max_capacity_units || parseInt(locationData.max_capacity_units, 10) <= 0) {
                        return $(`<div class="d-flex justify-content-between"><span>${option.text}</span><span class="badge bg-secondary">${__('capacity_not_set')}</span></div>`);
                    }

                    const availableCapacity = parseInt(locationData.max_capacity_units, 10) - parseInt(locationData.current_usage, 10);
                    const badgeClass = (qtyToPutaway <= availableCapacity) ? 'bg-success' : 'bg-danger';
                    const badgeText = `${__('avail')}: ${availableCapacity}`;

                    return $(`<div class="d-flex justify-content-between"><span>${option.text}</span><span class="badge ${badgeClass}">${badgeText}</span></div>`);
                };

                const updateLocationOptions = () => {
                    const qty = parseInt(quantityInput.val(), 10);
                    if (isNaN(qty)) return;

                    $('#swal-putaway-location option').each(function() {
                        const option = $(this);
                        const locCode = option.val();
                        if (!locCode) return;
                        const locData = availableLocationsData.find(l => l.location_code === locCode);
                        if (locData) {
                             if (locData.is_locked == 1) {
                                option.prop('disabled', true);
                                return;
                            }
                            if (!locData.max_capacity_units || parseInt(locData.max_capacity_units, 10) <= 0) {
                                option.prop('disabled', true);
                            } else {
                                const available = parseInt(locData.max_capacity_units, 10) - parseInt(locData.current_usage, 10);
                                option.prop('disabled', qty > available);
                            }
                        }
                    });

                    if ($('#swal-putaway-location').find('option:selected').is(':disabled')) {
                        locationSelect.val(null).trigger('change');
                    }
                    
                    locationSelect.select2('destroy').select2({
                        theme: 'bootstrap-5',
                        dropdownParent: $('.swal2-popup'),
                        placeholder: __('select_destination_location'),
                        templateResult: formatPutawayLocationOption
                    });
                };
                
                locationSelect.select2({
                    theme: 'bootstrap-5',
                    dropdownParent: $('.swal2-popup'),
                    placeholder: __('select_destination_location'),
                    templateResult: formatPutawayLocationOption
                });

                quantityInput.on('input', updateLocationOptions);
                updateLocationOptions(); 
            },
            preConfirm: () => {
                const quantityInput = $('#swal-putaway-quantity');
                const maxAllowed = parseInt(quantityInput.attr('max'), 10);
                const data = {
                    putaway_quantity: parseInt(quantityInput.val(), 10),
                    location_article_no: $('#swal-putaway-location').val()
                };

                if (!data.location_article_no) {
                    Swal.showValidationMessage(__('location_required_for_putaway'));
                    return false;
                }
                if (isNaN(data.putaway_quantity) || data.putaway_quantity <= 0 || data.putaway_quantity > maxAllowed) {
                    Swal.showValidationMessage(`${__('enter_valid_qty_between')} 1 ${__('and')} ${maxAllowed}`);
                    return false;
                }
                return data;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                await handlePutawayItem(result.value);
            }
        });
    }

    // --- Data Loading and Rendering ---

    async function loadInboundReceipts() {
        const response = await fetchData('api/inbound_api.php');
        const canManageInbound = ['operator', 'manager'].includes(currentWarehouseRole);
        if ($.fn.DataTable.isDataTable('#inboundReceiptsTable')) table.destroy();
        table = inboundReceiptsTable.DataTable({
            data: response.success ? response.data : [],
            columns: [
                { data: 'receipt_id', visible: false }, { data: 'receipt_number' }, 
                { data: 'supplier_name', defaultContent: __('n_a') }, { data: 'actual_arrival_date', defaultContent: __('pending_arrival') },
                { data: 'status', render: data => {
                    const statusKey = data.toLowerCase().replace(/\s+/g, '_');
                    const statusClassMap = { 'completed': 'success', 'received': 'primary', 'partially_putaway': 'warning text-dark', 'pending': 'secondary', 'cancelled': 'danger', 'partially_received': 'info' };
                    return `<span class="badge bg-${statusClassMap[statusKey] || 'light text-dark'}">${__(statusKey, data)}</span>`;
                }},
                { data: null, orderable: false, className: 'text-end', render: (data, type, row) => {
                    let btns = `<button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-secondary view-details-btn" title="${__('view_details')}"><i class="bi bi-eye"></i></button>`;
                    if (row.status !== 'Completed' && row.status !== 'Cancelled' && canManageInbound) {
                        btns += ` <button data-receipt-id="${row.receipt_id}" data-receipt-number="${row.receipt_number}" class="btn btn-sm btn-primary select-receipt-btn ms-1" title="${__('select_for_processing')}"><i class="bi bi-check-circle"></i></button>`;
                        if (row.status === 'Pending') { btns += ` <button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-danger cancel-receipt-btn ms-1" title="${__('cancel_receipt')}"><i class="bi bi-x-circle"></i></button>`; }
                    }
                    return btns;
                }}
            ],
            responsive: true, order: [[0, 'desc']],
            language: { search: `<span>${__('search')}:</span> _INPUT_`, searchPlaceholder: `${__('search')}...`, lengthMenu: `${__('show')} _MENU_ ${__('entries')}`, info: `${__('showing')} _START_ ${__('to')} _END_ ${__('of')} _TOTAL_ ${__('entries')}`, infoEmpty: `${__('showing')} 0 ${__('to')} 0 ${__('of')} 0 ${__('entries')}`, infoFiltered: `(${__('filtered_from')} _MAX_ ${__('total_entries')})`, paginate: { first: __('first'), last: __('last'), next: __('next'), previous: __('previous') }, emptyTable: __('no_data_available_in_table'), zeroRecords: __('no_matching_records_found') }
        });
    }

    async function loadContainerData(receiptId) {
        const response = await fetchData(`api/inbound_api.php?receipt_id=${receiptId}`);
        containerList.empty();
        currentContainers = []; 
        if (response?.success && Array.isArray(response.data.containers)) {
            currentContainers = response.data.containers;
            if (currentContainers.length > 0) {
                currentContainers.forEach(container => {
                    const statusKey = container.status.toLowerCase().replace(/\s+/g, '_');
                    const statusClassMap = {'completed':'success', 'processing':'primary', 'partially_putaway':'warning', 'arrived':'info', 'expected':'secondary'};
                    let actionButtons = '';
                    if (container.status === 'Expected') {
                         actionButtons += `<button class="btn btn-sm btn-outline-warning edit-container-btn ms-1" title="${__('edit_container')}"><i class="bi bi-pencil"></i></button>`;
                         if (!container.items || container.items.length === 0) { actionButtons += `<button class="btn btn-sm btn-outline-danger delete-container-btn ms-1" title="${__('delete_container')}"><i class="bi bi-trash"></i></button>`; }
                    }
                    const itemHtml = $(`<div class="list-group-item list-group-item-action" data-container-id="${container.container_id}"><div class="d-flex w-100 justify-content-between"><div><h6 class="mb-1">${__('container')}: ${container.container_number}</h6><p class="mb-1 small">${__('reference_no')}: ${container.reference_number || __('n_a')} | B/L: ${container.bl_number || __('n_a')}</p><small>${__('status')}: <span class="badge bg-${statusClassMap[statusKey] || 'light'}">${__(statusKey, container.status)}</span></small></div><div class="container-actions align-self-center">${actionButtons}</div></div></div>`);
                    itemHtml.data('container', container);
                    containerList.append(itemHtml);
                });
            } else { containerList.html(`<div class="list-group-item">${__('no_containers_found')}</div>`); }
        } else { containerList.html(`<div class="list-group-item text-danger">${__('could_not_load_containers')}</div>`); }
    }
    
    async function loadContainerItems(containerId, containerStatus) {
        containerItemsList.html(`<div class="list-group-item">${__('loading')}...</div>`);
        const response = await fetchData(`api/inbound_api.php?receipt_id=${currentReceiptId}`);
        containerItemsList.empty();
        if (response?.success) {
            const container = response.data.containers.find(c => c.container_id == containerId);
            if (container && Array.isArray(container.items) && container.items.length > 0) {
                
                if (containerStatus === 'Arrived') {
                    // Render verification table
                    let tableHtml = `<table class="table table-sm"><thead><tr><th><input class="form-check-input" type="checkbox" id="verifyCheckAll"></th><th>${__('product')}</th><th>${__('article_no')}</th><th>${__('expected')}</th><th>${__('verified')}</th></tr></thead><tbody>`;
                    container.items.forEach(item => {
                        tableHtml += `
                            <tr data-item-id="${item.inbound_item_id}">
                                <td><input class="form-check-input verify-item-check" type="checkbox"></td>
                                <td>${item.product_name} (${item.sku})<br><small>${__('dot')}: ${item.dot_code}</small></td>
                                <td>${item.article_no}</td>
                                <td>${item.expected_quantity}</td>
                                <td><input type="number" class="form-control form-control-sm verified-qty-input" value="${item.expected_quantity}" min="0"></td>
                            </tr>`;
                    });
                    tableHtml += '</tbody></table>';
                    containerItemsList.html(tableHtml);
                } else {
                    // Render simple list for 'Expected' or putaway candidates for other statuses
                    container.items.forEach(item => {
                        let itemHtml;
                        const availableQty = (parseInt(item.received_quantity) || 0) - (parseInt(item.putaway_quantity) || 0);
                        
                        if (item.status === 'Expected') {
                            itemHtml = $(`<div class="list-group-item" data-item-id="${item.inbound_item_id}"><div class="d-flex justify-content-between align-items-center"><div><strong>${item.product_name}</strong> (${item.sku})<br><small>${__('expected_qty')}: ${item.expected_quantity} | ${__('dot')}: ${item.dot_code}</small></div><div class="item-actions"><button class="btn btn-sm btn-outline-primary edit-item-btn" title="${__('edit_item')}"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger delete-item-btn ms-2" title="${__('delete_item')}"><i class="bi bi-trash"></i></button></div></div></div>`);
                        } else if (availableQty > 0) {
                            itemHtml = $(`<div class="list-group-item list-group-item-action putaway-candidate" data-item-id="${item.inbound_item_id}"><div class="d-flex justify-content-between align-items-center"><div><strong>${item.product_name}</strong> (${item.sku})<br><small>${__('batch')}: ${item.batch_number} | ${__('avail_qty')}: ${availableQty} | ${__('dot')}: ${item.dot_code}</small></div></div></div>`);
                        }
                        
                        if (itemHtml) { itemHtml.data('item', item); containerItemsList.append(itemHtml); }
                    });
                }

                if (containerItemsList.children().length === 0) { containerItemsList.html(`<div class="list-group-item">${__('no_items_to_display')}</div>`); }
            } else { containerItemsList.html(`<div class="list-group-item">${__('no_items_found_for_this_container')}</div>`); }
        } else { containerItemsList.html(`<div class="list-group-item text-danger">${__('could_not_load_items')}</div>`); }
    }

    // --- Form Handling and API Calls ---

    async function handleAddExpectedItem(itemData) {
        if (!currentReceiptId || !currentContainerId) { showMessageBox(__('select_receipt_and_container_first'), 'error'); return; }
        const data = { receipt_id: currentReceiptId, container_id: currentContainerId, ...itemData };
        const result = await fetchData('api/inbound_api.php?action=addExpectedItem', 'POST', data);
        if (result?.success) {
            showMessageBox(result.message, 'success');
            await loadContainerItems(currentContainerId, 'Expected');
            return true;
        } else {
            showMessageBox(result.message || __('failed_to_add_expected_item'), 'error');
            return false;
        }
    }

    async function handlePutawayItem(putawayData) {
        if (!currentReceiptId || !selectedInboundItemId) { showMessageBox(__('select_item_for_putaway_first'), 'error'); return; }
        const data = { receipt_id: currentReceiptId, inbound_item_id: selectedInboundItemId, ...putawayData };

        const result = await fetchData('api/inbound_api.php?action=putawayItem', 'POST', data);
        if (result?.success) {
            Swal.fire({
                icon: 'success', title: __('putaway_successful'), text: result.message, showCancelButton: true,
                confirmButtonText: `<i class="bi bi-printer"></i> ${__('print_stickers')}`, cancelButtonText: __('close'), allowOutsideClick: false,
            }).then((dialogResult) => {
                if (dialogResult.isConfirmed) {
                    $('#print-frame').remove(); 
                    $('<iframe>', { id: 'print-frame', src: `print_label.php?inventory_id=${result.inventory_id}`, style: 'display:none;' }).appendTo('body');
                }
            });
            resetItemSelection();
            await Promise.all([loadInboundReceipts(), loadContainerData(currentReceiptId), loadAvailableLocations()]);
            const containerData = currentContainers.find(c => c.container_id === currentContainerId);
            if(containerData) selectContainer(containerData);
        } else { showMessageBox(result.message || __('failed_to_putaway_item'), 'error'); }
    }

    async function handleCancelReceipt(receiptId) {
        showConfirmationModal(__('are_you_sure'), __('cancel_receipt_warn'), async () => {
            const response = await fetchData('api/inbound_api.php?action=cancelReceipt', 'POST', { receipt_id: receiptId });
            if (response.success) {
                showMessageBox(response.message, 'success');
                if (currentReceiptId === receiptId) { processingSection.addClass('d-none'); currentReceiptId = null; selectedReceiptNumberEl.text(''); }
                await loadInboundReceipts();
            } else { showMessageBox(response.message, 'error'); }
        }, { confirmButtonText: __('yes_cancel_it') });
    }
    
    async function handleMarkArrivedClick(container) {
         showConfirmationModal(__('are_you_sure'), `${__('mark_container_as_arrived')} #${container.container_number}?`, async () => {
            const response = await fetchData('api/inbound_api.php?action=markContainerArrived', 'POST', { container_id: container.container_id });
            if (response.success) {
                showMessageBox(response.message, 'success');
                await loadInboundReceipts();
                const updatedContainerData = { ...container, status: 'Arrived' };
                selectContainer(updatedContainerData); 
                await loadContainerData(currentReceiptId);
            } else { showMessageBox(response.message, 'error'); }
        }, { confirmButtonText: __('yes_mark_as_arrived') });
    }

    async function handleConfirmVerification() {
        const itemsToVerify = [];
        let hasErrors = false;
        
        containerItemsList.find('tr[data-item-id]').has('.verify-item-check:checked').each(function() {
            const row = $(this);
            const itemId = row.data('item-id');
            const verifiedQtyInput = row.find('.verified-qty-input');
            const verifiedQty = parseInt(verifiedQtyInput.val(), 10);

            if (isNaN(verifiedQty) || verifiedQty < 0) {
                verifiedQtyInput.addClass('is-invalid');
                hasErrors = true;
            } else {
                verifiedQtyInput.removeClass('is-invalid');
                itemsToVerify.push({
                    inbound_item_id: itemId,
                    verified_quantity: verifiedQty
                });
            }
        });

        if (hasErrors) {
            showMessageBox(__('please_enter_valid_quantities_for_all_items'), 'error');
            return;
        }

        if (itemsToVerify.length === 0) {
            showMessageBox(__('please_check_at_least_one_item_to_receive'), 'error');
            return;
        }

        const response = await fetchData('api/inbound_api.php?action=verifyAndReceiveItems', 'POST', {
            container_id: currentContainerId,
            items: itemsToVerify
        });

        if (response.success) {
            showMessageBox(response.message, 'success');
            await loadInboundReceipts();
            const container = currentContainers.find(c => c.container_id === currentContainerId);
            const updatedContainerData = { ...container, status: 'Processing' };
            selectContainer(updatedContainerData);
            await loadContainerData(currentReceiptId);
        } else {
            showMessageBox(response.message, 'error');
        }
    }

    // --- Popups ---
    
    function showCreateReceiptPopup() {
        Swal.fire({
            title: __('create_new_receipt'), html: `<form id="swal-form" class="text-start"><div class="col-12"><label for="swal-supplierSelect" class="form-label">${__('supplier')}</label><select id="swal-supplierSelect" class="form-select" required>${supplierOptionsHtml}</select></div></form>`,
            confirmButtonText: __('create_receipt'), showCancelButton: true, cancelButtonText: __('cancel'), allowOutsideClick: false,
            didOpen: () => $('#swal-supplierSelect').select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-popup') }),
            preConfirm: () => {
                const supplierId = $('#swal-supplierSelect').val();
                if (!supplierId) { Swal.showValidationMessage(`${__('supplier')} ${__('is_required')}.`); return false; }
                return { supplier_id: supplierId };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const createResult = await fetchData('api/inbound_api.php?action=createReceipt', 'POST', result.value);
                if (createResult?.success) {
                    showMessageBox(createResult.message, 'success');
                    await loadInboundReceipts();
                    selectReceipt(createResult.receipt_id, createResult.receipt_number);
                } else { showMessageBox(createResult.message, 'error'); }
            }
        });
    }

    function showAddContainerPopup() {
        if (!currentReceiptId) { showMessageBox(__("select_receipt_first"), "error"); return; }
        const containerCount = currentContainers.length;
        let referenceHtml = (containerCount === 0)
            ? `<div class="col-md-6"><label for="swal-referenceNumber" class="form-label">${__('reference_no')}</label><input type="text" id="swal-referenceNumber" class="form-control numeric-only" required></div>`
            : `<div class="col-md-6"><label for="swal-referenceNumber" class="form-label">${__('reference_no')}</label><input type="text" id="swal-referenceNumber" class="form-control numeric-only" value="${currentContainers[0].reference_number.split('-')[0]}-${containerCount + 1}" disabled></div>`;

        Swal.fire({
            title: __('add_new_container'),
            html: `<form id="swal-containerForm" class="row g-3 text-start needs-validation" novalidate><div class="col-md-6"><label for="swal-blNumber" class="form-label">${__('bl_number')}</label><input type="text" id="swal-blNumber" class="form-control"></div><div class="col-md-6"><label for="swal-containerNumber" class="form-label">${__('container_no')}</label><input type="text" id="swal-containerNumber" class="form-control" required></div><div class="col-md-6"><label for="swal-serialNumber" class="form-label">${__('serial_no')}</label><input type="text" id="swal-serialNumber" class="form-control"></div>${referenceHtml}<div class="col-12"><label for="swal-expectedArrivalDate" class="form-label">${__('expected_arrival')}</label><input type="text" id="swal-expectedArrivalDate" class="form-control datepicker-input" required></div></form>`,
            confirmButtonText: __('add_container'), showCancelButton: true, allowOutsideClick: false,
            didOpen: () => {
                const dateElement = document.getElementById('swal-expectedArrivalDate');
                initializeDatepicker(dateElement, Swal.getPopup()); 
                dateElement.value = new Date().toISOString().split('T')[0];
            },
            preConfirm: () => {
                const containerNumber = $('#swal-containerNumber').val().trim();
                const expectedArrivalDate = $('#swal-expectedArrivalDate').val();
                const referenceNumber = $('#swal-referenceNumber').val().trim();
                if (!containerNumber || !expectedArrivalDate || !referenceNumber) { Swal.showValidationMessage(`${__('container_no')}, ${__('reference_no')}, ${__('and')} ${__('expected_arrival')} ${__('are_required')}.`); return false; }
                return { receipt_id: currentReceiptId, bl_number: $('#swal-blNumber').val().trim(), container_number: containerNumber, serial_number: $('#swal-serialNumber').val().trim(), reference_number: referenceNumber, expected_arrival_date: expectedArrivalDate };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const addResult = await fetchData('api/inbound_api.php?action=addContainer', 'POST', result.value);
                if (addResult?.success) { showMessageBox(addResult.message, 'success'); await loadContainerData(currentReceiptId); } 
                else { showMessageBox(addResult.message, 'error'); }
            }
        });
    }

    async function handleViewDetails(receiptId) {
        const [receiptResponse, historyResponse] = await Promise.all([
            fetchData(`api/inbound_api.php?receipt_id=${receiptId}`),
            fetchData(`api/inbound_api.php?action=getPutawayHistory&receipt_id=${receiptId}`)
        ]);

        if (!receiptResponse.success) { showMessageBox(receiptResponse.message || __('could_not_fetch_receipt_details'), 'error'); return; }

        const receipt = receiptResponse.data;
        const putawayHistory = historyResponse.success ? historyResponse.data : [];

        const putawaysByItem = putawayHistory.reduce((acc, putaway) => {
            const key = putaway.source_inbound_item_id;
            if (!acc[key]) acc[key] = [];
            acc[key].push(putaway);
            return acc;
        }, {});

        let containersHtml = '';
        if (receipt.containers && receipt.containers.length > 0) {
            receipt.containers.forEach(container => {
                let itemsHtml = '';
                if (container.items && container.items.length > 0) {
                    container.items.forEach(item => {
                        const qtyText = item.status === 'Expected' ? `${item.expected_quantity} / 0` : `${item.received_quantity} / ${item.putaway_quantity}`;
                        itemsHtml += `<tr class="fw-bold table-primary">
                            <td>${item.sku}</td><td>${item.article_no || __('n_a')}</td><td>${item.product_name}</td>
                            <td>${item.batch_number || item.dot_code}</td><td>${qtyText}</td><td></td>
                        </tr>`;

                        const itemPutaways = putawaysByItem[item.inbound_item_id] || [];
                        itemPutaways.forEach(putaway => {
                            itemsHtml += `<tr class="table-light">
                                <td colspan="3" class="text-end fst-italic py-1">↳ ${__('putaway_to')} <strong>${putaway.location_code}</strong></td>
                                <td class="py-1">${putaway.dot_code}</td><td class="py-1">${putaway.quantity}</td>
                                <td class="text-center py-1"><button class="btn btn-sm btn-outline-secondary reprint-btn" data-inventory-id="${putaway.inventory_id}" title="${__('reprint_stickers')}"><i class="bi bi-printer"></i></button></td>
                            </tr>`;
                        });
                    });
                } else { itemsHtml = `<tr><td colspan="6" class="text-center">${__('no_items_in_container')}</td></tr>`; }

                containersHtml += `<div class="mt-3">
                    <h6 class="bg-light p-2 rounded border">${__('container')}: ${container.container_number} <span class="fw-normal">(${__('reference_no')}: ${container.reference_number || __('n_a')})</span> - ${__('status')}: ${__(container.status.toLowerCase().replace(' ','_'), container.status)}</h6>
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>${__('sku')}</th><th>${__('article_no')}</th><th>${__('product')}</th><th>${__('batch_dot')}</th><th>${__('rcvd_putaway_qty')}</th><th>${__('actions')}</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>`;
            });
        } else { containersHtml = `<p class="text-center mt-3">${__('no_containers_associated')}</p>`; }

        const modalHtml = `<div class="text-start">
            <div class="mb-3 p-2 rounded bg-light border">
                <strong>${__('supplier')}:</strong> ${receipt.supplier_name || __('n_a')}<br>
                <strong>${__('status')}:</strong> ${__(receipt.status.toLowerCase().replace(' ','_'), receipt.status)}<br>
                <strong>${__('arrived')}:</strong> ${receipt.actual_arrival_date || __('n_a')}
            </div>
            ${containersHtml}
        </div>`;

        Swal.fire({
            title: `${__('receipt_details')}: #${receipt.receipt_number}`, html: modalHtml, width: '90vw', confirmButtonText: __('close'), allowOutsideClick: false,
            didOpen: () => {
                $('.swal2-container').on('click', '.reprint-btn', function() {
                    $('#print-frame').remove();
                    $('<iframe>', { id: 'print-frame', src: `print_label.php?inventory_id=${$(this).data('inventory-id')}`, style: 'display:none;' }).appendTo('body');
                });
            }
        });
    }

    function handleEditInboundItemClick(item) {
        const dotOptionsHtml = dotCodeOptions.map(opt => `<option value="${opt.id}" ${item.dot_code === opt.id ? 'selected' : ''}>${opt.text}</option>`).join('');
        const quantity = item.status === 'Expected' ? item.expected_quantity : item.received_quantity;
        const quantityLabel = item.status === 'Expected' ? __('expected_quantity') : __('received_quantity');
        
        Swal.fire({
            title: __('edit_inbound_item'),
            html: `
                <form id="swal-editForm" class="text-start">
                    <p><strong>${__('product')}:</strong> ${item.product_name}</p>
                    <div class="mb-3">
                        <label for="swal-quantity" class="form-label">${quantityLabel}</label>
                        <input type="number" id="swal-quantity" class="form-control" value="${quantity}" min="1">
                    </div>
                    <div class="mb-3">
                        <label for="swal-dot" class="form-label">${__('dot_code')}</label>
                        <select id="swal-dot" class="form-select">${dotOptionsHtml}</select>
                    </div>
                </form>
            `,
            confirmButtonText: __('update'), showCancelButton: true, allowOutsideClick: false, cancelButtonText: __('cancel'),
            didOpen: () => $('#swal-dot').select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-popup') }),
            preConfirm: () => {
                const qty = $('#swal-quantity').val();
                const dot_code = $('#swal-dot').val();
                if (!qty || qty <= 0 || !dot_code) { Swal.showValidationMessage(__('enter_valid_qty_dot')); return false; }
                return { inbound_item_id: item.inbound_item_id, quantity: parseInt(qty, 10), dot_code: dot_code };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=updateInboundItem', 'POST', result.value);
                if (response.success) {
                    showMessageBox(response.message, 'success');
                    await loadContainerItems(currentContainerId, item.status);
                } else { showMessageBox(response.message, 'error'); }
            }
        });
    }

    function handleDeleteInboundItemClick(item) {
        const qty = item.status === 'Expected' ? item.expected_quantity : item.received_quantity;
        const confirmationText = `${__('delete_inbound_item_confirm')} ${qty} x ${item.product_name}. ${__('action_cannot_be_undone')}`;
        showConfirmationModal(
            __('are_you_sure'), confirmationText,
            async () => {
                const response = await fetchData('api/inbound_api.php?action=deleteInboundItem', 'POST', { inbound_item_id: item.inbound_item_id });
                if (response.success) {
                    showMessageBox(response.message, 'success');
                    await loadContainerItems(currentContainerId, item.status);
                } else { showMessageBox(response.message, 'error'); }
            }, { confirmButtonText: __('yes_delete_it') }
        );
    }

    function handleEditContainerClick(container) {
        Swal.fire({
            title: __('edit_container'),
            html: `
                <form id="swal-containerForm" class="row g-3 text-start needs-validation" novalidate>
                    <div class="col-md-6"><label for="swal-blNumber" class="form-label">${__('bl_number')}</label><input type="text" id="swal-blNumber" class="form-control" value="${container.bl_number || ''}"></div>
                    <div class="col-md-6"><label for="swal-containerNumber" class="form-label">${__('container_no')}</label><input type="text" id="swal-containerNumber" class="form-control" value="${container.container_number}" required></div>
                    <div class="col-md-6"><label for="swal-serialNumber" class="form-label">${__('serial_no')}</label><input type="text" id="swal-serialNumber" class="form-control" value="${container.serial_number || ''}"></div>
                    <div class="col-md-6"><label for="swal-referenceNumber" class="form-label">${__('reference_no')}</label><input type="text" id="swal-referenceNumber" class="form-control" value="${container.reference_number || ''}" required></div>
                    <div class="col-12"><label for="swal-expectedArrivalDate" class="form-label">${__('expected_arrival')}</label><input type="text" id="swal-expectedArrivalDate" class="form-control datepicker-input" value="${container.expected_arrival_date}" required></div>
                </form>
            `,
            confirmButtonText: __('update_container'), showCancelButton: true, allowOutsideClick: false, cancelButtonText: __('cancel'),
            didOpen: () => initializeDatepicker(document.getElementById('swal-expectedArrivalDate'), Swal.getPopup()),
            preConfirm: () => {
                const containerNumber = $('#swal-containerNumber').val().trim();
                const expectedArrivalDate = $('#swal-expectedArrivalDate').val();
                const referenceNumber = $('#swal-referenceNumber').val().trim();
                if (!containerNumber || !expectedArrivalDate || !referenceNumber) { Swal.showValidationMessage(`${__('container_no')}, ${__('reference_no')}, ${__('and')} ${__('expected_arrival')} ${__('are_required')}.`); return false; }
                return { container_id: container.container_id, bl_number: $('#swal-blNumber').val().trim(), container_number: containerNumber, serial_number: $('#swal-serialNumber').val().trim(), reference_number: referenceNumber, expected_arrival_date: expectedArrivalDate };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const updateResult = await fetchData('api/inbound_api.php?action=updateContainer', 'POST', result.value);
                if (updateResult?.success) {
                    showMessageBox(updateResult.message, 'success');
                    await loadContainerData(currentReceiptId);
                } else { showMessageBox(updateResult.message, 'error'); }
            }
        });
    }

    function handleDeleteContainerClick(container) {
        const confirmationText = `${__('delete_container_confirm')} #${container.container_number}. ${__('action_cannot_be_undone')}`;
        showConfirmationModal(
            __('are_you_sure'), confirmationText,
            async () => {
                const response = await fetchData('api/inbound_api.php?action=deleteContainer', 'POST', { container_id: container.container_id });
                if (response.success) {
                    showMessageBox(response.message, 'success');
                    if(currentContainerId === container.container_id) resetContainerSelection();
                    await loadContainerData(currentReceiptId);
                } else { showMessageBox(response.message, 'error'); }
            }, { confirmButtonText: __('yes_delete_it') }
        );
    }
    
    function showAddItemModal() {
        if (!currentContainerId) { showMessageBox(__('select_container_first'), 'error'); return; }
        
        const productOptionsHtml = allProductsData.map(p => {
            const disabled = p.product.is_active != 1 ? 'disabled' : '';
            return `<option value="${p.id}" ${disabled}>${p.text}</option>`;
        }).join('');
        
        const dotOptionsHtml = dotCodeOptions.map(opt => `<option value="${opt.id}">${opt.text}</option>`).join('');

        Swal.fire({
            title: __('add_single_item'),
            html: `
                <form id="swal-add-item-form" class="text-start">
                    <div class="mb-3"><label for="swal-product" class="form-label">${__('product')}</label><select id="swal-product" class="form-select" style="width:100%"><option></option>${productOptionsHtml}</select></div>
                    <div class="mb-3"><label for="swal-quantity" class="form-label">${__('quantity')}</label><input type="number" id="swal-quantity" class="form-control" value="1" min="1"></div>
                    <div class="mb-3"><label for="swal-dot" class="form-label">${__('dot_code')}</label><select id="swal-dot" class="form-select" style="width:100%"><option></option>${dotOptionsHtml}</select></div>
                    <div class="mb-3"><label for="swal-cost" class="form-label">${__('unit_cost')}</label><input type="text" id="swal-cost" class="form-control amount-validation" placeholder="0.00"></div>
                </form>`,
            confirmButtonText: __('add_item'), showCancelButton: true, cancelButtonText: __('cancel'), allowOutsideClick: false, width: '600px',
            didOpen: () => {
                $('#swal-product').select2({ 
                    theme: 'bootstrap-5', 
                    dropdownParent: $('.swal2-popup'), 
                    placeholder: __('select_product'),
                    templateResult: (data) => {
                        if (!data.id) return data.text;
                        const productData = allProductsData.find(p => p.id === data.id);
                        if (productData && productData.product.is_active != 1) {
                            return $(`<span>${data.text} <span class="badge bg-danger">${__('inactive')}</span></span>`);
                        }
                        return data.text;
                    }
                });
                $('#swal-dot').select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-popup'), placeholder: __('select_dot_code') });
            },
            preConfirm: () => {
                const article_no = $('#swal-product').val();
                const quantity = $('#swal-quantity').val();
                const dot_code = $('#swal-dot').val();

                if (!article_no) {
                    Swal.showValidationMessage(__('product_is_required'));
                    return false;
                }
                if (!quantity || parseInt(quantity, 10) <= 0) {
                    Swal.showValidationMessage(__('quantity_is_required'));
                    return false;
                }
                if (!dot_code) {
                    Swal.showValidationMessage(__('dot_code_is_required'));
                    return false;
                }

                return {
                    article_no: article_no,
                    expected_quantity: parseInt(quantity, 10),
                    dot_code: dot_code,
                    unit_cost: parseFloat($('#swal-cost').val()) || null
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                await handleAddExpectedItem(result.value);
            }
        });
    }

    function handleDownloadInboundTemplate() {
        const templateData = [
            { [__('article_no')]: "PROD-001", [__('quantity')]: 100, [__('dot_code')]: "3425" },
            { [__('article_no')]: "PROD-002", [__('quantity')]: 50, [__('dot_code')]: "3525" }
        ];
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
        XLSX.writeFile(workbook, "inbound_bulk_template.xlsx");
    }

    function showBulkImportModal() {
        if (!currentContainerId) { showMessageBox(__('select_container_first'), 'error'); return; }
        Swal.fire({
            title: __('bulk_add_items'),
            html: `
                <div class="text-start p-2">
                    <p class="text-muted">${__('bulk_upload_instructions')}</p>
                    <a href="#" id="download-template-btn" class="btn btn-sm btn-link mb-2"><i class="bi bi-download me-1"></i>${__('download_template')}</a>
                    <input type="file" id="excelFileInput" class="form-control mt-3" accept=".xlsx, .xls">
                </div>
            `,
            confirmButtonText: __('upload_and_process'), showCancelButton: true, cancelButtonText: __('cancel'), allowOutsideClick: false, width: '600px',
            didOpen: () => {
                document.getElementById('download-template-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    handleDownloadInboundTemplate();
                });
            },
            preConfirm: () => {
                const fileInput = document.getElementById('excelFileInput');
                const file = fileInput.files[0];
                if (!file) { Swal.showValidationMessage(__('please_select_a_file')); return false; }

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const sheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[sheetName];
                            const json = XLSX.utils.sheet_to_json(worksheet);
                            
                            if (json.length === 0) {
                                return reject(new Error(__('excel_file_empty_or_invalid')));
                            }

                            const headerArticle = __('article_no');
                            const headerQty = __('quantity');
                            const headerDot = __('dot_code');
                            const firstRow = json[0];

                            if (!firstRow.hasOwnProperty(headerArticle) || !firstRow.hasOwnProperty(headerQty) || !firstRow.hasOwnProperty(headerDot)) {
                                return reject(new Error(`${__('file_must_contain_columns')}: ${headerArticle}, ${headerQty}, ${headerDot}`));
                            }

                            const items = json.map(row => ({
                                article_no: row[headerArticle]?.toString().trim(),
                                qty: parseInt(row[headerQty], 10),
                                dot: row[headerDot]?.toString().trim()
                            })).filter(item => item.article_no && !isNaN(item.qty) && item.qty > 0 && item.dot);

                            if (items.length === 0) {
                                reject(new Error(__('no_valid_items_found_in_file')));
                            } else {
                                resolve(items);
                            }
                        } catch (error) {
                            reject(new Error(`${__('error_processing_file')}: ${error.message}`));
                        }
                    };
                    reader.onerror = (error) => reject(new Error(`${__('error_reading_file')}: ${error}`));
                    reader.readAsArrayBuffer(file);
                }).catch(error => {
                    Swal.showValidationMessage(error.message);
                    return false;
                });
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const items = result.value;
                const response = await fetchData('api/inbound_api.php?action=addBulkExpectedItems', 'POST', { container_id: currentContainerId, items: items });
                if (response.success) {
                    let message = response.message;
                    if (response.errors && response.errors.length > 0) {
                        message += `<br><ul class="text-start mt-2">${response.errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
                    }
                    Swal.fire(__('import_complete'), message, 'info');
                    await loadContainerItems(currentContainerId, 'Expected');
                } else { showMessageBox(response.message, 'error'); }
            }
        });
    }

    // --- Reset and Utility Functions ---
    
    function resetContainerSelection() {
        currentContainerId = null;
        selectedContainerNumberEl.text(__('none'));
        containerList.html(`<div class="list-group-item">${__('loading_containers')}...</div>`);
        itemActionsContainer.addClass('d-none');
        itemActionsSeparator.addClass('d-none');
        arrivalActionContainer.addClass('d-none');
        verificationActionContainer.addClass('d-none');
        verificationSearchContainer.addClass('d-none');
        putawaySection.addClass('d-none');
        resetItemSelection();
    }

    function resetItemSelection() {
        selectedInboundItemId = null;
        containerItemsList.html(`<div class="list-group-item">${__('select_container_to_see_items')}</div>`);
        $('.list-group-item.putaway-candidate').removeClass('active');
    }
    
    // --- Helper functions ---
    async function loadSuppliersForDropdown() {
        const response = await fetchData('api/suppliers_api.php');
        if (response?.success && Array.isArray(response.data)) {
            supplierOptionsHtml = response.data.map(s => `<option value="${s.supplier_id}">${s.supplier_name}</option>`).join('');
        }
    }

    function populateDotCodeDropdown() {
        const now = new Date();
        const currentYearShort = parseInt(now.getFullYear().toString().slice(-2));
        const currentWeek = Math.ceil(( (now - new Date(now.getFullYear(), 0, 1)) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
        for (let y = currentYearShort; y >= currentYearShort - 4; y--) {
            for (let w = (y === currentYearShort ? currentWeek : 53); w >= 1; w--) {
                dotCodeOptions.push({ id: `${String(w).padStart(2, '0')}${String(y).padStart(2, '0')}`, text: `${__('week')} ${String(w).padStart(2, '0')} / 20${String(y).padStart(2, '0')}` });
            }
        }
    }

    async function populateAllProductsDropdown() {
        const response = await fetchData('api/inbound_api.php?action=getProductsWithInventory');
        if (response?.success && Array.isArray(response.data)) {
            allProductsData = response.data.map(p => ({ id: p.article_no, text: `${p.product_name} (SKU: ${p.sku} / Art: ${p.article_no})`, product: p }));
        }
    }

    async function loadAvailableLocations() {
        const response = await fetchData('api/inbound_api.php?action=getAvailableLocations');
        if (response?.success && Array.isArray(response.data)) {
            availableLocationsData = response.data; 
        }
    }
});
