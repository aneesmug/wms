// public/js/inbound.js

$(document).ready(function() {
    // --- DOM Elements ---
    const processingSection = $('#processingSection');
    const productSelect = $('#scanarticle_noInput');
    const itemQuantityInput = $('#itemQuantity');
    const unitCostInput = $('#unitCost');
    const inboundDotCodeSelect = $('#inboundDotCode');
    const scanLocationInput = $('#scanLocationInput');
    const receiveItemBtn = $('#receiveItemBtn');
    const putawayItemBtn = $('#putawayItemBtn');
    const addContainerBtn = $('#addContainerBtn');
    const statusFilter = $('#statusFilter');
    
    const selectedReceiptNumberEl = $('#selectedReceiptNumber');
    const selectedContainerNumberEl = $('#selectedContainerNumber');

    const containerList = $('#containerList');
    const putawayCandidatesList = $('#putawayCandidatesList');
    const inboundReceiptsTable = $('#inboundReceiptsTable');
    const showCreateReceiptBtn = $('#showCreateReceiptBtn');
    
    const itemFormFields = $('#itemFormFields');
    const putawayFormFields = $('#putawayFormFields');

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

    // --- Initialize Page & Event Listeners ---
    initializePage();

    showCreateReceiptBtn.on('click', showCreateReceiptPopup);
    addContainerBtn.on('click', showAddContainerPopup);
    receiveItemBtn.on('click', handleReceiveItem);
    putawayItemBtn.on('click', handlePutawayItem);
    itemQuantityInput.on('input', updateLocationDropdownAvailability);

    statusFilter.on('change', function() {
        if (table) {
            const selectedStatus = $(this).val();
            table.column(4).search(selectedStatus ? '^' + selectedStatus + '$' : '', true, false).draw();
        }
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

    putawayCandidatesList.on('click', '.item-details', function() {
        selectPutawayCandidate($(this).closest('.list-group-item').data('item'));
    });
    putawayCandidatesList.on('click', '.edit-received-btn', function() {
        handleEditReceivedItemClick($(this).closest('.list-group-item').data('item'));
    });
    putawayCandidatesList.on('click', '.delete-received-btn', function() {
        handleDeleteReceivedItemClick($(this).closest('.list-group-item').data('item'));
    });

    // --- Core Functions ---

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
        itemFormFields.prop('disabled', false);
        
        resetItemSelection();
        loadPutawayCandidates(currentContainerId);
    }

    function selectPutawayCandidate(item) {
        selectedInboundItemId = item.inbound_item_id;
        const availableQty = (parseInt(item.received_quantity) || 0) - (parseInt(item.putaway_quantity) || 0);
        
        $('.list-group-item.putaway-candidate').removeClass('active');
        $(`.list-group-item.putaway-candidate[data-item-id="${selectedInboundItemId}"]`).addClass('active');

        itemQuantityInput.val(availableQty)
                         .prop('disabled', false)
                         .attr('max', availableQty);

        productSelect.val(item.article_no).trigger('change').prop('disabled', true);
        inboundDotCodeSelect.val(item.dot_code).trigger('change').prop('disabled', true);
        unitCostInput.val(item.unit_cost || '').prop('disabled', true);
        
        receiveItemBtn.prop('disabled', true);
        putawayFormFields.prop('disabled', false);
        updateLocationDropdownAvailability();
        showMessageBox(`${__('selected_batch')} ${item.batch_number} ${__('for_putaway')}.`, 'info');
    }

    // --- Data Loading and Rendering ---

    async function loadInboundReceipts() {
        const response = await fetchData('api/inbound_api.php');
        const canManageInbound = ['operator', 'manager'].includes(currentWarehouseRole);
        
        if ($.fn.DataTable.isDataTable('#inboundReceiptsTable')) table.destroy();

        table = inboundReceiptsTable.DataTable({
            data: response.success ? response.data : [],
            columns: [
                { data: 'receipt_id', visible: false }, 
                { data: 'receipt_number' }, 
                { data: 'supplier_name', defaultContent: __('n_a') }, 
                { data: 'actual_arrival_date', defaultContent: __('pending_arrival') },
                { data: 'status', render: data => {
                    const statusKey = data.toLowerCase().replace(/\s+/g, '_');
                    const statusClassMap = {
                        'completed': 'success',
                        'received': 'primary',
                        'partially_putaway': 'warning text-dark',
                        'pending': 'secondary',
                        'cancelled': 'danger',
                        'partially_received': 'info'
                    };
                    return `<span class="badge bg-${statusClassMap[statusKey] || 'light text-dark'}">${__(statusKey, data)}</span>`;
                }},
                { data: null, orderable: false, className: 'text-end', render: (data, type, row) => {
                    let btns = `<button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-secondary view-details-btn" title="${__('view_details')}"><i class="bi bi-eye"></i></button>`;
                    if (row.status !== 'Completed' && row.status !== 'Cancelled' && canManageInbound) {
                        btns += ` <button data-receipt-id="${row.receipt_id}" data-receipt-number="${row.receipt_number}" class="btn btn-sm btn-primary select-receipt-btn ms-1" title="${__('select_for_processing')}"><i class="bi bi-check-circle"></i></button>`;
                         if (row.status === 'Pending') {
                            btns += ` <button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-danger cancel-receipt-btn ms-1" title="${__('cancel_receipt')}"><i class="bi bi-x-circle"></i></button>`;
                        }
                    }
                    return btns;
                }}
            ],
            responsive: true,
            order: [[0, 'desc']],
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
                    const hasItems = container.items && container.items.length > 0;
                    let actionButtons = '';
                    if (!hasItems) {
                        actionButtons = `
                            <button class="btn btn-sm btn-outline-warning edit-container-btn" title="${__('edit_container')}"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger delete-container-btn ms-1" title="${__('delete_container')}"><i class="bi bi-trash"></i></button>
                        `;
                    }
                    const itemHtml = $(`
                        <div class="list-group-item list-group-item-action" data-container-id="${container.container_id}">
                            <div class="d-flex w-100 justify-content-between">
                                <div>
                                    <h6 class="mb-1">${__('container')}: ${container.container_number}</h6>
                                    <p class="mb-1 small">${__('reference_no')}: ${container.reference_number || __('n_a')} | B/L: ${container.bl_number || __('n_a')}</p>
                                    <small>${__('status')}: <span class="badge bg-${statusClassMap[statusKey] || 'light'}">${__(statusKey, container.status)}</span></small>
                                </div>
                                <div class="container-actions align-self-center">${actionButtons}</div>
                            </div>
                        </div>
                    `);
                    itemHtml.data('container', container);
                    containerList.append(itemHtml);
                });
            } else {
                containerList.html(`<div class="list-group-item">${__('no_containers_found')}</div>`);
            }
        } else {
            containerList.html(`<div class="list-group-item text-danger">${__('could_not_load_containers')}</div>`);
        }
    }
    
    async function loadPutawayCandidates(containerId) {
        putawayCandidatesList.html(`<div class="list-group-item">${__('loading')}...</div>`);
        const response = await fetchData(`api/inbound_api.php?receipt_id=${currentReceiptId}`);
        putawayCandidatesList.empty();

        if (response?.success) {
            const container = response.data.containers.find(c => c.container_id == containerId);
            if (container && Array.isArray(container.items)) {
                const candidates = container.items.filter(item => (parseInt(item.received_quantity) || 0) > (parseInt(item.putaway_quantity) || 0));
                if (candidates.length > 0) {
                    candidates.forEach(item => {
                        const availableQty = (parseInt(item.received_quantity) || 0) - (parseInt(item.putaway_quantity) || 0);
                        const itemHtml = $(`
                            <div class="list-group-item putaway-candidate" data-item-id="${item.inbound_item_id}">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="item-details" style="cursor: pointer;">
                                        <strong>${item.product_name}</strong> (${item.sku})<br>
                                        <small>${__('batch')}: ${item.batch_number} | ${__('qty')}: ${availableQty} | ${__('dot')}: ${item.dot_code}</small>
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm btn-outline-primary edit-received-btn" title="${__('edit_item')}"><i class="bi bi-pencil"></i></button>
                                        <button class="btn btn-sm btn-outline-danger delete-received-btn ms-2" title="${__('delete_item')}"><i class="bi bi-trash"></i></button>
                                    </div>
                                </div>
                            </div>`);
                        itemHtml.data('item', item);
                        putawayCandidatesList.append(itemHtml);
                    });
                } else {
                    putawayCandidatesList.html(`<div class="list-group-item">${__('no_items_awaiting_putaway')}</div>`);
                }
            }
        } else {
            putawayCandidatesList.html(`<div class="list-group-item text-danger">${__('could_not_load_items')}</div>`);
        }
    }

    // --- Form Handling and API Calls ---

    async function handleReceiveItem() {
        if (!currentReceiptId || !currentContainerId) {
            showMessageBox(__('select_receipt_and_container_first'), 'error'); return;
        }
        const data = {
            receipt_id: currentReceiptId, 
            container_id: currentContainerId,
            article_no: productSelect.val(), 
            received_quantity: parseInt(itemQuantityInput.val(), 10),
            unit_cost: parseFloat(unitCostInput.val()) || null,
            dot_code: inboundDotCodeSelect.val()
        };
        if (!data.article_no || !data.dot_code || isNaN(data.received_quantity) || data.received_quantity <= 0) {
            showMessageBox(__('product_qty_dot_required'), 'error'); return;
        }

        const result = await fetchData('api/inbound_api.php?action=receiveItem', 'POST', data);
        if (result?.success) {
            showMessageBox(result.message, 'success');
            resetItemSelection();
            await Promise.all([loadInboundReceipts(), loadContainerData(currentReceiptId)]);
            const containerData = $(`#containerList .list-group-item-action[data-container-id="${currentContainerId}"]`).data('container');
            if(containerData) selectContainer(containerData);
        } else {
            showMessageBox(result.message || __('failed_to_receive_item'), 'error');
        }
    }

    async function handlePutawayItem() {
        if (!currentReceiptId || !selectedInboundItemId) {
            showMessageBox(__('select_item_for_putaway_first'), 'error'); return;
        }
        const data = {
            receipt_id: currentReceiptId,
            inbound_item_id: selectedInboundItemId,
            location_article_no: scanLocationInput.val(),
            putaway_quantity: parseInt(itemQuantityInput.val(), 10),
        };
        if (!data.location_article_no) {
            showMessageBox(__('location_required_for_putaway'), 'error'); return;
        }

        const result = await fetchData('api/inbound_api.php?action=putawayItem', 'POST', data);
        if (result?.success) {
            Swal.fire({
                icon: 'success',
                title: __('putaway_successful'),
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
            });

            resetItemSelection();
            await Promise.all([loadInboundReceipts(), loadContainerData(currentReceiptId), loadAvailableLocations()]);
            const containerData = $(`#containerList .list-group-item-action[data-container-id="${currentContainerId}"]`).data('container');
            if(containerData) selectContainer(containerData);
        } else {
            showMessageBox(result.message || __('failed_to_putaway_item'), 'error');
        }
    }

    async function handleCancelReceipt(receiptId) {
        showConfirmationModal(
            __('are_you_sure'),
            __('cancel_receipt_warn'),
            async () => {
                const response = await fetchData('api/inbound_api.php?action=cancelReceipt', 'POST', { receipt_id: receiptId });
                if (response.success) {
                    showMessageBox(response.message, 'success');
                    if (currentReceiptId === receiptId) {
                        processingSection.addClass('d-none');
                        currentReceiptId = null;
                        selectedReceiptNumberEl.text('');
                    }
                    await loadInboundReceipts();
                } else {
                    showMessageBox(response.message, 'error');
                }
            },
            { confirmButtonText: __('yes_cancel_it') }
        );
    }

    // --- Popups ---
    
    function showCreateReceiptPopup() {
        Swal.fire({
            title: __('create_new_receipt'),
            html: `<form id="swal-form" class="text-start"><div class="col-12"><label for="swal-supplierSelect" class="form-label">${__('supplier')}</label><select id="swal-supplierSelect" class="form-select" required>${supplierOptionsHtml}</select></div></form>`,
            confirmButtonText: __('create_receipt'),
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
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
                } else {
                    showMessageBox(createResult.message, 'error');
                }
            }
        });
    }

    function showAddContainerPopup() {
        if (!currentReceiptId) { showMessageBox(__("select_receipt_first"), "error"); return; }
        
        const containerCount = currentContainers.length;
        let referenceHtml = '';
        if (containerCount === 0) {
            referenceHtml = `<div class="col-md-6"><label for="swal-referenceNumber" class="form-label">${__('reference_no')}</label><input type="text" id="swal-referenceNumber" class="form-control numeric-only" required></div>`;
        } else {
            const baseRef = currentContainers[0].reference_number.split('-')[0];
            const newRef = `${baseRef}-${containerCount + 1}`;
            referenceHtml = `<div class="col-md-6"><label for="swal-referenceNumber" class="form-label">${__('reference_no')}</label><input type="text" id="swal-referenceNumber" class="form-control numeric-only" value="${newRef}" disabled></div>`;
        }

        Swal.fire({
            title: __('add_new_container'),
            html: `
                <form id="swal-containerForm" class="row g-3 text-start needs-validation" novalidate>
                    <div class="col-md-6"><label for="swal-blNumber" class="form-label">${__('bl_number')}</label><input type="text" id="swal-blNumber" class="form-control"></div>
                    <div class="col-md-6"><label for="swal-containerNumber" class="form-label">${__('container_no')}</label><input type="text" id="swal-containerNumber" class="form-control" required></div>
                    <div class="col-md-6"><label for="swal-serialNumber" class="form-label">${__('serial_no')}</label><input type="text" id="swal-serialNumber" class="form-control"></div>
                    ${referenceHtml}
                    <div class="col-12"><label for="swal-expectedArrivalDate" class="form-label">${__('expected_arrival')}</label><input type="text" id="swal-expectedArrivalDate" class="form-control datepicker-input" required></div>
                </form>
            `,
            confirmButtonText: __('add_container'),
            showCancelButton: true,
            allowOutsideClick: false,
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
                return { 
                    receipt_id: currentReceiptId,
                    bl_number: $('#swal-blNumber').val().trim(),
                    container_number: containerNumber,
                    serial_number: $('#swal-serialNumber').val().trim(),
                    reference_number: referenceNumber,
                    expected_arrival_date: expectedArrivalDate
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const addResult = await fetchData('api/inbound_api.php?action=addContainer', 'POST', result.value);
                if (addResult?.success) {
                    showMessageBox(addResult.message, 'success');
                    await loadContainerData(currentReceiptId);
                } else {
                    showMessageBox(addResult.message, 'error');
                }
            }
        });
    }

    async function handleViewDetails(receiptId) {
        const [receiptResponse, historyResponse] = await Promise.all([
            fetchData(`api/inbound_api.php?receipt_id=${receiptId}`),
            fetchData(`api/inbound_api.php?action=getPutawayHistory&receipt_id=${receiptId}`)
        ]);

        if (!receiptResponse.success) {
            showMessageBox(receiptResponse.message || __('could_not_fetch_receipt_details'), 'error');
            return;
        }

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
                        itemsHtml += `<tr class="fw-bold table-primary">
                            <td>${item.sku}</td>
                            <td>${item.article_no || __('n_a')}</td>
                            <td>${item.product_name}</td>
                            <td>${item.batch_number}</td>
                            <td>${item.received_quantity} / ${item.putaway_quantity}</td>
                            <td></td>
                        </tr>`;

                        const itemPutaways = putawaysByItem[item.inbound_item_id] || [];
                        itemPutaways.forEach(putaway => {
                            itemsHtml += `<tr class="table-light">
                                <td colspan="3" class="text-end fst-italic py-1">↳ ${__('putaway_to')} <strong>${putaway.location_code}</strong></td>
                                <td class="py-1">${putaway.dot_code}</td>
                                <td class="py-1">${putaway.quantity}</td>
                                <td class="text-center py-1">
                                    <button class="btn btn-sm btn-outline-secondary reprint-btn" data-inventory-id="${putaway.inventory_id}" title="${__('reprint_stickers')}">
                                        <i class="bi bi-printer"></i>
                                    </button>
                                </td>
                            </tr>`;
                        });
                    });
                } else {
                    itemsHtml = `<tr><td colspan="6" class="text-center">${__('no_items_received_for_container')}</td></tr>`;
                }

                containersHtml += `<div class="mt-3">
                    <h6 class="bg-light p-2 rounded border">${__('container')}: ${container.container_number} <span class="fw-normal">(${__('reference_no')}: ${container.reference_number || __('n_a')})</span> - ${__('status')}: ${__(container.status.toLowerCase().replace(' ','_'), container.status)}</h6>
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>${__('sku')}</th><th>${__('article_no')}</th><th>${__('product')}</th><th>${__('batch_dot')}</th><th>${__('rcvd_putaway_qty')}</th><th>${__('actions')}</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>`;
            });
        } else {
            containersHtml = `<p class="text-center mt-3">${__('no_containers_associated')}</p>`;
        }

        const modalHtml = `<div class="text-start">
            <div class="mb-3 p-2 rounded bg-light border">
                <strong>${__('supplier')}:</strong> ${receipt.supplier_name || __('n_a')}<br>
                <strong>${__('status')}:</strong> ${__(receipt.status.toLowerCase().replace(' ','_'), receipt.status)}<br>
                <strong>${__('arrived')}:</strong> ${receipt.actual_arrival_date || __('n_a')}
            </div>
            ${containersHtml}
        </div>`;

        Swal.fire({
            title: `${__('receipt_details')}: #${receipt.receipt_number}`,
            html: modalHtml,
            width: '90vw',
            confirmButtonText: __('close'),
            allowOutsideClick: false,
            didOpen: () => {
                $('.swal2-container').on('click', '.reprint-btn', function() {
                    const inventoryId = $(this).data('inventory-id');
                    $('#print-frame').remove();
                    $('<iframe>', {
                        id: 'print-frame',
                        src: `print_label.php?inventory_id=${inventoryId}`,
                        style: 'display:none;'
                    }).appendTo('body');
                });
            }
        });
    }

    function handleEditReceivedItemClick(item) {
        const dotOptionsHtml = dotCodeOptions.map(opt => `<option value="${opt.id}" ${item.dot_code === opt.id ? 'selected' : ''}>${opt.text}</option>`).join('');
        Swal.fire({
            title: __('edit_received_item'),
            html: `
                <form id="swal-editForm" class="text-start">
                    <p><strong>${__('product')}:</strong> ${item.product_name}</p>
                    <div class="mb-3">
                        <label for="swal-quantity" class="form-label">${__('quantity')}</label>
                        <input type="number" id="swal-quantity" class="form-control" value="${item.received_quantity}" min="1">
                    </div>
                    <div class="mb-3">
                        <label for="swal-dot" class="form-label">${__('dot_code')}</label>
                        <select id="swal-dot" class="form-select">${dotOptionsHtml}</select>
                    </div>
                </form>
            `,
            confirmButtonText: __('update'),
            showCancelButton: true,
            didOpen: () => $('#swal-dot').select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-popup') }),
            preConfirm: () => {
                const quantity = $('#swal-quantity').val();
                const dot_code = $('#swal-dot').val();
                if (!quantity || quantity <= 0 || !dot_code) { Swal.showValidationMessage(__('enter_valid_qty_dot')); return false; }
                return { inbound_item_id: item.inbound_item_id, quantity: parseInt(quantity, 10), dot_code: dot_code };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=updateReceivedItem', 'POST', result.value);
                if (response.success) {
                    showMessageBox(response.message, 'success');
                    await loadContainerData(currentReceiptId);
                    await loadPutawayCandidates(currentContainerId);
                } else {
                    showMessageBox(response.message, 'error');
                }
            }
        });
    }

    function handleDeleteReceivedItemClick(item) {
        const confirmationText = `${__('delete_received_item_confirm')} ${item.received_quantity} x ${item.product_name} (${__('batch')}: ${item.batch_number}). ${__('action_cannot_be_undone')}`;
        showConfirmationModal(
            __('are_you_sure'),
            confirmationText,
            async () => {
                const response = await fetchData('api/inbound_api.php?action=deleteReceivedItem', 'POST', { inbound_item_id: item.inbound_item_id });
                if (response.success) {
                    showMessageBox(response.message, 'success');
                    await loadContainerData(currentReceiptId);
                    await loadPutawayCandidates(currentContainerId);
                } else {
                    showMessageBox(response.message, 'error');
                }
            },
            { confirmButtonText: __('yes_delete_it') }
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
            confirmButtonText: __('update_container'),
            showCancelButton: true,
            allowOutsideClick: false,
            cancelButtonText: __('cancel'),
            didOpen: () => {
                const dateElement = document.getElementById('swal-expectedArrivalDate');
                initializeDatepicker(dateElement, Swal.getPopup());
            },
            preConfirm: () => {
                const containerNumber = $('#swal-containerNumber').val().trim();
                const expectedArrivalDate = $('#swal-expectedArrivalDate').val();
                const referenceNumber = $('#swal-referenceNumber').val().trim();
                if (!containerNumber || !expectedArrivalDate || !referenceNumber) { Swal.showValidationMessage(`${__('container_no')}, ${__('reference_no')}, ${__('and')} ${__('expected_arrival')} ${__('are_required')}.`); return false; }
                return { 
                    container_id: container.container_id,
                    bl_number: $('#swal-blNumber').val().trim(),
                    container_number: containerNumber,
                    serial_number: $('#swal-serialNumber').val().trim(),
                    reference_number: referenceNumber,
                    expected_arrival_date: expectedArrivalDate
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const updateResult = await fetchData('api/inbound_api.php?action=updateContainer', 'POST', result.value);
                if (updateResult?.success) {
                    showMessageBox(updateResult.message, 'success');
                    await loadContainerData(currentReceiptId);
                } else {
                    showMessageBox(updateResult.message, 'error');
                }
            }
        });
    }

    function handleDeleteContainerClick(container) {
        const confirmationText = `${__('delete_container_confirm')} #${container.container_number}. ${__('action_cannot_be_undone')}`;
        showConfirmationModal(
            __('are_you_sure'),
            confirmationText,
            async () => {
                const response = await fetchData('api/inbound_api.php?action=deleteContainer', 'POST', { container_id: container.container_id });
                if (response.success) {
                    showMessageBox(response.message, 'success');
                    if(currentContainerId === container.container_id) {
                        resetContainerSelection();
                    }
                    await loadContainerData(currentReceiptId);
                } else {
                    showMessageBox(response.message, 'error');
                }
            },
            { confirmButtonText: __('yes_delete_it') }
        );
    }

    // --- Reset and Utility Functions ---
    
    function resetContainerSelection() {
        currentContainerId = null;
        selectedContainerNumberEl.text(__('none'));
        containerList.html(`<div class="list-group-item">${__('loading_containers')}...</div>`);
        itemFormFields.prop('disabled', true);
        resetItemSelection();
    }

    function resetItemSelection() {
        selectedInboundItemId = null;
        productSelect.val(null).trigger('change').prop('disabled', false);
        itemQuantityInput.val('1').prop('disabled', false).removeAttr('max');
        unitCostInput.val('').prop('disabled', false);
        inboundDotCodeSelect.val(null).trigger('change').prop('disabled', false);
        scanLocationInput.val(null).trigger('change');
        
        receiveItemBtn.prop('disabled', false);
        putawayFormFields.prop('disabled', true);
        
        putawayCandidatesList.html(`<div class="list-group-item">${__('select_container_to_see_items')}</div>`);
        $('.list-group-item.putaway-candidate').removeClass('active');
    }
    
    // --- Helper functions ---
    async function loadSuppliersForDropdown() {
        const response = await fetchData('api/suppliers_api.php');
        let options = `<option value="">${__('select_supplier')}</option>`;
        if (response?.success && Array.isArray(response.data)) {
            response.data.forEach(supplier => {
                options += `<option value="${supplier.supplier_id}">${supplier.supplier_name}</option>`;
            });
        }
        supplierOptionsHtml = options;
    }

    function populateDotCodeDropdown() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentYearShort = parseInt(currentYear.toString().slice(-2));
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        const currentWeek = Math.ceil((startOfYear.getDay() + 1 + days) / 7);

        for (let y = currentYearShort; y >= currentYearShort - 4; y--) {
            const weeksInYear = (y === currentYearShort) ? currentWeek : 53;
            for (let w = weeksInYear; w >= 1; w--) {
                dotCodeOptions.push({ id: `${String(w).padStart(2, '0')}${String(y).padStart(2, '0')}`, text: `${__('week')} ${String(w).padStart(2, '0')} / 20${String(y).padStart(2, '0')}` });
            }
        }
        inboundDotCodeSelect.select2({ placeholder: __('select_dot_code'), theme: "bootstrap-5", data: dotCodeOptions }).val(null).trigger('change');
    }

    async function populateAllProductsDropdown() {
        productSelect.select2({ placeholder: __('search_for_product'), theme: "bootstrap-5", templateResult: formatProductOption, templateSelection: formatProductSelection }).prop('disabled', true);
        const response = await fetchData('api/inbound_api.php?action=getProductsWithInventory');
        productSelect.empty().append(new Option('', ''));
        if (response?.success && Array.isArray(response.data)) {
            const productData = response.data.map(product => ({ 
                id: product.article_no, 
                text: `${product.product_name} (SKU: ${product.sku} / Art: ${product.article_no})`, 
                disabled: product.is_active != 1, 
                product: product 
            }));
            productSelect.select2({ 
                placeholder: __('search_by_name_sku_article'), 
                theme: "bootstrap-5", 
                data: productData, 
                templateResult: formatProductOption, 
                templateSelection: formatProductSelection 
            }).prop('disabled', false);
            productSelect.val(null).trigger('change');
        }
    }

    function formatProductOption(state) {
        if (!state.id) { return state.text; }
        const product = state.product;

        let productNameHtml = `${product.product_name} (${product.sku})`;
        if (product.is_active != 1) {
            productNameHtml += ` <span class="badge bg-danger">${__('inactive')}</span>`;
        }

        const articleNoHtml = `<span class="badge bg-success">Art. ${product.article_no}</span>`;

        return $(`
            <div class="d-flex justify-content-between align-items-center w-100">
                <span>${productNameHtml}</span>
                ${articleNoHtml}
            </div>
        `);
    }

    function formatProductSelection(state) {
        if (!state.id || !state.product) return state.text;
        return `${state.product.product_name} (Art: ${state.product.article_no})`;
    }

    async function loadAvailableLocations() {
        if (!scanLocationInput.length) return;
        const response = await fetchData('api/inbound_api.php?action=getAvailableLocations');
        availableLocationsData = [];
        scanLocationInput.html(`<option value="">${__('select_a_destination')}</option>`);
        if (response?.success && Array.isArray(response.data)) {
            availableLocationsData = response.data; 
            availableLocationsData.forEach(location => {
                const option = new Option(location.location_code, location.location_code);
                scanLocationInput.append(option);
            });
        }
        scanLocationInput.select2({ placeholder: __('select_destination_location'), allowClear: true, theme: "bootstrap-5", templateResult: formatLocationOption }).val(null).trigger('change');
    }

    function formatLocationOption(option) {
        if (!option.id) return option.text;
        const locationData = availableLocationsData.find(loc => loc.location_code === option.id);
        if (!locationData) return option.text;
        
        if (!locationData.max_capacity_units || parseInt(locationData.max_capacity_units, 10) <= 0) {
            return $(`
                <div class="d-flex justify-content-between">
                    <span>${option.text}</span>
                    <span class="badge bg-secondary">${__('capacity_not_set')}</span>
                </div>
            `);
        }
        
        const availableCapacity = parseInt(locationData.max_capacity_units, 10) - parseInt(locationData.current_usage, 10);
        const quantityToPutaway = parseInt(itemQuantityInput.val(), 10) || 0;

        const badgeClass = (quantityToPutaway <= availableCapacity) ? 'bg-success' : 'bg-danger';
        const badgeText = `${__('avail')}: ${availableCapacity}`;

        return $(`
            <div class="d-flex justify-content-between">
                <span>${option.text}</span>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
        `);
    }

    function updateLocationDropdownAvailability() {
        const quantity = parseInt(itemQuantityInput.val(), 10);
        if (isNaN(quantity) || quantity <= 0) return;
        $('#scanLocationInput option').each(function() {
            const option = $(this);
            const locationCode = option.val();
            if (!locationCode) return;
            const locationData = availableLocationsData.find(loc => loc.location_code === locationCode);
            if (locationData) {
                if (!locationData.max_capacity_units || parseInt(locationData.max_capacity_units, 10) <= 0) {
                    option.prop('disabled', true);
                } else {
                    const availableCapacity = parseInt(locationData.max_capacity_units, 10) - parseInt(locationData.current_usage, 10);
                    option.prop('disabled', quantity > availableCapacity);
                }
            }
        });
        if ($('#scanLocationInput').find('option:selected').is(':disabled')) {
            $('#scanLocationInput').val(null).trigger('change');
        }
        if (scanLocationInput.data('select2')) {
            scanLocationInput.select2('destroy').select2({
                 placeholder: __('select_destination_location'),
                 allowClear: true,
                 theme: "bootstrap-5",
                 templateResult: formatLocationOption
            });
        }
    }
});
