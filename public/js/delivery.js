// public/js/delivery.js

document.addEventListener('DOMContentLoaded', () => {
    const ordersList = document.getElementById('ordersList');

    async function loadAssignedOrders() {
        const result = await fetchData('api/driver_api.php?action=getAssignedOrders');
        
        if (!ordersList) return;
        ordersList.innerHTML = ''; 

        if (result && result.success && result.data.length > 0) {
            result.data.forEach(order => {
                const orderElement = document.createElement('div');
                orderElement.className = 'list-group-item list-group-item-action flex-column align-items-start';

                let statusBadge = '';
                let actionButtons = '';
                const totalItems = parseInt(order.total_items, 10) || 0;
                const scannedItems = parseInt(order.scanned_items_count, 10) || 0;
                const allItemsScanned = scannedItems >= totalItems && totalItems > 0;

                // --- MODIFICATION: Reworked logic for 'Assigned' and 'Out for Delivery' statuses ---
                if (order.status === 'Assigned') {
                    statusBadge = `<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle-fill"></i> Pickup Verification Needed</span>`;
                    
                    actionButtons = `
                        <a href="driver_pickup.php?order_id=${order.order_id}" class="btn btn-primary btn-sm">
                            <i class="bi bi-upc-scan"></i> Verify Pickup Items
                        </a>
                        <button class="btn btn-success btn-sm ms-2 confirm-delivery-btn" 
                                data-order-id="${order.order_id}" 
                                data-order-number="${order.order_number}" 
                                disabled
                                title="You must verify all items before confirming delivery">
                            <i class="bi bi-truck"></i> Confirm Delivery
                        </button>
                    `;
                    // Only allow rejection if the scanning process has not started
                    if (scannedItems === 0) {
                        actionButtons += `
                            <button class="btn btn-danger btn-sm ms-2 reject-order-btn" data-order-id="${order.order_id}" data-order-number="${order.order_number}">
                                <i class="bi bi-x-lg"></i> Reject
                            </button>
                        `;
                    }
                } else if (order.status === 'Out for Delivery') {
                    statusBadge = `<span class="badge bg-success"><i class="bi bi-check-circle-fill"></i> Ready for Delivery</span>`;
                    
                    actionButtons = `
                        <a href="driver_pickup.php?order_id=${order.order_id}" class="btn btn-primary btn-sm">
                            <i class="bi bi-upc-scan"></i> Review Scanned Items
                        </a>
                        <button class="btn btn-success btn-sm ms-2 confirm-delivery-btn" 
                                data-order-id="${order.order_id}" 
                                data-order-number="${order.order_number}">
                            <i class="bi bi-truck"></i> Confirm Delivery
                        </button>
                    `;
                }
                // --- END MODIFICATION ---

                orderElement.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">${order.order_number}</h5>
                        <small>${statusBadge}</small>
                    </div>
                    <p class="mb-1">
                        <strong>Customer:</strong> ${order.customer_name}<br>
                        <strong>Address:</strong> ${order.full_address || 'N/A'}
                    </p>
                    <small class="text-muted"><strong>Items:</strong> ${scannedItems} / ${totalItems} scanned</small>
                    <div class="mt-3">
                        ${actionButtons}
                    </div>
                `;
                ordersList.appendChild(orderElement);
            });

            document.querySelectorAll('.confirm-delivery-btn').forEach(button => {
                if (!button.disabled) {
                    button.addEventListener('click', (e) => {
                        const { orderId, orderNumber } = e.target.closest('button').dataset;
                        showDeliveryConfirmation(orderId, orderNumber);
                    });
                }
            });
            
            // --- MODIFICATION: Removed the event listener for '.accept-order-btn' ---
            
            document.querySelectorAll('.reject-order-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const { orderId, orderNumber } = e.target.closest('button').dataset;
                    handleRejectOrder(orderId, orderNumber);
                });
            });

        } else {
            ordersList.innerHTML = '<div class="alert alert-info">You have no active deliveries assigned.</div>';
        }
    }
    
    // --- MODIFICATION: Removed the handleAcceptOrder function ---

    function handleRejectOrder(orderId, orderNumber) {
        Swal.fire({
            title: `Reject Order ${orderNumber}?`,
            input: 'textarea',
            inputLabel: 'Reason for Rejection',
            inputPlaceholder: 'Enter your reason here...',
            inputAttributes: {
                'aria-label': 'Type your reason here'
            },
            showCancelButton: true,
            confirmButtonText: 'Reject Order',
            confirmButtonColor: '#dc3545',
            inputValidator: (value) => {
                if (!value) {
                    return 'You must provide a reason for rejection!'
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/driver_api.php?action=rejectOrder', 'POST', { 
                    order_id: orderId,
                    rejection_note: result.value
                });
                if (apiResult && apiResult.success) {
                    await Swal.fire('Rejected!', 'The order has been returned to the assignment pool.', 'success');
                    await loadAssignedOrders();
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
                    <div>
                        <label for="swal-delivery-code" class="form-label">6-Digit Delivery Code</label>
                        <input id="swal-delivery-code" class="form-control" placeholder="Enter code from customer..." required>
                    </div>
                </div>`,
            confirmButtonText: 'Confirm Delivery',
            showCancelButton: true,
            focusConfirm: false,
            preConfirm: () => {
                const receiverName = document.getElementById('swal-receiver-name').value;
                const deliveryCode = document.getElementById('swal-delivery-code').value;
                const receiverPhone = document.getElementById('swal-receiver-phone').value;
                if (!receiverName || !deliveryCode) {
                    Swal.showValidationMessage('Please fill out all required fields.');
                    return false;
                }
                return { receiver_name: receiverName, delivery_code: deliveryCode, receiver_phone: receiverPhone };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const data = {
                    order_id: orderId,
                    ...result.value
                };
                const apiResult = await fetchData('api/driver_api.php?action=verifyDelivery', 'POST', data);
                if (apiResult && apiResult.success) {
                    Swal.fire('Success!', 'Delivery confirmed successfully.', 'success');
                    loadAssignedOrders(); 
                }
            }
        });
    }

    loadAssignedOrders();
});
