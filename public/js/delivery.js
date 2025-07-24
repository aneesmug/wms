// public/js/delivery.js

document.addEventListener('DOMContentLoaded', () => {
    const ordersGrid = document.getElementById('ordersGrid');
    const loadingSpinnerActive = document.getElementById('loadingSpinnerActive');
    const noOrdersMessageActive = document.getElementById('noOrdersMessageActive');
    
    let completedOrdersTable = null;

    // Helper for standard JSON fetches
    async function fetchData(url, method = 'GET', data = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (data) {
                options.body = JSON.stringify(data);
            }
            const response = await fetch(url, options);
            const jsonResult = await response.json();
            if (!response.ok) {
                throw new Error(jsonResult.message || `An error occurred. Status: ${response.status}`);
            }
            return jsonResult;
        } catch (error) {
            console.error('Fetch Error:', error);
            Swal.fire('Error', error.message, 'error');
            return null;
        }
    }
    
    // Helper for FormData (file uploads)
    async function postDataWithFile(url, formData) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData 
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || `An error occurred. Status: ${response.status}`);
            }
            return result;
        } catch (error) {
            console.error('Fetch Error:', error);
            Swal.fire('Error', error.message, 'error');
            return null;
        }
    }

    function initializeCompletedOrdersDataTable() {
        // MODIFICATION: Updated column definitions for the new layout
        completedOrdersTable = $('#completedOrdersTable').DataTable({
            responsive: true,
            "order": [[ 6, "desc" ]], // Order by delivery date descending
            "columnDefs": [
                { "targets": "_all", "className": "align-middle" }, 
                { "targets": 7, "className": "text-center align-middle" } 
            ]
        });
    }

    async function loadAllOrders() {
        ordersGrid.innerHTML = '';
        loadingSpinnerActive.style.display = 'block';
        noOrdersMessageActive.classList.add('d-none');
        
        if (!completedOrdersTable) {
            initializeCompletedOrdersDataTable();
        }

        const [activeResult, deliveredResult] = await Promise.all([
            fetchData('api/driver_api.php?action=getAssignedOrders'),
            fetchData('api/driver_api.php?action=getDeliveredOrders')
        ]);

        // Process Active Orders
        loadingSpinnerActive.style.display = 'none';
        if (activeResult && activeResult.success && activeResult.data.length > 0) {
            activeResult.data.forEach(order => {
                const cardCol = document.createElement('div');
                cardCol.className = 'col';

                let statusBadge = '';
                let actionButtons = '';
                const totalItems = parseInt(order.total_items, 10) || 0;
                const scannedItems = parseInt(order.scanned_items_count, 10) || 0;

                if (order.status === 'Assigned') {
                    statusBadge = `<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle-fill me-1"></i> Pickup Verification Needed</span>`;
                    actionButtons = `
                        <a href="driver_pickup.php?order_id=${order.order_id}" class="btn btn-primary btn-sm w-100 mb-2">
                            <i class="bi bi-upc-scan"></i> Verify Pickup Items
                        </a>
                        <button class="btn btn-success btn-sm w-100" 
                                data-order-id="${order.order_id}" 
                                data-order-number="${order.order_number}" 
                                disabled
                                title="You must verify all items before confirming delivery">
                            <i class="bi bi-truck"></i> Confirm Delivery
                        </button>
                    `;
                    if (scannedItems === 0) {
                        actionButtons += `
                            <button class="btn btn-outline-danger btn-sm w-100 mt-2 reject-order-btn" data-order-id="${order.order_id}" data-order-number="${order.order_number}">
                                <i class="bi bi-x-lg"></i> Reject
                            </button>
                        `;
                    }
                } else if (order.status === 'Out for Delivery') {
                    statusBadge = `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i> Ready for Delivery</span>`;
                    actionButtons = `
                        <a href="driver_pickup.php?order_id=${order.order_id}" class="btn btn-info btn-sm w-100 mb-2">
                            <i class="bi bi-upc-scan"></i> Review Scanned Items
                        </a>
                        <button class="btn btn-success btn-sm w-100 confirm-delivery-btn" 
                                data-order-id="${order.order_id}" 
                                data-order-number="${order.order_number}">
                            <i class="bi bi-truck"></i> Confirm Delivery
                        </button>
                    `;
                }

                cardCol.innerHTML = `
                    <div class="card h-100 shadow-sm">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0">${order.order_number}</h5>
                            ${statusBadge}
                        </div>
                        <div class="card-body d-flex flex-column">
                            <p class="card-text">
                                <strong>Customer:</strong> ${order.customer_name}<br>
                                <strong>Address:</strong> ${order.full_address || 'N/A'}
                            </p>
                            <p class="card-text mt-auto">
                                <small class="text-muted"><strong>Items:</strong> ${scannedItems} / ${totalItems} scanned</small>
                            </p>
                        </div>
                        <div class="card-footer">
                            ${actionButtons}
                        </div>
                    </div>
                `;
                ordersGrid.appendChild(cardCol);
            });
        } else {
            noOrdersMessageActive.classList.remove('d-none');
        }

        const completedTableData = [];
        if (deliveredResult && deliveredResult.success && deliveredResult.data.length > 0) {
             deliveredResult.data.forEach(order => {
                let proofButton = '';
                if (order.delivery_photo_path) {
                    proofButton = `<a href="${order.delivery_photo_path}" target="_blank" class="btn btn-outline-info btn-sm"><i class="bi bi-camera-fill"></i> View</a>`;
                } else {
                    proofButton = `<span class="text-muted">N/A</span>`;
                }
                
                // MODIFICATION: Added new fields to the data array
                completedTableData.push([
                    order.order_number,
                    order.customer_name,
                    order.full_address || 'N/A',
                    order.customer_phone || 'N/A',
                    order.delivered_to_name || 'N/A',
                    order.receiver_phone || 'N/A',
                    new Date(order.actual_delivery_date).toLocaleString(),
                    proofButton
                ]);
            });
        }
        
        completedOrdersTable.clear().rows.add(completedTableData).draw();

        addEventListeners();
    }
    
    function addEventListeners() {
        document.querySelectorAll('.confirm-delivery-btn').forEach(button => {
            if (!button.disabled) {
                button.addEventListener('click', (e) => {
                    const { orderId, orderNumber } = e.target.closest('button').dataset;
                    showDeliveryConfirmation(orderId, orderNumber);
                });
            }
        });
        
        document.querySelectorAll('.reject-order-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const { orderId, orderNumber } = e.target.closest('button').dataset;
                handleRejectOrder(orderId, orderNumber);
            });
        });
    }

    function handleRejectOrder(orderId, orderNumber) {
        Swal.fire({
            title: `Reject Order ${orderNumber}?`,
            input: 'textarea',
            inputLabel: 'Reason for Rejection',
            inputPlaceholder: 'Enter your reason here...',
            showCancelButton: true,
            confirmButtonText: 'Reject Order',
            confirmButtonColor: '#dc3545',
            inputValidator: (value) => !value && 'You must provide a reason for rejection!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/driver_api.php?action=rejectOrder', 'POST', { 
                    order_id: orderId,
                    rejection_note: result.value
                });
                if (apiResult?.success) {
                    await Swal.fire('Rejected!', 'The order has been returned to the assignment pool.', 'success');
                    await loadAllOrders();
                }
            }
        });
    }

    function showDeliveryConfirmation(orderId, orderNumber) {
        Swal.fire({
            title: `Confirm Delivery: ${orderNumber}`,
            html: `
                <div class="text-start p-2">
                    <div class="mb-3">
                        <label for="swal-receiver-name" class="form-label">Receiver's Full Name</label>
                        <input id="swal-receiver-name" class="form-control" placeholder="Enter full name..." required>
                    </div>
                    <div class="mb-3">
                        <label for="swal-receiver-phone" class="form-label">Receiver's Phone (Optional)</label>
                        <input id="swal-receiver-phone" type="tel" class="form-control" placeholder="Enter phone number...">
                    </div>
                    <div class="mb-3">
                        <label for="swal-delivery-code" class="form-label">6-Digit Delivery Code (Optional)</label>
                        <input id="swal-delivery-code" class="form-control" placeholder="Enter code if provided...">
                    </div>
                    <div class="mb-3">
                        <label for="swal-delivery-photo" class="form-label">Proof of Delivery Photo</label>
                        <input id="swal-delivery-photo" type="file" class="form-control" accept="image/*" required>
                        <img id="swal-photo-preview" src="#" alt="Photo Preview" class="mt-2 rounded" style="display: none; max-width: 100%; max-height: 200px;"/>
                    </div>
                </div>`,
            confirmButtonText: 'Confirm Delivery',
            showCancelButton: true,
            focusConfirm: false,
            didOpen: () => {
                document.getElementById('swal-delivery-photo').addEventListener('change', function(event) {
                    const preview = document.getElementById('swal-photo-preview');
                    const file = event.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            preview.src = e.target.result;
                            preview.style.display = 'block';
                        }
                        reader.readAsDataURL(file);
                    }
                });
            },
            preConfirm: () => {
                const receiverName = document.getElementById('swal-receiver-name').value;
                const deliveryPhoto = document.getElementById('swal-delivery-photo').files[0];
                if (!receiverName || !deliveryPhoto) {
                    Swal.showValidationMessage('Receiver Name and a Proof of Delivery photo are required.');
                    return false;
                }
                return true;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const formData = new FormData();
                formData.append('order_id', orderId);
                formData.append('receiver_name', document.getElementById('swal-receiver-name').value);
                formData.append('receiver_phone', document.getElementById('swal-receiver-phone').value);
                formData.append('delivery_code', document.getElementById('swal-delivery-code').value);
                formData.append('delivery_photo', document.getElementById('swal-delivery-photo').files[0]);

                const apiResult = await postDataWithFile('api/driver_api.php?action=verifyDelivery', formData);
                if (apiResult?.success) {
                    Swal.fire('Success!', 'Delivery confirmed successfully.', 'success');
                    loadAllOrders(); 
                }
            }
        });
    }

    loadAllOrders();
});
