// public/js/outbound.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const selectedOrderNumberDisplay = document.getElementById('selectedOrderNumberDisplay');
    const trackingNumberDisplay = document.getElementById('trackingNumberDisplay');
    const orderProcessingArea = document.getElementById('orderProcessingArea');
    const currentOrderIdInput = document.getElementById('currentOrderId');
    const orderItemsTableBody = document.getElementById('orderItemsTableBody');
    const pickItemNumberInput = document.getElementById('pickItemNumberInput');
    const pickLocationSelect = document.getElementById('pickLocationSelect');
    const pickQuantityInput = document.getElementById('pickQuantityInput');
    const pickBatchNumberSelect = document.getElementById('pickBatchNumberSelect');
    const pickDotCodeSelect = document.getElementById('pickDotCodeSelect');
    const pickItemBtn = document.getElementById('pickItemBtn');
    const shipOrderBtn = document.getElementById('shipOrderBtn');
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    const addItemContainer = document.getElementById('addItemContainer');
    const pickAndShipActionsArea = document.getElementById('pickAndShipActionsArea');
    const statusFilter = document.getElementById('statusFilter');
    const showCreateOrderModalBtn = document.getElementById('showCreateOrderModalBtn');
    const printStickersBtn = document.getElementById('printStickersBtn');
    const assignDriverArea = document.getElementById('assignDriverArea');
    const driverSelect = document.getElementById('driverSelect');
    const assignDriverBtn = document.getElementById('assignDriverBtn');

    // --- State Variables ---
    let selectedOrderId = null;
    let allProducts = [];
    let allCustomers = [];
    let allWarehouseLocations = [];
    let warehouseLocationsMap = new Map();
    let productInventoryDetails = [];
    let ordersTable = null;
    let currentOrderItems = []; // To hold items of the selected order

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
    if (pickLocationSelect) $(pickLocationSelect).on('change', populateBatchDropdown);
    if (pickBatchNumberSelect) $(pickBatchNumberSelect).on('change', populateDotCodeDropdown);
    if (statusFilter) statusFilter.addEventListener('change', filterOrdersByStatus);
    if (printStickersBtn) printStickersBtn.addEventListener('click', handlePrintStickers);
    if (pickQuantityInput) pickQuantityInput.addEventListener('input', validatePickQuantity);
    if (pickDotCodeSelect) $(pickDotCodeSelect).on('change', validatePickQuantity);
    if (assignDriverBtn) assignDriverBtn.addEventListener('click', handleAssignDriver);

    if (pickItemNumberInput) {
        pickItemNumberInput.addEventListener('change', () => filterPickLocationsByProduct(pickItemNumberInput.value.trim()));
    }

    // --- Core Functions ---
    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire({ icon: 'warning', title: 'No Warehouse Selected', text: 'Please select a warehouse on the Dashboard to enable outbound operations.'});
            if(document.getElementById('outboundOrdersTableBody')) document.getElementById('outboundOrdersTableBody').innerHTML = `<tr><td colspan="7" class="text-center p-4">Please select a warehouse first.</td></tr>`;
            if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
            return;
        }
        initializeOrdersDataTable();
        
        $('#pickLocationSelect').select2({ theme: 'bootstrap-5' });
        $('#driverSelect').select2({ theme: 'bootstrap-5', placeholder: 'Select a driver...' });
        
        $('#pickDotCodeSelect').select2({
            theme: 'bootstrap-5',
            templateResult: formatDotOption,
            templateSelection: (data) => data.text,
            escapeMarkup: m => m
        });

        try {
            await Promise.all([ 
                loadCustomersForDropdown(), 
                loadProductsForDropdown(), 
                loadOutboundOrders(),
                loadAllWarehouseLocations()
            ]);
        } catch (error) {
            Swal.fire('Initialization Error', `Could not load initial page data. ${error.message}`, 'error');
        }
    }

    function initializeOrdersDataTable() {
        ordersTable = $('#outboundOrdersTable').DataTable({
            responsive: true,
            "order": [[ 4, "desc" ]],
            "columnDefs": [
                { "targets": [0, 1, 2, 3, 4, 5], "className": "align-middle" }, 
                { "targets": 6, "className": "text-end align-middle" } 
            ]
        });
        $('#outboundOrdersTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadCustomersForDropdown() {
        try {
            const response = await fetchData('api/customers_api.php');
            if (response?.success && Array.isArray(response.data)) {
                allCustomers = response.data;
            }
        } catch (error) {
            Swal.fire('Error', `Could not load customers: ${error.message}`, 'error');
        }
    }

    async function loadProductsForDropdown() {
        try {
            const response = await fetchData('api/products_api.php'); 
            if (response?.success && Array.isArray(response.data)) allProducts = response.data;
        } catch (error) {
            Swal.fire('Error', `Could not load the product list: ${error.message}`, 'error');
        }
    }
    
    async function loadAllWarehouseLocations() {
        if (!currentWarehouseId) return;
        try {
            const response = await fetchData(`api/locations_api.php`);
            if (response?.success && Array.isArray(response.data)) {
                allWarehouseLocations = response.data.filter(loc => loc.is_active);
                warehouseLocationsMap = new Map(allWarehouseLocations.map(loc => [parseInt(loc.location_id, 10), loc]));
            }
        } catch (error) {
            console.error('Failed to load warehouse locations', error);
            Toast.fire({ icon: 'error', title: 'Could not load location data.' });
        }
    }

    async function loadOutboundOrders() {
        try {
            const response = await fetchData('api/outbound_api.php');
            const canManageOutbound = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
            
            const tableData = response.data.map(order => {
                let actionButtons = `<button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-outline-secondary view-details-btn" title="Details"><i class="bi bi-eye"></i></button>`;
                if (order.status !== 'Shipped' && order.status !== 'Delivered' && order.status !== 'Cancelled' && canManageOutbound) {
                    actionButtons += ` <button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-primary select-order-btn ms-1" title="Process"><i class="bi bi-gear"></i></button>`;
                }
                return [ 
                    order.order_number || 'N/A', 
                    order.reference_number || 'N/A',
                    order.customer_name || 'N/A', 
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
                const status = this.data()[5]; 
                const statusMap = { 'Delivered': 'bg-success', 'Out for Delivery': 'bg-primary', 'Shipped': 'bg-info', 'Picked': 'bg-primary', 'Partially Picked': 'bg-warning text-dark', 'New': 'bg-secondary', 'Pending Pick': 'bg-secondary', 'Cancelled': 'bg-danger' };
                const statusClass = statusMap[status] || 'bg-secondary';
                $(row).find('td').eq(5).html(`<span class="badge ${statusClass}">${status}</span>`); 
            });
        } catch (error) {
            Swal.fire('Error', `Could not load outbound orders: ${error.message}`, 'error');
        }
    }

    function filterOrdersByStatus() {
        ordersTable.column(5).search(this.value ? '^' + this.value + '$' : '', true, false).draw(); 
    }

    async function handleShowCreateOrderModal() {
        const customerOptions = allCustomers.map(customer => `<option value="${customer.customer_id}">${customer.customer_name}</option>`).join('');
        Swal.fire({
            title: 'Create New Outbound Order',
            html: `
                <div class="p-2 text-start">
                    <div class="mb-3"><label for="swal-customer" class="form-label">Customer</label><select id="swal-customer" class="form-select"><option value="">Select a Customer</option>${customerOptions}</select></div>
                    <div class="mb-3"><label for="swal-reference-number" class="form-label">Reference Number</label><input type="text" id="swal-reference-number" class="form-control" placeholder="Optional customer PO or reference..."></div>
                    <div class="mb-3"><label for="swal-ship-date" class="form-label">Required Ship Date</label><input type="date" id="swal-ship-date" class="form-control"></div>
                    <div class="mb-3"><label for="swal-delivery-note" class="form-label">Delivery Note</label><textarea id="swal-delivery-note" class="form-control" rows="3" placeholder="Enter any special instructions for the delivery..."></textarea></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Create Order',
            preConfirm: () => {
                const customerId = document.getElementById('swal-customer').value;
                const requiredShipDate = document.getElementById('swal-ship-date').value;
                const deliveryNote = document.getElementById('swal-delivery-note').value;
                const referenceNumber = document.getElementById('swal-reference-number').value;
                
                if (!customerId) Swal.showValidationMessage('Please select a customer.');
                else if (!requiredShipDate) Swal.showValidationMessage('Please select a required ship date.');
                else return { customer_id: customerId, required_ship_date: requiredShipDate, delivery_note: deliveryNote, reference_number: referenceNumber };
                return false;
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const apiResult = await fetchData('api/outbound_api.php?action=createOrder', 'POST', result.value);
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
        orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">Loading items...</td></tr>`;
        trackingNumberDisplay.innerHTML = '';
        currentOrderItems = []; 

        try {
            const response = await fetchData(`api/outbound_api.php?order_id=${orderId}`);
            orderItemsTableBody.innerHTML = '';

            if (response?.success && response.data) {
                const order = response.data;
                currentOrderItems = order.items || []; 
                const canManage = ['operator', 'manager'].includes(currentWarehouseRole);
                const isOrderFinalized = ['Shipped', 'Delivered', 'Cancelled', 'Out for Delivery'].includes(order.status);
                
                pickAndShipActionsArea.style.display = canManage && !isOrderFinalized ? 'block' : 'none';
                assignDriverArea.classList.toggle('d-none', !(canManage && order.status === 'Shipped'));

                if (canManage && order.status === 'Shipped') {
                    await loadAndPopulateDrivers();
                }

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
                    if (canManage && !isOrderFinalized) {
                         itemActionButtons = `<button class="btn btn-sm btn-outline-primary edit-item-btn" title="Edit Ordered Quantity" data-item-id="${item.outbound_item_id}" data-ordered-qty="${item.ordered_quantity}"><i class="bi bi-pencil-square"></i></button> <button class="btn btn-sm btn-outline-danger delete-item-btn" title="Delete Ordered Item" data-item-id="${item.outbound_item_id}" ${item.picked_quantity > 0 ? 'disabled' : ''}><i class="bi bi-trash"></i></button>`;
                    }
                    
                    itemRow.innerHTML = `<td>${item.sku}</td><td>${item.product_name}</td><td>${item.barcode}</td><td>${item.ordered_quantity}</td><td>${item.picked_quantity}</td><td colspan="3"></td><td class="text-center">${itemActionButtons}</td>`;

                    if (item.picks && Array.isArray(item.picks)) {
                        item.picks.forEach(pick => {
                            const pickRow = orderItemsTableBody.insertRow();
                            pickRow.className = 'pick-row';
                            let pickActionButtons = '';
                            if(canManage && !isOrderFinalized) {
                                pickActionButtons = `<button class="btn btn-sm btn-outline-warning unpick-item-btn" title="Unpick this specific item" data-pick-id="${pick.pick_id}"><i class="bi bi-arrow-counterclockwise"></i></button>`;
                            }
                            pickRow.innerHTML = `<td colspan="5" class="text-end border-end-0 fst-italic text-muted">Picked: ${pick.picked_quantity}</td><td class="border-start-0">${pick.batch_number || 'N/A'}</td><td>${pick.dot_code || 'N/A'}</td><td>${pick.location_code}</td><td class="text-center">${pickActionButtons}</td>`;
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
            if (pickItemNumberInput) pickItemNumberInput.value = '';
            if (pickLocationSelect) {
                $(pickLocationSelect).empty().append(new Option('Enter item number first', '')).trigger('change');
            }
            if (pickBatchNumberSelect) { pickBatchNumberSelect.innerHTML = '<option value="">Select location first</option>'; pickBatchNumberSelect.disabled = true; }
            if (pickDotCodeSelect) { pickDotCodeSelect.innerHTML = '<option value="">Select batch first</option>'; pickDotCodeSelect.disabled = true; }
            if (pickQuantityInput) pickQuantityInput.value = '1';
            if(btn.classList.contains('select-order-btn')) Toast.fire({ icon: 'info', title: `Selected Order: ${orderNumber}` });
        });
    }

    async function loadAndPopulateDrivers() {
        const result = await fetchData('api/outbound_api.php?action=getDrivers');
        const $driverSelect = $(driverSelect);
        
        $driverSelect.empty(); 

        if (result && result.success && result.data.length > 0) {
            $driverSelect.append(new Option('', '')); 
            
            result.data.forEach(driver => {
                const newOption = new Option(driver.full_name, driver.user_id, false, false);
                $driverSelect.append(newOption);
            });
            
            assignDriverBtn.disabled = false;
        } else {
            $driverSelect.append(new Option('No drivers available', ''));
            assignDriverBtn.disabled = true;
        }
        
        $driverSelect.trigger('change');
    }

    async function handleAssignDriver() {
        const driverId = driverSelect.value;
        if (!selectedOrderId || !driverId) {
            Swal.fire('Validation Error', 'Please select an order and a driver.', 'error');
            return;
        }
        const result = await fetchData('api/outbound_api.php?action=assignDriver', 'POST', { order_id: selectedOrderId, driver_user_id: driverId });
        if (result?.success) {
            Toast.fire({ icon: 'success', title: result.message });
            await Promise.all([loadOutboundOrders(), loadOrderItems(selectedOrderId)]);
        }
    }

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.edit-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); handleUpdateOrderItem(btn.dataset.itemId, btn.dataset.orderedQty, orderId); }));
        document.querySelectorAll('.delete-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); if (!btn.disabled) handleDeleteOrderItem(btn.dataset.itemId, orderId); }));
        document.querySelectorAll('.unpick-item-btn').forEach(button => button.addEventListener('click', (event) => { const btn = event.target.closest('button'); handleUnpickItem(btn.dataset.pickId, orderId); }));
    }

    async function handleUnpickItem(pickId, orderId) {
        Swal.fire({ title: 'Confirm Unpick', text: 'Are you sure you want to return this picked item to stock?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, unpick it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/outbound_api.php?action=unpickItem', 'POST', { pick_id: pickId });
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
                } else {
                    Swal.fire('Error', apiResult.message || 'Failed to unpick item.', 'error');
                }
            }
        });
    }

    async function handleUpdateOrderItem(itemId, currentQty, orderId) {
        const { value: newQty } = await Swal.fire({ title: 'Update Item Quantity', input: 'number', inputValue: currentQty, inputLabel: 'New Ordered Quantity', inputAttributes: { min: 1 }, showCancelButton: true, inputValidator: (value) => { if (!value || parseInt(value, 10) <= 0) return 'Please enter a valid quantity greater than zero!'; } });
        if (newQty) {
            const result = await fetchData('api/outbound_api.php?action=updateOrderItem', 'POST', { outbound_item_id: itemId, new_quantity: parseInt(newQty, 10) });
            if (result?.success) {
                Toast.fire({ icon: 'success', title: result.message });
                await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
            } else {
                Swal.fire('Error', result.message || 'Failed to update item.', 'error');
            }
        }
    }

    async function handleDeleteOrderItem(itemId, orderId) {
        Swal.fire({ title: 'Confirm Deletion', text: 'Are you sure you want to remove this item from the order?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/outbound_api.php?action=deleteOrderItem', 'POST', { outbound_item_id: itemId });
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    await Promise.all([loadOrderItems(orderId), loadOutboundOrders()]);
                } else {
                    Swal.fire('Error', apiResult.message || 'Failed to delete item.', 'error');
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
                if (allProducts.length > 0) { 
                    allProducts.forEach(product => { 
                        const optionText = `${product.sku} - ${product.product_name} - ${product.barcode}`; 
                        const newOption = new Option(optionText, product.barcode, false, false); 
                        if (parseInt(product.total_quantity, 10) <= 0) newOption.disabled = true; 
                        $select.append(newOption); 
                    }); 
                }
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
                const apiResult = await fetchData('api/outbound_api.php?action=addItem', 'POST', data);
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: 'Item added successfully!' });
                    await loadOrderItems(selectedOrderId);
                    await loadOutboundOrders();
                } else {
                    Swal.fire('Error', apiResult.message || 'Failed to add item.', 'error');
                }
            }
        });
    }

    async function filterPickLocationsByProduct(productBarcode) {
        $(pickLocationSelect).empty().append(new Option('Enter item number first', '')).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true);
        $(pickDotCodeSelect).empty().append(new Option('Select batch first', '')).prop('disabled', true).trigger('change');
        productInventoryDetails = []; 

        if (!productBarcode) return;

        const product = allProducts.find(p => p.barcode === productBarcode || p.sku === productBarcode);
        if (!product) {
            Swal.fire('Error', 'Product not found in system.', 'error');
            return;
        }

        const isOnOrder = currentOrderItems.some(item => item.product_id == product.product_id);
        if (!isOnOrder) {
            Swal.fire('Error', 'This product is not on the selected order.', 'error');
            return;
        }

        $(pickLocationSelect).empty().append(new Option('Loading locations...', '')).trigger('change');
        
        try {
            const response = await fetchData(`api/inventory_api.php?product_id=${product.product_id}`);
            productInventoryDetails = (response?.success && Array.isArray(response.data)) ? response.data : [];

            const locationsWithStock = [...new Set(productInventoryDetails.map(item => parseInt(item.location_id, 10)))]
                .map(id => warehouseLocationsMap.get(id))
                .filter(Boolean);

            $(pickLocationSelect).empty().append(new Option('Select a Pick Location', ''));
            locationsWithStock.forEach(location => {
                const totalQty = productInventoryDetails
                    .filter(i => i.location_id == location.location_id)
                    .reduce((sum, i) => sum + i.quantity, 0);
                if (totalQty > 0) {
                    const option = new Option(`${location.location_code} (Available: ${totalQty})`, location.location_id);
                    $(pickLocationSelect).append(option);
                }
            });

            if ($(pickLocationSelect).find('option').length <= 1) {
                 $(pickLocationSelect).empty().append(new Option('No stock available in any location', '')).trigger('change');
            }
            $(pickLocationSelect).trigger('change');
        } catch (error) {
            Swal.fire('Error', `Could not fetch stock locations: ${error.message}`, 'error');
        } 
    }

    function populateBatchDropdown() {
        const selectedLocationId = pickLocationSelect.value;
        $(pickBatchNumberSelect).empty().prop('disabled', true).trigger('change');
        
        if (selectedLocationId && productInventoryDetails.length > 0) {
            const batchesForLocation = [...new Set(productInventoryDetails
                .filter(item => item.location_id == selectedLocationId && item.quantity > 0)
                .map(item => item.batch_number || 'N/A')
            )];
            
            if (batchesForLocation.length > 0) {
                $(pickBatchNumberSelect).append(new Option('Select a Batch', ''));
                batchesForLocation.forEach(batch => { 
                    const totalQty = productInventoryDetails
                        .filter(i => i.location_id == selectedLocationId && (i.batch_number || 'N/A') === batch)
                        .reduce((sum, i) => sum + i.quantity, 0);
                    $(pickBatchNumberSelect).append(new Option(`${batch} (${totalQty} units)`, batch));
                });
                $(pickBatchNumberSelect).prop('disabled', false);
            } else { 
                $(pickBatchNumberSelect).append(new Option('No batches found', '')); 
            }
        } else { 
            $(pickBatchNumberSelect).append(new Option('Select location first', '')); 
        }
        $(pickBatchNumberSelect).trigger('change');
    }

    function populateDotCodeDropdown() {
        const selectedLocationId = pickLocationSelect.value;
        const selectedBatch = pickBatchNumberSelect.value;
        const $dotSelect = $(pickDotCodeSelect);
        $dotSelect.empty().prop('disabled', true);

        if (selectedLocationId && selectedBatch) {
            const dotCodesForBatch = productInventoryDetails
                .filter(item => 
                    item.location_id == selectedLocationId && 
                    (item.batch_number || 'N/A') === selectedBatch &&
                    item.quantity > 0 &&
                    item.dot_code
                );

            dotCodesForBatch.sort((a, b) => {
                const yearA = parseInt(a.dot_code.substring(2), 10);
                const weekA = parseInt(a.dot_code.substring(0, 2), 10);
                const yearB = parseInt(b.dot_code.substring(2), 10);
                const weekB = parseInt(b.dot_code.substring(0, 2), 10);
                if (yearA !== yearB) return yearA - yearB;
                return weekA - weekB;
            });
            
            if (dotCodesForBatch.length > 0) {
                $dotSelect.append(new Option('Select a DOT Code', ''));
                const totalDots = dotCodesForBatch.length;
                dotCodesForBatch.forEach((item, index) => {
                    const optionText = `DOT: ${item.dot_code} (Qty: ${item.quantity})`;
                    const newOption = new Option(optionText, item.dot_code);

                    if (totalDots > 1) {
                        if (index === 0) {
                            newOption.dataset.badgeClass = 'bg-success';
                            newOption.dataset.badgeText = 'Oldest';
                        } else if (index === totalDots - 1) {
                            newOption.dataset.badgeClass = 'bg-danger';
                            newOption.dataset.badgeText = 'Newest';
                        }
                    }
                    $dotSelect.append(newOption);
                });
                $dotSelect.prop('disabled', false);
            } else {
                $dotSelect.append(new Option('No DOTs found', ''));
            }
        } else {
            $dotSelect.append(new Option('Select batch first', ''));
        }
        $dotSelect.trigger('change');
        validatePickQuantity();
    }
    
    function formatDotOption(option) {
        if (!option.id) {
            return option.text;
        }
        const badgeClass = option.element.dataset.badgeClass;
        const badgeText = option.element.dataset.badgeText;
        
        let badgeHtml = '';
        if (badgeClass && badgeText) {
            badgeHtml = `<span class="badge ${badgeClass} float-end">${badgeText}</span>`;
        }
        
        return $(`<div>${option.text}${badgeHtml}</div>`);
    }

    async function handlePickItem() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order first.', 'error'); return; }
        const data = { 
            order_id: selectedOrderId, 
            product_barcode: pickItemNumberInput.value.trim(), 
            location_id: pickLocationSelect.value, 
            picked_quantity: parseInt(pickQuantityInput.value, 10), 
            batch_number: pickBatchNumberSelect.value === 'N/A' ? null : pickBatchNumberSelect.value, 
            dot_code: pickDotCodeSelect.value 
        };
        
        if (!data.product_barcode || !data.location_id || !data.batch_number || !data.dot_code || isNaN(data.picked_quantity) || data.picked_quantity <= 0) { 
            Swal.fire('Validation Error', 'Product, Location, Batch, DOT Code, and a valid Quantity are required to pick.', 'error'); 
            return; 
        }
        
        try {
            const result = await fetchData('api/outbound_api.php?action=pickItem', 'POST', data);
            if (result?.success) {
                Swal.fire('Success!', result.message, 'success');
                
                pickItemNumberInput.value = ''; 
                pickQuantityInput.value = '1';
                $(pickLocationSelect).empty().append(new Option('Enter item number first', '')).trigger('change');
                $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true);
                $(pickDotCodeSelect).empty().append(new Option('Select batch first', '')).prop('disabled', true).trigger('change');

                await loadOrderItems(selectedOrderId);
                await loadOutboundOrders();
            }
        } catch (error) {
            Swal.fire('Picking Error', error.message || 'An unknown error occurred.', 'error');
        }
    }

    async function handleShipOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order to ship.', 'error'); return; }
        Swal.fire({ title: 'Confirm Shipment', text: 'Are you sure you want to ship this order?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, ship it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/outbound_api.php?action=shipOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    Swal.fire('Shipped!', apiResult.message, 'success');
                    selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                    if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                    await loadOutboundOrders();
                } else {
                    Swal.fire('Shipment Error', apiResult.message || 'Failed to ship order.', 'error');
                }
            }
        });
    }

    async function handleCancelOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order to cancel.', 'error'); return; }
        Swal.fire({ title: 'Confirm Cancellation', text: 'Are you sure you want to cancel this order? This will return any picked items to stock and cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, cancel it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/outbound_api.php?action=cancelOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    Swal.fire('Cancelled!', 'The order has been successfully cancelled.', 'success');
                    selectedOrderId = null; currentOrderIdInput.value = ''; selectedOrderNumberDisplay.textContent = '';
                    if(orderProcessingArea) orderProcessingArea.classList.add('d-none');
                    await loadOutboundOrders();
                } else {
                    Swal.fire('Cancellation Error', apiResult.message || 'Failed to cancel order.', 'error');
                }
            }
        });
    }

    function validatePickQuantity() {
        const quantityErrorDiv = document.getElementById('pickQuantityError');
        quantityErrorDiv.textContent = '';
        pickItemBtn.disabled = false;
        const selectedLocationId = pickLocationSelect.value;
        const selectedBatch = pickBatchNumberSelect.value;
        const selectedDot = pickDotCodeSelect.value;
        const enteredQty = parseInt(pickQuantityInput.value, 10);

        if (!selectedLocationId || !selectedBatch || !selectedDot || isNaN(enteredQty) || enteredQty <= 0) {
            pickItemBtn.disabled = true;
            return;
        }
        const inventoryItem = productInventoryDetails.find(item => 
            item.location_id == selectedLocationId && 
            (item.batch_number || 'N/A') === selectedBatch &&
            item.dot_code === selectedDot
        );
        if (inventoryItem && enteredQty > inventoryItem.quantity) {
            quantityErrorDiv.textContent = `Only ${inventoryItem.quantity} available for this DOT.`;
            pickItemBtn.disabled = true;
        }
    }

    async function handlePrintStickers() {
        if (!selectedOrderId) { Swal.fire('Error', 'No order is selected.', 'error'); return; }
        try {
            const response = await fetchData(`api/outbound_api.php?action=getPickStickers&order_id=${selectedOrderId}`);
            if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                const stickers = response.data;
                
                let stickerSheetHtml = '';
                const generatorContainer = document.createElement('div');
                generatorContainer.style.display = 'none';
                document.body.appendChild(generatorContainer);

                for (const sticker of stickers) {
                    const mainBarcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    const sideBarcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    
                    generatorContainer.appendChild(mainBarcodeSvg);
                    generatorContainer.appendChild(sideBarcodeSvg);

                    JsBarcode(mainBarcodeSvg, sticker.sticker_code, { format: "CODE128", width: 2, height: 90, fontSize: 14, displayValue: true });
                    JsBarcode(sideBarcodeSvg, sticker.tracking_number || sticker.order_number, { format: "CODE128", width: 1.5, height: 70, fontSize: 12, displayValue: false });

                    const mainBarcodeHtml = mainBarcodeSvg.outerHTML;
                    const sideBarcodeHtml = sideBarcodeSvg.outerHTML;

                    const from_address = [sticker.warehouse_name, sticker.warehouse_address, sticker.warehouse_city].filter(Boolean).join('<br>');
                    const to_address = [sticker.address_line1, sticker.address_line2, `${sticker.city || ''} ${sticker.state || ''}`, sticker.zip_code, sticker.country].filter(Boolean).join('<br>');
                    
                    let qrImgTag = '';
                    try {
                        const qr = qrcode(4, 'L');
                        qr.addData('http://wms.almutlak.com/scan.php?id=' + sticker.tracking_number);
                        qr.make();
                        qrImgTag = qr.createImgTag(3, 4);
                    } catch (e) { console.error("QR Code generation failed", e); }

                    stickerSheetHtml += `
                        <div class="sticker">
                            <div class="sticker-main-content">
                                <div class="address-block">
                                    <div class="address-from"><strong>From:</strong><br>${from_address}</div>
                                    <div class="address-to"><strong>To: ${sticker.customer_name}</strong><br>${to_address}</div>
                                </div>
                                <div class="product-info-container">
                                    <div class="product-block">
                                        <p>Order: ${sticker.order_number} | Batch: ${sticker.batch_number || 'N/A'} | DOT: ${sticker.dot_code || 'N/A'}</p>
                                        <p class="product-name">${sticker.product_name}</p>
                                        <p style="font-weight: bold; font-size: 12pt; margin-top: 4px;">
                                            ${sticker.barcode} &nbsp;&nbsp;&nbsp; ${sticker.item_sequence} / ${sticker.item_total}
                                        </p>
                                        <div class="barcode-and-counter" style="text-align: center; margin-top: 10px;">${mainBarcodeHtml}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="sticker-side-content"><div class="side-barcode-block">${sideBarcodeHtml}</div></div>
                        </div>`;
                }

                document.body.removeChild(generatorContainer);
                const printWindow = window.open('', 'PRINT', 'height=800,width=1000');
                printWindow.document.write('<html><head><title>Print Stickers</title>');
                printWindow.document.write(`<style>@media print{@page{size: 15cm 10cm;margin: 0;}body{margin: 0;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;}.sticker{display: flex;width: 14.5cm;height: 9.5cm;padding: 0.25cm;box-sizing: border-box;page-break-after: always;border: 1px dashed #ccc;margin: 0.25cm;}.sticker:last-child{page-break-after: auto;}.sticker-main-content{flex: 4;display: flex;flex-direction: column;padding-right: 5px;}.sticker-side-content{flex: 1;display: flex;flex-direction: column;justify-content: flex-end;align-items: center;border-left: 2px solid #000;padding-left: 5px;padding-bottom: 0.5cm;}.address-block{display: flex;font-size: 9pt;border-bottom: 1px solid #ccc;padding-bottom: 5px;margin-bottom: 5px;}.address-from, .address-to{flex: 1;}.address-to{padding-left: 10px;}.product-info-container{display: flex;flex-grow: 1;align-items: center;}.product-block{flex: 3;text-align: left;font-size: 10pt;display: flex;flex-direction: column;}.product-name{font-size: 14pt;font-weight: bold;margin-top: 5px;flex-grow: 1;}.main-qr-code-block{flex: 1;display: flex;align-items: center;justify-content: center;padding-left: 10px;}.main-qr-code-block img{max-width: 100%;height: auto;}.side-barcode-block{transform: rotate(-90deg);}}</style>`);
                printWindow.document.write('</head><body>' + stickerSheetHtml + '</body></html>');
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
            } else {
                Swal.fire('No Stickers', response.message || 'No stickers have been generated for this order yet. Pick items first.', 'info');
            }
        } catch (error) {
            Swal.fire('Error', `Could not generate stickers: ${error.message}`, 'error');
        }
    }

    function copyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text; document.body.appendChild(textArea); textArea.focus(); textArea.select();
        try { document.execCommand('copy'); Toast.fire({ icon: 'success', title: 'Tracking number copied!' }); } catch (err) { Toast.fire({ icon: 'error', title: 'Failed to copy' }); }
        document.body.removeChild(textArea);
    }
});
