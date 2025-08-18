/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings in UI elements, alerts, and modals with the `__()` translation function.
* 2. This includes placeholders, DataTable language settings, SweetAlert2 titles and messages, and error notifications.
* 3. The entire JavaScript functionality for this page is now fully localizable.
* 4. Ensured dynamic messages with variables are constructed correctly using translated strings.
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables ---
    let productsDataTable;
    let tireTypes = [];
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const canManageProducts = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
    const canDeleteProducts = currentWarehouseRole === 'manager';

    // --- DOM Elements ---
    const addProductBtn = document.getElementById('addProductBtn');
    const tireTypeFilter = document.getElementById('tireTypeFilter');

    // --- Initialize Page ---
    initializePage();

    // --- Event Listeners ---
    if (addProductBtn) addProductBtn.addEventListener('click', () => openProductModal());
    if (tireTypeFilter) tireTypeFilter.addEventListener('change', handleFilterChange);

    $('#productsDataTable tbody').on('click', '.edit-btn', handleEditClick);
    $('#productsDataTable tbody').on('click', '.delete-btn', handleDeleteClick);

    async function initializePage() {
        
        const canManageInbound = ['operator', 'manager'].includes(currentWarehouseRole);
        if (!canManageInbound) {
            $('button').prop('disabled', true);
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: __('view_only_permissions'), showConfirmButton: false, timer: 3000, timerProgressBar: true });
        }

        await loadTireTypes();
        populateTireTypeFilter();

        productsDataTable = $('#productsDataTable').DataTable({
            processing: true,
            serverSide: false,
            ajax: {
                url: 'api/products_api.php',
                dataSrc: 'data'
            },
            columns: [
                { data: 'sku' },
                { data: 'product_name' },
                { data: 'tire_type_name', defaultContent: `<em>${__('n_a')}</em>` },
                { data: 'article_no', defaultContent: `<em>${__('n_a')}</em>` },
                { data: 'unit_of_measure', defaultContent: `<em>${__('n_a')}</em>` },
                { data: 'total_quantity', className: 'text-end' },
                {
                    data: 'is_active',
                    className: 'text-center',
                    render: function(data, type, row) {
                        return data == 1 
                            ? `<span class="badge bg-success">${__('active')}</span>` 
                            : `<span class="badge bg-danger">${__('inactive')}</span>`;
                    }
                },
                {
                    data: 'product_id',
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        let actionsHtml = '';
                        if (canManageProducts) {
                            actionsHtml += `<button class="btn btn-sm btn-outline-primary edit-btn" title="${__('edit')}"><i class="bi bi-pencil"></i></button>`;
                        }
                        if (canDeleteProducts) {
                            actionsHtml += `<button class="btn btn-sm btn-outline-danger delete-btn ms-2" title="${__('delete')}"><i class="bi bi-trash"></i></button>`;
                        }
                        return actionsHtml || `<span class="text-muted">${__('view_only')}</span>`;
                    }
                }
            ],
            rowId: 'product_id',
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

    async function loadTireTypes() {
        const response = await fetchData('api/products_api.php?action=get_tire_types');
        if (response?.success) {
            tireTypes = response.data;
        } else {
            console.error('Failed to load tire types.');
            tireTypes = [];
        }
    }
    
    function populateTireTypeFilter() {
        if (!tireTypeFilter) return;
        let options = `<option value="">${__('all_tire_types')}</option>`;
        tireTypes.forEach(type => {
            options += `<option value="${type.tire_type_name}">${type.tire_type_name}</option>`;
        });
        tireTypeFilter.innerHTML = options;
    }

    function getTireTypesHtml(selectedId = null) {
        let options = `<option value="">${__('select_a_type')}</option>`;
        tireTypes.forEach(type => {
            const isSelected = type.tire_type_id == selectedId ? 'selected' : '';
            options += `<option value="${type.tire_type_id}" ${isSelected}>${type.tire_type_name}</option>`;
        });
        return `<select id="tire_type_id" class="form-select">${options}</select>`;
    }

    function openProductModal(productData = null) {
        const isEditing = productData !== null;
        const title = isEditing ? __('edit_product') : __('add_new_product');

        Swal.fire({
            title: title,
            html: `
                <form id="swalProductForm" class="text-start">
                    <input type="hidden" id="product_id" value="${productData?.product_id || ''}">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="sku" class="form-label">${__('sku')}</label>
                            <input type="text" id="sku" class="form-control" value="${productData?.sku || ''}" required>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="product_name" class="form-label">${__('product_name')}</label>
                            <input type="text" id="product_name" class="form-control" value="${productData?.product_name || ''}" required>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="description" class="form-label">${__('description')}</label>
                        <textarea id="description" class="form-control">${productData?.description || ''}</textarea>
                    </div>
                    <div class="row">
                         <div class="col-md-6 mb-3">
                            <label for="tire_type_id" class="form-label">${__('tire_type')}</label>
                            ${getTireTypesHtml(productData?.tire_type_id)}
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="unit_of_measure" class="form-label">${__('uom')}</label>
                            <input type="text" id="unit_of_measure" class="form-control" placeholder="${__('uom_placeholder')}" value="${productData?.unit_of_measure || ''}">
                        </div>
                    </div>
                     <div class="row">
                        <div class="col-md-3 mb-3">
                            <label for="article_no" class="form-label">${__('article_no')}</label>
                            <input type="text" id="article_no" class="form-control" value="${productData?.article_no || ''}">
                        </div>
                        <div class="col-md-3 mb-3">
                            <label for="weight" class="form-label">${__('weight_kg')}</label>
                            <input type="number" step="0.01" id="weight" class="form-control" value="${productData?.weight || ''}">
                        </div>
                         <div class="col-md-3 mb-3">
                            <label for="volume" class="form-label">${__('volume_m3')}</label>
                            <input type="number" step="0.01" id="volume" class="form-control" value="${productData?.volume || ''}">
                        </div>
                        <div class="col-md-3 mb-3">
                            <label for="expiry_years" class="form-label">${__('expiry_years')}</label>
                            <input type="number" id="expiry_years" class="form-control" placeholder="${__('expiry_placeholder')}" value="${productData?.expiry_years || ''}">
                        </div>
                    </div>
                    <div class="form-check mt-3">
                        <input class="form-check-input" type="checkbox" id="is_active" ${isEditing ? (productData.is_active == 1 ? 'checked' : '') : 'checked'}>
                        <label class="form-check-label" for="is_active">${__('is_active')}</label>
                    </div>
                </form>
            `,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: isEditing ? __('update_product') : __('save_product'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            preConfirm: () => {
                const sku = Swal.getPopup().querySelector('#sku').value.trim();
                const productName = Swal.getPopup().querySelector('#product_name').value.trim();
                const articleNo = Swal.getPopup().querySelector('#article_no').value.trim();
                const expiryYears = Swal.getPopup().querySelector('#expiry_years').value.trim();
                const tireTypeId = Swal.getPopup().querySelector('#tire_type_id').value;

                const requiredFields = [];
                if (!sku) requiredFields.push(__('sku'));
                if (!productName) requiredFields.push(__('product_name'));
                if (!articleNo) requiredFields.push(__('article_no'));
                if (!expiryYears) requiredFields.push(__('expiry_years'));
                if (!tireTypeId) requiredFields.push(__('tire_type'));

                if (requiredFields.length > 0) {
                    Swal.showValidationMessage(`${__('following_fields_required')}: ${requiredFields.join(', ')}`);
                    return false;
                }
                
                return {
                    product_id: Swal.getPopup().querySelector('#product_id').value,
                    sku: sku,
                    product_name: productName,
                    description: Swal.getPopup().querySelector('#description').value,
                    unit_of_measure: Swal.getPopup().querySelector('#unit_of_measure').value,
                    weight: Swal.getPopup().querySelector('#weight').value || null,
                    volume: Swal.getPopup().querySelector('#volume').value || null,
                    article_no: articleNo,
                    tire_type_id: tireTypeId || null,
                    expiry_years: expiryYears || null,
                    is_active: Swal.getPopup().querySelector('#is_active').checked,
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const data = result.value;
                const method = isEditing ? 'PUT' : 'POST';
                const response = await fetchData('api/products_api.php', method, data);

                if (response.success) {
                    Swal.fire(__('success'), response.message, 'success');
                    productsDataTable.ajax.reload();
                } else {
                    Swal.fire(__('error'), response.message || __('an_unknown_error_occurred'), 'error');
                }
            }
        });
    }

    function handleFilterChange(e) {
        const selectedValue = e.target.value;
        productsDataTable.column(2).search(selectedValue).draw();
    }

    function handleEditClick(e) {
        const row = $(e.target).closest('tr');
        const productData = productsDataTable.row(row).data();
        openProductModal(productData);
    }

    function handleDeleteClick(e) {
        const row = $(e.target).closest('tr');
        const productData = productsDataTable.row(row).data();
        
        Swal.fire({
            title: __('are_you_sure'),
            html: `${__('are_you_sure_delete_product')} "<strong>${productData.product_name}</strong>". ${__('action_cannot_be_undone')}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: __('yes_delete_it'),
            cancelButtonText: __('cancel')
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/products_api.php', 'DELETE', { id: productData.product_id });
                if (response.success) {
                    Swal.fire(__('deleted'), __('product_deleted_success'), 'success');
                    productsDataTable.ajax.reload();
                } else {
                    Swal.fire(__('error'), response.message || __('failed_to_delete_product'), 'error');
                }
            }
        });
    }
});
