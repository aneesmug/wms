// public/js/customers.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    
    // --- State & Config ---
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let customersTable = null;

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    if (addCustomerBtn) addCustomerBtn.addEventListener('click', () => showCustomerForm(null));

    initializePage();

    async function initializePage() {
        const canManage = ['operator', 'manager'].includes(currentWarehouseRole);
        if (addCustomerBtn) addCustomerBtn.style.display = canManage ? 'block' : 'none';
        
        initializeCustomersDataTable();
        await loadCustomers();
    }

    function initializeCustomersDataTable() {
        customersTable = $('#customersTable').DataTable({
            responsive: true,
            "order": [[0, "asc"]],
            columns: [
                { data: 'customer_name' },
                { data: 'contact_person', defaultContent: 'N/A' },
                { data: 'email', defaultContent: 'N/A' },
                { data: 'phone', defaultContent: 'N/A' },
                { data: 'city', defaultContent: 'N/A' },
                { 
                    data: null,
                    orderable: false,
                    className: 'text-end',
                    render: function(data, type, row) {
                        const canEdit = ['operator', 'manager'].includes(currentWarehouseRole);
                        const canDelete = currentWarehouseRole === 'manager';
                        let actionsHtml = `<button data-id="${row.customer_id}" data-name="${row.customer_name}" class="btn btn-sm btn-outline-secondary view-orders-btn" title="View Order History"><i class="bi bi-list-ul"></i></button>`;
                        actionsHtml += ` <button onclick="window.location.href='customer_transactions.php?customer_id=${row.customer_id}'" class="btn btn-sm btn-outline-success ms-2" title="Transactions"><i class="bi bi-cash-coin"></i></button>`;
                        if (canEdit) {
                            actionsHtml += `<button data-id="${row.customer_id}" class="btn btn-sm btn-outline-primary edit-btn ms-2" title="Edit"><i class="bi bi-pencil"></i></button>`;
                        }
                        if (canDelete) {
                            actionsHtml += `<button data-id="${row.customer_id}" class="btn btn-sm btn-outline-danger delete-btn ms-2" title="Delete"><i class="bi bi-trash"></i></button>`;
                        }
                        return actionsHtml;
                    }
                }
            ]
        });
        $('#customersTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadCustomers() {
        try {
            const response = await fetchData('api/customers_api.php');
            if (response?.success && Array.isArray(response.data)) {
                customersTable.clear().rows.add(response.data).draw();
            }
        } catch (error) {
            Swal.fire('Error', `Could not load customers: ${error.message}`, 'error');
        }
    }

    async function showCustomerForm(customer) {
        const isEditing = customer !== null;
        Swal.fire({
            title: isEditing ? `Edit Customer: ${customer.customer_name}` : 'Add New Customer',
            html: `
                <form id="swalCustomerForm" class="text-start mt-3">
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swal-customerName" class="form-label">Customer Name*</label><input type="text" id="swal-customerName" class="form-control" value="${isEditing ? customer.customer_name : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-contactPerson" class="form-label">Contact Person</label><input type="text" id="swal-contactPerson" class="form-control" value="${isEditing ? customer.contact_person || '' : ''}"></div>
                        <div class="col-md-6 mb-3"><label for="swal-email" class="form-label">Email</label><input type="email" id="swal-email" class="form-control" value="${isEditing ? customer.email || '' : ''}"></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone" class="form-label">Phone</label><input type="tel" id="swal-phone" class="form-control" value="${isEditing ? customer.phone || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine1" class="form-label">Address Line 1</label><input type="text" id="swal-addressLine1" class="form-control" value="${isEditing ? customer.address_line1 || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine2" class="form-label">Address Line 2</label><input type="text" id="swal-addressLine2" class="form-control" value="${isEditing ? customer.address_line2 || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-city" class="form-label">City</label><input type="text" id="swal-city" class="form-control" value="${isEditing ? customer.city || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-state" class="form-label">State</label><input type="text" id="swal-state" class="form-control" value="${isEditing ? customer.state || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-zipCode" class="form-label">Zip Code</label><input type="text" id="swal-zipCode" class="form-control" value="${isEditing ? customer.zip_code || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-country" class="form-label">Country</label><input type="text" id="swal-country" class="form-control" value="${isEditing ? customer.country || '' : ''}"></div>
                    </div>
                </form>`,
            width: '800px', showCancelButton: true, confirmButtonText: isEditing ? 'Save Changes' : 'Create Customer', focusConfirm: false,
            preConfirm: () => {
                const name = document.getElementById('swal-customerName').value;
                if (!name) { Swal.showValidationMessage('Customer Name is required'); return false; }
                return {
                    customer_id: isEditing ? customer.customer_id : null, customer_name: name,
                    contact_person: document.getElementById('swal-contactPerson').value, email: document.getElementById('swal-email').value,
                    phone: document.getElementById('swal-phone').value, address_line1: document.getElementById('swal-addressLine1').value,
                    address_line2: document.getElementById('swal-addressLine2').value, city: document.getElementById('swal-city').value,
                    state: document.getElementById('swal-state').value, zip_code: document.getElementById('swal-zipCode').value,
                    country: document.getElementById('swal-country').value,
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const data = result.value;
                const method = isEditing ? 'PUT' : 'POST';
                try {
                    const apiResult = await fetchData('api/customers_api.php', method, data);
                    if (apiResult?.success) { Toast.fire({ icon: 'success', title: apiResult.message }); await loadCustomers(); }
                } catch (error) { Swal.fire('Error!', error.message, 'error'); }
            }
        });
    }

    async function handleEditClick(event) {
        const id = event.target.closest('button').dataset.id;
        try {
            const response = await fetchData(`api/customers_api.php?id=${id}`);
            if (response?.success) { await showCustomerForm(response.data); }
        } catch (error) { Swal.fire('Error', `Could not load customer data: ${error.message}`, 'error'); }
    }

    async function showCustomerOrders(customerId, customerName) {
        Swal.fire({
            title: `Order History for ${customerName}`,
            html: '<div class="d-flex justify-content-center"><div class="spinner-border" role="status"></div></div>',
            width: '90%', showConfirmButton: false, showCloseButton: true,
            didOpen: async () => {
                try {
                    const response = await fetchData(`api/outbound_api.php?customer_id=${customerId}`);
                    let tableHtml = `<div class="table-responsive mt-3"><table class="table table-sm table-striped table-bordered"><thead><tr><th>Order #</th><th>Order Date</th><th>Required Ship Date</th><th>Status</th><th class="text-end">Actions</th></tr></thead><tbody>`;
                    if (response?.success && Array.isArray(response.data)) {
                        const customerOrders = response.data;
                        if (customerOrders.length === 0) {
                            tableHtml += `<tr><td colspan="5" class="text-center p-3">No orders found for this customer.</td></tr>`;
                        } else {
                            customerOrders.forEach(order => {
                                const statusMap = { 'Delivered': 'bg-success', 'Returned': 'bg-info', 'Partially Returned': 'bg-warning text-dark', 'Shipped': 'bg-info', 'Cancelled': 'bg-danger' };
                                const statusClass = statusMap[order.status] || 'bg-secondary';
                                let actionsHtml = '';
                                
                                const canReturn = ['Shipped', 'Delivered', 'Partially Returned'].includes(order.status) && ['operator', 'manager'].includes(currentWarehouseRole);
                                if (canReturn) {
                                    actionsHtml += `<button data-order-id="${order.order_id}" class="btn btn-sm btn-outline-warning create-return-btn" title="Create Return"><i class="bi bi-arrow-return-left"></i></button>`;
                                }

                                tableHtml += `<tr><td>${order.order_number}</td><td>${new Date(order.order_date).toLocaleDateString()}</td><td>${order.required_ship_date}</td><td><span class="badge ${statusClass}">${order.status}</span></td><td class="text-end">${actionsHtml}</td></tr>`;
                            });
                        }
                    }
                    tableHtml += `</tbody></table></div>`;
                    Swal.update({ html: tableHtml });
                    addOrderActionListeners();
                } catch (error) { Swal.update({ icon: 'error', title: 'Error', html: `Could not load order history: ${error.message}` }); }
            }
        });
    }

    function addOrderActionListeners() {
        const swalContainer = document.querySelector('.swal2-container');
        if (!swalContainer) return;

        swalContainer.querySelectorAll('.create-return-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const orderId = e.currentTarget.dataset.orderId;
                showReturnCreationModal(orderId);
            });
        });
    }
    
    async function showReturnCreationModal(orderId) {
        const orderDetailsResponse = await fetchData(`api/outbound_api.php?order_id=${orderId}`);
        if (!orderDetailsResponse.success) {
            return Swal.fire('Error', 'Could not fetch order details for return.', 'error');
        }

        const items = orderDetailsResponse.data.items;
        let itemsHtml = '<p>No returnable items found on this order.</p>';

        if (items && items.length > 0) {
            itemsHtml = `
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Product</th>
                            <th>Shipped Qty</th>
                            <th>Return Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.sku}</td>
                                <td>${item.product_name}</td>
                                <td>${item.picked_quantity}</td>
                                <td>
                                    <input type="number" class="form-control form-control-sm return-qty-input" 
                                           data-outbound-item-id="${item.outbound_item_id}" 
                                           max="${item.picked_quantity}" min="0" value="0">
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        Swal.fire({
            title: 'Create Partial Return',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label for="swal-return-reason" class="form-label">Reason for Return</label>
                        <textarea id="swal-return-reason" class="form-control" rows="2" placeholder="e.g., Damaged, wrong item..."></textarea>
                    </div>
                    ${itemsHtml}
                </div>
            `,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: 'Initiate Return',
            preConfirm: () => {
                const reason = document.getElementById('swal-return-reason').value;
                const itemsToReturn = [];
                document.querySelectorAll('.return-qty-input').forEach(input => {
                    const qty = parseInt(input.value, 10);
                    if (qty > 0) {
                        itemsToReturn.push({
                            outbound_item_id: input.dataset.outboundItemId,
                            quantity: qty
                        });
                    }
                });

                if (!reason.trim()) {
                    Swal.showValidationMessage('A reason for the return is required.');
                    return false;
                }
                if (itemsToReturn.length === 0) {
                    Swal.showValidationMessage('You must specify a return quantity for at least one item.');
                    return false;
                }
                
                return {
                    order_id: orderId,
                    reason: reason,
                    items: itemsToReturn
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/returns_api.php?action=create_return', 'POST', result.value);
                    if (apiResult.success) {
                        Swal.fire('Success', apiResult.message, 'success').then(() => {
                            window.location.href = 'returns.php';
                        });
                    }
                } catch (error) {
                    Swal.fire('Error', error.message, 'error');
                }
            }
        });
    }

    function addTableButtonListeners() {
        $('#customersTable tbody').off('click').on('click', '.edit-btn', handleEditClick);
        $('#customersTable tbody').on('click', '.delete-btn', handleDeleteClick);
        $('#customersTable tbody').on('click', '.view-orders-btn', function() { showCustomerOrders($(this).data('id'), $(this).data('name')); });
    }

    function handleDeleteClick(event) {
        const id = event.target.closest('button').dataset.id;
        Swal.fire({ title: 'Delete Customer?', text: "This may fail if they have existing orders. This action cannot be undone.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData(`api/customers_api.php?id=${id}`, 'DELETE');
                    if (apiResult?.success) { 
                        Swal.fire('Deleted!', 'Customer has been deleted.', 'success'); 
                        await loadCustomers(); 
                    }
                } catch (error) { 
                    Swal.fire('Error', error.message, 'error'); 
                }
            }
        });
    }
});
