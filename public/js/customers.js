/*
* MODIFICATION SUMMARY:
* 1. INTEGRATED TRANSLATION: Replaced all user-facing strings with the global `__` function to support multi-language capabilities. This includes modal titles, button texts, table headers (via PHP), and confirmation messages.
*/

// public/js/customers.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    
    // --- State & Config ---
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let customersTable = null;

    if (addCustomerBtn) addCustomerBtn.addEventListener('click', () => showCustomerForm(null));

    initializePage();

    async function initializePage() {
        
        const canManageInbound = ['operator', 'manager'].includes(currentWarehouseRole);
        if (!canManageInbound) {
            $('button').prop('disabled', true);
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: __('view_only_permissions'), showConfirmButton: false, timer: 3000, timerProgressBar: true });
        }
    
        initializeCustomersDataTable();
        await loadCustomers();
    }

    function initializeCustomersDataTable() {
        customersTable = $('#customersTable').DataTable({
            responsive: true,
            "order": [[1, "asc"]],
            columns: [
                { data: 'customer_code', defaultContent: __('n_a') },
                { data: 'customer_name' },
                { data: 'contact_person', defaultContent: __('n_a') },
                { data: 'phone', defaultContent: __('n_a') },
                { data: 'order_count', className: 'text-center' },
                { 
                    data: null,
                    orderable: false,
                    className: 'text-end',
                    render: function(data, type, row) {
                        const canDelete = currentWarehouseRole === 'manager';
                        let actionsHtml = `<a href="customer_details.php?id=${row.customer_id}" class="btn btn-sm btn-outline-secondary view-details-btn" title="${__('view_details')}"><i class="bi bi-person-lines-fill"></i></a>`;
                        if (canDelete) {
                            actionsHtml += `<button data-id="${row.customer_id}" class="btn btn-sm btn-outline-danger delete-btn ms-2" title="${__('delete')}"><i class="bi bi-trash"></i></button>`;
                        }
                        return actionsHtml;
                    }
                }
            ],
            language: {
                search: `<span>${__('search')}:</span> _INPUT_`,
                searchPlaceholder: `${__('search')}...`,
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
                zeroRecords: __('no_matching_records_found'),
                processing: `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">${__('loading')}...</span></div>`
            }
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
            Swal.fire(__('error'), `${__('could_not_load_customers')}: ${error.message}`, 'error');
        }
    }

    async function showCustomerForm(customer) {
        const isEditing = customer !== null;
        Swal.fire({
            title: isEditing ? `${__('edit_customer')}: ${customer.customer_name}` : __('add_new_customer'),
            html: `
                <form id="swalCustomerForm" class="text-start mt-3">
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swal-customerName" class="form-label">${__('customer_name')}*</label><input type="text" id="swal-customerName" class="form-control" value="${isEditing ? customer.customer_name : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-customerCode" class="form-label">${__('customer_code')}*</label><input type="text" id="swal-customerCode" class="form-control numeric-only" value="${isEditing ? customer.customer_code || '' : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-contactPerson" class="form-label">${__('contact_person')}*</label><input type="text" id="swal-contactPerson" class="form-control" value="${isEditing ? customer.contact_person || '' : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-email" class="form-label">${__('email')}</label><input type="email" id="swal-email" class="form-control email-validation" value="${isEditing ? customer.email || '' : ''}"></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone" class="form-label">${__('phone')}*</label><input type="tel" id="swal-phone" class="form-control saudi-mobile-number" value="${isEditing ? customer.phone || '' : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone2" class="form-label">${__('alt_phone')}</label><input type="tel" id="swal-phone2" class="form-control numeric-only" value="${isEditing ? customer.phone2 || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine1" class="form-label">${__('address_line_1')}*</label><input type="text" id="swal-addressLine1" class="form-control" value="${isEditing ? customer.address_line1 || '' : ''}" required></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine2" class="form-label">${__('address_line_2')}</label><input type="text" id="swal-addressLine2" class="form-control" value="${isEditing ? customer.address_line2 || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-city" class="form-label">${__('city')}*</label><input type="text" id="swal-city" class="form-control" value="${isEditing ? customer.city || '' : ''}" required></div>
                        <div class="col-md-4 mb-3"><label for="swal-state" class="form-label">${__('state')}</label><input type="text" id="swal-state" class="form-control" value="${isEditing ? customer.state || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-zipCode" class="form-label">${__('zip_code')}</label><input type="text" id="swal-zipCode" class="form-control numeric-only" value="${isEditing ? customer.zip_code || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-country" class="form-label">${__('country')}*</label><input type="text" id="swal-country" class="form-control" value="${isEditing ? customer.country || '' : ''}" required></div>
                    </div>
                </form>`,
            width: '800px', 
            showCancelButton: true, 
            confirmButtonText: isEditing ? __('save_changes') : __('create_customer'), 
            cancelButtonText: __('cancel'),
            focusConfirm: false, 
            allowOutsideClick: false,
            preConfirm: () => {
                const requiredFields = {
                    'swal-customerName': __('customer_name'),
                    'swal-customerCode': __('customer_code'),
                    'swal-contactPerson': __('contact_person'),
                    'swal-phone': __('phone'),
                    'swal-addressLine1': __('address_line_1'),
                    'swal-city': __('city'),
                    'swal-country': __('country')
                };
                const missingFields = [];
                for (const [id, name] of Object.entries(requiredFields)) {
                    const input = document.getElementById(id);
                    if (!input.value.trim()) {
                        missingFields.push(name);
                    }
                }

                if (missingFields.length > 0) {
                    Swal.showValidationMessage(`${__('following_fields_required')}: ${missingFields.join(', ')}`);
                    return false;
                }

                return {
                    customer_id: isEditing ? customer.customer_id : null,
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
                const data = result.value;
                const method = isEditing ? 'PUT' : 'POST';
                try {
                    const apiResult = await fetchData('api/customers_api.php', method, data);
                    if (apiResult?.success) {
                        Swal.fire(__('success'), apiResult.message, 'success');
                        await loadCustomers();
                    }
                } catch (error) { Swal.fire(__('error'), error.message, 'error'); }
            }
        });
    }

    function addTableButtonListeners() {
        $('#customersTable tbody').off('click').on('click', '.delete-btn', handleDeleteClick);
    }

    function handleDeleteClick(event) {
        const id = event.target.closest('button').dataset.id;
        Swal.fire({ 
            title: __('delete_customer_q'), 
            text: __("delete_customer_warn"), 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#d33', 
            cancelButtonColor: '#3085d6', 
            confirmButtonText: __('yes_delete_it'), 
            cancelButtonText: __('cancel'),
            allowOutsideClick: false, 
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData(`api/customers_api.php?action=delete`, 'POST', { id: id });
                    if (apiResult?.success) { 
                        Swal.fire(__('deleted'), __('customer_deleted_success'), 'success'); 
                        await loadCustomers(); 
                    }
                } catch (error) { 
                    Swal.fire(__('error'), error.message, 'error'); 
                }
            }
        });
    }
});
