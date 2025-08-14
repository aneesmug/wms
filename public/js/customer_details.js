// public/js/customer_details.js

// MODIFICATION SUMMARY:
// 1. Added a "Create Return" button (`createReturnBtn`) and its event listener.
// 2. Removed the per-order return button logic from the data table.
// 3. Implemented `showCreateReturnSweetAlert` to handle the entire return process in a single SweetAlert2 modal.
// 4. The new modal fetches all returnable items for the customer.
// 5. Added a search input within the modal to filter items by Product Name or Article Number in real-time.
// 6. The modal allows entering quantities for multiple items at once.
// 7. The `preConfirm` function gathers all items with a quantity greater than zero and sends them in a single API call to create the RMA.
// 8. The return modal now displays the original Order # and the quantity already returned for each item.
// 9. The search functionality in the modal now also includes searching by Order #.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const customerNameHeader = document.getElementById('customerNameHeader');
    const customerInfoCard = document.getElementById('customerInfoCard');
    const transactionForm = document.getElementById('transactionForm');
    const transactionsTableBody = document.getElementById('transactionsTableBody');
    const transactionOrderSelect = document.getElementById('transactionOrder');
    const addTransactionSection = document.getElementById('addTransactionSection');
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    const createReturnBtn = document.getElementById('createReturnBtn'); // MODIFICATION

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
    // MODIFICATION: Added event listener for the new return button
    if (createReturnBtn) createReturnBtn.addEventListener('click', showCreateReturnSweetAlert);


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
        if (createReturnBtn) createReturnBtn.style.display = canManage ? 'block' : 'none'; // MODIFICATION

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
                { data: 'date' },
                { data: 'actions', orderable: false, className: 'text-end' }
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
        orders.forEach(o => {
            // MODIFICATION: Removed the per-row return button.
            tableData.push({ 
                id: o.order_id, 
                number: o.order_number, 
                type: 'Order', 
                status: `<span class="badge bg-primary">${o.status}</span>`, 
                date: new Date(o.order_date).toLocaleDateString(),
                actions: '' // No actions here anymore
            });
        });
        returns.forEach(r => tableData.push({ 
            id: r.return_id, 
            number: r.return_number, 
            type: 'Return', 
            status: `<span class="badge bg-warning text-dark">${r.status}</span>`, 
            date: new Date(r.created_at).toLocaleDateString(),
            actions: ''
        }));
        ordersTable.clear().rows.add(tableData).draw();
    }

    function populateOrdersDropdown(orders) {
        if (!transactionOrderSelect) return;
        transactionOrderSelect.innerHTML = '<option value="">None</option>';
        orders.forEach(order => transactionOrderSelect.add(new Option(`Order #${order.order_number} (${order.status})`, order.order_id)));
    }
    
    // MODIFICATION: New function to handle creating a return via SweetAlert2
    async function showCreateReturnSweetAlert() {
        const response = await fetchData(`api/customers_api.php?action=get_order_history&id=${customerId}`);
        if (!response.success || !Array.isArray(response.data)) {
            return Swal.fire('Error', 'Could not load customer order history.', 'error');
        }

        const returnableItems = response.data.filter(item => (parseInt(item.picked_quantity, 10) - parseInt(item.returned_quantity, 10)) > 0);

        if (returnableItems.length === 0) {
            return Swal.fire('No Returnable Items', 'This customer has no items eligible for return.', 'info');
        }

        // MODIFICATION: Added Order # and Returned columns
        let itemsHtml = returnableItems.map(item => {
            const pickedQty = parseInt(item.picked_quantity, 10);
            const returnedQty = parseInt(item.returned_quantity, 10);
            const returnableQty = pickedQty - returnedQty;
            return `
                <tr class="return-item-row" data-order-id="${item.order_id}" data-outbound-item-id="${item.outbound_item_id}">
                    <td data-search-term="${item.order_number.toLowerCase()}">${item.order_number}</td>
                    <td data-search-term="${item.product_name.toLowerCase()}">${item.product_name}</td>
                    <td data-search-term="${(item.article_no || '').toLowerCase()}">${item.article_no || 'N/A'}</td>
                    <td>${item.dot_code || 'N/A'}</td>
                    <td class="text-center">${returnedQty}</td>
                    <td class="text-center">${returnableQty}</td>
                    <td>
                        <input type="number" class="form-control form-control-sm return-qty-input" 
                               max="${returnableQty}" min="0" value="0" style="width: 70px;">
                    </td>
                </tr>
            `;
        }).join('');

        Swal.fire({
            title: 'Create New Return',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label for="swal-return-reason" class="form-label">Reason for Return*</label>
                        <textarea id="swal-return-reason" class="form-control" rows="2" placeholder="e.g., Damaged, wrong item..."></textarea>
                    </div>
                    <div class="mb-3">
                        <label for="swal-item-search" class="form-label">Search by Order #, Product Name, or Article No.</label>
                        <input type="text" id="swal-item-search" class="form-control" placeholder="Start typing to filter items...">
                    </div>
                    <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                        <table class="table table-bordered table-sm">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>Order #</th>
                                    <th>Product</th>
                                    <th>Article No.</th>
                                    <th>DOT</th>
                                    <th>Returned</th>
                                    <th>Returnable</th>
                                    <th>Return Qty</th>
                                </tr>
                            </thead>
                            <tbody id="return-items-table-body">${itemsHtml}</tbody>
                        </table>
                    </div>
                </div>
            `,
            width: '80%',
            showCancelButton: true,
            confirmButtonText: 'Initiate Return',
            allowOutsideClick: false,
            didOpen: () => {
                const searchInput = document.getElementById('swal-item-search');
                const tableBody = document.getElementById('return-items-table-body');
                const rows = tableBody.getElementsByClassName('return-item-row');

                // MODIFICATION: Updated search logic
                searchInput.addEventListener('keyup', () => {
                    const searchTerm = searchInput.value.toLowerCase();
                    for (const row of rows) {
                        const orderNo = row.cells[0].dataset.searchTerm;
                        const productName = row.cells[1].dataset.searchTerm;
                        const articleNo = row.cells[2].dataset.searchTerm;
                        if (orderNo.includes(searchTerm) || productName.includes(searchTerm) || articleNo.includes(searchTerm)) {
                            row.style.display = '';
                        } else {
                            row.style.display = 'none';
                        }
                    }
                });
            },
            preConfirm: () => {
                const reason = document.getElementById('swal-return-reason').value;
                if (!reason.trim()) {
                    Swal.showValidationMessage('A reason for the return is required.');
                    return false;
                }

                const itemsByOrder = {};
                document.querySelectorAll('.return-item-row').forEach(row => {
                    const qty = parseInt(row.querySelector('.return-qty-input').value, 10);
                    if (qty > 0) {
                        const orderId = row.dataset.orderId;
                        if (!itemsByOrder[orderId]) {
                            itemsByOrder[orderId] = [];
                        }
                        itemsByOrder[orderId].push({
                            outbound_item_id: row.dataset.outboundItemId,
                            quantity: qty
                        });
                    }
                });

                if (Object.keys(itemsByOrder).length === 0) {
                    Swal.showValidationMessage('You must specify a return quantity for at least one item.');
                    return false;
                }
                
                return { itemsByOrder, reason };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { itemsByOrder, reason } = result.value;
                
                // One API call per order in the return
                const promises = Object.keys(itemsByOrder).map(orderId => {
                    const payload = {
                        order_id: orderId,
                        reason: reason,
                        items: itemsByOrder[orderId]
                    };
                    return fetchData('api/returns_api.php?action=create_return', 'POST', payload);
                });

                try {
                    const results = await Promise.all(promises);
                    const successMessages = results.filter(r => r.success).map(r => r.message).join('<br>');
                    const errorMessages = results.filter(r => !r.success).map(r => r.message).join('<br>');

                    if (errorMessages) {
                         Swal.fire('Partial Failure', `Some returns could not be created:<br>${errorMessages}`, 'warning');
                    } else {
                        Swal.fire('Success!', `The following returns were created:<br>${successMessages}`, 'success').then(() => {
                           window.location.reload();
                        });
                    }
                } catch (error) {
                    Swal.fire('Error', error.message, 'error');
                }
            }
        });
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
                        <div class="col-md-6 mb-3"><label for="swal-customerCode" class="form-label">Customer Code*</label><input type="text" id="swal-customerCode" class="form-control numeric-only" value="${customer.customer_code || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-contactPerson" class="form-label">Contact Person*</label><input type="text" id="swal-contactPerson" class="form-control" value="${customer.contact_person || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-email" class="form-label">Email</label><input type="email" id="swal-email" class="form-control email-validation" value="${customer.email || ''}"></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone" class="form-label">Phone*</label><input type="tel" id="swal-phone" class="form-control saudi-mobile-number" value="${customer.phone || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone2" class="form-label">Alt. Phone</label><input type="tel" id="swal-phone2" class="form-control numeric-only" value="${customer.phone2 || ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine1" class="form-label">Address Line 1*</label><input type="text" id="swal-addressLine1" class="form-control" value="${customer.address_line1 || ''}" required></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine2" class="form-label">Address Line 2</label><input type="text" id="swal-addressLine2" class="form-control" value="${customer.address_line2 || ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-city" class="form-label">City*</label><input type="text" id="swal-city" class="form-control" value="${customer.city || ''}" required></div>
                        <div class="col-md-4 mb-3"><label for="swal-state" class="form-label">State</label><input type="text" id="swal-state" class="form-control" value="${customer.state || ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-zipCode" class="form-label">Zip Code</label><input type="text" id="swal-zipCode" class="form-control numeric-only" value="${customer.zip_code || ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-country" class="form-label">Country*</label><input type="text" id="swal-country" class="form-control" value="${customer.country || ''}" required></div>
                    </div>
                </form>`,
            width: '70%', showCancelButton: true, confirmButtonText: 'Save Changes', focusConfirm: false, allowOutsideClick: false,
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
            width: '70%'
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
                            <td>${item.article_no || 'N/A'}</td>
                            <td class="text-center">${item.ordered_quantity}</td>
                            <td class="text-center">${item.picked_quantity}</td>
                            <td class="text-center">${item.returned_quantity || 0}</td>
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
                                    <thead><tr><th>SKU</th><th>Product</th><th>Article No</th><th>Ordered</th><th>Picked</th><th>Returned</th></tr></thead>
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
                            <td>${item.article_no || 'N/A'}</td>
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
                                    <thead><tr><th>SKU</th><th>Product</th><th>Article No</th><th>Expected</th><th>Processed</th><th>Condition</th></tr></thead>
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
