// public/js/transfer_order.js

$(document).ready(function() {
    // --- Global State & Config ---
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let ordersTable;

    // --- Initialization ---
    function initializePage() {
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
                        const statusKey = data.toLowerCase().replace(/\s+/g, '_');
                        let badgeClass = 'bg-secondary';
                        if (data === 'Completed') badgeClass = 'bg-success';
                        if (data === 'Pending') badgeClass = 'bg-warning text-dark';
                        if (data === 'Cancelled') badgeClass = 'bg-danger';
                        return `<span class="badge ${badgeClass}">${__(statusKey, data)}</span>`;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-end',
                    render: function(data, type, row) {
                        let buttons = `<button class="btn btn-sm btn-outline-secondary print-btn" data-id="${row.transfer_id}" title="${__('print_note')}"><i class="bi bi-printer"></i></button>`;
                        if (row.status === 'Pending') {
                            if (row.destination_warehouse_id == currentWarehouseId && ['operator', 'manager', 'picker'].includes(currentWarehouseRole)) {
                                buttons += ` <button class="btn btn-sm btn-outline-success receive-btn" data-id="${row.transfer_id}" title="${__('receive_items')}"><i class="bi bi-box-arrow-in-down"></i></button>`;
                            }
                            if (row.source_warehouse_id == currentWarehouseId && ['operator', 'manager'].includes(currentWarehouseRole)) {
                                buttons += ` <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${row.transfer_id}" title="${__('edit_order')}"><i class="bi bi-pencil"></i></button>`;
                            }
                        }
                        return buttons;
                    }
                }
            ],
            order: [[3, 'desc']],
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
            },
            initComplete: function() {
                if (['operator', 'manager'].includes(currentWarehouseRole)) {
                    const buttonHtml = `<button class="btn btn-sm btn-primary ms-2" id="newOrderBtn"><i class="bi bi-plus-circle me-1"></i> ${__('new_transfer_order')}</button>`;
                    $('#transferOrdersTable_filter').append(buttonHtml);
                }
            }
        });
    }
    
    // --- Modals and Forms ---
    function openCreateTransferModal() {
        let transferItems = []; 
        Swal.fire({
            title: __('create_new_warehouse_transfer'),
            html: getModalHtml(),
            width: '90%',
            showConfirmButton: true,
            confirmButtonText: __('create_transfer_order'),
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            didOpen: () => initializeModalLogic(Swal.getPopup(), transferItems),
            preConfirm: () => {
                const destWarehouseId = $('#swal_destination_warehouse_id').val();
                if (!destWarehouseId) {
                    Swal.showValidationMessage(__('destination_warehouse_is_required'));
                    return false;
                }
                if (transferItems.length === 0) {
                    Swal.showValidationMessage(__('must_add_at_least_one_item'));
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
                handleFormSubmit('api/transfer_orders_api.php?action=create_transfer', 'POST', result.value, __('transfer_order_created_and_pending'));
            }
        });
    }

    async function openReceiveModal(transferId) {
        const response = await fetchData(`api/transfer_orders_api.php?action=get_transfer_details_for_receiving&id=${transferId}`);
        if (!response.success) {
            return Swal.fire(__('error'), response.message || __('could_not_fetch_transfer_details'), 'error');
        }

        const { header, items } = response;
        const itemsHtml = items.map(item => `
            <tr>
                <td>${item.product_name} (${item.sku})</td>
                <td>${item.article_no || __('n_a')}</td>
                <td class="text-end fw-bold">${item.quantity}</td>
                <td>
                    <input type="number" class="form-control form-control-sm received-qty-input" 
                           data-item-id="${item.item_id}" 
                           data-sent-qty="${item.quantity}"
                           placeholder="${__('enter_qty')}"
                           min="0">
                </td>
            </tr>
        `).join('');

        Swal.fire({
            title: `${__('receiving_transfer')}: ${header.transfer_order_number}`,
            html: `
                <p class="text-start">${__('enter_received_quantity_from')} <strong>${header.source_warehouse}</strong>. ${__('quantity_must_match')}</p>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
                            <tr>
                                <th>${__('product')}</th>
                                <th>${__('article_no')}</th>
                                <th class="text-end">${__('sent_qty')}</th>
                                <th>${__('received_qty')}</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>`,
            width: '800px',
            icon: 'info',
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            confirmButtonText: `<i class="bi bi-check-circle-fill me-1"></i>${__('confirm_receipt')}`,
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
                        validationError = __('please_enter_received_quantity_for_all_items');
                        return false; 
                    }

                    if (receivedQty !== sentQty) {
                        validationError = `${__('quantity_mismatch_for')} ${originalItem.product_name}. ${__('sent')}: ${sentQty}, ${__('received')}: ${receivedQty}. ${__('please_correct_or_contact_source')}`;
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
                handleFormSubmit('api/transfer_orders_api.php?action=receive_transfer', 'POST', result.value, __('transfer_received_successfully'));
            }
        });
    }
    
    async function openEditModal(transferId) {
        const response = await fetchData(`api/transfer_orders_api.php?action=get_transfer_details_for_receiving&id=${transferId}`);
        if (!response.success) {
            return Swal.fire(__('error'), response.message || __('could_not_fetch_transfer_details'), 'error');
        }

        const { header, items } = response;
        const itemsHtml = items.map(item => `
            <tr>
                <td>${item.product_name} (${item.sku})</td>
                <td>${item.article_no || __('n_a')}</td>
                <td><input type="number" class="form-control form-control-sm edit-qty-input" data-item-id="${item.item_id}" value="${item.quantity}" min="1"></td>
            </tr>
        `).join('');

        Swal.fire({
            title: `${__('editing_transfer')}: ${header.transfer_order_number}`,
            html: `<table class="table table-sm"><thead><tr><th>${__('product')}</th><th>${__('article_no')}</th><th>${__('quantity')}</th></tr></thead><tbody>${itemsHtml}</tbody></table>`,
            width: '800px',
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            confirmButtonText: __('update_order'),
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
                handleFormSubmit('api/transfer_orders_api.php?action=update_transfer', 'PUT', result.value, __('transfer_order_updated_successfully'));
            }
        });
    }

    async function handleFormSubmit(url, method, orderData, successMessage) {
        const data = await fetchData(url, method, orderData);
        if (data && data.success) {
            Swal.fire(__('success'), successMessage, 'success');
            ordersTable.ajax.reload();
        } else if (data) {
            Swal.fire(__('error'), data.message, 'error');
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

        initSelect2(destWarehouseSelect, __('select_destination_warehouse'));
        initSelect2WithBadges(sourceLocationSelect, __('select_source_location'), modal, quantityInput);
        initSelect2WithBadges(destLocationSelect, __('select_destination_location'), modal, quantityInput);
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
                return Swal.fire(__('incomplete_item'), __('please_fill_all_fields'), 'error');
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
                const option = new Option(`${inv.location_name} (${__('qty')}: ${inv.quantity})`, inv.location_id);
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
            tbody.append(`<tr><td colspan="6" class="text-center text-muted">${__('no_items_added_yet')}</td></tr>`);
        } else {
            items.forEach((item, index) => {
                tbody.append(`
                    <tr>
                        <td>${item.productName}</td>
                        <td>${item.productarticle_no || __('n_a')}</td>
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
            theme: 'bootstrap-5', placeholder: __('search_by_name_sku_article'), allowClear: true, dropdownParent: parent,
            templateResult: formatProductResult,
            templateSelection: (product) => product.text,
            matcher: customProductMatcher
        });
    }

    function formatProductResult(product) {
        if (!product.id) return product.text;
        const { stock, article_no, sku } = $(product.element).data();
        const stockBadge = `<span class="badge ${stock > 0 ? 'bg-success' : 'bg-danger'}">${__('stock')}: ${stock}</span>`;
        return $(`<div><div class="fw-bold">${sku} - ${product.text}</div><div class="text-muted small">${__('article_no')}: ${article_no || __('n_a')}</div></div>`).add(stockBadge);
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
        const quantity = parseInt(quantityInput.value, 10) || 0;
        let badge = '';
        if (available !== undefined) {
            const isSource = selector.is($('#swal_source_location_id'));
            const hasEnough = isSource ? available >= quantity : (available === null || available >= quantity);
            const badgeClass = hasEnough ? 'bg-success' : 'bg-danger';
            const label = isSource ? __('stock') : __('space');
            const message = isSource && !hasEnough ? __('not_enough_stock') : `${label}: ${available}`;
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
                        <h5>${__('add_items')}</h5>
                        <div class="mb-3"><label for="swal_destination_warehouse_id" class="form-label">${__('to_warehouse_destination')}</label><select class="form-select" id="swal_destination_warehouse_id"></select></div><hr>
                        <div class="mb-3"><label for="swal_product_id" class="form-label">${__('product')}</label><select class="form-select" id="swal_product_id"></select></div>
                        <fieldset id="swal_detailsFieldset" disabled>
                            <div class="mb-3"><label for="swal_quantity" class="form-label">${__('quantity')}</label><input type="number" class="form-control" id="swal_quantity" min="1"></div>
                            <div class="mb-3"><label for="swal_source_location_id" class="form-label">${__('from_location_source')}</label><select class="form-select" id="swal_source_location_id"></select></div>
                            <div class="mb-3"><label for="swal_destination_location_id" class="form-label">${__('to_location_destination')}</label><select class="form-select" id="swal_destination_location_id"></select></div>
                            <div class="text-end"><button type="button" class="btn btn-success" id="swal_addItemBtn"><i class="bi bi-plus-circle"></i> ${__('add_item')}</button></div>
                        </fieldset>
                    </div>
                    <div class="col-lg-7">
                        <h5>${__('review_transfer')}</h5>
                        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                            <table class="table table-sm">
                                <thead><tr><th>${__('product')}</th><th>${__('article_no')}</th><th>${__('from')}</th><th>${__('to')}</th><th class="text-end">${__('qty')}</th><th></th></tr></thead>
                                <tbody id="swal_transferItemsTbody"></tbody>
                            </table>
                        </div>
                        <hr>
                        <div class="mt-3"><label for="swal_notes" class="form-label">${__('notes_optional')}</label><textarea class="form-control" id="swal_notes" rows="2"></textarea></div>
                    </div>
                </div>
            </div>`;
    }

    // --- Start ---
    initializePage();
});
