// public/js/outbound.js
/*
* MODIFICATION SUMMARY:
* 1. Added full translation support using the `__()` function.
* 2. `handleShowCreateOrderModal` & `handleShowEditOrderModal`:
* - Added a new 'Delivery Address' select dropdown.
* - This dropdown is populated via an API call when a customer is selected.
* - The address dropdown is disabled until a customer is chosen.
* - Made the address selection mandatory for creating/updating customer orders.
* 3. `loadOutboundOrders`:
* - Updated the table columns to include the new 'Delivery Address' field from the API.
* 4. API Payloads:
* - The payloads for creating and updating orders now include the selected `customer_address_id`.
* 5. Customer Dropdown (Select2):
* - Now displays the Customer Code in a right-aligned primary badge instead of the Customer ID.
* - The matcher function has been updated to allow searching by Customer Code.
* 6. Address Dropdown (Select2):
* - Is now a Select2 dropdown.
* - The default address is highlighted with a success badge.
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const selectedOrderNumberDisplay = document.getElementById('selectedOrderNumberDisplay');
    const trackingNumberDisplay = document.getElementById('trackingNumberDisplay');
    const proofOfDeliveryDisplay = document.getElementById('proofOfDeliveryDisplay');
    const orderProcessingArea = document.getElementById('orderProcessingArea');
    const currentOrderIdInput = document.getElementById('currentOrderId');
    const orderItemsTableBody = document.getElementById('orderItemsTableBody');
    const shippingAreaDisplay = document.getElementById('shippingAreaDisplay'); 
    const shipOrderBtn = document.getElementById('shipOrderBtn');
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    const addItemContainer = document.getElementById('addItemContainer');
    const managementActionsArea = document.getElementById('managementActionsArea');
    const statusFilter = document.getElementById('statusFilter');
    const showCreateOrderModalBtn = document.getElementById('showCreateOrderModalBtn');
    const printPickReportBtn = document.getElementById('printPickReportBtn');
    const editOrderBtn = document.getElementById('editOrderBtn');
    const assignedDriverDisplay = document.getElementById('assignedDriverDisplay');
    const printDeliveryReportBtn = document.getElementById('printDeliveryReportBtn');
    
    // --- State Variables ---
    let selectedOrderId = null;
    let selectedOrderDetails = null;
    let allProducts = [];
    let allCustomers = [];
    let ordersTable = null;

    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    initializePage();

    // --- Event Listeners ---
    if (showCreateOrderModalBtn) showCreateOrderModalBtn.addEventListener('click', handleShowCreateOrderModal);
    if (editOrderBtn) editOrderBtn.addEventListener('click', handleShowEditOrderModal);
    if (shipOrderBtn) shipOrderBtn.addEventListener('click', handleShipOrder);
    if (cancelOrderBtn) cancelOrderBtn.addEventListener('click', handleCancelOrder);
    if (statusFilter) statusFilter.addEventListener('change', filterOrdersByStatus);
    if (printPickReportBtn) printPickReportBtn.addEventListener('click', handlePrintPickReport);
    if (printDeliveryReportBtn) printDeliveryReportBtn.addEventListener('click', handlePrintDeliveryReport);


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
        const canManageOutbound = ['operator', 'manager'].includes(currentWarehouseRole);
        if (!canManageOutbound) {
            $('button').prop('disabled', true);
            showMessageBox(__('view_only_permissions'), 'info');
        }

        initializeOrdersDataTable();
        
        try {
            await Promise.all([ 
                loadCustomersForDropdown(), 
                loadProductsForDropdown(), 
                loadOutboundOrders()
            ]);
        } catch (error) {
            Swal.fire(__('initialization_error'), `${__('could_not_load_initial_data')}. ${error.message}`, 'error');
        }
    }

    function initializeOrdersDataTable() {
        ordersTable = $('#outboundOrdersTable').DataTable({
            responsive: true,
            "order": [[ 0, "desc" ]],
            "columnDefs": [
                { "targets": "_all", "className": "align-middle" }, 
                { "targets": 7, "className": "text-end align-middle" } 
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
        $('#outboundOrdersTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadCustomersForDropdown() {
        const response = await fetchData('api/customers_api.php');
        if (response?.success && Array.isArray(response.data)) allCustomers = response.data;
    }

    async function loadProductsForDropdown() {
        const response = await fetchData('api/products_api.php'); 
        if (response?.success && Array.isArray(response.data)) allProducts = response.data;
    }

    async function loadOutboundOrders() {
        const response = await fetchData('api/outbound_api.php');
        const canManageOutbound = ['operator', 'manager'].includes(currentWarehouseRole);
        
        const tableData = response.data.map(order => {
            let actionButtons = `<button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-outline-secondary view-details-btn" title="${__('details')}"><i class="bi bi-eye"></i></button>`;
            
            const isProcessable = !['Shipped', 'Delivered', 'Cancelled', 'Returned', 'Partially Returned', 'Scrapped'].includes(order.status) || order.status === 'Delivery Failed';
            if (isProcessable && canManageOutbound) {
                actionButtons += ` <button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-primary select-order-btn ms-1" title="${__('process')}"><i class="bi bi-gear"></i></button>`;
            }

            return [ 
                order.order_number || __('n_a'), 
                order.reference_number || __('n_a'),
                order.customer_name || __('n_a'),
                order.delivery_address || __('n_a'),
                order.assigned_to || __('n_a'),
                order.required_ship_date, 
                order.status, 
                actionButtons 
            ];
        });

        ordersTable.clear();
        ordersTable.rows.add(tableData).draw();
        ordersTable.rows().every(function() {
            const row = this.node();
            const status = this.data()[6];
            const statusKey = status.toLowerCase().replace(/\s+/g, '_');
            const statusMap = { 'delivered': 'bg-success', 'out_for_delivery': 'bg-primary', 'shipped': 'bg-info', 'assigned': 'bg-orange', 'ready_for_pickup': 'bg-purple', 'picked': 'bg-primary', 'partially_picked': 'bg-warning text-dark', 'new': 'bg-secondary', 'pending_pick': 'bg-secondary', 'cancelled': 'bg-danger', 'scrapped': 'bg-dark', 'returned': 'bg-dark', 'partially_returned': 'bg-secondary', 'delivery_failed': 'bg-danger' };
            const statusClass = statusMap[statusKey] || 'bg-secondary';
            $(row).find('td').eq(6).html(`<span class="badge ${statusClass}">${__(statusKey, status)}</span>`); 
        });
    }

    function filterOrdersByStatus() {
        ordersTable.column(6).search(this.value ? '^' + this.value + '$' : '', true, false).draw();
    }

    async function handleShowCreateOrderModal() {
        Swal.fire({
            title: __('create_new_outbound_order'),
            html: `<div class="p-2 text-start">
                    <div class="mb-3">
                        <label class="form-label">${__('order_type')}</label>
                        <div class="form-check"><input class="form-check-input" type="radio" name="swal-order-type" id="swal-order-type-customer" value="Customer" checked><label class="form-check-label" for="swal-order-type-customer">${__('customer_order')}</label></div>
                        <div class="form-check"><input class="form-check-input" type="radio" name="swal-order-type" id="swal-order-type-scrap" value="Scrap"><label class="form-check-label" for="swal-order-type-scrap">${__('scrap_order')}</label></div>
                    </div>
                    <div id="swal-customer-fields">
                        <div class="mb-3"><label for="swal-customer" class="form-label">${__('customer')}</label><select id="swal-customer" class="form-select" style="width: 100%;"></select></div>
                        <div class="mb-3"><label for="swal-address" class="form-label">${__('delivery_address')}</label><select id="swal-address" class="form-select" style="width: 100%;" disabled></select></div>
                        <div class="mb-3"><label for="swal-ship-date" class="form-label">${__('required_ship_date')}</label><input type="text" id="swal-ship-date" class="form-control datepicker-input"></div>
                    </div>
                    <div class="mb-3"><label for="swal-reference-number" class="form-label">${__('reference_reason')}</label><input type="text" id="swal-reference-number" class="form-control" placeholder="${__('optional_reference_or_reason')}"></div>
                    <div class="mb-3"><label for="swal-delivery-note" class="form-label">${__('notes')}</label><textarea id="swal-delivery-note" class="form-control" rows="3" placeholder="${__('enter_special_instructions')}"></textarea></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: __('create_order'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            didOpen: () => {
                initializeDatepicker(document.getElementById('swal-ship-date'), Swal.getPopup());
                
                const customerFields = document.getElementById('swal-customer-fields');
                document.querySelectorAll('input[name="swal-order-type"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        customerFields.style.display = e.target.value === 'Customer' ? 'block' : 'none';
                    });
                });

                const $customerSelect = $('#swal-customer');
                const $addressSelect = $('#swal-address');

                $customerSelect.select2({
                    placeholder: __('search_by_customer_name_or_code'),
                    theme: 'bootstrap-5',
                    dropdownParent: Swal.getPopup(),
                    data: allCustomers.map(c => ({ id: c.customer_id, text: c.customer_name, code: c.customer_code })),
                    templateResult: (data) => {
                        if (!data.id) { return data.text; }
                        return $(`<div>${data.text}<span class="badge bg-primary float-end">${__('code')}: ${data.code || __('n_a')}</span></div>`);
                    },
                    templateSelection: (data) => {
                        if (!data.id) { return data.text; }
                         return $(`<span>${data.text} <span class="badge bg-primary">${__('code')}: ${data.code || __('n_a')}</span></span>`);
                    },
                    escapeMarkup: m => m,
                    matcher: (params, data) => {
                        if ($.trim(params.term) === '') { return data; }
                        if (typeof data.text === 'undefined' || !data.id) { return null; }
                        const term = params.term.toUpperCase();
                        const textToSearch = `${data.text} ${data.code}`.toUpperCase();
                        if (textToSearch.indexOf(term) > -1) {
                            return data;
                        }
                        return null;
                    }
                }).on('select2:select', async (e) => {
                    const customerId = e.params.data.id;
                    $addressSelect.prop('disabled', true).html(`<option>${__('loading')}...</option>`).trigger('change');
                    const response = await fetchData(`api/customers_api.php?action=get_addresses&customer_id=${customerId}`);
                    if (response.success && response.data.length > 0) {
                        const addressData = response.data.map(addr => {
                            const addressText = [addr.address_line1, addr.city, addr.country].filter(Boolean).join(', ');
                            return {
                                id: addr.address_id,
                                text: addressText,
                                is_default: addr.is_default == 1
                            };
                        });
                        $addressSelect.empty().select2({
                            placeholder: __('select_an_address'),
                            theme: 'bootstrap-5',
                            dropdownParent: Swal.getPopup(),
                            data: addressData,
                            templateResult: (data) => {
                                if (!data.id) { return data.text; }
                                const defaultBadge = data.is_default ? `<span class="badge bg-success float-end">${__('default_address')}</span>` : '';
                                return $(`<div>${data.text}${defaultBadge}</div>`);
                            },
                            templateSelection: (data) => data.text,
                            escapeMarkup: m => m
                        }).prop('disabled', false);
                        
                        const defaultAddress = addressData.find(a => a.is_default);
                        if (defaultAddress) {
                            $addressSelect.val(defaultAddress.id).trigger('change');
                        }

                    } else {
                        $addressSelect.empty().select2({
                            placeholder: __('no_addresses_found'),
                            theme: 'bootstrap-5',
                            dropdownParent: Swal.getPopup()
                        });
                    }
                });

                $customerSelect.val(null).trigger('change');
                $addressSelect.select2({
                    placeholder: __('select_a_customer_first'),
                    theme: 'bootstrap-5',
                    dropdownParent: Swal.getPopup()
                });
            },
            preConfirm: () => {
                const orderType = document.querySelector('input[name="swal-order-type"]:checked').value;
                const customerId = document.getElementById('swal-customer').value;
                const addressId = document.getElementById('swal-address').value;
                const requiredShipDate = document.getElementById('swal-ship-date').value;
                
                if (orderType === 'Customer') {
                    if (!customerId) { Swal.showValidationMessage(__('please_select_a_customer')); return false; }
                    if (!addressId || isNaN(parseInt(addressId))) { Swal.showValidationMessage(__('customer_address_required')); return false; }
                    if (!requiredShipDate) { Swal.showValidationMessage(__('please_select_a_required_ship_date')); return false; }
                }
                
                return { 
                    order_type: orderType,
                    customer_id: orderType === 'Customer' ? customerId : null, 
                    customer_address_id: orderType === 'Customer' ? addressId : null,
                    required_ship_date: orderType === 'Customer' ? requiredShipDate : null, 
                    delivery_note: document.getElementById('swal-delivery-note').value, 
                    reference_number: document.getElementById('swal-reference-number').value 
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const apiResult = await fetchData('api/outbound_api.php?action=createOrder', 'POST', result.value);
                if (apiResult?.success) {
                    showMessageBox(apiResult.message, 'success');
                    await loadOutboundOrders();
                }
            }
        });
    }

    async function loadOrderItems(orderId) {
        if (!orderItemsTableBody) return;
        
        shipOrderBtn.classList.add('d-none');
        printPickReportBtn.classList.add('d-none');
        if(printDeliveryReportBtn) printDeliveryReportBtn.classList.add('d-none');
        if (editOrderBtn) editOrderBtn.classList.add('d-none');
        orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">${__('loading_items')}...</td></tr>`;
        trackingNumberDisplay.innerHTML = '';
        if(shippingAreaDisplay) shippingAreaDisplay.innerHTML = '';
        if(proofOfDeliveryDisplay) proofOfDeliveryDisplay.innerHTML = '';
        if(assignedDriverDisplay) assignedDriverDisplay.innerHTML = '';

        try {
            const response = await fetchData(`api/outbound_api.php?order_id=${orderId}`);
            orderItemsTableBody.innerHTML = '';

            if (response?.success && response.data) {
                selectedOrderDetails = response.data;
                const order = response.data;
                const canManage = ['operator', 'manager'].includes(currentWarehouseRole);
                
                const isEditable = ['New', 'Pending Pick', 'Partially Picked'].includes(order.status);
                const isCancellable = !['Delivered', 'Cancelled', 'Returned', 'Partially Returned', 'Scrapped'].includes(order.status);

                managementActionsArea.style.display = (canManage) ? 'block' : 'none';
                cancelOrderBtn.style.display = (canManage && isCancellable) ? 'inline-block' : 'none';
                
                if (editOrderBtn) {
                    editOrderBtn.style.display = (canManage && isEditable && order.order_type !== 'Scrap') ? 'inline-block' : 'none';
                }

                if (['Delivered', 'Partially Returned', 'Returned', 'Cancelled', 'Scrapped'].includes(order.status) && printDeliveryReportBtn) {
                    printDeliveryReportBtn.classList.remove('d-none');
                }

                const canCreateReturn = ['Shipped', 'Delivered', 'Partially Returned'].includes(order.status);
                let createReturnBtn = document.getElementById('createReturnBtn');
                
                if (canManage && canCreateReturn) {
                    if (!createReturnBtn) {
                        createReturnBtn = document.createElement('button');
                        createReturnBtn.id = 'createReturnBtn';
                        createReturnBtn.className = 'btn btn-warning ms-2';
                        createReturnBtn.innerHTML = `<i class="bi bi-arrow-return-left me-1"></i> ${__('create_return')}`;
                        createReturnBtn.addEventListener('click', handleShowCreateReturnModal);
                        if (cancelOrderBtn) {
                            cancelOrderBtn.parentNode.insertBefore(createReturnBtn, cancelOrderBtn.nextSibling);
                        } else {
                            managementActionsArea.appendChild(createReturnBtn);
                        }
                    }
                    createReturnBtn.style.display = 'inline-block';
                } else {
                    if (createReturnBtn) {
                        createReturnBtn.style.display = 'none';
                    }
                }

                const hasAssociatedReturn = order.status === 'Partially Returned';
                let processReturnBtn = document.getElementById('processReturnBtn');

                if (canManage && hasAssociatedReturn) {
                    if (!processReturnBtn) {
                        processReturnBtn = document.createElement('button');
                        processReturnBtn.id = 'processReturnBtn';
                        processReturnBtn.className = 'btn btn-info ms-2';
                        processReturnBtn.innerHTML = `<i class="bi bi-box-arrow-in-down me-1"></i> ${__('go_to_return')}`;
                        processReturnBtn.addEventListener('click', () => {
                            window.location.href = 'returns.php';
                        });
                        const anchorNode = document.getElementById('createReturnBtn') || document.getElementById('cancelOrderBtn');
                        if (anchorNode) {
                            anchorNode.parentNode.insertBefore(processReturnBtn, anchorNode.nextSibling);
                        } else {
                            managementActionsArea.appendChild(processReturnBtn);
                        }
                    }
                    processReturnBtn.style.display = 'inline-block';
                } else {
                    if (processReturnBtn) {
                        processReturnBtn.style.display = 'none';
                    }
                }

                if (['Picked', 'Ready for Pickup', 'Assigned'].includes(order.status) && canManage) {
                    shipOrderBtn.classList.remove('d-none');
                }
                
                const canPrintPickReport = !['Returned', 'Partially Returned', 'Cancelled', 'Delivered', 'Shipped', 'Scrapped'].includes(order.status);
                if (order.items.length > 0 && canPrintPickReport) {
                    printPickReportBtn.classList.remove('d-none');
                } else {
                    printPickReportBtn.classList.add('d-none');
                }

                const canShowStaging = !['Delivered', 'Cancelled', 'Returned', 'Partially Returned', 'Scrapped'].includes(order.status);
                if (canShowStaging && order.shipping_area_code && shippingAreaDisplay) {
                    shippingAreaDisplay.innerHTML = `<strong>${__('staged_at')}:</strong> <span class="badge bg-purple">${order.shipping_area_code}</span>`;
                }

                if (order.tracking_number) {
                    trackingNumberDisplay.innerHTML = `<strong>${__('tracking_no')}:</strong> <span id="trackingNumberText">${order.tracking_number}</span> <button id="copyTrackingBtn" class="btn btn-sm btn-outline-secondary ms-2" title="${__('copy_tracking_number')}"><i class="bi bi-clipboard"></i></button>`;
                    document.getElementById('copyTrackingBtn').addEventListener('click', () => copyToClipboard(order.tracking_number));
                }
                
                if (order.status === 'Delivered' && order.delivery_photo_path) {
                    proofOfDeliveryDisplay.innerHTML = `<strong>${__('proof_of_delivery')}:</strong> <a href="${order.delivery_photo_path}" target="_blank" class="btn btn-sm btn-outline-info ms-2"><i class="bi bi-camera-fill me-1"></i> ${__('view_photo')}</a>`;
                }
                
                if (assignedDriverDisplay && order.assignments && order.assignments.length > 0) {
                    const assignmentHtml = order.assignments.map(a => {
                        let text = '';
                        if (a.assignment_type === 'in_house') {
                            text = `<div class="mb-2"><span class="badge bg-info text-dark">${__('in_house')}: ${a.driver_name}</span></div>`;
                        } else {
                            text = `<div class="border rounded p-2 mb-2">
                                        <div class="fw-bold">${a.third_party_driver_name} <span class="badge bg-secondary">${a.company_name}</span></div>
                                        <small class="text-muted d-block">${__('mobile')}: ${a.third_party_driver_mobile || __('n_a')}</small>
                                        <small class="text-muted d-block">${__('waybill_no')}: ${a.waybill_number || __('n_a')}</small>
                                        <div>
                                            ${a.third_party_driver_id_path ? `<a href="${a.third_party_driver_id_path}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1">${__('view_id')}</a>` : ''}
                                            ${a.third_party_driver_license_path ? `<a href="${a.third_party_driver_license_path}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1">${__('view_license')}</a>` : ''}
                                        </div>
                                    </div>`;
                        }
                        return text;
                    }).join('');
                    assignedDriverDisplay.innerHTML = `<h6>${__('assigned_to')}:</h6>${assignmentHtml}`;
                }


                if (addItemContainer) {
                    addItemContainer.innerHTML = '';
                    if (canManage && isEditable) {
                        addItemContainer.innerHTML = `
                            <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                <button id="showAddItemModalBtn" class="btn btn-outline-primary"><i class="bi bi-plus-circle me-2"></i>${__('add_single_item')}</button>
                                <button id="showBulkAddModalBtn" class="btn btn-outline-success"><i class="bi bi-file-earmark-excel me-2"></i>${__('bulk_add_items')}</button>
                            </div>
                        `;
                        document.getElementById('showAddItemModalBtn').addEventListener('click', handleShowAddItemModal);
                        document.getElementById('showBulkAddModalBtn').addEventListener('click', handleShowBulkAddModal);
                    }
                }
                
                if (order.items.length === 0) {
                    orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">${__('no_items_added_to_order')}</td></tr>`;
                    return;
                }

                order.items.forEach(item => {
                    const isFullyPicked = item.picked_quantity >= item.ordered_quantity;
                    const itemRow = orderItemsTableBody.insertRow();
                    itemRow.className = 'fw-bold';
                    if (isFullyPicked && item.ordered_quantity > 0) itemRow.classList.add('table-success');
                    
                    let itemActionButtons = '';
                    if (canManage && isEditable) {
                         const isDisabled = item.picked_quantity > 0 ? 'disabled' : '';
                         itemActionButtons = `<button class="btn btn-sm btn-outline-primary edit-item-btn" title="${__('edit_ordered_quantity')}" data-item-id="${item.outbound_item_id}" data-ordered-qty="${item.ordered_quantity}" ${isDisabled}><i class="bi bi-pencil-square"></i></button> <button class="btn btn-sm btn-outline-danger delete-item-btn" title="${__('delete_ordered_item')}" data-item-id="${item.outbound_item_id}" ${isDisabled}><i class="bi bi-trash"></i></button>`;
                    }
                    
                    itemRow.innerHTML = `<td>${item.sku}</td><td>${item.product_name}</td><td>${item.article_no}</td><td>${item.ordered_quantity}</td><td>${item.picked_quantity}</td><td colspan="3"></td><td class="text-center">${itemActionButtons}</td>`;

                    if (item.picks && Array.isArray(item.picks)) {
                        item.picks.forEach(pick => {
                            const pickRow = orderItemsTableBody.insertRow();
                            pickRow.className = 'pick-row';
                            pickRow.innerHTML = `<td colspan="5" class="text-end border-end-0 fst-italic text-muted">${__('picked')}: ${pick.picked_quantity}</td><td class="border-start-0">${pick.batch_number || __('n_a')}</td><td>${pick.dot_code || __('n_a')}</td><td>${pick.location_code}</td><td class="text-center"></td>`;
                        });
                    }
                });
                addOrderItemActionListeners(orderId);
            }
        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_load_order_items')}: ${error.message}`, 'error');
        }
    }

    function addTableButtonListeners() {
        $('#outboundOrdersTable tbody').off('click').on('click', '.select-order-btn, .view-details-btn', function() {
            const btn = this;
            const orderId = btn.dataset.orderId;
            const orderNumber = btn.dataset.orderNumber || btn.closest('tr').cells[0].textContent;
            selectedOrderId = orderId;
            currentOrderIdInput.value = selectedOrderId;
            selectedOrderNumberDisplay.textContent = `#${orderNumber}`;
            if(orderProcessingArea) orderProcessingArea.classList.remove('d-none');
            loadOrderItems(selectedOrderId);
            if(btn.classList.contains('select-order-btn')) showMessageBox(`${__('selected_order')}: ${orderNumber}`, 'info');
        });
    }

    async function handleShowEditOrderModal() {
        if (!selectedOrderDetails) {
            showMessageBox(__('order_details_not_loaded'), 'error');
            return;
        }

        Swal.fire({
            title: `${__('edit_order')} #${selectedOrderDetails.order_number}`,
            html: `<div class="p-2 text-start">
                    <div class="mb-3"><label for="swal-customer" class="form-label">${__('customer')}</label><select id="swal-customer" class="form-select" style="width:100%"></select></div>
                    <div class="mb-3"><label for="swal-address" class="form-label">${__('delivery_address')}</label><select id="swal-address" class="form-select" style="width:100%"></select></div>
                    <div class="mb-3"><label for="swal-reference-number" class="form-label">${__('reference_no')}</label><input type="text" id="swal-reference-number" class="form-control" value="${selectedOrderDetails.reference_number || ''}"></div>
                    <div class="mb-3"><label for="swal-ship-date" class="form-label">${__('required_ship_date')}</label><input type="text" id="swal-ship-date" class="form-control datepicker-input" value="${selectedOrderDetails.required_ship_date || ''}"></div>
                    <div class="mb-3"><label for="swal-delivery-note" class="form-label">${__('delivery_note')}</label><textarea id="swal-delivery-note" class="form-control" rows="3">${selectedOrderDetails.delivery_note || ''}</textarea></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: __('save_changes'),
            allowOutsideClick: false,
            didOpen: async () => {
                initializeDatepicker(document.getElementById('swal-ship-date'), Swal.getPopup());
                const $customerSelect = $('#swal-customer');
                const $addressSelect = $('#swal-address');

                $customerSelect.select2({
                    placeholder: __('search_by_customer_name_or_code'),
                    theme: 'bootstrap-5',
                    dropdownParent: Swal.getPopup(),
                    data: allCustomers.map(c => ({ id: c.customer_id, text: c.customer_name, code: c.customer_code })),
                    templateResult: (data) => {
                        if (!data.id) { return data.text; }
                        return $(`<div>${data.text}<span class="badge bg-primary float-end">${__('code')}: ${data.code || __('n_a')}</span></div>`);
                    },
                    templateSelection: (data) => {
                        if (!data.id) { return data.text; }
                         return $(`<span>${data.text} <span class="badge bg-primary">${__('code')}: ${data.code || __('n_a')}</span></span>`);
                    },
                    escapeMarkup: m => m,
                    matcher: (params, data) => {
                        if ($.trim(params.term) === '') { return data; }
                        if (typeof data.text === 'undefined' || !data.id) { return null; }
                        const term = params.term.toUpperCase();
                        const textToSearch = `${data.text} ${data.code}`.toUpperCase();
                        if (textToSearch.indexOf(term) > -1) {
                            return data;
                        }
                        return null;
                    }
                }).val(selectedOrderDetails.customer_id).trigger('change');

                const response = await fetchData(`api/customers_api.php?action=get_addresses&customer_id=${selectedOrderDetails.customer_id}`);
                if (response.success && response.data.length > 0) {
                    const addressData = response.data.map(addr => ({
                        id: addr.address_id,
                        text: [addr.address_line1, addr.city, addr.country].filter(Boolean).join(', '),
                        is_default: addr.is_default == 1
                    }));

                    $addressSelect.empty().select2({
                        placeholder: __('select_an_address'),
                        theme: 'bootstrap-5',
                        dropdownParent: Swal.getPopup(),
                        data: addressData,
                        templateResult: (data) => {
                            if (!data.id) { return data.text; }
                            const defaultBadge = data.is_default ? `<span class="badge bg-success float-end">${__('default_address')}</span>` : '';
                            return $(`<div>${data.text}${defaultBadge}</div>`);
                        },
                        templateSelection: (data) => data.text,
                        escapeMarkup: m => m
                    }).val(selectedOrderDetails.customer_address_id).trigger('change');
                }

                $customerSelect.on('select2:select', async (e) => {
                    const customerId = e.params.data.id;
                    $addressSelect.prop('disabled', true).html(`<option>${__('loading')}...</option>`).trigger('change');
                    const response = await fetchData(`api/customers_api.php?action=get_addresses&customer_id=${customerId}`);
                    if (response.success && response.data.length > 0) {
                        const addressData = response.data.map(addr => ({
                            id: addr.address_id,
                            text: [addr.address_line1, addr.city, addr.country].filter(Boolean).join(', '),
                            is_default: addr.is_default == 1
                        }));
                        $addressSelect.empty().select2({
                            placeholder: __('select_an_address'),
                            theme: 'bootstrap-5',
                            dropdownParent: Swal.getPopup(),
                            data: addressData,
                            templateResult: (data) => {
                                if (!data.id) { return data.text; }
                                const defaultBadge = data.is_default ? `<span class="badge bg-success float-end">${__('default_address')}</span>` : '';
                                return $(`<div>${data.text}${defaultBadge}</div>`);
                            },
                            templateSelection: (data) => data.text,
                            escapeMarkup: m => m
                        }).prop('disabled', false);

                        const defaultAddress = addressData.find(a => a.is_default);
                        if (defaultAddress) {
                            $addressSelect.val(defaultAddress.id).trigger('change');
                        }
                    } else {
                         $addressSelect.empty().select2({
                            placeholder: __('no_addresses_found'),
                            theme: 'bootstrap-5',
                            dropdownParent: Swal.getPopup()
                        });
                    }
                });
            },
            preConfirm: () => {
                const customerId = document.getElementById('swal-customer').value;
                const addressId = document.getElementById('swal-address').value;
                const requiredShipDate = document.getElementById('swal-ship-date').value;
                if (!customerId) { Swal.showValidationMessage(__('please_select_a_customer')); return false; }
                if (!addressId || isNaN(parseInt(addressId))) { Swal.showValidationMessage(__('customer_address_required')); return false; }
                if (!requiredShipDate) { Swal.showValidationMessage(__('please_select_a_required_ship_date')); return false; }
                return {
                    order_id: selectedOrderId,
                    customer_id: customerId,
                    customer_address_id: addressId,
                    required_ship_date: requiredShipDate,
                    delivery_note: document.getElementById('swal-delivery-note').value,
                    reference_number: document.getElementById('swal-reference-number').value
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const apiResult = await fetchData('api/outbound_api.php?action=updateOrder', 'POST', result.value);
                if (apiResult?.success) {
                    showMessageBox(apiResult.message, 'success');
                    await loadOutboundOrders();
                    await loadOrderItems(selectedOrderId);
                }
            }
        });
    }
    
    async function handleShipOrder() {
        if (!selectedOrderId) { showMessageBox(__('please_select_order_to_ship'), 'error'); return; }
        showConfirmationModal(
            __('confirm_shipment'), 
            __('are_you_sure_ship_order'), 
            async () => {
                const apiResult = await fetchData('api/outbound_api.php?action=shipOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    Swal.fire(__('shipped'), apiResult.message, 'success');
                    selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                    if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                    await loadOutboundOrders();
                }
            },
            { confirmButtonText: __('yes_ship_it') }
        );
    }

    async function handleCancelOrder() {
        if (!selectedOrderId) { showMessageBox(__('please_select_order_to_cancel'), 'error'); return; }
        showConfirmationModal(
            __('confirm_cancellation'), 
            __('are_you_sure_cancel_order'), 
            async () => {
                const apiResult = await fetchData('api/outbound_api.php?action=cancelOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    Swal.fire(__('cancelled'), __('order_cancelled_successfully'), 'success');
                    selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                    if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                    await loadOutboundOrders();
                }
            },
            { confirmButtonText: __('yes_cancel_it') }
        );
    }

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.edit-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); if (!btn.disabled) handleUpdateOrderItem(btn.dataset.itemId, btn.dataset.orderedQty, orderId); }));
        document.querySelectorAll('.delete-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); if (!btn.disabled) handleDeleteOrderItem(btn.dataset.itemId, orderId); }));
    }

    async function handleUpdateOrderItem(itemId, currentQty, orderId) {
        const { value: newQty } = await Swal.fire({ 
            title: __('update_item_quantity'), 
            input: 'number', 
            inputValue: currentQty, 
            inputLabel: __('new_ordered_quantity'), 
            allowOutsideClick: false, 
            confirmButtonText: __('update'),
            cancelButtonText: __('cancel'),
            inputAttributes: { min: 1, class: 'form-control numeric-only' }, 
            showCancelButton: true, 
            inputValidator: (value) => { if (!value || parseInt(value, 10) <= 0) return __('enter_valid_quantity_greater_than_zero'); } 
        });
        if (newQty) {
            const result = await fetchData('api/outbound_api.php?action=updateOrderItem', 'POST', { outbound_item_id: itemId, new_quantity: parseInt(newQty, 10) });
            if (result?.success) {
                showMessageBox(result.message, 'success');
                await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
            }
        }
    }

    async function handleDeleteOrderItem(itemId, orderId) {
        showConfirmationModal(
            __('confirm_deletion'), 
            __('are_you_sure_remove_item'), 
            async () => {
                const apiResult = await fetchData('api/outbound_api.php?action=deleteOrderItem', 'POST', { outbound_item_id: itemId });
                if (apiResult?.success) {
                    showMessageBox(apiResult.message, 'success');
                    await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
                }
            },
            { confirmButtonText: __('yes_delete_it') }
        );
    }

    async function handleShowAddItemModal() {
        if (!selectedOrderId) { showMessageBox(__('please_select_order_first'), 'error'); return; }
        
        Swal.fire({
            title: __('add_item_to_order'),
            html: `
                <div class="p-2 text-start">
                    <div class="mb-3">
                        <label for="modalProductSelect" class="form-label w-100">${__('product')}</label>
                        <select id="modalProductSelect" class="form-select w-100" style="width: 100%"></select>
                    </div>
                    <div class="mb-3">
                        <label for="modalQuantityInput" class="form-label w-100">${__('quantity')}</label>
                        <input type="number" id="modalQuantityInput" value="1" min="1" class="form-control numeric-only">
                        <div id="quantityError" class="text-danger small mt-1"></div>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: __('add_item'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            didOpen: () => {
                const $select = $('#modalProductSelect');
                const $quantityInput = $('#modalQuantityInput');
                const confirmButton = Swal.getConfirmButton();
                const quantityErrorDiv = document.getElementById('quantityError');

                const formatProduct = (product) => {
                    if (!product.id) return product.text;
                    const stock = parseInt($(product.element).data('stock'), 10);
                    const article_no = $(product.element).data('article_no');
                    const is_active = $(product.element).data('is_active') == 1;

                    let badgeClass = 'bg-success';
                    if (stock <= 0 || !is_active) {
                        badgeClass = 'bg-danger';
                    }
                    
                    const stockBadge = `<span class="badge ${badgeClass} float-end">${__('stock')}: ${stock}</span>`;
                    const inactiveText = !is_active ? ` <span class="text-danger fw-bold">(${__('inactive')})</span>` : '';

                    return $(`<div>${product.text}${inactiveText}<br><small class="text-muted">${__('article_no')}: ${article_no}</small>${stockBadge}</div>`);
                };

                $select.html('<option value=""></option>');
                if (allProducts.length > 0) {
                    allProducts.forEach(product => {
                        const optionText = `${product.sku} - ${product.product_name}`;
                        const newOption = new Option(optionText, product.article_no, false, false);
                        newOption.dataset.stock = product.total_quantity;
                        newOption.dataset.article_no = product.article_no;
                        newOption.dataset.is_active = product.is_active;
                        
                        if (parseInt(product.total_quantity, 10) <= 0 || product.is_active != 1) {
                            newOption.disabled = true;
                        }
                        $select.append(newOption);
                    });
                }

                $select.select2({
                    placeholder: __('search_by_name_sku_article'),
                    theme: 'bootstrap-5',
                    dropdownParent: $('.swal2-container'),
                    templateResult: formatProduct,
                    templateSelection: (data) => {
                        if (!data.id) { return data.text; }
                        const product = allProducts.find(p => p.article_no === data.id);
                        return product ? `${product.sku} - ${product.product_name}` : data.text;
                    },
                    escapeMarkup: m => m,
                    matcher: (params, data) => {
                        if ($.trim(params.term) === '') return data;
                        if (typeof data.text === 'undefined') return null;
                        
                        const term = params.term.toUpperCase();
                        const product = allProducts.find(p => p.article_no === data.id);
                        if (!product) return null;

                        const textToSearch = `${product.sku} ${product.product_name} ${product.article_no}`.toUpperCase();
                        if (textToSearch.indexOf(term) > -1) {
                            return data;
                        }
                        return null;
                    }
                });

                const validateStock = () => {
                    const selectedOption = $select.find('option:selected');
                    const availableStock = parseInt(selectedOption.data('stock'), 10);
                    const requestedQty = parseInt($quantityInput.val(), 10);

                    if (selectedOption.val() && !isNaN(availableStock) && !isNaN(requestedQty)) {
                        if (requestedQty > availableStock) {
                            quantityErrorDiv.textContent = `${__('only')} ${availableStock} ${__('available_in_stock')}.`;
                            $quantityInput.addClass('is-invalid');
                            confirmButton.disabled = true;
                        } else {
                            quantityErrorDiv.textContent = '';
                            $quantityInput.removeClass('is-invalid');
                            confirmButton.disabled = false;
                        }
                    } else {
                         confirmButton.disabled = !selectedOption.val();
                    }
                };

                $select.on('change', validateStock);
                $quantityInput.on('input', validateStock);
                
                validateStock(); 
            },
            preConfirm: () => {
                const productarticle_no = $('#modalProductSelect').val();
                const quantity = $('#modalQuantityInput').val();
                const orderedQuantity = parseInt(quantity, 10);
                const selectedOption = $('#modalProductSelect').find('option:selected');
                const availableStock = parseInt(selectedOption.data('stock'), 10);

                if (!productarticle_no) {
                    Swal.showValidationMessage(__('you_must_select_a_product'));
                    return false;
                }
                if (isNaN(orderedQuantity) || orderedQuantity <= 0) {
                    Swal.showValidationMessage(__('enter_valid_quantity_greater_than_zero'));
                    return false;
                }
                if (orderedQuantity > availableStock) {
                    Swal.showValidationMessage(`${__('quantity_cannot_exceed_stock')} ${availableStock}.`);
                    return false;
                }
                return { product_article_no: productarticle_no, ordered_quantity: orderedQuantity };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const data = { order_id: selectedOrderId, ...result.value };
                const apiResult = await fetchData('api/outbound_api.php?action=addItem', 'POST', data);
                if (apiResult?.success) {
                    showMessageBox(__('item_added_successfully'), 'success');
                    await loadOrderItems(selectedOrderId);
                    await loadOutboundOrders();
                    await loadProductsForDropdown();
                }
            }
        });
    }

    function handleDownloadTemplate() {
        const templateData = [
            { "Article No": "1234567", "Quantity": 10 },
            { "Article No": "1234568", "Quantity": 5 }
        ];
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
        XLSX.writeFile(workbook, "bulk_upload_template.xlsx");
    }

    function handleShowBulkAddModal() {
        if (!selectedOrderId) {
            showMessageBox(__('please_select_order_first'), 'error');
            return;
        }

        Swal.fire({
            title: __('bulk_add_items_from_excel'),
            html: `
                <div class="text-start p-2">
                    <p class="text-muted">${__('bulk_upload_instructions')}</p>
                    <a href="#" id="download-template-btn" class="btn btn-sm btn-link mb-2"><i class="bi bi-download me-1"></i>${__('download_template')}</a>
                    <input type="file" id="bulk-upload-file" class="form-control" accept=".xlsx, .xls">
                    <div id="bulk-upload-error" class="text-danger small mt-2"></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: __('upload_and_process'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            didOpen: () => {
                document.getElementById('download-template-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    handleDownloadTemplate();
                });

                const fileInput = document.getElementById('bulk-upload-file');
                const errorDiv = document.getElementById('bulk-upload-error');
                const confirmButton = Swal.getConfirmButton();

                fileInput.addEventListener('change', () => {
                    const file = fileInput.files[0];
                    if (file) {
                        const fileName = file.name;
                        const allowedExtensions = /(\.xlsx|\.xls)$/i;
                        if (!allowedExtensions.exec(fileName)) {
                            errorDiv.textContent = __('invalid_file_type_excel');
                            fileInput.value = '';
                            confirmButton.disabled = true;
                        } else {
                            errorDiv.textContent = '';
                            confirmButton.disabled = false;
                        }
                    } else {
                         confirmButton.disabled = false;
                    }
                });
            },
            preConfirm: () => {
                const fileInput = document.getElementById('bulk-upload-file');
                const file = fileInput.files[0];
                const errorDiv = document.getElementById('bulk-upload-error');
                errorDiv.textContent = '';

                if (!file) {
                    errorDiv.textContent = __('please_select_file_to_upload');
                    return false;
                }

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const firstSheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[firstSheetName];
                            const json = XLSX.utils.sheet_to_json(worksheet);

                            if (json.length === 0) {
                                errorDiv.textContent = __('excel_file_empty_or_invalid');
                                return reject();
                            }

                            const firstRow = json[0];
                            if (!firstRow.hasOwnProperty('Article No') || !firstRow.hasOwnProperty('Quantity')) {
                                errorDiv.textContent = __('file_must_contain_article_no_quantity');
                                return reject();
                            }
                            
                            resolve(json);
                        } catch (err) {
                            errorDiv.textContent = __('error_reading_or_parsing_file');
                            reject();
                        }
                    };
                    reader.onerror = () => {
                        errorDiv.textContent = __('error_reading_file');
                        reject();
                    };
                    reader.readAsArrayBuffer(file);
                });
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const items = result.value;
                Swal.fire({
                    title: __('processing'),
                    text: `${__('processing')} ${items.length} ${__('items_please_wait')}`,
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                const apiResult = await fetchData('api/outbound_api.php?action=bulkAddItems', 'POST', { order_id: selectedOrderId, items: items });
                
                if (apiResult?.success) {
                    let resultHtml = `<div class="text-start">
                        <p class="lead">${apiResult.message}</p>
                        <p><strong>${__('successful')}:</strong> ${apiResult.data.success_count}</p>
                        <p><strong>${__('failed')}:</strong> ${apiResult.data.failed_count}</p>`;
                    
                    if (apiResult.data.failed_count > 0) {
                        resultHtml += `<h6>${__('skipped_items')}:</h6><ul class="list-group" style="max-height: 150px; overflow-y: auto;">`;
                        apiResult.data.failed_items.forEach(fail => {
                            resultHtml += `<li class="list-group-item"><strong>${fail.item}:</strong> ${fail.reason}</li>`;
                        });
                        resultHtml += `</ul>`;
                    }
                    resultHtml += `</div>`;

                    Swal.fire({
                        title: __('bulk_process_complete'),
                        html: resultHtml,
                        icon: apiResult.data.failed_count > 0 ? 'warning' : 'success',
                        allowOutsideClick: false,
                    });

                    await loadOrderItems(selectedOrderId);
                    await loadOutboundOrders();
                    await loadProductsForDropdown();
                }
            }
        });
    }

    async function handleShowCreateReturnModal() {
        if (!selectedOrderDetails || !selectedOrderDetails.items) {
            showMessageBox(__('order_items_not_loaded_or_empty'), 'error');
            return;
        }

        const itemsForReturn = selectedOrderDetails.items.filter(item => item.picked_quantity > 0);

        if (itemsForReturn.length === 0) {
            showMessageBox(__('no_items_shipped_for_order'), 'info');
            return;
        }

        let itemsHtml = `
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>${__('sku')}</th>
                        <th>${__('article_no')}</th>
                        <th>${__('product')}</th>
                        <th class="text-center">${__('shipped')}</th>
                        <th class="text-center">${__('returned')}</th>
                        <th class="text-center" style="width: 120px;">${__('return_qty')}</th>
                    </tr>
                </thead>
                <tbody>
        `;

        itemsForReturn.forEach(item => {
            const isFullyReturned = item.returnable_quantity <= 0;
            itemsHtml += `
                <tr data-outbound-item-id="${item.outbound_item_id}" data-returnable-qty="${item.returnable_quantity}" class="${isFullyReturned ? 'table-light text-muted' : ''}">
                    <td>${item.sku}</td>
                    <td>${item.article_no}</td>
                    <td>${item.product_name}</td>
                    <td class="text-center">${item.picked_quantity}</td>
                    <td class="text-center">${item.returned_quantity}</td>
                    <td>
                        <input 
                            type="number" 
                            class="form-control form-control-sm return-qty-input numeric-only" 
                            value="0" 
                            min="0" 
                            max="${item.returnable_quantity}"
                            ${isFullyReturned ? 'disabled' : ''}
                        >
                    </td>
                </tr>
            `;
        });

        itemsHtml += `</tbody></table>`;

        Swal.fire({
            title: __('create_partial_return'),
            html: `
                <div class="text-start p-2">
                    <div class="mb-3">
                        <label for="swal-return-reason" class="form-label">${__('reason_for_return')}</label>
                        <textarea id="swal-return-reason" class="form-control" rows="3" placeholder="${__('e_g_damaged_wrong_item')}"></textarea>
                    </div>
                    ${itemsHtml}
                </div>
            `,
            width: '900px',
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            confirmButtonText: __('initiate_return'),
            allowOutsideClick: false,
            preConfirm: () => {
                const reason = document.getElementById('swal-return-reason').value;
                if (!reason) {
                    Swal.showValidationMessage(__('please_provide_a_reason_for_return'));
                    return false;
                }

                const itemsToReturn = [];
                let validationError = false;
                document.querySelectorAll('.return-qty-input:not(:disabled)').forEach(input => {
                    const quantity = parseInt(input.value, 10);
                    if (quantity > 0) {
                        const row = input.closest('tr');
                        const outboundItemId = row.dataset.outboundItemId;
                        const maxQty = parseInt(row.dataset.returnableQty, 10);
                        if (quantity > maxQty) {
                             Swal.showValidationMessage(`${__('quantity_exceeds_returnable_amount')} ${maxQty}.`);
                             validationError = true;
                             return;
                        }
                        itemsToReturn.push({
                            outbound_item_id: outboundItemId,
                            quantity: quantity
                        });
                    }
                });

                if (validationError) return false;

                if (itemsToReturn.length === 0) {
                    Swal.showValidationMessage(__('please_enter_quantity_for_one_item'));
                    return false;
                }

                return {
                    order_id: selectedOrderId,
                    reason: reason,
                    items: itemsToReturn
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const apiResult = await fetchData('api/returns_api.php?action=create_return', 'POST', result.value);
                if (apiResult?.success) {
                    Swal.fire(__('success'), apiResult.message, 'success');
                    await loadOrderItems(selectedOrderId);
                    await loadOutboundOrders();
                }
            }
        });
    }

    async function handlePrintPickReport() {
        if (!selectedOrderId) {
            showMessageBox(__('no_order_is_selected'), 'error');
            return;
        }
    
        printPickReportBtn.disabled = true;
        printPickReportBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${__('printing')}...`;
    
        try {
            const response = await fetchData(`api/outbound_api.php?action=getPickReport&order_id=${selectedOrderId}`);
    
            if (!response?.success || !response.data) {
                Swal.fire(__('error'), response?.message || __('could_not_fetch_pick_report_data'), 'error');
                return;
            }
    
            const { order_details, items } = response.data;
            const itemsPerPage = 10;
            const totalPages = items.length > 0 ? Math.ceil(items.length / itemsPerPage) : 1;
            let allPagesHtml = '';
    
            for (let page = 0; page < totalPages; page++) {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageItems = items.slice(start, end);
    
                let itemsHtml = '';
                if (pageItems.length > 0) {
                    pageItems.forEach((item, index) => {
                        const globalIndex = start + index;
                        itemsHtml += `
                            <tr>
                                <td>${globalIndex + 1}</td>
                                <td>${item.product_name}</td>
                                <td>${item.sku}</td>
                                <td><div class="item-article_no-container" id="item-article_no-${globalIndex}"></div></td>
                                <td>${item.ordered_quantity}</td>
                                <td>${item.location_code || ''}</td>
                                <td>${item.batch_number || ''}</td>
                                <td>${item.dot_code || ''}</td>
                            </tr>
                        `;
                    });
                } else {
                    itemsHtml = `<tr><td colspan="8" class="text-center" style="height: 400px;">${__('no_items_on_this_order')}</td></tr>`;
                }
    
                allPagesHtml += `
                    <div class="page">
                        <div class="report-container">
                            <div class="header-section">
                                <div class="row align-items-center">
                                    <div class="col-4 text-center"><h4>${__('delivery_note')}</h4></div>
                                    <div class="col-4 text-end"><img src="img/logo_blk.png" alt="Logo" class="header-logo"></div>
                                </div>
                            </div>
    
                            <div class="details-section">
                                <div class="row">
                                    <div class="col-7">
                                        <div class="info-box">
                                            <strong>${__('consignee')}:</strong><br>
                                            ${order_details.customer_name}<br>
                                            ${order_details.address_line1 || ''}<br>
                                            ${order_details.address_line2 || ''}<br>
                                            ${order_details.city || ''}
                                        </div>
                                    </div>
                                    <div class="col-5">
                                        <div class="info-box">
                                            <strong>${__('order_no')}:</strong> ${order_details.order_number}<br>
                                            <strong>${__('date')}:</strong> ${new Date().toLocaleDateString()}<br>
                                            <strong>${__('reference_no')}:</strong> ${order_details.reference_number || __('n_a')}<br>
                                            <div class="order-article_no-container mt-2" id="order-article_no-page-${page}"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
    
                            <div class="items-section">
                                <table class="table table-bordered table-sm">
                                    <thead class="table-light">
                                        <tr>
                                            <th>#</th>
                                            <th>${__('article_description')}</th>
                                            <th>${__('sku')}</th>
                                            <th>${__('article_no')}</th>
                                            <th>${__('qty')}</th>
                                            <th>${__('location')}</th>
                                            <th>${__('batch')}</th>
                                            <th>${__('dot')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${itemsHtml}
                                    </tbody>
                                </table>
                            </div>
                            <div class="footer">
                                <div class="row">
                                    <div class="col-4 text-start"><strong>${__('picker')}:</strong> ___________________</div>
                                    <div class="col-4 text-center">${__('page')} ${page + 1} ${__('of')} ${totalPages}</div>
                                    <div class="col-4 text-end"><strong>${__('receiver')}:</strong> ___________________</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
    
            const printFrame = document.createElement('iframe');
            printFrame.style.display = 'none';
            document.body.appendChild(printFrame);
    
            printFrame.contentDocument.write(`
                <html>
                    <head>
                        <title>${__('delivery_note')} - ${order_details.order_number}</title>
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
                        <style>
                            @media print {
                                @page { size: A4; margin: 1cm; }
                                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-print-color-adjust: exact; }
                                .page { width: 100%; height: 100%; page-break-after: always; display: flex; flex-direction: column; }
                                .page:last-child { page-break-after: auto; }
                                .report-container { border: 2px solid #000; padding: 15px; flex-grow: 1; display: flex; flex-direction: column; }
                                .header-section, .details-section { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; flex-shrink: 0; }
                                .header-logo { max-height: 50px; width: auto; }
                                .order-article_no-container svg { height: 40px; width: 100%; }
                                .item-article_no-container svg { height: 35px; width: 100%; margin: 0; }
                                .table th, .table td { vertical-align: middle; font-size: 0.8rem; text-align: center; }
                                .table th { background-color: #e9ecef !important; }
                                .table td:nth-child(2), .table td:nth-child(3) { text-align: left; }
                                .info-box { border: 1px solid #ccc; padding: 10px; height: 100%; font-size: 0.9rem; }
                                .items-section { flex-grow: 1; }
                                .footer { flex-shrink: 0; margin-top: auto; text-align: center; font-size: 0.8em; border-top: 2px solid #000; padding-top: 10px; }
                            }
                        </style>
                    </head>
                    <body>${allPagesHtml}</body>
                </html>
            `);
    
            printFrame.contentDocument.close();
    
            printFrame.onload = function() {
                for (let page = 0; page < totalPages; page++) {
                    const orderarticle_noContainer = printFrame.contentDocument.getElementById(`order-article_no-page-${page}`);
                    if (orderarticle_noContainer) {
                        const svg = printFrame.contentDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
                        printFrame.contentWindow.JsBarcode(svg, order_details.order_number, { format: "CODE128", displayValue: false, height: 40, margin: 0 });
                        orderarticle_noContainer.appendChild(svg);
                    }
    
                    const start = page * itemsPerPage;
                    const end = start + itemsPerPage;
                    const pageItems = items.slice(start, end);
    
                    pageItems.forEach((item, index) => {
                        const globalIndex = start + index;
                        const itemarticle_noContainer = printFrame.contentDocument.getElementById(`item-article_no-${globalIndex}`);
                        if (itemarticle_noContainer && item.article_no) {
                            const svg = printFrame.contentDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
                            printFrame.contentWindow.JsBarcode(svg, item.article_no, { format: "CODE128", displayValue: true, height: 35, margin: 2, fontSize: 10 });
                            itemarticle_noContainer.appendChild(svg);
                        }
                    });
                }
    
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                setTimeout(() => {
                    document.body.removeChild(printFrame);
                }, 500);
            };
    
        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_generate_report')}: ${error.message}`, 'error');
        } finally {
            printPickReportBtn.disabled = false;
            printPickReportBtn.innerHTML = `<i class="bi bi-file-earmark-text me-1"></i> ${__('print_pick_report')}`;
        }
    }

    async function handlePrintDeliveryReport() {
        if (!selectedOrderId) {
            showMessageBox(__('no_order_is_selected'), 'error');
            return;
        }

        printDeliveryReportBtn.disabled = true;
        printDeliveryReportBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${__('generating')}...`;

        try {
            const response = await fetchData(`api/outbound_api.php?action=getDeliveryReport&order_id=${selectedOrderId}`);
            if (!response?.success || !response.data) {
                throw new Error(response?.message || __('could_not_fetch_report_data'));
            }

            const { order_details, delivery_details, delivered_items, returned_items } = response.data;
            const isCancelled = order_details.status === 'Cancelled';
            const isScrapped = order_details.status === 'Scrapped';
            const reportTitle = isCancelled ? __('cancelled_order_report') : (isScrapped ? __('scrapped_items_report') : __('proof_of_delivery'));

            let deliveredBy = __('n_a');
            if (delivery_details) {
                if (delivery_details.assignment_type === 'in_house') {
                    deliveredBy = `${__('in_house_driver')}: ${delivery_details.driver_name}`;
                } else {
                    deliveredBy = `${delivery_details.company_name} ${__('driver')}: ${delivery_details.third_party_driver_name}`;
                }
            }

            let deliveredItemsHtml = delivered_items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.product_name}</td>
                    <td>${item.sku}</td>
                    <td>${item.article_no}</td>
                    <td class="text-center">${item.picked_quantity}</td>
                    <td>${item.batch_number || ''}</td>
                    <td>${item.dot_code || ''}</td>
                </tr>
            `).join('');

            let returnedItemsHtml = '';
            if (returned_items && returned_items.length > 0) {
                const returnedRows = returned_items.map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.product_name}</td>
                        <td>${item.sku}</td>
                        <td>${item.article_no}</td>
                        <td class="text-center">${item.received_quantity}</td>
                        <td>${item.reason || ''}</td>
                        <td>${item.rma_number || ''}</td>
                    </tr>
                `).join('');

                returnedItemsHtml = `
                    <div class="items-section mt-4">
                        <h5 class="section-title">${__('returned_items')}</h5>
                        <table class="table table-bordered table-sm">
                            <thead class="table-light">
                                <tr>
                                    <th>#</th>
                                    <th>${__('article_description')}</th>
                                    <th>${__('sku')}</th>
                                    <th>${__('article_no')}</th>
                                    <th class="text-center">${__('qty')}</th>
                                    <th>${__('reason')}</th>
                                    <th>${__('rma_no')}</th>
                                </tr>
                            </thead>
                            <tbody>${returnedRows}</tbody>
                        </table>
                    </div>
                `;
            }

            let deliveryDetailsHtml = '';
            let footerHtml = '';
            let deliveredItemsTitle = __('delivered_items');

            if (isCancelled || isScrapped) {
                deliveryDetailsHtml = `
                    <div class="info-box">
                        <strong>${__('order_details')}:</strong><br>
                        ${__('order_no')}: ${order_details.order_number}<br>
                        ${__('reference_no')}: ${order_details.reference_number || __('n_a')}<br>
                        <strong>${__('status')}: <span style="color: red;">${__(order_details.status.toLowerCase())}</span></strong>
                    </div>
                `;
                deliveredItemsTitle = isCancelled ? __('items_in_cancelled_order') : __('scrapped_items');
                footerHtml = `<div class="text-center mt-2 small text-muted">${__('order_was')} ${__(order_details.status.toLowerCase())}.</div>`;
            } else {
                deliveryDetailsHtml = `
                    <div class="info-box">
                        <strong>${__('delivery_details')}:</strong><br>
                        ${__('order_no')}: ${order_details.order_number}<br>
                        ${__('reference_no')}: ${order_details.reference_number || __('n_a')}<br>
                        ${__('delivered_by')}: ${deliveredBy}<br>
                        ${__('delivery_date')}: ${new Date(order_details.actual_delivery_date).toLocaleString()}<br>
                        ${__('received_by')}: ${order_details.delivered_to_name || __('n_a')}
                    </div>
                `;
                footerHtml = `
                    <div class="row">
                        <div class="col-6 text-start"><strong>${__('signature')}:</strong> ___________________</div>
                        <div class="col-6 text-end"><strong>${__('date')}:</strong> ___________________</div>
                    </div>
                    <div class="text-center mt-2 small text-muted">${__('thank_you_for_your_business')}</div>
                `;
            }

            const reportHtml = `
                <div class="page">
                    <div class="report-container">
                        <div class="header-section">
                            <div class="row align-items-center">
                                <div class="col-4 text-center"><h4>${reportTitle}</h4></div>
                                <div class="col-4 text-end"><img src="img/logo_blk.png" alt="Logo" class="header-logo"></div>
                            </div>
                        </div>

                        <div class="details-section">
                            <div class="row">
                                <div class="col-6">
                                    <div class="info-box">
                                        <strong>${__('customer_details')}:</strong><br>
                                        ${order_details.customer_name}<br>
                                        ${order_details.address_line1 || ''}<br>
                                        ${order_details.address_line2 || ''}<br>
                                        ${order_details.city || ''}<br>
                                        ${__('phone')}: ${order_details.phone || __('n_a')}
                                    </div>
                                </div>
                                <div class="col-6">
                                    ${deliveryDetailsHtml}
                                </div>
                            </div>
                        </div>

                        <div class="items-section">
                            <h5 class="section-title">${deliveredItemsTitle}</h5>
                            <table class="table table-bordered table-sm">
                                <thead class="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>${__('article_description')}</th>
                                        <th>${__('sku')}</th>
                                        <th>${__('article_no')}</th>
                                        <th class="text-center">${__('qty')}</th>
                                        <th>${__('batch')}</th>
                                        <th>${__('dot')}</th>
                                    </tr>
                                </thead>
                                <tbody>${deliveredItemsHtml}</tbody>
                            </table>
                        </div>

                        ${returnedItemsHtml}

                        <div class="footer">
                            ${footerHtml}
                        </div>
                    </div>
                </div>
            `;

            const printFrame = document.createElement('iframe');
            printFrame.style.display = 'none';
            document.body.appendChild(printFrame);
            printFrame.contentDocument.write(`
                <html>
                    <head>
                        <title>${__('report')} - ${order_details.order_number}</title>
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                        <style>
                            @media print {
                                @page { size: A4; margin: 1cm; }
                                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-print-color-adjust: exact; }
                                .page { width: 100%; height: 100%; display: flex; flex-direction: column; }
                                .report-container { border: 1px solid #ccc; padding: 15px; flex-grow: 1; display: flex; flex-direction: column; }
                                .header-section, .details-section { padding-bottom: 10px; margin-bottom: 15px; }
                                .header-section { border-bottom: 2px solid #000; }
                                .header-logo { max-height: 50px; width: auto; }
                                .table th, .table td { vertical-align: middle; font-size: 0.8rem; }
                                .table th { background-color: #e9ecef !important; }
                                .table td:nth-child(2) { text-align: left; }
                                .info-box { padding: 10px; height: 100%; font-size: 0.9rem; }
                                .items-section { flex-grow: 1; }
                                .section-title { font-size: 1rem; font-weight: bold; border-bottom: 1px solid #dee2e6; padding-bottom: 5px; margin-bottom: 10px; }
                                .footer { flex-shrink: 0; margin-top: auto; font-size: 0.8em; border-top: 2px solid #000; padding-top: 10px; }
                            }
                        </style>
                    </head>
                    <body>${reportHtml}</body>
                </html>
            `);
            printFrame.contentDocument.close();
            printFrame.onload = function() {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                setTimeout(() => document.body.removeChild(printFrame), 500);
            };

        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_generate_report')}: ${error.message}`, 'error');
        } finally {
            printDeliveryReportBtn.disabled = false;
            printDeliveryReportBtn.innerHTML = `<i class="bi bi-receipt me-1"></i> ${__('print_delivery_report')}`;
        }
    }

    function copyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text; document.body.appendChild(textArea); textArea.focus(); textArea.select();
        try { 
            document.execCommand('copy'); 
            showMessageBox(__('tracking_number_copied'), 'success'); 
        } catch (err) { 
            showMessageBox(__('failed_to_copy'), 'error'); 
        }
        document.body.removeChild(textArea);
    }
});
