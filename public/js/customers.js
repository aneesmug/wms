// public/js/customers.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const logoutBtn = document.getElementById('logoutBtn');
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    
    // --- State & Config ---
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let customersTable = null;

    // --- SweetAlert2 Mixin for Toasts ---
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

    // --- Event Listeners ---
    if (addCustomerBtn) addCustomerBtn.addEventListener('click', () => showCustomerForm(null));
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // --- Initial Page Load ---
    initializePage();

    // --- Core Functions ---
    async function initializePage() {
        const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
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
                        const canEdit = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
                        const canDelete = currentWarehouseRole === 'manager';
                        let actionsHtml = `<button data-id="${row.customer_id}" data-name="${row.customer_name}" class="btn btn-sm btn-outline-secondary view-orders-btn" title="View Order History"><i class="bi bi-list-ul"></i></button>`;
                        actionsHtml += ` <button onclick="window.location.href='customer_transactions.html?customer_id=${row.customer_id}'" class="btn btn-sm btn-outline-success ms-2" title="Transactions"><i class="bi bi-cash-coin"></i></button>`;
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
                    const response = await fetchData('api/outbound_api.php');
                    let tableHtml = `<div class="table-responsive mt-3"><table class="table table-sm table-striped table-bordered"><thead><tr><th>Order #</th><th>Order Date</th><th>Required Ship Date</th><th>Status</th><th class="text-end">Actions</th></tr></thead><tbody>`;
                    if (response?.success && Array.isArray(response.data)) {
                        const customerOrders = response.data.filter(order => order.customer_id == customerId);
                        if (customerOrders.length === 0) {
                            tableHtml += `<tr><td colspan="5" class="text-center p-3">No orders found for this customer.</td></tr>`;
                        } else {
                            customerOrders.forEach(order => {
                                const statusMap = { 'Delivered': 'bg-success', 'Out for Delivery': 'bg-primary', 'Shipped': 'bg-info', 'Picked': 'bg-primary', 'Partially Picked': 'bg-warning text-dark', 'New': 'bg-secondary', 'Pending Pick': 'bg-secondary', 'Cancelled': 'bg-danger' };
                                const statusClass = statusMap[order.status] || 'bg-secondary';
                                let actionsHtml = `<button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-outline-info track-order-btn" title="Track Movement"><i class="bi bi-truck"></i></button>`;
                                if (order.status === 'Shipped' && (currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager')) { actionsHtml += ` <button data-order-id="${order.order_id}" class="btn btn-sm btn-outline-warning mark-out-for-delivery-btn ms-2" title="Mark as Out for Delivery"><i class="bi bi-box-arrow-up"></i></button>`; }
                                if (order.status === 'Out for Delivery' && (currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager')) { actionsHtml += ` <button data-order-id="${order.order_id}" data-order-number="${order.order_number}" class="btn btn-sm btn-outline-success mark-delivered-btn ms-2" title="Confirm Delivery"><i class="bi bi-check2-circle"></i></button>`; }
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
        swalContainer.addEventListener('click', (event) => {
            const target = event.target.closest('button');
            if (!target) return;
            if (target.classList.contains('track-order-btn')) { handleTrackOrderClick(target); } 
            else if (target.classList.contains('mark-out-for-delivery-btn')) { handleMarkOutForDeliveryClick(target); } 
            else if (target.classList.contains('mark-delivered-btn')) { handleMarkDeliveredClick(target); }
        });
    }
    
    function addTableButtonListeners() {
        $('#customersTable tbody').off('click').on('click', '.edit-btn', handleEditClick);
        $('#customersTable tbody').on('click', '.delete-btn', handleDeleteClick);
        $('#customersTable tbody').on('click', '.view-orders-btn', function() { showCustomerOrders($(this).data('id'), $(this).data('name')); });
    }

    function handleMarkOutForDeliveryClick(btn) {
        const orderId = btn.dataset.orderId;
        Swal.fire({ title: 'Mark as Out for Delivery?', text: "This will update the order status.", icon: 'question', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, mark it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/outbound_api.php?action=markOutForDelivery', 'POST', { order_id: orderId });
                    if (apiResult?.success) { Toast.fire({ icon: 'success', title: apiResult.message }); Swal.close(); }
                } catch(error) { Swal.fire('Error', error.message, 'error'); }
            }
        });
    }

    function handleMarkDeliveredClick(btn) {
        const orderId = btn.dataset.orderId;
        const orderNumber = btn.dataset.orderNumber;
        Swal.fire({
            title: `Confirm Delivery for Order #${orderNumber}`,
            html: `<p class="text-muted small">Enter the <strong>6-digit confirmation code</strong> provided by the customer.</p><div class="swal2-form"><input type="text" id="swal-delivery-code" class="swal2-input" placeholder="Confirmation Code" maxlength="6"><input type="text" id="swal-receiver-name" class="swal2-input" placeholder="Receiver's Name"><input type="tel" id="swal-receiver-phone" class="swal2-input" placeholder="Receiver's Phone (Optional)"></div>`,
            focusConfirm: false, showCancelButton: true, confirmButtonText: 'Confirm Delivery',
            preConfirm: () => {
                const code = document.getElementById('swal-delivery-code').value;
                const name = document.getElementById('swal-receiver-name').value;
                if (!code || !name) { Swal.showValidationMessage(`Confirmation Code and Receiver's Name are required`); return false; }
                return { delivery_code: code, receiver_name: name, receiver_phone: document.getElementById('swal-receiver-phone').value };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const data = { order_id: orderId, ...result.value };
                    const apiResult = await fetchData('api/outbound_api.php?action=markDelivered', 'POST', data);
                    if (apiResult?.success) { Swal.fire('Success!', apiResult.message, 'success'); }
                } catch (error) { Swal.fire('Error!', error.message, 'error'); }
            }
        });
    }

    function handleTrackOrderClick(btn) {
        const orderId = btn.dataset.orderId;
        const orderNumber = btn.dataset.orderNumber;
        Swal.fire({
            title: `History for Order #${orderNumber}`,
            html: '<div class="d-flex justify-content-center"><div class="spinner-border" role="status"></div></div>',
            width: '800px', showConfirmButton: false,
            didOpen: async () => {
                try {
                    const response = await fetchData(`api/outbound_api.php?action=getOrderHistory&order_id=${orderId}`);
                    let historyHtml = '<ul class="list-group list-group-flush text-start mt-3">';
                    if (response?.success && Array.isArray(response.data) && response.data.length > 0) {
                        response.data.forEach(item => {
                            const date = new Date(item.created_at).toLocaleString();
                            historyHtml += `<li class="list-group-item d-flex justify-content-between align-items-start"><div class="ms-2 me-auto"><div class="fw-bold">${item.status}</div><small class="text-muted">${item.notes || 'Status updated'} by ${item.user_name || 'System'}</small></div><span class="badge bg-primary rounded-pill">${date}</span></li>`;
                        });
                    } else { historyHtml += '<li class="list-group-item">No history found for this order.</li>'; }
                    historyHtml += '</ul>';
                    Swal.update({ html: historyHtml });
                } catch (error) { Swal.update({ icon: 'error', title: 'Error', html: `Could not load order history: ${error.message}` }); }
            }
        });
    }

    function handleDeleteClick(event) {
        const id = event.target.closest('button').dataset.id;
        Swal.fire({ title: 'Delete Customer?', text: "This may fail if they have existing orders. This action cannot be undone.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData(`api/customers_api.php?id=${id}`, 'DELETE');
                    if (apiResult?.success) { Swal.fire('Deleted!', 'Customer has been deleted.', 'success'); await loadCustomers(); }
                } catch (error) { Swal.fire('Error', error.message, 'error'); }
            }
        });
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
