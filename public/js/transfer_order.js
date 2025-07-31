$(document).ready(function() {
    // --- Global State & Config ---
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const currentWarehouseName = localStorage.getItem('current_warehouse_name');
    let ordersTable;

    // --- Initialization ---
    function initializePage() {
        if (!currentWarehouseId) {
            showError('Warehouse Not Set', 'Please select a warehouse from the dashboard.', () => window.location.href = 'dashboard.php');
            return;
        }
        initializeDataTable();
    }

    // --- Event Listeners ---
    // Use event delegation on a static parent element to handle clicks on the dynamically added button
    $('.card-body').on('click', '#newOrderBtn', openCreateTransferModal);
    
    $('#transferOrdersTable tbody').on('click', '.print-btn', function() {
        const transferId = $(this).data('id');
        window.open(`print_transfer_note.php?id=${transferId}`, '_blank');
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
                { data: 'total_quantity', className: 'text-end' },
                { 
                    data: 'status',
                    render: data => `<span class="badge bg-success">${data}</span>`
                },
                {
                    data: 'transfer_id',
                    orderable: false,
                    className: 'text-end',
                    render: data => `<button class="btn btn-sm btn-outline-secondary print-btn" data-id="${data}" title="Print Note"><i class="bi bi-printer"></i></button>`
                }
            ],
            order: [[3, 'desc']],
            dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
                 "<'row'<'col-sm-12'tr>>" +
                 "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
            initComplete: function() {
                const buttonHtml = '<button class="btn btn-sm btn-primary ms-2" id="newOrderBtn"><i class="bi bi-plus-circle me-1"></i> New Transfer Order</button>';
                $('#transferOrdersTable_filter').append(buttonHtml);
            }
        });
    }

    // --- Create Transfer Modal Logic ---
    function openCreateTransferModal() {
        let transferItems = []; // State for this specific modal instance

        Swal.fire({
            title: 'Create New Warehouse Transfer',
            html: getModalHtml(),
            width: '90%',
            showConfirmButton: true,
            confirmButtonText: 'Create Transfer Order',
            showCancelButton: true,
            didOpen: () => {
                const modal = Swal.getPopup();
                initializeModalLogic(modal, transferItems);
            },
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
                handleFormSubmit(result.value);
            }
        });
    }

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
            } else {
                detailsFieldset.prop('disabled', true);
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
                productBarcode: productSelect.find('option:selected').data('barcode'),
                sourceLocationId: sourceLocationSelect.val(),
                sourceLocationName: sourceLocationSelect.find('option:selected').text().split(' (Qty:')[0],
                destLocationId: destLocationSelect.val(),
                destLocationName: destLocationSelect.find('option:selected').text(),
                quantity: parseInt(quantityInput.val(), 10),
                batch: sourceLocationSelect.find('option:selected').data('batch'),
                dot: sourceLocationSelect.find('option:selected').data('dot')
            };

            if (!newItem.productId || !newItem.sourceLocationId || !newItem.destLocationId || !(newItem.quantity > 0)) {
                showError('Incomplete Item', 'Please ensure all fields are correctly filled.');
                return;
            }
            transferItems.push(newItem);
            renderItemsTable(transferItemsTbody, transferItems);
            resetItemEntry(productSelect, detailsFieldset, quantityInput, sourceLocationSelect, destLocationSelect);
        });

        transferItemsTbody.on('click', '.remove-item-btn', function() {
            const indexToRemove = $(this).data('index');
            transferItems.splice(indexToRemove, 1);
            renderItemsTable(transferItemsTbody, transferItems);
        });
    }

    async function handleFormSubmit(orderData) {
        try {
            const data = await robustFetch('api/transfer_orders_api.php?action=create_transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            if (data.status === 'success') {
                Swal.fire({
                    title: 'Success!', text: data.message, icon: 'success', showCancelButton: true,
                    confirmButtonText: '<i class="bi bi-printer"></i> Print Delivery Note',
                    cancelButtonText: 'Close'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.open(`print_transfer_note.php?id=${data.transfer_id}`, '_blank');
                    }
                    ordersTable.ajax.reload();
                });
            } else { showError('Error!', data.message); }
        } catch (error) { showError('Submission Error', 'Could not create the transfer order.'); }
    }
    
    async function robustFetch(url, options = {}) {
        try {
            const response = await fetch(url, options);
            const text = await response.text();
            if (!response.ok) {
                console.error("Fetch Error:", text);
                throw new Error(`HTTP error ${response.status}`);
            }
            return JSON.parse(text);
        } catch (e) {
            console.error("Response Parse Error:", e);
            throw new Error("Invalid server response.");
        }
    }

    async function loadDestinationWarehouses(selector) {
        try {
            const data = await robustFetch('api/warehouses_api.php?action=get_transfer_targets');
            selector.empty().append('<option></option>');
            if (data.success) {
                data.data.forEach(wh => {
                    selector.append(new Option(wh.warehouse_name, wh.warehouse_id));
                });
            }
        } catch (error) {
            showError('Load Error', 'Could not load destination warehouses.');
        }
    }

    async function loadProductsForSearch(selector) {
        try {
            const data = await robustFetch(`api/transfer_orders_api.php?action=get_products_in_warehouse`);
            selector.empty().append('<option></option>');
            if (data.status === 'success') {
                data.data.forEach(p => {
                    const option = new Option(p.product_name, p.product_id);
                    $(option).data('stock', p.total_stock)
                             .data('barcode', p.barcode)
                             .data('sku', p.sku);
                    if (p.total_stock <= 0) {
                        $(option).prop('disabled', true);
                    }
                    selector.append(option);
                });
            }
        } catch (error) {
            showError('Load Error', 'Could not load products.');
        }
    }

    async function loadSourceLocations(selector, productId, quantity) {
        selector.empty().append('<option></option>').trigger('change');
        if (!productId) return;

        try {
            const data = await robustFetch(`api/transfer_orders_api.php?action=get_product_inventory&warehouse_id=${currentWarehouseId}&product_id=${productId}`);
            if (data.status === 'success') {
                data.data.forEach(inv => {
                    const option = new Option(`${inv.location_name} (Qty: ${inv.quantity})`, inv.location_id);
                    $(option).data('available-capacity', inv.quantity)
                             .data('batch', inv.batch_number)
                             .data('dot', inv.dot_code);
                    selector.append(option);
                });
                selector.trigger('change');
            }
        } catch (error) {
            showError('Load Error', 'Could not load source locations.');
        }
    }

    async function loadDestinationLocations(selector, destWarehouseId, productId, quantity) {
        selector.empty().append('<option></option>').trigger('change');
        if (!destWarehouseId || !productId) return;

        try {
            const data = await robustFetch(`api/inventory_api.php?action=location_stock&warehouse_id=${destWarehouseId}&product_id=${productId}`);
            if (data.success) {
                data.data.forEach(loc => {
                    const option = new Option(loc.location_code, loc.location_id);
                    $(option).data('available-capacity', loc.available_capacity);
                    selector.append(option);
                });
                selector.trigger('change');
            }
        } catch (error) {
            showError('Load Error', 'Could not load destination locations.');
        }
    }

    function renderItemsTable(tbody, items) {
        tbody.empty();
        if (items.length === 0) {
            tbody.append('<tr><td colspan="6" class="text-center text-muted">No items added yet.</td></tr>');
        } else {
            items.forEach((item, index) => {
                const row = `
                    <tr>
                        <td>${item.productName}</td>
                        <td>${item.productBarcode || 'N/A'}</td>
                        <td>${item.sourceLocationName}</td>
                        <td>${item.destLocationName}</td>
                        <td class="text-end">${item.quantity}</td>
                        <td class="text-center">
                            <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn" data-index="${index}">
                                <i class="bi bi-x-lg"></i></button>
                        </td>
                    </tr>`;
                tbody.append(row);
            });
        }
    }
    
    function resetItemEntry(productSelect, detailsFieldset, quantityInput, sourceLocationSelect, destLocationSelect) {
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
            theme: 'bootstrap-5',
            placeholder: "Search by Name, SKU, or Barcode...",
            allowClear: true,
            dropdownParent: parent,
            templateResult: formatProductResult,
            templateSelection: (product) => product.text,
            matcher: customProductMatcher
        });
    }

    function formatProductResult(product) {
        if (!product.id) return product.text;
        const stock = $(product.element).data('stock');
        const barcode = $(product.element).data('barcode');
        const sku = $(product.element).data('sku');
        const stockBadge = `<span class="badge ${stock > 0 ? 'bg-success' : 'bg-danger'}">Stock: ${stock}</span>`;
        return $(`
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold">${sku} - ${product.text}</div>
                    <div class="text-muted small">Barcode: ${barcode || 'N/A'}</div>
                </div>
                ${stockBadge}
            </div>
        `);
    }

    function customProductMatcher(params, data) {
        if ($.trim(params.term) === '') return data;
        if (typeof data.id === 'undefined' || !data.id) return null;

        const term = params.term.toLowerCase();
        const productName = data.text.toLowerCase();
        const sku = ($(data.element).data('sku') || '').toString().toLowerCase();
        const barcode = ($(data.element).data('barcode') || '').toString().toLowerCase();

        if (productName.includes(term) || sku.includes(term) || barcode.includes(term)) {
            return data;
        }
        return null;
    }

    function formatLocationResult(location, selector, quantityInput) {
        if (!location.id) return location.text;
        const optionElement = $(location.element);
        const available = optionElement.data('available-capacity');
        const quantity = parseInt(quantityInput.val(), 10) || 0;
        let badge = '';
        if (available !== undefined && available !== null) {
            const isSource = selector.is($('#swal_source_location_id'));
            const hasEnough = isSource ? available >= quantity : (available === null || available >= quantity);
            const badgeClass = hasEnough ? 'bg-success' : 'bg-danger';
            const label = isSource ? 'Stock' : 'Space';
            const message = isSource && !hasEnough ? 'Not enough stock' : `${label}: ${available}`;
            badge = `<span class="badge ${badgeClass}">${message}</span>`;
            if (isSource && !hasEnough) {
                optionElement.prop('disabled', true);
            }
        }
        return $(`<div class="d-flex justify-content-between"><span>${location.text}</span>${badge}</div>`);
    }

    function getModalHtml() {
        return `
            <div class="container-fluid text-start">
                <div class="row">
                    <!-- Left Side: Add Items -->
                    <div class="col-lg-5 border-end">
                        <h5>Add Items</h5>
                        <div class="mb-3">
                            <label for="swal_destination_warehouse_id" class="form-label">To Warehouse (Destination)</label>
                            <select class="form-select" id="swal_destination_warehouse_id"></select>
                        </div>
                        <hr>
                        <div class="mb-3">
                            <label for="swal_product_id" class="form-label">Product</label>
                            <select class="form-select" id="swal_product_id"></select>
                        </div>
                        <fieldset id="swal_detailsFieldset" disabled>
                            <div class="mb-3">
                                <label for="swal_quantity" class="form-label">Quantity</label>
                                <input type="number" class="form-control" id="swal_quantity" min="1">
                            </div>
                            <div class="mb-3">
                                <label for="swal_source_location_id" class="form-label">From Location (Source)</label>
                                <select class="form-select" id="swal_source_location_id"></select>
                            </div>
                            <div class="mb-3">
                                <label for="swal_destination_location_id" class="form-label">To Location (Destination)</label>
                                <select class="form-select" id="swal_destination_location_id"></select>
                            </div>
                            <div class="text-end">
                                <button type="button" class="btn btn-success" id="swal_addItemBtn"><i class="bi bi-plus-circle"></i> Add Item</button>
                            </div>
                        </fieldset>
                    </div>
                    <!-- Right Side: Review -->
                    <div class="col-lg-7">
                        <h5>Review Transfer</h5>
                        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Barcode</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th class="text-end">Qty</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="swal_transferItemsTbody"></tbody>
                            </table>
                        </div>
                        <hr>
                        <div class="mt-3">
                            <label for="swal_notes" class="form-label">Notes (Optional)</label>
                            <textarea class="form-control" id="swal_notes" rows="2"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- Start ---
    initializePage();
});
