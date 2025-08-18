/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings in UI elements, alerts, and modals with the `__()` translation function.
* 2. This includes placeholders, DataTable language settings, SweetAlert2 titles and messages, and error notifications.
* 3. The entire JavaScript functionality for this page is now fully localizable.
* 4. Ensured dynamic messages with variables are constructed correctly using translated strings.
*/

$(document).ready(function() {
    // --- Globals ---
    let suppliersTable;
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');

    // --- Initial Load ---
    initializePage();

    // --- Functions ---
    async function fetchData(url, method = 'POST', data = null) {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || `${__('api_error')}: Status ${response.status}`);
            }
            return result;
        } catch (error) {
            console.error('Fetch Error:', error);
            const isAccessDeniedError = error.message.includes(__('access_denied'));
            Swal.fire({
                title: __('error'),
                text: error.message,
                icon: 'error',
                confirmButtonText: __('ok'),
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed && isAccessDeniedError) {
                    window.location.href = 'dashboard.php';
                }
            });
            return { success: false, message: error.message };
        }
    }

    function initializePage() {
        if (currentWarehouseRole === 'viewer') {
            Swal.fire({
                title: __('access_denied'),
                text: __('insufficient_permissions'),
                icon: 'error',
                confirmButtonText: __('ok'),
                allowOutsideClick: false
            }).then(() => {
                window.location.href = 'dashboard.php';
            });
            $('#suppliersTable_wrapper').hide();
            $('#addSupplierBtn').hide();
            return;
        }

        const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        const canDelete = currentWarehouseRole === 'manager';

        if (!canManage) {
            $('#addSupplierBtn').hide();
        }

        suppliersTable = $('#suppliersTable').DataTable({
            processing: true,
            serverSide: false,
            ajax: {
                url: 'api/suppliers_api.php',
                type: 'GET',
                dataSrc: 'data'
            },
            columns: [
                { data: 'supplier_name' },
                { data: 'contact_person', defaultContent: __('n_a') },
                { data: 'email', defaultContent: __('n_a') },
                { data: 'phone', defaultContent: __('n_a') },
                {
                    data: 'is_active',
                    render: function(data, type, row) {
                        const badgeClass = data == 1 ? 'bg-success' : 'bg-secondary';
                        const text = data == 1 ? __('yes') : __('no');
                        return `<span class="badge ${badgeClass}">${text}</span>`;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    className: 'text-end',
                    render: function(data, type, row) {
                        let actionsHtml = '';
                        if (canManage) {
                            actionsHtml += `<button data-id="${row.supplier_id}" class="btn btn-sm btn-outline-primary edit-btn me-2" title="${__('edit')}"><i class="bi bi-pencil"></i></button>`;
                        }
                        if (canDelete) {
                            actionsHtml += `<button data-id="${row.supplier_id}" class="btn btn-sm btn-outline-danger delete-btn" title="${__('delete')}"><i class="bi bi-trash"></i></button>`;
                        }
                        return actionsHtml || `<span class="text-muted">${__('view_only')}</span>`;
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

        $('#addSupplierBtn').on('click', handleAddSupplier);
        $('#suppliersTable tbody').on('click', '.edit-btn', handleEditSupplier);
        $('#suppliersTable tbody').on('click', '.delete-btn', handleDeleteSupplier);
    }

    function getSupplierFormHtml(supplier = {}) {
        return `
            <form id="swalSupplierForm" class="text-start">
                <input type="hidden" id="supplierId" value="${supplier.supplier_id || ''}">
                <div class="mb-3">
                    <label for="supplierName" class="form-label">${__('supplier_name')}*</label>
                    <input type="text" id="supplierName" class="form-control" value="${supplier.supplier_name || ''}" required>
                </div>
                <div class="mb-3">
                    <label for="contactPerson" class="form-label">${__('contact_person')}</label>
                    <input type="text" id="contactPerson" class="form-control" value="${supplier.contact_person || ''}">
                </div>
                <div class="mb-3">
                    <label for="email" class="form-label">${__('email')}</label>
                    <input type="email" id="email" class="form-control" value="${supplier.email || ''}">
                </div>
                <div class="mb-3">
                    <label for="phone" class="form-label">${__('phone')}</label>
                    <input type="tel" id="phone" class="form-control" value="${supplier.phone || ''}">
                </div>
                <div class="mb-3">
                    <label for="paymentTerms" class="form-label">${__('payment_terms')}</label>
                    <input type="text" id="paymentTerms" class="form-control" placeholder="${__('payment_terms_placeholder')}" value="${supplier.payment_terms || ''}">
                </div>
                <div class="mb-3">
                    <label for="taxId" class="form-label">${__('tax_id')}</label>
                    <input type="text" id="taxId" class="form-control" placeholder="${__('tax_id_placeholder')}" value="${supplier.tax_id || ''}">
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="isActive" ${supplier.is_active == 1 || supplier.is_active === undefined ? 'checked' : ''}>
                    <label class="form-check-label" for="isActive">${__('is_active')}</label>
                </div>
            </form>
        `;
    }

    function handleAddSupplier() {
        Swal.fire({
            title: __('add_new_supplier'),
            html: getSupplierFormHtml(),
            confirmButtonText: __('save_supplier'),
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            focusConfirm: false,
            allowOutsideClick: false,
            preConfirm: () => {
                const form = document.getElementById('swalSupplierForm');
                const supplierName = form.querySelector('#supplierName').value.trim();
                if (!supplierName) {
                    Swal.showValidationMessage(__('supplier_name_is_required'));
                    return false;
                }
                return {
                    supplier_name: supplierName,
                    contact_person: form.querySelector('#contactPerson').value.trim(),
                    email: form.querySelector('#email').value.trim(),
                    phone: form.querySelector('#phone').value.trim(),
                    payment_terms: form.querySelector('#paymentTerms').value.trim(),
                    tax_id: form.querySelector('#taxId').value.trim(),
                    is_active: form.querySelector('#isActive').checked
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const data = result.value;
                const response = await fetchData('api/suppliers_api.php', 'POST', data);
                if (response && response.success) {
                    Swal.fire(__('success'), __('supplier_created_successfully'), 'success');
                    suppliersTable.ajax.reload();
                } else if (response) {
                    Swal.fire(__('error'), response.message || __('failed_to_create_supplier'), 'error');
                }
            }
        });
    }

    function handleEditSupplier() {
        const rowData = suppliersTable.row($(this).parents('tr')).data();
        
        Swal.fire({
            title: __('edit_supplier'),
            html: getSupplierFormHtml(rowData),
            confirmButtonText: __('update_supplier'),
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            focusConfirm: false,
            allowOutsideClick: false,
            preConfirm: () => {
                const form = document.getElementById('swalSupplierForm');
                 const supplierName = form.querySelector('#supplierName').value.trim();
                if (!supplierName) {
                    Swal.showValidationMessage(__('supplier_name_is_required'));
                    return false;
                }
                return {
                    supplier_id: form.querySelector('#supplierId').value,
                    supplier_name: supplierName,
                    contact_person: form.querySelector('#contactPerson').value.trim(),
                    email: form.querySelector('#email').value.trim(),
                    phone: form.querySelector('#phone').value.trim(),
                    payment_terms: form.querySelector('#paymentTerms').value.trim(),
                    tax_id: form.querySelector('#taxId').value.trim(),
                    is_active: form.querySelector('#isActive').checked
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const data = result.value;
                const response = await fetchData('api/suppliers_api.php', 'PUT', data);
                if (response && response.success) {
                    Swal.fire(__('success'), __('supplier_updated_successfully'), 'success');
                    suppliersTable.ajax.reload(null, false);
                } else if (response) {
                    Swal.fire(__('error'), response.message || __('failed_to_update_supplier'), 'error');
                }
            }
        });
    }

    function handleDeleteSupplier() {
        const rowData = suppliersTable.row($(this).parents('tr')).data();
        
        Swal.fire({
            title: __('are_you_sure'),
            html: `${__('are_you_sure_delete_supplier')} "<strong>${rowData.supplier_name}</strong>". ${__('delete_supplier_warning')}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: __('yes_delete_it'),
            cancelButtonText: __('cancel')
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData(`api/suppliers_api.php?id=${rowData.supplier_id}`, 'DELETE');
                if (response && response.success) {
                    Swal.fire(__('deleted'), __('supplier_deleted_success'), 'success');
                    suppliersTable.ajax.reload();
                } else if (response) {
                    Swal.fire(__('error'), response.message || __('failed_to_delete_supplier'), 'error');
                }
            }
        });
    }
});
