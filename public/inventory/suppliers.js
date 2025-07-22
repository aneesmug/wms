// public/js/suppliers.js

document.addEventListener('DOMContentLoaded', () => {
    const supplierForm = document.getElementById('supplierForm');
    const supplierFormTitle = document.getElementById('supplierFormTitle');
    const supplierIdInput = document.getElementById('supplierId');
    const suppliersTableBody = document.getElementById('suppliersTableBody');
    const saveSupplierBtn = document.getElementById('saveSupplierBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Form fields
    const supplierNameInput = document.getElementById('supplierName');
    const contactPersonInput = document.getElementById('contactPerson');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const paymentTermsInput = document.getElementById('paymentTerms');
    const taxIdInput = document.getElementById('taxId');
    const isActiveCheckbox = document.getElementById('isActive');

    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');

    // --- Event Listeners ---
    if (supplierForm) supplierForm.addEventListener('submit', handleSaveSupplier);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetSupplierForm);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Initial load
    initializePage();

    // --- Functions ---
    async function initializePage() {
        const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        if(supplierForm) {
            supplierForm.closest('.card').classList.toggle('d-none', !canManage);
        }
        await loadSuppliers();
    }

    async function loadSuppliers() {
        if (!suppliersTableBody) return;
        suppliersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">Loading suppliers...</td></tr>`;

        const response = await fetchData('api/suppliers.php');
        suppliersTableBody.innerHTML = '';

        if (response?.success && Array.isArray(response.data)) {
            if (response.data.length === 0) {
                suppliersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">No suppliers found.</td></tr>`;
                return;
            }
            
            const canEdit = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
            const canDelete = currentWarehouseRole === 'manager';

            response.data.forEach(supplier => {
                const row = suppliersTableBody.insertRow();
                let actionsHtml = '';
                if (canEdit) {
                    actionsHtml += `<button data-id="${supplier.supplier_id}" class="btn btn-sm btn-outline-primary edit-btn me-2" title="Edit"><i class="bi bi-pencil"></i></button>`;
                }
                if (canDelete) {
                    actionsHtml += `<button data-id="${supplier.supplier_id}" class="btn btn-sm btn-outline-danger delete-btn" title="Delete"><i class="bi bi-trash"></i></button>`;
                }

                row.innerHTML = `
                    <td>${supplier.supplier_name}</td>
                    <td>${supplier.contact_person || 'N/A'}</td>
                    <td>${supplier.email || 'N/A'}</td>
                    <td>${supplier.phone || 'N/A'}</td>
                    <td><span class="badge ${supplier.is_active == 1 ? 'bg-success' : 'bg-secondary'}">${supplier.is_active == 1 ? 'Yes' : 'No'}</span></td>
                    <td class="text-end">${actionsHtml || '<span class="text-muted">View Only</span>'}</td>
                `;
            });
            addTableButtonListeners();
        } else {
            suppliersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">Error loading suppliers.</td></tr>`;
        }
    }

    async function handleSaveSupplier(event) {
        event.preventDefault();
        const data = {
            supplier_id: supplierIdInput.value,
            supplier_name: supplierNameInput.value.trim(),
            contact_person: contactPersonInput.value.trim(),
            email: emailInput.value.trim(),
            phone: phoneInput.value.trim(),
            payment_terms: paymentTermsInput.value.trim(),
            tax_id: taxIdInput.value.trim(),
            is_active: isActiveCheckbox.checked
        };

        if (!data.supplier_name) {
            showMessageBox('Supplier Name is required.', 'error');
            return;
        }

        const isUpdating = !!data.supplier_id;
        const method = isUpdating ? 'PUT' : 'POST';
        
        saveSupplierBtn.disabled = true;
        saveSupplierBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const result = await fetchData('api/suppliers.php', method, data);
        
        if (result?.success) {
            showMessageBox(result.message, 'success');
            resetSupplierForm();
            await loadSuppliers();
        }

        saveSupplierBtn.disabled = false;
        saveSupplierBtn.textContent = 'Save Supplier';
    }

    async function handleEditSupplier(event) {
        const id = event.target.closest('button').dataset.id;
        const response = await fetchData(`api/suppliers.php?id=${id}`);
        if (response?.success) {
            const supplier = response.data;
            supplierIdInput.value = supplier.supplier_id;
            supplierNameInput.value = supplier.supplier_name;
            contactPersonInput.value = supplier.contact_person;
            emailInput.value = supplier.email;
            phoneInput.value = supplier.phone;
            paymentTermsInput.value = supplier.payment_terms;
            taxIdInput.value = supplier.tax_id;
            isActiveCheckbox.checked = supplier.is_active == 1;

            supplierFormTitle.textContent = 'Edit Supplier';
            saveSupplierBtn.textContent = 'Update Supplier';
            cancelEditBtn.classList.remove('d-none');
        }
    }

    function handleDeleteSupplier(event) {
        const id = event.target.closest('button').dataset.id;
        showConfirmationModal(
            'Delete Supplier',
            'Are you sure you want to delete this supplier? This may fail if they have existing inbound receipts.',
            async () => {
                const result = await fetchData(`api/suppliers.php?id=${id}`, 'DELETE');
                if (result?.success) {
                    showMessageBox('Supplier deleted successfully!', 'success');
                    await loadSuppliers();
                    resetSupplierForm();
                }
            }
        );
    }

    function resetSupplierForm() {
        supplierForm.reset();
        supplierIdInput.value = '';
        isActiveCheckbox.checked = true;
        supplierFormTitle.textContent = 'Add New Supplier';
        saveSupplierBtn.textContent = 'Save Supplier';
        cancelEditBtn.classList.add('d-none');
    }

    function addTableButtonListeners() {
        document.querySelectorAll('.edit-btn').forEach(button => button.addEventListener('click', handleEditSupplier));
        document.querySelectorAll('.delete-btn').forEach(button => button.addEventListener('click', handleDeleteSupplier));
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
