/*
* MODIFICATION SUMMARY
* --------------------
* 2025-08-14:
* - Added 'Article No.' column to the "Receive Items" modal to provide more product detail during receiving.
* - Added 'Article No.' column to the "Edit Order" modal for better reference when editing quantities.
*/
$(document).ready(function() {
    // --- Global State & Config ---
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const currentWarehouseName = localStorage.getItem('current_warehouse_name');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let ordersTable;

    // --- Initialization ---
    function initializePage() {
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
        initializeDataTable();
    }

    // --- Event Listeners ---
    $('body').on('click', '#newOrderBtn', openCreateTransferModal);
    $('#transferOrdersTable tbody').on('click', '.print-btn', function() {
        window.open(`print_transfer_note.php?id=${$(this).data('id')}`, '_blank');
    });
    $('#transferOrdersTable tbody').on('click', '.receive-btn', function() {
        openReceiveModal($(this).data('id'));
    });
    $('#transferOrdersTable tbody').on('click', '.edit-btn', function() {
        openEditModal($(this).data('id'));
    });

    // --- DataTable Initialization ---
    function initializeDataTable() {
        ordersTable = $('#transferOrdersTable').DataTable({
            processing: true,
            ajax: {
                url: 'api/transfer_orders_api.php?action=get_transfer_history',
                dataSrc: 'data'
            },
            columns: [
                { data: 'transfer_order_number' },
                { data: 'source_warehouse' },
                { data: 'destination_warehouse' },
                { 
                    data: 'created_at',
                    render: data => new Date(data).toLocaleDateString()
                },
                { 
                    data: null, 
                    className: 'text-end',
                    render: function(data, type, row) {
                        const sent = row.total_quantity;
                        const received = row.total_received_quantity;
                        if (row.status !== 'Completed') {
                            return sent;
                        }
                        const isMatch = sent == received;
                        const receivedBadge = isMatch ? `<span class="fw-bold text-success">${received}</span>` : `<span class="fw-bold text-danger">${received}</span>`;
                        return `${sent} / ${receivedBadge}`;
                    }
                },
                { 
                    data: 'status',
                    render: function(data) {
                        let badgeClass = 'bg-secondary';
                        if (data === 'Completed') badgeClass = 'bg-success';
                        if (data === 'Pending') badgeClass = 'bg-warning text-dark';
                        if (data === 'Cancelled') badgeClass = 'bg-danger';
                        return `<span class="badge ${badgeClass}">${data}</span>`;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-end',
                    render: function(data, type, row) {
                        let buttons = `<button class="btn btn-sm btn-outline-secondary print-btn" data-id="${row.transfer_id}" title="Print Note"><i class="bi bi-printer"></i></button>`;
                        if (row.status === 'Pending') {
                            if (row.destination_warehouse_id == currentWarehouseId && ['operator', 'manager', 'picker'].includes(currentWarehouseRole)) {
                                buttons += ` <button class="btn btn-sm btn-outline-success receive-btn" data-id="${row.transfer_id}" title="Receive Items"><i class="bi bi-box-arrow-in-down"></i></button>`;
                            }
                            if (row.source_warehouse_id == currentWarehouseId && ['operator', 'manager'].includes(currentWarehouseRole)) {
                                buttons += ` <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${row.transfer_id}" title="Edit Order"><i class="bi bi-pencil"></i></button>`;
                            }
                        }
                        return buttons;
                    }
                }
            ],
            order: [[3, 'desc']],
            dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
                 "<'row'<'col-sm-12'tr>>" +
                 "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
            initComplete: function() {
                if (['operator', 'manager'].includes(currentWarehouseRole)) {
                    const buttonHtml = '<button class="btn btn-sm btn-primary ms-2" id="newOrderBtn"><i class="bi bi-plus-circle me-1"></i> New Transfer Order</button>';
                    $('#transferOrdersTable_filter').append(buttonHtml);
                }
            }
        });
    }
    
    // --- Modals and Forms ---
    function openCreateTransferModal() {
        let transferItems = []; 
        Swal.fire({
            title: 'Create New Warehouse Transfer',
            html: getModalHtml(),
            width: '90%',
            showConfirmButton: true,
            confirmButtonText: 'Create Transfer Order',
            showCancelButton: true,
            allowOutsideClick: false,
            didOpen: () => initializeModalLogic(Swal.getPopup(), transferItems),
            preConfirm: () => {
                const destWarehouseId = $('#swal_destination_warehouse_id').val();
                if (!destWarehouseId) {
                    Swal.showValidationMessage('A destination warehouse is required.');
                    return false;
                }
                if (transferItems.length === 0) {
                    Swal.showValidationMessage('You must add at least one item to the transfer.');
                    return false;
                }
                return {
                    source_warehouse_id: currentWarehouseId,
                    destination_warehouse_id: destWarehouseId,
                    notes: $('#swal_notes').val(),
                    items: transferItems
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                handleFormSubmit('api/transfer_orders_api.php?action=create_transfer', 'POST', result.value, 'Transfer order created and is now pending receipt.');
            }
        });
    }

    async function openReceiveModal(transferId) {
        const response = await fetchData(`api/transfer_orders_api.php?action=get_transfer_details_for_receiving&id=${transferId}`);
        if (!response.success) {
            return Swal.fire('Error', response.message || 'Could not fetch transfer details.', 'error');
        }

        const { header, items } = response;
        const itemsHtml = items.map(item => `
            <tr>
                <td>${item.product_name} (${item.sku})</td>
                <td>${item.article_no || 'N/A'}</td>
                <td class="text-end fw-bold">${item.quantity}</td>
                <td>
                    <input type="number" class="form-control form-control-sm received-qty-input" 
                           data-item-id="${item.item_id}" 
                           data-sent-qty="${item.quantity}"
                           placeholder="Enter Qty"
                           min="0">
                </td>
            </tr>
        `).join('');

        Swal.fire({
            title: `Receiving Transfer: ${header.transfer_order_number}`,
            html: `
                <p class="text-start">Enter the quantity received for each item from <strong>${header.source_warehouse}</strong>. The received quantity must exactly match the sent quantity to proceed.</p>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th>Product</th>
                                <th>Article No.</th>
                                <th class="text-end">Sent Qty</th>
                                <th>Received Qty</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>`,
            width: '800px',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-check-circle-fill me-1"></i>Confirm Receipt',
            confirmButtonColor: '#198754',
            allowOutsideClick: false,
            preConfirm: () => {
                const receivedItems = [];
                let validationError = null;

                $('.received-qty-input').each(function() {
                    const itemId = $(this).data('item-id');
                    const sentQty = parseInt($(this).data('sent-qty'), 10);
                    const receivedQty = parseInt($(this).val(), 10);
                    const originalItem = items.find(i => i.item_id == itemId);

                    if (isNaN(receivedQty)) {
                        validationError = 'Please enter a received quantity for all items.';
                        return false; 
                    }

                    if (receivedQty !== sentQty) {
                        validationError = `Quantity mismatch for ${originalItem.product_name}. Sent: ${sentQty}, Received: ${receivedQty}. Please correct the quantity or contact the source warehouse.`;
                        return false; 
                    }
                    
                    receivedItems.push({ ...originalItem, received_quantity: receivedQty });
                });

                if (validationError) {
                    Swal.showValidationMessage(validationError);
                    return false;
                }

                return {
                    transfer_id: transferId,
                    destination_warehouse_id: header.destination_warehouse_id,
                    items: receivedItems
                };
            }
        }).then(result => {
            if (result.isConfirmed) {
                handleFormSubmit('api/transfer_orders_api.php?action=receive_transfer', 'POST', result.value, 'Transfer received successfully and order completed.');
            }
        });
    }
    
    async function openEditModal(transferId) {
        const response = await fetchData(`api/transfer_orders_api.php?action=get_transfer_details_for_receiving&id=${transferId}`);
        if (!response.success) {
            return Swal.fire('Error', response.message || 'Could not fetch transfer details.', 'error');
        }

        const { header, items } = response;
        const itemsHtml = items.map(item => `
            <tr>
                <td>${item.product_name} (${item.sku})</td>
                <td>${item.article_no || 'N/A'}</td>
                <td><input type="number" class="form-control form-control-sm edit-qty-input" data-item-id="${item.item_id}" value="${item.quantity}" min="1"></td>
            </tr>
        `).join('');

        Swal.fire({
            title: `Editing Transfer: ${header.transfer_order_number}`,
            html: `<table class="table table-sm"><thead><tr><th>Product</th><th>Article No.</th><th>Quantity</th></tr></thead><tbody>${itemsHtml}</tbody></table>`,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: 'Update Order',
            allowOutsideClick: false,
            preConfirm: () => {
                const updatedItems = [];
                $('.edit-qty-input').each(function() {
                    updatedItems.push({
                        item_id: $(this).data('item-id'),
                        quantity: parseInt($(this).val(), 10)
                    });
                });
                return { transfer_id: transferId, items: updatedItems };
            }
        }).then(result => {
            if (result.isConfirmed) {
                handleFormSubmit('api/transfer_orders_api.php?action=update_transfer', 'PUT', result.value, 'Transfer order updated successfully.');
            }
        });
    }

    async function handleFormSubmit(url, method, orderData, successMessage) {
        const data = await fetchData(url, method, orderData);
        if (data && data.success) {
            Swal.fire('Success!', successMessage, 'success');
            ordersTable.ajax.reload();
        } else if (data) {
            Swal.fire('Error!', data.message, 'error');
        }
    }

    // --- Modal Initialization and Data Loading ---
    function initializeModalLogic(modal, transferItems) {
        const destWarehouseSelect = $(modal).find('#swal_destination_warehouse_id');
        const productSelect = $(modal).find('#swal_product_id');
        const detailsFieldset = $(modal).find('#swal_detailsFieldset');
        const quantityInput = $(modal).find('#swal_quantity');
        const sourceLocationSelect = $(modal).find('#swal_source_location_id');
        const destLocationSelect = $(modal).find('#swal_destination_location_id');
        const addItemBtn = $(modal).find('#swal_addItemBtn');
        const transferItemsTbody = $(modal).find('#swal_transferItemsTbody');

        initSelect2(destWarehouseSelect, 'Select destination warehouse');
        initSelect2WithBadges(sourceLocationSelect, 'Select source location', modal, quantityInput);
        initSelect2WithBadges(destLocationSelect, 'Select destination location', modal, quantityInput);
        initializeProductSearch(productSelect, modal);

        loadDestinationWarehouses(destWarehouseSelect);
        loadProductsForSearch(productSelect);
        renderItemsTable(transferItemsTbody, transferItems);

        productSelect.on('change', function() {
            const productId = $(this).val();
            resetItemDetails(detailsFieldset, quantityInput, sourceLocationSelect, destLocationSelect);
            if (productId) {
                detailsFieldset.prop('disabled', false);
            }
        });

        quantityInput.on('input', () => {
            loadSourceLocations(sourceLocationSelect, productSelect.val(), quantityInput.val());
            loadDestinationLocations(destLocationSelect, destWarehouseSelect.val(), productSelect.val(), quantityInput.val());
        });
        
        addItemBtn.on('click', () => {
            const newItem = {
                productId: productSelect.val(),
                productName: productSelect.find('option:selected').text(),
                productarticle_no: productSelect.find('option:selected').data('article_no'),
                sourceLocationId: sourceLocationSelect.val(),
                sourceLocationName: sourceLocationSelect.find('option:selected').text().split(' (Qty:')[0],
                destLocationId: destLocationSelect.val(),
                destLocationName: destLocationSelect.find('option:selected').text(),
                quantity: parseInt(quantityInput.val(), 10),
                batch: sourceLocationSelect.find('option:selected').data('batch'),
                dot: sourceLocationSelect.find('option:selected').data('dot')
            };

            if (!newItem.productId || !newItem.sourceLocationId || !newItem.destLocationId || !(newItem.quantity > 0)) {
                return Swal.fire('Incomplete Item', 'Please ensure all fields are correctly filled.', 'error');
            }
            transferItems.push(newItem);
            renderItemsTable(transferItemsTbody, transferItems);
            resetItemEntry(productSelect);
        });

        transferItemsTbody.on('click', '.remove-item-btn', function() {
            transferItems.splice($(this).data('index'), 1);
            renderItemsTable(transferItemsTbody, transferItems);
        });
    }

    async function loadDestinationWarehouses(selector) {
        const data = await fetchData('api/warehouses_api.php?action=get_transfer_targets');
        selector.empty().append('<option></option>');
        if (data && data.success) {
            data.data.forEach(wh => selector.append(new Option(wh.warehouse_name, wh.warehouse_id)));
        }
    }

    async function loadProductsForSearch(selector) {
        const data = await fetchData(`api/transfer_orders_api.php?action=get_products_in_warehouse`);
        selector.empty().append('<option></option>');
        if (data && data.success) {
            data.data.forEach(p => {
                const option = new Option(p.product_name, p.product_id);
                $(option).data({ stock: p.total_stock, article_no: p.article_no, sku: p.sku });
                if (p.total_stock <= 0) $(option).prop('disabled', true);
                selector.append(option);
            });
        }
    }

    async function loadSourceLocations(selector, productId, quantity) {
        selector.empty().append('<option></option>').trigger('change');
        if (!productId) return;

        const data = await fetchData(`api/transfer_orders_api.php?action=get_product_inventory&product_id=${productId}&warehouse_id=${currentWarehouseId}`);
        if (data && data.success) {
            data.data.forEach(inv => {
                const option = new Option(`${inv.location_name} (Qty: ${inv.quantity})`, inv.location_id);
                $(option).data({ 'available-capacity': inv.quantity, batch: inv.batch_number, dot: inv.dot_code });
                selector.append(option);
            });
            selector.trigger('change');
        }
    }

    async function loadDestinationLocations(selector, destWarehouseId, productId, quantity) {
        selector.empty().append('<option></option>').trigger('change');
        if (!destWarehouseId || !productId) return;

        const data = await fetchData(`api/inventory_api.php?action=location_stock&warehouse_id=${destWarehouseId}&product_id=${productId}`);
        if (data && data.success) {
            data.data.forEach(loc => {
                const option = new Option(loc.location_code, loc.location_id);
                $(option).data('available-capacity', loc.available_capacity);
                selector.append(option);
            });
            selector.trigger('change');
        }
    }
    
    // --- UI Rendering and Helpers ---
    function renderItemsTable(tbody, items) {
        tbody.empty();
        if (items.length === 0) {
            tbody.append('<tr><td colspan="6" class="text-center text-muted">No items added yet.</td></tr>');
        } else {
            items.forEach((item, index) => {
                tbody.append(`
                    <tr>
                        <td>${item.productName}</td>
                        <td>${item.productarticle_no || 'N/A'}</td>
                        <td>${item.sourceLocationName}</td>
                        <td>${item.destLocationName}</td>
                        <td class="text-end">${item.quantity}</td>
                        <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger remove-item-btn" data-index="${index}"><i class="bi bi-x-lg"></i></button></td>
                    </tr>`);
            });
        }
    }
    
    function resetItemEntry(productSelect) {
        productSelect.val(null).trigger('change');
    }

    function resetItemDetails(detailsFieldset, quantityInput, sourceLocationSelect, destLocationSelect) {
        detailsFieldset.prop('disabled', true);
        quantityInput.val('');
        sourceLocationSelect.empty().append('<option></option>').trigger('change');
        destLocationSelect.empty().append('<option></option>').trigger('change');
    }

    function initSelect2(selector, placeholder) {
        selector.select2({ theme: 'bootstrap-5', placeholder, allowClear: true, dropdownParent: $('.swal2-popup') });
    }

    function initSelect2WithBadges(selector, placeholder, parent, quantityInput) {
        selector.select2({
            theme: 'bootstrap-5', placeholder, allowClear: true, dropdownParent: parent,
            templateResult: (state) => formatLocationResult(state, selector, quantityInput),
            templateSelection: (loc) => loc.text
        });
    }

    function initializeProductSearch(selector, parent) {
        selector.select2({
            theme: 'bootstrap-5', placeholder: "Search by Name, SKU, or Article No...", allowClear: true, dropdownParent: parent,
            templateResult: formatProductResult,
            templateSelection: (product) => product.text,
            matcher: customProductMatcher
        });
    }

    function formatProductResult(product) {
        if (!product.id) return product.text;
        const { stock, article_no, sku } = $(product.element).data();
        const stockBadge = `<span class="badge ${stock > 0 ? 'bg-success' : 'bg-danger'}">Stock: ${stock}</span>`;
        return $(`<div><div class="fw-bold">${sku} - ${product.text}</div><div class="text-muted small">Article: ${article_no || 'N/A'}</div></div>`).add(stockBadge);
    }

    function customProductMatcher(params, data) {
        if ($.trim(params.term) === '') return data;
        if (!data.id) return null;
        const term = params.term.toLowerCase();
        const { sku, article_no } = $(data.element).data();
        if (data.text.toLowerCase().includes(term) || (sku || '').toString().toLowerCase().includes(term) || (article_no || '').toString().toLowerCase().includes(term)) {
            return data;
        }
        return null;
    }

    function formatLocationResult(location, selector, quantityInput) {
        if (!location.id) return location.text;
        const available = $(location.element).data('available-capacity');
        const quantity = parseInt(quantityInput.val(), 10) || 0;
        let badge = '';
        if (available !== undefined) {
            const isSource = selector.is($('#swal_source_location_id'));
            const hasEnough = isSource ? available >= quantity : (available === null || available >= quantity);
            const badgeClass = hasEnough ? 'bg-success' : 'bg-danger';
            const label = isSource ? 'Stock' : 'Space';
            const message = isSource && !hasEnough ? 'Not enough stock' : `${label}: ${available}`;
            badge = `<span class="badge ${badgeClass}">${message}</span>`;
            if (isSource && !hasEnough) $(location.element).prop('disabled', true);
        }
        return $(`<div><span>${location.text}</span>${badge}</div>`);
    }

    function getModalHtml() {
        return `
            <div class="container-fluid text-start">
                <div class="row">
                    <div class="col-lg-5 border-end">
                        <h5>Add Items</h5>
                        <div class="mb-3"><label for="swal_destination_warehouse_id" class="form-label">To Warehouse (Destination)</label><select class="form-select" id="swal_destination_warehouse_id"></select></div><hr>
                        <div class="mb-3"><label for="swal_product_id" class="form-label">Product</label><select class="form-select" id="swal_product_id"></select></div>
                        <fieldset id="swal_detailsFieldset" disabled>
                            <div class="mb-3"><label for="swal_quantity" class="form-label">Quantity</label><input type="number" class="form-control" id="swal_quantity" min="1"></div>
                            <div class="mb-3"><label for="swal_source_location_id" class="form-label">From Location (Source)</label><select class="form-select" id="swal_source_location_id"></select></div>
                            <div class="mb-3"><label for="swal_destination_location_id" class="form-label">To Location (Destination)</label><select class="form-select" id="swal_destination_location_id"></select></div>
                            <div class="text-end"><button type="button" class="btn btn-success" id="swal_addItemBtn"><i class="bi bi-plus-circle"></i> Add Item</button></div>
                        </fieldset>
                    </div>
                    <div class="col-lg-7">
                        <h5>Review Transfer</h5>
                        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                            <table class="table table-sm">
                                <thead><tr><th>Product</th><th>Article No</th><th>From</th><th>To</th><th class="text-end">Qty</th><th></th></tr></thead>
                                <tbody id="swal_transferItemsTbody"></tbody>
                            </table>
                        </div>
                        <hr>
                        <div class="mt-3"><label for="swal_notes" class="form-label">Notes (Optional)</label><textarea class="form-control" id="swal_notes" rows="2"></textarea></div>
                    </div>
                </div>
            </div>`;
    }

    // --- Start ---
    initializePage();
});
