// public/js/locations.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables ---
    let locationsDataTable;
    let locationTypes = []; // To store the types fetched from the DB
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    // --- DOM Elements ---
    const logoutBtn = document.getElementById('logoutBtn');
    const addNewLocationBtn = document.getElementById('addNewLocationBtn');
    const locationsTableBody = document.getElementById('locationsTableBody');
    const locationTypeFilter = document.getElementById('locationTypeFilter');

    // --- Event Listeners ---
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (addNewLocationBtn) addNewLocationBtn.addEventListener('click', () => openLocationModal());
    if (locationTypeFilter) locationTypeFilter.addEventListener('change', applyTypeFilter);
    if (locationsTableBody) locationsTableBody.addEventListener('click', handleTableButtonClick);

    // --- Initial Page Load ---
    initializePage();

    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire({
                title: 'No Warehouse Selected',
                text: 'Please select a warehouse on the Dashboard.',
                icon: 'warning',
                confirmButtonText: 'Go to Dashboard'
            }).then(() => { window.location.href = 'dashboard.html'; });
            if (addNewLocationBtn) addNewLocationBtn.style.display = 'none';
            if (locationTypeFilter) locationTypeFilter.parentElement.style.display = 'none';
            return;
        }

        const canManage = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        if (addNewLocationBtn) {
            addNewLocationBtn.style.display = canManage ? 'block' : 'none';
        }

        await populateTypeFilter();
        await loadLocations();
    }

    async function populateTypeFilter() {
        if (!locationTypeFilter) return;

        const response = await fetchData('api/locations_api.php?action=get_types');

        if (response?.success && Array.isArray(response.data)) {
            locationTypes = response.data; // Store for later use in modals
            locationTypeFilter.innerHTML = '<option value="">All Types</option>';
            locationTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.type_name; // Filter by name
                option.textContent = type.type_name.charAt(0).toUpperCase() + type.type_name.slice(1).replace(/_/g, ' ');
                locationTypeFilter.appendChild(option);
            });
        }
    }

    async function loadLocations() {
        if (!currentWarehouseId) return;
        const response = await fetchData('api/locations_api.php');
        if (locationsDataTable) { locationsDataTable.destroy(); }
        locationsTableBody.innerHTML = '';

        if (response?.success && Array.isArray(response.data)) {
            const canEdit = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
            const canDelete = currentWarehouseRole === 'manager';

            response.data.forEach(location => {
                const row = document.createElement('tr');
                let actionsHtml = '<div class="text-end">';
                if (canEdit) actionsHtml += `<button data-id="${location.location_id}" class="btn btn-sm btn-outline-primary edit-btn" title="Edit"><i class="bi bi-pencil"></i></button>`;
                if (canDelete) actionsHtml += `<button data-id="${location.location_id}" class="btn btn-sm btn-outline-danger delete-btn ms-2" title="Delete"><i class="bi bi-trash"></i></button>`;
                if (!canEdit && !canDelete) actionsHtml += '<span class="text-muted">View Only</span>';
                actionsHtml += '</div>';

                row.innerHTML = `
                    <td>${location.location_code}</td>
                    <td>${location.location_type || 'N/A'}</td>
                    <td>${location.max_capacity_units || 'N/A'}</td>
                    <td>${location.occupied_capacity || '0'}</td>
                    <td>${location.available_capacity !== null ? location.available_capacity : 'N/A'}</td>
                    <td><span class="badge ${location.is_full ? 'bg-danger' : 'bg-success'}">${location.is_full ? 'Yes' : 'No'}</span></td>
                    <td><span class="badge ${location.is_active == 1 ? 'bg-success' : 'bg-secondary'}">${location.is_active == 1 ? 'Yes' : 'No'}</span></td>
                    <td>${actionsHtml}</td>`;
                locationsTableBody.appendChild(row);
            });
        }
        locationsDataTable = new DataTable('#locationsDataTable', { responsive: true, order: [[0, 'asc']] });
    }
    
    function applyTypeFilter() {
        const selectedType = locationTypeFilter.value;
        locationsDataTable.column(1).search(selectedType ? '^' + selectedType + '$' : '', true, false).draw();
    }

    function handleTableButtonClick(event) {
        const button = event.target.closest('button');
        if (!button) return;
        const locationId = button.dataset.id;
        if (button.classList.contains('edit-btn')) {
            openLocationModal(locationId);
        } else if (button.classList.contains('delete-btn')) {
            handleDeleteClick(locationId);
        }
    }

    async function openLocationModal(locationId = null) {
        const isUpdating = !!locationId;
        let locationData = {};

        if (isUpdating) {
            const response = await fetchData(`api/locations_api.php?id=${locationId}`);
            if (response?.success) {
                locationData = response.data;
            } else {
                return Swal.fire('Error', 'Could not fetch location details.', 'error');
            }
        }

        // Generate the dropdown options from the fetched types
        const typeOptions = locationTypes.map(type => 
            `<option value="${type.type_id}" ${isUpdating && type.type_id == locationData.location_type_id ? 'selected' : ''}>
                ${type.type_name.charAt(0).toUpperCase() + type.type_name.slice(1).replace(/_/g, ' ')}
            </option>`
        ).join('');

        Swal.fire({
            title: isUpdating ? 'Edit Location' : 'Add New Location',
            html: `
                <form id="swalLocationForm" class="text-start">
                    <div class="mb-3">
                        <label for="swalLocationCode" class="form-label">Location Code*</label>
                        <input type="text" id="swalLocationCode" class="form-control" value="${locationData.location_code || ''}" required>
                    </div>
                    <div class="mb-3">
                        <label for="swalLocationType" class="form-label">Location Type</label>
                        <select id="swalLocationType" class="form-select">${typeOptions}</select>
                    </div>
                    <div class="mb-3">
                        <label for="swalMaxCapacityUnits" class="form-label">Max Capacity (Units)</label>
                        <input type="number" step="1" id="swalMaxCapacityUnits" min="0" class="form-control" value="${locationData.max_capacity_units || ''}">
                    </div>
                    <div class="mb-3">
                        <label for="swalMaxCapacityWeight" class="form-label">Max Capacity (Weight, kg)</label>
                        <input type="number" step="0.01" id="swalMaxCapacityWeight" min="0" class="form-control" value="${locationData.max_capacity_weight || ''}">
                    </div>
                    <div class="mb-3">
                        <label for="swalMaxCapacityVolume" class="form-label">Max Capacity (Volume, m³)</label>
                        <input type="number" step="0.01" id="swalMaxCapacityVolume" min="0" class="form-control" value="${locationData.max_capacity_volume || ''}">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="swalIsActive" ${isUpdating ? (locationData.is_active == 1 ? 'checked' : '') : 'checked'}>
                        <label class="form-check-label" for="swalIsActive">Is Active</label>
                    </div>
                </form>`,
            showCancelButton: true,
            confirmButtonText: isUpdating ? 'Update' : 'Save',
            preConfirm: () => {
                const locationCode = document.getElementById('swalLocationCode').value;
                if (!locationCode) {
                    Swal.showValidationMessage('Location Code is required');
                    return false;
                }
                return {
                    location_id: locationId,
                    location_code: locationCode.trim(),
                    location_type_id: document.getElementById('swalLocationType').value,
                    max_capacity_units: document.getElementById('swalMaxCapacityUnits').value || null,
                    max_capacity_weight: document.getElementById('swalMaxCapacityWeight').value || null,
                    max_capacity_volume: document.getElementById('swalMaxCapacityVolume').value || null,
                    is_active: document.getElementById('swalIsActive').checked,
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const saveResult = await fetchData('api/locations_api.php', isUpdating ? 'PUT' : 'POST', result.value);
                if (saveResult?.success) {
                    await Swal.fire('Success!', saveResult.message, 'success');
                    await initializePage();
                } else {
                    Swal.fire('Error!', saveResult?.message || 'Failed to save location.', 'error');
                }
            }
        });
    }

    function handleDeleteClick(locationId) {
        Swal.fire({
            title: 'Are you sure?',
            text: "This action cannot be undone!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const deleteResult = await fetchData(`api/locations_api.php?id=${locationId}`, 'DELETE');
                if (deleteResult?.success) {
                    await Swal.fire('Deleted!', 'The location has been deleted.', 'success');
                    await initializePage();
                } else {
                    Swal.fire('Failed!', deleteResult?.message || 'Could not delete the location.', 'error');
                }
            }
        });
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
