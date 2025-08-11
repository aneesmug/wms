// public/js/outbound.js

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

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

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
            Swal.fire({ icon: 'warning', title: 'No Warehouse Selected', text: 'Please select a warehouse on the Dashboard to enable outbound operations.'});
            if(document.getElementById('outboundOrdersTableBody')) document.getElementById('outboundOrdersTableBody').innerHTML = `<tr><td colspan="9" class="text-center p-4">Please select a warehouse first.</td></tr>`;
            if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
            return;
        }
        initializeOrdersDataTable();
        
        try {
            await Promise.all([ 
                loadCustomersForDropdown(), 
                loadProductsForDropdown(), 
                loadOutboundOrders()
            ]);
        } catch (error) {
            Swal.fire('Initialization Error', `Could not load initial page data. ${error.message}`, 'error');
        }
    }

    function initializeOrdersDataTable() {
        ordersTable = $('#outboundOrdersTable').DataTable({
            responsive: true,
            "order": [[ 0, "desc" ]],
            "columnDefs": [
                { "targets": [0, 1, 2, 3, 4, 5, 6, 7], "className": "align-middle" }, 
                { "targets": 8, "className": "text-end align-middle" } 
            ]
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
            let actionButtons = `<button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-outline-secondary view-details-btn" title="Details"><i class="bi bi-eye"></i></button>`;
            
            const isProcessable = !['Shipped', 'Delivered', 'Cancelled', 'Returned', 'Partially Returned'].includes(order.status) || order.status === 'Delivery Failed';
            if (isProcessable && canManageOutbound) {
                actionButtons += ` <button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-primary select-order-btn ms-1" title="Process"><i class="bi bi-gear"></i></button>`;
            }

            return [ 
                order.order_number || 'N/A', 
                order.reference_number || 'N/A',
                order.customer_name || 'N/A', 
                order.shipping_area_code || 'N/A',
                order.assigned_to || 'N/A',
                order.tracking_number || 'N/A', 
                order.required_ship_date, 
                order.status, 
                actionButtons 
            ];
        });

        ordersTable.clear();
        ordersTable.rows.add(tableData).draw();
        ordersTable.rows().every(function() {
            const row = this.node();
            const status = this.data()[7];
            const statusMap = { 'Delivered': 'bg-success', 'Out for Delivery': 'bg-primary', 'Shipped': 'bg-info', 'Assigned': 'bg-orange', 'Ready for Pickup': 'bg-purple', 'Picked': 'bg-primary', 'Partially Picked': 'bg-warning text-dark', 'New': 'bg-secondary', 'Pending Pick': 'bg-secondary', 'Cancelled': 'bg-danger', 'Returned': 'bg-dark', 'Partially Returned': 'bg-secondary', 'Delivery Failed': 'bg-danger' };
            const statusClass = statusMap[status] || 'bg-secondary';
            $(row).find('td').eq(7).html(`<span class="badge ${statusClass}">${status}</span>`); 
        });
    }

    function filterOrdersByStatus() {
        ordersTable.column(7).search(this.value ? '^' + this.value + '$' : '', true, false).draw();
    }

    async function handleShowCreateOrderModal() {
        const customerOptions = allCustomers.map(customer => `<option value="${customer.customer_id}">${customer.customer_name}</option>`).join('');
        Swal.fire({
            title: 'Create New Outbound Order',
            html: `<div class="p-2 text-start">
                    <div class="mb-3"><label for="swal-customer" class="form-label">Customer</label><select id="swal-customer" class="form-select"><option value="">Select a Customer</option>${customerOptions}</select></div>
                    <div class="mb-3"><label for="swal-reference-number" class="form-label">Reference Number</label><input type="text" id="swal-reference-number" class="form-control numeric-only" placeholder="Optional customer PO or reference..."></div>
                    <div class="mb-3"><label for="swal-ship-date" class="form-label">Required Ship Date</label><input type="text" id="swal-ship-date" class="form-control datepicker-input"></div>
                    <div class="mb-3"><label for="swal-delivery-note" class="form-label">Delivery Note</label><textarea id="swal-delivery-note" class="form-control" rows="3" placeholder="Enter any special instructions for the delivery..."></textarea></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Create Order',
            allowOutsideClick: false,
            didOpen: () => {
                const dateElement = document.getElementById('swal-ship-date');
                // Pass the SweetAlert popup as the container for the datepicker
                initializeDatepicker(dateElement, Swal.getPopup());
            },
            preConfirm: () => {
                const customerId = document.getElementById('swal-customer').value;
                const requiredShipDate = document.getElementById('swal-ship-date').value;
                if (!customerId) Swal.showValidationMessage('Please select a customer.');
                else if (!requiredShipDate) Swal.showValidationMessage('Please select a required ship date.');
                else return { customer_id: customerId, required_ship_date: requiredShipDate, delivery_note: document.getElementById('swal-delivery-note').value, reference_number: document.getElementById('swal-reference-number').value };
                return false;
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const apiResult = await fetchData('api/outbound_api.php?action=createOrder', 'POST', result.value);
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
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
        orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">Loading items...</td></tr>`;
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
                const isCancellable = ['New', 'Pending Pick', 'Partially Picked', 'Picked', 'Staged', 'Assigned', 'Out for Delivery', 'Delivery Failed'].includes(order.status);

                managementActionsArea.style.display = (canManage) ? 'block' : 'none';
                cancelOrderBtn.style.display = (canManage && isCancellable) ? 'inline-block' : 'none';
                if (editOrderBtn) {
                    editOrderBtn.style.display = (canManage && isEditable) ? 'inline-block' : 'none';
                }

                if (['Delivered', 'Partially Returned', 'Returned', 'Cancelled'].includes(order.status) && printDeliveryReportBtn) {
                    printDeliveryReportBtn.classList.remove('d-none');
                }

                const canCreateReturn = ['Shipped', 'Delivered', 'Partially Returned'].includes(order.status);
                let createReturnBtn = document.getElementById('createReturnBtn');
                
                if (canManage && canCreateReturn) {
                    if (!createReturnBtn) {
                        createReturnBtn = document.createElement('button');
                        createReturnBtn.id = 'createReturnBtn';
                        createReturnBtn.className = 'btn btn-warning ms-2';
                        createReturnBtn.innerHTML = '<i class="bi bi-arrow-return-left me-1"></i> Create Return';
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
                        processReturnBtn.innerHTML = '<i class="bi bi-box-arrow-in-down me-1"></i> Go to Return';
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
                
                const canPrintPickReport = !['Returned', 'Partially Returned', 'Cancelled', 'Delivered', 'Shipped'].includes(order.status);
                if (order.items.length > 0 && canPrintPickReport) {
                    printPickReportBtn.classList.remove('d-none');
                } else {
                    printPickReportBtn.classList.add('d-none');
                }

                const canShowStaging = !['Delivered', 'Cancelled', 'Returned', 'Partially Returned'].includes(order.status);
                if (canShowStaging && order.shipping_area_code && shippingAreaDisplay) {
                    shippingAreaDisplay.innerHTML = `<strong>Staged At:</strong> <span class="badge bg-purple">${order.shipping_area_code}</span>`;
                }

                if (order.tracking_number) {
                    trackingNumberDisplay.innerHTML = `<strong>Tracking #:</strong> <span id="trackingNumberText">${order.tracking_number}</span> <button id="copyTrackingBtn" class="btn btn-sm btn-outline-secondary ms-2" title="Copy Tracking Number"><i class="bi bi-clipboard"></i></button>`;
                    document.getElementById('copyTrackingBtn').addEventListener('click', () => copyToClipboard(order.tracking_number));
                }
                
                if (order.status === 'Delivered' && order.delivery_photo_path) {
                    proofOfDeliveryDisplay.innerHTML = `<strong>Proof of Delivery:</strong> <a href="${order.delivery_photo_path}" target="_blank" class="btn btn-sm btn-outline-info ms-2"><i class="bi bi-camera-fill me-1"></i> View Photo</a>`;
                }
                
                if (assignedDriverDisplay && order.assignments && order.assignments.length > 0) {
                    const assignmentHtml = order.assignments.map(a => {
                        let text = '';
                        if (a.assignment_type === 'in_house') {
                            text = `<div class="mb-2"><span class="badge bg-info text-dark">In-House: ${a.driver_name}</span></div>`;
                        } else {
                            text = `<div class="border rounded p-2 mb-2">
                                        <div class="fw-bold">${a.third_party_driver_name} <span class="badge bg-secondary">${a.company_name}</span></div>
                                        <small class="text-muted d-block">Mobile: ${a.third_party_driver_mobile || 'N/A'}</small>
                                        <small class="text-muted d-block">Waybill No: ${a.waybill_number || 'N/A'}</small>
                                        <div>
                                            ${a.third_party_driver_id_path ? `<a href="${a.third_party_driver_id_path}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1">View ID</a>` : ''}
                                            ${a.third_party_driver_license_path ? `<a href="${a.third_party_driver_license_path}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1">View License</a>` : ''}
                                        </div>
                                    </div>`;
                        }
                        return text;
                    }).join('');
                    assignedDriverDisplay.innerHTML = `<h6>Assigned To:</h6>${assignmentHtml}`;
                }


                if (addItemContainer) {
                    addItemContainer.innerHTML = '';
                    if (canManage && isEditable) {
                        addItemContainer.innerHTML = `
                            <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                <button id="showAddItemModalBtn" class="btn btn-outline-primary"><i class="bi bi-plus-circle me-2"></i>Add Single Item</button>
                                <button id="showBulkAddModalBtn" class="btn btn-outline-success"><i class="bi bi-file-earmark-excel me-2"></i>Bulk Add Items</button>
                            </div>
                        `;
                        document.getElementById('showAddItemModalBtn').addEventListener('click', handleShowAddItemModal);
                        document.getElementById('showBulkAddModalBtn').addEventListener('click', handleShowBulkAddModal);
                    }
                }
                
                if (order.items.length === 0) {
                    orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">No items have been added to this order yet.</td></tr>`;
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
                         itemActionButtons = `<button class="btn btn-sm btn-outline-primary edit-item-btn" title="Edit Ordered Quantity" data-item-id="${item.outbound_item_id}" data-ordered-qty="${item.ordered_quantity}" ${isDisabled}><i class="bi bi-pencil-square"></i></button> <button class="btn btn-sm btn-outline-danger delete-item-btn" title="Delete Ordered Item" data-item-id="${item.outbound_item_id}" ${isDisabled}><i class="bi bi-trash"></i></button>`;
                    }
                    
                    itemRow.innerHTML = `<td>${item.sku}</td><td>${item.product_name}</td><td>${item.article_no}</td><td>${item.ordered_quantity}</td><td>${item.picked_quantity}</td><td colspan="3"></td><td class="text-center">${itemActionButtons}</td>`;

                    if (item.picks && Array.isArray(item.picks)) {
                        item.picks.forEach(pick => {
                            const pickRow = orderItemsTableBody.insertRow();
                            pickRow.className = 'pick-row';
                            pickRow.innerHTML = `<td colspan="5" class="text-end border-end-0 fst-italic text-muted">Picked: ${pick.picked_quantity}</td><td class="border-start-0">${pick.batch_number || 'N/A'}</td><td>${pick.dot_code || 'N/A'}</td><td>${pick.location_code}</td><td class="text-center"></td>`;
                        });
                    }
                });
                addOrderItemActionListeners(orderId);
            }
        } catch (error) {
            Swal.fire('Error', `Could not load order items: ${error.message}`, 'error');
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
            if(btn.classList.contains('select-order-btn')) Toast.fire({ icon: 'info', title: `Selected Order: ${orderNumber}` });
        });
    }

    async function handleShowEditOrderModal() {
        if (!selectedOrderDetails) {
            Swal.fire('Error', 'Order details not loaded yet.', 'error');
            return;
        }

        const customerOptions = allCustomers.map(customer =>
            `<option value="${customer.customer_id}" ${customer.customer_id == selectedOrderDetails.customer_id ? 'selected' : ''}>${customer.customer_name}</option>`
        ).join('');

        Swal.fire({
            title: `Edit Order #${selectedOrderDetails.order_number}`,
            html: `<div class="p-2 text-start">
                    <div class="mb-3"><label for="swal-customer" class="form-label">Customer</label><select id="swal-customer" class="form-select">${customerOptions}</select></div>
                    <div class="mb-3"><label for="swal-reference-number" class="form-label">Reference Number</label><input type="text" id="swal-reference-number" class="form-control" value="${selectedOrderDetails.reference_number || ''}"></div>
                    <div class="mb-3"><label for="swal-ship-date" class="form-label">Required Ship Date</label><input type="text" id="swal-ship-date" class="form-control datepicker-input" value="${selectedOrderDetails.required_ship_date || ''}"></div>
                    <div class="mb-3"><label for="swal-delivery-note" class="form-label">Delivery Note</label><textarea id="swal-delivery-note" class="form-control" rows="3">${selectedOrderDetails.delivery_note || ''}</textarea></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            allowOutsideClick: false,
            didOpen: () => {
                const dateElement = document.getElementById('swal-ship-date');
                // Pass the SweetAlert popup as the container for the datepicker
                initializeDatepicker(dateElement, Swal.getPopup());
            },
            preConfirm: () => {
                const customerId = document.getElementById('swal-customer').value;
                const requiredShipDate = document.getElementById('swal-ship-date').value;
                if (!customerId) Swal.showValidationMessage('Please select a customer.');
                else if (!requiredShipDate) Swal.showValidationMessage('Please select a required ship date.');
                else return {
                    order_id: selectedOrderId,
                    customer_id: customerId,
                    required_ship_date: requiredShipDate,
                    delivery_note: document.getElementById('swal-delivery-note').value,
                    reference_number: document.getElementById('swal-reference-number').value
                };
                return false;
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const apiResult = await fetchData('api/outbound_api.php?action=updateOrder', 'POST', result.value);
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    await loadOutboundOrders();
                    await loadOrderItems(selectedOrderId);
                }
            }
        });
    }
    
    async function handleShipOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order to ship.', 'error'); return; }
        Swal.fire({ title: 'Confirm Shipment', text: 'Are you sure you want to ship this order?', icon: 'warning', showCancelButton: true, allowOutsideClick: false, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, ship it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/outbound_api.php?action=shipOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    Swal.fire('Shipped!', apiResult.message, 'success');
                    selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                    if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                    await loadOutboundOrders();
                }
            }
        });
    }

    async function handleCancelOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order to cancel.', 'error'); return; }
        Swal.fire({ title: 'Confirm Cancellation', allowOutsideClick: false, text: 'Are you sure you want to cancel this order? This will return any picked items to stock and cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, cancel it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/outbound_api.php?action=cancelOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    Swal.fire('Cancelled!', 'The order has been successfully cancelled.', 'success');
                    selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                    if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                    await loadOutboundOrders();
                }
            }
        });
    }

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.edit-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); if (!btn.disabled) handleUpdateOrderItem(btn.dataset.itemId, btn.dataset.orderedQty, orderId); }));
        document.querySelectorAll('.delete-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); if (!btn.disabled) handleDeleteOrderItem(btn.dataset.itemId, orderId); }));
    }

    async function handleUpdateOrderItem(itemId, currentQty, orderId) {
        const { value: newQty } = await Swal.fire({ title: 'Update Item Quantity', input: 'number', inputValue: currentQty, inputLabel: 'New Ordered Quantity', inputAttributes: { min: 1, class: 'form-control numeric-only' }, showCancelButton: true, inputValidator: (value) => { if (!value || parseInt(value, 10) <= 0) return 'Please enter a valid quantity greater than zero!'; } });
        if (newQty) {
            const result = await fetchData('api/outbound_api.php?action=updateOrderItem', 'POST', { outbound_item_id: itemId, new_quantity: parseInt(newQty, 10) });
            if (result?.success) {
                Toast.fire({ icon: 'success', title: result.message });
                await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
            }
        }
    }

    async function handleDeleteOrderItem(itemId, orderId) {
        Swal.fire({ title: 'Confirm Deletion', text: 'Are you sure you want to remove this item from the order?', icon: 'warning', showCancelButton: true, allowOutsideClick: false, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/outbound_api.php?action=deleteOrderItem', 'POST', { outbound_item_id: itemId });
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
                }
            }
        });
    }

    async function handleShowAddItemModal() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order first.', 'error'); return; }
        
        Swal.fire({
            title: 'Add Item to Order',
            html: `
                <div class="p-2 text-start">
                    <div class="mb-3">
                        <label for="modalProductSelect" class="form-label w-100">Product</label>
                        <select id="modalProductSelect" class="form-select w-100" style="width: 100%"></select>
                    </div>
                    <div class="mb-3">
                        <label for="modalQuantityInput" class="form-label w-100">Quantity</label>
                        <input type="number" id="modalQuantityInput" value="1" min="1" class="form-control numeric-only">
                        <div id="quantityError" class="text-danger small mt-1"></div>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Add Item',
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
                    
                    const stockBadge = `<span class="badge ${badgeClass} float-end">Stock: ${stock}</span>`;
                    const inactiveText = !is_active ? ' <span class="text-danger fw-bold">(Inactive)</span>' : '';

                    return $(`<div>${product.text}${inactiveText}<br><small class="text-muted">Article No: ${article_no}</small>${stockBadge}</div>`);
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
                    placeholder: 'Search by Name, SKU, or Article No...',
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
                            quantityErrorDiv.textContent = `Only ${availableStock} available in stock.`;
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
                    Swal.showValidationMessage('You must select a product.');
                    return false;
                }
                if (isNaN(orderedQuantity) || orderedQuantity <= 0) {
                    Swal.showValidationMessage('Please enter a valid quantity greater than zero.');
                    return false;
                }
                if (orderedQuantity > availableStock) {
                    Swal.showValidationMessage(`Quantity cannot exceed available stock of ${availableStock}.`);
                    return false;
                }
                return { product_article_no: productarticle_no, ordered_quantity: orderedQuantity };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const data = { order_id: selectedOrderId, ...result.value };
                const apiResult = await fetchData('api/outbound_api.php?action=addItem', 'POST', data);
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: 'Item added successfully!' });
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
            Swal.fire('Error', 'Please select an order first.', 'error');
            return;
        }

        Swal.fire({
            title: 'Bulk Add Items from Excel',
            html: `
                <div class="text-start p-2">
                    <p class="text-muted">Upload an Excel file (.xlsx, .xls) with two columns: <strong>Article No</strong> and <strong>Quantity</strong>. The first row should be the header.</p>
                    <a href="#" id="download-template-btn" class="btn btn-sm btn-link mb-2"><i class="bi bi-download me-1"></i>Download Template</a>
                    <input type="file" id="bulk-upload-file" class="form-control" accept=".xlsx, .xls">
                    <div id="bulk-upload-error" class="text-danger small mt-2"></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Upload and Process',
            allowOutsideClick: false,
            didOpen: () => {
                document.getElementById('download-template-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    handleDownloadTemplate();
                });

                // --- NEW: File type validation on change ---
                const fileInput = document.getElementById('bulk-upload-file');
                const errorDiv = document.getElementById('bulk-upload-error');
                const confirmButton = Swal.getConfirmButton();

                fileInput.addEventListener('change', () => {
                    const file = fileInput.files[0];
                    if (file) {
                        const fileName = file.name;
                        const allowedExtensions = /(\.xlsx|\.xls)$/i; // Case-insensitive check for .xlsx or .xls
                        if (!allowedExtensions.exec(fileName)) {
                            errorDiv.textContent = 'Invalid file type. Please select an Excel file (.xlsx, .xls).';
                            fileInput.value = ''; // Clear the invalid file selection
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
                    errorDiv.textContent = 'Please select a file to upload.';
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
                                errorDiv.textContent = 'The Excel file is empty or has an invalid format.';
                                return reject();
                            }

                            const firstRow = json[0];
                            if (!firstRow.hasOwnProperty('Article No') || !firstRow.hasOwnProperty('Quantity')) {
                                errorDiv.textContent = 'File must contain "Article No" and "Quantity" columns.';
                                return reject();
                            }
                            
                            resolve(json);
                        } catch (err) {
                            errorDiv.textContent = 'Error reading or parsing the file. Please ensure it is a valid Excel file.';
                            reject();
                        }
                    };
                    reader.onerror = () => {
                        errorDiv.textContent = 'Error reading the file.';
                        reject();
                    };
                    reader.readAsArrayBuffer(file);
                });
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const items = result.value;
                Swal.fire({
                    title: 'Processing...',
                    text: `Processing ${items.length} items. Please wait.`,
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                const apiResult = await fetchData('api/outbound_api.php?action=bulkAddItems', 'POST', { order_id: selectedOrderId, items: items });
                
                if (apiResult?.success) {
                    let resultHtml = `<div class="text-start">
                        <p class="lead">${apiResult.message}</p>
                        <p><strong>Successful:</strong> ${apiResult.data.success_count}</p>
                        <p><strong>Failed:</strong> ${apiResult.data.failed_count}</p>`;
                    
                    if (apiResult.data.failed_count > 0) {
                        resultHtml += `<h6>Skipped Items:</h6><ul class="list-group" style="max-height: 150px; overflow-y: auto;">`;
                        apiResult.data.failed_items.forEach(fail => {
                            resultHtml += `<li class="list-group-item"><strong>${fail.item}:</strong> ${fail.reason}</li>`;
                        });
                        resultHtml += `</ul>`;
                    }
                    resultHtml += `</div>`;

                    Swal.fire({
                        title: 'Bulk Process Complete',
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
            Swal.fire('Error', 'Order items not loaded or empty.', 'error');
            return;
        }

        const itemsForReturn = selectedOrderDetails.items.filter(item => item.picked_quantity > 0);

        if (itemsForReturn.length === 0) {
            Swal.fire('Info', 'No items have been shipped for this order yet.', 'info');
            return;
        }

        let itemsHtml = `
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th>Article No</th>
                        <th>Product</th>
                        <th class="text-center">Shipped</th>
                        <th class="text-center">Returned</th>
                        <th class="text-center" style="width: 120px;">Return Qty</th>
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
            title: 'Create Partial Return',
            html: `
                <div class="text-start p-2">
                    <div class="mb-3">
                        <label for="swal-return-reason" class="form-label">Reason for Return</label>
                        <textarea id="swal-return-reason" class="form-control" rows="3" placeholder="e.g., Damaged, wrong item..."></textarea>
                    </div>
                    ${itemsHtml}
                </div>
            `,
            width: '900px',
            showCancelButton: true,
            confirmButtonText: 'Initiate Return',
            allowOutsideClick: false,
            preConfirm: () => {
                const reason = document.getElementById('swal-return-reason').value;
                if (!reason) {
                    Swal.showValidationMessage('Please provide a reason for the return.');
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
                             Swal.showValidationMessage(`Quantity for an item exceeds the returnable amount of ${maxQty}.`);
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
                    Swal.showValidationMessage('Please enter a quantity for at least one item to return.');
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
                    Swal.fire('Success', apiResult.message, 'success');
                    await loadOrderItems(selectedOrderId);
                    await loadOutboundOrders();
                }
            }
        });
    }

    async function handlePrintPickReport() {
        if (!selectedOrderId) {
            Swal.fire('Error', 'No order is selected.', 'error');
            return;
        }
    
        printPickReportBtn.disabled = true;
        printPickReportBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Printing...';
    
        try {
            const response = await fetchData(`api/outbound_api.php?action=getPickReport&order_id=${selectedOrderId}`);
    
            if (!response?.success || !response.data) {
                Swal.fire('Error', response?.message || 'Could not fetch pick report data.', 'error');
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
                    itemsHtml = '<tr><td colspan="8" class="text-center" style="height: 400px;">No items on this order.</td></tr>';
                }
    
                allPagesHtml += `
                    <div class="page">
                        <div class="report-container">
                            <div class="header-section">
                                <div class="row align-items-center">
                                    <div class="col-4"><img src="https://wms.almutlak.local/img/Continental-Logo.png" alt="Logo 1" class="header-logo"></div>
                                    <div class="col-4 text-center"><h4>Delivery Note</h4></div>
                                    <div class="col-4 text-end"><img src="https://wms.almutlak.local/img/logo_blk.png" alt="Logo 2" class="header-logo"></div>
                                </div>
                            </div>
    
                            <div class="details-section">
                                <div class="row">
                                    <div class="col-7">
                                        <div class="info-box">
                                            <strong>Consignee:</strong><br>
                                            ${order_details.customer_name}<br>
                                            ${order_details.address_line1 || ''}<br>
                                            ${order_details.address_line2 || ''}<br>
                                            ${order_details.city || ''}
                                        </div>
                                    </div>
                                    <div class="col-5">
                                        <div class="info-box">
                                            <strong>Order Number:</strong> ${order_details.order_number}<br>
                                            <strong>Date:</strong> ${new Date().toLocaleDateString()}<br>
                                            <strong>Reference:</strong> ${order_details.reference_number || 'N/A'}<br>
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
                                            <th>Article Description</th>
                                            <th>SKU</th>
                                            <th>Article No.</th>
                                            <th>Qty</th>
                                            <th>Location</th>
                                            <th>Batch</th>
                                            <th>DOT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${itemsHtml}
                                    </tbody>
                                </table>
                            </div>
                            <div class="footer">
                                <div class="row">
                                    <div class="col-4 text-start"><strong>Picker:</strong> ___________________</div>
                                    <div class="col-4 text-center">Page ${page + 1} of ${totalPages}</div>
                                    <div class="col-4 text-end"><strong>Receiver:</strong> ___________________</div>
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
                        <title>Delivery Note - ${order_details.order_number}</title>
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
            Swal.fire('Error', `Could not generate report: ${error.message}`, 'error');
        } finally {
            printPickReportBtn.disabled = false;
            printPickReportBtn.innerHTML = '<i class="bi bi-file-earmark-text me-1"></i> Print Pick Report';
        }
    }

    async function handlePrintDeliveryReport() {
        if (!selectedOrderId) {
            Swal.fire('Error', 'No order is selected.', 'error');
            return;
        }

        printDeliveryReportBtn.disabled = true;
        printDeliveryReportBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';

        try {
            const response = await fetchData(`api/outbound_api.php?action=getDeliveryReport&order_id=${selectedOrderId}`);
            if (!response?.success || !response.data) {
                throw new Error(response?.message || 'Could not fetch report data.');
            }

            const { order_details, delivery_details, delivered_items, returned_items } = response.data;
            const isCancelled = order_details.status === 'Cancelled';
            const reportTitle = isCancelled ? 'Cancelled Order Report' : 'Proof of Delivery';

            let deliveredBy = 'N/A';
            if (delivery_details) {
                if (delivery_details.assignment_type === 'in_house') {
                    deliveredBy = `In-House Driver: ${delivery_details.driver_name}`;
                } else {
                    deliveredBy = `${delivery_details.company_name} Driver: ${delivery_details.third_party_driver_name}`;
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
                        <h5 class="section-title">Returned Items</h5>
                        <table class="table table-bordered table-sm">
                            <thead class="table-light">
                                <tr>
                                    <th>#</th>
                                    <th>Article Description</th>
                                    <th>SKU</th>
                                    <th>Article No.</th>
                                    <th class="text-center">Qty</th>
                                    <th>Reason</th>
                                    <th>RMA #</th>
                                </tr>
                            </thead>
                            <tbody>${returnedRows}</tbody>
                        </table>
                    </div>
                `;
            }

            // MODIFICATION: Conditional HTML for delivery details and footer based on status
            let deliveryDetailsHtml = '';
            let footerHtml = '';
            let deliveredItemsTitle = 'Delivered Items';

            if (isCancelled) {
                deliveryDetailsHtml = `
                    <div class="info-box">
                        <strong>Order Details:</strong><br>
                        Order Number: ${order_details.order_number}<br>
                        Reference: ${order_details.reference_number || 'N/A'}<br>
                        <strong>Status: <span style="color: red;">Cancelled</span></strong>
                    </div>
                `;
                deliveredItemsTitle = 'Items in Cancelled Order';
                footerHtml = `<div class="text-center mt-2 small text-muted">This order was cancelled.</div>`;
            } else {
                deliveryDetailsHtml = `
                    <div class="info-box">
                        <strong>Delivery Details:</strong><br>
                        Order Number: ${order_details.order_number}<br>
                        Reference: ${order_details.reference_number || 'N/A'}<br>
                        Delivered By: ${deliveredBy}<br>
                        Delivery Date: ${new Date(order_details.actual_delivery_date).toLocaleString()}<br>
                        Received By: ${order_details.delivered_to_name || 'N/A'}
                    </div>
                `;
                footerHtml = `
                    <div class="row">
                        <div class="col-6 text-start"><strong>Signature:</strong> ___________________</div>
                        <div class="col-6 text-end"><strong>Date:</strong> ___________________</div>
                    </div>
                    <div class="text-center mt-2 small text-muted">Thank you for your business!</div>
                `;
            }

            const reportHtml = `
                <div class="page">
                    <div class="report-container">
                        <div class="header-section">
                            <div class="row align-items-center">
                                <div class="col-4"><img src="https://wms.almutlak.local/img/Continental-Logo.png" alt="Logo 1" class="header-logo"></div>
                                <div class="col-4 text-center"><h4>${reportTitle}</h4></div>
                                <div class="col-4 text-end"><img src="https://wms.almutlak.local/img/logo_blk.png" alt="Logo 2" class="header-logo"></div>
                            </div>
                        </div>

                        <div class="details-section">
                            <div class="row">
                                <div class="col-6">
                                    <div class="info-box">
                                        <strong>Customer Details:</strong><br>
                                        ${order_details.customer_name}<br>
                                        ${order_details.address_line1 || ''}<br>
                                        ${order_details.address_line2 || ''}<br>
                                        ${order_details.city || ''}<br>
                                        Phone: ${order_details.phone || 'N/A'}
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
                                        <th>Article Description</th>
                                        <th>SKU</th>
                                        <th>Article No.</th>
                                        <th class="text-center">Qty</th>
                                        <th>Batch</th>
                                        <th>DOT</th>
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
                        <title>Report - ${order_details.order_number}</title>
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
            Swal.fire('Error', `Could not generate report: ${error.message}`, 'error');
        } finally {
            printDeliveryReportBtn.disabled = false;
            printDeliveryReportBtn.innerHTML = '<i class="bi bi-receipt me-1"></i> Print Delivery Report';
        }
    }

    function copyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text; document.body.appendChild(textArea); textArea.focus(); textArea.select();
        try { document.execCommand('copy'); Toast.fire({ icon: 'success', title: 'Tracking number copied!' }); } catch (err) { Toast.fire({ icon: 'error', title: 'Failed to copy' }); }
        document.body.removeChild(textArea);
    }
});
