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
    let allWarehouseLocations = [];
    let warehouseLocationsMap = new Map();
    let productInventoryDetails = [];
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
    if (pickLocationSelect) $(pickLocationSelect).on('change', populateBatchDropdown);
    if (pickBatchNumberSelect) $(pickBatchNumberSelect).on('change', populateDotCodeDropdown);
    if (pickQuantityInput) pickQuantityInput.addEventListener('input', validatePickQuantity);
    if (pickDotCodeSelect) $(pickDotCodeSelect).on('change', validatePickQuantity);
    if (pickItemNumberInput) pickItemNumberInput.addEventListener('change', () => filterPickLocationsByProduct(pickItemNumberInput.value.trim()));

    async function initializePage() {
        initializeOrdersDataTable();
        $('#pickLocationSelect').select2({ theme: 'bootstrap-5' });
        $('#pickDotCodeSelect').select2({
            theme: 'bootstrap-5',
            templateResult: formatDotOption,
            templateSelection: (data) => data.text,
            escapeMarkup: m => m
        });

        try {
            await Promise.all([ 
                loadProductsForDropdown(), 
                loadPickableOrders(),
                loadAllWarehouseLocations()
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
    
    async function loadAllWarehouseLocations() {
        const response = await fetchData(`api/locations_api.php`);
        if (response?.success && Array.isArray(response.data)) {
            allWarehouseLocations = response.data.filter(loc => loc.is_active);
            warehouseLocationsMap = new Map(allWarehouseLocations.map(loc => [parseInt(loc.location_id, 10), loc]));
        }
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
                const canStage = ['Picked', 'Partially Picked'].includes(order.status);
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
            if (pickLocationSelect) {
                $(pickLocationSelect).empty().append(new Option('Enter item number first', '')).trigger('change');
            }
            if (pickBatchNumberSelect) { pickBatchNumberSelect.innerHTML = '<option value="">Select location first</option>'; pickBatchNumberSelect.disabled = true; }
            if (pickDotCodeSelect) { pickDotCodeSelect.innerHTML = '<option value="">Select batch first</option>'; pickDotCodeSelect.disabled = true; }
            if (pickQuantityInput) pickQuantityInput.value = '1';
            Toast.fire({ icon: 'info', title: `Selected Order: ${orderNumber}` });
        });
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
        
        if (!data.product_barcode || !data.location_id || !data.dot_code || isNaN(data.picked_quantity) || data.picked_quantity <= 0) { 
            Swal.fire('Validation Error', 'Product, Location, DOT Code, and a valid Quantity are required to pick.', 'error'); 
            return; 
        }
        
        const result = await fetchData('api/picking_api.php?action=pickItem', 'POST', data);
        if (result?.success) {
            Toast.fire({ icon: 'success', title: result.message });
            const pickedBarcode = pickItemNumberInput.value.trim();
            pickItemNumberInput.value = ''; 
            pickQuantityInput.value = '1';
            
            await loadOrderItems(selectedOrderId);
            await loadPickableOrders();
            await filterPickLocationsByProduct(pickedBarcode);
        }
    }

    function addOrderItemActionListeners(orderId) {
        document.querySelectorAll('.unpick-item-btn').forEach(button => button.addEventListener('click', (event) => { 
            const btn = event.target.closest('button'); 
            handleUnpickItem(btn.dataset.pickId, orderId); 
        }));
    }

    async function handleUnpickItem(pickId, orderId) {
        Swal.fire({ 
            title: 'Confirm Unpick', 
            text: 'Are you sure you want to return this picked item to stock?', 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#3085d6', 
            cancelButtonColor: '#d33', 
            confirmButtonText: 'Yes, unpick it!' 
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/picking_api.php?action=unpickItem', 'POST', { pick_id: pickId });
                if (apiResult?.success) {
                    Toast.fire({ icon: 'success', title: apiResult.message });
                    await Promise.all([loadOrderItems(orderId), loadPickableOrders()]);
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

        const { value: locationId } = await Swal.fire({
            title: 'Select Shipping Area',
            input: 'select',
            inputOptions: shippingAreaOptions,
            inputPlaceholder: 'Select an area',
            showCancelButton: true,
            inputValidator: (value) => !value && 'You need to select a shipping area!'
        });

        if (locationId) {
            const result = await fetchData('api/picking_api.php?action=stageOrder', 'POST', {
                order_id: selectedOrderId,
                shipping_area_location_id: locationId
            });
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

        const { value: driverId } = await Swal.fire({
            title: 'Assign Driver to Order',
            input: 'select',
            inputOptions: driverOptions,
            inputPlaceholder: 'Select a driver',
            showCancelButton: true,
            inputValidator: (value) => !value && 'You need to select a driver!'
        });

        if (driverId) {
            const result = await fetchData('api/picking_api.php?action=assignDriver', 'POST', {
                order_id: selectedOrderId,
                driver_user_id: driverId
            });
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
                const mainBarcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                const sideBarcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                
                generatorContainer.appendChild(mainBarcodeSvg);
                generatorContainer.appendChild(sideBarcodeSvg);

                let shelfLife = 'N/A';
                if (sticker.dot_code && sticker.expiry_years) {
                    const week = sticker.dot_code.substring(0, 2);
                    const year = parseInt(sticker.dot_code.substring(2), 10);
                    const expiry = parseInt(sticker.expiry_years, 10);
                    if (!isNaN(year) && !isNaN(expiry)) {
                        shelfLife = `${week}/${year + expiry}`;
                    }
                }
                
                JsBarcode(mainBarcodeSvg, sticker.sticker_code, { format: "CODE128", height: 30, displayValue: true, fontSize: 14 });
                JsBarcode(sideBarcodeSvg, sticker.tracking_number || sticker.order_number, { format: "CODE128", width: 1.5, height: 70, fontSize: 12, displayValue: true });

                const mainBarcodeHtml = mainBarcodeSvg.outerHTML;
                const sideBarcodeHtml = sideBarcodeSvg.outerHTML;

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
                                <p class="product-sku">${sticker.barcode} &nbsp;&nbsp;&nbsp; ${sticker.item_sequence} / ${sticker.item_total}</p>
                            </div>
                            <div class="barcode-block">
                                ${mainBarcodeHtml}
                            </div>
                        </div>
                        <div class="sticker-side-content">
                            <div class="side-barcode-block">${sideBarcodeHtml}</div>
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
                                .barcode-block { flex-shrink: 0; text-align: center; padding-top: 5px; }
                                .side-barcode-block { transform: rotate(-90deg); }
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
                                <td><div class="item-barcode-container" id="item-barcode-${globalIndex}"></div></td>
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
                                            <div class="order-barcode-container mt-2" id="order-barcode-page-${page}"></div>
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
                                            <th>DOT</th>\
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
                                .order-barcode-container svg { height: 40px; width: 100%; }
                                .item-barcode-container svg { height: 35px; width: 100%; margin: 0; }
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
                const orderBarcodeContainer = printFrame.contentDocument.getElementById(`order-barcode-page-${page}`);
                if (orderBarcodeContainer) {
                    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    JsBarcode(svg, order_details.order_number, { format: "CODE128", displayValue: false, height: 40, margin: 0 });
                    orderBarcodeContainer.appendChild(svg);
                }

                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageItems = items.slice(start, end);

                pageItems.forEach((item, index) => {
                    const globalIndex = start + index;
                    const itemBarcodeContainer = printFrame.contentDocument.getElementById(`item-barcode-${globalIndex}`);
                    if (itemBarcodeContainer && item.barcode) {
                        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                        JsBarcode(svg, item.barcode, { format: "CODE128", displayValue: false, height: 35, margin: 2, fontSize: 10 });
                        itemBarcodeContainer.appendChild(svg);
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


    async function filterPickLocationsByProduct(productBarcode) {
        $(pickLocationSelect).empty().append(new Option('Enter item number first', '')).trigger('change');
        $(pickBatchNumberSelect).empty().append(new Option('Select location first', '')).prop('disabled', true);
        $(pickDotCodeSelect).empty().append(new Option('Select batch first', '')).prop('disabled', true).trigger('change');
        productInventoryDetails = []; 

        if (!productBarcode) return;

        const product = allProducts.find(p => p.barcode === productBarcode || p.sku === productBarcode);
        if (!product) {
            Toast.fire({ icon: 'error', title: 'Product not found in system.' });
            return;
        }

        const isOnOrder = currentOrderItems.some(item => item.product_id == product.product_id);
        if (!isOnOrder) {
            Toast.fire({ icon: 'error', title: 'This product is not on the selected order.' });
            return;
        }

        $(pickLocationSelect).empty().append(new Option('Loading locations...', '')).trigger('change');
        
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
});
