// public/js/picking.js
/********************************************************************
* MODIFICATION SUMMARY:
* - Added a new "Change Driver" button and its corresponding event listener.
* - The `loadOrderItems` function was updated to manage the visibility of the "Assign Driver" and "Change Driver" buttons.
* - "Change Driver" now appears if a driver is already assigned and the order status is appropriate (Staged, Assigned, etc.).
* - The "Assign Driver" button will only show if no driver is assigned yet.
* - Both buttons use the same `openAssignDriverSweetAlert` modal, streamlining the assignment/re-assignment process.
* - Updated `displayOrders` function to allow searching by customer code and to display the customer code on the order card.
********************************************************************/

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
    const scrapOrderBtn = document.getElementById('scrapOrderBtn');
    const assignDriverBtn = document.getElementById('assignDriverBtn');
    const changeDriverBtn = document.getElementById('changeDriverBtn');
    const shippingAreaDisplay = document.getElementById('shippingAreaDisplay');
    const driverInfoDisplay = document.getElementById('driverInfoDisplay');
    const pickActionsArea = document.getElementById('pickActionsArea');
    const stagingActionsArea = document.getElementById('stagingActionsArea');
    const managementActionsArea = document.getElementById('managementActionsArea');
    const pickingStatusFilter = document.getElementById('pickingStatusFilter');
    const orderSearchInput = document.getElementById('orderSearchInput');
    const ordersGrid = document.getElementById('ordersGrid');
    const paginationNav = document.getElementById('paginationNav');
    const notificationArea = document.getElementById('notificationArea');
    const noOrdersMessage = document.getElementById('noOrdersMessage');

    // --- State Variables ---
    let selectedOrderId = null;
    let selectedOrderNumber = '';
    let selectedTrackingNumber = '';
    let allOrders = [];
    let currentOrderItems = []; 
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let allDrivers = [];
    let allDeliveryCompanies = [];
    let hasCheckedOrdersOnce = false;
    let lastKnownPendingCount = 0;
    let currentPage = 1;
    const ordersPerPage = 8;
    let orderStatusCounts = {};

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

    /**
     * MODIFICATION:
     * - Updated the catch block to handle the "Access Denied" error specifically.
     * - If an "Access Denied" error occurs, the user will be redirected to dashboard.php after clicking "OK".
     */
    async function fetchData(endpoint, method = 'GET', body = null) {
        const options = { 
            method, 
            headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' } 
        };
        if (body) {
            if (body instanceof FormData) {
                options.body = body;
            } else {
                options.body = JSON.stringify(body);
            }
        }
        try {
            const response = await fetch(endpoint, options);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'API request failed');
            return data;
        } catch (error) {
            console.error('API Error:', error);
            const isAccessDeniedError = error.message.includes('Access Denied');
            Swal.fire({
                title: 'Error',
                text: error.message,
                icon: 'error',
                confirmButtonText: 'OK',
                allowOutsideClick: false 
            }).then((result) => {
                // If the user confirms and it's the specific access denied error
                if (result.isConfirmed && isAccessDeniedError) {
                    window.location.href = 'dashboard.php';
                }
            });
            return null;
        }
    }

    async function initializePage() {
        setupEventListeners();
        
        $('#pickDotCodeSelect, #pickLocationSelect, #pickBatchNumberSelect').select2({ theme: 'bootstrap-5' });
        $('#pickDotCodeSelect').select2({
            theme: 'bootstrap-5',
            templateResult: formatDotOption,
            templateSelection: (data) => data.text,
            escapeMarkup: m => m
        });

        try {
            await Promise.all([ 
                fetchAndRenderOrders(),
                loadDrivers(),
                loadDeliveryCompanies()
            ]);
            setInterval(updateOrderStatusCounts, 30000); 
            updateOrderStatusCounts();
        } catch (error) {
            Swal.fire('Initialization Error', `Could not load initial page data. ${error.message}`, 'error');
        }
    }
    
    function setupEventListeners() {
        if (pickItemBtn) pickItemBtn.addEventListener('click', handlePickItem);
        if (printStickersBtn) printStickersBtn.addEventListener('click', handlePrintStickers);
        if (printPickReportBtn) printPickReportBtn.addEventListener('click', handlePrintPickReport);
        if (stageOrderBtn) stageOrderBtn.addEventListener('click', handleStageOrder);
        if (scrapOrderBtn) scrapOrderBtn.addEventListener('click', handleScrapOrder);
        if (assignDriverBtn) assignDriverBtn.addEventListener('click', openAssignDriverSweetAlert);
        if (changeDriverBtn) changeDriverBtn.addEventListener('click', openAssignDriverSweetAlert);
        
        if (pickingStatusFilter) pickingStatusFilter.addEventListener('change', () => { currentPage = 1; displayOrders(); });
        if (orderSearchInput) orderSearchInput.addEventListener('input', () => { currentPage = 1; displayOrders(); });
        
        if (pickItemNumberInput) pickItemNumberInput.addEventListener('change', handleProductScan);
        if (pickDotCodeSelect) $(pickDotCodeSelect).on('change', handleDotSelect);
        if (pickLocationSelect) $(pickLocationSelect).on('change', handleLocationSelect);
        if (pickBatchNumberSelect) $(pickBatchNumberSelect).on('change', () => validatePickQuantity());
        if (pickQuantityInput) pickQuantityInput.addEventListener('input', validatePickQuantity);
    }

    async function fetchAndRenderOrders() {
        const response = await fetchData('api/picking_api.php?action=getOrdersForPicking&status=all');
        if (response?.success) {
            allOrders = response.data;
            displayOrders();
        }
    }

    function displayOrders() {
        const status = pickingStatusFilter.value;
        const searchTerm = orderSearchInput.value.toLowerCase();
        let filteredOrders;

        if (searchTerm) {
            filteredOrders = allOrders.filter(order =>
                order.order_number.toLowerCase().includes(searchTerm) ||
                order.customer_name.toLowerCase().includes(searchTerm) ||
                (order.customer_code && order.customer_code.toLowerCase().includes(searchTerm))
            );
        } else {
            if (status !== 'all') {
                filteredOrders = allOrders.filter(order => {
                    if (status === 'Pending Pick') {
                        return ['New', 'Pending Pick'].includes(order.status);
                    }
                    return order.status === status;
                });
            } else {
                filteredOrders = allOrders;
            }
        }
        
        ordersGrid.innerHTML = '';
        noOrdersMessage.classList.toggle('d-none', filteredOrders.length > 0);

        if (filteredOrders.length === 0) {
            renderPagination(0, 0); 
            return;
        }

        const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
        const startIndex = (currentPage - 1) * ordersPerPage;
        const endIndex = startIndex + ordersPerPage;
        const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

        paginatedOrders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'col';
            card.innerHTML = `
                <div class="card h-100 order-card" data-order-id="${order.order_id}" data-order-number="${order.order_number}">
                    <div class="card-body card-body-hover d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="card-title text-primary mb-1">${order.order_number}</h6>
                            <span class="badge ${getStatusClass(order.status)}">${order.status}</span>
                        </div>
                         <div class="mb-2">
                            <p class="card-subtitle mb-0 text-muted">${order.customer_name}</p>
                            <p class="card-subtitle mb-0 text-muted">Refrence No: ${order.reference_number}</p>
                            <p class="card-text small text-muted">Code: ${order.customer_code || 'N/A'}</p>
                        </div>
                        <p class="card-text small mt-auto mb-0">
                            <strong>Date:</strong> ${new Date(order.order_date).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            `;
            ordersGrid.appendChild(card);
        });

        ordersGrid.querySelectorAll('.order-card').forEach(card => {
            card.addEventListener('click', () => {
                ordersGrid.querySelectorAll('.order-card.selected').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectOrder(card.dataset.orderId, card.dataset.orderNumber);
            });
        });

        renderPagination(totalPages, filteredOrders.length);
    }

    function renderPagination(totalPages) {
        paginationNav.innerHTML = '';
        if (totalPages <= 1) return;

        const ul = document.createElement('ul');
        ul.className = 'pagination';

        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = i;
            a.dataset.page = i;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = parseInt(e.target.dataset.page, 10);
                displayOrders();
            });
            li.appendChild(a);
            ul.appendChild(li);
        }
        paginationNav.appendChild(ul);
    }
    
    async function loadDrivers() {
        const data = await fetchData('api/users_api.php?action=getDrivers');
        if (data && data.success) {
            allDrivers = data.data;
        }
    }

    async function loadDeliveryCompanies() {
        const data = await fetchData('api/picking_api.php?action=getDeliveryCompanies');
        if (data && data.success) {
            allDeliveryCompanies = data.data;
        }
    }

    async function selectOrder(orderId, orderNumber) {
        selectedOrderId = orderId;
        selectedOrderNumber = orderNumber;
        currentOrderIdInput.value = selectedOrderId;
        selectedOrderNumberDisplay.textContent = `#${orderNumber}`;
        if(pickingProcessArea) pickingProcessArea.classList.remove('d-none');
        await loadOrderItems(selectedOrderId);
        if (pickItemNumberInput) pickItemNumberInput.value = '';
        
        $(pickDotCodeSelect).empty().append(new Option('Enter item number first', '')).prop('disabled', true).trigger('change');
        $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true).trigger('change');
        if (pickQuantityInput) pickQuantityInput.value = '1';

        Toast.fire({ icon: 'info', title: `Selected Order: ${orderNumber}` });
    }

    async function loadOrderItems(orderId) {
        if (!orderItemsTableBody) return;
        
        orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">Loading items...</td></tr>`;
        currentOrderItems = []; 
        selectedTrackingNumber = '';
        
        if (managementActionsArea) managementActionsArea.classList.add('d-none');
        if (printStickersBtn) {
            printStickersBtn.classList.add('d-none');
            printStickersBtn.disabled = true;
        }
        if (printPickReportBtn) {
            printPickReportBtn.classList.add('d-none');
            printPickReportBtn.disabled = true;
        }
        if (stageOrderBtn) stageOrderBtn.classList.add('d-none');
        if (scrapOrderBtn) scrapOrderBtn.classList.add('d-none');
        if (assignDriverBtn) assignDriverBtn.classList.add('d-none');
        if (changeDriverBtn) changeDriverBtn.classList.add('d-none');
        if (pickActionsArea) pickActionsArea.classList.add('d-none');
        if (stagingActionsArea) stagingActionsArea.classList.add('d-none');
        if(shippingAreaDisplay) shippingAreaDisplay.innerHTML = '<span class="badge bg-secondary">Not Staged</span>';
        if(driverInfoDisplay) driverInfoDisplay.innerHTML = '<span class="badge bg-secondary">Not Assigned</span>';
        document.getElementById('sticker-print-warning')?.remove();

        try {
            const response = await fetchData(`api/picking_api.php?action=getOrderDetails&order_id=${orderId}`);
            orderItemsTableBody.innerHTML = '';

            if (response?.success && response.data) {
                const order = response.data;
                currentOrderItems = order.items || []; 
                selectedTrackingNumber = order.tracking_number || '';
                const canManage = ['picker', 'operator', 'manager'].includes(currentWarehouseRole);
                
                const isFullyPicked = currentOrderItems.every(item => item.picked_quantity >= item.ordered_quantity) && currentOrderItems.length > 0;
                let isPickable = ['New', 'Pending Pick', 'Partially Picked'].includes(order.status);

                if (isFullyPicked) {
                    isPickable = false;
                }
                
                const canUnpick = ['Pending Pick', 'Partially Picked', 'Picked'].includes(order.status);
                const canStageOrScrap = order.status === 'Picked';
                
                const driverAssigned = order.assignment && order.assignment.length > 0;
                const canAssign = !driverAssigned && ['Staged', 'Delivery Failed'].includes(order.status);
                const canChangeDriver = driverAssigned && ['Staged', 'Assigned', 'Out for Delivery', 'Delivery Failed'].includes(order.status);

                if (isPickable && canManage) {
                    pickActionsArea.classList.remove('d-none');
                } else {
                    pickActionsArea.classList.add('d-none');
                }

                if (canManage) stagingActionsArea.classList.remove('d-none');
                
                if (canManage && canStageOrScrap) {
                    if (order.order_type === 'Scrap') {
                        scrapOrderBtn.classList.remove('d-none');
                    } else {
                        stageOrderBtn.classList.remove('d-none');
                    }
                }
                
                if (canManage) {
                    if (canChangeDriver) {
                        if (changeDriverBtn) changeDriverBtn.classList.remove('d-none');
                    } else if (canAssign) {
                        if (assignDriverBtn) {
                            assignDriverBtn.classList.remove('d-none');
                            if (order.stickers_printed_at) {
                                assignDriverBtn.disabled = false;
                                assignDriverBtn.title = 'Assign a driver for this order.';
                            } else {
                                assignDriverBtn.disabled = true;
                                assignDriverBtn.title = 'You must print stickers for this order before assigning a driver.';
                                const warningMsg = document.createElement('small');
                                warningMsg.id = 'sticker-print-warning';
                                warningMsg.className = 'text-danger ms-2 fw-bold';
                                warningMsg.textContent = 'Please print stickers first!';
                                assignDriverBtn.parentElement.appendChild(warningMsg);
                            }
                        }
                    }
                }
                
                if (order.shipping_area_code && shippingAreaDisplay) {
                    shippingAreaDisplay.innerHTML = `<span class="badge bg-purple">${order.shipping_area_code}</span>`;
                }

                if (order.assignment && order.assignment.length > 0) {
                    const assignmentHtml = order.assignment.map(a => {
                        let text = '';
                        if (a.assignment_type === 'in_house') {
                            text = `
                                <div class="mb-2">
                                    <span class="badge bg-info text-dark">In-House: ${a.driver_name}</span>
                                </div>`;
                        } else {
                            text = `
                                <div class="border rounded p-2 mb-2">
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
                    driverInfoDisplay.innerHTML = assignmentHtml;
                }

                if (canManage && order.items.length > 0) {
                    if (managementActionsArea) managementActionsArea.classList.remove('d-none');
                    
                    const totalPicked = order.items.reduce((sum, item) => sum + (parseInt(item.picked_quantity, 10) || 0), 0);
                    if (totalPicked > 0) {
                        if (printStickersBtn) {
                            printStickersBtn.classList.remove('d-none');
                            printStickersBtn.disabled = false;
                        }
                    }
                    
                    if (printPickReportBtn) {
                        printPickReportBtn.classList.remove('d-none');
                        printPickReportBtn.disabled = false;
                    }
                }


                if (order.items.length === 0) {
                    orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">No items have been added to this order yet.</td></tr>`;
                    return;
                }

                order.items.forEach((item, index) => {
                    const isFullyPicked = item.picked_quantity >= item.ordered_quantity;
                    const itemRow = orderItemsTableBody.insertRow();
                    itemRow.className = 'fw-bold';
                    if (isFullyPicked && item.ordered_quantity > 0) itemRow.classList.add('table-success');
                    
                    itemRow.innerHTML = `<td>${index + 1}</td><td>${item.product_name}</td><td>${item.sku}</td><td>${item.article_no}</td><td>${item.ordered_quantity}</td><td>${item.picked_quantity}</td><td colspan="4"></td>`;

                    if (item.picks && Array.isArray(item.picks)) {
                        item.picks.forEach(pick => {
                            const pickRow = orderItemsTableBody.insertRow();
                            pickRow.className = 'pick-row';
                            let pickActionButtons = '';
                            if (canUnpick && canManage) {
                                pickActionButtons = `<button class="btn btn-sm btn-outline-warning unpick-item-btn" title="Unpick this specific item" data-pick-id="${pick.pick_id}"><i class="bi bi-arrow-counterclockwise"></i></button>`;
                            }
                            pickRow.innerHTML = `<td colspan="6" class="text-end border-end-0 fst-italic text-muted">Picked: ${pick.picked_quantity}</td><td class="border-start-0">${pick.batch_number || 'N/A'}</td><td>${pick.dot_code || 'N/A'}</td><td>${pick.location_code}</td><td class="text-center">${pickActionButtons}</td>`;
                        });
                    }
                });
                addOrderItemActionListeners(orderId);
            }
        } catch (error) {
            Swal.fire('Error', `Could not load order items: ${error.message}`, 'error');
        }
    }

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.unpick-item-btn').forEach(button => button.addEventListener('click', (event) => { 
            const btn = event.target.closest('button'); 
            handleUnpickItem(btn.dataset.pickId, orderId); 
        }));
    }

    async function handleProductScan() {
        $(pickDotCodeSelect).empty().append(new Option('Select DOT', '')).prop('disabled', true).trigger('change');
        $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true).trigger('change');
        productInventoryDetails = [];
        pickQuantityInput.disabled = false;
        pickItemBtn.disabled = true;

        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > currentOrderItems.length) {
            if (pickItemNumberInput.value !== '') {
                Toast.fire({ icon: 'error', title: 'Invalid item number.' });
            }
            return;
        }

        const product = currentOrderItems[itemNumber - 1];
        const remainingToPick = product.ordered_quantity - product.picked_quantity;
        
        if (remainingToPick <= 0) {
            Toast.fire({ icon: 'warning', title: 'This item is fully picked.' });
            pickItemNumberInput.value = ''; 
            $(pickDotCodeSelect).empty().append(new Option('Select DOT', '')).prop('disabled', true).trigger('change');
            return;
        }

        const response = await fetchData(`api/picking_api.php?action=getDotsForProduct&product_id=${product.product_id}`);
        
        if (response?.success) {
            if (response.data.length > 0) {
                const dotCodes = response.data;
                $(pickDotCodeSelect).empty().append(new Option('Select a DOT Code (Oldest First)', ''));
                dotCodes.forEach((item, index) => {
                    const newOption = new Option(item.dot_code, item.dot_code);
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
            Toast.fire({ icon: 'error', title: response.message || 'An error occurred.' });
            $(pickDotCodeSelect).empty().append(new Option('Stock unavailable', '')).prop('disabled', true).trigger('change');
        }
    }

    async function handleDotSelect() {
        $(pickLocationSelect).empty().append(new Option('Loading...', '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option('Select Location first', '')).prop('disabled', true).trigger('change');
        
        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        const selectedDot = pickDotCodeSelect.value;
        
        if (isNaN(itemNumber) || !selectedDot) {
            $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
            return;
        }
        
        const product = currentOrderItems[itemNumber - 1];
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

    async function handleLocationSelect() {
        $(pickBatchNumberSelect).empty().append(new Option('Loading...', '')).prop('disabled', true).trigger('change');

        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        const selectedDot = pickDotCodeSelect.value;
        const selectedLocationId = pickLocationSelect.value;

        if (isNaN(itemNumber) || !selectedDot || !selectedLocationId) {
            $(pickBatchNumberSelect).empty().append(new Option('Select Location first', '')).prop('disabled', true).trigger('change');
            return;
        }

        const product = currentOrderItems[itemNumber - 1];
        if (!product) return;

        const response = await fetchData(`api/picking_api.php?action=getBatchesForLocationDot&product_id=${product.product_id}&dot_code=${selectedDot}&location_id=${selectedLocationId}`);
        
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

    function validatePickQuantity() {
        const quantityErrorDiv = document.getElementById('pickQuantityError');
        if(quantityErrorDiv) quantityErrorDiv.textContent = '';
        pickItemBtn.disabled = true;
        
        const selectedBatch = pickBatchNumberSelect.value;
        const enteredQty = parseInt(pickQuantityInput.value, 10);
        const itemNumber = parseInt(pickItemNumberInput.value, 10);

        if (isNaN(itemNumber) || !pickDotCodeSelect.value || !pickLocationSelect.value || !selectedBatch || isNaN(enteredQty) || enteredQty <= 0) {
            return;
        }

        const inventoryItem = productInventoryDetails.find(item => (item.batch_number || 'N/A') === selectedBatch);
        if (!inventoryItem || enteredQty > inventoryItem.quantity) {
            if(quantityErrorDiv) quantityErrorDiv.textContent = `Only ${inventoryItem?.quantity || 0} available for this batch.`;
            return;
        }

        const orderItem = currentOrderItems[itemNumber - 1];
        if (orderItem) {
            const remainingToPick = orderItem.ordered_quantity - orderItem.picked_quantity;
            if (enteredQty > remainingToPick) {
                if(quantityErrorDiv) quantityErrorDiv.textContent = `Order only requires ${remainingToPick} more.`;
                return;
            }
        }
        
        pickItemBtn.disabled = false;
    }

    async function handlePickItem() {
        if (!selectedOrderId) { Swal.fire('Error', 'Please select an order first.', 'error'); return; }
        
        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        const product = currentOrderItems[itemNumber - 1];
        if (!product) {
            Swal.fire('Error', 'Could not find product details for the entered item number.', 'error');
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
            
            await fetchAndRenderOrders(); 
            await loadOrderItems(selectedOrderId); 

            const updatedOrderItem = currentOrderItems.find(item => item.product_id == product.product_id);
            const remainingToPick = updatedOrderItem ? (updatedOrderItem.ordered_quantity - updatedOrderItem.picked_quantity) : 0;

            if (remainingToPick > 0) {
                await handleProductScan();
            } else {
                pickItemNumberInput.value = '';
                $(pickDotCodeSelect).empty().append(new Option('Enter item number first', '')).prop('disabled', true).trigger('change');
                $(pickLocationSelect).empty().append(new Option('Select DOT first', '')).prop('disabled', true).trigger('change');
                $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true).trigger('change');
            }
            pickQuantityInput.value = '1';
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

    async function handleUnpickItem(pickId, orderId) {
        Swal.fire({ title: 'Confirm Unpick', text: 'Are you sure you want to return this picked item to stock?', icon: 'warning', showCancelButton: true, allowOutsideClick:false, confirmButtonColor: '#d33', confirmButtonText: 'Yes, unpick it!' }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/picking_api.php?action=unpickItem', 'POST', { pick_id: pickId });
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    await Promise.all([fetchAndRenderOrders(), loadOrderItems(orderId)]);
                    if (pickItemNumberInput.value) await handleProductScan();
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
        const { value: locationId } = await Swal.fire({ title: 'Select Shipping Area', input: 'select', inputOptions: shippingAreaOptions, allowOutsideClick:false, inputPlaceholder: 'Select an area', showCancelButton: true, allowOutsideClick: false, inputValidator: (value) => !value && 'You need to select a shipping area!' });
        if (locationId) {
            const result = await fetchData('api/picking_api.php?action=stageOrder', 'POST', { order_id: selectedOrderId, shipping_area_location_id: locationId });
            if (result?.success) {
                Toast.fire({ icon: 'success', title: result.message });
                await Promise.all([fetchAndRenderOrders(), loadOrderItems(selectedOrderId)]);
            }
        }
    }

    async function handleScrapOrder() {
        if (!selectedOrderId) { Swal.fire('Error', 'No order selected.', 'error'); return; }

        Swal.fire({
            title: 'Confirm Scrap',
            text: 'Are you sure you want to scrap all picked items for this order? This action finalizes the removal from stock and cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            allowOutsideClick: false,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, scrap it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/picking_api.php?action=scrapOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    
                    pickingProcessArea.classList.add('d-none');
                    selectedOrderId = null;
                    currentOrderIdInput.value = '';
                    selectedOrderNumberDisplay.textContent = '';
                    
                    await fetchAndRenderOrders();
                }
            }
        });
    }


    async function openAssignDriverSweetAlert() {
        if (!selectedOrderId) {
            Swal.fire('Error', 'No order selected.', 'error');
            return;
        }

        const driverOptions = allDrivers.map(driver => `<option value="${driver.user_id}">${driver.full_name}</option>`).join('');
        const companyOptions = allDeliveryCompanies.map(company => `<option value="${company.company_id}">${company.company_name}</option>`).join('');

        let driverCounter = 0;

        const getDriverBlockHtml = (index) => `
            <div class="driver-block border rounded p-3 mb-3" data-driver-index="${index}">
                <h6 class="fw-bold">Driver ${index + 1}</h6>
                ${index > 0 ? '<button type="button" class="btn-close remove-driver-btn" aria-label="Close" style="position: absolute; top: 10px; right: 10px;"></button>' : ''}
                <div class="mb-2">
                    <label class="form-label">Driver Name*</label>
                    <input type="text" class="form-control driver-name" required>
                </div>
                <div class="mb-2">
                    <label class="form-label">Driver Mobile No*</label>
                    <input type="tel" class="form-control driver-mobile" required>
                </div>
                <div class="mb-2">
                    <label class="form-label">WAY BILL NO.*</label>
                    <input type="text" class="form-control driver-waybill" required>
                </div>
                <div class="mb-2">
                    <label class="form-label">Attach ID*</label>
                    <input type="file" class="form-control driver-id" accept="image/*,application/pdf" required>
                </div>
                <div class="mb-2">
                    <label class="form-label">Attach Driving License*</label>
                    <input type="file" class="form-control driver-license" accept="image/*,application/pdf" required>
                </div>
            </div>
        `;

        Swal.fire({
            title: 'Assign Driver for Order',
            html: `
                <form id="assignDriverFormSwal" class="text-start mt-3" style="max-height: 60vh; overflow-y: auto;">
                    <div class="mb-3">
                        <label class="form-label">Delivery Type</label>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="assignmentType" id="inHouseRadioSwal" value="in_house" checked>
                            <label class="form-check-label" for="inHouseRadioSwal">In-House Driver</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="assignmentType" id="thirdPartyRadioSwal" value="third_party">
                            <label class="form-check-label" for="thirdPartyRadioSwal">Third-Party Company</label>
                        </div>
                    </div>

                    <div id="inHouseDriverSectionSwal">
                        <div class="mb-3">
                            <label for="driverSelectSwal" class="form-label">Select Driver</label>
                            <select id="driverSelectSwal" class="form-select" style="width: 100%;" required>
                                <option value="">Select a driver</option>
                                ${driverOptions}
                            </select>
                        </div>
                    </div>

                    <div id="thirdPartySectionSwal" class="d-none">
                        <div class="mb-3">
                            <label for="deliveryCompanySelectSwal" class="form-label">Select Delivery Company</label>
                            <select id="deliveryCompanySelectSwal" class="form-select" style="width: 100%;">
                                <option value="">Select a company</option>
                                ${companyOptions}
                            </select>
                        </div>
                        <div id="driver-details-wrapper" class="d-none">
                            <div id="driver-blocks-container">
                                ${getDriverBlockHtml(0)}
                            </div>
                            <button type="button" id="add-driver-btn" class="btn btn-sm btn-outline-primary mt-2"><i class="bi bi-plus-circle me-1"></i>Add Another Driver</button>
                        </div>
                    </div>
                </form>
            `,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: 'Confirm Assignment',
            allowOutsideClick: false,
            didOpen: () => {
                const swalContainer = document.getElementById('assignDriverFormSwal');
                $('#driverSelectSwal, #deliveryCompanySelectSwal').select2({
                    theme: 'bootstrap-5',
                    dropdownParent: $('.swal2-container')
                });

                const inHouseRadio = document.getElementById('inHouseRadioSwal');
                const thirdPartyRadio = document.getElementById('thirdPartyRadioSwal');
                const inHouseSection = document.getElementById('inHouseDriverSectionSwal');
                const thirdPartySection = document.getElementById('thirdPartySectionSwal');
                const driverDetailsWrapper = document.getElementById('driver-details-wrapper');
                
                const toggleVisibility = () => {
                    if (inHouseRadio.checked) {
                        inHouseSection.classList.remove('d-none');
                        thirdPartySection.classList.add('d-none');
                    } else {
                        inHouseSection.classList.add('d-none');
                        thirdPartySection.classList.remove('d-none');
                    }
                };
                inHouseRadio.addEventListener('change', toggleVisibility);
                thirdPartyRadio.addEventListener('change', toggleVisibility);
                
                $('#deliveryCompanySelectSwal').on('change', function() {
                    if ($(this).val()) {
                        driverDetailsWrapper.classList.remove('d-none');
                    } else {
                        driverDetailsWrapper.classList.add('d-none');
                    }
                });

                const driverBlocksContainer = document.getElementById('driver-blocks-container');
                document.getElementById('add-driver-btn').addEventListener('click', () => {
                    driverCounter++;
                    driverBlocksContainer.insertAdjacentHTML('beforeend', getDriverBlockHtml(driverCounter));
                });

                driverBlocksContainer.addEventListener('click', (e) => {
                    if (e.target.classList.contains('remove-driver-btn')) {
                        e.target.closest('.driver-block').remove();
                    }
                });

                toggleVisibility();
            },
            preConfirm: () => {
                const assignmentType = document.querySelector('#assignDriverFormSwal input[name="assignmentType"]:checked').value;
                
                if (assignmentType === 'in_house') {
                    const driverId = $('#driverSelectSwal').val();
                    if (!driverId) {
                        Swal.showValidationMessage('Please select a driver.');
                        return false;
                    }
                    return {
                        order_id: selectedOrderId,
                        assignment_type: assignmentType,
                        driver_user_id: driverId
                    };
                } else {
                    const formData = new FormData();
                    formData.append('order_id', selectedOrderId);
                    formData.append('assignment_type', assignmentType);

                    const companyId = $('#deliveryCompanySelectSwal').val();
                    if (!companyId) {
                        Swal.showValidationMessage('Please select a delivery company.');
                        return false;
                    }
                    formData.append('third_party_company_id', companyId);

                    const drivers = [];
                    const driverBlocks = document.querySelectorAll('.driver-block');
                    let allValid = true;
                    driverBlocks.forEach((block, index) => {
                        const name = block.querySelector('.driver-name').value.trim();
                        const mobile = block.querySelector('.driver-mobile').value.trim();
                        const waybill = block.querySelector('.driver-waybill').value.trim();
                        const idFile = block.querySelector('.driver-id').files[0];
                        const licenseFile = block.querySelector('.driver-license').files[0];

                        if (!name) {
                            Swal.showValidationMessage(`Driver Name is required for Driver ${index + 1}.`);
                            allValid = false; return;
                        }
                        if (!mobile) {
                            Swal.showValidationMessage(`Driver Mobile No is required for Driver ${index + 1}.`);
                            allValid = false; return;
                        }
                        if (!waybill) {
                            Swal.showValidationMessage(`WAY BILL NO. is required for Driver ${index + 1}.`);
                            allValid = false; return;
                        }
                        if (!idFile) {
                            Swal.showValidationMessage(`An ID attachment is required for Driver ${index + 1}.`);
                            allValid = false; return;
                        }
                        if (!licenseFile) {
                            Swal.showValidationMessage(`A Driving License attachment is required for Driver ${index + 1}.`);
                            allValid = false; return;
                        }
                        
                        drivers.push({ name, mobile, waybill });
                        if (idFile) formData.append(`id_file_${index}`, idFile);
                        if (licenseFile) formData.append(`license_file_${index}`, licenseFile);
                    });

                    if (!allValid) return false;
                    if (drivers.length === 0) {
                        Swal.showValidationMessage('Please add at least one driver.');
                        return false;
                    }
                    
                    formData.append('drivers', JSON.stringify(drivers));
                    return formData;
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const bodyOrFormData = result.value;
                Swal.fire({ title: 'Assigning...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                
                const data = await fetchData('api/picking_api.php?action=assignDriver', 'POST', bodyOrFormData);
                
                if (data && data.success) {
                    await Promise.all([fetchAndRenderOrders(), loadOrderItems(selectedOrderId)]);

                    if (bodyOrFormData instanceof FormData || bodyOrFormData.assignment_type === 'third_party') {
                        const pickupUrl = `${window.location.origin}/third_party_pickup.php`;
                        const deliveryUrl = `${window.location.origin}/delivery_confirmation.php?tracking_number=${selectedTrackingNumber}`;
                        
                        Swal.fire({
                            icon: 'success',
                            title: 'Third-Party Assigned!',
                            html: `
                                <div class="text-start">
                                    <p>Please share the following links with the delivery company:</p>
                                    
                                    <label for="pickupUrl" class="form-label mt-2"><strong>1. Pickup Verification Link:</strong></label>
                                    <input type="text" id="pickupUrl" class="form-control" value="${pickupUrl}" readonly>
                                    <p class="mt-1 text-muted small">Drivers will need to enter order number <strong>${selectedOrderNumber}</strong> and their name on this page.</p>

                                    <label for="deliveryUrl" class="form-label mt-3"><strong>2. Final Delivery Confirmation Link:</strong></label>
                                    <input type="text" id="deliveryUrl" class="form-control" value="${deliveryUrl}" readonly>
                                    <p class="mt-1 text-muted small">They will need the tracking number to complete delivery.</p>
                                </div>
                            `,
                            confirmButtonText: 'Close',
                            showDenyButton: true,
                            allowOutsideClick:false,
                            denyButtonText: '<i class="bi bi-clipboard"></i> Copy Links',
                        }).then((result) => {
                            if (result.isDenied) {
                                const textToCopy = `Pickup Link: ${pickupUrl}\nDelivery Link: ${deliveryUrl}`;
                                navigator.clipboard.writeText(textToCopy).then(() => {
                                    Toast.fire({icon: 'success', title: 'Links copied to clipboard!'});
                                });
                            }
                        });
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: 'Driver Assigned!',
                            text: 'The in-house driver has been successfully assigned to the order.',
                            allowOutsideClick: false,
                        }).then(isConfirm => {
                            if (isConfirm) location.reload();
                        });
                    }
                }
            }
        });
    }

    // MODIFICATION: Updated to use new data fields for sticker counts
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
                                <p>Order: ${sticker.order_number} &nbsp;&nbsp;<br /> Item: ${sticker.overall_sequence} / ${sticker.overall_total_quantity}</p>
                                <p class="product-name">${sticker.product_name}</p>
                                <p class="product-sku">${sticker.article_no} &nbsp;&nbsp;&nbsp; ${sticker.item_sequence} / ${sticker.item_total_quantity}</p>
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
            
            printFrame.onload = async function() {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                
                const markResult = await fetchData('api/picking_api.php?action=markStickersPrinted', 'POST', { order_id: selectedOrderId });
                if (markResult && markResult.success) {
                    Toast.fire({ icon: 'success', title: 'Sticker print status saved.' });
                    await loadOrderItems(selectedOrderId); 
                }

                setTimeout(() => {
                    document.body.removeChild(printFrame);
                }, 500);
            };

        } catch (error) {
            Swal.fire('Error', `Could not generate stickers: ${error.message}`, 'error');
        } finally {
            printStickersBtn.disabled = false;
            printStickersBtn.innerHTML = '<i class="bi bi-printer me-1"></i> Print Stickers';
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
                     itemsHtml = '<tr><td colspan="9" class="text-center" style="height: 400px;">No items on this order.</td></tr>';
                }

                allPagesHtml += `
                    <div class="page">
                        <div class="report-container">
                            <div class="header-section">
                                <div class="row align-items-center">
                                    <div class="col-4"><img src="img/Continental-Logo.png" alt="Logo 1" class="header-logo"></div>
                                    <div class="col-4 text-center"><h4>Delivery Note</h4></div>
                                    <div class="col-4 text-end"><img src="img/logo_blk.png" alt="Logo 2" class="header-logo"></div>
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
                                            <th>Barcode</th>
                                            <th>Qty</th>
                                            <th>Location</th>
                                            <th>Batch</th>
                                            <th>DOT</th>
                                            <th>Picked</th>
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
                                .order-article_no-container svg, .item-article_no-container svg { height: 40px; width: 100%; }
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
                        JsBarcode(svg, item.article_no, { format: "CODE128", displayValue: true, height: 35, margin: 2, fontSize: 10 });
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
    
    async function updateOrderStatusCounts() {
        const response = await fetchData('api/picking_api.php?action=getOrderCountsByStatus');
        
        if (response?.success) {
            orderStatusCounts = response.data;
            
            const newPendingCount = orderStatusCounts['Pending Pick'] || 0;
            
            if (newPendingCount > 0) {
                const orderText = newPendingCount === 1 ? 'order' : 'orders';
                notificationArea.innerHTML = `
                    <div class="alert alert-primary alert-dismissible fade show" role="alert">
                        You have <strong>${newPendingCount}</strong> new ${orderText} ready for picking. 
                        <a href="#" id="viewPendingLink" class="alert-link">View them now</a>.
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                `;
                document.getElementById('viewPendingLink').addEventListener('click', (e) => {
                    e.preventDefault();
                    pickingStatusFilter.value = 'Pending Pick';
                    pickingStatusFilter.dispatchEvent(new Event('change'));
                });
            } else {
                notificationArea.innerHTML = '';
            }

            if (!hasCheckedOrdersOnce) {
                lastKnownPendingCount = newPendingCount;
                hasCheckedOrdersOnce = true;
                return;
            }
    
            if (newPendingCount > lastKnownPendingCount) {
                const newOrders = newPendingCount - lastKnownPendingCount;
                const toastOrderText = newOrders === 1 ? 'order has' : 'orders have';
                Toast.fire({
                    icon: 'info',
                    title: `${newOrders} new ${toastOrderText} arrived!`
                });
            }
            
            lastKnownPendingCount = newPendingCount;
        }
    }

    function getStatusClass(status) {
        const classes = {
            'New': 'bg-secondary',
            'Pending Pick': 'bg-secondary',
            'Partially Picked': 'bg-info text-dark',
            'Picked': 'bg-primary',
            'Staged': 'bg-warning text-dark',
            'Ready for Pickup': 'bg-purple',
            'Assigned': 'bg-dark',
            'Out for Delivery': 'bg-orange',
            'Delivery Failed': 'bg-danger',
            'Delivered': 'bg-success',
            'Cancelled': 'bg-danger',
            'Returned': 'bg-danger',
            'Partially Returned': 'bg-danger'
        };
        return classes[status] || 'bg-light text-dark';
    }
});
