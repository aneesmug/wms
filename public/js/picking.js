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
    // MODIFICATION: Added a selector for the new button
    const showThirdPartyLinksBtn = document.getElementById('showThirdPartyLinksBtn');

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

    initializePage();

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
            Swal.fire(__('initialization_error'), `${__('could_not_load_initial_data')}. ${error.message}`, 'error');
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
        
        // MODIFICATION: Added event listener for the new button
        if (showThirdPartyLinksBtn) showThirdPartyLinksBtn.addEventListener('click', () => {
             if (selectedOrderNumber && selectedTrackingNumber) {
                 showThirdPartyLinksModal(selectedOrderNumber, selectedTrackingNumber);
             } else {
                 showMessageBox(__('order_details_not_loaded'), 'error');
             }
        });
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
                            <span class="badge ${getStatusClass(order.status)}">${__(order.status.toLowerCase().replace(/\s+/g, '_'), order.status)}</span>
                        </div>
                         <div class="mb-2">
                            <p class="card-subtitle mb-0 text-muted">${order.customer_name}</p>
                            <p class="card-subtitle mb-0 text-muted">${__('reference_no')}: ${order.reference_number}</p>
                            <p class="card-text small text-muted">${__('code')}: ${order.customer_code || __('n_a')}</p>
                        </div>
                        <p class="card-text small mt-auto mb-0">
                            <strong>${__('date')}:</strong> ${new Date(order.order_date).toLocaleDateString()}
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
        
        $(pickDotCodeSelect).empty().append(new Option(__('enter_item_number_first'), '')).prop('disabled', true).trigger('change');
        $(pickLocationSelect).empty().append(new Option(__('select_dot_first'), '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option(__('select_location_first'), '')).prop('disabled', true).trigger('change');
        if (pickQuantityInput) pickQuantityInput.value = '1';

        showMessageBox(`${__('selected_order')}: ${orderNumber}`, 'info');
    }

    async function loadOrderItems(orderId) {
        if (!orderItemsTableBody) return;
        
        orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">${__('loading_items')}...</td></tr>`;
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
        // MODIFICATION: Hide the new button by default
        if (showThirdPartyLinksBtn) showThirdPartyLinksBtn.classList.add('d-none');
        if (pickActionsArea) pickActionsArea.classList.add('d-none');
        if (stagingActionsArea) stagingActionsArea.classList.add('d-none');
        if(shippingAreaDisplay) shippingAreaDisplay.innerHTML = `<span class="badge bg-secondary">${__('not_staged')}</span>`;
        if(driverInfoDisplay) driverInfoDisplay.innerHTML = `<span class="badge bg-secondary">${__('not_assigned')}</span>`;
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
                                assignDriverBtn.title = __('assign_driver_for_order');
                            } else {
                                assignDriverBtn.disabled = true;
                                assignDriverBtn.title = __('must_print_stickers_before_assigning');
                                const warningMsg = document.createElement('small');
                                warningMsg.id = 'sticker-print-warning';
                                warningMsg.className = 'text-danger ms-2 fw-bold';
                                warningMsg.textContent = __('please_print_stickers_first');
                                assignDriverBtn.parentElement.appendChild(warningMsg);
                            }
                        }
                    }
                }
                
                // MODIFICATION: Logic to show the new button
                const hasThirdPartyAssignment = order.assignment && order.assignment.length > 0 && order.assignment.some(a => a.assignment_type === 'third_party');
                if (canManage && hasThirdPartyAssignment) {
                    if (showThirdPartyLinksBtn) showThirdPartyLinksBtn.classList.remove('d-none');
                } else {
                    if (showThirdPartyLinksBtn) showThirdPartyLinksBtn.classList.add('d-none');
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
                                    <span class="badge bg-info text-dark">${__('in_house')}: ${a.driver_name}</span>
                                </div>`;
                        } else {
                            text = `
                                <div class="border rounded p-2 mb-2">
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
                    orderItemsTableBody.innerHTML = `<tr><td colspan="9" class="text-center p-4">${__('no_items_added_to_order')}</td></tr>`;
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
                                pickActionButtons = `<button class="btn btn-sm btn-outline-warning unpick-item-btn" title="${__('unpick_this_item')}" data-pick-id="${pick.pick_id}"><i class="bi bi-arrow-counterclockwise"></i></button>`;
                            }
                            pickRow.innerHTML = `<td colspan="6" class="text-end border-end-0 fst-italic text-muted">${__('picked')}: ${pick.picked_quantity}</td><td class="border-start-0">${pick.batch_number || __('n_a')}</td><td>${pick.dot_code || __('n_a')}</td><td>${pick.location_code}</td><td class="text-center">${pickActionButtons}</td>`;
                        });
                    }
                });
                addOrderItemActionListeners(orderId);
            }
        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_load_order_items')}: ${error.message}`, 'error');
        }
    }

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.unpick-item-btn').forEach(button => button.addEventListener('click', (event) => { 
            const btn = event.target.closest('button'); 
            handleUnpickItem(btn.dataset.pickId, orderId); 
        }));
    }

    async function handleProductScan() {
        $(pickDotCodeSelect).empty().append(new Option(__('select_dot'), '')).prop('disabled', true).trigger('change');
        $(pickLocationSelect).empty().append(new Option(__('select_dot_first'), '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option(__('select_location_first'), '')).prop('disabled', true).trigger('change');
        productInventoryDetails = [];
        pickQuantityInput.disabled = false;
        pickItemBtn.disabled = true;

        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > currentOrderItems.length) {
            if (pickItemNumberInput.value !== '') {
                showMessageBox(__('invalid_item_number'), 'error');
            }
            return;
        }

        const product = currentOrderItems[itemNumber - 1];
        const remainingToPick = product.ordered_quantity - product.picked_quantity;
        
        if (remainingToPick <= 0) {
            showMessageBox(__('item_fully_picked'), 'warning');
            pickItemNumberInput.value = ''; 
            $(pickDotCodeSelect).empty().append(new Option(__('select_dot'), '')).prop('disabled', true).trigger('change');
            return;
        }

        const response = await fetchData(`api/picking_api.php?action=getDotsForProduct&product_id=${product.product_id}`);
        
        if (response?.success) {
            if (response.data.length > 0) {
                const dotCodes = response.data;
                $(pickDotCodeSelect).empty().append(new Option(__('select_dot_code_oldest_first'), ''));
                dotCodes.forEach((item, index) => {
                    const newOption = new Option(item.dot_code, item.dot_code);
                    if (index === 0) {
                        newOption.dataset.badgeClass = 'bg-success';
                        newOption.dataset.badgeText = __('oldest_fifo');
                    }
                    $(pickDotCodeSelect).append(newOption);
                });
                $(pickDotCodeSelect).prop('disabled', false);
                
                if (dotCodes.length > 0) {
                    $(pickDotCodeSelect).val(dotCodes[0].dot_code).trigger('change');
                }
            } else {
                showMessageBox(__('no_stock_found_for_item'), 'error');
                $(pickDotCodeSelect).empty().append(new Option(__('no_stock_found'), '')).prop('disabled', true).trigger('change');
            }
        } else {
            showMessageBox(response.message || __('an_unknown_error_occurred'), 'error');
            $(pickDotCodeSelect).empty().append(new Option(__('stock_unavailable'), '')).prop('disabled', true).trigger('change');
        }
    }

    async function handleDotSelect() {
        $(pickLocationSelect).empty().append(new Option(__('loading'), '')).prop('disabled', true).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option(__('select_location_first'), '')).prop('disabled', true).trigger('change');
        
        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        const selectedDot = pickDotCodeSelect.value;
        
        if (isNaN(itemNumber) || !selectedDot) {
            $(pickLocationSelect).empty().append(new Option(__('select_dot_first'), '')).prop('disabled', true).trigger('change');
            return;
        }
        
        const product = currentOrderItems[itemNumber - 1];
        if (!product) return;

        const response = await fetchData(`api/picking_api.php?action=getLocationsForDot&product_id=${product.product_id}&dot_code=${selectedDot}`);

        if (response?.success && response.data.length > 0) {
            const locations = response.data;
            $(pickLocationSelect).empty().append(new Option(__('select_pick_location'), ''));
            locations.forEach(location => {
                const option = new Option(`${location.location_code} (${__('available')}: ${location.available_quantity})`, location.location_id);
                $(pickLocationSelect).append(option);
            });
            $(pickLocationSelect).prop('disabled', false).trigger('change');
        } else {
            $(pickLocationSelect).empty().append(new Option(__('no_locations_for_this_dot'), '')).prop('disabled', true).trigger('change');
        }
    }

    async function handleLocationSelect() {
        $(pickBatchNumberSelect).empty().append(new Option(__('loading'), '')).prop('disabled', true).trigger('change');

        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        const selectedDot = pickDotCodeSelect.value;
        const selectedLocationId = pickLocationSelect.value;

        if (isNaN(itemNumber) || !selectedDot || !selectedLocationId) {
            $(pickBatchNumberSelect).empty().append(new Option(__('select_location_first'), '')).prop('disabled', true).trigger('change');
            return;
        }

        const product = currentOrderItems[itemNumber - 1];
        if (!product) return;

        const response = await fetchData(`api/picking_api.php?action=getBatchesForLocationDot&product_id=${product.product_id}&dot_code=${selectedDot}&location_id=${selectedLocationId}`);
        
        productInventoryDetails = (response?.success && Array.isArray(response.data)) ? response.data : [];

        if (response?.success && response.data.length > 0) {
            const batches = response.data;
            $(pickBatchNumberSelect).empty().append(new Option(__('select_a_batch'), ''));
            batches.forEach(batch => {
                const batchNumberText = batch.batch_number || __('n_a');
                const option = new Option(`${batchNumberText} (${__('qty')}: ${batch.quantity})`, batchNumberText);
                $(pickBatchNumberSelect).append(option);
            });
            $(pickBatchNumberSelect).prop('disabled', false).trigger('change');
        } else {
            $(pickBatchNumberSelect).empty().append(new Option(__('no_batches_found'), '')).prop('disabled', true).trigger('change');
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

        const inventoryItem = productInventoryDetails.find(item => (item.batch_number || __('n_a')) === selectedBatch);
        if (!inventoryItem || enteredQty > inventoryItem.quantity) {
            if(quantityErrorDiv) quantityErrorDiv.textContent = `${__('only')} ${inventoryItem?.quantity || 0} ${__('available_for_this_batch')}.`;
            return;
        }

        const orderItem = currentOrderItems[itemNumber - 1];
        if (orderItem) {
            const remainingToPick = orderItem.ordered_quantity - orderItem.picked_quantity;
            if (enteredQty > remainingToPick) {
                if(quantityErrorDiv) quantityErrorDiv.textContent = `${__('order_only_requires')} ${remainingToPick} ${__('more')}.`;
                return;
            }
        }
        
        pickItemBtn.disabled = false;
    }

    async function handlePickItem() {
        if (!selectedOrderId) { showMessageBox(__('please_select_order_first'), 'error'); return; }
        
        const itemNumber = parseInt(pickItemNumberInput.value, 10);
        const product = currentOrderItems[itemNumber - 1];
        if (!product) {
            Swal.fire(__('error'), __('could_not_find_product_details'), 'error');
            return;
        }

        const data = { 
            order_id: selectedOrderId, 
            product_id: product.product_id,
            location_id: pickLocationSelect.value, 
            picked_quantity: parseInt(pickQuantityInput.value, 10), 
            batch_number: pickBatchNumberSelect.value === __('n_a') ? null : pickBatchNumberSelect.value, 
            dot_code: pickDotCodeSelect.value 
        };
        
        if (!data.product_id || !data.location_id || !data.dot_code || isNaN(data.picked_quantity) || data.picked_quantity <= 0) { 
            Swal.fire(__('validation_error'), __('all_fields_are_required_to_pick'), 'error'); 
            return; 
        }
        
        const result = await fetchData('api/picking_api.php?action=pickItem', 'POST', data);
        if (result?.success) {
            showMessageBox(result.message, 'success');
            
            await fetchAndRenderOrders(); 
            await loadOrderItems(selectedOrderId); 

            const updatedOrderItem = currentOrderItems.find(item => item.product_id == product.product_id);
            const remainingToPick = updatedOrderItem ? (updatedOrderItem.ordered_quantity - updatedOrderItem.picked_quantity) : 0;

            if (remainingToPick > 0) {
                await handleProductScan();
            } else {
                pickItemNumberInput.value = '';
                $(pickDotCodeSelect).empty().append(new Option(__('enter_item_number_first'), '')).prop('disabled', true).trigger('change');
                $(pickLocationSelect).empty().append(new Option(__('select_dot_first'), '')).prop('disabled', true).trigger('change');
                $(pickBatchNumberSelect).empty().append(new Option(__('select_location_first'), '')).prop('disabled', true).trigger('change');
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
            badgeHtml = `<span class="badge ${badgeClass} float-end">${__(badgeText.toLowerCase().replace(/\s+/g, '_'), badgeText)}</span>`;
        }
        return $(`<div>${option.text}${badgeHtml}</div>`);
    }

    async function handleUnpickItem(pickId, orderId) {
        showConfirmationModal(
            __('confirm_unpick'), 
            __('are_you_sure_unpick'), 
            async () => {
                const apiResult = await fetchData('api/picking_api.php?action=unpickItem', 'POST', { pick_id: pickId });
                if (apiResult?.success) {
                    showMessageBox(apiResult.message, 'success');
                    await Promise.all([fetchAndRenderOrders(), loadOrderItems(orderId)]);
                    if (pickItemNumberInput.value) await handleProductScan();
                }
            },
            { confirmButtonText: __('yes_unpick_it') }
        );
    }

    async function handleStageOrder() {
        if (!selectedOrderId) { showMessageBox(__('no_order_selected'), 'error'); return; }
        const areaResponse = await fetchData('api/picking_api.php?action=getShippingAreas');
        if (!areaResponse?.success || !areaResponse.data || areaResponse.data.length === 0) {
            Swal.fire(__('configuration_error'), __('no_active_shipping_areas'), 'error');
            return;
        }
        const shippingAreaOptions = areaResponse.data.reduce((opts, area) => {
            opts[area.location_id] = area.location_code;
            return opts;
        }, {});
        const { value: locationId } = await Swal.fire({ 
            title: __('select_shipping_area'), 
            input: 'select', 
            inputOptions: shippingAreaOptions, 
            allowOutsideClick:false, 
            inputPlaceholder: __('select_an_area'), 
            showCancelButton: true, 
            inputValidator: (value) => !value && __('you_need_to_select_shipping_area') 
        });
        if (locationId) {
            const result = await fetchData('api/picking_api.php?action=stageOrder', 'POST', { order_id: selectedOrderId, shipping_area_location_id: locationId });
            if (result?.success) {
                showMessageBox(result.message, 'success');
                await Promise.all([fetchAndRenderOrders(), loadOrderItems(selectedOrderId)]);
            }
        }
    }

    async function handleScrapOrder() {
        if (!selectedOrderId) { showMessageBox(__('no_order_selected'), 'error'); return; }

        showConfirmationModal(
            __('confirm_scrap'),
            __('are_you_sure_scrap_items'),
            async () => {
                const apiResult = await fetchData('api/picking_api.php?action=scrapOrder', 'POST', { order_id: selectedOrderId });
                if (apiResult?.success) {
                    showMessageBox(apiResult.message, 'success');
                    
                    pickingProcessArea.classList.add('d-none');
                    selectedOrderId = null;
                    currentOrderIdInput.value = '';
                    selectedOrderNumberDisplay.textContent = '';
                    
                    await fetchAndRenderOrders();
                }
            },
            { confirmButtonText: __('yes_scrap_it') }
        );
    }

    // MODIFICATION: Extracted the SweetAlert2 logic into its own function
    function showThirdPartyLinksModal(orderNumber, trackingNumber) {
        const pickupUrl = `${window.location.origin}/third_party_pickup.php`;
        const deliveryUrl = `${window.location.origin}/delivery_confirmation.php?tracking_number=${trackingNumber}`;
        
        Swal.fire({
            icon: 'success',
            title: __('third_party_assigned'),
            html: `
                <div class="text-start">
                    <p>${__('please_share_following_links')}:</p>
                    
                    <label for="pickupUrl" class="form-label mt-2"><strong>1. ${__('pickup_verification_link')}:</strong></label>
                    <input type="text" id="pickupUrl" class="form-control" value="${pickupUrl}" readonly>
                    <p class="mt-1 text-muted small">${__('drivers_will_need_to_enter_order')} <strong>${orderNumber}</strong> ${__('and_their_name_on_this_page')}.</p>

                    <label for="deliveryUrl" class="form-label mt-3"><strong>2. ${__('final_delivery_confirmation_link')}:</strong></label>
                    <input type="text" id="deliveryUrl" class="form-control" value="${deliveryUrl}" readonly>
                    <p class="mt-1 text-muted small">${__('they_will_need_tracking_number')}.</p>
                </div>
            `,
            confirmButtonText: __('close'),
            showDenyButton: true,
            allowOutsideClick:false,
            denyButtonText: `<i class="bi bi-clipboard"></i> ${__('copy_links')}`,
        }).then((result) => {
            if (result.isDenied) {
                const textToCopy = `${__('pickup_link')}: ${pickupUrl}\n${__('delivery_link')}: ${deliveryUrl}`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showMessageBox(__('links_copied_to_clipboard'), 'success');
                });
            }
        });
    }

    async function openAssignDriverSweetAlert() {
        if (!selectedOrderId) {
            showMessageBox(__('no_order_selected'), 'error');
            return;
        }

        const driverOptions = allDrivers.map(driver => `<option value="${driver.user_id}">${driver.full_name}</option>`).join('');
        const companyOptions = allDeliveryCompanies.map(company => `<option value="${company.company_id}">${company.company_name}</option>`).join('');

        let driverCounter = 0;

        const getDriverBlockHtml = (index) => `
            <div class="driver-block border rounded p-3 mb-3" data-driver-index="${index}" style="position: relative;">
                <h6 class="fw-bold">${__('driver')} ${index + 1}</h6>
                ${index > 0 ? `<button type="button" class="btn-close remove-driver-btn" aria-label="${__('close')}" style="position: absolute; top: 10px; right: 10px;"></button>` : ''}
                
                <div class="mb-2">
                    <label class="form-label">${__('select_existing_driver')}</label>
                    <select class="form-select existing-driver-select" data-driver-index="${index}"><option value="">-- ${__('new_driver')} --</option></select>
                </div>
                <div class="mb-2">
                    <label class="form-label">${__('driver_name')}*</label>
                    <input type="text" class="form-control driver-name" required>
                </div>
                <div class="mb-2">
                    <label class="form-label">${__('driver_mobile_no')}*</label>
                    <input type="tel" class="form-control driver-mobile saudi-mobile-number" required>
                </div>
                <div class="mb-2">
                    <label class="form-label">${__('driver_id_number')}</label>
                    <input type="text" class="form-control driver-id-number">
                </div>
                <div class="mb-2">
                    <label class="form-label">${__('waybill_no')}*</label>
                    <input type="text" class="form-control driver-waybill" required>
                </div>
                <div class="mb-2">
                    <label class="form-label">${__('attach_id')}</label>
                    <input type="file" class="form-control driver-id" accept="image/*,application/pdf">
                    <div class="existing-file-info id-info small text-muted mt-1"></div>
                </div>
                <div class="mb-2">
                    <label class="form-label">${__('attach_driving_license')}</label>
                    <input type="file" class="form-control driver-license" accept="image/*,application/pdf">
                    <div class="existing-file-info license-info small text-muted mt-1"></div>
                </div>
                <input type="hidden" class="driver-db-id" name="driver_id">
            </div>
        `;

        Swal.fire({
            title: __('assign_driver_for_order'),
            html: `
                <form id="assignDriverFormSwal" class="text-start mt-3" style="max-height: 60vh; overflow-y: auto;">
                    <div class="mb-3">
                        <label class="form-label">${__('delivery_type')}</label>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="assignmentType" id="inHouseRadioSwal" value="in_house" checked>
                            <label class="form-check-label" for="inHouseRadioSwal">${__('in_house_driver')}</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="assignmentType" id="thirdPartyRadioSwal" value="third_party">
                            <label class="form-check-label" for="thirdPartyRadioSwal">${__('third_party_company')}</label>
                        </div>
                    </div>

                    <div id="inHouseDriverSectionSwal">
                        <div class="mb-3">
                            <label for="driverSelectSwal" class="form-label">${__('select_driver')}</label>
                            <select id="driverSelectSwal" class="form-select" style="width: 100%;" required>
                                <option value="">${__('select_a_driver')}</option>
                                ${driverOptions}
                            </select>
                        </div>
                    </div>

                    <div id="thirdPartySectionSwal" class="d-none">
                        <div class="mb-3">
                            <label for="deliveryCompanySelectSwal" class="form-label">${__('select_delivery_company')}</label>
                            <select id="deliveryCompanySelectSwal" class="form-select" style="width: 100%;">
                                <option value="">${__('select_a_company')}</option>
                                ${companyOptions}
                            </select>
                        </div>
                        <div id="driver-details-wrapper" class="d-none">
                            <div id="driver-blocks-container">
                                ${getDriverBlockHtml(0)}
                            </div>
                            <button type="button" id="add-driver-btn" class="btn btn-sm btn-outline-primary mt-2"><i class="bi bi-plus-circle me-1"></i>${__('add_another_driver')}</button>
                        </div>
                    </div>
                </form>
            `,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: __('confirm_assignment'),
            allowOutsideClick: false,
            cancelButtonText: __('cancel'),
            didOpen: () => {
                if (typeof setupInputValidations === 'function') {
                    setupInputValidations();
                }
                const swalContainer = document.getElementById('assignDriverFormSwal');
                const $deliveryCompanySelect = $('#deliveryCompanySelectSwal');
                
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
                
                let companyDriversCache = {};

                async function loadCompanyDrivers(companyId, driverSelectElement) {
                    const $select = $(driverSelectElement);
                    if ($select.hasClass("select2-hidden-accessible")) {
                        $select.select2('destroy');
                    }
                    $select.empty();

                    if (!companyId) {
                        $select.append(new Option(`-- ${__('select_company_first')} --`, ''));
                        $select.select2({ theme: 'bootstrap-5', dropdownParent: $('.swal2-container'), placeholder: __('search') + '...' });
                        return;
                    }
                    
                    let drivers = companyDriversCache[companyId];
                    if (!drivers) {
                        const response = await fetchData(`api/picking_api.php?action=getCompanyDrivers&company_id=${companyId}`);
                        drivers = response?.success ? response.data : [];
                        companyDriversCache[companyId] = drivers;
                    }
                    
                    populateDriverDropdown($select, drivers);
                }

                function populateDriverDropdown($select, drivers) {
                    $select.append(new Option(`-- ${__('new_driver')} --`, ''));
                    
                    const selectedDriverIds = [];
                    $('.existing-driver-select').each(function() {
                        if ($(this).val() && $(this)[0] !== $select[0]) {
                            selectedDriverIds.push($(this).val());
                        }
                    });

                    const availableDrivers = drivers.filter(d => !selectedDriverIds.includes(String(d.driver_id)));

                    availableDrivers.forEach(driver => {
                        const option = new Option(`${driver.driver_name} (${driver.driver_mobile})`, driver.driver_id);
                        option.dataset.driver = JSON.stringify(driver);
                        $select.append(option);
                    });

                    $select.select2({
                        theme: 'bootstrap-5',
                        dropdownParent: $('.swal2-container'),
                        placeholder: __('search_by_name_mobile_id'),
                        matcher: (params, data) => {
                            if ($.trim(params.term) === '') { return data; }
                            if (typeof data.text === 'undefined' || !data.element || !data.element.dataset.driver) { return data; }
                            
                            const term = params.term.toUpperCase();
                            const driver = JSON.parse(data.element.dataset.driver);
                            const textToSearch = `${driver.driver_name} ${driver.driver_mobile} ${driver.driver_id_number || ''}`.toUpperCase();
                            
                            if (textToSearch.indexOf(term) > -1) {
                                return data;
                            }
                            return null;
                        }
                    });
                }

                const driverBlocksContainer = document.getElementById('driver-blocks-container');

                $deliveryCompanySelect.on('select2:select', function() {
                    const companyId = this.value;
                    driverCounter = 0;
                    driverBlocksContainer.innerHTML = getDriverBlockHtml(0);
                    const firstDriverSelect = driverBlocksContainer.querySelector('.existing-driver-select');

                    if (companyId) {
                        driverDetailsWrapper.classList.remove('d-none');
                        loadCompanyDrivers(companyId, firstDriverSelect);
                    } else {
                        driverDetailsWrapper.classList.add('d-none');
                    }
                });
                
                $(swalContainer).on('select2:select', '.existing-driver-select', function(e) {
                    const selectedOption = e.params.data.element;
                    const driverBlock = this.closest('.driver-block');
                    const nameInput = driverBlock.querySelector('.driver-name');
                    const mobileInput = driverBlock.querySelector('.driver-mobile');
                    const idNumberInput = driverBlock.querySelector('.driver-id-number');
                    const idInfo = driverBlock.querySelector('.id-info');
                    const licenseInfo = driverBlock.querySelector('.license-info');
                    const driverIdInput = driverBlock.querySelector('.driver-db-id');
                    const idFileInput = driverBlock.querySelector('.driver-id');
                    const licenseFileInput = driverBlock.querySelector('.driver-license');

                    if (selectedOption && selectedOption.value && selectedOption.dataset.driver) {
                        const driverData = JSON.parse(selectedOption.dataset.driver);
                        nameInput.value = driverData.driver_name;
                        mobileInput.value = driverData.driver_mobile;
                        idNumberInput.value = driverData.driver_id_number || '';
                        driverIdInput.value = driverData.driver_id;
                        
                        idInfo.innerHTML = driverData.driver_id_path ? `${__('current_id')}: <a href="${driverData.driver_id_path}" target="_blank">${__('view_file')}</a>` : __('no_id_on_file');
                        licenseInfo.innerHTML = driverData.driver_license_path ? `${__('current_license')}: <a href="${driverData.driver_license_path}" target="_blank">${__('view_file')}</a>` : __('no_license_on_file');
                        
                        nameInput.readOnly = true;
                        mobileInput.readOnly = true;
                        idNumberInput.readOnly = true;
                        idFileInput.required = false;
                        licenseFileInput.required = false;

                    } else {
                        nameInput.value = '';
                        mobileInput.value = '';
                        idNumberInput.value = '';
                        driverIdInput.value = '';
                        idInfo.innerHTML = '';
                        licenseInfo.innerHTML = '';
                        nameInput.readOnly = false;
                        mobileInput.readOnly = false;
                        idNumberInput.readOnly = false;
                        idFileInput.required = true;
                        licenseFileInput.required = true;
                    }
                });

                document.getElementById('add-driver-btn').addEventListener('click', () => {
                    driverCounter++;
                    driverBlocksContainer.insertAdjacentHTML('beforeend', getDriverBlockHtml(driverCounter));
                    const newDriverSelect = driverBlocksContainer.querySelector(`.existing-driver-select[data-driver-index="${driverCounter}"]`);
                    const companyId = $deliveryCompanySelect.val();
                    if (companyId) {
                        loadCompanyDrivers(companyId, newDriverSelect);
                    }
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
                        Swal.showValidationMessage(__('please_select_a_driver'));
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
                        Swal.showValidationMessage(__('please_select_delivery_company'));
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
                        const idNumber = block.querySelector('.driver-id-number').value.trim();
                        const idFile = block.querySelector('.driver-id').files[0];
                        const licenseFile = block.querySelector('.driver-license').files[0];
                        const driverId = block.querySelector('.driver-db-id').value;
                        const isExistingDriver = !!driverId;

                        if (!name) { Swal.showValidationMessage(`${__('driver_name_is_required_for_driver')} ${index + 1}.`); allValid = false; return; }
                        if (!mobile) { Swal.showValidationMessage(`${__('driver_mobile_is_required_for_driver')} ${index + 1}.`); allValid = false; return; }
                        if (!waybill) { Swal.showValidationMessage(`${__('waybill_no_is_required_for_driver')} ${index + 1}.`); allValid = false; return; }
                        
                        if (!isExistingDriver) {
                            if (!idFile) { Swal.showValidationMessage(`${__('id_attachment_is_required_for_new_driver')} ${index + 1}.`); allValid = false; return; }
                            if (!licenseFile) { Swal.showValidationMessage(`${__('license_attachment_is_required_for_new_driver')} ${index + 1}.`); allValid = false; return; }
                        }
                        
                        drivers.push({ name, mobile, waybill, driver_id: driverId, driver_id_number: idNumber });
                        if (idFile) formData.append(`id_file_${index}`, idFile);
                        if (licenseFile) formData.append(`license_file_${index}`, licenseFile);
                    });

                    if (!allValid) return false;
                    if (drivers.length === 0) {
                        Swal.showValidationMessage(__('please_add_at_least_one_driver'));
                        return false;
                    }
                    
                    formData.append('drivers', JSON.stringify(drivers));
                    return formData;
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const bodyOrFormData = result.value;
                Swal.fire({ title: __('assigning'), allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                
                const data = await fetchData('api/picking_api.php?action=assignDriver', 'POST', bodyOrFormData);
                
                if (data && data.success) {
                    await Promise.all([fetchAndRenderOrders(), loadOrderItems(selectedOrderId)]);

                    if (bodyOrFormData instanceof FormData || bodyOrFormData.assignment_type === 'third_party') {
                        // MODIFICATION: Call the new function to show the links
                        showThirdPartyLinksModal(selectedOrderNumber, selectedTrackingNumber);
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: __('driver_assigned'),
                            text: __('in_house_driver_assigned_successfully'),
                            allowOutsideClick: false,
                            confirmButtonText: __('ok'),
                        }).then(isConfirm => {
                            if (isConfirm) location.reload();
                        });
                    }
                }
            }
        });
    }

    async function handlePrintStickers() {
        if (!selectedOrderId) { showMessageBox(__('no_order_is_selected'), 'error'); return; }
        printStickersBtn.disabled = true;
        printStickersBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${__('printing')}...`;

        try {
            const response = await fetchData(`api/picking_api.php?action=getPickStickers&order_id=${selectedOrderId}`);
            if (!response?.success || !Array.isArray(response.data) || response.data.length === 0) {
                Swal.fire(__('no_stickers'), __('no_stickers_generated_pick_items_first'), 'info');
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
                                <div class="address-from"><strong>${__('from')}:</strong><br>${from_address}</div>
                                <div class="address-to"><strong>${__('to')}: ${sticker.customer_name}</strong><br>${to_address}</div>
                            </div>
                            <div class="product-block">
                                <p>${__('order')}: ${sticker.order_number} &nbsp;&nbsp;<br /> ${__('item')}: ${sticker.overall_sequence} / ${sticker.overall_total_quantity}</p>
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
                        <title>${__('print_stickers')}</title>
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
                    showMessageBox(__('sticker_print_status_saved'), 'success');
                    await loadOrderItems(selectedOrderId); 
                }

                setTimeout(() => {
                    document.body.removeChild(printFrame);
                }, 500);
            };

        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_generate_stickers')}: ${error.message}`, 'error');
        } finally {
            printStickersBtn.disabled = false;
            printStickersBtn.innerHTML = `<i class="bi bi-printer me-1"></i> ${__('print_stickers')}`;
        }
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
                     itemsHtml = `<tr><td colspan="9" class="text-center" style="height: 400px;">${__('no_items_on_this_order')}</td></tr>`;
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
            Swal.fire(__('error'), `${__('could_not_generate_report')}: ${error.message}`, 'error');
        } finally {
            printPickReportBtn.disabled = false;
            printPickReportBtn.innerHTML = `<i class="bi bi-file-earmark-text me-1"></i> ${__('print_pick_report')}`;
        }
    }
    
    async function updateOrderStatusCounts() {
        const response = await fetchData('api/picking_api.php?action=getOrderCountsByStatus');
        
        if (response?.success) {
            orderStatusCounts = response.data;
            
            const newPendingCount = orderStatusCounts['Pending Pick'] || 0;
            
            if (newPendingCount > 0) {
                const orderText = newPendingCount === 1 ? __('order') : __('orders');
                notificationArea.innerHTML = `
                    <div class="alert alert-primary alert-dismissible fade show" role="alert">
                        ${__('you_have')} <strong>${newPendingCount}</strong> ${__('new')} ${orderText} ${__('ready_for_picking')}. 
                        <a href="#" id="viewPendingLink" class="alert-link">${__('view_them_now')}</a>.
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="${__('close')}"></button>
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
                const toastOrderText = newOrders === 1 ? __('order_has') : __('orders_have');
                showMessageBox(`${newOrders} ${__('new')} ${toastOrderText} ${__('arrived')}!`, 'info');
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
