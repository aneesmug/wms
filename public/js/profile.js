document.addEventListener('DOMContentLoaded', () => {
    // --- Form & Element Selectors ---
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');
    const profileImageInput = document.getElementById('profileImageInput');
    const profileImagePreview = document.getElementById('profileImagePreview');
    const fullNameInput = document.getElementById('fullName');
    const userRolesList = document.getElementById('userRolesList');

    let croppieInstance = null;
    let croppedImageData = null;
    const defaultImagePath = 'uploads/users/default.png';

    // --- Data Loading ---
    const loadUserProfile = async () => {
        const result = await fetchData('api/users_api.php?action=get_current_user_profile');
        if (result && result.success) {
            const user = result.user;
            fullNameInput.value = user.full_name;
            profileImagePreview.src = user.profile_image_url || defaultImagePath;

            // Display roles
            userRolesList.innerHTML = '';
            if (user.is_global_admin) {
                userRolesList.innerHTML = '<li class="list-group-item"><strong>Global Admin</strong> (All Access)</li>';
            } else if (user.warehouse_roles && user.warehouse_roles.length > 0) {
                user.warehouse_roles.forEach(role => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.innerHTML = `<strong>${role.warehouse_name}</strong>: <span class="badge bg-primary">${role.role}</span>`;
                    userRolesList.appendChild(li);
                });
            } else {
                userRolesList.innerHTML = '<li class="list-group-item text-muted">No specific roles assigned.</li>';
            }
        } else {
            Swal.fire('Error', 'Could not load your profile data.', 'error');
        }
    };

    // --- Croppie Logic ---
    const openCroppieModal = (file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            Swal.fire({
                title: 'Crop Your Image',
                html: `<div id="croppie-editor-container" style="width:100%; height:400px;"></div>`,
                showCancelButton: true,
                confirmButtonText: 'Crop & Save',
                didOpen: () => {
                    const editor = Swal.getPopup().querySelector('#croppie-editor-container');
                    croppieInstance = new Croppie(editor, {
                        viewport: { width: 200, height: 200, type: 'circle' },
                        boundary: { width: 300, height: 300 },
                    });
                    croppieInstance.bind({ url: event.target.result });
                },
                willClose: () => {
                    croppieInstance.destroy();
                    croppieInstance = null;
                },
                preConfirm: () => {
                    return croppieInstance.result({ type: 'base64', format: 'jpeg', size: 'viewport' })
                        .then(result => {
                            croppedImageData = result;
                            profileImagePreview.src = result;
                            return result;
                        });
                }
            });
        };
        reader.readAsDataURL(file);
    };

    profileImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            openCroppieModal(file);
        }
    });
    profileImagePreview.addEventListener('click', () => profileImageInput.click());

    // --- Form Submission Handlers ---
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            full_name: fullNameInput.value,
            profile_image: croppedImageData // Will be null if no new image is cropped
        };
        const result = await fetchData('api/users_api.php?action=update_current_user_profile', 'POST', data);
        if (result && result.success) {
            Swal.fire('Success', 'Your profile has been updated.', 'success');
            // Also update the menu image
            const menuImgDesktop = document.getElementById('userProfileImageDesktop');
            const menuImgMobile = document.getElementById('userProfileImageMobile');
            if(result.new_image_url) {
                if(menuImgDesktop) menuImgDesktop.src = result.new_image_url;
                if(menuImgMobile) menuImgMobile.src = result.new_image_url;
            }
        } else {
            Swal.fire('Error', result.message || 'Failed to update profile.', 'error');
        }
    });

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
            Swal.fire('Error', 'New passwords do not match.', 'error');
            return;
        }

        const data = { current_password: currentPassword, new_password: newPassword };
        const result = await fetchData('api/users_api.php?action=change_own_password', 'POST', data);

        if (result && result.success) {
            Swal.fire('Success', 'Your password has been changed.', 'success');
            passwordForm.reset();
        } else {
            Swal.fire('Error', result.message || 'Failed to change password.', 'error');
        }
    });

    // --- Initial Load ---
    loadUserProfile();
});
