/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings with the `__()` translation function for full localization.
* 2. Implemented full CRUD functionality for customer addresses.
* 3. `renderCustomerInfo`: No longer displays a static address.
* 4. New function `renderAddressList`: Fetches and displays all customer addresses in a new dedicated card.
* 5. New function `showAddressForm`: Displays a SweetAlert2 modal for adding or editing an address.
* 6. New function `handleDeleteAddress`: Handles the deletion of an address with a confirmation prompt.
* 7. Event listeners added for "Add New Address", "Edit Address", and "Delete Address" buttons.
* 8. `showCustomerForm` (for editing customer details) no longer includes address fields.
* 9. `populateOrdersTable`: Added status maps to assign distinct colors for each order and return status badge, and now translates the status text.
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const customerNameHeader = document.getElementById('customerNameHeader');
    const customerInfoCard = document.getElementById('customerInfoCard');
    const addressListContainer = document.getElementById('addressListContainer');
    const transactionForm = document.getElementById('transactionForm');
    const transactionsTableBody = document.getElementById('transactionsTableBody');
    const transactionOrderSelect = document.getElementById('transactionOrder');
    const editCustomerBtn = document.getElementById('editCustomerBtn');
    const createReturnBtn = document.getElementById('createReturnBtn');
    const addNewAddressBtn = document.getElementById('addNewAddressBtn');

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
            Swal.fire(__('please_wait'), __('customer_data_loading'), 'info');
        }
    });
    if (createReturnBtn) createReturnBtn.addEventListener('click', showCreateReturnSweetAlert);
    if (addNewAddressBtn) addNewAddressBtn.addEventListener('click', () => showAddressForm(null));


    initializePage();

    // --- Functions ---
    async function initializePage() {
        if (!customerId) {
            customerNameHeader.textContent = __('error_no_customer_id');
            customerInfoCard.innerHTML = `<div class="alert alert-danger">${__('customer_id_required')}</div>`;
            return;
        }

        const canManage = ['operator', 'manager'].includes(currentWarehouseRole);
        if (editCustomerBtn) editCustomerBtn.style.display = canManage ? 'block' : 'none';
        if (createReturnBtn) createReturnBtn.style.display = canManage ? 'block' : 'none';
        if (addNewAddressBtn) addNewAddressBtn.style.display = canManage ? 'block' : 'none';

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
                search: `<span>${__('search')}:</span> _INPUT_`,
                searchPlaceholder: `${__('search_records')}...`,
                lengthMenu: `${__('show')} _MENU_ ${__('entries')}`,
                info: `${__('showing')} _START_ ${__('to')} _END_ ${__('of')} _TOTAL_ ${__('entries')}`,
                infoEmpty: `${__('showing')} 0 ${__('to')} 0 ${__('of')} 0 ${__('entries')}`,
                infoFiltered: `(${__('filtered_from')} _MAX_ ${__('total_entries')})`,
                paginate: {
                    first: __('first'),
                    last: __('last'),
                    next: __('next'),
                    previous: __('previous')
                },
                emptyTable: __('no_data_available_in_table'),
                zeroRecords: __('no_matching_records_found')
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
                const { details, orders, returns, addresses } = response.data;
                renderCustomerInfo(details);
                renderAddressList(addresses);
                populateOrdersTable(orders, returns);
                populateOrdersDropdown(orders);
            } else {
                customerNameHeader.textContent = __('customer_not_found');
                customerInfoCard.innerHTML = `<div class="alert alert-danger">${response.message}</div>`;
            }
        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_load_customer_details')}: ${error.message}`, 'error');
        }
    }

    function renderCustomerInfo(customer) {
        customerNameHeader.textContent = `${customer.customer_name} (${customer.customer_code || __('n_a')})`;
        customerInfoCard.innerHTML = `
            <p><strong>${__('customer_code')}:</strong> ${customer.customer_code || __('n_a')}</p>
            <p><strong>${__('contact_person')}:</strong> ${customer.contact_person || __('n_a')}</p><hr>
            <p><i class="bi bi-telephone-fill me-2"></i> ${customer.phone || __('n_a')}</p>
            <p><i class="bi bi-phone-fill me-2"></i> ${customer.phone2 || __('n_a')}</p>
            <p><i class="bi bi-envelope-fill me-2"></i> ${customer.email || __('n_a')}</p>`;
    }

    function renderAddressList(addresses) {
        addressListContainer.innerHTML = '';
        if (!addresses || addresses.length === 0) {
            addressListContainer.innerHTML = `<p class="text-muted text-center p-3">${__('no_addresses_found')}</p>`;
            return;
        }

        addresses.forEach(address => {
            const addressHtml = [address.address_line1, address.address_line2, address.city, address.state, address.zip_code, address.country].filter(Boolean).join(', ');
            const isDefaultBadge = address.is_default == 1 ? `<span class="badge bg-success ms-2">${__('default_address')}</span>` : '';
            
            const addressElement = document.createElement('div');
            addressElement.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            addressElement.innerHTML = `
                <div>
                    <p class="mb-1">${addressHtml}${isDefaultBadge}</p>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-primary edit-address-btn" title="${__('edit_address')}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-address-btn ms-2" title="${__('delete')}"><i class="bi bi-trash"></i></button>
                </div>
            `;
            
            addressElement.querySelector('.edit-address-btn').addEventListener('click', () => showAddressForm(address));
            addressElement.querySelector('.delete-address-btn').addEventListener('click', () => handleDeleteAddress(address.address_id));

            addressListContainer.appendChild(addressElement);
        });
    }

    async function showAddressForm(address) {
        const isEditing = address !== null;
        Swal.fire({
            title: isEditing ? __('edit_address') : __('add_new_address'),
            html: `
                <form id="swalAddressForm" class="text-start mt-3">
                    <div class="row">
                        <div class="col-12 mb-3"><label for="swal-addressLine1" class="form-label">${__('address_line_1')}*</label><input type="text" id="swal-addressLine1" class="form-control" value="${isEditing ? address.address_line1 || '' : ''}" required></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine2" class="form-label">${__('address_line_2')}</label><input type="text" id="swal-addressLine2" class="form-control" value="${isEditing ? address.address_line2 || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-city" class="form-label">${__('city')}*</label><input type="text" id="swal-city" class="form-control" value="${isEditing ? address.city || '' : ''}" required></div>
                        <div class="col-md-4 mb-3"><label for="swal-state" class="form-label">${__('state')}</label><input type="text" id="swal-state" class="form-control" value="${isEditing ? address.state || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-zipCode" class="form-label">${__('zip_code')}</label><input type="text" id="swal-zipCode" class="form-control numeric-only" value="${isEditing ? address.zip_code || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-country" class="form-label">${__('country')}*</label><input type="text" id="swal-country" class="form-control" value="${isEditing ? address.country || '' : ''}" required></div>
                        <div class="col-12">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="swal-isDefault" ${isEditing && address.is_default == 1 ? 'checked' : ''}>
                                <label class="form-check-label" for="swal-isDefault">${__('set_as_default')}</label>
                            </div>
                        </div>
                    </div>
                </form>
            `,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: isEditing ? __('save_changes') : __('add_address'),
            cancelButtonText: __('cancel'),
            focusConfirm: false,
            allowOutsideClick: false,
            preConfirm: () => {
                const requiredFields = {
                    'swal-addressLine1': __('address_line_1_required'),
                    'swal-city': __('city_required'),
                    'swal-country': __('country_required')
                };
                for (const [id, message] of Object.entries(requiredFields)) {
                    if (!document.getElementById(id).value.trim()) {
                        Swal.showValidationMessage(message);
                        return false;
                    }
                }
                return {
                    customer_id: customerId,
                    address_id: isEditing ? address.address_id : null,
                    address_line1: document.getElementById('swal-addressLine1').value,
                    address_line2: document.getElementById('swal-addressLine2').value,
                    city: document.getElementById('swal-city').value,
                    state: document.getElementById('swal-state').value,
                    zip_code: document.getElementById('swal-zipCode').value,
                    country: document.getElementById('swal-country').value,
                    is_default: document.getElementById('swal-isDefault').checked
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const data = result.value;
                const action = isEditing ? 'update_address' : 'add_address';
                try {
                    const apiResult = await fetchData(`api/customers_api.php?action=${action}`, 'POST', data);
                    if (apiResult?.success) {
                        Swal.fire(__('success'), apiResult.message, 'success');
                        await loadCustomerDetails(); // Reload all details to get updated address list
                    }
                } catch (error) {
                    Swal.fire(__('error'), error.message, 'error');
                }
            }
        });
    }

    async function handleDeleteAddress(addressId) {
        Swal.fire({
            title: __('confirm_deletion'),
            text: __('confirm_delete_address_q'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: __('yes_delete_it'),
            cancelButtonText: __('cancel')
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/customers_api.php?action=delete_address', 'POST', { address_id: addressId });
                    if (apiResult?.success) {
                        Swal.fire(__('deleted'), __('address_deleted_successfully'), 'success');
                        await loadCustomerDetails();
                    }
                } catch (error) {
                    Swal.fire(__('error'), error.message, 'error');
                }
            }
        });
    }

    function populateOrdersTable(orders, returns) {
        const orderStatusMap = {
            'delivered': 'bg-success',
            'out for delivery': 'bg-info text-dark',
            'shipped': 'bg-primary',
            'assigned': 'bg-orange', // Custom color
            'ready for pickup': 'bg-purple', // Custom color
            'picked': 'bg-info text-dark',
            'partially picked': 'bg-warning text-dark',
            'new': 'bg-secondary',
            'pending pick': 'bg-secondary',
            'cancelled': 'bg-danger',
            'scrapped': 'bg-dark',
            'returned': 'bg-dark',
            'partially returned': 'bg-light text-dark',
            'delivery failed': 'bg-danger'
        };
    
        const returnStatusMap = {
            'pending': 'bg-secondary',
            'approved': 'bg-info text-dark',
            'processing': 'bg-primary',
            'completed': 'bg-success',
            'rejected': 'bg-danger',
            'cancelled': 'bg-dark'
        };

        const tableData = [];
        orders.forEach(o => {
            const statusKey = o.status.toLowerCase();
            const translationKey = statusKey.replace(/ /g, '_');
            const statusClass = orderStatusMap[statusKey] || 'bg-light text-dark';
            tableData.push({ 
                id: o.order_id, 
                number: o.order_number, 
                type: __('order'), 
                status: `<span class="badge ${statusClass}">${__(translationKey, o.status)}</span>`, 
                date: new Date(o.order_date).toLocaleDateString(),
                actions: ''
            });
        });
        returns.forEach(r => {
            const statusKey = r.status.toLowerCase();
            const translationKey = statusKey.replace(/ /g, '_');
            const statusClass = returnStatusMap[statusKey] || 'bg-warning text-dark';
            tableData.push({ 
                id: r.return_id, 
                number: r.return_number, 
                type: __('return'), 
                status: `<span class="badge ${statusClass}">${__(translationKey, r.status)}</span>`, 
                date: new Date(r.created_at).toLocaleDateString(),
                actions: ''
            });
        });
        ordersTable.clear().rows.add(tableData).draw();
    }

    function populateOrdersDropdown(orders) {
        if (!transactionOrderSelect) return;
        transactionOrderSelect.innerHTML = `<option value="">${__('none')}</option>`;
        orders.forEach(order => transactionOrderSelect.add(new Option(`${__('order')} #${order.order_number} (${order.status})`, order.order_id)));
    }
    
    async function showCreateReturnSweetAlert() {
        const response = await fetchData(`api/customers_api.php?action=get_order_history&id=${customerId}`);
        if (!response.success || !Array.isArray(response.data)) {
            return Swal.fire(__('error'), __('could_not_load_order_history'), 'error');
        }

        const returnableItems = response.data.filter(item => (parseInt(item.picked_quantity, 10) - parseInt(item.returned_quantity, 10)) > 0);

        if (returnableItems.length === 0) {
            return Swal.fire(__('no_returnable_items_title'), __('no_returnable_items_text'), 'info');
        }

        let itemsHtml = returnableItems.map(item => {
            const pickedQty = parseInt(item.picked_quantity, 10);
            const returnedQty = parseInt(item.returned_quantity, 10);
            const returnableQty = pickedQty - returnedQty;
            return `
                <tr class="return-item-row" data-order-id="${item.order_id}" data-outbound-item-id="${item.outbound_item_id}">
                    <td data-search-term="${item.order_number.toLowerCase()}">${item.order_number}</td>
                    <td data-search-term="${item.product_name.toLowerCase()}">${item.product_name}</td>
                    <td data-search-term="${(item.article_no || '').toLowerCase()}">${item.article_no || __('n_a')}</td>
                    <td>${item.dot_code || __('n_a')}</td>
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
            title: __('create_new_return'),
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label for="swal-return-reason" class="form-label">${__('reason_for_return')}*</label>
                        <textarea id="swal-return-reason" class="form-control" rows="2" placeholder="${__('e_g_damaged_wrong_item')}"></textarea>
                    </div>
                    <div class="mb-3">
                        <label for="swal-item-search" class="form-label">${__('search_by_order_product_article')}</label>
                        <input type="text" id="swal-item-search" class="form-control" placeholder="${__('start_typing_to_filter')}...">
                    </div>
                    <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                        <table class="table table-bordered table-sm">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>${__('order_no')}</th>
                                    <th>${__('product')}</th>
                                    <th>${__('article_no')}</th>
                                    <th>${__('dot')}</th>
                                    <th>${__('returned')}</th>
                                    <th>${__('returnable')}</th>
                                    <th>${__('return_qty')}</th>
                                </tr>
                            </thead>
                            <tbody id="return-items-table-body">${itemsHtml}</tbody>
                        </table>
                    </div>
                </div>
            `,
            width: '80%',
            showCancelButton: true,
            confirmButtonText: __('initiate_return'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            didOpen: () => {
                const searchInput = document.getElementById('swal-item-search');
                const tableBody = document.getElementById('return-items-table-body');
                const rows = tableBody.getElementsByClassName('return-item-row');

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
                    Swal.showValidationMessage(__('reason_for_return_is_required'));
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
                    Swal.showValidationMessage(__('must_specify_return_quantity'));
                    return false;
                }
                
                return { itemsByOrder, reason };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { itemsByOrder, reason } = result.value;
                
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
                         Swal.fire(__('partial_failure'), `${__('some_returns_failed')}:<br>${errorMessages}`, 'warning');
                    } else {
                        Swal.fire(__('success'), `${__('following_returns_created')}:<br>${successMessages}`, 'success').then(() => {
                           window.location.reload();
                        });
                    }
                } catch (error) {
                    Swal.fire(__('error'), error.message, 'error');
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
            Swal.fire(__('invalid_input'), __('valid_transaction_type_and_amount'), 'error');
            return;
        }
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${__('saving')}...`;
        try {
            const result = await fetchData('api/customer_transactions_api.php', 'POST', data);
            if (result?.success) {
                Swal.fire(__('success'), __('transaction_saved_successfully'), 'success');
                transactionForm.reset();
                await loadTransactions();
            }
        } catch (error) {
            Swal.fire(__('error'), error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = __('save_transaction');
        }
    }

    async function showCustomerForm(customer) {
        Swal.fire({
            title: `${__('edit_customer')}: ${customer.customer_name}`,
            html: `
                <form id="swalCustomerForm" class="text-start mt-3">
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swal-customerName" class="form-label">${__('customer_name')}*</label><input type="text" id="swal-customerName" class="form-control" value="${customer.customer_name || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-customerCode" class="form-label">${__('customer_code')}*</label><input type="text" id="swal-customerCode" class="form-control numeric-only" value="${customer.customer_code || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-contactPerson" class="form-label">${__('contact_person')}*</label><input type="text" id="swal-contactPerson" class="form-control" value="${customer.contact_person || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-email" class="form-label">${__('email')}</label><input type="email" id="swal-email" class="form-control email-validation" value="${customer.email || ''}"></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone" class="form-label">${__('phone')}*</label><input type="tel" id="swal-phone" class="form-control saudi-mobile-number" value="${customer.phone || ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone2" class="form-label">${__('alt_phone')}</label><input type="tel" id="swal-phone2" class="form-control numeric-only" value="${customer.phone2 || ''}"></div>
                    </div>
                </form>`,
            width: '70%', 
            showCancelButton: true, 
            confirmButtonText: __('save_changes'), 
            cancelButtonText: __('cancel'),
            focusConfirm: false, 
            allowOutsideClick: false,
            preConfirm: () => {
                const requiredFields = {'swal-customerName': __('customer_name'),'swal-customerCode': __('customer_code'),'swal-contactPerson': __('contact_person'),'swal-phone': __('phone')};
                const missingFields = [];
                for (const [id, name] of Object.entries(requiredFields)) {
                    if (!document.getElementById(id).value.trim()) missingFields.push(name);
                }
                if (missingFields.length > 0) {
                    Swal.showValidationMessage(`${__('following_fields_required')}: ${missingFields.join(', ')}`);
                    return false;
                }
                return {
                    customer_id: customer.customer_id,
                    customer_name: document.getElementById('swal-customerName').value,
                    customer_code: document.getElementById('swal-customerCode').value,
                    contact_person: document.getElementById('swal-contactPerson').value,
                    email: document.getElementById('swal-email').value,
                    phone: document.getElementById('swal-phone').value,
                    phone2: document.getElementById('swal-phone2').value
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData('api/customers_api.php', 'PUT', result.value);
                    if (apiResult?.success) {
                        Swal.fire(__('success'), apiResult.message, 'success');
                        await loadCustomerDetails();
                    }
                } catch (error) { Swal.fire(__('error'), error.message, 'error'); }
            }
        });
    }

    async function showDetailsModal(id, type) {
        Swal.fire({
            title: `${__('loading')} ${type} ${__('details')}...`,
            html: '<div class="spinner-border" role="status"></div>',
            showConfirmButton: false,
            allowOutsideClick: false,
            width: '70%'
        });

        try {
            let modalContentId = `details-content-${id}`;
            let detailsHtml = '';

            if (type === __('order')) {
                const response = await fetchData(`api/outbound_api.php?order_id=${id}`);
                if (response.success) {
                    const order = response.data;
                    let itemsHtml = order.items.map(item => `
                        <tr>
                            <td>${item.sku}</td>
                            <td>${item.product_name}</td>
                            <td>${item.article_no || __('n_a')}</td>
                            <td class="text-center">${item.ordered_quantity}</td>
                            <td class="text-center">${item.picked_quantity}</td>
                            <td class="text-center">${item.returned_quantity || 0}</td>
                        </tr>`).join('');
                    
                    detailsHtml = `
                        <div id="${modalContentId}">
                            <div class="text-start">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>${__('order_no')}:</strong> ${order.order_number}</p>
                                        <p><strong>${__('status')}:</strong> ${order.status}</p>
                                        <p><strong>${__('required_ship_date')}:</strong> ${order.required_ship_date}</p>
                                        <p><strong>${__('actual_ship_date')}:</strong> ${order.actual_ship_date || __('n_a')}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>${__('tracking_no')}:</strong> ${order.tracking_number || __('n_a')}</p>
                                        <p><strong>${__('picker')}:</strong> ${order.picker_name || __('n_a')}</p>
                                        <p><strong>${__('shipper')}:</strong> ${order.shipper_name || __('n_a')}</p>
                                        <p><strong>${__('driver')}:</strong> ${order.driver_name || __('n_a')}</p>
                                    </div>
                                </div>
                                <hr>
                                <h6>${__('delivery_information')}</h6>
                                <p><strong>${__('delivered_to')}:</strong> ${order.delivered_to_name || __('n_a')}</p>
                                <p><strong>${__('delivery_date')}:</strong> ${order.actual_delivery_date ? new Date(order.actual_delivery_date).toLocaleString() : __('n_a')}</p>
                                <p><strong>${__('delivery_note')}:</strong> ${order.delivery_note || __('n_a')}</p>
                                ${order.delivery_photo_path ? `<p><strong>${__('proof_of_delivery')}:</strong> <a href="${order.delivery_photo_path}" target="_blank">${__('view_photo')}</a></p>` : ''}
                                <h6 class="mt-4">${__('items')}</h6>
                                <table class="table table-sm table-bordered">
                                    <thead><tr><th>${__('sku')}</th><th>${__('product')}</th><th>${__('article_no')}</th><th>${__('ordered')}</th><th>${__('picked')}</th><th>${__('returned')}</th></tr></thead>
                                    <tbody>${itemsHtml}</tbody>
                                </table>
                            </div>
                        </div>`;
                    Swal.update({
                        title: __('order_details'),
                        html: detailsHtml,
                        showConfirmButton: true,
                        showDenyButton: true,
                        confirmButtonText: __('close'),
                        denyButtonText: `<i class="bi bi-printer"></i> ${__('print')}`,
                    });
                    
                    $('.swal2-deny').off('click').on('click', function() {
                        printModalContent(modalContentId, `${__('order_details')} - ${order.order_number}`);
                    });
                }
            } else if (type === __('return')) {
                const response = await fetchData(`api/returns_api.php?return_id=${id}`);
                if (response.success) {
                    const ret = response.data;
                     let itemsHtml = ret.items.map(item => `
                        <tr>
                            <td>${item.sku}</td>
                            <td>${item.product_name}</td>
                            <td>${item.article_no || __('n_a')}</td>
                            <td class="text-center">${item.expected_quantity}</td>
                            <td class="text-center">${item.processed_quantity}</td>
                            <td>${item.condition || __('n_a')}</td>
                        </tr>`).join('');

                    detailsHtml = `
                        <div id="${modalContentId}">
                            <div class="text-start">
                                <p><strong>${__('rma_no')}:</strong> ${ret.return_number}</p>
                                <p><strong>${__('original_order_no')}:</strong> ${ret.order_number || __('n_a')}</p>
                                <p><strong>${__('status')}:</strong> ${ret.status}</p>
                                <p><strong>${__('reason')}:</strong> ${ret.reason || __('n_a')}</p>
                                <h6 class="mt-4">${__('items')}</h6>
                                <table class="table table-sm table-bordered">
                                    <thead><tr><th>${__('sku')}</th><th>${__('product')}</th><th>${__('article_no')}</th><th>${__('expected')}</th><th>${__('processed')}</th><th>${__('condition')}</th></tr></thead>
                                    <tbody>${itemsHtml}</tbody>
                                </table>
                            </div>
                        </div>`;
                     Swal.update({
                        title: __('return_details'),
                        html: detailsHtml,
                        showConfirmButton: true,
                        showDenyButton: true,
                        confirmButtonText: __('close'),
                        denyButtonText: `<i class="bi bi-printer"></i> ${__('print')}`,
                    });

                     $('.swal2-deny').off('click').on('click', function() {
                        printModalContent(modalContentId, `${__('return_details')} - ${ret.return_number}`);
                    });
                }
            }
        } catch (error) {
            Swal.fire(__('error'), `${__('could_not_load_details')}: ${error.message}`, 'error');
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
