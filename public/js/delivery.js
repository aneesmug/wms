// public/js/delivery.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const orderDetailsArea = document.getElementById('orderDetailsArea');
    const noOrderSelected = document.getElementById('noOrderSelected');
    const orderNumberDisplay = document.getElementById('orderNumberDisplay');
    const orderStatusBadge = document.getElementById('orderStatusBadge');
    const customerName = document.getElementById('customerName');
    const customerAddress = document.getElementById('customerAddress');
    const totalItems = document.getElementById('totalItems');
    const scannedItems = document.getElementById('scannedItems');
    const currentOrderIdInput = document.getElementById('currentOrderId');
    const deliveryProofSection = document.getElementById('deliveryProofSection');
    const deliveredToName = document.getElementById('deliveredToName');
    const receiverPhone = document.getElementById('receiverPhone');
    const deliveryPhotoLink = document.getElementById('deliveryPhotoLink');
    const actionButtons = document.getElementById('actionButtons');
    
    // Scan Area Elements
    const scanArea = document.getElementById('scanArea');
    const cancelScanBtn = document.getElementById('cancelScanBtn');
    const scanItemList = document.getElementById('scanItemList');
    const scannerVideo = document.getElementById('scanner-video');
    const manualScanInput = document.getElementById('manualScanInput');
    const scanFeedback = document.getElementById('scanFeedback');
    const scanHistoryTableBody = document.getElementById('scanHistoryTableBody');

    // --- State ---
    let codeReader;
    let selectedOrder = null;
    let activeOrders = [];
    let deliveredOrders = [];
    let historyTable = null;
    let activeTable = null;
    let manualScanTimer;

    // --- API Helper ---
    async function fetchData(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, options);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }
            return data;
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
            console.error('API Error:', error);
            return null;
        }
    }

    // --- Initialization ---
    function initialize() {
        initializeTables();
        loadAllOrders();
        setupEventListeners();
    }

    function initializeTables() {
        activeTable = $('#assignedOrdersTable').DataTable({
            responsive: true,
            order: [],
            columnDefs: [
                { targets: '_all', className: 'align-middle' },
                { targets: [3], visible: false } // Hide the order_id column
            ]
        });

        historyTable = $('#deliveredOrdersTable').DataTable({
            responsive: true,
            order: [[3, 'desc']],
            columnDefs: [
                { targets: '_all', className: 'align-middle' },
                { targets: [4], visible: false } // Hide the order_id column
            ]
        });
    }

    async function loadAllOrders() {
        await Promise.all([
            loadAssignedOrders(),
            loadDeliveredOrders()
        ]);
    }

    async function loadAssignedOrders() {
        const result = await fetchData('api/driver_api.php?action=getAssignedOrders');
        if (result && result.success) {
            activeOrders = result.data;
            const tableData = activeOrders.map(order => {
                const statusBadge = `<span class="badge bg-primary">${order.status}</span>`;
                return [
                    order.order_number,
                    order.customer_name,
                    statusBadge,
                    order.order_id
                ];
            });
            activeTable.clear();
            activeTable.rows.add(tableData).draw();
        }
    }

    async function loadDeliveredOrders() {
        const result = await fetchData('api/driver_api.php?action=getDeliveredOrders');
        if (result && result.success) {
            deliveredOrders = result.data;
            const tableData = deliveredOrders.map(order => {
                const isFailed = ['Delivery Failed', 'Cancelled', 'Rejected'].includes(order.status);
                const statusBadge = `<span class="badge ${isFailed ? 'bg-danger' : 'bg-success'}">${order.status}</span>`;
                const orderDate = order.actual_delivery_date || order.updated_at;
                return [
                    order.order_number,
                    order.customer_name,
                    statusBadge,
                    new Date(orderDate).toLocaleString(),
                    order.order_id // Hidden data for row selection
                ];
            });

            historyTable.clear();
            historyTable.rows.add(tableData).draw();
        }
    }

    function setupEventListeners() {
        $('#assignedOrdersTable tbody').on('click', 'tr', function () {
            const rowData = activeTable.row(this).data();
            if (rowData) {
                const orderId = rowData[3];
                selectOrder(orderId);
            }
        });

        $('#deliveredOrdersTable tbody').on('click', 'tr', function () {
            const rowData = historyTable.row(this).data();
            if (rowData) {
                const orderId = rowData[4];
                selectOrder(orderId);
            }
        });

        actionButtons.addEventListener('click', (e) => {
            const targetId = e.target.id || e.target.closest('button').id;
            if (targetId === 'scanPickupBtn') startScanningSession();
            if (targetId === 'confirmDeliveryBtn') handleConfirmDelivery();
            if (targetId === 'reportFailureBtn') handleReportFailure();
            if (targetId === 'rejectOrderBtn') handleRejectOrder();
        });

        cancelScanBtn.addEventListener('click', () => toggleScanArea(false));

        manualScanInput.addEventListener('input', () => {
            clearTimeout(manualScanTimer);
            manualScanTimer = setTimeout(() => {
                const code = manualScanInput.value.trim();
                if (code) {
                    processScan(code);
                }
            }, 300);
        });
    }

    // --- Order Selection & Display ---
    function selectOrder(orderId) {
        toggleScanArea(false);
        activeTable.$('tr.table-primary').removeClass('table-primary');
        historyTable.$('tr.table-primary').removeClass('table-primary');

        const activeRowIndex = activeTable.rows().data().toArray().findIndex(row => row[3] == orderId);
        if (activeRowIndex > -1) {
            $(activeTable.row(activeRowIndex).node()).addClass('table-primary');
        } else {
            const historyRowIndex = historyTable.rows().data().toArray().findIndex(row => row[4] == orderId);
            if (historyRowIndex > -1) {
                $(historyTable.row(historyRowIndex).node()).addClass('table-primary');
            }
        }

        selectedOrder = activeOrders.find(o => o.order_id == orderId) || deliveredOrders.find(o => o.order_id == orderId);
        
        if (selectedOrder) {
            currentOrderIdInput.value = selectedOrder.order_id;
            orderNumberDisplay.textContent = selectedOrder.order_number;
            customerName.textContent = selectedOrder.customer_name;
            customerAddress.textContent = selectedOrder.full_address || 'N/A';
            totalItems.textContent = selectedOrder.total_items != null ? selectedOrder.total_items : 'N/A';
            scannedItems.textContent = selectedOrder.scanned_items_count != null ? selectedOrder.scanned_items_count : 'N/A';
            updateUIForOrderStatus();
            noOrderSelected.classList.add('d-none');
            orderDetailsArea.classList.remove('d-none');
        }
    }
    
    function updateUIForOrderStatus() {
        const isAssigned = selectedOrder.status === 'Assigned';
        const isOutForDelivery = selectedOrder.status === 'Out for Delivery';
        const isComplete = ['Delivered', 'Delivery Failed', 'Returned', 'Partially Returned', 'Cancelled', 'Rejected'].includes(selectedOrder.status);

        actionButtons.innerHTML = '';
        if(isAssigned) {
            actionButtons.innerHTML = `
                <button id="scanPickupBtn" class="btn btn-primary"><i class="bi bi-upc-scan me-1"></i> Scan for Pickup</button>
                <button id="rejectOrderBtn" class="btn btn-warning"><i class="bi bi-x-circle me-1"></i> Reject Order</button>
            `;
        } else if (isOutForDelivery) {
            actionButtons.innerHTML = `
                <button id="confirmDeliveryBtn" class="btn btn-success"><i class="bi bi-check-circle me-1"></i> Confirm Delivery</button>
                <button id="reportFailureBtn" class="btn btn-danger"><i class="bi bi-exclamation-triangle me-1"></i> Report Failed Attempt</button>
            `;
        }
        
        if (deliveryProofSection) {
            deliveryProofSection.classList.toggle('d-none', !isComplete || selectedOrder.status !== 'Delivered');
            if (selectedOrder.status === 'Delivered') {
                deliveredToName.textContent = selectedOrder.delivered_to_name || 'N/A';
                receiverPhone.textContent = selectedOrder.receiver_phone || 'N/A';
                deliveryPhotoLink.href = selectedOrder.delivery_photo_path || '#';
            }
        }

        orderStatusBadge.textContent = selectedOrder.status;
        const statusClasses = { 
            'Assigned': 'bg-dark', 
            'Out for Delivery': 'bg-primary',
            'Delivered': 'bg-success',
            'Delivery Failed': 'bg-danger',
            'Cancelled': 'bg-danger',
            'Rejected': 'bg-warning text-dark'
        };
        orderStatusBadge.className = `badge ${statusClasses[selectedOrder.status] || 'bg-secondary'}`;
    }

    // --- Actions ---
    function handleRejectOrder() {
        const reasons = {
            'Vehicle full': 'Not enough space in vehicle',
            'Schedule conflict': 'Schedule conflict',
            'Incorrect order details': 'Incorrect order details',
            'Other': 'Other (specify in notes)'
        };
    
        Swal.fire({
            title: 'Reject Order Assignment',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label for="swal-rejection-reason" class="form-label">Reason for Rejection</label>
                        <select id="swal-rejection-reason" class="form-select">
                            <option value="">-- Select a Reason --</option>
                            ${Object.keys(reasons).map(key => `<option value="${key}">${reasons[key]}</option>`).join('')}
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="swal-rejection-notes" class="form-label">Additional Notes</label>
                        <textarea id="swal-rejection-notes" class="form-control" placeholder="Provide more details..."></textarea>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Submit Rejection',
            confirmButtonColor: '#dc3545',
            preConfirm: () => {
                const reason = document.getElementById('swal-rejection-reason').value;
                const notes = document.getElementById('swal-rejection-notes').value.trim();
    
                if (!reason) {
                    Swal.showValidationMessage('You must select a reason for rejection!');
                    return false;
                }
                if (reason === 'Other' && !notes) {
                    Swal.showValidationMessage('Please provide details in the notes when selecting "Other".');
                    return false;
                }
                
                let fullReason = reason;
                if (notes) {
                    fullReason += `. Notes: ${notes}`;
                }
                return fullReason;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/driver_api.php?action=rejectOrder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_id: selectedOrder.order_id,
                        rejection_note: result.value
                    })
                });
                if (apiResult && apiResult.success) {
                    Swal.fire('Rejected', 'The order has been returned to the assignment pool.', 'success');
                    loadAllOrders();
                    orderDetailsArea.classList.add('d-none');
                    noOrderSelected.classList.remove('d-none');
                }
            }
        });
    }

    function handleReportFailure() {
        const reasons = {
            'Customer not available': 'Customer not available',
            'Incorrect address': 'Incorrect address',
            'Customer refused delivery': 'Customer refused delivery',
            'Could not access location': 'Could not access location',
            'Other': 'Other (specify in notes)'
        };
    
        Swal.fire({
            title: 'Report Failed Delivery Attempt',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label for="swal-failure-reason" class="form-label">Reason for Failure</label>
                        <select id="swal-failure-reason" class="form-select">
                            <option value="">-- Select a Reason --</option>
                            ${Object.keys(reasons).map(key => `<option value="${key}">${reasons[key]}</option>`).join('')}
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="swal-failure-notes" class="form-label">Additional Notes</label>
                        <textarea id="swal-failure-notes" class="form-control" placeholder="Provide more details..."></textarea>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Submit Report',
            confirmButtonColor: '#d33',
            preConfirm: () => {
                const reason = document.getElementById('swal-failure-reason').value;
                const notes = document.getElementById('swal-failure-notes').value.trim();
    
                if (!reason) {
                    Swal.showValidationMessage('You must select a reason for the failure!');
                    return false;
                }
                if (reason === 'Other' && !notes) {
                    Swal.showValidationMessage('Please provide details in the notes when selecting "Other".');
                    return false;
                }
                
                let fullReason = reason;
                if (notes) {
                    fullReason += `. Notes: ${notes}`;
                }
                return fullReason;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/driver_api.php?action=reportFailedDelivery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_id: selectedOrder.order_id,
                        reason: result.value
                    })
                });
                if (apiResult && apiResult.success) {
                    Swal.fire('Reported', 'The failed delivery attempt has been logged.', 'success');
                    loadAllOrders();
                    orderDetailsArea.classList.add('d-none');
                    noOrderSelected.classList.remove('d-none');
                }
            }
        });
    }
    
    function handleConfirmDelivery() {
        Swal.fire({
            title: 'Confirm Delivery',
            html: `
                <form id="deliveryForm" class="text-start">
                    <div class="mb-3">
                        <label for="swal-receiverName" class="form-label">Receiver's Name <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="swal-receiverName" required>
                    </div>
                    <div class="mb-3">
                        <label for="swal-receiverPhone" class="form-label">Receiver's Phone (Optional)</label>
                        <input type="tel" class="form-control" id="swal-receiverPhone" placeholder="Enter phone number">
                    </div>
                    <div class="mb-3">
                        <label for="swal-deliveryCode" class="form-label">Delivery Confirmation Code</label>
                        <input type="text" class="form-control" id="swal-deliveryCode" placeholder="Ask customer for code (if applicable)">
                    </div>
                     <div class="mb-3">
                        <label for="swal-deliveryPhoto" class="form-label">Proof of Delivery Photo <span class="text-danger">*</span></label>
                        <input type="file" class="form-control" id="swal-deliveryPhoto" accept="image/*" required>
                    </div>
                </form>`,
            showCancelButton: true,
            confirmButtonText: 'Submit Confirmation',
            preConfirm: async () => {
                const receiverName = document.getElementById('swal-receiverName').value;
                const deliveryPhoto = document.getElementById('swal-deliveryPhoto').files[0];

                if (!receiverName || !deliveryPhoto) {
                    Swal.showValidationMessage('Receiver Name and Photo are required.');
                    return false;
                }

                const formData = new FormData();
                formData.append('order_id', selectedOrder.order_id);
                formData.append('receiver_name', receiverName);
                formData.append('receiver_phone', document.getElementById('swal-receiverPhone').value);
                formData.append('delivery_code', document.getElementById('swal-deliveryCode').value);
                formData.append('delivery_photo', deliveryPhoto);

                const result = await fetchData('api/driver_api.php?action=verifyDelivery', {
                    method: 'POST',
                    body: formData
                });

                if (result && result.success) {
                    return result;
                } else {
                    Swal.showValidationMessage(`Request failed: ${result ? result.message : 'Unknown error'}`);
                    return false;
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('Success!', 'Delivery confirmed successfully.', 'success');
                loadAllOrders();
                orderDetailsArea.classList.add('d-none');
                noOrderSelected.classList.remove('d-none');
            }
        });
    }

    // --- Scanning Logic ---
    function toggleScanArea(show) {
        if (show) {
            scanArea.classList.remove('d-none');
        } else {
            scanArea.classList.add('d-none');
            if (codeReader) {
                codeReader.reset();
            }
        }
    }

    async function startScanningSession() {
        toggleScanArea(true);
        const result = await fetchData(`api/driver_api.php?action=getOrderDetailsForScan&order_id=${selectedOrder.order_id}`);
        if (!result || !result.success) {
            toggleScanArea(false);
            return;
        }

        scanItemList.innerHTML = '';
        result.data.items.forEach(item => {
            const isComplete = (item.scanned_quantity || 0) >= item.ordered_quantity;
            const li = document.createElement('li');
            li.className = `list-group-item d-flex justify-content-between align-items-center ${isComplete ? 'list-group-item-success' : ''}`;
            li.id = `scan-product-${item.product_id}`;
            li.innerHTML = `
                <span>${item.product_name}</span>
                <span class="badge ${isComplete ? 'bg-success' : 'bg-secondary'} rounded-pill">
                    <span id="scan-qty-${item.product_id}">${item.scanned_quantity || 0}</span> / ${item.ordered_quantity}
                </span>`;
            scanItemList.appendChild(li);
        });
        
        populateScanHistory(result.data.scanned_items_log);
        initScanner();
    }
    
    function populateScanHistory(historyLogs) {
        scanHistoryTableBody.innerHTML = '';
        if (historyLogs && historyLogs.length > 0) {
            historyLogs.forEach(log => {
                const row = scanHistoryTableBody.insertRow();
                row.innerHTML = `
                    <td>${new Date(log.scanned_at).toLocaleTimeString()}</td>
                    <td>${log.product_name}</td>
                    <td><code>${log.sticker_code}</code></td>
                `;
            });
        } else {
            scanHistoryTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No scans yet.</td></tr>';
        }
    }

    function initScanner() {
        codeReader = new ZXing.BrowserMultiFormatReader();
        codeReader.getVideoInputDevices()
            .then(videoInputDevices => {
                if (videoInputDevices.length > 0) {
                    codeReader.decodeFromVideoDevice(videoInputDevices[0].deviceId, 'scanner-video', (result, err) => {
                        if (result) {
                            processScan(result.text);
                        }
                    });
                } else {
                    scanFeedback.innerHTML = '<div class="alert alert-warning">No camera found. Please use manual input.</div>';
                }
            })
            .catch(err => {
                console.error("Scanner Init Error:", err);
                scanFeedback.innerHTML = '<div class="alert alert-danger">Could not initialize camera. Please check browser permissions.</div>';
            });
    }

    async function processScan(code) {
        if (!code) return;
        
        manualScanInput.disabled = true;
        manualScanInput.value = '';
        scanFeedback.innerHTML = `<div class="alert alert-info">Processing...</div>`;

        const result = await fetchData('api/driver_api.php?action=scanOrderItem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: selectedOrder.order_id, barcode: code })
        });

        if (result && result.success) {
            scanFeedback.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
            const { product_id, new_scanned_quantity, new_order_status } = result.data;
            
            const itemLi = document.getElementById(`scan-product-${product_id}`);
            const qtySpan = document.getElementById(`scan-qty-${product_id}`);
            if (itemLi && qtySpan) {
                qtySpan.textContent = new_scanned_quantity;
                const ordered = parseInt(qtySpan.parentElement.textContent.split('/')[1].trim(), 10);
                if (new_scanned_quantity >= ordered) {
                    itemLi.classList.add('list-group-item-success');
                    qtySpan.parentElement.classList.remove('bg-secondary');
                    qtySpan.parentElement.classList.add('bg-success');
                }
            }
            
            const scanDetails = await fetchData(`api/driver_api.php?action=getOrderDetailsForScan&order_id=${selectedOrder.order_id}`);
            if(scanDetails && scanDetails.success) {
                populateScanHistory(scanDetails.data.scanned_items_log);
            }

            if (new_order_status) {
                toggleScanArea(false);
                Swal.fire({
                    title: 'Scan Complete!',
                    text: 'All items scanned. The order is now Out for Delivery.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    location.reload();
                });
            }
        } else {
            scanFeedback.innerHTML = `<div class="alert alert-danger">${result ? result.message : 'An unknown error occurred.'}</div>`;
        }

        setTimeout(() => {
            manualScanInput.disabled = false;
            manualScanInput.focus();
        }, 1500);
    }

    initialize();
});
