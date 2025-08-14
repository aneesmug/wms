// public/js/products.js

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
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'View-only permissions.', showConfirmButton: false, timer: 3000, timerProgressBar: true });
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
                { data: 'tire_type_name', defaultContent: '<em>N/A</em>' },
                { data: 'article_no', defaultContent: '<em>N/A</em>' },
                { data: 'unit_of_measure', defaultContent: '<em>N/A</em>' },
                { data: 'total_quantity', className: 'text-end' },
                {
                    data: 'is_active',
                    className: 'text-center',
                    render: function(data, type, row) {
                        return data == 1 
                            ? '<span class="badge bg-success">Active</span>' 
                            : '<span class="badge bg-danger">Inactive</span>';
                    }
                },
                {
                    data: 'product_id',
                    orderable: false,
                    className: 'text-center',
                    render: function (data, type, row) {
                        let actionsHtml = '';
                        if (canManageProducts) {
                            actionsHtml += `<button class="btn btn-sm btn-outline-primary edit-btn" title="Edit"><i class="bi bi-pencil"></i></button>`;
                        }
                        if (canDeleteProducts) {
                            actionsHtml += `<button class="btn btn-sm btn-outline-danger delete-btn ms-2" title="Delete"><i class="bi bi-trash"></i></button>`;
                        }
                        return actionsHtml || '<span class="text-muted">View Only</span>';
                    }
                }
            ],
            rowId: 'product_id'
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
        let options = '<option value="">All Types</option>';
        tireTypes.forEach(type => {
            options += `<option value="${type.tire_type_name}">${type.tire_type_name}</option>`;
        });
        tireTypeFilter.innerHTML = options;
    }

    function getTireTypesHtml(selectedId = null) {
        let options = '<option value="">Select a Type...</option>';
        tireTypes.forEach(type => {
            const isSelected = type.tire_type_id == selectedId ? 'selected' : '';
            options += `<option value="${type.tire_type_id}" ${isSelected}>${type.tire_type_name}</option>`;
        });
        return `<select id="tire_type_id" class="form-select">${options}</select>`;
    }

    function openProductModal(productData = null) {
        const isEditing = productData !== null;
        const title = isEditing ? 'Edit Product' : 'Add New Product';

        Swal.fire({
            title: title,
            html: `
                <form id="swalProductForm" class="text-start">
                    <input type="hidden" id="product_id" value="${productData?.product_id || ''}">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="sku" class="form-label">SKU</label>
                            <input type="text" id="sku" class="form-control" value="${productData?.sku || ''}" required>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="product_name" class="form-label">Product Name</label>
                            <input type="text" id="product_name" class="form-control" value="${productData?.product_name || ''}" required>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="description" class="form-label">Description</label>
                        <textarea id="description" class="form-control">${productData?.description || ''}</textarea>
                    </div>
                    <div class="row">
                         <div class="col-md-6 mb-3">
                            <label for="tire_type_id" class="form-label">Tire Type</label>
                            ${getTireTypesHtml(productData?.tire_type_id)}
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="unit_of_measure" class="form-label">Unit of Measure</label>
                            <input type="text" id="unit_of_measure" class="form-control" placeholder="e.g., PCS, BOX" value="${productData?.unit_of_measure || ''}">
                        </div>
                    </div>
                     <div class="row">
                        <div class="col-md-3 mb-3">
                            <label for="article_no" class="form-label">Article No</label>
                            <input type="text" id="article_no" class="form-control" value="${productData?.article_no || ''}">
                        </div>
                        <div class="col-md-3 mb-3">
                            <label for="weight" class="form-label">Weight (kg)</label>
                            <input type="number" step="0.01" id="weight" class="form-control" value="${productData?.weight || ''}">
                        </div>
                         <div class="col-md-3 mb-3">
                            <label for="volume" class="form-label">Volume (m³)</label>
                            <input type="number" step="0.01" id="volume" class="form-control" value="${productData?.volume || ''}">
                        </div>
                        <div class="col-md-3 mb-3">
                            <label for="expiry_years" class="form-label">Expiry (Years)</label>
                            <input type="number" id="expiry_years" class="form-control" placeholder="e.g., 5" value="${productData?.expiry_years || ''}">
                        </div>
                    </div>
                    <div class="form-check mt-3">
                        <input class="form-check-input" type="checkbox" id="is_active" ${isEditing ? (productData.is_active == 1 ? 'checked' : '') : 'checked'}>
                        <label class="form-check-label" for="is_active">Is Active</label>
                    </div>
                </form>
            `,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: isEditing ? 'Update Product' : 'Save Product',
            allowOutsideClick: false,
            preConfirm: () => {
                const sku = Swal.getPopup().querySelector('#sku').value.trim();
                const productName = Swal.getPopup().querySelector('#product_name').value.trim();
                const articleNo = Swal.getPopup().querySelector('#article_no').value.trim();
                const expiryYears = Swal.getPopup().querySelector('#expiry_years').value.trim();
                const tireTypeId = Swal.getPopup().querySelector('#tire_type_id').value;

                const requiredFields = [];
                if (!sku) requiredFields.push('SKU');
                if (!productName) requiredFields.push('Product Name');
                if (!articleNo) requiredFields.push('Article No');
                if (!expiryYears) requiredFields.push('Expiry (Years)');
                if (!tireTypeId) requiredFields.push('Tire Type');

                if (requiredFields.length > 0) {
                    Swal.showValidationMessage(`The following fields are required: ${requiredFields.join(', ')}`);
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
                    Swal.fire('Success!', response.message, 'success');
                    productsDataTable.ajax.reload();
                } else {
                    Swal.fire('Error!', response.message || 'An unknown error occurred.', 'error');
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
            title: 'Are you sure?',
            text: `You are about to delete "${productData.product_name}". This action cannot be undone!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/products_api.php', 'DELETE', { id: productData.product_id });
                if (response.success) {
                    Swal.fire('Deleted!', 'The product has been deleted.', 'success');
                    productsDataTable.ajax.reload();
                } else {
                    Swal.fire('Error!', response.message || 'Failed to delete product.', 'error');
                }
            }
        });
    }
});
