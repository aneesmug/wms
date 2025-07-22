// public/js/delivery.js

document.addEventListener('DOMContentLoaded', () => {
    const ordersList = document.getElementById('ordersList');

    /**
     * Fetches and displays the orders assigned to the driver.
     */
    async function loadAssignedOrders() {
        const result = await fetchData('api/driver_api.php?action=getAssignedOrders');
        
        if (!ordersList) return;
        ordersList.innerHTML = ''; // Clear previous list

        if (result && result.success && result.data.length > 0) {
            result.data.forEach(order => {
                const orderElement = document.createElement('div');
                orderElement.className = 'list-group-item list-group-item-action flex-column align-items-start';

                // Determine if all items have been scanned to show the correct verification status
                const totalItems = parseInt(order.total_items, 10) || 0;
                const scannedItems = parseInt(order.scanned_items_count, 10) || 0;
                const allItemsScanned = scannedItems >= totalItems && totalItems > 0;

                const verificationBadge = allItemsScanned
                    ? `<span class="badge bg-success"><i class="bi bi-check-circle-fill"></i> Pickup Verified</span>`
                    : `<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle-fill"></i> Verification Needed</span>`;

                orderElement.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">${order.order_number}</h5>
                        <small>${verificationBadge}</small>
                    </div>
                    <p class="mb-1">
                        <strong>Customer:</strong> ${order.customer_name}<br>
                        <strong>Tracking #:</strong> ${order.tracking_number || 'N/A'}
                    </p>
                    <small class="text-muted"><strong>Items:</strong> ${scannedItems} / ${totalItems} scanned</small>
                    <div class="mt-3">
                        <a href="driver_pickup.php?order_id=${order.order_id}" class="btn btn-primary btn-sm">
                            <i class="bi bi-upc-scan"></i> Verify Pickup Items
                        </a>
                        <button class="btn btn-success btn-sm ms-2 confirm-delivery-btn" 
                                data-order-id="${order.order_id}" 
                                data-order-number="${order.order_number}" 
                                ${!allItemsScanned ? 'disabled' : ''}
                                title="${!allItemsScanned ? 'You must verify all items before confirming delivery' : 'Confirm Final Delivery'}">
                            <i class="bi bi-truck"></i> Confirm Delivery
                        </button>
                    </div>
                `;
                ordersList.appendChild(orderElement);
            });

            // Add event listeners to all the "Confirm Delivery" buttons that are not disabled
            document.querySelectorAll('.confirm-delivery-btn').forEach(button => {
                if (!button.disabled) {
                    button.addEventListener('click', (e) => {
                        const { orderId, orderNumber } = e.target.closest('button').dataset;
                        showDeliveryConfirmation(orderId, orderNumber);
                    });
                }
            });
        } else {
            ordersList.innerHTML = '<div class="alert alert-info">You have no active deliveries assigned.</div>';
        }
    }

    /**
     * Shows a SweetAlert2 modal to confirm the final delivery to the customer.
     * @param {number} orderId - The ID of the order to confirm.
     * @param {string} orderNumber - The order number for display.
     */
    function showDeliveryConfirmation(orderId, orderNumber) {
        Swal.fire({
            title: `Confirm Delivery: ${orderNumber}`,
            html: `
                <div class="text-start p-2">
                    <label for="swal-receiver-name" class="form-label">Receiver's Full Name</label>
                    <input id="swal-receiver-name" class="form-control" placeholder="Enter full name..." required>
                    <label for="swal-delivery-code" class="form-label mt-3">6-Digit Delivery Code</label>
                    <input id="swal-delivery-code" class="form-control" placeholder="Enter code from customer..." required>
                </div>`,
            confirmButtonText: 'Confirm Delivery',
            showCancelButton: true,
            focusConfirm: false,
            preConfirm: () => {
                const receiverName = document.getElementById('swal-receiver-name').value;
                const deliveryCode = document.getElementById('swal-delivery-code').value;
                if (!receiverName || !deliveryCode) {
                    Swal.showValidationMessage('Please fill out all fields.');
                    return false;
                }
                return { receiver_name: receiverName, delivery_code: deliveryCode };
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
                    loadAssignedOrders(); // Refresh the list of orders
                }
                // Error messages are handled by the global fetchData function
            }
        });
    }

    // Initial load of orders when the page is ready
    loadAssignedOrders();
});
