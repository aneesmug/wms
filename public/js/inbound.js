// inbound.js
// MODIFICATION SUMMARY:
// 1. CRITICAL FIX: Added a new event listener for the '#statusFilter' dropdown.
// 2. This listener was missing, which is why the filter was not working.
// 3. It now correctly uses the DataTables API (`table.column(4).search(...)`) to filter the table based on the selected status.
// 4. The search is configured to be an exact match to prevent, for example, "Received" from matching "Partially Received".

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
    const statusFilter = $('#statusFilter'); // Added selector for the filter
    
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

    // --- FIX: Added Event Listener for Status Filter ---
    statusFilter.on('change', function() {
        if (table) {
            const selectedStatus = $(this).val();
            // Use regex for an exact match on the status column (index 4)
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
                title: 'No Warehouse Selected',
                text: 'Please select a warehouse to continue.',
                icon: 'error',
                confirmButtonText: 'Select Warehouse',
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
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'View-only permissions.', showConfirmButton: false, timer: 3000, timerProgressBar: true });
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
        
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Selected receipt: ${receiptNumber}`, showConfirmButton: false, timer: 2000 });
        
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
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Selected batch ${item.batch_number} for putaway.`, showConfirmButton: false, timer: 2500 });
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
                { data: 'supplier_name', defaultContent: 'N/A' }, 
                { data: 'actual_arrival_date', defaultContent: 'Pending Arrival' },
                { data: 'status', render: data => `<span class="badge bg-${{'Completed':'success', 'Received':'primary', 'Partially Putaway':'warning text-dark', 'Pending':'secondary', 'Cancelled':'danger'}[data] || 'light text-dark'}">${data}</span>`},
                { data: null, orderable: false, className: 'text-end', render: (data, type, row) => {
                    let btns = `<button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-secondary view-details-btn" title="View Details"><i class="bi bi-eye"></i></button>`;
                    if (row.status !== 'Completed' && row.status !== 'Cancelled' && canManageInbound) {
                        btns += ` <button data-receipt-id="${row.receipt_id}" data-receipt-number="${row.receipt_number}" class="btn btn-sm btn-primary select-receipt-btn ms-1" title="Select for Processing"><i class="bi bi-check-circle"></i></button>`;
                         if (row.status === 'Pending') {
                            btns += ` <button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-danger cancel-receipt-btn ms-1" title="Cancel Receipt"><i class="bi bi-x-circle"></i></button>`;
                        }
                    }
                    return btns;
                }}
            ],
            responsive: true,
            order: [[0, 'desc']],
        });
    }

    async function loadContainerData(receiptId) {
        const response = await fetchData(`api/inbound_api.php?receipt_id=${receiptId}`);
        containerList.empty();
        currentContainers = []; // Reset current container cache

        if (response?.success && Array.isArray(response.data.containers)) {
            currentContainers = response.data.containers; // Cache the data
            if (currentContainers.length > 0) {
                currentContainers.forEach(container => {
                    const statusMap = {'Completed':'success', 'Processing':'primary', 'Partially Putaway':'warning', 'Arrived':'info', 'Expected':'secondary'};
                    
                    const hasItems = container.items && container.items.length > 0;
                    
                    let actionButtons = '';
                    if (!hasItems) {
                        actionButtons = `
                            <button class="btn btn-sm btn-outline-primary edit-container-btn" title="Edit Container"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger delete-container-btn ms-1" title="Delete Container"><i class="bi bi-trash"></i></button>
                        `;
                    }

                    const itemHtml = $(`
                        <div class="list-group-item list-group-item-action" data-container-id="${container.container_id}">
                            <div class="d-flex w-100 justify-content-between">
                                <div>
                                    <h6 class="mb-1">Container: ${container.container_number}</h6>
                                    <p class="mb-1 small">Ref: ${container.reference_number || 'N/A'} | B/L: ${container.bl_number || 'N/A'}</p>
                                    <small>Status: <span class="badge bg-${statusMap[container.status] || 'light'}">${container.status}</span></small>
                                </div>
                                <div class="container-actions align-self-center">
                                    ${actionButtons}
                                </div>
                            </div>
                        </div>
                    `);
                    itemHtml.data('container', container);
                    containerList.append(itemHtml);
                });
            } else {
                containerList.html('<div class="list-group-item">No containers found for this receipt. Click "Add Container" to start.</div>');
            }
        } else {
            containerList.html('<div class="list-group-item text-danger">Could not load containers.</div>');
        }
    }
    
    async function loadPutawayCandidates(containerId) {
        putawayCandidatesList.html('<div class="list-group-item">Loading...</div>');
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
                                        <small>Batch: ${item.batch_number} | Qty: ${availableQty} | DOT: ${item.dot_code}</small>
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm btn-outline-primary edit-received-btn" title="Edit Item"><i class="bi bi-pencil"></i></button>
                                        <button class="btn btn-sm btn-outline-danger delete-received-btn ms-2" title="Delete Item"><i class="bi bi-trash"></i></button>
                                    </div>
                                </div>
                            </div>`);
                        itemHtml.data('item', item);
                        putawayCandidatesList.append(itemHtml);
                    });
                } else {
                    putawayCandidatesList.html('<div class="list-group-item">No items are awaiting putaway for this container.</div>');
                }
            }
        } else {
            putawayCandidatesList.html('<div class="list-group-item text-danger">Could not load items.</div>');
        }
    }

    // --- Form Handling and API Calls ---

    async function handleReceiveItem() {
        if (!currentReceiptId || !currentContainerId) {
            Swal.fire('Error!', 'Please select a receipt and a container first.', 'error'); return;
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
            Swal.fire('Error!', 'Product, Quantity, and DOT Code are required.', 'error'); return;
        }

        const result = await fetchData('api/inbound_api.php?action=receiveItem', 'POST', data);
        if (result?.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: result.message, showConfirmButton: false, timer: 3000 });
            resetItemSelection();
            await Promise.all([loadInboundReceipts(), loadContainerData(currentReceiptId)]);
            const containerData = $(`#containerList .list-group-item-action[data-container-id="${currentContainerId}"]`).data('container');
            if(containerData) selectContainer(containerData);
        } else {
            Swal.fire('Error!', result.message || 'Failed to receive item.', 'error');
        }
    }

    async function handlePutawayItem() {
        if (!currentReceiptId || !selectedInboundItemId) {
            Swal.fire('Error!', 'Please select an item from the "Ready for Putaway" list first.', 'error'); return;
        }
        const data = {
            receipt_id: currentReceiptId,
            inbound_item_id: selectedInboundItemId,
            location_article_no: scanLocationInput.val(),
            putaway_quantity: parseInt(itemQuantityInput.val(), 10),
        };
        if (!data.location_article_no) {
            Swal.fire('Error!', 'Location is required for putaway.', 'error'); return;
        }

        const result = await fetchData('api/inbound_api.php?action=putawayItem', 'POST', data);
        if (result?.success) {
            Swal.fire({
                icon: 'success',
                title: 'Putaway Successful!',
                text: result.message,
                showCancelButton: true,
                confirmButtonText: '<i class="bi bi-printer"></i> Print Stickers',
                cancelButtonText: 'Close',
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
            Swal.fire('Error!', result.message || 'Failed to put away item.', 'error');
        }
    }

    async function handleCancelReceipt(receiptId) {
        Swal.fire({
            title: 'Are you sure?',
            text: "This will cancel the entire receipt and all its containers. This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, cancel it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=cancelReceipt', 'POST', { receipt_id: receiptId });
                if (response.success) {
                    Swal.fire('Cancelled!', response.message, 'success');
                    if (currentReceiptId === receiptId) {
                        processingSection.addClass('d-none');
                        currentReceiptId = null;
                        selectedReceiptNumberEl.text('');
                    }
                    await loadInboundReceipts();
                } else {
                    Swal.fire('Error!', response.message, 'error');
                }
            }
        });
    }

    // --- Popups ---
    
    function showCreateReceiptPopup() {
        Swal.fire({
            title: 'Create New Receipt',
            html: `<form id="swal-form" class="text-start"><div class="col-12"><label for="swal-supplierSelect" class="form-label">Supplier</label><select id="swal-supplierSelect" class="form-select" required>${supplierOptionsHtml}</select></div></form>`,
            confirmButtonText: 'Create Receipt',
            showCancelButton: true,
            allowOutsideClick: false,
            didOpen: () => $('#swal-supplierSelect').select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-popup') }),
            preConfirm: () => {
                const supplierId = $('#swal-supplierSelect').val();
                if (!supplierId) { Swal.showValidationMessage(`Supplier is required.`); return false; }
                return { supplier_id: supplierId };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const createResult = await fetchData('api/inbound_api.php?action=createReceipt', 'POST', result.value);
                if (createResult?.success) {
                    Swal.fire('Success!', createResult.message, 'success');
                    await loadInboundReceipts();
                    selectReceipt(createResult.receipt_id, createResult.receipt_number);
                } else {
                    Swal.fire('Error!', createResult.message, 'error');
                }
            }
        });
    }

    function showAddContainerPopup() {
        if (!currentReceiptId) { Swal.fire("Error", "Please select a receipt first.", "error"); return; }
        
        const containerCount = currentContainers.length;
        let referenceHtml = '';
        if (containerCount === 0) {
            referenceHtml = `<div class="col-md-6"><label for="swal-referenceNumber" class="form-label">Reference No.</label><input type="text" id="swal-referenceNumber" class="form-control numeric-only" required></div>`;
        } else {
            const baseRef = currentContainers[0].reference_number.split('-')[0];
            const newRef = `${baseRef}-${containerCount}`;
            referenceHtml = `<div class="col-md-6"><label for="swal-referenceNumber" class="form-label">Reference No.</label><input type="text" id="swal-referenceNumber" class="form-control numeric-only" value="${newRef}" disabled></div>`;
        }

        Swal.fire({
            title: 'Add New Container',
            html: `
                <form id="swal-containerForm" class="row g-3 text-start needs-validation" novalidate>
                    <div class="col-md-6"><label for="swal-blNumber" class="form-label">B/L Number</label><input type="text" id="swal-blNumber" class="form-control"></div>
                    <div class="col-md-6"><label for="swal-containerNumber" class="form-label">Container No.</label><input type="text" id="swal-containerNumber" class="form-control" required></div>
                    <div class="col-md-6"><label for="swal-serialNumber" class="form-label">Serial No.</label><input type="text" id="swal-serialNumber" class="form-control"></div>
                    ${referenceHtml}
                    <div class="col-12"><label for="swal-expectedArrivalDate" class="form-label">Expected Arrival</label><input type="text" id="swal-expectedArrivalDate" class="form-control datepicker-input" required></div>
                </form>
            `,
            confirmButtonText: 'Add Container',
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
                if (!containerNumber || !expectedArrivalDate || !referenceNumber) { Swal.showValidationMessage(`Container No, Reference No, and Expected Arrival are required.`); return false; }
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
                    Swal.fire('Success!', addResult.message, 'success');
                    await loadContainerData(currentReceiptId);
                } else {
                    Swal.fire('Error!', addResult.message, 'error');
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
            Swal.fire('Error!', receiptResponse.message || 'Could not fetch receipt details.', 'error');
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
                            <td>${item.article_no || 'N/A'}</td>
                            <td>${item.product_name}</td>
                            <td>${item.batch_number}</td>
                            <td>${item.received_quantity} / ${item.putaway_quantity}</td>
                            <td></td>
                        </tr>`;

                        const itemPutaways = putawaysByItem[item.inbound_item_id] || [];
                        itemPutaways.forEach(putaway => {
                            itemsHtml += `<tr class="table-light">
                                <td colspan="3" class="text-end fst-italic py-1">↳ Putaway to <strong>${putaway.location_code}</strong></td>
                                <td class="py-1">${putaway.dot_code}</td>
                                <td class="py-1">${putaway.quantity}</td>
                                <td class="text-center py-1">
                                    <button class="btn btn-sm btn-outline-secondary reprint-btn" data-inventory-id="${putaway.inventory_id}" title="Reprint Stickers">
                                        <i class="bi bi-printer"></i>
                                    </button>
                                </td>
                            </tr>`;
                        });
                    });
                } else {
                    itemsHtml = '<tr><td colspan="6" class="text-center">No items received for this container.</td></tr>';
                }

                containersHtml += `<div class="mt-3">
                    <h6 class="bg-light p-2 rounded border">Container: ${container.container_number} <span class="fw-normal">(Ref: ${container.reference_number || 'N/A'})</span> - Status: ${container.status}</h6>
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>SKU</th><th>Article No</th><th>Product</th><th>Batch/DOT</th><th>Rcvd/Putaway Qty</th><th>Actions</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>`;
            });
        } else {
            containersHtml = '<p class="text-center mt-3">No containers are associated with this receipt.</p>';
        }

        const modalHtml = `<div class="text-start">
            <div class="mb-3 p-2 rounded bg-light border">
                <strong>Supplier:</strong> ${receipt.supplier_name || 'N/A'}<br>
                <strong>Status:</strong> ${receipt.status}<br>
                <strong>Arrived:</strong> ${receipt.actual_arrival_date || 'N/A'}
            </div>
            ${containersHtml}
        </div>`;

        Swal.fire({
            title: `Receipt Details: #${receipt.receipt_number}`,
            html: modalHtml,
            width: '90vw',
            confirmButtonText: 'Close',
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
            title: 'Edit Received Item',
            html: `
                <form id="swal-editForm" class="text-start">
                    <p><strong>Product:</strong> ${item.product_name}</p>
                    <div class="mb-3">
                        <label for="swal-quantity" class="form-label">Quantity</label>
                        <input type="number" id="swal-quantity" class="form-control" value="${item.received_quantity}" min="1">
                    </div>
                    <div class="mb-3">
                        <label for="swal-dot" class="form-label">DOT Code</label>
                        <select id="swal-dot" class="form-select">${dotOptionsHtml}</select>
                    </div>
                </form>
            `,
            confirmButtonText: 'Update',
            showCancelButton: true,
            didOpen: () => $('#swal-dot').select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-popup') }),
            preConfirm: () => {
                const quantity = $('#swal-quantity').val();
                const dot_code = $('#swal-dot').val();
                if (!quantity || quantity <= 0 || !dot_code) { Swal.showValidationMessage('Please enter a valid quantity and select a DOT code.'); return false; }
                return { inbound_item_id: item.inbound_item_id, quantity: parseInt(quantity, 10), dot_code: dot_code };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=updateReceivedItem', 'POST', result.value);
                if (response.success) {
                    Swal.fire('Success!', response.message, 'success');
                    await loadContainerData(currentReceiptId);
                    await loadPutawayCandidates(currentContainerId);
                } else {
                    Swal.fire('Error!', response.message, 'error');
                }
            }
        });
    }

    function handleDeleteReceivedItemClick(item) {
        Swal.fire({
            title: 'Are you sure?',
            text: `Delete received item: ${item.received_quantity} x ${item.product_name} (Batch: ${item.batch_number}). This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=deleteReceivedItem', 'POST', { inbound_item_id: item.inbound_item_id });
                if (response.success) {
                    Swal.fire('Deleted!', response.message, 'success');
                    await loadContainerData(currentReceiptId);
                    await loadPutawayCandidates(currentContainerId);
                } else {
                    Swal.fire('Error!', response.message, 'error');
                }
            }
        });
    }

    function handleEditContainerClick(container) {
        Swal.fire({
            title: 'Edit Container',
            html: `
                <form id="swal-containerForm" class="row g-3 text-start needs-validation" novalidate>
                    <div class="col-md-6"><label for="swal-blNumber" class="form-label">B/L Number</label><input type="text" id="swal-blNumber" class="form-control" value="${container.bl_number || ''}"></div>
                    <div class="col-md-6"><label for="swal-containerNumber" class="form-label">Container No.</label><input type="text" id="swal-containerNumber" class="form-control" value="${container.container_number}" required></div>
                    <div class="col-md-6"><label for="swal-serialNumber" class="form-label">Serial No.</label><input type="text" id="swal-serialNumber" class="form-control" value="${container.serial_number || ''}"></div>
                    <div class="col-md-6"><label for="swal-referenceNumber" class="form-label">Reference No.</label><input type="text" id="swal-referenceNumber" class="form-control" value="${container.reference_number || ''}" required></div>
                    <div class="col-12"><label for="swal-expectedArrivalDate" class="form-label">Expected Arrival</label><input type="text" id="swal-expectedArrivalDate" class="form-control datepicker-input" value="${container.expected_arrival_date}" required></div>
                </form>
            `,
            confirmButtonText: 'Update Container',
            showCancelButton: true,
            didOpen: () => {
                const dateElement = document.getElementById('swal-expectedArrivalDate');
                initializeDatepicker(dateElement, Swal.getPopup());
                if (container.expected_arrival_date) {
                    const dp = datepicker(dateElement, {});
                    dp.setDate(container.expected_arrival_date);
                }
            },
            preConfirm: () => {
                const containerNumber = $('#swal-containerNumber').val().trim();
                const expectedArrivalDate = $('#swal-expectedArrivalDate').val();
                const referenceNumber = $('#swal-referenceNumber').val().trim();
                if (!containerNumber || !expectedArrivalDate || !referenceNumber) { Swal.showValidationMessage(`Container No, Reference No, and Expected Arrival are required.`); return false; }
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
                    Swal.fire('Success!', updateResult.message, 'success');
                    await loadContainerData(currentReceiptId);
                } else {
                    Swal.fire('Error!', updateResult.message, 'error');
                }
            }
        });
    }

    function handleDeleteContainerClick(container) {
        Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete Container #${container.container_number}. This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=deleteContainer', 'POST', { container_id: container.container_id });
                if (response.success) {
                    Swal.fire('Deleted!', response.message, 'success');
                    if(currentContainerId === container.container_id) {
                        resetContainerSelection();
                    }
                    await loadContainerData(currentReceiptId);
                } else {
                    Swal.fire('Error!', response.message, 'error');
                }
            }
        });
    }

    // --- Reset and Utility Functions ---
    
    function resetContainerSelection() {
        currentContainerId = null;
        selectedContainerNumberEl.text('None');
        containerList.html('<div class="list-group-item">Loading containers...</div>');
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
        
        putawayCandidatesList.html('<div class="list-group-item">Select a container to see items.</div>');
        $('.list-group-item.putaway-candidate').removeClass('active');
    }
    
    // --- Helper functions ---
    async function loadSuppliersForDropdown() {
        const response = await fetchData('api/suppliers_api.php');
        let options = '<option value="">Select Supplier</option>';
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
                dotCodeOptions.push({ id: `${String(w).padStart(2, '0')}${String(y).padStart(2, '0')}`, text: `Week ${String(w).padStart(2, '0')} / 20${String(y).padStart(2, '0')}` });
            }
        }
        inboundDotCodeSelect.select2({ placeholder: 'Select a DOT code...', theme: "bootstrap-5", data: dotCodeOptions }).val(null).trigger('change');
    }

    async function populateAllProductsDropdown() {
        productSelect.select2({ placeholder: 'Search for a product...', theme: "bootstrap-5", templateResult: formatProductOption, templateSelection: formatProductSelection }).prop('disabled', true);
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
                placeholder: 'Search by Name, SKU, or Article No.', 
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
            productNameHtml += ' <span class="badge bg-danger">Inactive</span>';
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
        scanLocationInput.html('<option value="">Select a destination</option>');
        if (response?.success && Array.isArray(response.data)) {
            availableLocationsData = response.data; 
            availableLocationsData.forEach(location => {
                const option = new Option(location.location_code, location.location_code);
                scanLocationInput.append(option);
            });
        }
        scanLocationInput.select2({ placeholder: 'Select a destination location', allowClear: true, theme: "bootstrap-5", templateResult: formatLocationOption }).val(null).trigger('change');
    }

    function formatLocationOption(option) {
        if (!option.id) return option.text;
        const locationData = availableLocationsData.find(loc => loc.location_code === option.id);
        if (!locationData) return option.text;
        
        if (!locationData.max_capacity_units || parseInt(locationData.max_capacity_units, 10) <= 0) {
            return $(`
                <div class="d-flex justify-content-between">
                    <span>${option.text}</span>
                    <span class="badge bg-secondary">Capacity Not Set</span>
                </div>
            `);
        }
        
        const availableCapacity = parseInt(locationData.max_capacity_units, 10) - parseInt(locationData.current_usage, 10);
        const quantityToPutaway = parseInt(itemQuantityInput.val(), 10) || 0;

        const badgeClass = (quantityToPutaway <= availableCapacity) ? 'bg-success' : 'bg-danger';
        const badgeText = `Avail: ${availableCapacity}`;

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
                 placeholder: 'Select a destination location',
                 allowClear: true,
                 theme: "bootstrap-5",
                 templateResult: formatLocationOption
            });
        }
    }
});
