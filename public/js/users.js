document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const usersTableBody = document.getElementById('usersTableBody');
    const addUserBtn = document.getElementById('addUserBtn');
    const userFormContainer = document.getElementById('userFormContainer');
    const croppieModalContainer = document.getElementById('croppieModalContainer');

    // --- State Management ---
    let availableWarehouses = [];
    let availableRoles = [];
    let isDataLoaded = false;
    let croppieInstance = null;
    // The cropped image data will now be stored on the preview element itself, not in a global variable.

    // --- Initial Data Loading ---
    const initializePage = async () => {
        if (isDataLoaded) return;
        usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        await Promise.all([loadUsers(), loadWarehouses(), loadRoles()]);
        isDataLoaded = true;
    };

    const loadUsers = async () => {
        const result = await fetchData('api/users_api.php?action=get_users');
        if (result && result.success) {
            renderUsersTable(result.users);
        } else {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-4">Failed to load users.</td></tr>';
        }
    };

    const loadWarehouses = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_warehouses');
        if (result && result.success) availableWarehouses = result.warehouses;
    };

    const loadRoles = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_roles');
        if (result && result.success) availableRoles = result.roles;
    };

    // --- UI Rendering & Helpers ---
    const renderUsersTable = (users) => {
        usersTableBody.innerHTML = '';
        if (users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No users found.</td></tr>';
            return;
        }
        users.forEach(user => {
            const rolesHtml = user.warehouse_roles
                ? user.warehouse_roles.split(';').map(role => `<span class="badge bg-secondary me-1 mb-1">${role.replace(':', ': ')}</span>`).join('')
                : (user.is_global_admin ? '<span class="badge bg-info">All Access</span>' : '<span class="badge bg-light text-dark">None</span>');
            const profileImage = user.profile_image_url || 'assets/images/default-user.png';
            
            // FIX: Corrected the onerror handler to prevent reload loops.
            // It now points to the correct default image and includes a safeguard (this.onerror=null;)
            // to ensure the event only fires once if the default image is also missing.
            const row = `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${profileImage}" class="rounded-circle me-3" alt="${user.full_name}" style="width: 45px; height: 45px; object-fit: cover;" onerror="this.onerror=null; this.src='assets/images/default-user.png';">
                            <div class="fw-bold">${user.full_name}</div>
                        </div>
                    </td>
                    <td>${user.username}</td>
                    <td>${user.is_global_admin ? '<span class="badge bg-success">Yes</span>' : 'No'}</td>
                    <td>${rolesHtml}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-2" onclick="openUserForm(${user.user_id})"><i class="bi bi-pencil"></i> Edit</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteUser(${user.user_id}, '${user.username}')"><i class="bi bi-trash"></i> Delete</button>
                    </td>
                </tr>`;
            usersTableBody.insertAdjacentHTML('beforeend', row);
        });
    };

    const renderAssignedRolesInSwal = (rolesToRender) => {
        const list = Swal.getPopup()?.querySelector('#assignedRolesList');
        if (!list) return;
        list.innerHTML = rolesToRender.length === 0 ? '<li class="list-group-item text-muted">No roles assigned.</li>'
            : rolesToRender.map((role, index) => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-building me-2"></i><strong>${role.warehouse_name}</strong> as <span class="badge bg-primary">${role.role}</span></span>
                    <button type="button" class="btn-close" aria-label="Remove" data-index="${index}"></button>
                </li>`).join('');
        list.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', e => {
                rolesToRender.splice(parseInt(e.target.dataset.index), 1);
                renderAssignedRolesInSwal(rolesToRender);
            });
        });
    };

    const setupPasswordToggle = (toggleBtnId, passwordInputId) => {
        const btn = Swal.getPopup()?.querySelector(`#${toggleBtnId}`);
        const input = Swal.getPopup()?.querySelector(`#${passwordInputId}`);
        if (btn && input) {
            btn.addEventListener('click', () => {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                btn.querySelector('i').classList.toggle('bi-eye', type === 'password');
                btn.querySelector('i').classList.toggle('bi-eye-slash', type !== 'password');
            });
        }
    };

    /**
     * Opens a dedicated modal for Croppie.
     * @param {File} file - The image file selected by the user.
     * @returns {Promise<string|null>} A promise that resolves with the Base64 cropped image data, or null if cancelled.
     */
    const openCroppieModal = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                Swal.fire({
                    title: 'Crop Your Image',
                    html: croppieModalContainer.innerHTML,
                    width: 'auto',
                    showCancelButton: true,
                    confirmButtonText: 'Crop & Save',
                    didOpen: () => {
                        const editor = Swal.getPopup().querySelector('#croppieEditor');
                        croppieInstance = new Croppie(editor, {
                            viewport: { width: 200, height: 200, type: 'circle' },
                            boundary: { width: 300, height: 300 },
                            enableExif: true
                        });
                        croppieInstance.bind({ url: event.target.result });
                    },
                    willClose: () => {
                        if (croppieInstance) {
                            croppieInstance.destroy();
                            croppieInstance = null;
                        }
                    },
                    preConfirm: async () => {
                        return await croppieInstance.result({
                            type: 'base64',
                            size: 'viewport',
                            format: 'jpeg',
                            quality: 0.9
                        });
                    }
                }).then(result => {
                    resolve(result.isConfirmed ? result.value : null);
                });
            };
            reader.readAsDataURL(file);
        });
    };

    // --- Main Form Logic ---
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserForm());
    }

    const openUserForm = async (userId = null) => {
        await initializePage();

        const isEditing = userId !== null;
        let localAssignedRoles = [];
        let userDataForEdit = null;

        if (isEditing) {
            const result = await fetchData(`api/users_api.php?action=get_user_details&user_id=${userId}`);
            if (!result || !result.success) return Swal.fire('Error', 'Could not fetch user details.', 'error');
            userDataForEdit = result.user;
            localAssignedRoles = userDataForEdit.warehouse_roles.map(role => ({
                ...role,
                warehouse_name: availableWarehouses.find(w => w.warehouse_id == role.warehouse_id)?.warehouse_name || 'Unknown'
            }));
        }

        Swal.fire({
            title: isEditing ? 'Edit User' : 'Add New User',
            html: userFormContainer.innerHTML,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: isEditing ? 'Save Changes' : 'Create User',
            customClass: { popup: 'p-4' },
            didOpen: () => {
                const popup = Swal.getPopup();
                const profileImageInput = popup.querySelector('#profileImage');
                const profileImagePreview = popup.querySelector('#profileImagePreview');
                
                // FIX: Store cropped image data on a data attribute of the preview element.
                // This is a reliable way to maintain state between modals.
                profileImagePreview.dataset.imageData = '';

                profileImageInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const newImageData = await openCroppieModal(file);
                        if (newImageData) {
                            profileImagePreview.dataset.imageData = newImageData;
                            profileImagePreview.src = newImageData;
                        }
                        e.target.value = '';
                    }
                });
                
                profileImagePreview.addEventListener('click', () => profileImageInput.click());

                const form = popup.querySelector('#userForm');
                const warehouseSelect = popup.querySelector('#warehouseSelect');
                const roleSelect = popup.querySelector('#roleSelect');
                const isGlobalAdminSwitch = popup.querySelector('#isGlobalAdmin');
                const passwordSection = popup.querySelector('#passwordSection');
                const changePasswordBtnContainer = popup.querySelector('#changePasswordBtnContainer');

                const toggleWarehouseRolesSection = (isAdmin) => {
                    popup.querySelector('#warehouseRolesSection').style.opacity = isAdmin ? '0.5' : '1';
                    popup.querySelectorAll('#warehouseRolesSection select, #warehouseRolesSection button').forEach(c => c.disabled = isAdmin);
                };

                warehouseSelect.innerHTML = availableWarehouses.map(w => `<option value="${w.warehouse_id}">${w.warehouse_name}</option>`).join('');
                roleSelect.innerHTML = availableRoles.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('');
                isGlobalAdminSwitch.addEventListener('change', (e) => toggleWarehouseRolesSection(e.target.checked));

                popup.querySelector('#addRoleBtn').addEventListener('click', () => {
                    const warehouseId = parseInt(warehouseSelect.value);
                    const role = roleSelect.value;
                    const warehouseName = warehouseSelect.options[warehouseSelect.selectedIndex].text;
                    const existing = localAssignedRoles.find(r => r.warehouse_id == warehouseId);
                    if (existing) existing.role = role;
                    else localAssignedRoles.push({ warehouse_id: warehouseId, warehouse_name: warehouseName, role });
                    renderAssignedRolesInSwal(localAssignedRoles);
                });

                if (isEditing) {
                    form.userId.value = userDataForEdit.user_id;
                    form.fullName.value = userDataForEdit.full_name;
                    form.username.value = userDataForEdit.username;
                    isGlobalAdminSwitch.checked = userDataForEdit.is_global_admin;
                    passwordSection.style.display = 'none';
                    changePasswordBtnContainer.style.display = 'block';
                    popup.querySelector('#changePasswordBtn').addEventListener('click', () => openChangePasswordForm(userId));
                    if (userDataForEdit.profile_image_url) profileImagePreview.src = userDataForEdit.profile_image_url;
                } else {
                    passwordSection.style.display = 'block';
                    changePasswordBtnContainer.style.display = 'none';
                    form.password.required = true;
                    form.confirm_password.required = true;
                    setupPasswordToggle('togglePassword', 'password');
                    setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');
                }
                toggleWarehouseRolesSection(isGlobalAdminSwitch.checked);
                renderAssignedRolesInSwal(localAssignedRoles);
            },
            preConfirm: async () => {
                const form = Swal.getPopup().querySelector('#userForm');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const profileImagePreview = form.querySelector('#profileImagePreview');

                const data = {
                    user_id: formData.get('user_id') ? parseInt(formData.get('user_id')) : null,
                    full_name: formData.get('full_name'),
                    username: formData.get('username'),
                    is_global_admin: formData.get('is_global_admin') === 'on',
                    warehouse_roles: localAssignedRoles,
                    // FIX: Read the image data from the data attribute.
                    profile_image: profileImagePreview.dataset.imageData || null
                };
                if (!isEditing) {
                    data.password = formData.get('password');
                    data.confirm_password = formData.get('confirm_password');
                    if (data.password !== data.confirm_password) {
                        Swal.showValidationMessage('Passwords do not match.');
                        return false;
                    }
                }
                return data;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const action = result.value.user_id ? 'update_user' : 'create_user';
                const apiResult = await fetchData(`api/users_api.php?action=${action}`, 'POST', result.value);
                if (apiResult && apiResult.success) {
                    Swal.fire('Success!', apiResult.message, 'success');
                    loadUsers();
                } else {
                    Swal.fire('Error!', apiResult.message || 'An unknown error occurred.', 'error');
                }
            }
        });
    };

    // Make functions globally accessible for onclick attributes
    window.openUserForm = openUserForm;
    window.handleDeleteUser = (userId, username) => {
        Swal.fire({
            title: 'Confirm Deletion',
            html: `Are you sure you want to delete <strong>${username}</strong>? This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/users_api.php?action=delete_user', 'POST', { user_id: userId });
                if (apiResult && apiResult.success) {
                    Swal.fire('Deleted!', 'The user has been deleted.', 'success');
                    loadUsers();
                } else {
                    Swal.fire('Error!', apiResult.message || 'Failed to delete user.', 'error');
                }
            }
        });
    };

    initializePage();
});
