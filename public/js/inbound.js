$(document).ready(function() {
    // --- DOM Elements ---
    const processingSection = $('#processingSection');
    const productSelect = $('#scanBarcodeInput');
    const itemQuantityInput = $('#itemQuantity');
    const unitCostInput = $('#unitCost');
    const inboundBatchNumberInput = $('#inboundBatchNumber');
    const inboundDotCodeSelect = $('#inboundDotCode');
    const scanLocationInput = $('#scanLocationInput');
    const receiveItemBtn = $('#receiveItemBtn');
    const putawayItemBtn = $('#putawayItemBtn');
    const selectedReceiptDisplay = $('#selectedReceiptDisplay');
    const putawayCandidatesList = $('#putawayCandidatesList');
    const inboundReceiptsTable = $('#inboundReceiptsTable');
    const showCreateReceiptBtn = $('#showCreateReceiptBtn');

    // --- State Variables ---
    let currentReceiptId = null;
    let selectedInboundItemId = null;
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    let supplierOptionsHtml = '';
    let availableLocationsData = [];
    let table;
    let dotCodeOptions = []; // Store generated DOT options

    // --- Initialize Page & Event Listeners ---
    initializePage();

    if (showCreateReceiptBtn) showCreateReceiptBtn.on('click', showCreateReceiptPopup);
    if (receiveItemBtn) receiveItemBtn.on('click', handleReceiveItem);
    if (putawayItemBtn) putawayItemBtn.on('click', handlePutawayItem);
    if (itemQuantityInput) itemQuantityInput.on('input', updateLocationDropdownAvailability);

    inboundReceiptsTable.on('click', '.view-details-btn', function() {
        handleViewDetails($(this).data('receipt-id'));
    });

    inboundReceiptsTable.on('click', '.select-receipt-btn', function() {
        currentReceiptId = $(this).data('receipt-id');
        const receiptNumber = $(this).data('receipt-number');
        
        selectedReceiptDisplay.text(`#${receiptNumber}`);
        
        if(processingSection) {
            processingSection.removeClass('d-none');
            processingSection[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Selected receipt: ${receiptNumber}`, showConfirmButton: false, timer: 3000 });
        
        loadPutawayCandidates(currentReceiptId);
        resetProcessingForm();
    });

    inboundReceiptsTable.on('click', '.cancel-receipt-btn', function() {
        const receiptId = $(this).data('receipt-id');
        handleCancelReceipt(receiptId);
    });

    // --- NEW Event Listeners for Edit/Delete ---
    putawayCandidatesList.on('click', '.edit-received-btn', function(e) {
        e.stopPropagation(); // Prevent the main item click event
        const itemData = $(this).closest('.list-group-item').data('item');
        handleEditReceivedItemClick(itemData);
    });

    putawayCandidatesList.on('click', '.delete-received-btn', function(e) {
        e.stopPropagation(); // Prevent the main item click event
        const itemData = $(this).closest('.list-group-item').data('item');
        handleDeleteReceivedItemClick(itemData);
    });


    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire('Error!', 'Please select a warehouse on the Dashboard to enable inbound operations.', 'error');
            return;
        }
        const canManageInbound = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        
        if (!canManageInbound) {
            if (receiveItemBtn) receiveItemBtn.prop('disabled', true);
            if (putawayItemBtn) putawayItemBtn.prop('disabled', true);
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'You have view-only permissions.', showConfirmButton: false, timer: 3000 });
        }
        
        await Promise.all([
            loadSuppliersForDropdown(),
            loadInboundReceipts(),
            loadAvailableLocations(),
            populateAllProductsDropdown(),
            populateDotCodeDropdown()
        ]);
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
                const weekStr = String(w).padStart(2, '0');
                const yearStr = String(y).padStart(2, '0');
                const value = `${weekStr}${yearStr}`;
                const text = `Week ${weekStr} / 20${yearStr}`;
                dotCodeOptions.push({ id: value, text: text });
            }
        }
        
        inboundDotCodeSelect.select2({
            placeholder: 'Select a DOT code...',
            theme: "bootstrap-5",
            data: dotCodeOptions
        });
        inboundDotCodeSelect.val(null).trigger('change');
    }

    function resetProcessingForm() {
        productSelect.val(null).trigger('change').prop('disabled', false);
        itemQuantityInput.val('1');
        unitCostInput.val('').prop('disabled', false);
        inboundBatchNumberInput.val('').prop('disabled', false);
        inboundDotCodeSelect.val(null).trigger('change').prop('disabled', false);
        scanLocationInput.val(null).trigger('change').prop('disabled', false);
        selectedInboundItemId = null;
        putawayItemBtn.prop('disabled', true);
        receiveItemBtn.prop('disabled', false);
    }

    // --- MODIFIED FUNCTION ---
    async function loadPutawayCandidates(receiptId) {
        if (!putawayCandidatesList) return;
        
        putawayCandidatesList.html('<div class="list-group-item">Loading...</div>');
        
        const response = await fetchData(`api/inbound_api.php?receipt_id=${receiptId}`);
        putawayCandidatesList.html('');

        if (response?.success && Array.isArray(response.data.items)) {
            const candidates = response.data.items.filter(item => (parseInt(item.received_quantity) || 0) > (parseInt(item.putaway_quantity) || 0));
            
            if (candidates.length > 0) {
                candidates.forEach(item => {
                    const availableQty = (parseInt(item.received_quantity) || 0) - (parseInt(item.putaway_quantity) || 0);
                    
                    const itemHtml = $(`
                        <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                            <div class="item-details">
                                <strong>${item.product_name}</strong> (${item.sku})<br>
                                <small>Batch: ${item.batch_number} | Qty: ${availableQty} | DOT: ${item.dot_code}</small>
                            </div>
                            <div class="item-actions">
                                <button class="btn btn-sm btn-outline-primary edit-received-btn" title="Edit Item"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger delete-received-btn ms-2" title="Delete Item"><i class="bi bi-trash"></i></button>
                            </div>
                        </div>
                    `);
                    
                    itemHtml.data('item', item); // Attach full item data
                    itemHtml.find('.item-details').on('click', () => handleCandidateSelection(item, availableQty));
                    
                    putawayCandidatesList.append(itemHtml);
                });
            } else {
                putawayCandidatesList.html('<div class="list-group-item">No items are currently awaiting putaway for this receipt.</div>');
            }
        } else {
            putawayCandidatesList.html('<div class="list-group-item text-danger">Could not load items.</div>');
        }
    }

    // --- All other functions like handleCandidateSelection, handleReceiveItem, etc., remain here ---
    // ...
    // The following functions are included for completeness.

    function handleCandidateSelection(item, availableQty) {
        resetProcessingForm();
        
        selectedInboundItemId = item.inbound_item_id;
        productSelect.val(item.barcode).trigger('change').prop('disabled', true);
        itemQuantityInput.val(availableQty);
        inboundBatchNumberInput.val(item.batch_number).prop('disabled', true);
        unitCostInput.val(item.unit_cost || '').prop('disabled', true);

        if(item.dot_code) {
            if (inboundDotCodeSelect.find(`option[value='${item.dot_code}']`).length === 0) {
                const week = item.dot_code.substring(0, 2);
                const year = item.dot_code.substring(2, 4);
                const newOption = new Option(`Week ${week} / 20${year}`, item.dot_code, true, true);
                inboundDotCodeSelect.append(newOption);
            }
            inboundDotCodeSelect.val(item.dot_code).trigger('change').prop('disabled', true);
        }

        receiveItemBtn.prop('disabled', true);
        putawayItemBtn.prop('disabled', false);
        updateLocationDropdownAvailability();
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Selected batch ${item.batch_number} for putaway.`, showConfirmButton: false, timer: 3000 });
    }

    async function handleReceiveItem() {
        if (!currentReceiptId) {
            Swal.fire('Error!', 'Please select a receipt first.', 'error');
            return;
        }
        
        const dotCode = inboundDotCodeSelect.val();

        const data = {
            receipt_id: currentReceiptId, 
            barcode: productSelect.val(), 
            received_quantity: parseInt(itemQuantityInput.val(), 10),
            unit_cost: parseFloat(unitCostInput.val()) || null,
            batch_number: inboundBatchNumberInput.val().trim() || null, 
            dot_code: dotCode
        };

        if (!data.barcode) {
            Swal.fire('Error!', 'You must select a product.', 'error');
            return;
        }
        if (isNaN(data.received_quantity) || data.received_quantity <= 0) {
            Swal.fire('Error!', 'Please enter a valid, positive quantity.', 'error');
            return;
        }
        if (!data.dot_code) {
            Swal.fire('Error!', 'DOT Code is a required field.', 'error');
            return;
        }

        const result = await fetchData('api/inbound_api.php?action=receiveItem', 'POST', data);
        if (result?.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: result.message, showConfirmButton: false, timer: 3000 });
            resetProcessingForm();
            await Promise.all([loadInboundReceipts(), loadPutawayCandidates(currentReceiptId)]);
        } else {
            Swal.fire('Error!', result.message || 'Failed to receive item.', 'error');
        }
    }

    async function handlePutawayItem() {
        if (!currentReceiptId || !selectedInboundItemId) {
            Swal.fire('Error!', 'Please select an item from the "Ready for Putaway" list first.', 'error');
            return;
        }
        const data = {
            receipt_id: currentReceiptId,
            inbound_item_id: selectedInboundItemId,
            location_barcode: scanLocationInput.val(),
            putaway_quantity: parseInt(itemQuantityInput.val(), 10),
        };
        if (!data.location_barcode) {
            Swal.fire('Error!', 'Location is required for putaway.', 'error');
            return;
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
            }).then((dialogResult) => {
                if (dialogResult.isConfirmed) {
                    $('#print-frame').remove(); 
                    
                    const iframe = $('<iframe>', {
                        id: 'print-frame',
                        src: `print_label.php?inventory_id=${result.inventory_id}`,
                        style: 'display:none;'
                    }).appendTo('body');
                }
            });

            resetProcessingForm();
            await Promise.all([loadInboundReceipts(), loadPutawayCandidates(currentReceiptId), loadAvailableLocations()]);
        } else {
            Swal.fire('Error!', result.message || 'Failed to put away item.', 'error');
        }
    }
    
    async function loadInboundReceipts() {
        const response = await fetchData('api/inbound_api.php');
        const canManageInbound = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        
        if ($.fn.DataTable.isDataTable('#inboundReceiptsTable')) {
            table.destroy();
        }

        table = inboundReceiptsTable.DataTable({
            data: response.success ? response.data : [],
            columns: [
                { data: 'receipt_id', visible: false }, { data: 'receipt_number' }, { data: 'supplier_name', defaultContent: 'N/A' }, { data: 'expected_arrival_date' },
                { data: 'status', render: function(data) {
                    const statusMap = {'Completed': 'bg-success', 'Received': 'bg-primary', 'Partially Received': 'bg-info text-dark', 'Partially Putaway': 'bg-warning text-dark', 'Pending': 'bg-secondary', 'Cancelled': 'bg-danger'};
                    return `<span class="badge ${statusMap[data] || 'bg-light text-dark'}">${data}</span>`;
                }},
                { data: null, orderable: false, className: 'text-end', render: function(data, type, row) {
                    let btns = `<button data-receipt-id="${row.receipt_id}" data-receipt-number="${row.receipt_number}" class="btn btn-sm btn-outline-secondary view-details-btn" title="View Details"><i class="bi bi-eye"></i></button>`;
                    
                    if (row.status !== 'Completed' && row.status !== 'Cancelled' && canManageInbound) {
                        btns += ` <button data-receipt-id="${row.receipt_id}" data-receipt-number="${row.receipt_number}" class="btn btn-sm btn-primary select-receipt-btn ms-1" title="Select for Processing"><i class="bi bi-check-circle"></i></button>`;
                    }
                    if (row.status === 'Pending' && canManageInbound) {
                        btns += ` <button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-danger cancel-receipt-btn ms-1" title="Cancel Receipt"><i class="bi bi-x-circle"></i></button>`;
                    }
                    return btns;
                }}
            ],
            responsive: true,
            language: { emptyTable: "No inbound receipts found.", zeroRecords: "No matching receipts found" },
            order: [[0, 'desc']],
            initComplete: function(settings, json) {
                $('#statusFilter').on('change', function() {
                    const searchValue = $(this).val();
                    table.column(4).search(searchValue ? '^' + searchValue + '$' : '', true, false).draw();
                });
            }
        });
    }

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

    async function populateAllProductsDropdown() {
        productSelect.select2({
            placeholder: 'Search for a product...',
            theme: "bootstrap-5",
            templateResult: formatProductOption,
            templateSelection: formatProductSelection
        }).prop('disabled', true);

        const response = await fetchData('api/inbound_api.php?action=getProductsWithInventory');
        
        productSelect.empty().append(new Option('', ''));

        if (response?.success && Array.isArray(response.data)) {
            const productData = response.data.map(product => {
                const hasExpiry = product.expiry_years !== null && product.expiry_years > 0;
                return {
                    id: product.barcode,
                    text: `${product.product_name} (Barcode: ${product.barcode})`,
                    disabled: !hasExpiry,
                    product: product
                };
            });
            
            productSelect.select2({
                placeholder: 'Search for a product by name or barcode',
                theme: "bootstrap-5",
                data: productData,
                templateResult: formatProductOption,
                templateSelection: formatProductSelection
            }).prop('disabled', false);
             productSelect.val(null).trigger('change');
        } else {
            productSelect.select2({
                placeholder: 'Could not load products',
                theme: "bootstrap-5",
            }).prop('disabled', true);
        }
    }

    function formatProductOption(state) {
        if (!state.id) {
            return state.text;
        }
        
        let badge = '';
        if (state.disabled) {
            badge = '<span class="badge bg-danger float-end">Age Not Set</span>';
        }
        
        return $(`<div>${state.text}${badge}</div>`);
    }

    function formatProductSelection(state) {
        return state.text;
    }


    async function loadAvailableLocations() {
        if (!scanLocationInput.length) return;
        try {
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
        } catch (error) {
            console.error("Error fetching available locations:", error);
            scanLocationInput.html('<option value="">Error loading locations</option>');
        }

        scanLocationInput.select2({
            placeholder: 'Select a destination location',
            allowClear: true,
            theme: "bootstrap-5",
            templateResult: formatLocationOption
        });
        scanLocationInput.val(null).trigger('change');
    }

    function formatLocationOption(option) {
        if (!option.id) return option.text;

        const locationData = availableLocationsData.find(loc => loc.location_code === option.id);
        if (!locationData) return option.text;

        const quantity = parseInt(itemQuantityInput.val(), 10) || 0;
        const availableCapacity = parseInt(locationData.available_capacity, 10);
        let badgeClass = 'bg-success';
        let badgeText = `Available: ${availableCapacity}`;

        if (quantity > 0 && quantity > availableCapacity) {
            badgeClass = 'bg-danger';
            badgeText = `Not enough space (Avail: ${availableCapacity})`;
        }

        return $(`<div class="d-flex justify-content-between align-items-center w-100"><span>${option.text}</span><span class="badge ${badgeClass}">${badgeText}</span></div>`);
    }

    function updateLocationDropdownAvailability() {
        const quantity = parseInt(itemQuantityInput.val(), 10);
        const locationSelect = $(scanLocationInput);

        if (isNaN(quantity) || quantity <= 0) {
            $('#scanLocationInput option').each(function() { $(this).prop('disabled', false); });
            if (locationSelect.data('select2')) locationSelect.trigger('change.select2');
            return;
        }

        $('#scanLocationInput option').each(function() {
            const option = $(this);
            const locationCode = option.val();
            if (!locationCode) return;

            const locationData = availableLocationsData.find(loc => loc.location_code === locationCode);
            if (locationData) {
                const availableCapacity = parseInt(locationData.available_capacity, 10);
                option.prop('disabled', quantity > availableCapacity);
            }
        });

        const selectedLocationCode = locationSelect.val();
        if (selectedLocationCode) {
            const selectedOption = $(`#scanLocationInput option[value="${selectedLocationCode}"]`);
            if (selectedOption.is(':disabled')) {
                locationSelect.val(null).trigger('change');
            }
        }

        if (locationSelect.data('select2') && locationSelect.data('select2').isOpen()) {
            locationSelect.select2('close').select2('open');
        }
    }
    
    async function showCreateReceiptPopup() {
        Swal.fire({
            title: 'Create New Receipt',
            html: `
                <form id="swal-receiveShipmentForm" class="row g-3 text-start needs-validation" novalidate>
                    <div class="col-12"><label for="swal-supplierSelect" class="form-label">Supplier</label><select id="swal-supplierSelect" class="form-select" required>${supplierOptionsHtml}</select></div>
                    <div class="col-12"><label for="swal-expectedArrivalDate" class="form-label">Expected Arrival</label><input type="date" id="swal-expectedArrivalDate" class="form-control" required></div>
                </form>
            `,
            confirmButtonText: 'Create Receipt',
            focusConfirm: false,
            didOpen: () => {
                $('#swal-supplierSelect').select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-popup') });
                document.getElementById('swal-expectedArrivalDate').valueAsDate = new Date();
            },
            preConfirm: () => {
                const supplierId = $('#swal-supplierSelect').val();
                const expectedArrivalDate = $('#swal-expectedArrivalDate').val();
                if (!supplierId || !expectedArrivalDate) {
                    Swal.showValidationMessage(`Please fill out all fields`);
                    return false;
                }
                return { supplier_id: supplierId, expected_arrival_date: expectedArrivalDate };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const createResult = await fetchData('api/inbound_api.php?action=createReceipt', 'POST', result.value);
                if (createResult?.success) {
                    Swal.fire('Success!', createResult.message || 'Receipt created successfully!', 'success');
                    await loadInboundReceipts();
                } else {
                    Swal.fire('Error!', createResult.message || 'Failed to create receipt.', 'error');
                }
            }
        });
    }

    async function handleViewDetails(receiptId) {
        const response = await fetchData(`api/inbound_api.php?receipt_id=${receiptId}`);

        if (!response.success) {
            Swal.fire('Error!', response.message || 'Could not fetch receipt details.', 'error');
            return;
        }

        const receipt = response.data;
        let tableHtml = '';

        if (receipt.items && receipt.items.length > 0) {
            receipt.items.forEach(item => {
                tableHtml += `<tr class="fw-bold">
                    <td>${item.sku}</td>
                    <td>${item.product_name}</td>
                    <td>${item.barcode || 'N/A'}</td>
                    <td>${item.batch_number || 'N/A'}</td>
                    <td>${item.received_quantity}</td>
                    <td>(${item.putaway_quantity})</td>
                    <td></td>
                </tr>`;

                if (item.putaways && item.putaways.length > 0) {
                    item.putaways.forEach(putaway => {
                        tableHtml += `<tr class="table-light">
                            <td colspan="3" class="text-end fst-italic py-1">
                                ↳ Putaway to <strong>${putaway.location_code}</strong>
                            </td>
                            <td class="py-1">${putaway.batch_number}</td>
                            <td class="py-1">-</td>
                            <td class="py-1">${putaway.quantity}</td>
                            <td class="text-center py-1">
                                <button class="btn btn-sm btn-outline-secondary reprint-btn" data-inventory-id="${putaway.inventory_id}" title="Reprint Stickers">
                                    <i class="bi bi-printer"></i>
                                </button>
                            </td>
                        </tr>`;
                    });
                }
            });
        } else {
            tableHtml = '<tr><td colspan="7" class="text-center">No items have been processed for this receipt yet.</td></tr>';
        }

        const modalHtml = `<div class="text-start">
            <div class="mb-3 p-2 rounded bg-light border">
                <strong>Supplier:</strong> ${receipt.supplier_name || 'N/A'}<br>
                <strong>Status:</strong> ${receipt.status}<br>
                <strong>Expected:</strong> ${receipt.expected_arrival_date || 'N/A'}<br>
                <strong>Arrived:</strong> ${receipt.actual_arrival_date || 'N/A'}
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Product Name</th>
                            <th>Barcode</th>
                            <th>Batch Number</th>
                            <th>Received Qty</th>
                            <th>Putaway Qty</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${tableHtml}</tbody>
                </table>
            </div>
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

    // --- NEW FUNCTION ---
    function handleEditReceivedItemClick(item) {
        const dotOptionsHtml = dotCodeOptions.map(opt => `<option value="${opt.id}">${opt.text}</option>`).join('');
        
        Swal.fire({
            title: 'Edit Received Item',
            html: `
                <form id="swal-editForm" class="text-start">
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
            didOpen: () => {
                const dotSelect = $('#swal-dot');
                dotSelect.select2({
                    theme: 'bootstrap-5',
                    dropdownParent: $('.swal2-popup')
                });
                dotSelect.val(item.dot_code).trigger('change');
            },
            preConfirm: () => {
                const quantity = $('#swal-quantity').val();
                const dot_code = $('#swal-dot').val();
                if (!quantity || quantity <= 0 || !dot_code) {
                    Swal.showValidationMessage('Please enter a valid quantity and select a DOT code.');
                    return false;
                }
                return {
                    inbound_item_id: item.inbound_item_id,
                    quantity: parseInt(quantity, 10),
                    dot_code: dot_code
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=updateReceivedItem', 'POST', result.value);
                if (response.success) {
                    Swal.fire('Success!', response.message, 'success');
                    await loadPutawayCandidates(currentReceiptId);
                    await loadInboundReceipts();
                } else {
                    Swal.fire('Error!', response.message, 'error');
                }
            }
        });
    }

    // --- NEW FUNCTION ---
    function handleDeleteReceivedItemClick(item) {
        Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete the received quantity of ${item.received_quantity} for batch ${item.batch_number}. This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/inbound_api.php?action=deleteReceivedItem', 'POST', { inbound_item_id: item.inbound_item_id });
                if (response.success) {
                    Swal.fire('Deleted!', response.message, 'success');
                    await loadPutawayCandidates(currentReceiptId);
                    await loadInboundReceipts();
                } else {
                    Swal.fire('Error!', response.message, 'error');
                }
            }
        });
    }

    async function handleCancelReceipt(receiptId) {
        Swal.fire({
            title: 'Are you sure?',
            text: "You are about to cancel this receipt. This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, cancel it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetchData('api/inbound_api.php?action=cancelReceipt', 'POST', { receipt_id: receiptId });
                    if (response?.success) {
                        Swal.fire('Cancelled!', response.message, 'success');
                        if (currentReceiptId === receiptId && processingSection) {
                            processingSection.addClass('d-none');
                            currentReceiptId = null;
                            selectedReceiptDisplay.text('');
                        }
                        await loadInboundReceipts();
                    } else {
                        Swal.fire('Error!', response.message || 'Failed to cancel receipt.', 'error');
                    }
                } catch (error) {
                    console.error("Cancellation Error:", error);
                    Swal.fire('Error!', 'An unexpected error occurred.', 'error');
                }
            }
        });
    }
});
