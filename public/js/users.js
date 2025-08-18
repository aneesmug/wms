/*
* MODIFICATION SUMMARY:
* 1. INTEGRATED TRANSLATION: Replaced all user-facing strings with the global `__` function to support multi-language capabilities. This includes modal titles, button texts, labels, placeholders, and confirmation messages.
* 2. Replaced the old dropdown-based role assignment UI with a new, dedicated modal.
* 3. Added `permissionsModal` for a matrix-style (table) view of warehouses and roles.
* 4. Implemented `openPermissionsModal` to dynamically build a table with radio buttons, ensuring only one role can be selected per warehouse.
* 5. The "Apply Permissions" button in the new modal updates the `localAssignedRoles` array, which is then saved when the main form is submitted.
* 6. Added `updatePermissionsCount` to provide immediate feedback on the main form about assigned roles.
* 7. Removed all now-unused code related to the old dropdowns and list-based UI.
* 8. Added logic to handle the new `preferred_language` dropdown in the user form.
*/
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM & Modal Selectors ---
    const addUserBtn = document.getElementById('addUserBtn');
    const userModalEl = document.getElementById('userModal');
    const userModal = new bootstrap.Modal(userModalEl, { backdrop: 'static', keyboard: false });
    const userForm = document.getElementById('userForm');
    const saveUserBtn = document.getElementById('saveUserBtn');
    const permissionsModalEl = document.getElementById('permissionsModal');
    const permissionsModal = new bootstrap.Modal(permissionsModalEl);
    
    const defaultImagePath = 'uploads/users/default.png';
    let availableWarehouses = [];
    let availableRoles = [];
    let croppieInstance = null;
    let croppedImageData = null;
    let currentUserId = null;
    let isEditing = false;
    let localAssignedRoles = [];
    let usersTable;

    // --- DataTable Initialization ---
    const initializeDataTable = () => {
        usersTable = $('#usersTable').DataTable({
            processing: true,
            serverSide: false,
            ajax: {
                url: 'api/users_api.php?action=get_users',
                dataSrc: 'users'
            },
            columns: [
                { 
                    data: 'full_name',
                    title: __('user'),
                    render: function (data, type, row) {
                        if (type === 'display') {
                            const profileImage = row.profile_image_url || defaultImagePath;
                            return `<div class="d-flex align-items-center"><img src="${profileImage}" class="rounded-circle me-3" alt="${row.full_name}" style="width: 45px; height: 45px; object-fit: cover;" onerror="this.onerror=null; this.src='${defaultImagePath}';"><div class="fw-bold">${row.full_name}</div></div>`;
                        }
                        return data;
                    }
                },
                { data: 'username', title: __('username') },
                { 
                    data: 'is_global_admin',
                    title: __('global_admin'),
                    render: (data) => data == 1 ? __('yes') : __('no')
                },
                { 
                    data: 'warehouse_roles',
                    title: __('assigned_locations_roles'),
                    render: (data, type, row) => {
                        if (row.is_global_admin == 1) return __('all_access');
                        if (!data) return __('none');
                        if (type === 'display') {
                            return data.split(';').map(roleInfo => {
                                const [location, role] = roleInfo.split(':');
                                return `<div class="mb-1"><strong>${location.trim()}:</strong> <span class="badge bg-secondary">${role.trim()}</span></div>`;
                            }).join('');
                        }
                        return data;
                    }
                },
                { 
                    data: null,
                    orderable: false,
                    searchable: false,
                    className: 'text-end',
                    render: function (data, type, row) {
                        return `<button class="btn btn-sm btn-outline-primary me-2" onclick="openUserForm(${row.user_id})"><i class="bi bi-pencil"></i> ${__('edit')}</button><button class="btn btn-sm btn-outline-danger" onclick="handleDeleteUser(${row.user_id}, '${row.username}')"><i class="bi bi-trash"></i> ${__('delete')}</button>`;
                    }
                }
            ],
            language: {
                search: `<span>${__('search')}:</span> _INPUT_`,
                searchPlaceholder: `${__('search')}...`,
                lengthMenu: `${__('show')} _MENU_ ${__('entries')}`,
                info: `${__('showing')} _START_ ${__('to')} _END_ ${__('of')} _TOTAL_ ${__('entries')}`,
                infoEmpty: `${__('showing')} 0 ${__('to')} 0 ${__('of')} 0 ${__('entries')}`,
                infoFiltered: `(${__('filtered_from')} _MAX_ ${__('total_entries')})`,
                paginate: {
                    first: __('first'),
                    last: __('last'),
                    next: __('next'),
                    previous: __('previous')
                },
                emptyTable: __('no_data_available_in_table'),
                zeroRecords: __('no_matching_records_found'),
                processing: `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">${__('loading')}...</span></div>`
            },
            "initComplete": function(settings, json) {
                const filterConfig = [];
                usersTable.columns().every(function() {
                    const column = this;
                    if (column.settings()[0].aoColumns[column.index()].bSearchable) {
                         const title = $(column.header()).text();
                         filterConfig.push({ columnIndex: column.index(), title: title });
                    }
                });
                initializeAdvancedFilter(usersTable, 'filterContainer', filterConfig);
            }
        });
    };

    // --- Data Loading ---
    const loadWarehouses = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_warehouses');
        if (result?.success) availableWarehouses = result.warehouses;
    };

    const loadRoles = async () => {
        const result = await fetchData('api/users_api.php?action=get_all_roles');
        if (result?.success) availableRoles = result.roles;
    };

    // --- UI Rendering & Helpers ---
    const updatePermissionsCount = () => {
        const countSpan = document.getElementById('permissionsCount');
        const count = localAssignedRoles.length;
        if (count === 0) {
            countSpan.textContent = __('no_permissions_assigned');
        } else if (count === 1) {
            countSpan.textContent = __('one_permission_assigned');
        } else {
            countSpan.textContent = `${count} ${__('permissions_assigned')}`;
        }
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
                    title: __('crop_your_image'),
                    html: `<div id="croppie-editor-container" style="width:100%; height:400px;"></div>`,
                    width: 'auto',
                    showCancelButton: true,
                    confirmButtonText: __('crop_and_save'),
                    cancelButtonText: __('cancel'),
                    didOpen: () => {
                        const editor = Swal.getPopup().querySelector('#croppie-editor-container');
                        croppieInstance = new Croppie(editor, {
                            viewport: { width: 200, height: 200, type: 'circle' },
                            boundary: { width: 300, height: 300 },
                            enableExif: true, mouseWheelZoom: true, showZoomer: true
                        });
                        croppieInstance.bind({ url: event.target.result });
                    },
                    willClose: () => {
                        if (croppieInstance) { croppieInstance.destroy(); croppieInstance = null; }
                    },
                    preConfirm: async () => {
                        if (!croppieInstance) return null;
                        return croppieInstance.result({ type: 'base64', size: 'viewport', format: 'jpeg', quality: 0.9 });
                    }
                }).then(result => resolve(result.isConfirmed ? result.value : null));
            };
            reader.readAsDataURL(file);
        });
    };

    // --- Main Form Logic ---
    window.openUserForm = async (userId = null) => {
        await Promise.all([loadWarehouses(), loadRoles()]);
        userForm.reset();
        userForm.classList.remove('was-validated');
        croppedImageData = null;
        localAssignedRoles = [];
        isEditing = userId !== null;
        currentUserId = userId;

        document.getElementById('userModalLabel').textContent = isEditing ? __('edit_user') : __('add_new_user');
        document.getElementById('profileImageSection').style.display = isEditing ? 'block' : 'none';
        document.getElementById('passwordSection').style.display = isEditing ? 'none' : 'block';
        document.getElementById('changePasswordBtnContainer').style.display = isEditing ? 'block' : 'none';
        document.getElementById('password').required = !isEditing;
        document.getElementById('confirmPassword').required = !isEditing;
        
        if (isEditing) {
            const result = await fetchData(`api/users_api.php?action=get_user_details&user_id=${userId}`);
            if (!result?.success) return Swal.fire(__('error'), __('could_not_fetch_user_details'), 'error');
            const userData = result.user;
            document.getElementById('userId').value = userData.user_id;
            document.getElementById('fullName').value = userData.full_name;
            document.getElementById('username').value = userData.username;
            document.getElementById('isGlobalAdmin').checked = userData.is_global_admin;
            document.getElementById('profileImagePreview').src = userData.profile_image_url || defaultImagePath;
            document.getElementById('preferred_language').value = userData.preferred_language || 'en';
            localAssignedRoles = userData.warehouse_roles.map(role => ({
                ...role,
                warehouse_name: availableWarehouses.find(w => w.warehouse_id == role.warehouse_id)?.warehouse_name || __('unknown')
            }));
        } else {
            document.getElementById('profileImagePreview').src = defaultImagePath;
            document.getElementById('preferred_language').value = '';
        }

        updatePermissionsCount();
        toggleWarehouseRolesSection(document.getElementById('isGlobalAdmin').checked);
        userModal.show();
    };
    
    const toggleWarehouseRolesSection = (isAdmin) => {
        const section = document.getElementById('warehouseRolesSection');
        section.style.opacity = isAdmin ? '0.5' : '1';
        section.querySelectorAll('button').forEach(c => c.disabled = isAdmin);
    };

    const openPermissionsModal = () => {
        const container = document.getElementById('permissionsMatrixContainer');
        if (!availableWarehouses.length || !availableRoles.length) {
            container.innerHTML = `<p class="text-danger">${__('could_not_load_warehouses_or_roles')}</p>`;
            permissionsModal.show();
            return;
        }
    
        const rolesWithNone = ['None', ...availableRoles];
        let tableHTML = `<table class="table table-bordered table-hover"><thead><tr><th>${__('warehouse')}</th>`;
        rolesWithNone.forEach(role => {
            tableHTML += `<th class="text-center text-capitalize">${__(role.toLowerCase())}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
    
        availableWarehouses.forEach(wh => {
            tableHTML += `<tr><td><strong>${wh.warehouse_name}</strong></td>`;
            const assignedRole = localAssignedRoles.find(r => r.warehouse_id == wh.warehouse_id);
            const currentRole = assignedRole ? assignedRole.role : 'none';
    
            rolesWithNone.forEach(role => {
                const roleValue = role.toLowerCase();
                const isChecked = currentRole.toLowerCase() === roleValue;
                tableHTML += `<td class="text-center align-middle">
                    <input class="form-check-input" type="radio" 
                           name="warehouse-role-${wh.warehouse_id}" 
                           value="${roleValue}" 
                           data-warehouse-id="${wh.warehouse_id}"
                           ${isChecked ? 'checked' : ''}>
                </td>`;
            });
            tableHTML += '</tr>';
        });
    
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
        permissionsModal.show();
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
            e.target.value = '';
        }
    });

    document.getElementById('isGlobalAdmin').addEventListener('change', (e) => toggleWarehouseRolesSection(e.target.checked));

    document.getElementById('managePermissionsBtn').addEventListener('click', openPermissionsModal);

    document.getElementById('applyPermissionsBtn').addEventListener('click', () => {
        localAssignedRoles = []; 
        const matrix = document.getElementById('permissionsMatrixContainer');
        
        availableWarehouses.forEach(wh => {
            const checkedRadio = matrix.querySelector(`input[name="warehouse-role-${wh.warehouse_id}"]:checked`);
            if (checkedRadio && checkedRadio.value !== 'none') {
                localAssignedRoles.push({
                    warehouse_id: parseInt(checkedRadio.dataset.warehouseId),
                    warehouse_name: wh.warehouse_name,
                    role: checkedRadio.value
                });
            }
        });
    
        updatePermissionsCount();
        permissionsModal.hide();
    });

    document.getElementById('changePasswordBtn').addEventListener('click', () => {
        const fullName = document.getElementById('fullName').value;
        openChangePasswordForm(currentUserId, fullName);
    });

    saveUserBtn.addEventListener('click', async () => {
        if (!userForm.checkValidity()) {
            userForm.classList.add('was-validated');
            return;
        }
        const data = {
            user_id: currentUserId,
            full_name: document.getElementById('fullName').value,
            username: document.getElementById('username').value,
            is_global_admin: document.getElementById('isGlobalAdmin').checked,
            preferred_language: document.getElementById('preferred_language').value,
            warehouse_roles: localAssignedRoles,
            profile_image: croppedImageData
        };
        if (!isEditing) {
            data.password = document.getElementById('password').value;
            data.confirm_password = document.getElementById('confirmPassword').value;
            if (data.password !== data.confirm_password) return Swal.fire(__('error'), __('passwords_do_not_match'), 'error');
        }
        const action = isEditing ? 'update_user' : 'create_user';
        const result = await fetchData(`api/users_api.php?action=${action}`, 'POST', data);
        if (result?.success) {
            userModal.hide();
            Swal.fire(__('success'), result.message, 'success');
            usersTable.ajax.reload();
        } else {
            Swal.fire(__('error'), result?.message || __('an_unknown_error_occurred'), 'error');
        }
    });
    
    // --- Global Functions ---
    window.handleDeleteUser = (userId, username) => {
        Swal.fire({
            title: __('confirm_deletion'),
            html: `${__('are_you_sure_delete_user')} <strong>${username}</strong>? ${__('action_cannot_be_undone')}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: __('yes_delete_it'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const apiResult = await fetchData('api/users_api.php?action=delete_user', 'POST', { user_id: userId });
                if (apiResult?.success) {
                    Swal.fire(__('deleted'), __('user_has_been_deleted'), 'success');
                    usersTable.ajax.reload();
                } else {
                    Swal.fire(__('error'), apiResult?.message || __('failed_to_delete_user'), 'error');
                }
            }
        });
    };

    const openChangePasswordForm = (userId, fullName) => {
        userModal.hide();

        setTimeout(() => {
            Swal.fire({
                title: `${__('change_password_for')} ${fullName}`,
                html: `<input type="password" id="swal-password" class="swal2-input" placeholder="${__('new_password')}"><input type="password" id="swal-confirm-password" class="swal2-input" placeholder="${__('confirm_new_password')}">`,
                confirmButtonText: __('change_password'),
                cancelButtonText: __('cancel'),
                focusConfirm: false,
                preConfirm: async () => {
                    const password = document.getElementById('swal-password').value;
                    const confirmPassword = document.getElementById('swal-confirm-password').value;
                    if (!password || !confirmPassword) return Swal.showValidationMessage(__('both_fields_are_required'));
                    if (password !== confirmPassword) return Swal.showValidationMessage(__('passwords_do_not_match'));
                    const result = await fetchData('api/users_api.php?action=change_password', 'POST', {
                        user_id: userId, password: password, confirm_password: confirmPassword
                    });
                    if (!result?.success) return Swal.showValidationMessage(`${__('request_failed')}: ${result?.message || __('unknown_error')}`);
                    return result;
                }
            }).then((result) => {
                if (result.isConfirmed) Swal.fire(__('success'), __('password_changed_successfully'), 'success');
            });
        }, 500);
    };

    // --- Initializations ---
    initializeDataTable();
    setupPasswordToggle('togglePassword', 'password');
    setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');
});
