// public/js/outbound.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const selectedOrderNumberDisplay = document.getElementById('selectedOrderNumberDisplay');
    const trackingNumberDisplay = document.getElementById('trackingNumberDisplay');
    const orderProcessingArea = document.getElementById('orderProcessingArea');
    const currentOrderIdInput = document.getElementById('currentOrderId');
    const orderItemsTableBody = document.getElementById('orderItemsTableBody');
    const pickBarcodeInput = document.getElementById('pickBarcodeInput');
    const pickLocationSelect = document.getElementById('pickLocationSelect');
    const pickQuantityInput = document.getElementById('pickQuantityInput');
    const pickBatchNumberSelect = document.getElementById('pickBatchNumberSelect');
    const pickItemBtn = document.getElementById('pickItemBtn');
    const shipOrderBtn = document.getElementById('shipOrderBtn');
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const addItemContainer = document.getElementById('addItemContainer');
    const pickAndShipActionsArea = document.getElementById('pickAndShipActionsArea');
    const statusFilter = document.getElementById('statusFilter');
    const showCreateOrderModalBtn = document.getElementById('showCreateOrderModalBtn');
    const printStickersBtn = document.getElementById('printStickersBtn');
    
    // --- State Variables ---
    let selectedOrderId = null;
    let allProducts = [];
    let allCustomers = [];
    let productInventoryDetails = [];
    let ordersTable = null;

    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    // --- SweetAlert2 Mixin for Toasts ---
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

    // --- Initialize Page ---
    initializePage();

    // --- Event Listeners ---
    if (showCreateOrderModalBtn) showCreateOrderModalBtn.addEventListener('click', handleShowCreateOrderModal);
    if (pickItemBtn) pickItemBtn.addEventListener('click', handlePickItem);
    if (shipOrderBtn) shipOrderBtn.addEventListener('click', handleShipOrder);
    if (cancelOrderBtn) cancelOrderBtn.addEventListener('click', handleCancelOrder);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (pickLocationSelect) pickLocationSelect.addEventListener('change', populateBatchDropdown);
    if (statusFilter) statusFilter.addEventListener('change', filterOrdersByStatus);
    if (printStickersBtn) printStickersBtn.addEventListener('click', handlePrintStickers);

    if (pickBarcodeInput) {
        pickBarcodeInput.addEventListener('change', () => filterPickLocationsByProduct(pickBarcodeInput.value.trim()));
        // Assuming setupBarcodeScanner is a global function from barcodeScanner.js
        if (typeof setupBarcodeScanner === 'function') {
            setupBarcodeScanner('pickBarcodeInput', (barcode) => {
                pickBarcodeInput.value = barcode;
                pickBarcodeInput.dispatchEvent(new Event('change'));
            });
        }
    }

    // --- Core Functions ---
    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire({ icon: 'warning', title: 'No Warehouse Selected', text: 'Please select a warehouse on the Dashboard to enable outbound operations.', timer: 5000 });
            if(document.getElementById('outboundOrdersTableBody')) document.getElementById('outboundOrdersTableBody').innerHTML = `<tr><td colspan="6" class="text-center p-4">Please select a warehouse first.</td></tr>`;
            if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
            return;
        }
        initializeOrdersDataTable();
        try {
            await Promise.all([ loadCustomersForDropdown(), loadProductsForDropdown(), loadOutboundOrders() ]);
        } catch (error) {
            Swal.fire('Initialization Error', `Could not load initial page data. ${error.message}`, 'error');
        }
    }

    function initializeOrdersDataTable() {
        ordersTable = $('#outboundOrdersTable').DataTable({
            responsive: true,
            "order": [[ 3, "desc" ]], // Sort by required ship date descending
            "columnDefs": [
                { "targets": [0, 1, 2, 3, 4], "className": "align-middle" },
                { "targets": 5, "className": "text-end align-middle" }
            ]
        });
        $('#outboundOrdersTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadCustomersForDropdown() {
        try {
            const response = await fetchData('api/customers.php');
            if (response?.success && Array.isArray(response.data)) {
                allCustomers = response.data;
            }
        } catch (error) {
            Swal.fire('Error', `Could not load customers: ${error.message}`, 'error');
        }
    }

    async function loadProductsForDropdown() {
        try {
            const response = await fetchData('api/products.php'); 
            if (response?.success && Array.isArray(response.data)) allProducts = response.data;
        } catch (error) {
            Swal.fire('Error', `Could not load the product list: ${error.message}`, 'error');
        }
    }

    async function loadOutboundOrders() {
        try {
            const response = await fetchData('api/outbound.php');
            const canManageOutbound = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
            
            const tableData = response.data.map(order => {
                let actionButtons = `<button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-outline-secondary view-details-btn" title="Details"><i class="bi bi-eye"></i></button>`;
                if (order.status !== 'Shipped' && order.status !== 'Delivered' && order.status !== 'Cancelled' && canManageOutbound) {
                    actionButtons += ` <button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-primary select-order-btn ms-1" title="Process"><i class="bi bi-gear"></i></button>`;
                }
                return [ order.order_number || 'N/A', order.customer_name || 'N/A', order.tracking_number || 'N/A', order.required_ship_date, order.status, actionButtons ];
            });

            ordersTable.clear();
            ordersTable.rows.add(tableData).draw();
            ordersTable.rows().every(function() {
                const row = this.node();
                const status = this.data()[4];
                const statusMap = { 'Delivered': 'bg-success', 'Out for Delivery': 'bg-primary', 'Shipped': 'bg-info', 'Picked': 'bg-primary', 'Partially Picked': 'bg-warning text-dark', 'New': 'bg-secondary', 'Pending Pick': 'bg-secondary', 'Cancelled': 'bg-danger' };
                const statusClass = statusMap[status] || 'bg-secondary';
                $(row).find('td').eq(4).html(`<span class="badge ${statusClass}">${status}</span>`);
            });
        } catch (error) {
            Swal.fire('Error', `Could not load outbound orders: ${error.message}`, 'error');
        }
    }

    function filterOrdersByStatus() {
        ordersTable.column(4).search(this.value ? '^' + this.value + '$' : '', true, false).draw();
    }

    async function handleShowCreateOrderModal() {
        const customerOptions = allCustomers.map(customer => `<option value="${customer.customer_id}">${customer.customer_name}</option>`).join('');
        Swal.fire({
            title: 'Create New Outbound Order',
            html: `
                <div class="p-2 text-start">
                    <div class="mb-3"><label for="swal-customer" class="form-label">Customer</label><select id="swal-customer" class="form-select"><option value="">Select a Customer</option>${customerOptions}</select></div>
                    <div class="mb-3"><label for="swal-ship-date" class="form-label">Required Ship Date</label><input type="date" id="swal-ship-date" class="form-control"></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Create Order',
            didOpen: () => {
                // Initialize Select2 for the customer dropdown if needed
            },
            preConfirm: () => {
                const customerId = document.getElementById('swal-customer').value;
                const requiredShipDate = document.getElementById('swal-ship-date').value;
                if (!customerId) Swal.showValidationMessage('Please select a customer.');
                else if (!requiredShipDate) Swal.showValidationMessage('Please select a required ship date.');
                else return { customer_id: customerId, required_ship_date: requiredShipDate };
                return false;
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const apiResult = await fetchData('api/outbound.php?action=createOrder', 'POST', result.value);
                    if (apiResult?.success) {
                        Toast.fire({ icon: 'success', title: apiResult.message });
                        await loadOutboundOrders();
                    }
                } catch (error) {
                    Swal.fire('Error', `An unexpected error occurred while creating the order: ${error.message}`, 'error');
                }
            }
        });
    }

    async function loadOrderItems(orderId) {
        if (!orderItemsTableBody) return;
        printStickersBtn.classList.add('d-none');
        orderItemsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">Loading items...</td></tr>`;
        trackingNumberDisplay.innerHTML = '';

        try {
            const response = await fetchData(`api/outbound.php?order_id=${orderId}`);
            orderItemsTableBody.innerHTML = '';

            if (response?.success && response.data) {
                const order = response.data;
                const orderStatus = order.status;
                const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
                const isOrderFinalized = ['Shipped', 'Delivered', 'Cancelled', 'Out for Delivery'].includes(orderStatus);

                if (order.tracking_number) {
                    trackingNumberDisplay.innerHTML = `<strong>Tracking #:</strong> <span id="trackingNumberText">${order.tracking_number}</span> <button id="copyTrackingBtn" class="btn btn-sm btn-outline-secondary ms-2" title="Copy Tracking Number"><i class="bi bi-clipboard"></i></button>`;
                    document.getElementById('copyTrackingBtn').addEventListener('click', () => copyToClipboard(order.tracking_number));
                }
                
                const totalPicked = order.items.reduce((sum, item) => sum + (parseInt(item.picked_quantity, 10) || 0), 0);
                if (totalPicked > 0) {
                    printStickersBtn.classList.remove('d-none');
                }

                if (addItemContainer) {
                    addItemContainer.style.display = (canManage && !isOrderFinalized) ? 'block' : 'none';
                    if (canManage && !isOrderFinalized) {
                        addItemContainer.innerHTML = `<button id="showAddItemModalBtn" class="btn btn-outline-secondary w-100"><i class="bi bi-plus-circle me-2"></i>Add Item to Order</button>`;
                        document.getElementById('showAddItemModalBtn').addEventListener('click', handleShowAddItemModal);
                    } else {
                        addItemContainer.innerHTML = '';
                    }
                }

                if(pickAndShipActionsArea) pickAndShipActionsArea.style.display = isOrderFinalized ? 'none' : 'block';
                
                if (order.items.length === 0) {
                    orderItemsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No items have been added to this order yet.</td></tr>`;
                    return;
                }

                order.items.forEach(item => {
                    const isFullyPicked = item.picked_quantity >= item.ordered_quantity;
                    const itemRow = orderItemsTableBody.insertRow();
                    itemRow.className = 'fw-bold';
                    if (isFullyPicked && item.ordered_quantity > 0) itemRow.classList.add('table-success');

                    let itemActionButtons = '';
                    if (canManage && !isOrderFinalized) {
                         itemActionButtons = `<button class="btn btn-sm btn-outline-primary edit-item-btn" title="Edit Ordered Quantity" data-item-id="${item.outbound_item_id}" data-ordered-qty="${item.ordered_quantity}"><i class="bi bi-pencil-square"></i></button> <button class="btn btn-sm btn-outline-danger delete-item-btn" title="Delete Ordered Item" data-item-id="${item.outbound_item_id}" ${item.picked_quantity > 0 ? 'disabled' : ''}><i class="bi bi-trash"></i></button>`;
                    }
                    
                    itemRow.innerHTML = `<td>${item.sku}</td><td>${item.product_name}</td><td>${item.barcode}</td><td>${item.ordered_quantity}</td><td>${item.picked_quantity}</td><td colspan="2"></td><td class="text-center">${itemActionButtons}</td>`;

                    if (item.picks && Array.isArray(item.picks)) {
                        item.picks.forEach(pick => {
                            const pickRow = orderItemsTableBody.insertRow();
                            pickRow.className = 'pick-row';
                            let pickActionButtons = '';
                            if(canManage && !isOrderFinalized) {
                                pickActionButtons = `<button class="btn btn-sm btn-outline-warning unpick-item-btn" title="Unpick this specific item" data-pick-id="${pick.pick_id}"><i class="bi bi-arrow-counterclockwise"></i></button>`;
                            }
                            pickRow.innerHTML = `<td colspan="4" class="text-end border-end-0 fst-italic text-muted">Picked:</td><td class="border-start-0">${pick.picked_quantity}</td><td>${pick.batch_number || 'N/A'}</td><td>${pick.location_code}</td><td class="text-center">${pickActionButtons}</td>`;
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
            if (pickBarcodeInput) pickBarcodeInput.value = '';
            if (pickLocationSelect) pickLocationSelect.innerHTML = '<option value="">Scan product first</option>';
            if (pickBatchNumberSelect) { pickBatchNumberSelect.innerHTML = '<option value="">Select location first</option>'; pickBatchNumberSelect.disabled = true; }
            if (pickQuantityInput) pickQuantityInput.value = '1';
            if(btn.classList.contains('select-order-btn')) Toast.fire({ icon: 'info', title: `Selected Order: ${orderNumber}` });
        });
    }

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.edit-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); handleUpdateOrderItem(btn.dataset.itemId, btn.dataset.orderedQty, orderId); }));
        document.querySelectorAll('.delete-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); if (!btn.disabled) handleDeleteOrderItem(btn.dataset.itemId, orderId); }));
        document.querySelectorAll('.unpick-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); handleUnpickItem(btn.dataset.pickId, orderId); }));
    }

    async function handleUnpickItem(pickId, orderId) {
        Swal.fire({ title: 'Confirm Unpick', text: 'Are you sure you want to return this picked item to stock?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, unpick it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const result = await fetchData('api/outbound.php?action=unpickItem', 'POST', { pick_id: pickId });
                    if (result?.success) {
                        Toast.fire({ icon: 'success', title: result.message });
                        await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
                    }
                } catch (error) {
                    Swal.fire('Error', `An unexpected error occurred while unpicking the item: ${error.message}`, 'error');
                }
            }
        });
    }

    async function handleUpdateOrderItem(itemId, currentQty, orderId) {
        const { value: newQty } = await Swal.fire({ title: 'Update Item Quantity', input: 'number', inputValue: currentQty, inputLabel: 'New Ordered Quantity', inputAttributes: { min: 1 }, showCancelButton: true, inputValidator: (value) => { if (!value || parseInt(value, 10) <= 0) return 'Please enter a valid quantity greater than zero!'; } });
        if (newQty) {
            try {
                const result = await fetchData('api/outbound.php?action=updateOrderItem', 'POST', { outbound_item_id: itemId, new_quantity: parseInt(newQty, 10) });
                if (result?.success) {
                    Toast.fire({ icon: 'success', title: result.message });
                    await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
                }
            } catch (error) {
                Swal.fire('Error', `An unexpected error occurred while updating the item: ${error.message}`, 'error');
            }
        }
    }

    async function handleDeleteOrderItem(itemId, orderId) {
        Swal.fire({ title: 'Confirm Deletion', text: 'Are you sure you want to remove this item from the order?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/outbound.php?action=deleteOrderItem', 'POST', { outbound_item_id: itemId });
                    if (apiResult?.success) {
                        Toast.fire({ icon: 'success', title: apiResult.message });
                        await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
                    }
                } catch (error) {
                    Swal.fire('Error', `An unexpected error occurred while deleting the item: ${error.message}`, 'error');
                }
            }
        });
    }

    async function handleShowAddItemModal() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order first.', 'error'); return; }
        Swal.fire({
            title: 'Add Item to Order',
            html: `<div class="p-2 text-start"><label for="modalProductSelect" class="form-label w-100">Product</label><select id="modalProductSelect" class="form-select w-100" style="width: 100%"></select><br><label for="modalQuantityInput" class="form-label w-100">Quantity</label><input type="number" id="modalQuantityInput" value="1" min="1" class="form-control"></div>`,
            showCancelButton: true, confirmButtonText: 'Add Item',
            didOpen: () => {
                const $select = $('#modalProductSelect');
                $select.html('<option value=""></option>');
                if (allProducts.length > 0) { allProducts.forEach(product => { const optionText = `${product.sku} - ${product.product_name}`; const newOption = new Option(optionText, product.barcode, false, false); if (parseInt(product.total_quantity, 10) <= 0) newOption.disabled = true; $select.append(newOption); }); }
                $select.select2({ placeholder: 'Search by Name, SKU, or Barcode...', theme: 'bootstrap-5', dropdownParent: $('.swal2-container') });
            },
            preConfirm: () => {
                const productBarcode = $('#modalProductSelect').val(); const quantity = $('#modalQuantityInput').val(); const orderedQuantity = parseInt(quantity, 10);
                if (!productBarcode) { Swal.showValidationMessage('You must select a product.'); return false; }
                if (isNaN(orderedQuantity) || orderedQuantity <= 0) { Swal.showValidationMessage('Please enter a valid quantity greater than zero.'); return false; }
                return { product_barcode: productBarcode, ordered_quantity: orderedQuantity };
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                const data = { order_id: selectedOrderId, ...result.value };
                try {
                    const apiResult = await fetchData('api/outbound.php?action=addItem', 'POST', data);
                    if (apiResult?.success) {
                        Toast.fire({ icon: 'success', title: 'Item added successfully!' });
                        await loadOrderItems(selectedOrderId);
                        await loadOutboundOrders();
                    }
                } catch (error) {
                    Swal.fire('Error', `An unexpected error occurred while adding the item: ${error.message}`, 'error');
                }
            }
        });
    }

    async function filterPickLocationsByProduct(productBarcode) {
        if (!productBarcode) {
            if (pickLocationSelect) pickLocationSelect.innerHTML = '<option value="">Enter product barcode first.</option>';
            if (pickBatchNumberSelect) { pickBatchNumberSelect.innerHTML = '<option value="">Select location first</option>'; pickBatchNumberSelect.disabled = true; }
            productInventoryDetails = []; return;
        }
        pickLocationSelect.innerHTML = '<option value="">Loading locations...</option>';
        try {
            const response = await fetchData(`api/inventory.php?product_barcode=${encodeURIComponent(productBarcode)}`);
            productInventoryDetails = (response?.success && Array.isArray(response.data)) ? response.data : [];
            if (productInventoryDetails.length > 0) {
                pickLocationSelect.innerHTML = '<option value="">Select a Pick Location</option>';
                const locations = productInventoryDetails.reduce((acc, item) => { if (!acc[item.location_id]) { acc[item.location_id] = { location_code: item.location_code, total_quantity: 0 }; } acc[item.location_id].total_quantity += item.quantity; return acc; }, {});
                Object.entries(locations).forEach(([location_id, location_info]) => pickLocationSelect.add(new Option(`${location_info.location_code} - ${location_info.total_quantity} units available`, location_id)));
            } else {
                pickLocationSelect.innerHTML = '<option value="">No stock found for this product.</option>';
            }
        } catch (error) {
            Swal.fire('Error', `Could not fetch stock locations: ${error.message}`, 'error');
        }
    }

    function populateBatchDropdown() {
        if (!pickBatchNumberSelect) return;
        const selectedLocationId = pickLocationSelect.value;
        pickBatchNumberSelect.innerHTML = '<option value="">Select a Batch</option>'; pickBatchNumberSelect.disabled = true;
        if (selectedLocationId && productInventoryDetails.length > 0) {
            const batchesForLocation = productInventoryDetails.filter(item => item.location_id == selectedLocationId);
            if (batchesForLocation.length > 0) {
                batchesForLocation.forEach(batch => { const optionText = `${batch.batch_number || 'N/A'} - ${batch.quantity} units`; pickBatchNumberSelect.add(new Option(optionText, batch.batch_number)); });
                pickBatchNumberSelect.disabled = false;
            } else { pickBatchNumberSelect.innerHTML = '<option value="">No batches found</option>'; }
        } else if (!selectedLocationId) { pickBatchNumberSelect.innerHTML = '<option value="">Select location first</option>'; }
    }

    async function handlePickItem() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order first.', 'error'); return; }
        const data = { order_id: selectedOrderId, product_barcode: pickBarcodeInput.value.trim(), location_id: pickLocationSelect.value, picked_quantity: parseInt(pickQuantityInput.value, 10), batch_number: pickBatchNumberSelect.value };
        if (!data.product_barcode || !data.location_id || !data.batch_number || isNaN(data.picked_quantity) || data.picked_quantity <= 0) { Swal.fire('Validation Error', 'Product, Location, Batch, and a valid Quantity are required to pick.', 'error'); return; }
        try {
            const result = await fetchData('api/outbound.php?action=pickItem', 'POST', data);
            if (result?.success) {
                Toast.fire({ icon: 'success', title: result.message });
                const pickedBarcode = pickBarcodeInput.value.trim();
                pickBarcodeInput.value = ''; pickQuantityInput.value = '1';
                await Promise.all([ loadOrderItems(selectedOrderId), loadOutboundOrders(), filterPickLocationsByProduct(pickedBarcode) ]);
            }
        } catch (error) {
            Swal.fire('Error', `An unexpected error occurred while picking the item: ${error.message}`, 'error');
        }
    }

    async function handleShipOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order to ship.', 'error'); return; }
        Swal.fire({ title: 'Confirm Shipment', text: 'Are you sure you want to ship this order?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, ship it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/outbound.php?action=shipOrder', 'POST', { order_id: selectedOrderId });
                    if (apiResult?.success) {
                        Swal.fire('Shipped!', apiResult.message, 'success');
                        selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                        if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                        await loadOutboundOrders();
                    }
                } catch (error) {
                    Swal.fire('Shipment Error', error.message, 'error');
                }
            }
        });
    }

    async function handleCancelOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order to cancel.', 'error'); return; }
        Swal.fire({ title: 'Confirm Cancellation', text: 'Are you sure you want to cancel this order? This will return any picked items to stock and cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, cancel it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/outbound.php?action=cancelOrder', 'POST', { order_id: selectedOrderId });
                    if (apiResult?.success) {
                        Swal.fire('Cancelled!', 'The order has been successfully cancelled.', 'success');
                        selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                        if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                        await loadOutboundOrders();
                    }
                } catch (error) {
                    Swal.fire('Cancellation Error', error.message, 'error');
                }
            }
        });
    }

    async function handlePrintStickers() {
        if (!selectedOrderId) { Swal.fire('Error', 'No order is selected.', 'error'); return; }
        try {
            const response = await fetchData(`api/outbound.php?action=getPickStickers&order_id=${selectedOrderId}`);
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                const stickers = response.data;
                
                let stickerSheet = document.createElement('div');
                stickerSheet.id = 'sticker-sheet-to-print';
                stickerSheet.style.display = 'none';

                stickers.forEach(sticker => {
                    const stickerDiv = document.createElement('div');
                    stickerDiv.className = 'sticker';

                    const from_address_parts = [sticker.warehouse_name, sticker.warehouse_address, sticker.warehouse_city].filter(Boolean);
                    const from_address = from_address_parts.join('<br>');

                    const to_address_parts = [sticker.address_line1, sticker.address_line2, `${sticker.city || ''} ${sticker.state || ''}`, sticker.zip_code, sticker.country].filter(Boolean);
                    const to_address = to_address_parts.join('<br>');

                    stickerDiv.innerHTML = `
                        <div class="sticker-main-content">
                            <div class="address-block">
                                <div class="address-from">
                                    <strong>From:</strong><br>
                                    ${from_address}
                                </div>
                                <div class="address-to">
                                    <strong>To: ${sticker.customer_name}</strong><br>
                                    ${to_address}
                                </div>
                            </div>
                            <div class="product-info-container">
                                <div class="product-block">
                                    <p>Lote: ${sticker.batch_number || 'N/A'}</p>
                                    <p>Order: ${sticker.order_number}</p>
                                    <p class="product-name">${sticker.product_name}</p>
                                </div>
                                <div class="main-qr-code-block" id="qr-${sticker.sticker_code}"></div>
                            </div>
                            <div class="main-barcode-block">
                                <svg class="main-barcode"></svg>
                            </div>
                        </div>
                        <div class="sticker-side-content">
                            <div class="side-barcode-block">
                                <svg class="side-barcode"></svg>
                            </div>
                        </div>
                    `;
                    stickerDiv.querySelector('.main-barcode').setAttribute('jsbarcode-value', sticker.sticker_code);
                    stickerDiv.querySelector('.side-barcode').setAttribute('jsbarcode-value', sticker.tracking_number || sticker.order_number);
                    stickerSheet.appendChild(stickerDiv);
                });
                
                document.body.appendChild(stickerSheet);
                
                JsBarcode(".main-barcode", {
                    width: 2,
                    height: 50,
                    fontSize: 14
                }).init();
                JsBarcode(".side-barcode", {
                    width: 1.5,
                    height: 70,
                    fontSize: 12
                }).init();

                stickers.forEach(sticker => {
                    try {
                        var typeNumber = 4;
                        var errorCorrectionLevel = 'L';
                        var qr = qrcode(typeNumber, errorCorrectionLevel);
                        qr.addData('http://wms.almutlak.com/scan.php?id=' + sticker.tracking_number);
                        qr.make();
                        document.getElementById('qr-' + sticker.sticker_code).innerHTML = qr.createImgTag(3, 4); 
                    } catch (e) {
                        console.error("QR Code generation failed for " + sticker.sticker_code, e);
                    }
                });

                const printWindow = window.open('', 'PRINT', 'height=800,width=1000');
                printWindow.document.write('<html><head><title>Print Stickers</title>');
                printWindow.document.write(`
                    <style>
                        @media print {
                            @page { 
                                size: 15cm 10cm;
                                margin: 0; 
                            }
                            body { 
                                margin: 0; 
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            }
                            .sticker {
                                display: flex;
                                width: 15cm;
                                height: 10cm;
                                padding: 0.5cm;
                                box-sizing: border-box;
                                page-break-after: always;
                            }
                            .sticker:last-child { 
                                page-break-after: auto; 
                            }
                            .sticker-main-content { 
                                flex: 4; 
                                display: flex; 
                                flex-direction: column; 
                                padding-right: 10px;
                            }
                            .sticker-side-content { 
                                flex: 1; 
                                display: flex; 
                                flex-direction: column; 
                                justify-content: flex-end; /* Align barcode to bottom */
                                align-items: center; 
                                border-left: 2px solid #000; 
                                padding-left: 10px;
                                padding-bottom: 0.5cm;
                            }
                            .address-block { 
                                display: flex; 
                                font-size: 9pt; 
                            }
                            .address-from, .address-to { 
                                flex: 1; 
                            }
                            .address-to { 
                                padding-left: 10px; 
                            }
                            .product-info-container {
                                display: flex;
                                margin-top: 10px;
                                align-items: center; /* Vertically align items */
                            }
                            .product-block { 
                                flex: 3;
                                text-align: left; 
                                font-size: 10pt; 
                            }
                            .product-name { 
                                font-size: 16pt; 
                                font-weight: bold; 
                                margin-top: 5px; 
                            }
                            .main-qr-code-block {
                                flex: 1;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                padding-left: 10px;
                            }
                            .main-qr-code-block img {
                                max-width: 100%;
                                height: auto;
                            }
                            .main-barcode-block { 
                                flex-grow: 1; 
                                display: flex; 
                                align-items: flex-end; 
                            }
                            .side-barcode-block { 
                                transform: rotate(-90deg);
                            }
                        }
                    </style>
                `);
                printWindow.document.write('</head><body>');
                printWindow.document.write(stickerSheet.innerHTML);
                printWindow.document.write('</body></html>');
                
                printWindow.document.close();
                printWindow.focus();
                
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                    document.body.removeChild(stickerSheet);
                }, 500);

            } else {
                Swal.fire('No Stickers', 'No stickers have been generated for this order yet. Pick items first.', 'info');
            }
        } catch (error) {
            Swal.fire('Error', `Could not fetch stickers: ${error.message}`, 'error');
        }
    }

    async function handleLogout() {
        try { await fetchData('api/auth.php?action=logout'); redirectToLogin(); } catch (error) { console.error("Logout failed:", error); redirectToLogin(); }
    }

    function copyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text; document.body.appendChild(textArea); textArea.focus(); textArea.select();
        try { document.execCommand('copy'); Toast.fire({ icon: 'success', title: 'Tracking number copied!' }); } catch (err) { Toast.fire({ icon: 'error', title: 'Failed to copy' }); }
        document.body.removeChild(textArea);
    }
});
