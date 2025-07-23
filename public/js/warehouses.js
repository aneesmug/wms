// public/js/warehouses.js

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
        // Check if user is global admin to show/hide the add button
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
            serverSide: false, // Data is loaded all at once client-side
            ajax: {
                url: 'api/warehouses_api.php',
                dataSrc: 'data' // The array of warehouses is in the 'data' property
            },
            columns: [
                { data: 'warehouse_name' },
                { data: 'city', defaultContent: '<em>N/A</em>' },
                { data: 'country', defaultContent: '<em>N/A</em>' },
                {
                    data: 'is_active',
                    render: (data) => data == 1 
                        ? '<span class="badge bg-success">Yes</span>' 
                        : '<span class="badge bg-secondary">No</span>'
                },
                {
                    data: 'warehouse_id',
                    orderable: false,
                    className: 'text-end',
                    render: (data, type, row) => {
                        if (isGlobalAdmin) {
                            return `
                                <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${data}" title="Edit"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger delete-btn ms-2" data-id="${data}" title="Delete"><i class="bi bi-trash"></i></button>
                            `;
                        }
                        return '<span class="text-muted">View Only</span>';
                    }
                }
            ],
            rowId: 'warehouse_id',
            responsive: true,
            order: [[0, 'asc']]
        });
    }

    // Event listener for Add, Edit, Delete buttons
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
        const title = isEditing ? 'Edit Warehouse' : 'Add New Warehouse';

        Swal.fire({
            title: title,
            html: `
                <form id="warehouseForm" class="text-start">
                    <input type="hidden" id="warehouse_id" value="${warehouseData?.warehouse_id || ''}">
                    <div class="mb-3">
                        <label for="warehouse_name" class="form-label">Warehouse Name*</label>
                        <input type="text" id="warehouse_name" class="form-control" value="${warehouseData?.warehouse_name || ''}" required>
                    </div>
                    <div class="mb-3">
                        <label for="address" class="form-label">Address</label>
                        <input type="text" id="address" class="form-control" value="${warehouseData?.address || ''}">
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="city" class="form-label">City</label>
                            <input type="text" id="city" class="form-control" value="${warehouseData?.city || ''}">
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="country" class="form-label">Country*</label>
                            <input type="text" id="country" class="form-control" value="${warehouseData?.country || ''}" required>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="zip" class="form-label">ZIP Code*</label>
                        <input type="text" id="zip" class="form-control" value="${warehouseData?.zip || ''}" required>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="is_active" ${isEditing ? (warehouseData.is_active == 1 ? 'checked' : '') : 'checked'}>
                        <label class="form-check-label" for="is_active">Is Active</label>
                    </div>
                </form>
            `,
            showCancelButton: true,
            confirmButtonText: isEditing ? 'Update' : 'Save',
            // MODIFICATION: Added client-side validation before the API call
            preConfirm: async () => {
                // 1. Get form elements and values
                const nameInput = document.getElementById('warehouse_name');
                const countryInput = document.getElementById('country');
                const zipInput = document.getElementById('zip');

                // 2. Perform field-by-field validation
                if (!nameInput.value.trim()) {
                    Swal.showValidationMessage('Warehouse Name is required.');
                    return false;
                }
                if (!countryInput.value.trim()) {
                    Swal.showValidationMessage('Country is required.');
                    return false;
                }
                if (!zipInput.value.trim()) {
                    Swal.showValidationMessage('ZIP Code is required.');
                    return false;
                }

                // 3. If front-end validation passes, create data object
                const data = {
                    warehouse_id: document.getElementById('warehouse_id').value,
                    warehouse_name: nameInput.value,
                    address: document.getElementById('address').value,
                    city: document.getElementById('city').value,
                    country: countryInput.value,
                    zip: zipInput.value,
                    is_active: document.getElementById('is_active').checked
                };

                // 4. Make the API call
                const method = isEditing ? 'PUT' : 'POST';
                const response = await fetchData('api/warehouses_api.php', method, data);

                // 5. Handle the API response (e.g., for duplicate names from the server)
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
            title: 'Are you sure?',
            html: `You are about to delete <strong>${warehouseData.warehouse_name}</strong>. This cannot be undone!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/warehouses_api.php', 'DELETE', { warehouse_id: warehouseData.warehouse_id });
                if (response.success) {
                    Toast.fire({ icon: 'success', title: response.message });
                    warehousesDataTable.ajax.reload();
                } else {
                    Swal.fire('Error!', response.message || 'Failed to delete warehouse.', 'error');
                }
            }
        });
    }
});
