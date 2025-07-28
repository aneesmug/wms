// public/js/main.js

// --- Authentication and State Management Functions ---

/**
 * Clears all session and local storage and redirects to the login page.
 */
function redirectToLogin() {
    localStorage.clear();
    window.location.href = 'index.php';
}

/**
 * Handles the logout process by showing a confirmation dialog and then calling the API.
 */
async function handleLogout() {
    showConfirmationModal('Confirm Logout', 'Are you sure you want to log out?', async () => {
        const result = await fetchData('api/auth.php?action=logout', 'POST');
        if (result && result.success) {
            redirectToLogin();
        }
    });
}

/**
 * Sets the user's currently active warehouse, stores it, and reloads the page.
 * @param {string|number} id - The ID of the warehouse.
 * @param {string} name - The name of the warehouse.
 */
async function setCurrentWarehouse(id, name) {
    const result = await fetchData('api/auth.php?action=set_warehouse', 'POST', { warehouse_id: id });
    if (result && result.success) {
        localStorage.setItem('current_warehouse_id', id);
        localStorage.setItem('current_warehouse_name', name);
        localStorage.setItem('current_warehouse_role', result.role);
        window.location.reload();
        return true;
    }
    return false;
}

/**
 * Shows a SweetAlert2 modal to force warehouse selection.
 * @param {Array<Object>} warehouses - An array of warehouse objects { warehouse_id, warehouse_name }.
 */
function promptWarehouseSelection(warehouses) {
    const warehouseOptions = warehouses.map(wh => 
        `<option value="${wh.warehouse_id}">${wh.warehouse_name}</option>`
    ).join('');

    Swal.fire({
        title: 'Select Your Warehouse',
        html: `<p>Please choose a warehouse to continue.</p><select id="swal-warehouse-select" class="form-select mt-3">${warehouseOptions}</select>`,
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCancelButton: false,
        confirmButtonText: 'Confirm & Continue',
        preConfirm: () => {
            const select = document.getElementById('swal-warehouse-select');
            const warehouseId = select.value;
            const warehouseName = select.options[select.selectedIndex].text;
            if (!warehouseId) {
                Swal.showValidationMessage('You must select a warehouse.');
                return false;
            }
            return { warehouseId, warehouseName };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { warehouseId, warehouseName } = result.value;
            setCurrentWarehouse(warehouseId, warehouseName);
        }
    });
}

/**
 * Updates the user information display, including the profile picture.
 * @param {object} authStatus - The authentication status object from the API.
 */
function updateUserInfoDisplay(authStatus) {
    const { user, current_warehouse_role } = authStatus;

    if (!user) return; // Exit if user data is not available

    const defaultImagePath = 'uploads/users/default.png';
    const profileImageUrl = user.profile_image_url || defaultImagePath;

    // Target elements in both menus
    const elements = {
        nameDesktop: document.getElementById('userFullNameDesktop'),
        roleDesktop: document.getElementById('userRoleDesktop'),
        imageDesktop: document.getElementById('userProfileImageDesktop'),
        nameMobile: document.getElementById('userFullNameMobile'),
        roleMobile: document.getElementById('userRoleMobile'),
        imageMobile: document.getElementById('userProfileImageMobile')
    };

    const displayName = user.full_name || 'User';
    let displayRole = 'No Role Assigned'; // Default text

    if (user.is_global_admin) {
        displayRole = 'Global Admin';
    } else if (current_warehouse_role) {
        // Capitalize the first letter for better display
        displayRole = current_warehouse_role.charAt(0).toUpperCase() + current_warehouse_role.slice(1);
    }

    // Update text content and image sources
    if (elements.nameDesktop) elements.nameDesktop.textContent = displayName;
    if (elements.roleDesktop) elements.roleDesktop.textContent = displayRole;
    if (elements.imageDesktop) {
        elements.imageDesktop.src = profileImageUrl;
        elements.imageDesktop.onerror = () => { elements.imageDesktop.src = defaultImagePath; };
    }
    
    if (elements.nameMobile) elements.nameMobile.textContent = displayName;
    if (elements.roleMobile) elements.roleMobile.textContent = displayRole;
    if (elements.imageMobile) {
        elements.imageMobile.src = profileImageUrl;
        elements.imageMobile.onerror = () => { elements.imageMobile.src = defaultImagePath; };
    }
}


// --- Utility Functions ---

/**
 * Fetches data from an API endpoint.
 */
async function fetchData(url, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(url, options);
        const result = await response.json();
        if (!response.ok) {
            console.error(`API Error: ${response.status} - ${result.message || 'Unknown error'}`);
            showMessageBox(result.message || `An error occurred (Status: ${response.status})`, 'error');
            if (response.status === 401) {
                setTimeout(redirectToLogin, 1500);
            }
            return result;
        }
        return result;
    } catch (error) {
        console.error('Network or parsing error:', error);
        showMessageBox('Network error. Please check your internet connection.', 'error');
        return null;
    }
}

/**
 * Displays a SweetAlert2 Toast message.
 */
function showMessageBox(message, type = 'info') {
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    if (!currentWarehouseId && (type === 'success' || type === 'info')) {
        return;
    }
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
    Toast.fire({ icon: type, title: message });
}

/**
 * Shows a generic confirmation modal.
 */
function showConfirmationModal(title, body, onConfirm) {
    Swal.fire({
        title: title,
        html: body,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, confirm it!'
    }).then((result) => {
        if (result.isConfirmed && typeof onConfirm === 'function') {
            onConfirm();
        }
    });
}

// --- NEW ADVANCED DYNAMIC FILTER FUNCTIONALITY ---
/**
 * Initializes an advanced, dynamic, multi-column filter for a DataTable.
 * @param {DataTable} table - The DataTables instance.
 * @param {string} filterContainerId - The ID of the dropdown container for the filter UI.
 * @param {Array<Object>} columnsConfig - Configuration for filterable columns, e.g., [{columnIndex: 1, title: 'Username'}]
 */
function initializeAdvancedFilter(table, filterContainerId, columnsConfig) {
    const container = document.getElementById(filterContainerId);
    if (!container) return;

    container.addEventListener('click', (e) => e.stopPropagation());

    const render = () => {
        container.innerHTML = `
            <div id="filter-rules-list" class="mb-2"></div>
            <button id="add-filter-btn" class="btn btn-sm btn-outline-secondary w-100"><i class="bi bi-plus-lg"></i> Add Rule</button>
            <hr class="my-2">
            <div class="d-flex justify-content-end">
                <button id="clear-filters-btn" class="btn btn-sm btn-light me-2">Clear</button>
                <button id="apply-filters-btn" class="btn btn-sm btn-primary">Apply</button>
            </div>
        `;
        addFilterRule(); // Start with one rule
    };

    const addFilterRule = () => {
        const list = document.getElementById('filter-rules-list');
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'filter-rule p-2 mb-2 border rounded';
        
        const columnOptions = columnsConfig.map(c => `<option value="${c.columnIndex}">${c.title}</option>`).join('');

        ruleDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <select class="form-select form-select-sm filter-column">${columnOptions}</select>
                <button class="btn btn-sm btn-outline-danger remove-rule-btn ms-2"><i class="bi bi-trash"></i></button>
            </div>
            <div class="d-flex">
                <select class="form-select form-select-sm filter-condition me-1" style="width: 100px;">
                    <option value="contain">Contain</option>
                    <option value="exact">Exact</option>
                    <option value="startsWith">Starts with</option>
                    <option value="endsWith">Ends with</option>
                </select>
                <input type="text" class="form-control form-control-sm filter-value" placeholder="Keyword...">
            </div>
        `;
        list.appendChild(ruleDiv);
    };

    const applyFilters = () => {
        table.columns().search('').draw(); // Clear all previous searches first

        container.querySelectorAll('.filter-rule').forEach(rule => {
            const colIndex = rule.querySelector('.filter-column').value;
            const condition = rule.querySelector('.filter-condition').value;
            const value = rule.querySelector('.filter-value').value;

            if (value) {
                let regex;
                const escapedValue = value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); // Escape special regex characters
                switch(condition) {
                    case 'exact':
                        regex = `^${escapedValue}$`;
                        break;
                    case 'startsWith':
                        regex = `^${escapedValue}`;
                        break;
                    case 'endsWith':
                        regex = `${escapedValue}$`;
                        break;
                    case 'contain':
                    default:
                        regex = escapedValue;
                        break;
                }
                table.column(colIndex).search(regex, true, false);
            }
        });
        table.draw();
    };

    const clearFilters = () => {
        container.querySelectorAll('.filter-value').forEach(input => input.value = '');
        table.columns().search('').draw();
    };

    container.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('#add-filter-btn')) addFilterRule();
        if (target.closest('.remove-rule-btn')) target.closest('.filter-rule').remove();
        if (target.closest('#apply-filters-btn')) applyFilters();
        if (target.closest('#clear-filters-btn')) clearFilters();
    });

    render();
}

// --- Common Page Setup ---

/**
 * Checks authentication and warehouse selection on page load.
 */
async function enforceAuthentication() {
    const isProtectedPage = !window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('index.php');
    if (isProtectedPage) {
        const authStatus = await fetchData('api/auth.php?action=check_auth');
        
        if (!authStatus || !authStatus.authenticated) {
            redirectToLogin();
            return;
        }

        // ALWAYS update the user info display if authenticated
        updateUserInfoDisplay(authStatus);

        if (!authStatus.current_warehouse_id) {
            const warehouseData = await fetchData('api/auth.php?action=get_user_warehouses');
            if (warehouseData.success && warehouseData.warehouses && warehouseData.warehouses.length > 0) {
                promptWarehouseSelection(warehouseData.warehouses);
            } else {
                Swal.fire({
                    title: 'No Warehouse Access',
                    text: 'You do not have access to any active warehouses. Please contact an administrator.',
                    icon: 'error',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    confirmButtonText: 'Logout'
                }).then(handleLogout);
            }
        }
    }
}

/**
 * Attaches event listeners to common elements.
 */
function setupCommonEventListeners() {
    const logoutButtons = document.querySelectorAll('#logoutBtnDesktop, #logoutBtnMobile');
    logoutButtons.forEach(btn => {
        if (btn) btn.addEventListener('click', handleLogout);
    });
}

// This runs on every page load.
document.addEventListener('DOMContentLoaded', () => {
    enforceAuthentication();
    setupCommonEventListeners();
});
