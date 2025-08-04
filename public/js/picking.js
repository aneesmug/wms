// public/js/picking.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const selectedOrderNumberDisplay = document.getElementById('selectedOrderNumberDisplay');
    const pickingProcessArea = document.getElementById('pickingProcessArea');
    const currentOrderIdInput = document.getElementById('currentOrderId');
    const orderItemsTableBody = document.getElementById('orderItemsTableBody');
    const pickItemNumberInput = document.getElementById('pickItemNumberInput');
    const pickLocationSelect = document.getElementById('pickLocationSelect');
    const pickQuantityInput = document.getElementById('pickQuantityInput');
    const pickBatchNumberSelect = document.getElementById('pickBatchNumberSelect');
    const pickDotCodeSelect = document.getElementById('pickDotCodeSelect');
    const pickItemBtn = document.getElementById('pickItemBtn');
    const printStickersBtn = document.getElementById('printStickersBtn');
    const printPickReportBtn = document.getElementById('printPickReportBtn');
    const stageOrderBtn = document.getElementById('stageOrderBtn');
    const assignDriverBtn = document.getElementById('assignDriverBtn');
    const shippingAreaDisplay = document.getElementById('shippingAreaDisplay');
    const driverInfoDisplay = document.getElementById('driverInfoDisplay');
    const pickActionsArea = document.getElementById('pickActionsArea');
    const managementActionsArea = document.getElementById('managementActionsArea');
    
    // --- State Variables ---
    let selectedOrderId = null;
    let allProducts = [];
    let productInventoryDetails = []; // Holds details for validation
    let ordersTable = null;
    let currentOrderItems = []; 
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');

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
    if (pickItemBtn) pickItemBtn.addEventListener('click', handlePickItem);
    if (printStickersBtn) printStickersBtn.addEventListener('click', handlePrintStickers);
    if (printPickReportBtn) printPickReportBtn.addEventListener('click', handlePrintPickReport);
    if (stageOrderBtn) stageOrderBtn.addEventListener('click', handleStageOrder);
    if (assignDriverBtn) assignDriverBtn.addEventListener('click', handleAssignDriver);
    
    // NEW picking workflow event listeners
    if (pickItemNumberInput) pickItemNumberInput.addEventListener('change', handleProductScan);
    if (pickDotCodeSelect) $(pickDotCodeSelect).on('change', handleDotSelect);
    if (pickLocationSelect) $(pickLocationSelect).on('change', handleLocationSelect);
    if (pickBatchNumberSelect) $(pickBatchNumberSelect).on('change', () => validatePickQuantity());
    if (pickQuantityInput) pickQuantityInput.addEventListener('input', validatePickQuantity);


    async function initializePage() {
        initializeOrdersDataTable();
        // Initialize Select2 for all dropdowns
        $('#pickDotCodeSelect, #pickLocationSelect, #pickBatchNumberSelect').select2({ theme: 'bootstrap-5' });
        
        // Customize DOT code dropdown to show badges
        $('#pickDotCodeSelect').select2({
            theme: 'bootstrap-5',
            templateResult: formatDotOption,
            templateSelection: (data) => data.text,
            escapeMarkup: m => m
        });

        try {
            await Promise.all([ 
                loadProductsForDropdown(), 
                loadPickableOrders()
            ]);
        } catch (error) {
            Swal.fire('Initialization Error', `Could not load initial page data. ${error.message}`, 'error');
        }
    }

    function initializeOrdersDataTable() {
        ordersTable = $('#pickingOrdersTable').DataTable({
            responsive: true,
            "order": [[ 3, "asc" ]],
            "columnDefs": [
                { "targets": [0, 1, 2, 3, 4, 5], "className": "align-middle" }
            ]
        });
        $('#pickingOrdersTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadProductsForDropdown() {
        const response = await fetchData('api/products_api.php'); 
        if (response?.success && Array.isArray(response.data)) allProducts = response.data;
    }
    
    async function loadPickableOrders() {
        const response = await fetchData('api/picking_api.php?action=getOrdersForPicking');
        if (!response?.success) return;

        const tableData = response.data.map(order => {
            let actionButtons = `<button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-primary select-order-btn" title="Process Order"><i class="bi bi-gear"></i> Process</button>`;
            return [ 
                order.order_number || 'N/A', 
                order.reference_number || 'N/A',
                order.customer_name || 'N/A', 
                order.required_ship_date, 
                order.status, 
                actionButtons 
            ];
        });

        ordersTable.clear();
        ordersTable.rows.add(tableData).draw();
        ordersTable.rows().every(function() {
            const row = this.node();
            const status = this.data()[4];
            const statusMap = { 'Assigned': 'bg-orange', 'Ready for Pickup': 'bg-purple', 'Picked': 'bg-primary', 'Partially Picked': 'bg-warning text-dark', 'Pending Pick': 'bg-secondary' };
            const statusClass = statusMap[status] || 'bg-secondary';
            $(row).find('td').eq(4).html(`<span class="badge ${statusClass}">${status}</span>`); 
        });
    }

    async function loadOrderItems(orderId) {
        if (!orderItemsTableBody) return;
        
        orderItemsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">Loading items...</td></tr>`;
        currentOrderItems = []; 
        
        printStickersBtn.classList.add('d-none');
        printPickReportBtn.classList.add('d-none');
        stageOrderBtn.classList.add('d-none');
        assignDriverBtn.classList.add('d-none');
        pickActionsArea.classList.add('d-none');
        managementActionsArea.classList.add('d-none');
        if(shippingAreaDisplay) shippingAreaDisplay.innerHTML = '';
        if(driverInfoDisplay) driverInfoDisplay.innerHTML = '';

        try {
            const response = await fetchData(`api/picking_api.php?action=getOrderDetails&order_id=${orderId}`);
            orderItemsTableBody.innerHTML = '';

            if (response?.success && response.data) {
                const order = response.data;
                currentOrderItems = order.items || []; 
                const canManage = ['picker', 'operator', 'manager'].includes(currentWarehouseRole);
                
                const isPickable = ['Pending Pick', 'Partially Picked'].includes(order.status);
                const canUnpick = ['Pending Pick', 'Partially Picked', 'Picked'].includes(order.status);
                const canStage = order.status === 'Picked';
                const canAssign = ['Ready for Pickup', 'Assigned'].includes(order.status);

                if (isPickable) pickActionsArea.classList.remove('d-none');
                if (canManage) managementActionsArea.classList.remove('d-none');
                if (canManage && canStage) stageOrderBtn.classList.remove('d-none');
                if (canManage && canAssign) assignDriverBtn.classList.remove('d-none');
                
                if (order.shipping_area_code && shippingAreaDisplay) {
                    shippingAreaDisplay.innerHTML = `<strong>Staged At:</strong> <span class="badge bg-purple">${order.shipping_area_code}</span>`;
                }

                if (order.driver_name && driverInfoDisplay) {
                    driverInfoDisplay.innerHTML = `<strong>Assigned Driver:</strong> <span class="badge bg-info text-dark">${order.driver_name}</span>`;
                }

                const totalPicked = order.items.reduce((sum, item) => sum + (parseInt(item.picked_quantity, 10) || 0), 0);
                if (totalPicked > 0) {
                    printStickersBtn.classList.remove('d-none');
                }
                
                if (order.items.length > 0) {
                    printPickReportBtn.classList.remove('d-none');
                }

                if (order.items.length === 0) {
                    orderItemsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No items have been added to this order yet.</td></tr>`;
                    return;
                }

                order.items.forEach(item => {
                    const isFullyPicked = item.picked_quantity >= item.ordered_quantity;
                    const itemRow = orderItemsTableBody.insertRow();
                    itemRow.className = 'fw-bold';
                    if (isFullyPicked && item.ordered_quantity > 0) itemRow.classList.add('table-success');
                    
                    itemRow.innerHTML = `<td>${item.sku}</td><td>${item.product_name}</td><td>${item.ordered_quantity}</td><td>${item.picked_quantity}</td><td colspan="3"></td><td class="text-center"></td>`;

                    if (item.picks && Array.isArray(item.picks)) {
                        item.picks.forEach(pick => {
                            const pickRow = orderItemsTableBody.insertRow();
                            pickRow.className = 'pick-row';
                            let pickActionButtons = '';
                            if (canUnpick) {
                                pickActionButtons = `<button class="btn btn-sm btn-outline-warning unpick-item-btn" title="Unpick this specific item" data-pick-id="${pick.pick_id}"><i class="bi bi-arrow-counterclockwise"></i></button>`;
                            }
                            pickRow.innerHTML = `<td colspan="4" class="text-end border-end-0 fst-italic text-muted">Picked: ${pick.picked_quantity}</td><td class="border-start-0">${pick.batch_number || 'N/A'}</td><td>${pick.dot_code || 'N/A'}</td><td>${pick.location_code}</td><td class="text-center">${pickActionButtons}</td>`;
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
        $('#pickingOrdersTable tbody').off('click').on('click', '.select-order-btn', function() {
            const btn = this;
            const orderId = btn.dataset.orderId;
            const orderNumber = btn.dataset.orderNumber;
            selectedOrderId = orderId;
            currentOrderIdInput.value = selectedOrderId;
            selectedOrderNumberDisplay.textContent = `#${orderNumber}`;
            if(pickingProcessArea) pickingProcessArea.classList.remove('d-none');
            loadOrderItems(selectedOrderId);
            if (pickItemNumberInput) pickItemNumberInput.value = '';
            
            // Reset all dropdowns
            $(pickDotCodeSelect).empty().append(new Option('Enter item number first', '')).prop('disabled', true).trigger('change');
            $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
            $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true).trigger('change');
            if (pickQuantityInput) pickQuantityInput.value = '1';

            Toast.fire({ icon: 'info', title: `Selected Order: ${orderNumber}` });
        });
    }
    
    /**
     * New Picking Workflow Step 1: Handle product scan/entry.
     * Fetches available DOT codes for the product.
     */
    async function handleProductScan() {
        // Reset all subsequent dropdowns
        $(pickDotCodeSelect).empty().append(new Option('Select DOT', '')).prop('disabled', true).trigger('change');
        $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true).trigger('change');
        productInventoryDetails = [];

        const productarticle_no = pickItemNumberInput.value.trim();
        if (!productarticle_no) return;

        const product = allProducts.find(p => p.article_no === productarticle_no || p.sku === productarticle_no);
        if (!product) {
            Toast.fire({ icon: 'error', title: 'Product not found.' });
            return;
        }

        const orderItem = currentOrderItems.find(item => item.product_id == product.product_id);
        const remainingToPick = orderItem ? (orderItem.ordered_quantity - orderItem.picked_quantity) : 0;
        
        if (!orderItem || remainingToPick <= 0) {
            Toast.fire({ icon: 'warning', title: 'This product is not on the order or is fully picked.' });
            return;
        }

        const response = await fetchData(`api/picking_api.php?action=getDotsForProduct&product_id=${product.product_id}`);
        
        if (response?.success) {
            if (response.data.length > 0) {
                const dotCodes = response.data;
                $(pickDotCodeSelect).empty().append(new Option('Select a DOT Code (Oldest First)', ''));
                dotCodes.forEach((item, index) => {
                    const optionText = `DOT: ${item.dot_code}`;
                    const newOption = new Option(optionText, item.dot_code);
                    if (index === 0) {
                        newOption.dataset.badgeClass = 'bg-success';
                        newOption.dataset.badgeText = 'Oldest (FIFO)';
                    }
                    $(pickDotCodeSelect).append(newOption);
                });
                $(pickDotCodeSelect).prop('disabled', false);
                
                if (dotCodes.length > 0) {
                    $(pickDotCodeSelect).val(dotCodes[0].dot_code).trigger('change');
                }
            } else {
                Toast.fire({ icon: 'error', title: 'No available stock (DOTs) found for this item.' });
                $(pickDotCodeSelect).empty().append(new Option('No stock found', '')).prop('disabled', true).trigger('change');
            }
        } else {
            // This handles the specific error for locked locations
            Toast.fire({ icon: 'error', title: response.message || 'An error occurred.' });
            $(pickDotCodeSelect).empty().append(new Option('Stock unavailable', '')).prop('disabled', true).trigger('change');
        }
    }

    /**
     * New Picking Workflow Step 2: Handle DOT code selection.
     * Fetches locations containing the product with the selected DOT.
     */
    async function handleDotSelect() {
        $(pickLocationSelect).empty().append(new Option('Loading...', '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option('Select Location first', '')).prop('disabled', true).trigger('change');
        
        const productarticle_no = pickItemNumberInput.value.trim();
        const selectedDot = pickDotCodeSelect.value;
        
        if (!productarticle_no || !selectedDot) {
            $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
            return;
        }
        
        const product = allProducts.find(p => p.article_no === productarticle_no || p.sku === productarticle_no);
        if (!product) return;

        const response = await fetchData(`api/picking_api.php?action=getLocationsForDot&product_id=${product.product_id}&dot_code=${selectedDot}`);

        if (response?.success && response.data.length > 0) {
            const locations = response.data;
            $(pickLocationSelect).empty().append(new Option('Select a Pick Location', ''));
            locations.forEach(location => {
                const option = new Option(`${location.location_code} (Available: ${location.available_quantity})`, location.location_id);
                $(pickLocationSelect).append(option);
            });
            $(pickLocationSelect).prop('disabled', false).trigger('change');
        } else {
            $(pickLocationSelect).empty().append(new Option('No locations for this DOT', '')).prop('disabled', true).trigger('change');
        }
    }

    /**
     * New Picking Workflow Step 3: Handle location selection.
     * Fetches batch numbers for the specific item in that location.
     */
    async function handleLocationSelect() {
        $(pickBatchNumberSelect).empty().append(new Option('Loading...', '')).prop('disabled', true).trigger('change');

        const productarticle_no = pickItemNumberInput.value.trim();
        const selectedDot = pickDotCodeSelect.value;
        const selectedLocationId = pickLocationSelect.value;

        if (!productarticle_no || !selectedDot || !selectedLocationId) {
            $(pickBatchNumberSelect).empty().append(new Option('Select Location first', '')).prop('disabled', true).trigger('change');
            return;
        }

        const product = allProducts.find(p => p.article_no === productarticle_no || p.sku === productarticle_no);
        if (!product) return;

        const response = await fetchData(`api/picking_api.php?action=getBatchesForLocationDot&product_id=${product.product_id}&dot_code=${selectedDot}&location_id=${selectedLocationId}`);
        
        // Store details for quantity validation
        productInventoryDetails = (response?.success && Array.isArray(response.data)) ? response.data : [];

        if (response?.success && response.data.length > 0) {
            const batches = response.data;
            $(pickBatchNumberSelect).empty().append(new Option('Select a Batch', ''));
            batches.forEach(batch => {
                const batchNumberText = batch.batch_number || 'N/A';
                const option = new Option(`${batchNumberText} (Qty: ${batch.quantity})`, batchNumberText);
                $(pickBatchNumberSelect).append(option);
            });
            $(pickBatchNumberSelect).prop('disabled', false).trigger('change');
        } else {
            $(pickBatchNumberSelect).empty().append(new Option('No batches found', '')).prop('disabled', true).trigger('change');
        }
    }

    /**
     * Validates the quantity entered against available stock and order requirements.
     */
    function validatePickQuantity() {
        const quantityErrorDiv = document.getElementById('pickQuantityError');
        quantityErrorDiv.textContent = '';
        pickItemBtn.disabled = true; // Disable by default
        
        const selectedBatch = pickBatchNumberSelect.value;
        const enteredQty = parseInt(pickQuantityInput.value, 10);

        if (!pickItemNumberInput.value || !pickDotCodeSelect.value || !pickLocationSelect.value || !selectedBatch || isNaN(enteredQty) || enteredQty <= 0) {
            return;
        }

        // Check against available stock for the specific batch
        const inventoryItem = productInventoryDetails.find(item => (item.batch_number || 'N/A') === selectedBatch);
        if (!inventoryItem || enteredQty > inventoryItem.quantity) {
            quantityErrorDiv.textContent = `Only ${inventoryItem?.quantity || 0} available for this batch.`;
            return;
        }

        // Check against remaining quantity to pick for this item on the order
        const product = allProducts.find(p => p.article_no === pickItemNumberInput.value.trim() || p.sku === pickItemNumberInput.value.trim());
        if (product) {
            const orderItem = currentOrderItems.find(oi => oi.product_id == product.product_id);
            if (orderItem) {
                const remainingToPick = orderItem.ordered_quantity - orderItem.picked_quantity;
                if (enteredQty > remainingToPick) {
                    quantityErrorDiv.textContent = `Order only requires ${remainingToPick} more.`;
                    return;
                }
            }
        }
        
        pickItemBtn.disabled = false; // All checks passed, enable button
    }

    /**
     * Submits the picked item data to the backend.
     */
    async function handlePickItem() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order first.', 'error'); return; }
        
        const productarticle_no = pickItemNumberInput.value.trim();
        const product = allProducts.find(p => p.article_no === productarticle_no || p.sku === productarticle_no);
        if (!product) {
            Swal.fire('Error', 'Could not find product details for the entered article_no/SKU.', 'error');
            return;
        }

        const data = { 
            order_id: selectedOrderId, 
            product_id: product.product_id,
            location_id: pickLocationSelect.value, 
            picked_quantity: parseInt(pickQuantityInput.value, 10), 
            batch_number: pickBatchNumberSelect.value === 'N/A' ? null : pickBatchNumberSelect.value, 
            dot_code: pickDotCodeSelect.value 
        };
        
        if (!data.product_id || !data.location_id || !data.dot_code || isNaN(data.picked_quantity) || data.picked_quantity <= 0) { 
            Swal.fire('Validation Error', 'Product, Location, DOT Code, and a valid Quantity are required to pick.', 'error'); 
            return; 
        }
        
        const result = await fetchData('api/picking_api.php?action=pickItem', 'POST', data);
        if (result?.success) {
            Toast.fire({ icon: 'success', title: result.message });
            const pickedarticle_no = pickItemNumberInput.value.trim();
            const pickedProductId = product.product_id;

            pickItemNumberInput.value = ''; 
            pickQuantityInput.value = '1';
            
            await loadOrderItems(selectedOrderId);
            await loadPickableOrders();

            // Check if there are more of this item to pick before rescanning.
            // This prevents the confusing "fully picked" warning immediately after a successful pick.
            const orderItem = currentOrderItems.find(item => item.product_id == pickedProductId);
            const remainingToPick = orderItem ? (orderItem.ordered_quantity - orderItem.picked_quantity) : 0;

            if (remainingToPick > 0) {
                // If more are needed, rescan the product to refresh dropdowns for the next pick.
                pickItemNumberInput.value = pickedarticle_no;
                await handleProductScan();
            } else {
                // If the item is now fully picked, just reset the dependent dropdowns
                // to prepare for the next, different item scan.
                $(pickDotCodeSelect).empty().append(new Option('Enter item number first', '')).prop('disabled', true).trigger('change');
                $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
                $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true).trigger('change');
            }
        }
    }
    
    function formatDotOption(option) {
        if (!option.id) return option.text;
        const badgeClass = option.element.dataset.badgeClass;
        const badgeText = option.element.dataset.badgeText;
        let badgeHtml = '';
        if (badgeClass && badgeText) {
            badgeHtml = `<span class="badge ${badgeClass} float-end">${badgeText}</span>`;
        }
        return $(`<div>${option.text}${badgeHtml}</div>`);
    }

    // --- Other Action Handlers (Unpick, Stage, Assign, Print) ---

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.unpick-item-btn').forEach(button => button.addEventListener('click', (event) => { 
            const btn = event.target.closest('button'); 
            handleUnpickItem(btn.dataset.pickId, orderId); 
        }));
    }

    async function handleUnpickItem(pickId, orderId) {
        Swal.fire({ title: 'Confirm Unpick', text: 'Are you sure you want to return this picked item to stock?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, unpick it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/picking_api.php?action=unpickItem', 'POST', { pick_id: pickId });
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    await Promise.all([loadOrderItems(orderId), loadPickableOrders()]);
                    await handleProductScan(); // Refresh pick options
                }
            }
        });
    }

    async function handleStageOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'No order selected.', 'error'); return; }
        const areaResponse = await fetchData('api/picking_api.php?action=getShippingAreas');
        if (!areaResponse?.success || !areaResponse.data || areaResponse.data.length === 0) {
            Swal.fire('Configuration Error', 'No active shipping areas have been configured.', 'error');
            return;
        }
        const shippingAreaOptions = areaResponse.data.reduce((opts, area) => {
            opts[area.location_id] = area.location_code;
            return opts;
        }, {});
        const { value: locationId } = await Swal.fire({ title: 'Select Shipping Area', input: 'select', inputOptions: shippingAreaOptions, inputPlaceholder: 'Select an area', showCancelButton: true, inputValidator: (value) => !value && 'You need to select a shipping area!' });
        if (locationId) {
            const result = await fetchData('api/picking_api.php?action=stageOrder', 'POST', { order_id: selectedOrderId, shipping_area_location_id: locationId });
            if (result?.success) {
                Toast.fire({ icon: 'success', title: result.message });
                await Promise.all([loadOrderItems(selectedOrderId), loadPickableOrders()]);
            }
        }
    }

    async function handleAssignDriver() {
        if (!selectedOrderId) { Swal.fire('Error', 'No order selected.', 'error'); return; }
        const driverResponse = await fetchData('api/picking_api.php?action=getDrivers');
        if (!driverResponse?.success || !driverResponse.data || driverResponse.data.length === 0) {
            Swal.fire('Configuration Error', 'No active drivers configured for this warehouse.', 'error');
            return;
        }
        const driverOptions = driverResponse.data.reduce((opts, driver) => {
            opts[driver.user_id] = driver.full_name;
            return opts;
        }, {});
        const { value: driverId } = await Swal.fire({ title: 'Assign Driver to Order', input: 'select', inputOptions: driverOptions, inputPlaceholder: 'Select a driver', showCancelButton: true, inputValidator: (value) => !value && 'You need to select a driver!' });
        if (driverId) {
            const result = await fetchData('api/picking_api.php?action=assignDriver', 'POST', { order_id: selectedOrderId, driver_user_id: driverId });
            if (result?.success) {
                Toast.fire({ icon: 'success', title: result.message });
                await Promise.all([loadOrderItems(selectedOrderId), loadPickableOrders()]);
            }
        }
    }

    async function handlePrintStickers() {
        if (!selectedOrderId) { Swal.fire('Error', 'No order is selected.', 'error'); return; }
        printStickersBtn.disabled = true;
        printStickersBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Printing...';

        try {
            const response = await fetchData(`api/picking_api.php?action=getPickStickers&order_id=${selectedOrderId}`);
            if (!response?.success || !Array.isArray(response.data) || response.data.length === 0) {
                Swal.fire('No Stickers', 'No stickers generated for this order. Pick items first.', 'info');
                return;
            }
            
            const stickers = response.data;
            let stickerSheetHtml = '';

            const generatorContainer = document.createElement('div');
            generatorContainer.style.position = 'absolute';
            generatorContainer.style.left = '-9999px';
            document.body.appendChild(generatorContainer);

            for (const sticker of stickers) {
                const mainarticle_noSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                const sidearticle_noSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                
                generatorContainer.appendChild(mainarticle_noSvg);
                generatorContainer.appendChild(sidearticle_noSvg);

                let shelfLife = 'N/A';
                if (sticker.dot_code && sticker.expiry_years) {
                    const week = sticker.dot_code.substring(0, 2);
                    const year = parseInt(sticker.dot_code.substring(2), 10);
                    const expiry = parseInt(sticker.expiry_years, 10);
                    if (!isNaN(year) && !isNaN(expiry)) {
                        shelfLife = `${week}/${year + expiry}`;
                    }
                }
                
                JsBarcode(mainarticle_noSvg, sticker.sticker_code, { format: "CODE128", height: 30, displayValue: true, fontSize: 14 });
                JsBarcode(sidearticle_noSvg, sticker.tracking_number || sticker.order_number, { format: "CODE128", width: 1.5, height: 70, fontSize: 12, displayValue: true });

                const mainarticle_noHtml = mainarticle_noSvg.outerHTML;
                const sidearticle_noHtml = sidearticle_noSvg.outerHTML;

                const from_address = [sticker.warehouse_name, sticker.warehouse_address, sticker.warehouse_city].filter(Boolean).join('<br>');
                const to_address = [sticker.customer_name, sticker.address_line1, sticker.address_line2, `${sticker.city || ''} ${sticker.state || ''}`, sticker.zip_code, sticker.country].filter(Boolean).join('<br>');
                
                stickerSheetHtml += `
                    <div class="sticker">
                        <div class="sticker-main-content">
                            <div class="address-block">
                                <div class="address-from"><strong>From:</strong><br>${from_address}</div>
                                <div class="address-to"><strong>To: ${sticker.customer_name}</strong><br>${to_address}</div>
                            </div>
                            <div class="product-block">
                                <p>Order: ${sticker.order_number} <br /> Shelf Life: ${shelfLife}</p>
                                <p class="product-name">${sticker.product_name}</p>
                                <p class="product-sku">${sticker.article_no} &nbsp;&nbsp;&nbsp; ${sticker.item_sequence} / ${sticker.item_total}</p>
                            </div>
                            <div class="article_no-block">
                                ${mainarticle_noHtml}
                            </div>
                        </div>
                        <div class="sticker-side-content">
                            <div class="side-article_no-block">${sidearticle_noHtml}</div>
                        </div>
                    </div>`;
            }

            document.body.removeChild(generatorContainer);
            
            const printFrame = document.createElement('iframe');
            printFrame.style.display = 'none';
            document.body.appendChild(printFrame);
            
            printFrame.contentDocument.write(`
                <html>
                    <head>
                        <title>Print Stickers</title>
                        <style>
                            @media print {
                                @page { size: 15cm 10cm; margin: 0; }
                                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                                .sticker { display: flex; width: 14.5cm; height: 9.5cm; padding: 0.25cm; box-sizing: border-box; page-break-after: always; border: 1px dashed #ccc; margin: 0.25cm; }
                                .sticker:last-child { page-break-after: auto; }
                                .sticker-main-content { flex: 4; display: flex; flex-direction: column; padding-right: 5px; }
                                .sticker-side-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; border-left: 2px solid #000; padding-left: 5px; }
                                .address-block { display: flex; font-size: 9pt; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px; flex-shrink: 0; }
                                .address-from, .address-to { flex: 1; }
                                .address-to { padding-left: 10px; }
                                .product-block { flex-grow: 1; text-align: left; font-size: 10pt; }
                                .product-name { font-size: 12pt; font-weight: bold; margin-top: 5px; }
                                .product-sku { font-weight: bold; font-size: 10pt; margin-top: 4px; }
                                .article_no-block { flex-shrink: 0; text-align: center; padding-top: 5px; }
                                .side-article_no-block { transform: rotate(-90deg); }
                            }
                        </style>
                    </head>
                    <body>${stickerSheetHtml}</body>
                </html>
            `);
            printFrame.contentDocument.close();
            
            printFrame.onload = function() {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                setTimeout(() => {
                    document.body.removeChild(printFrame);
                }, 500);
            };

        } catch (error) {
            Swal.fire('Error', `Could not generate stickers: ${error.message}`, 'error');
        } finally {
            printStickersBtn.disabled = false;
            printStickersBtn.innerHTML = '<i class="bi bi-printer me-1"></i> Print Item Stickers';
        }
    }

    async function handlePrintPickReport() {
        if (!selectedOrderId) { 
            Swal.fire('Error', 'No order is selected.', 'error'); 
            return; 
        }

        printPickReportBtn.disabled = true;
        printPickReportBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Printing...';

        try {
            const response = await fetchData(`api/picking_api.php?action=getPickReport&order_id=${selectedOrderId}`);
            
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
                                <td></td>
                            </tr>
                        `;
                    });
                } else {
                     itemsHtml = '<tr><td colspan="9" class="text-center" style="height: 400px;">No items on this order.</td></tr>';
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
                                            <th>Article No</th>
                                            <th>article_no</th>
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
                        <style>
                            @media print {
                                @page { size: A4; margin: 1cm; }
                                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-print-color-adjust: exact; }
                                .page { width: 100%; height: 100%; page-break-after: always; }
                                .page:last-child { page-break-after: auto; }
                                .report-container { border: 2px solid #000; padding: 15px; height: 100%; display: flex; flex-direction: column; }
                                .header-section, .details-section { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; flex-shrink: 0; }
                                .header-logo { max-height: 60px; width: auto; }
                                .order-article_no-container svg { height: 40px; width: 100%; }
                                .item-article_no-container svg { height: 35px; width: 100%; margin: 0; }
                                .table th, .table td { vertical-align: middle; font-size: 0.8rem; text-align: center; }
                                .table th { background-color: #e9ecef !important; }
                                .table td:nth-child(2) { text-align: left; }
                                .info-box { border: 1px solid #ccc; padding: 10px; height: 100%; font-size: 0.9rem; }
                                .items-section { flex-grow: 1; }
                                .footer { flex-shrink: 0; margin-top: 20px; text-align: center; font-size: 0.8em; border-top: 2px solid #000; padding-top: 10px; }
                            }
                        </style>
                    </head>
                    <body>${allPagesHtml}</body>
                </html>
            `);
            
            for (let page = 0; page < totalPages; page++) {
                const orderarticle_noContainer = printFrame.contentDocument.getElementById(`order-article_no-page-${page}`);
                if (orderarticle_noContainer) {
                    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    JsBarcode(svg, order_details.order_number, { format: "CODE128", displayValue: false, height: 40, margin: 0 });
                    orderarticle_noContainer.appendChild(svg);
                }

                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageItems = items.slice(start, end);

                pageItems.forEach((item, index) => {
                    const globalIndex = start + index;
                    const itemarticle_noContainer = printFrame.contentDocument.getElementById(`item-article_no-${globalIndex}`);
                    if (itemarticle_noContainer && item.article_no) {
                        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                        JsBarcode(svg, item.article_no, { format: "CODE128", displayValue: false, height: 35, margin: 2, fontSize: 10 });
                        itemarticle_noContainer.appendChild(svg);
                    }
                });
            }

            printFrame.contentDocument.close();
            
            printFrame.onload = function() {
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
});
