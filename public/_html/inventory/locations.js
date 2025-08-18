// public/js/locations.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const locationForm = document.getElementById('locationForm');
    const locationFormTitle = document.getElementById('locationFormTitle');
    const locationIdInput = document.getElementById('locationId');
    const locationsTableBody = document.getElementById('locationsTableBody');
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // --- Form Fields ---
    const locationCodeInput = document.getElementById('locationCode');
    const locationTypeSelect = document.getElementById('locationType');
    const maxCapacityUnitsInput = document.getElementById('maxCapacityUnits');
    const maxCapacityWeightInput = document.getElementById('maxCapacityWeight');
    const maxCapacityVolumeInput = document.getElementById('maxCapacityVolume');
    const isActiveCheckbox = document.getElementById('isActive');

    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    // --- Event Listeners ---
    if (locationForm) locationForm.addEventListener('submit', handleSaveLocation);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetLocationForm);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // --- Initial Page Load ---
    initializePage();

    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            showMessageBox('Please select a warehouse on the Dashboard to manage locations.', 'warning', 5000);
            if(locationsTableBody) locationsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">Please select a warehouse on the Dashboard.</td></tr>`;
            if (locationForm) locationForm.closest('.card').classList.add('d-none');
            return;
        }

        const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        
        if (locationForm) {
            locationForm.closest('.card').classList.toggle('d-none', !canManage);
        }
        
        await loadLocations();
    }

    async function loadLocations() {
        if (!locationsTableBody || !currentWarehouseId) return;
        locationsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">Loading locations...</td></tr>`;

        const response = await fetchData('api/locations.php');
        locationsTableBody.innerHTML = '';
        
        if (response?.success && Array.isArray(response.data)) {
            if (response.data.length === 0) {
                locationsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No locations found for this warehouse.</td></tr>`;
                return;
            }

            const canEdit = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
            const canDelete = currentWarehouseRole === 'manager';

            response.data.forEach(location => {
                const row = locationsTableBody.insertRow();
                const fullnessClass = location.is_full ? 'table-danger' : '';
                
                let actionsHtml = '';
                if (canEdit) {
                    actionsHtml += `<button data-id="${location.location_id}" class="btn btn-sm btn-outline-primary edit-btn me-2" title="Edit"><i class="bi bi-pencil"></i></button>`;
                }
                if (canDelete) {
                    actionsHtml += `<button data-id="${location.location_id}" class="btn btn-sm btn-outline-danger delete-btn" title="Delete"><i class="bi bi-trash"></i></button>`;
                }

                row.className = fullnessClass;
                row.innerHTML = `
                    <td>${location.location_code}</td>
                    <td>${location.location_type}</td>
                    <td>${location.max_capacity_units || 'N/A'}</td>
                    <td>${location.occupied_capacity || '0'}</td>
                    <td>${location.available_capacity !== null ? location.available_capacity : 'N/A'}</td>
                    <td><span class="badge ${location.is_full ? 'bg-danger' : 'bg-success'}">${location.is_full ? 'Yes' : 'No'}</span></td>
                    <td><span class="badge ${location.is_active == 1 ? 'bg-success' : 'bg-secondary'}">${location.is_active == 1 ? 'Yes' : 'No'}</span></td>
                    <td class="text-end">${actionsHtml || '<span class="text-muted">View Only</span>'}</td>
                `;
            });
            
            addTableButtonListeners();

        } else {
            locationsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">Error loading locations.</td></tr>`;
        }
    }

    async function handleSaveLocation(event) {
        event.preventDefault();
        
        const data = {
            location_id: locationIdInput.value || null,
            location_code: locationCodeInput.value.trim(),
            location_type: locationTypeSelect.value,
            max_capacity_units: maxCapacityUnitsInput.value || null,
            max_capacity_weight: maxCapacityWeightInput.value || null,
            max_capacity_volume: maxCapacityVolumeInput.value || null,
            is_active: isActiveCheckbox.checked,
        };

        if (!data.location_code) {
            showMessageBox('Location Code is required.', 'error');
            return;
        }

        const isUpdating = !!data.location_id;
        const method = isUpdating ? 'PUT' : 'POST';
        
        saveLocationBtn.disabled = true;
        saveLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const result = await fetchData('api/locations.php', method, data);
        
        if (result?.success) {
            showMessageBox(result.message, 'success');
            resetLocationForm();
            await loadLocations();
        }

        saveLocationBtn.disabled = false;
        saveLocationBtn.textContent = isUpdating ? 'Update Location' : 'Save Location';
    }

    async function handleEditClick(event) {
        const id = event.target.closest('button').dataset.id;
        const response = await fetchData(`api/locations.php?id=${id}`);
        if (response?.success) {
            const loc = response.data;
            locationIdInput.value = loc.location_id;
            locationCodeInput.value = loc.location_code;
            locationTypeSelect.value = loc.location_type;
            maxCapacityUnitsInput.value = loc.max_capacity_units;
            maxCapacityWeightInput.value = loc.max_capacity_weight;
            maxCapacityVolumeInput.value = loc.max_capacity_volume;
            isActiveCheckbox.checked = !!parseInt(loc.is_active);

            locationFormTitle.textContent = 'Edit Location';
            saveLocationBtn.textContent = 'Update Location';
            cancelEditBtn.classList.remove('d-none');
        }
    }

    function handleDeleteClick(event) {
        const id = event.target.closest('button').dataset.id;
        showConfirmationModal(
            'Delete Location',
            'Are you sure you want to delete this location? This action cannot be undone and may fail if it contains inventory.',
            async () => {
                const result = await fetchData(`api/locations.php?id=${id}`, 'DELETE');
                if (result?.success) {
                    showMessageBox('Location deleted successfully!', 'success');
                    await loadLocations();
                    resetLocationForm();
                }
            }
        );
    }

    function resetLocationForm() {
        locationForm.reset();
        locationIdInput.value = '';
        isActiveCheckbox.checked = true;
        locationFormTitle.textContent = 'Add New Location';
        saveLocationBtn.textContent = 'Save Location';
        cancelEditBtn.classList.add('d-none');
    }
    
    function addTableButtonListeners() {
        document.querySelectorAll('.edit-btn').forEach(button => button.addEventListener('click', handleEditClick));
        document.querySelectorAll('.delete-btn').forEach(button => button.addEventListener('click', handleDeleteClick));
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
