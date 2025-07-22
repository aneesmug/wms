// public/js/suppliers.js

$(document).ready(function() {
    // --- Globals ---
    let suppliersTable;
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
    const canDelete = currentWarehouseRole === 'manager';

    // --- Initial Load ---
    initializePage();

    // --- Functions ---
    function initializePage() {
        // Hide add button if user doesn't have permission
        if (!canManage) {
            $('#addSupplierBtn').hide();
        }

        // Initialize DataTable
        suppliersTable = $('#suppliersTable').DataTable({
            processing: true,
            serverSide: false, // Using client-side processing for simplicity
            ajax: {
                url: 'api/suppliers_api.php',
                type: 'GET',
                dataSrc: 'data' // The key in the JSON response that holds the array of suppliers
            },
            columns: [
                { data: 'supplier_name' },
                { data: 'contact_person', defaultContent: 'N/A' },
                { data: 'email', defaultContent: 'N/A' },
                { data: 'phone', defaultContent: 'N/A' },
                {
                    data: 'is_active',
                    render: function(data, type, row) {
                        const badgeClass = data == 1 ? 'bg-success' : 'bg-secondary';
                        const text = data == 1 ? 'Yes' : 'No';
                        return `<span class="badge ${badgeClass}">${text}</span>`;
                    }
                },
                {
                    data: null, // Action buttons column
                    orderable: false,
                    searchable: false,
                    className: 'text-end',
                    render: function(data, type, row) {
                        let actionsHtml = '';
                        if (canManage) {
                            actionsHtml += `<button data-id="${row.supplier_id}" class="btn btn-sm btn-outline-primary edit-btn me-2" title="Edit"><i class="bi bi-pencil"></i></button>`;
                        }
                        if (canDelete) {
                            actionsHtml += `<button data-id="${row.supplier_id}" class="btn btn-sm btn-outline-danger delete-btn" title="Delete"><i class="bi bi-trash"></i></button>`;
                        }
                        return actionsHtml || '<span class="text-muted">View Only</span>';
                    }
                }
            ],
            rowCallback: function(row, data, index) {
                // You can add custom row logic here if needed
            }
        });

        // --- Event Listeners ---
        $('#addSupplierBtn').on('click', handleAddSupplier);
        $('#suppliersTable tbody').on('click', '.edit-btn', handleEditSupplier);
        $('#suppliersTable tbody').on('click', '.delete-btn', handleDeleteSupplier);
        $('#logoutBtn').on('click', handleLogout);
    }

    // --- SweetAlert2 Form Logic ---

    function getSupplierFormHtml(supplier = {}) {
        return `
            <form id="swalSupplierForm" class="text-start">
                <input type="hidden" id="supplierId" value="${supplier.supplier_id || ''}">
                <div class="mb-3">
                    <label for="supplierName" class="form-label">Supplier Name*</label>
                    <input type="text" id="supplierName" class="form-control" value="${supplier.supplier_name || ''}" required>
                </div>
                <div class="mb-3">
                    <label for="contactPerson" class="form-label">Contact Person</label>
                    <input type="text" id="contactPerson" class="form-control" value="${supplier.contact_person || ''}">
                </div>
                <div class="mb-3">
                    <label for="email" class="form-label">Email</label>
                    <input type="email" id="email" class="form-control" value="${supplier.email || ''}">
                </div>
                <div class="mb-3">
                    <label for="phone" class="form-label">Phone</label>
                    <input type="tel" id="phone" class="form-control" value="${supplier.phone || ''}">
                </div>
                <div class="mb-3">
                    <label for="paymentTerms" class="form-label">Payment Terms</label>
                    <input type="text" id="paymentTerms" class="form-control" placeholder="e.g., Net 30" value="${supplier.payment_terms || ''}">
                </div>
                <div class="mb-3">
                    <label for="taxId" class="form-label">Tax ID</label>
                    <input type="text" id="taxId" class="form-control" placeholder="e.g., VAT ID" value="${supplier.tax_id || ''}">
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="isActive" ${supplier.is_active == 1 || supplier.is_active === undefined ? 'checked' : ''}>
                    <label class="form-check-label" for="isActive">Is Active</label>
                </div>
            </form>
        `;
    }

    function handleAddSupplier() {
        Swal.fire({
            title: 'Add New Supplier',
            html: getSupplierFormHtml(),
            confirmButtonText: 'Save Supplier',
            showCancelButton: true,
            focusConfirm: false,
            didOpen: () => {
                // Any custom logic when the modal opens
            },
            preConfirm: () => {
                const form = document.getElementById('swalSupplierForm');
                const supplierName = form.querySelector('#supplierName').value.trim();
                if (!supplierName) {
                    Swal.showValidationMessage('Supplier Name is required');
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
                if (response.success) {
                    Swal.fire('Success!', 'Supplier created successfully.', 'success');
                    suppliersTable.ajax.reload();
                } else {
                    Swal.fire('Error!', response.message || 'Failed to create supplier.', 'error');
                }
            }
        });
    }

    function handleEditSupplier() {
        const rowData = suppliersTable.row($(this).parents('tr')).data();
        
        Swal.fire({
            title: 'Edit Supplier',
            html: getSupplierFormHtml(rowData),
            confirmButtonText: 'Update Supplier',
            showCancelButton: true,
            focusConfirm: false,
            preConfirm: () => {
                const form = document.getElementById('swalSupplierForm');
                 const supplierName = form.querySelector('#supplierName').value.trim();
                if (!supplierName) {
                    Swal.showValidationMessage('Supplier Name is required');
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
                if (response.success) {
                    Swal.fire('Success!', 'Supplier updated successfully.', 'success');
                    suppliersTable.ajax.reload(null, false); // reload and keep pagination
                } else {
                    Swal.fire('Error!', response.message || 'Failed to update supplier.', 'error');
                }
            }
        });
    }

    function handleDeleteSupplier() {
        const rowData = suppliersTable.row($(this).parents('tr')).data();
        
        Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete "${rowData.supplier_name}". This may fail if they have existing inbound receipts. This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData(`api/suppliers_api.php?id=${rowData.supplier_id}`, 'DELETE');
                if (response.success) {
                    Swal.fire('Deleted!', 'The supplier has been deleted.', 'success');
                    suppliersTable.ajax.reload();
                } else {
                    Swal.fire('Error!', response.message || 'Failed to delete supplier.', 'error');
                }
            }
        });
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
