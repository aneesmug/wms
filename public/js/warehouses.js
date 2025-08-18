/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings in UI elements, alerts, and modals with the `__()` translation function.
* 2. This includes placeholders, DataTable language settings, SweetAlert2 titles and messages, and error notifications.
* 3. The entire JavaScript functionality for this page is now fully localizable.
*/

document.addEventListener('DOMContentLoaded', () => {
    let warehousesDataTable;
    const addWarehouseBtn = document.getElementById('addWarehouseBtn');

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    // Initialize the page
    initializePage();

    async function initializePage() {
        const authStatus = await fetchData('api/auth.php?action=check_auth');
        if (authStatus?.user?.is_global_admin) {
            addWarehouseBtn.style.display = 'block';
        } else {
            addWarehouseBtn.style.display = 'none';
        }

        initializeDataTable(authStatus?.user?.is_global_admin);
    }

    function initializeDataTable(isGlobalAdmin) {
        warehousesDataTable = $('#warehousesTable').DataTable({
            processing: true,
            serverSide: false,
            ajax: {
                url: 'api/warehouses_api.php',
                dataSrc: 'data'
            },
            columns: [
                { data: 'warehouse_name' },
                { data: 'city', defaultContent: `<em>${__('n_a')}</em>` },
                { data: 'country', defaultContent: `<em>${__('n_a')}</em>` },
                {
                    data: 'is_active',
                    render: (data) => data == 1 
                        ? `<span class="badge bg-success">${__('yes')}</span>` 
                        : `<span class="badge bg-secondary">${__('no')}</span>`
                },
                {
                    data: 'warehouse_id',
                    orderable: false,
                    className: 'text-end',
                    render: (data, type, row) => {
                        if (isGlobalAdmin) {
                            return `
                                <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${data}" title="${__('edit')}"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger delete-btn ms-2" data-id="${data}" title="${__('delete')}"><i class="bi bi-trash"></i></button>
                            `;
                        }
                        return `<span class="text-muted">${__('view_only')}</span>`;
                    }
                }
            ],
            rowId: 'warehouse_id',
            responsive: true,
            order: [[0, 'asc']],
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
    }

    $('#warehousesTable tbody').on('click', 'button', function () {
        const row = $(this).closest('tr');
        const data = warehousesDataTable.row(row).data();
        
        if ($(this).hasClass('edit-btn')) {
            openWarehouseModal(data);
        } else if ($(this).hasClass('delete-btn')) {
            handleDeleteWarehouse(data);
        }
    });

    if (addWarehouseBtn) {
        addWarehouseBtn.addEventListener('click', () => openWarehouseModal(null));
    }

    function openWarehouseModal(warehouseData) {
        const isEditing = warehouseData !== null;
        const title = isEditing ? __('edit_warehouse') : __('add_new_warehouse');

        Swal.fire({
            title: title,
            html: `
                <form id="warehouseForm" class="text-start">
                    <input type="hidden" id="warehouse_id" value="${warehouseData?.warehouse_id || ''}">
                    <div class="mb-3">
                        <label for="warehouse_name" class="form-label">${__('warehouse_name')}*</label>
                        <input type="text" id="warehouse_name" class="form-control" value="${warehouseData?.warehouse_name || ''}" required>
                    </div>
                    <div class="mb-3">
                        <label for="address" class="form-label">${__('address')}</label>
                        <input type="text" id="address" class="form-control" value="${warehouseData?.address || ''}">
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="city" class="form-label">${__('city')}</label>
                            <input type="text" id="city" class="form-control" value="${warehouseData?.city || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="country" class="form-label">${__('country')}*</label>
                            <input type="text" id="country" class="form-control" value="${warehouseData?.country || ''}" required>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="zip" class="form-label">${__('zip_code')}*</label>
                        <input type="text" id="zip" class="form-control" value="${warehouseData?.zip || ''}" required>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="is_active" ${isEditing ? (warehouseData.is_active == 1 ? 'checked' : '') : 'checked'}>
                        <label class="form-check-label" for="is_active">${__('is_active')}</label>
                    </div>
                </form>
            `,
            showCancelButton: true,
            confirmButtonText: isEditing ? __('update') : __('save'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            preConfirm: async () => {
                const nameInput = document.getElementById('warehouse_name');
                const countryInput = document.getElementById('country');
                const zipInput = document.getElementById('zip');

                if (!nameInput.value.trim()) {
                    Swal.showValidationMessage(__('warehouse_name_is_required'));
                    return false;
                }
                if (!countryInput.value.trim()) {
                    Swal.showValidationMessage(__('country_is_required'));
                    return false;
                }
                if (!zipInput.value.trim()) {
                    Swal.showValidationMessage(__('zip_code_is_required'));
                    return false;
                }

                const data = {
                    warehouse_id: document.getElementById('warehouse_id').value,
                    warehouse_name: nameInput.value,
                    address: document.getElementById('address').value,
                    city: document.getElementById('city').value,
                    country: countryInput.value,
                    zip: zipInput.value,
                    is_active: document.getElementById('is_active').checked
                };

                const method = isEditing ? 'PUT' : 'POST';
                const response = await fetchData('api/warehouses_api.php', method, data);

                if (!response.success) {
                    Swal.showValidationMessage(response.message);
                    return false;
                }

                return response;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Toast.fire({ icon: 'success', title: result.value.message });
                warehousesDataTable.ajax.reload();
            }
        });
    }

    function handleDeleteWarehouse(warehouseData) {
        Swal.fire({
            title: __('are_you_sure'),
            html: `${__('are_you_sure_delete_warehouse')} <strong>${warehouseData.warehouse_name}</strong>. ${__('action_cannot_be_undone')}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: __('yes_delete_it'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/warehouses_api.php', 'DELETE', { warehouse_id: warehouseData.warehouse_id });
                if (response.success) {
                    Toast.fire({ icon: 'success', title: response.message });
                    warehousesDataTable.ajax.reload();
                } else {
                    Swal.fire(__('error'), response.message || __('failed_to_delete_warehouse'), 'error');
                }
            }
        });
    }
});
