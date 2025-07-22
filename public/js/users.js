document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const usersTableBody = document.getElementById('usersTableBody');
    const addUserBtn = document.getElementById('addUserBtn');
    const userFormContainer = document.getElementById('userFormContainer');

    // --- State Management ---
    let availableWarehouses = [];
    let availableRoles = [];
    let isDataLoaded = false;

    // --- Initial Data Loading ---
    const initializePage = async () => {
        if (isDataLoaded) return;
        await Promise.all([
            loadUsers(),
            loadWarehouses(),
            loadRoles()
        ]);
        isDataLoaded = true;
    };

    const loadUsers = async () => {
        const result = await fetchData('api/users_api.php?action=get_users');
        if (result && result.success) {
            renderUsersTable(result.users);
        }
    };

    const loadWarehouses = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_warehouses');
        if (result && result.success) {
            availableWarehouses = result.warehouses;
        }
    };

    const loadRoles = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_roles');
        if (result && result.success) {
            availableRoles = result.roles;
        }
    };

    // --- UI Rendering & Helpers ---
    const renderUsersTable = (users) => {
        usersTableBody.innerHTML = '';
        if (users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No users found.</td></tr>';
            return;
        }
        users.forEach(user => {
            const rolesHtml = user.warehouse_roles
                ? user.warehouse_roles.split(';').map(role => {
                    const [warehouse, roleName] = role.split(':');
                    return `<span class="badge bg-secondary me-1">${warehouse}: ${roleName}</span>`;
                  }).join('')
                : (user.is_global_admin ? '<span class="badge bg-info">All Access</span>' : '<span class="badge bg-light text-dark">None</span>');

            const row = `
                <tr>
                    <td>${user.full_name}</td>
                    <td>${user.username}</td>
                    <td>${user.is_global_admin ? '<span class="badge bg-success">Yes</span>' : 'No'}</td>
                    <td>${rolesHtml}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-2" onclick="openUserForm(${user.user_id})">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteUser(${user.user_id}, '${user.username}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
            usersTableBody.insertAdjacentHTML('beforeend', row);
        });
    };
    
    const renderAssignedRolesInSwal = (rolesToRender) => {
        const assignedRolesList = Swal.getPopup()?.querySelector('#assignedRolesList');
        if (!assignedRolesList) return;
        
        assignedRolesList.innerHTML = '';
        if(rolesToRender.length === 0) {
            assignedRolesList.innerHTML = '<li class="list-group-item text-muted">No specific warehouse roles assigned.</li>';
            return;
        }
        rolesToRender.forEach((role, index) => {
            const li = `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-building me-2"></i><strong>${role.warehouse_name}</strong> as <span class="badge bg-primary">${role.role}</span></span>
                    <button type="button" class="btn-close" aria-label="Remove" data-index="${index}"></button>
                </li>
            `;
            assignedRolesList.insertAdjacentHTML('beforeend', li);
        });
        
        assignedRolesList.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.dataset.index);
                rolesToRender.splice(indexToRemove, 1);
                renderAssignedRolesInSwal(rolesToRender);
            });
        });
    };

    const setupPasswordToggle = (toggleBtnId, passwordInputId) => {
        const popup = Swal.getPopup();
        if (!popup) return;
        const toggleButton = popup.querySelector(`#${toggleBtnId}`);
        const passwordInput = popup.querySelector(`#${passwordInputId}`);
        if (!toggleButton || !passwordInput) return;

        toggleButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggleButton.querySelector('i').classList.toggle('bi-eye');
            toggleButton.querySelector('i').classList.toggle('bi-eye-slash');
        });
    };

    // --- Event Handlers & Form Logic ---
    addUserBtn.addEventListener('click', () => openUserForm());

    const openUserForm = async (userId = null) => {
        await initializePage(); // Ensure data is loaded before opening any form

        const isEditing = userId !== null;
        let localAssignedRoles = [];
        let userDataForEdit = null;

        if (isEditing) {
            const result = await fetchData(`api/users_api.php?action=get_user_details&user_id=${userId}`);
            if (!result || !result.success) {
                Swal.fire('Error', 'Could not fetch user details.', 'error');
                return;
            }
            userDataForEdit = result.user;
            localAssignedRoles = await Promise.all(userDataForEdit.warehouse_roles.map(async (role) => {
                const warehouse = availableWarehouses.find(w => w.warehouse_id == role.warehouse_id);
                return { ...role, warehouse_name: warehouse ? warehouse.warehouse_name : 'Unknown Warehouse' };
            }));
        }

        Swal.fire({
            title: isEditing ? 'Edit User' : 'Add New User',
            html: userFormContainer.innerHTML,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: 'Save User',
            customClass: { popup: 'p-4' },
            didOpen: () => {
                const popup = Swal.getPopup();
                const form = popup.querySelector('#userForm');
                const warehouseSelect = popup.querySelector('#warehouseSelect');
                const roleSelect = popup.querySelector('#roleSelect');
                const isGlobalAdminSwitch = popup.querySelector('#isGlobalAdmin');
                const passwordSection = popup.querySelector('#passwordSection');
                const passwordInput = popup.querySelector('#password');
                const confirmPasswordInput = popup.querySelector('#confirmPassword');
                const changePasswordBtnContainer = popup.querySelector('#changePasswordBtnContainer');
                const warehouseRolesSection = popup.querySelector('#warehouseRolesSection');

                const toggleWarehouseRolesSection = (isAdmin) => {
                    warehouseRolesSection.style.opacity = isAdmin ? '0.5' : '1';
                    warehouseRolesSection.querySelectorAll('select, button').forEach(c => c.disabled = isAdmin);
                };
                
                warehouseSelect.innerHTML = availableWarehouses.map(w => `<option value="${w.warehouse_id}">${w.warehouse_name}</option>`).join('');
                roleSelect.innerHTML = availableRoles.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('');
                isGlobalAdminSwitch.addEventListener('change', (e) => toggleWarehouseRolesSection(e.target.checked));
                
                popup.querySelector('#addRoleBtn').addEventListener('click', () => {
                    const warehouseId = parseInt(warehouseSelect.value);
                    const role = roleSelect.value;
                    const selectedOption = warehouseSelect.options[warehouseSelect.selectedIndex];
                    const warehouseName = selectedOption ? selectedOption.text : null;
                    const Toast = Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 3000, timerProgressBar: true });

                    if (!warehouseId || !role || !warehouseName) {
                        Toast.fire({ icon: 'error', title: 'Please select both a warehouse and a role.' });
                        return;
                    }

                    const existingRoleIndex = localAssignedRoles.findIndex(r => r.warehouse_id == warehouseId);

                    if (existingRoleIndex > -1) {
                        localAssignedRoles[existingRoleIndex].role = role;
                        Toast.fire({ icon: 'info', title: `Role updated to "${role}" for ${warehouseName}.` });
                    } else {
                        localAssignedRoles.push({ warehouse_id: warehouseId, warehouse_name: warehouseName, role: role });
                    }
                    
                    renderAssignedRolesInSwal(localAssignedRoles);
                });

                if (isEditing) {
                    form.querySelector('#userId').value = userDataForEdit.user_id;
                    form.querySelector('#fullName').value = userDataForEdit.full_name;
                    form.querySelector('#username').value = userDataForEdit.username;
                    isGlobalAdminSwitch.checked = userDataForEdit.is_global_admin;
                    passwordSection.style.display = 'none';
                    changePasswordBtnContainer.style.display = 'block';
                    passwordInput.removeAttribute('required');
                    confirmPasswordInput.removeAttribute('required');
                    popup.querySelector('#changePasswordBtn').addEventListener('click', () => openChangePasswordForm(userId));
                } else {
                    passwordSection.style.display = 'block';
                    changePasswordBtnContainer.style.display = 'none';
                    passwordInput.setAttribute('required', 'true');
                    confirmPasswordInput.setAttribute('required', 'true');
                    setupPasswordToggle('togglePassword', 'password');
                    setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');
                }
                
                toggleWarehouseRolesSection(isGlobalAdminSwitch.checked);
                renderAssignedRolesInSwal(localAssignedRoles);
            },
            preConfirm: () => {
                const form = Swal.getPopup().querySelector('#userForm');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }
                const formData = new FormData(form);
                const data = {
                    user_id: formData.get('user_id') ? parseInt(formData.get('user_id')) : null,
                    full_name: formData.get('full_name'),
                    username: formData.get('username'),
                    is_global_admin: formData.get('is_global_admin') === 'on',
                    warehouse_roles: localAssignedRoles.map(({warehouse_id, role}) => ({warehouse_id, role}))
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
                const data = result.value;
                const action = data.user_id ? 'update_user' : 'create_user';
                const apiResult = await fetchData(`api/users_api.php?action=${action}`, 'POST', data);
                if (apiResult && apiResult.success) {
                    Swal.fire('Success!', apiResult.message, 'success');
                    loadUsers();
                } else {
                    Swal.fire('Error!', apiResult.message || 'An unknown error occurred.', 'error');
                }
            }
        });
    };
    
    const openChangePasswordForm = (userId) => {
        Swal.fire({
            title: 'Change Password',
            html: `
                <form id="changePasswordForm">
                    <div class="mb-3 text-start">
                        <label for="swal-password" class="form-label">New Password</label>
                        <div class="input-group">
                            <input type="password" id="swal-password" class="form-control" required>
                            <button class="btn btn-outline-secondary" type="button" id="swal-togglePassword"><i class="bi bi-eye-slash"></i></button>
                        </div>
                    </div>
                    <div class="mb-3 text-start">
                        <label for="swal-confirm-password" class="form-label">Confirm New Password</label>
                        <div class="input-group">
                            <input type="password" id="swal-confirm-password" class="form-control" required>
                            <button class="btn btn-outline-secondary" type="button" id="swal-toggleConfirmPassword"><i class="bi bi-eye-slash"></i></button>
                        </div>
                    </div>
                </form>`,
            showCancelButton: true,
            confirmButtonText: 'Update Password',
            didOpen: () => {
                setupPasswordToggle('swal-togglePassword', 'swal-password');
                setupPasswordToggle('swal-toggleConfirmPassword', 'swal-confirm-password');
            },
            preConfirm: () => {
                const password = Swal.getPopup().querySelector('#swal-password').value;
                const confirmPassword = Swal.getPopup().querySelector('#swal-confirm-password').value;
                if (!password || !confirmPassword) {
                    Swal.showValidationMessage('Both fields are required.');
                    return false;
                }
                if (password !== confirmPassword) {
                    Swal.showValidationMessage('Passwords do not match.');
                    return false;
                }
                return { password, confirmPassword };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { password, confirmPassword } = result.value;
                const apiResult = await fetchData('api/users_api.php?action=change_password', 'POST', {
                    user_id: userId,
                    password: password,
                    confirm_password: confirmPassword
                });
                if (apiResult && apiResult.success) {
                    Swal.fire('Success!', apiResult.message, 'success');
                } else {
                    Swal.fire('Error!', apiResult.message || 'Failed to update password.', 'error');
                }
            }
        });
    };

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
