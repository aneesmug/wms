// public/js/locations.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables ---
    let locationsDataTable;
    let locationTypesDataTable;
    let locationTypes = []; 
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    // --- DOM Elements ---
    const addNewLocationBtn = document.getElementById('addNewLocationBtn');
    const addNewLocationTypeBtn = document.getElementById('addNewLocationTypeBtn');
    const locationsTableBody = document.getElementById('locationsTableBody');
    const locationTypesTableBody = document.getElementById('locationTypesTableBody');
    const locationTypeFilter = document.getElementById('locationTypeFilter');

    // --- Event Listeners ---
    if (addNewLocationBtn) addNewLocationBtn.addEventListener('click', () => openLocationModal());
    if (addNewLocationTypeBtn) addNewLocationTypeBtn.addEventListener('click', () => openLocationTypeModal());
    if (locationTypeFilter) locationTypeFilter.addEventListener('change', applyTypeFilter);
    if (locationsTableBody) locationsTableBody.addEventListener('click', handleTableButtonClick);
    if (locationTypesTableBody) locationTypesTableBody.addEventListener('click', handleTypeTableButtonClick);

    // --- Initial Page Load ---
    initializePage();

    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire({
                title: 'No Warehouse Selected',
                text: 'Please select a warehouse on the Dashboard.',
                icon: 'warning',
                confirmButtonText: 'Go to Dashboard',
                allowOutsideClick: false,
            }).then(() => { window.location.href = 'dashboard.php'; });
            if (addNewLocationBtn) addNewLocationBtn.style.display = 'none';
            if (addNewLocationTypeBtn) addNewLocationTypeBtn.style.display = 'none';
            if (locationTypeFilter) locationTypeFilter.parentElement.style.display = 'none';
            return;
        }

        const canManageLocations = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
        const isManager = currentWarehouseRole === 'manager';

        if (addNewLocationBtn) {
            addNewLocationBtn.style.display = canManageLocations ? 'block' : 'none';
        }
        if (addNewLocationTypeBtn) {
            addNewLocationTypeBtn.style.display = isManager ? 'block' : 'none';
        }

        await loadLocationTypes();
        await populateTypeFilter();
        await loadLocations();
    }
    
    async function loadLocationTypes() {
        const response = await fetchData('api/locations_api.php?action=get_types');
        if (locationTypesDataTable) { locationTypesDataTable.destroy(); }
        locationTypesTableBody.innerHTML = '';

        if (response?.success && Array.isArray(response.data)) {
            locationTypes = response.data;
            const isManager = currentWarehouseRole === 'manager';

            locationTypes.forEach(type => {
                const row = document.createElement('tr');
                let actionsHtml = '<div class="text-end">';
                if (isManager) {
                    actionsHtml += `<button data-id="${type.type_id}" class="btn btn-sm btn-outline-primary edit-type-btn" title="Edit"><i class="bi bi-pencil"></i></button>`;
                    actionsHtml += `<button data-id="${type.type_id}" class="btn btn-sm btn-outline-danger delete-type-btn ms-2" title="Delete"><i class="bi bi-trash"></i></button>`;
                } else {
                    actionsHtml += '<span class="text-muted">View Only</span>';
                }
                actionsHtml += '</div>';

                row.innerHTML = `
                    <td>${type.type_name}</td>
                    <td>${type.type_description || 'N/A'}</td>
                    <td>${actionsHtml}</td>`;
                locationTypesTableBody.appendChild(row);
            });
        }
        locationTypesDataTable = new DataTable('#locationTypesDataTable', { responsive: true, order: [[0, 'asc']] });
    }

    async function populateTypeFilter() {
        if (!locationTypeFilter) return;
        locationTypeFilter.innerHTML = '<option value="">All Types</option>';
        locationTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.type_name;
            option.textContent = type.type_name.charAt(0).toUpperCase() + type.type_name.slice(1).replace(/_/g, ' ');
            locationTypeFilter.appendChild(option);
        });
    }

    async function loadLocations() {
        if (!currentWarehouseId) return;
        const response = await fetchData('api/locations_api.php');
        if (locationsDataTable) { locationsDataTable.destroy(); }
        locationsTableBody.innerHTML = '';

        if (response?.success && Array.isArray(response.data)) {
            const canEdit = currentWarehouseRole === 'operator' || currentWarehouseRole === 'manager';
            const isManager = currentWarehouseRole === 'manager';

            response.data.forEach(location => {
                const row = document.createElement('tr');
                let actionsHtml = '<div class="text-end">';
                if (isManager) {
                    const lockIcon = location.is_locked == 1 ? 'bi-unlock-fill' : 'bi-lock-fill';
                    const lockTitle = location.is_locked == 1 ? 'Unlock' : 'Lock';
                    const lockBtnClass = location.is_locked == 1 ? 'btn-outline-success' : 'btn-outline-warning';
                    actionsHtml += `<button data-id="${location.location_id}" data-locked="${location.is_locked}" class="btn btn-sm ${lockBtnClass} lock-btn" title="${lockTitle}"><i class="bi ${lockIcon}"></i></button>`;
                }
                if (canEdit) actionsHtml += `<button data-id="${location.location_id}" class="btn btn-sm btn-outline-primary edit-btn ms-2" title="Edit"><i class="bi bi-pencil"></i></button>`;
                if (isManager) actionsHtml += `<button data-id="${location.location_id}" class="btn btn-sm btn-outline-danger delete-btn ms-2" title="Delete"><i class="bi bi-trash"></i></button>`;
                if (!canEdit && !isManager) actionsHtml += '<span class="text-muted">View Only</span>';
                actionsHtml += '</div>';

                row.innerHTML = `
                    <td>${location.location_code}</td>
                    <td>${location.location_type || 'N/A'}</td>
                    <td>${location.max_capacity_units || 'N/A'}</td>
                    <td>${location.occupied_capacity || '0'}</td>
                    <td>${location.available_capacity !== null ? location.available_capacity : 'N/A'}</td>
                    <td><span class="badge ${location.is_full ? 'bg-danger' : 'bg-success'}">${location.is_full ? 'Yes' : 'No'}</span></td>
                    <td><span class="badge ${location.is_active == 1 ? 'bg-success' : 'bg-secondary'}">${location.is_active == 1 ? 'Active' : 'Inactive'}</span></td>
                    <td><span class="badge ${location.is_locked == 1 ? 'bg-danger' : 'bg-success'}">${location.is_locked == 1 ? 'Locked' : 'Unlocked'}</span></td>
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
        } else if (button.classList.contains('lock-btn')) {
            const isLocked = button.dataset.locked == 1;
            handleToggleLock(locationId, !isLocked);
        }
    }
    
    function handleTypeTableButtonClick(event) {
        const button = event.target.closest('button');
        if (!button) return;
        const typeId = button.dataset.id;
        if (button.classList.contains('edit-type-btn')) {
            openLocationTypeModal(typeId);
        } else if (button.classList.contains('delete-type-btn')) {
            handleDeleteTypeClick(typeId);
        }
    }

    function handleToggleLock(locationId, lockStatus) {
        const action = lockStatus ? 'lock' : 'unlock';
        Swal.fire({
            title: `Confirm ${action}`,
            text: `Are you sure you want to ${action} this location? This will prevent all inventory movements.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: `Yes, ${action} it!`,
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/locations_api.php?action=toggle_lock', 'PUT', {
                    location_id: locationId,
                    is_locked: lockStatus
                });
                if (response.success) {
                    Swal.fire('Success!', response.message, 'success');
                    await loadLocations();
                } else {
                    Swal.fire('Error!', response.message || 'Failed to update lock status.', 'error');
                }
            }
        });
    }

    function openLocationTypeModal(typeId = null) {
        const isUpdating = !!typeId;
        const typeData = isUpdating ? locationTypes.find(t => t.type_id == typeId) : null;

        Swal.fire({
            title: isUpdating ? 'Edit Location Type' : 'Add New Location Type',
            html: `
                <form id="swalLocationTypeForm" class="text-start">
                    <div class="mb-3">
                        <label for="swalTypeName" class="form-label">Type Name*</label>
                        <input type="text" id="swalTypeName" class="form-control" value="${typeData ? typeData.type_name : ''}" required>
                    </div>
                    <div class="mb-3">
                        <label for="swalTypeDescription" class="form-label">Description</label>
                        <textarea id="swalTypeDescription" class="form-control" rows="3">${typeData ? typeData.type_description : ''}</textarea>
                    </div>
                </form>`,
            showCancelButton: true,
            confirmButtonText: isUpdating ? 'Update' : 'Save',
            allowOutsideClick: false,
            preConfirm: () => {
                const typeName = document.getElementById('swalTypeName').value;
                if (!typeName) {
                    Swal.showValidationMessage('Type Name is required');
                    return false;
                }
                return {
                    type_id: typeId,
                    type_name: typeName.trim(),
                    type_description: document.getElementById('swalTypeDescription').value.trim(),
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const url = isUpdating ? `api/locations_api.php?action=update_type` : `api/locations_api.php?action=create_type`;
                const method = isUpdating ? 'PUT' : 'POST';
                const saveResult = await fetchData(url, method, result.value);

                if (saveResult?.success) {
                    await Swal.fire('Success!', saveResult.message, 'success');
                    await initializePage();
                } else {
                    Swal.fire('Error!', saveResult?.message || 'Failed to save location type.', 'error');
                }
            }
        });
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

        /*const typeOptions = locationTypes.map(type => 
            `<option value="${type.type_id}" ${isUpdating && type.type_id == locationData.location_type_id ? 'selected' : ''}>
                ${type.type_name.charAt(0).toUpperCase() + type.type_name.slice(1).replace(/_/g, ' ')}
            </option>`
        ).join('');*/

        const typeOptions = locationTypes.map(type => 
            `<option value="${type.type_id}" ${(isUpdating ? type.type_id == locationData.location_type_id : type.type_id == 2) ? 'selected' : ''}>
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
                        <input type="text" step="1" id="swalMaxCapacityUnits" min="0" class="form-control numeric-only" value="${locationData.max_capacity_units || '36'}">
                    </div>
                    <div class="mb-3">
                        <label for="swalMaxCapacityWeight" class="form-label">Max Capacity (Weight, kg)</label>
                        <input type="text" step="0.01" id="swalMaxCapacityWeight" min="0" class="form-control numeric-only" value="${locationData.max_capacity_weight || ''}">
                    </div>
                    <div class="mb-3">
                        <label for="swalMaxCapacityVolume" class="form-label">Max Capacity (Volume, m³)</label>
                        <input type="text" step="0.01" id="swalMaxCapacityVolume" min="0" class="form-control" value="${locationData.max_capacity_volume || ''}">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="swalIsActive" ${isUpdating ? (locationData.is_active == 1 ? 'checked' : '') : 'checked'}>
                        <label class="form-check-label" for="swalIsActive">Is Active</label>
                    </div>
                </form>`,
            showCancelButton: true,
            confirmButtonText: isUpdating ? 'Update' : 'Save',
            allowOutsideClick: false,
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
                const url = isUpdating ? 'api/locations_api.php?action=update_location' : 'api/locations_api.php';
                const saveResult = await fetchData(url, isUpdating ? 'PUT' : 'POST', result.value);
                if (saveResult?.success) {
                    await Swal.fire('Success!', saveResult.message, 'success');
                    await initializePage();
                } else {
                    Swal.fire('Error!', saveResult?.message || 'Failed to save location.', 'error');
                }
            }
        });
    }
    
    function handleDeleteTypeClick(typeId) {
        Swal.fire({
            title: 'Are you sure?',
            text: "Deleting this type will also affect locations using it. This action cannot be undone!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const deleteResult = await fetchData(`api/locations_api.php?action=delete_type`, 'DELETE', {id: typeId});
                if (deleteResult?.success) {
                    await Swal.fire('Deleted!', 'The location type has been deleted.', 'success');
                    await initializePage();
                } else {
                    Swal.fire('Failed!', deleteResult?.message || 'Could not delete the location type.', 'error');
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
            confirmButtonText: 'Yes, delete it!',
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const deleteResult = await fetchData(`api/locations_api.php?action=delete_location`, 'DELETE', {id: locationId});
                if (deleteResult?.success) {
                    await Swal.fire('Deleted!', 'The location has been deleted.', 'success');
                    await initializePage();
                } else {
                    Swal.fire('Failed!', deleteResult?.message || 'Could not delete the location.', 'error');
                }
            }
        });
    }
});
