$(document).ready(function() {
    // --- DOM Elements ---
    const logoutBtn = document.getElementById('logoutBtn');
    const processingSection = document.getElementById('processingSection');
    const receivePutawaySection = document.getElementById('receivePutawaySection');
    const productSelect = $('#scanBarcodeInput'); // jQuery object for Select2
    const itemQuantityInput = document.getElementById('itemQuantity');
    const inboundBatchNumberInput = document.getElementById('inboundBatchNumber');
    const inboundExpiryDateInput = document.getElementById('inboundExpiryDate');
    const scanLocationInput = document.getElementById('scanLocationInput');
    const receiveItemBtn = document.getElementById('receiveItemBtn');
    const putawayItemBtn = document.getElementById('putawayItemBtn');
    const selectedReceiptDisplay = document.getElementById('selectedReceiptDisplay');
    const putawayCandidatesList = document.getElementById('putawayCandidatesList');
    const inboundReceiptsTable = $('#inboundReceiptsTable');
    const showCreateReceiptBtn = document.getElementById('showCreateReceiptBtn');

    // --- State Variables ---
    let currentReceiptId = null;
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    let supplierOptionsHtml = '';

    // --- Initialize Page ---
    initializePage();

    // --- Event Listeners ---
    if (showCreateReceiptBtn) showCreateReceiptBtn.addEventListener('click', showCreateReceiptPopup);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (receiveItemBtn) receiveItemBtn.addEventListener('click', handleReceiveItem);
    if (putawayItemBtn) putawayItemBtn.addEventListener('click', handlePutawayItem);

    inboundReceiptsTable.on('click', '.view-details-btn', function() {
        handleViewDetails($(this).data('receipt-id'));
    });

    inboundReceiptsTable.on('click', '.select-receipt-btn', function() {
        currentReceiptId = $(this).data('receipt-id');
        const receiptNumber = $(this).data('receipt-number');
        
        // Update display in the (soon to be visible) processing section
        selectedReceiptDisplay.textContent = `#${receiptNumber}`;
        
        // Show the entire processing section
        if(processingSection) {
            processingSection.classList.remove('d-none');
            // Scroll to the section so the user sees it
            processingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Selected receipt: ${receiptNumber}`, showConfirmButton: false, timer: 3000 });
        
        // Load candidates for the selected receipt
        loadPutawayCandidates(currentReceiptId);
    });

    // Listener for the new cancel button
    inboundReceiptsTable.on('click', '.cancel-receipt-btn', function() {
        const receiptId = $(this).data('receipt-id');
        handleCancelReceipt(receiptId);
    });

    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire('Error!', 'Please select a warehouse on the Dashboard to enable inbound operations.', 'error');
            return;
        }
        const canManageInbound = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        
        // The processing section is hidden by default. We just manage button state based on role.
        if (!canManageInbound) {
            if (receiveItemBtn) receiveItemBtn.disabled = true;
            if (putawayItemBtn) putawayItemBtn.disabled = true;
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'You have view-only permissions.', showConfirmButton: false, timer: 3000 });
        }
        
        await Promise.all([
            loadSuppliersForDropdown(),
            loadInboundReceipts(),
            loadAvailableLocations(),
            populateAllProductsDropdown()
        ]);
    }

    async function populateAllProductsDropdown() {
        productSelect.select2({
            placeholder: 'Search for a product...',
            theme: "bootstrap-5",
        }).prop('disabled', true);

        const response = await fetchData('api/inbound.php?action=getProductsWithInventory');
        
        productSelect.empty();
        productSelect.append(new Option('Select a product', ''));

        if (response?.success && Array.isArray(response.data)) {
            const productData = response.data.map(product => {
                const text = `${product.product_name} (Barcode: ${product.barcode}) `;
                return { id: product.barcode, text: text };
            });
            
            productSelect.select2({
                placeholder: 'Search for a product by name or barcode',
                theme: "bootstrap-5",
                data: productData
            }).prop('disabled', false);
        } else {
            productSelect.select2({
                placeholder: 'Could not load products',
                theme: "bootstrap-5",
            }).prop('disabled', true);
        }
    }

    async function loadSuppliersForDropdown() {
        const response = await fetchData('api/suppliers.php');
        let options = '<option value="">Select Supplier</option>';
        if (response?.success && Array.isArray(response.data)) {
            response.data.forEach(supplier => {
                options += `<option value="${supplier.supplier_id}">${supplier.supplier_name}</option>`;
            });
        }
        supplierOptionsHtml = options;
    }
    
    async function loadAvailableLocations() {
        if (!scanLocationInput) return;
        try {
            const response = await fetchData('api/inbound.php?action=getAvailableLocations');
            scanLocationInput.innerHTML = '<option value="">Select a destination</option>';
            if (response?.success && Array.isArray(response.data)) {
                response.data.forEach(location => {
                    const code = location.location_code || 'N/A';
                    const capacity = location.available_capacity !== null && location.available_capacity !== undefined ? location.available_capacity : 'N/A';
                    const optionText = `${code} (Available: ${capacity} units)`;
                    const optionValue = location.location_code || '';
                    const option = new Option(optionText, optionValue);
                    scanLocationInput.add(option);
                });
            }
        } catch (error) {
            console.error("Error fetching available locations:", error);
            scanLocationInput.innerHTML = '<option value="">Error loading locations</option>';
        }
        $(scanLocationInput).select2({
            placeholder: 'Select a destination location',
            allowClear: true,
            theme: "bootstrap-5"
        });
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
            if (result.isConfirmed) await handleCreateReceipt(result.value);
        });
    }

    async function loadInboundReceipts() {
        const response = await fetchData('api/inbound.php');
        const canManageInbound = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        
        if ($.fn.DataTable.isDataTable('#inboundReceiptsTable')) {
            $('#inboundReceiptsTable').DataTable().destroy();
            $('#datatable-header-controls').empty(); // Clear previous controls
        }

        const table = inboundReceiptsTable.DataTable({
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
                    // Add cancel button only if status is 'Pending'
                    if (row.status === 'Pending' && canManageInbound) {
                        btns += ` <button data-receipt-id="${row.receipt_id}" class="btn btn-sm btn-outline-danger cancel-receipt-btn ms-1" title="Cancel Receipt"><i class="bi bi-x-circle"></i></button>`;
                    }
                    return btns;
                }}
            ],
            responsive: true,
            language: { emptyTable: "No inbound receipts found.", zeroRecords: "No matching receipts found" },
            // dom: 'Bfrtip',
            buttons: canManageInbound ? [{ text: '<i class="bi bi-plus-circle"></i> Create New Receipt', className: 'btn btn-info', action: () => showCreateReceiptPopup() }] : [],
            order: [[0, 'desc']],
            initComplete: function(settings, json) {
                // const dtButtons = $('.dt-buttons');
                $('#statusFilter').on('change', function() {
                    const searchValue = $(this).val();
                    table.column(4).search(searchValue ? '^' + searchValue + '$' : '', true, false).draw();
                });
            }
        });
    }

    async function loadPutawayCandidates(receiptId) {
        if (!putawayCandidatesList) return;
        
        putawayCandidatesList.innerHTML = '<div class="list-group-item">Loading...</div>';
        
        const response = await fetchData(`api/inbound.php?receipt_id=${receiptId}`);
        putawayCandidatesList.innerHTML = ''; // Clear the list

        if (response?.success && Array.isArray(response.data.items)) {
            const candidates = response.data.items.filter(item => (parseInt(item.received_quantity) || 0) > (parseInt(item.putaway_quantity) || 0));
            
            if (candidates.length > 0) {
                candidates.forEach(item => {
                    const availableQty = (parseInt(item.received_quantity) || 0) - (parseInt(item.putaway_quantity) || 0);
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'list-group-item list-group-item-action';
                    button.innerHTML = `<strong>${item.product_name}</strong> (${item.sku})<br><small>Batch: ${item.batch_number} | Available to Putaway: ${availableQty}</small>`;
                    button.addEventListener('click', () => {
                        productSelect.val(item.barcode).trigger('change');
                        itemQuantityInput.value = availableQty;
                        inboundBatchNumberInput.value = item.batch_number;
                        inboundExpiryDateInput.value = item.expiry_date || '';
                        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Selected batch ${item.batch_number}`, showConfirmButton: false, timer: 3000 });
                    });
                    putawayCandidatesList.appendChild(button);
                });
            } else {
                putawayCandidatesList.innerHTML = '<div class="list-group-item">No items are currently awaiting putaway for this receipt.</div>';
            }
        } else {
            putawayCandidatesList.innerHTML = '<div class="list-group-item text-danger">Could not load items.</div>';
        }
    }

    async function handleViewDetails(receiptId) {
        const response = await fetchData(`api/inbound.php?receipt_id=${receiptId}`);
        if (response?.success) {
            const receipt = response.data;
            let itemsHtml = '';
            if (receipt.items && receipt.items.length > 0) {
                receipt.items.forEach(item => {
                    const statusMap = {'Putaway': 'bg-success', 'Received': 'bg-primary', 'Partially Putaway': 'bg-warning text-dark', 'Pending': 'bg-secondary', 'Cancelled': 'bg-danger'};
                    const statusClass = statusMap[item.status] || 'bg-light text-dark';
                    if (item.expected_quantity > 0) {
                        itemsHtml += `<tr><td>${item.sku}</td><td>${item.product_name}</td><td>${item.barcode}</td><td><span class="badge ${statusClass}">${item.status}</span></td><td>${item.batch_number || 'N/A'}</td><td>${item.expected_quantity}</td><td><strong>${item.received_quantity}</strong></td><td><em>(${item.putaway_quantity})</em></td><td><em class="text-muted">Receiving Bay</em></td></tr>`;
                    } else {
                        itemsHtml += `<tr class="table-light"><td colspan="3" class="text-end fst-italic text-muted border-start-0">↳ Putaway Action:</td><td><span class="badge ${statusClass}">${item.status}</span></td><td><strong>${item.batch_number || 'N/A'}</strong></td><td>-</td><td>-</td><td><strong>${item.putaway_quantity}</strong></td><td><strong>${item.final_location_code || 'N/A'}</strong></td></tr>`;
                    }
                });
            } else {
                itemsHtml = '<tr><td colspan="9" class="text-center">No items have been assigned to this receipt yet.</td></tr>';
            }
            const modalHtml = `<div class="text-start"><div class="mb-3 p-2 rounded bg-light border"><strong>Supplier:</strong> ${receipt.supplier_name || 'N/A'}<br><strong>Status:</strong> <span class="badge bg-primary">${receipt.status}</span><br><strong>Expected Arrival:</strong> ${receipt.expected_arrival_date || 'N/A'}<br><strong>Actual Arrival:</strong> ${receipt.actual_arrival_date || 'Not Yet Arrived'}</div><h6 class="mt-4">Items</h6><div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>SKU</th><th>Product Name</th><th>Barcode</th><th>Status</th><th>Batch</th><th>Exp. Qty</th><th>Rec. Qty</th><th>Put. Qty</th><th>Location</th></tr></thead><tbody>${itemsHtml}</tbody></table></div></div>`;
            Swal.fire({ title: `Receipt Details: #${receipt.receipt_number}`, html: modalHtml, width: '90vw', confirmButtonText: 'Close' });
        } else {
            Swal.fire('Error!', response.message || 'Could not fetch receipt details.', 'error');
        }
    }

    async function handleCreateReceipt(data) {
        const result = await fetchData('api/inbound.php?action=createReceipt', 'POST', data);
        if (result?.success) {
            Swal.fire('Success!', result.message || 'Receipt created successfully!', 'success');
            await loadInboundReceipts();
        } else {
            Swal.fire('Error!', result.message || 'Failed to create receipt.', 'error');
        }
    }

    async function handleReceiveItem() {
        if (!currentReceiptId) {
            Swal.fire('Error!', 'Please select a receipt first.', 'error');
            return;
        }
        const data = {
            receipt_id: currentReceiptId, barcode: productSelect.val(), received_quantity: parseInt(itemQuantityInput.value, 10),
            batch_number: inboundBatchNumberInput.value.trim() || null, expiry_date: inboundExpiryDateInput.value.trim() || null
        };
        if (!data.barcode || isNaN(data.received_quantity) || data.received_quantity <= 0) {
            Swal.fire('Error!', 'Product and a valid quantity are required.', 'error');
            return;
        }
        const result = await fetchData('api/inbound.php?action=receiveItem', 'POST', data);
        if (result?.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: result.message, showConfirmButton: false, timer: 3000 });
            productSelect.val(null).trigger('change');
            itemQuantityInput.value = '1';
            inboundBatchNumberInput.value = '';
            inboundExpiryDateInput.value = '';
            await Promise.all([loadInboundReceipts(), loadPutawayCandidates(currentReceiptId)]);
        } else {
            Swal.fire('Error!', result.message || 'Failed to receive item.', 'error');
        }
    }

    async function handlePutawayItem() {
        if (!currentReceiptId) {
            Swal.fire('Error!', 'Please select a receipt first.', 'error');
            return;
        }
        const data = {
            receipt_id: currentReceiptId, barcode: productSelect.val(), location_barcode: $(scanLocationInput).val(),
            putaway_quantity: parseInt(itemQuantityInput.value, 10), batch_number: inboundBatchNumberInput.value.trim() || null
        };
        if (!data.barcode || !data.location_barcode || isNaN(data.putaway_quantity) || data.putaway_quantity <= 0) {
            Swal.fire('Error!', 'Product, Location, and a valid Quantity are required.', 'error');
            return;
        }
        const result = await fetchData('api/inbound.php?action=putawayItem', 'POST', data);
        if (result?.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: result.message || 'Item successfully put away.', showConfirmButton: false, timer: 3000 });
            productSelect.val(null).trigger('change');
            $(scanLocationInput).val(null).trigger('change');
            itemQuantityInput.value = '1';
            inboundBatchNumberInput.value = '';
            inboundExpiryDateInput.value = '';
            await Promise.all([loadInboundReceipts(), loadPutawayCandidates(currentReceiptId), loadAvailableLocations()]);
        } else {
            Swal.fire('Error!', result.message || 'Failed to put away item.', 'error');
        }
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
                    const response = await fetchData('api/inbound.php?action=cancelReceipt', 'POST', { receipt_id: receiptId });
                    if (response?.success) {
                        Swal.fire(
                            'Cancelled!',
                            response.message,
                            'success'
                        );
                        // Hide the processing section if the cancelled receipt was the one selected
                        if (currentReceiptId === receiptId && processingSection) {
                            processingSection.classList.add('d-none');
                            currentReceiptId = null;
                            selectedReceiptDisplay.textContent = '';
                        }
                        await loadInboundReceipts();
                    } else {
                        // The API will send a specific error message
                        Swal.fire('Error!', response.message || 'Failed to cancel receipt.', 'error');
                    }
                } catch (error) {
                    console.error("Cancellation Error:", error);
                    Swal.fire('Error!', 'An unexpected error occurred.', 'error');
                }
            }
        });
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        window.location.href = 'index.html';
    }
});
