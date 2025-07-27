document.addEventListener('DOMContentLoaded', () => {
    // --- DOM & Modal Selectors ---
    const usersTableBody = document.getElementById('usersTableBody');
    const addUserBtn = document.getElementById('addUserBtn');
    const userModalEl = document.getElementById('userModal');
    // FIX: Initialize modal with options to prevent closing on outside click or escape key
    const userModal = new bootstrap.Modal(userModalEl, {
        backdrop: 'static',
        keyboard: false
    });
    const userForm = document.getElementById('userForm');
    const saveUserBtn = document.getElementById('saveUserBtn');
    
    // --- Correct Default Image Path ---
    const defaultImagePath = 'uploads/users/default.png';

    // --- State Management ---
    let availableWarehouses = [];
    let availableRoles = [];
    let isDataLoaded = false;
    let croppieInstance = null;
    let croppedImageData = null;
    let currentUserId = null;
    let isEditing = false;
    let localAssignedRoles = [];

    // --- Initial Data Loading ---
    const initializePage = async () => {
        if (isDataLoaded) return;
        usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        await Promise.all([loadUsers(), loadWarehouses(), loadRoles()]);
        isDataLoaded = true;
    };

    const loadUsers = async () => {
        const result = await fetchData('api/users_api.php?action=get_users');
        renderUsersTable(result?.success ? result.users : []);
    };

    const loadWarehouses = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_warehouses');
        if (result?.success) availableWarehouses = result.warehouses;
    };

    const loadRoles = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_roles');
        if (result?.success) availableRoles = result.roles;
    };

    // --- UI Rendering & Helpers ---
    const renderUsersTable = (users) => {
        usersTableBody.innerHTML = '';
        if (!users || users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No users found.</td></tr>';
            return;
        }
        users.forEach(user => {
            const rolesHtml = user.warehouse_roles
                ? user.warehouse_roles.split(';').map(role => `<span class="badge bg-secondary me-1 mb-1">${role.replace(':', ': ')}</span>`).join('')
                : (user.is_global_admin ? '<span class="badge bg-info">All Access</span>' : '<span class="badge bg-light text-dark">None</span>');
            const profileImage = user.profile_image_url || defaultImagePath;
            
            const row = `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${profileImage}" class="rounded-circle me-3" alt="${user.full_name}" style="width: 45px; height: 45px; object-fit: cover;" onerror="this.onerror=null; this.src='${defaultImagePath}';">
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

    const renderAssignedRoles = () => {
        const list = document.getElementById('assignedRolesList');
        if (!list) return;
        list.innerHTML = localAssignedRoles.length === 0 ? '<li class="list-group-item text-muted">No roles assigned.</li>'
            : localAssignedRoles.map((role, index) => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-building me-2"></i><strong>${role.warehouse_name}</strong> as <span class="badge bg-primary">${role.role}</span></span>
                    <button type="button" class="btn-close" aria-label="Remove" data-index="${index}"></button>
                </li>`).join('');
        list.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', e => {
                localAssignedRoles.splice(parseInt(e.target.dataset.index), 1);
                renderAssignedRoles();
            });
        });
    };
    
    const setupPasswordToggle = (toggleBtnId, passwordInputId) => {
        const btn = document.getElementById(toggleBtnId);
        const input = document.getElementById(passwordInputId);
        if (btn && input) {
            btn.addEventListener('click', () => {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                btn.querySelector('i').classList.toggle('bi-eye', type === 'password');
                btn.querySelector('i').classList.toggle('bi-eye-slash', type !== 'password');
            });
        }
    };

    // --- Croppie in SweetAlert2 Logic ---
    const openCroppieInSwal = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                Swal.fire({
                    title: 'Crop Your Image',
                    html: `<div id="croppie-editor-container" style="width:100%; height:400px;"></div>`,
                    width: 'auto',
                    showCancelButton: true,
                    confirmButtonText: 'Crop & Save',
                    didOpen: () => {
                        const editor = Swal.getPopup().querySelector('#croppie-editor-container');
                        croppieInstance = new Croppie(editor, {
                            viewport: { width: 200, height: 200, type: 'circle' },
                            boundary: { width: 300, height: 300 },
                            enableExif: true,
                            mouseWheelZoom: true,
                            showZoomer: true
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
                        if (!croppieInstance) return null;
                        try {
                            const result = await croppieInstance.result({
                                type: 'base64',
                                size: 'viewport',
                                format: 'jpeg',
                                quality: 0.9
                            });
                            return result;
                        } catch (error) {
                            console.error('Croppie Error:', error);
                            Swal.showValidationMessage(`Cropping failed: ${error.message}`);
                            return null;
                        }
                    }
                }).then(result => {
                    resolve(result.isConfirmed ? result.value : null);
                });
            };
            reader.readAsDataURL(file);
        });
    };

    // --- Main Form Logic ---
    const openUserForm = async (userId = null) => {
        await initializePage(); // Ensure data is loaded before opening form
        userForm.reset();
        userForm.classList.remove('was-validated');
        croppedImageData = null;
        localAssignedRoles = [];
        isEditing = userId !== null;
        currentUserId = userId;

        // --- Configure UI based on Add/Edit mode ---
        document.getElementById('userModalLabel').textContent = isEditing ? 'Edit User' : 'Add New User';
        document.getElementById('profileImageSection').style.display = isEditing ? 'block' : 'none';
        document.getElementById('passwordSection').style.display = isEditing ? 'none' : 'block';
        document.getElementById('changePasswordBtnContainer').style.display = isEditing ? 'block' : 'none';
        document.getElementById('password').required = !isEditing;
        document.getElementById('confirmPassword').required = !isEditing;
        
        if (isEditing) {
            const result = await fetchData(`api/users_api.php?action=get_user_details&user_id=${userId}`);
            if (!result?.success) return Swal.fire('Error', 'Could not fetch user details.', 'error');
            const userData = result.user;
            document.getElementById('userId').value = userData.user_id;
            document.getElementById('fullName').value = userData.full_name;
            document.getElementById('username').value = userData.username;
            document.getElementById('isGlobalAdmin').checked = userData.is_global_admin;
            document.getElementById('profileImagePreview').src = userData.profile_image_url || defaultImagePath;
            localAssignedRoles = userData.warehouse_roles.map(role => ({
                ...role,
                warehouse_name: availableWarehouses.find(w => w.warehouse_id == role.warehouse_id)?.warehouse_name || 'Unknown'
            }));
        } else {
            document.getElementById('profileImagePreview').src = defaultImagePath;
        }

        renderAssignedRoles();
        toggleWarehouseRolesSection(document.getElementById('isGlobalAdmin').checked);
        userModal.show();
    };
    
    const toggleWarehouseRolesSection = (isAdmin) => {
        const section = document.getElementById('warehouseRolesSection');
        section.style.opacity = isAdmin ? '0.5' : '1';
        section.querySelectorAll('select, button').forEach(c => c.disabled = isAdmin);
    };

    // --- Event Listeners ---
    if (addUserBtn) addUserBtn.addEventListener('click', () => openUserForm());

    document.getElementById('changeImageBtn').addEventListener('click', () => document.getElementById('profileImageInput').click());
    
    document.getElementById('profileImageInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const newImageData = await openCroppieInSwal(file);
            if (newImageData) {
                croppedImageData = newImageData;
                document.getElementById('profileImagePreview').src = newImageData;
            }
            e.target.value = ''; // Reset file input
        }
    });

    document.getElementById('isGlobalAdmin').addEventListener('change', (e) => toggleWarehouseRolesSection(e.target.checked));

    document.getElementById('addRoleBtn').addEventListener('click', () => {
        const warehouseSelect = document.getElementById('warehouseSelect');
        const roleSelect = document.getElementById('roleSelect');
        const warehouseId = parseInt(warehouseSelect.value);
        const role = roleSelect.value;
        if (!warehouseId || !role) return;

        const warehouseName = warehouseSelect.options[warehouseSelect.selectedIndex].text;
        const existing = localAssignedRoles.find(r => r.warehouse_id == warehouseId);
        if (existing) existing.role = role;
        else localAssignedRoles.push({ warehouse_id: warehouseId, warehouse_name: warehouseName, role });
        renderAssignedRoles();
    });
    
    document.getElementById('changePasswordBtn').addEventListener('click', () => openChangePasswordForm(currentUserId));

    saveUserBtn.addEventListener('click', async () => {
        if (!userForm.checkValidity()) {
            userForm.classList.add('was-validated');
            return;
        }

        const formData = new FormData(userForm);
        const data = {
            user_id: currentUserId,
            full_name: formData.get('full_name'),
            username: formData.get('username'),
            is_global_admin: formData.get('is_global_admin') === 'on',
            warehouse_roles: localAssignedRoles,
            profile_image: croppedImageData
        };

        if (!isEditing) {
            data.password = formData.get('password');
            data.confirm_password = formData.get('confirm_password');
            if (data.password !== data.confirm_password) {
                Swal.fire('Error', 'Passwords do not match.', 'error');
                return;
            }
        }

        const action = isEditing ? 'update_user' : 'create_user';
        const result = await fetchData(`api/users_api.php?action=${action}`, 'POST', data);
        if (result?.success) {
            userModal.hide();
            Swal.fire('Success!', result.message, 'success');
            loadUsers();
        } else {
            Swal.fire('Error!', result?.message || 'An unknown error occurred.', 'error');
        }
    });
    
    userModalEl.addEventListener('shown.bs.modal', () => {
        const warehouseSelect = document.getElementById('warehouseSelect');
        const roleSelect = document.getElementById('roleSelect');
        warehouseSelect.innerHTML = availableWarehouses.map(w => `<option value="${w.warehouse_id}">${w.warehouse_name}</option>`).join('');
        roleSelect.innerHTML = availableRoles.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('');
    });

    // --- Global Functions ---
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
                if (apiResult?.success) {
                    Swal.fire('Deleted!', 'The user has been deleted.', 'success');
                    loadUsers();
                } else {
                    Swal.fire('Error!', apiResult?.message || 'Failed to delete user.', 'error');
                }
            }
        });
    };

    const openChangePasswordForm = (userId) => {
        Swal.fire({
            title: 'Change Password',
            html: `
                <input type="password" id="swal-password" class="swal2-input" placeholder="New Password">
                <input type="password" id="swal-confirm-password" class="swal2-input" placeholder="Confirm New Password">
            `,
            confirmButtonText: 'Change Password',
            focusConfirm: false,
            preConfirm: async () => {
                const password = document.getElementById('swal-password').value;
                const confirmPassword = document.getElementById('swal-confirm-password').value;
                if (!password || !confirmPassword) {
                    Swal.showValidationMessage('Both fields are required');
                    return false;
                }
                if (password !== confirmPassword) {
                    Swal.showValidationMessage('Passwords do not match');
                    return false;
                }
                
                const result = await fetchData('api/users_api.php?action=change_password', 'POST', {
                    user_id: userId,
                    password: password,
                    confirm_password: confirmPassword
                });

                if (!result?.success) {
                    Swal.showValidationMessage(`Request failed: ${result?.message || 'Unknown error'}`);
                    return false;
                }
                return result;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('Success!', 'Password has been changed successfully.', 'success');
            }
        });
    };

    // --- Initializations ---
    initializePage(); 
    
    setupPasswordToggle('togglePassword', 'password');
    setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');
});
