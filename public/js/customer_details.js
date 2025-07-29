// public/js/customer_details.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const customerNameHeader = document.getElementById('customerNameHeader');
    const customerInfoCard = document.getElementById('customerInfoCard');
    const transactionForm = document.getElementById('transactionForm');
    const transactionsTableBody = document.getElementById('transactionsTableBody');
    const transactionOrderSelect = document.getElementById('transactionOrder');
    const addTransactionSection = document.getElementById('addTransactionSection');
    const editCustomerBtn = document.getElementById('editCustomerBtn');

    // --- State & Config ---
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('id');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let ordersTable = null;
    let currentCustomerDetails = null;

    // --- Event Listeners ---
    if (transactionForm) transactionForm.addEventListener('submit', handleSaveTransaction);
    if (editCustomerBtn) editCustomerBtn.addEventListener('click', () => {
        if (currentCustomerDetails) {
            showCustomerForm(currentCustomerDetails);
        } else {
            Swal.fire('Please Wait', 'Customer data is still loading.', 'info');
        }
    });

    initializePage();

    // --- Functions ---
    async function initializePage() {
        if (!customerId) {
            customerNameHeader.textContent = 'Error: No Customer ID Provided';
            customerInfoCard.innerHTML = '<div class="alert alert-danger">A customer ID is required to view this page.</div>';
            return;
        }

        const canManage = ['operator', 'manager'].includes(currentWarehouseRole);
        if (addTransactionSection) addTransactionSection.style.display = canManage ? 'block' : 'none';
        if (editCustomerBtn) editCustomerBtn.style.display = canManage ? 'block' : 'none';

        initializeOrdersDataTable();
        await loadCustomerDetails();
        await loadTransactions();
    }

    function initializeOrdersDataTable() {
        ordersTable = $('#ordersTable').DataTable({
            responsive: true,
            searching: true,
            lengthChange: false,
            pageLength: 10,
            order: [[3, 'desc']],
            columns: [
                { data: 'number' },
                { data: 'type' },
                { data: 'status' },
                { data: 'date' }
            ],
            language: {
                search: "_INPUT_",
                searchPlaceholder: "Search records..."
            },
            createdRow: function (row, data, dataIndex) {
                const buttonHtml = `<button class="btn btn-link p-0 view-history-btn" data-id="${data.id}" data-type="${data.type}">${data.number}</button>`;
                $(row).find('td:eq(0)').html(buttonHtml);
            }
        });

        $('#ordersTable tbody').on('click', '.view-history-btn', function() {
            const id = $(this).data('id');
            const type = $(this).data('type');
            showDetailsModal(id, type);
        });
    }

    async function loadCustomerDetails() {
        try {
            const response = await fetchData(`api/customers_api.php?action=get_details&id=${customerId}`);
            if (response.success) {
                currentCustomerDetails = response.data.details;
                const { details, orders, returns } = response.data;
                renderCustomerInfo(details);
                populateOrdersTable(orders, returns);
                populateOrdersDropdown(orders);
            } else {
                customerNameHeader.textContent = 'Customer Not Found';
                customerInfoCard.innerHTML = `<div class="alert alert-danger">${response.message}</div>`;
            }
        } catch (error) {
            Swal.fire('Error', `Could not load customer details: ${error.message}`, 'error');
        }
    }

    function renderCustomerInfo(customer) {
        customerNameHeader.textContent = `${customer.customer_name} (${customer.customer_code || 'N/A'})`;
        let addressHtml = [customer.address_line1, customer.address_line2, customer.city, customer.state, customer.zip_code, customer.country].filter(Boolean).join('<br>');
        customerInfoCard.innerHTML = `
            <p><strong>Customer Code:</strong> ${customer.customer_code || 'N/A'}</p>
            <p><strong>Contact Person:</strong> ${customer.contact_person || 'N/A'}</p><hr>
            <p><i class="bi bi-telephone-fill me-2"></i> ${customer.phone || 'N/A'}</p>
            <p><i class="bi bi-phone-fill me-2"></i> ${customer.phone2 || 'N/A'}</p>
            <p><i class="bi bi-envelope-fill me-2"></i> ${customer.email || 'N/A'}</p><hr>
            <p><i class="bi bi-geo-alt-fill me-2"></i><strong>Address:</strong></p>
            <address>${addressHtml || 'No address on file.'}</address>`;
    }

    function populateOrdersTable(orders, returns) {
        const tableData = [];
        orders.forEach(o => tableData.push({ id: o.order_id, number: o.order_number, type: 'Order', status: `<span class="badge bg-primary">${o.status}</span>`, date: new Date(o.order_date).toLocaleDateString() }));
        returns.forEach(r => tableData.push({ id: r.return_id, number: r.return_number, type: 'Return', status: `<span class="badge bg-warning text-dark">${r.status}</span>`, date: new Date(r.created_at).toLocaleDateString() }));
        ordersTable.clear().rows.add(tableData).draw();
    }

    function populateOrdersDropdown(orders) {
        if (!transactionOrderSelect) return;
        transactionOrderSelect.innerHTML = '<option value="">None</option>';
        orders.forEach(order => transactionOrderSelect.add(new Option(`Order #${order.order_number} (${order.status})`, order.order_id)));
    }

    async function loadTransactions() {
        if (!transactionsTableBody) return;
        transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">Loading...</td></tr>`;
        const response = await fetchData(`api/customer_transactions_api.php?customer_id=${customerId}`);
        transactionsTableBody.innerHTML = '';
        if (response?.success && Array.isArray(response.data)) {
            if (response.data.length === 0) {
                transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">No transactions found.</td></tr>`;
                return;
            }
            response.data.forEach(tx => {
                const row = transactionsTableBody.insertRow();
                const isCredit = ['payment', 'credit'].includes(tx.transaction_type);
                const amountFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR' }).format(tx.amount);
                row.innerHTML = `<td>${new Date(tx.transaction_date).toLocaleDateString()}</td><td><span class="badge ${isCredit ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}">${tx.transaction_type}</span></td><td class="fw-bold ${isCredit ? 'text-success' : 'text-danger'}">${isCredit ? '+' : '-'} ${amountFormatted}</td><td>${tx.order_number || 'N/A'}</td><td>${tx.notes || ''}</td><td>${tx.created_by_user || 'System'}</td>`;
            });
        } else {
            transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">Error loading transactions.</td></tr>`;
        }
    }

    async function handleSaveTransaction(event) {
        event.preventDefault();
        const saveBtn = document.getElementById('saveTransactionBtn');
        const data = {
            customer_id: customerId,
            transaction_type: document.getElementById('transactionType').value,
            amount: parseFloat(document.getElementById('transactionAmount').value),
            order_id: document.getElementById('transactionOrder').value || null,
            notes: document.getElementById('transactionNotes').value.trim()
        };
        if (!data.transaction_type || isNaN(data.amount) || data.amount <= 0) {
            Swal.fire('Invalid Input', 'Please provide a valid transaction type and a positive amount.', 'error');
            return;
        }
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        try {
            const result = await fetchData('api/customer_transactions_api.php', 'POST', data);
            if (result?.success) {
                Swal.fire('Success', 'Transaction saved successfully!', 'success');
                transactionForm.reset();
                await loadTransactions();
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Transaction';
        }
    }

    async function showCustomerForm(customer) {
        Swal.fire({
            title: `Edit Customer: ${customer.customer_name}`,
            html: `
                <form id="swalCustomerForm" class="text-start mt-3">
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swal-customerName" class="form-label">Customer Name*</label><input type="text" id="swal-customerName" class="form-control" value="${customer.customer_name || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-customerCode" class="form-label">Customer Code*</label><input type="text" id="swal-customerCode" class="form-control" value="${customer.customer_code || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-contactPerson" class="form-label">Contact Person*</label><input type="text" id="swal-contactPerson" class="form-control" value="${customer.contact_person || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-email" class="form-label">Email</label><input type="email" id="swal-email" class="form-control" value="${customer.email || ''}"></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone" class="form-label">Phone*</label><input type="tel" id="swal-phone" class="form-control" value="${customer.phone || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone2" class="form-label">Alt. Phone</label><input type="tel" id="swal-phone2" class="form-control" value="${customer.phone2 || ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine1" class="form-label">Address Line 1*</label><input type="text" id="swal-addressLine1" class="form-control" value="${customer.address_line1 || ''}" required></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine2" class="form-label">Address Line 2</label><input type="text" id="swal-addressLine2" class="form-control" value="${customer.address_line2 || ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-city" class="form-label">City*</label><input type="text" id="swal-city" class="form-control" value="${customer.city || ''}" required></div>
                        <div class="col-md-4 mb-3"><label for="swal-state" class="form-label">State</label><input type="text" id="swal-state" class="form-control" value="${customer.state || ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-zipCode" class="form-label">Zip Code</label><input type="text" id="swal-zipCode" class="form-control" value="${customer.zip_code || ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-country" class="form-label">Country*</label><input type="text" id="swal-country" class="form-control" value="${customer.country || ''}" required></div>
                    </div>
                </form>`,
            width: '800px', showCancelButton: true, confirmButtonText: 'Save Changes', focusConfirm: false,
            preConfirm: () => {
                const requiredFields = {'swal-customerName': 'Customer Name','swal-customerCode': 'Customer Code','swal-contactPerson': 'Contact Person','swal-phone': 'Phone','swal-addressLine1': 'Address Line 1','swal-city': 'City','swal-country': 'Country'};
                const missingFields = [];
                for (const [id, name] of Object.entries(requiredFields)) {
                    if (!document.getElementById(id).value.trim()) missingFields.push(name);
                }
                if (missingFields.length > 0) {
                    Swal.showValidationMessage(`Required fields: ${missingFields.join(', ')}`);
                    return false;
                }
                return {
                    customer_id: customer.customer_id,
                    customer_name: document.getElementById('swal-customerName').value,
                    customer_code: document.getElementById('swal-customerCode').value,
                    contact_person: document.getElementById('swal-contactPerson').value,
                    email: document.getElementById('swal-email').value,
                    phone: document.getElementById('swal-phone').value,
                    phone2: document.getElementById('swal-phone2').value,
                    address_line1: document.getElementById('swal-addressLine1').value,
                    address_line2: document.getElementById('swal-addressLine2').value,
                    city: document.getElementById('swal-city').value,
                    state: document.getElementById('swal-state').value,
                    zip_code: document.getElementById('swal-zipCode').value,
                    country: document.getElementById('swal-country').value,
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/customers_api.php', 'PUT', result.value);
                    if (apiResult?.success) {
                        Swal.fire('Success!', apiResult.message, 'success');
                        await loadCustomerDetails();
                    }
                } catch (error) { Swal.fire('Error!', error.message, 'error'); }
            }
        });
    }

    async function showDetailsModal(id, type) {
        Swal.fire({
            title: `Loading ${type} Details...`,
            html: '<div class="spinner-border" role="status"></div>',
            showConfirmButton: false,
            allowOutsideClick: false,
            width: '900px' // MODIFICATION: Increased width
        });

        try {
            let modalContentId = `details-content-${id}`;
            let detailsHtml = '';

            if (type === 'Order') {
                const response = await fetchData(`api/outbound_api.php?order_id=${id}`);
                if (response.success) {
                    const order = response.data;
                    let itemsHtml = order.items.map(item => `
                        <tr>
                            <td>${item.sku}</td>
                            <td>${item.product_name}</td>
                            <td>${item.barcode || 'N/A'}</td>
                            <td class="text-center">${item.ordered_quantity}</td>
                            <td class="text-center">${item.picked_quantity}</td>
                        </tr>`).join('');
                    
                    detailsHtml = `
                        <div id="${modalContentId}">
                            <div class="text-start">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Order #:</strong> ${order.order_number}</p>
                                        <p><strong>Status:</strong> ${order.status}</p>
                                        <p><strong>Required Ship Date:</strong> ${order.required_ship_date}</p>
                                        <p><strong>Actual Ship Date:</strong> ${order.actual_ship_date || 'N/A'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>Tracking #:</strong> ${order.tracking_number || 'N/A'}</p>
                                        <p><strong>Picker:</strong> ${order.picker_name || 'N/A'}</p>
                                        <p><strong>Shipper:</strong> ${order.shipper_name || 'N/A'}</p>
                                        <p><strong>Driver:</strong> ${order.driver_name || 'N/A'}</p>
                                    </div>
                                </div>
                                <hr>
                                <h6>Delivery Information</h6>
                                <p><strong>Delivered To:</strong> ${order.delivered_to_name || 'N/A'}</p>
                                <p><strong>Delivery Date:</strong> ${order.actual_delivery_date ? new Date(order.actual_delivery_date).toLocaleString() : 'N/A'}</p>
                                <p><strong>Delivery Note:</strong> ${order.delivery_note || 'N/A'}</p>
                                ${order.delivery_photo_path ? `<p><strong>Proof of Delivery:</strong> <a href="${order.delivery_photo_path}" target="_blank">View Photo</a></p>` : ''}
                                <h6 class="mt-4">Items</h6>
                                <table class="table table-sm table-bordered">
                                    <thead><tr><th>SKU</th><th>Product</th><th>Barcode</th><th>Ordered</th><th>Picked</th></tr></thead>
                                    <tbody>${itemsHtml}</tbody>
                                </table>
                            </div>
                        </div>`;
                    Swal.update({
                        title: `Order Details`,
                        html: detailsHtml,
                        showConfirmButton: true,
                        showDenyButton: true,
                        confirmButtonText: 'Close',
                        denyButtonText: `<i class="bi bi-printer"></i> Print`,
                    });
                    
                    $('.swal2-deny').off('click').on('click', function() {
                        printModalContent(modalContentId, `Order Details - ${order.order_number}`);
                    });
                }
            } else if (type === 'Return') {
                const response = await fetchData(`api/returns_api.php?return_id=${id}`);
                if (response.success) {
                    const ret = response.data;
                     let itemsHtml = ret.items.map(item => `
                        <tr>
                            <td>${item.sku}</td>
                            <td>${item.product_name}</td>
                            <td>${item.barcode || 'N/A'}</td>
                            <td class="text-center">${item.expected_quantity}</td>
                            <td class="text-center">${item.processed_quantity}</td>
                            <td>${item.condition || 'N/A'}</td>
                        </tr>`).join('');

                    detailsHtml = `
                        <div id="${modalContentId}">
                            <div class="text-start">
                                <p><strong>RMA #:</strong> ${ret.return_number}</p>
                                <p><strong>Original Order:</strong> ${ret.order_number || 'N/A'}</p>
                                <p><strong>Status:</strong> ${ret.status}</p>
                                <p><strong>Reason:</strong> ${ret.reason || 'N/A'}</p>
                                <h6 class="mt-4">Items</h6>
                                <table class="table table-sm table-bordered">
                                    <thead><tr><th>SKU</th><th>Product</th><th>Barcode</th><th>Expected</th><th>Processed</th><th>Condition</th></tr></thead>
                                    <tbody>${itemsHtml}</tbody>
                                </table>
                            </div>
                        </div>`;
                     Swal.update({
                        title: `Return Details`,
                        html: detailsHtml,
                        showConfirmButton: true,
                        showDenyButton: true,
                        confirmButtonText: 'Close',
                        denyButtonText: `<i class="bi bi-printer"></i> Print`,
                    });

                     $('.swal2-deny').off('click').on('click', function() {
                        printModalContent(modalContentId, `Return Details - ${ret.return_number}`);
                    });
                }
            }
        } catch (error) {
            Swal.fire('Error', `Could not load details: ${error.message}`, 'error');
        }
    }

    function printModalContent(elementId, title) {
        const content = document.getElementById(elementId).innerHTML;
        const printFrame = document.createElement('iframe');
        printFrame.style.display = 'none';
        document.body.appendChild(printFrame);
        
        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        body { padding: 20px; font-family: Arial, sans-serif; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <h2>${title}</h2>
                    ${content}
                </body>
            </html>
        `);
        frameDoc.close();

        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            document.body.removeChild(printFrame);
        }, 250);
    }
});
