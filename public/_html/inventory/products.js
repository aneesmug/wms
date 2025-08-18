// public/js/products.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const productForm = document.getElementById('productForm');
    const productFormTitle = document.getElementById('productFormTitle');
    const productIdInput = document.getElementById('productId');
    const productsTableBody = document.getElementById('productsTableBody');
    const saveProductBtn = document.getElementById('saveProductBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Form fields
    const skuInput = document.getElementById('sku');
    const productNameInput = document.getElementById('productName');
    const descriptionInput = document.getElementById('description');
    const unitOfMeasureInput = document.getElementById('unitOfMeasure');
    const weightInput = document.getElementById('weight');
    const volumeInput = document.getElementById('volume');
    const barcodeInput = document.getElementById('barcode');

    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');

    // --- Initialize Page ---
    initializePage();

    // --- Event Listeners ---
    if (productForm) productForm.addEventListener('submit', handleSaveProduct);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetProductForm);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    async function initializePage() {
        const canManageProducts = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        if (productForm) {
            productForm.closest('.card').classList.toggle('d-none', !canManageProducts);
        }
        await loadProducts();
    }

    async function loadProducts() {
        if (!productsTableBody) return;
        productsTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">Loading products...</td></tr>`;

        const response = await fetchData('api/products.php');
        productsTableBody.innerHTML = '';

        if (response?.success && Array.isArray(response.data)) {
            if (response.data.length === 0) {
                productsTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">No products found.</td></tr>`;
                return;
            }

            const canEdit = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
            const canDelete = currentWarehouseRole === 'manager';

            response.data.forEach(product => {
                const row = productsTableBody.insertRow();
                let actionsHtml = '';
                if (canEdit) {
                    actionsHtml += `<button data-id="${product.product_id}" class="btn btn-sm btn-outline-primary edit-btn me-2" title="Edit"><i class="bi bi-pencil"></i></button>`;
                }
                if (canDelete) {
                    actionsHtml += `<button data-id="${product.product_id}" class="btn btn-sm btn-outline-danger delete-btn" title="Delete"><i class="bi bi-trash"></i></button>`;
                }

                row.innerHTML = `
                    <td>${product.sku}</td>
                    <td>${product.product_name}</td>
                    <td>${product.barcode || 'N/A'}</td>
                    <td>${product.unit_of_measure || 'N/A'}</td>
                    <td class="text-end">${actionsHtml || '<span class="text-muted">View Only</span>'}</td>
                `;
            });
            addTableButtonListeners();
        } else {
            productsTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">Error loading products.</td></tr>`;
        }
    }

    async function handleSaveProduct(event) {
        event.preventDefault();
        const data = {
            product_id: productIdInput.value,
            sku: skuInput.value.trim(),
            product_name: productNameInput.value.trim(),
            description: descriptionInput.value.trim(),
            unit_of_measure: unitOfMeasureInput.value.trim(),
            weight: weightInput.value.trim(),
            volume: volumeInput.value.trim(),
            barcode: barcodeInput.value.trim()
        };

        if (!data.sku || !data.product_name) {
            showMessageBox('SKU and Product Name are required.', 'error');
            return;
        }

        const isUpdating = !!data.product_id;
        const method = isUpdating ? 'PUT' : 'POST';
        
        saveProductBtn.disabled = true;
        saveProductBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const result = await fetchData('api/products.php', method, data);
        
        if (result?.success) {
            showMessageBox(result.message, 'success');
            resetProductForm();
            await loadProducts();
        }

        saveProductBtn.disabled = false;
        saveProductBtn.textContent = 'Save Product';
    }

    async function handleEditProduct(event) {
        const id = event.target.closest('button').dataset.id;
        const response = await fetchData(`api/products.php?id=${id}`);
        if (response?.success) {
            const product = response.data;
            productIdInput.value = product.product_id;
            skuInput.value = product.sku;
            productNameInput.value = product.product_name;
            descriptionInput.value = product.description;
            unitOfMeasureInput.value = product.unit_of_measure;
            weightInput.value = product.weight;
            volumeInput.value = product.volume;
            barcodeInput.value = product.barcode;

            productFormTitle.textContent = 'Edit Product';
            saveProductBtn.textContent = 'Update Product';
            cancelEditBtn.classList.remove('d-none');
        }
    }

    function handleDeleteProduct(event) {
        const id = event.target.closest('button').dataset.id;
        showConfirmationModal(
            'Delete Product',
            'Are you sure you want to delete this product? This action cannot be undone and may fail if the product is in use.',
            async () => {
                const result = await fetchData(`api/products.php?id=${id}`, 'DELETE');
                if (result?.success) {
                    showMessageBox('Product deleted successfully!', 'success');
                    await loadProducts();
                    resetProductForm();
                }
            }
        );
    }

    function resetProductForm() {
        productForm.reset();
        productIdInput.value = '';
        productFormTitle.textContent = 'Add New Product';
        saveProductBtn.textContent = 'Save Product';
        cancelEditBtn.classList.add('d-none');
    }

    function addTableButtonListeners() {
        document.querySelectorAll('.edit-btn').forEach(button => button.addEventListener('click', handleEditProduct));
        document.querySelectorAll('.delete-btn').forEach(button => button.addEventListener('click', handleDeleteProduct));
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
