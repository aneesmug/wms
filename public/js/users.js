document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const usersTableBody = document.getElementById('usersTableBody');
    const addUserBtn = document.getElementById('addUserBtn');
    const userFormContainer = document.getElementById('userFormContainer');

    // --- State Management ---
    let availableWarehouses = [];
    let availableRoles = [];
    let isDataLoaded = false;
    let croppieInstance = null; // To hold the Croppie instance

    // --- Initial Data Loading ---

    /**
     * Initializes the page by loading all necessary data from the server.
     * Prevents re-loading if data is already present.
     */
    const initializePage = async () => {
        if (isDataLoaded) return;
        // Show a loading indicator in the table
        usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        
        await Promise.all([
            loadUsers(),
            loadWarehouses(),
            loadRoles()
        ]);
        isDataLoaded = true;
    };

    /**
     * Fetches the list of users from the API and triggers rendering.
     */
    const loadUsers = async () => {
        const result = await fetchData('api/users_api.php?action=get_users');
        if (result && result.success) {
            renderUsersTable(result.users);
        } else {
             usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-4">Failed to load users. Please try again later.</td></tr>';
        }
    };

    /**
     * Fetches the list of available warehouses for role assignment.
     */
    const loadWarehouses = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_warehouses');
        if (result && result.success) {
            availableWarehouses = result.warehouses;
        }
    };

    /**
     * Fetches the list of available user roles.
     */
    const loadRoles = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_roles');
        if (result && result.success) {
            availableRoles = result.roles;
        }
    };

    // --- UI Rendering & Helpers ---

    /**
     * Renders the main users table with data from the server.
     * @param {Array} users - An array of user objects.
     */
    const renderUsersTable = (users) => {
        usersTableBody.innerHTML = '';
        if (users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No users found. Click "Add New User" to begin.</td></tr>';
            return;
        }
        users.forEach(user => {
            const rolesHtml = user.warehouse_roles
                ? user.warehouse_roles.split(';').map(role => {
                    const [warehouse, roleName] = role.split(':');
                    return `<span class="badge bg-secondary me-1 mb-1">${warehouse}: ${roleName}</span>`;
                  }).join('')
                : (user.is_global_admin ? '<span class="badge bg-info">All Access</span>' : '<span class="badge bg-light text-dark">None</span>');
            
            const profileImage = user.profile_image_url ? user.profile_image_url : 'uploads/users/defult.png';

            const row = `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${profileImage}" class="rounded-circle me-3" alt="${user.full_name}" style="width: 45px; height: 45px; object-fit: cover;" onerror="this.onerror=null;this.src='uploads/users/defult.png';">
                            <div>
                                <div class="fw-bold">${user.full_name}</div>
                            </div>
                        </div>
                    </td>
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
    
    /**
     * Renders the list of assigned warehouse roles inside the SweetAlert2 modal.
     * @param {Array} rolesToRender - An array of role objects to display.
     */
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
        
        // Add event listeners to the new "remove" buttons
        assignedRolesList.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.dataset.index);
                rolesToRender.splice(indexToRemove, 1);
                renderAssignedRolesInSwal(rolesToRender); // Re-render the list
            });
        });
    };

    /**
     * Sets up the show/hide toggle for a password input field.
     * @param {string} toggleBtnId - The ID of the button that toggles visibility.
     * @param {string} passwordInputId - The ID of the password input field.
     */
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

    /**
     * Sets up the event listener for the file input to handle image selection and cropping.
     * @param {HTMLElement} popup - The SweetAlert2 popup element.
     */
    const setupImageUploadHandling = (popup) => {
        const profileImageInput = popup.querySelector('#profileImage');
        const croppieContainer = popup.querySelector('#croppieContainer');
        const profileImagePreview = popup.querySelector('#profileImagePreview');

        if (!profileImageInput || !croppieContainer || !profileImagePreview) {
            console.error("Image upload elements not found in the modal.");
            return;
        }

        profileImageInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    if (croppieInstance) {
                        croppieInstance.destroy();
                        croppieInstance = null;
                    }
                    
                    profileImagePreview.style.display = 'none';
                    croppieContainer.style.display = 'block';

                    // MODIFICATION: Delay Croppie initialization to ensure its container is rendered.
                    setTimeout(() => {
                        croppieInstance = new Croppie(croppieContainer, {
                            viewport: { width: 200, height: 200, type: 'circle' },
                            boundary: { width: 280, height: 280 },
                            enableExif: true
                        });

                        croppieInstance.bind({
                            url: event.target.result
                        });
                    }, 100); // Increased delay for more reliability
                };
                reader.readAsDataURL(file);
            }
        });
    };

    // --- Event Handlers & Form Logic ---

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => openUserForm());
    }

    /**
     * Opens the main user form (for creating or editing) in a SweetAlert2 modal.
     * @param {number|null} userId - The ID of the user to edit, or null to create a new one.
     */
    const openUserForm = async (userId = null) => {
        await initializePage(); // Ensure all data is loaded

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
            localAssignedRoles = userDataForEdit.warehouse_roles.map(role => {
                const warehouse = availableWarehouses.find(w => w.warehouse_id == role.warehouse_id);
                return { ...role, warehouse_name: warehouse ? warehouse.warehouse_name : 'Unknown' };
            });
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
                setupImageUploadHandling(popup);
                
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
                    const warehouseName = warehouseSelect.options[warehouseSelect.selectedIndex].text;
                    const Toast = Swal.mixin({ toast: true, position: 'top', showConfirmButton: false, timer: 3000, timerProgressBar: true });

                    if (!warehouseId || !role || !warehouseName) {
                        Toast.fire({ icon: 'error', title: 'Please select both a warehouse and a role.' });
                        return;
                    }

                    const existingRoleIndex = localAssignedRoles.findIndex(r => r.warehouse_id == warehouseId);
                    if (existingRoleIndex > -1) {
                        localAssignedRoles[existingRoleIndex].role = role;
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
                    
                    if (userDataForEdit.profile_image_url) {
                        popup.querySelector('#profileImagePreview').src = userDataForEdit.profile_image_url;
                    }
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
            willClose: () => {
                if (croppieInstance) {
                    croppieInstance.destroy();
                    croppieInstance = null;
                }
            },
            preConfirm: async () => {
                const form = Swal.getPopup().querySelector('#userForm');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return false;
                }

                let croppedImage = null;
                if (croppieInstance && form.querySelector('#profileImage').files.length > 0) {
                    croppedImage = await croppieInstance.result({
                        type: 'base64',
                        size: 'viewport',
                        format: 'jpeg',
                        quality: 0.8
                    });
                }

                const formData = new FormData(form);
                const data = {
                    user_id: formData.get('user_id') ? parseInt(formData.get('user_id')) : null,
                    full_name: formData.get('full_name'),
                    username: formData.get('username'),
                    is_global_admin: formData.get('is_global_admin') === 'on',
                    warehouse_roles: localAssignedRoles.map(({warehouse_id, role}) => ({warehouse_id, role})),
                    profile_image: croppedImage
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
                <form id="changePasswordForm" class="text-start">
                    <div class="mb-3">
                        <label for="swal-password" class="form-label">New Password</label>
                        <div class="input-group">
                            <input type="password" id="swal-password" class="form-control" required>
                            <button class="btn btn-outline-secondary" type="button" id="swal-togglePassword"><i class="bi bi-eye-slash"></i></button>
                        </div>
                    </div>
                    <div class="mb-3">
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
                    Swal.showValidationMessage('Both password fields are required.');
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

    const handleDeleteUser = (userId, username) => {
        Swal.fire({
            title: 'Confirm Deletion',
            html: `Are you sure you want to delete the user <strong>${username}</strong>? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/users_api.php?action=delete_user', 'POST', { user_id: userId });
                if (apiResult && apiResult.success) {
                    Swal.fire('Deleted!', 'The user has been successfully deleted.', 'success');
                    loadUsers(); // Refresh the user list
                } else {
                    Swal.fire('Error!', apiResult.message || 'Failed to delete the user.', 'error');
                }
            }
        });
    };

    window.openUserForm = openUserForm;
    window.handleDeleteUser = handleDeleteUser;

    initializePage();
});
