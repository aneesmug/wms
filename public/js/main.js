/*
* MODIFICATION SUMMARY:
* 1. CRITICAL FIX: Modified the global `fetchData` function to prevent page reloads on login failure.
* 2. The function now checks if the user is currently on the login page.
* 3. The automatic redirect for a 401 (Unauthorized) error will now ONLY happen if the user is NOT on the login page.
* 4. This resolves the issue where entering a wrong password would cause the page to refresh.
* 5. All other existing logic, including the inactivity timer and helper functions, has been preserved.
*/

// public/js/main.js

// --- Inactivity Lock Screen Logic ---
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let inactivityTimer;
let timeRemaining = INACTIVITY_TIMEOUT;
let timerStartTime;
let timerPaused = false;

function pauseTimer() {
    if (!timerPaused) {
        clearTimeout(inactivityTimer);
        const elapsedTime = Date.now() - timerStartTime;
        timeRemaining -= elapsedTime;
        timerPaused = true;
    }
}

function resumeTimer() {
    if (timerPaused) {
        timerPaused = false;
        timerStartTime = Date.now();
        if (timeRemaining > 0) {
            inactivityTimer = setTimeout(showLockScreen, timeRemaining);
        } else {
            showLockScreen();
        }
    }
}

function showLockScreen() {
    if (Swal.isVisible() && Swal.getTitle() === 'Session Locked') {
        return;
    }
    pauseTimer();
    Swal.fire({
        title: 'Session Locked',
        html: `<p>You've been inactive. Please enter your password to continue.</p><input type="password" id="reauth-password" class="swal2-input" placeholder="Password">`,
        icon: 'warning',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCancelButton: true,
        confirmButtonText: 'Unlock',
        cancelButtonText: 'Logout',
        preConfirm: async () => {
            const password = document.getElementById('reauth-password').value;
            if (!password) {
                Swal.showValidationMessage('Password is required');
                return false;
            }
            const result = await fetchData('api/auth.php?action=reauthenticate', 'POST', { password });
            if (!result || !result.success) {
                Swal.showValidationMessage(result.message || 'Incorrect password');
                return false;
            }
            return result;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showMessageBox('Session unlocked!', 'success');
            resetInactivityTimer(); 
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            handleLogout();
        }
    });
}

function resetInactivityTimer() {
    if (Swal.isVisible() && Swal.getTitle() === 'Session Locked') {
        return;
    }
    clearTimeout(inactivityTimer);
    timeRemaining = INACTIVITY_TIMEOUT;
    timerStartTime = Date.now();
    timerPaused = false;
    inactivityTimer = setTimeout(showLockScreen, timeRemaining);
}

function startInactivityTimer() {
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseTimer();
        } else {
            resumeTimer();
        }
    });
    resetInactivityTimer();
}


// --- Authentication and State Management Functions ---

function redirectToLogin() {
    localStorage.clear();
    window.location.href = 'index.php';
}

async function handleLogout() {
    if (Swal.isVisible() && Swal.getTitle() === 'Session Locked') {
        const result = await fetchData('api/auth.php?action=logout', 'POST');
        if (result && result.success) redirectToLogin();
        return;
    }
    showConfirmationModal('Confirm Logout', 'Are you sure you want to log out?', async () => {
        const result = await fetchData('api/auth.php?action=logout', 'POST');
        if (result && result.success) redirectToLogin();
    });
}

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

function promptWarehouseSelection(warehouses) {
    const warehouseOptions = warehouses.map(wh => `<option value="${wh.warehouse_id}">${wh.warehouse_name}</option>`).join('');
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

function updateUserInfoDisplay(authStatus) {
    const { user, current_warehouse_role } = authStatus;
    if (!user) return;
    const defaultImagePath = 'uploads/users/default.png';
    const profileImageUrl = user.profile_image_url || defaultImagePath;
    const elements = {
        nameDesktop: document.getElementById('userFullNameDesktop'),
        roleDesktop: document.getElementById('userRoleDesktop'),
        imageDesktop: document.getElementById('userProfileImageDesktop'),
        nameMobile: document.getElementById('userFullNameMobile'),
        roleMobile: document.getElementById('userRoleMobile'),
        imageMobile: document.getElementById('userProfileImageMobile')
    };
    const displayName = user.full_name || 'User';
    let displayRole = 'No Role Assigned';
    if (user.is_global_admin) {
        displayRole = 'Global Admin';
    } else if (current_warehouse_role) {
        displayRole = current_warehouse_role.charAt(0).toUpperCase() + current_warehouse_role.slice(1);
    }
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

async function fetchData(url, method = 'GET', data = null) {
    if (typeof resetInactivityTimer === 'function') {
        resetInactivityTimer();
    }
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
        };

        if (method === 'GET') {
            url += (url.includes('?') ? '&' : '?') + `_=${new Date().getTime()}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(url, options);
        const result = await response.json();
        if (!response.ok) {
            console.error(`API Error: ${response.status} - ${result.message || 'Unknown error'}`);
            showMessageBox(result.message || `An error occurred (Status: ${response.status})`, 'error');
            
            // **FIX: Only redirect on 401 if we are NOT on the login page.**
            if (response.status === 401) {
                const isLoginPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.php');
                if (!isLoginPage) {
                    setTimeout(redirectToLogin, 1500);
                }
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

function initializeAdvancedFilter(table, filterContainerId, columnsConfig) {
    const container = document.getElementById(filterContainerId);
    if (!container) return;
    container.addEventListener('click', (e) => e.stopPropagation());
    const render = () => {
        container.innerHTML = `<div id="filter-rules-list" class="mb-2"></div><button id="add-filter-btn" class="btn btn-sm btn-outline-secondary w-100"><i class="bi bi-plus-lg"></i> Add Rule</button><hr class="my-2"><div class="d-flex justify-content-end"><button id="clear-filters-btn" class="btn btn-sm btn-light me-2">Clear</button><button id="apply-filters-btn" class="btn btn-sm btn-primary">Apply</button></div>`;
        addFilterRule();
    };
    const addFilterRule = () => {
        const list = document.getElementById('filter-rules-list');
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'filter-rule p-2 mb-2 border rounded';
        const columnOptions = columnsConfig.map(c => `<option value="${c.columnIndex}">${c.title}</option>`).join('');
        ruleDiv.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2"><select class="form-select form-select-sm filter-column">${columnOptions}</select><button class="btn btn-sm btn-outline-danger remove-rule-btn ms-2"><i class="bi bi-trash"></i></button></div><div class="d-flex"><select class="form-select form-select-sm filter-condition me-1" style="width: 100px;"><option value="contain">Contain</option><option value="exact">Exact</option><option value="startsWith">Starts with</option><option value="endsWith">Ends with</option></select><input type="text" class="form-control form-control-sm filter-value" placeholder="Keyword..."></div>`;
        list.appendChild(ruleDiv);
    };
    const applyFilters = () => {
        table.columns().search('').draw();
        container.querySelectorAll('.filter-rule').forEach(rule => {
            const colIndex = rule.querySelector('.filter-column').value;
            const condition = rule.querySelector('.filter-condition').value;
            const value = rule.querySelector('.filter-value').value;
            if (value) {
                let regex;
                const escapedValue = value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                switch(condition) {
                    case 'exact': regex = `^${escapedValue}$`; break;
                    case 'startsWith': regex = `^${escapedValue}`; break;
                    case 'endsWith': regex = `${escapedValue}$`; break;
                    default: regex = escapedValue; break;
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

function initializeDatepicker(element, container = document.body) {
    if (element && typeof Datepicker !== 'undefined') {
        new Datepicker(element, { format: 'yyyy-mm-dd', autohide: true, buttonClass: 'btn', container: container, minDate: new Date() });
    }
}

function setupInputValidations() {
    document.querySelectorAll('.amount-validation, .numeric-only, .saudi-mobile-number').forEach(input => {
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9]*');
    });
    document.body.addEventListener('input', function(event) {
        const input = event.target;
        if (input.classList.contains('amount-validation')) {
            let value = input.value.replace(/[^0-9.]/g, '');
            const parts = value.split('.');
            if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
            if (parts[1] && parts[1].length > 2) {
                parts[1] = parts[1].substring(0, 2);
                value = parts.join('.');
            }
            input.value = value;
        } else if (input.classList.contains('numeric-only')) {
            input.value = input.value.replace(/\D/g, '');
        } else if (input.classList.contains('saudi-mobile-number')) {
            let value = input.value.replace(/\D/g, '');
            if (value.length >= 1 && value[0] !== '0') value = '0' + value;
            if (value.length >= 2 && value.substring(0, 2) !== '05') value = '05' + value.substring(2);
            input.value = value.substring(0, 10);
        }
    });
    document.body.addEventListener('focusout', function(event) {
        const input = event.target;
        if (input.classList.contains('amount-validation')) {
            let value = parseFloat(input.value);
            if (!isNaN(value)) input.value = value.toFixed(2);
        } else if (input.classList.contains('saudi-mobile-number')) {
            const value = input.value;
            const isValid = /^05\d{8}$/.test(value);
            input.classList.toggle('is-invalid', value && !isValid);
        } else if (input.classList.contains('email-validation')) {
            const value = input.value;
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            input.classList.toggle('is-invalid', value && !isValid);
        }
    });
}

// --- Common Page Setup ---

async function enforceAuthentication() {
    const isProtectedPage = !window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('index.php');
    if (isProtectedPage) {
        const authStatus = await fetchData('api/auth.php?action=check_auth');
        
        if (!authStatus || !authStatus.authenticated) {
            redirectToLogin();
            return;
        }

        if (authStatus.session_locked) {
            showLockScreen();
            return;
        }

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

function setupCommonEventListeners() {
    const logoutButtons = document.querySelectorAll('#logoutBtnDesktop, #logoutBtnMobile');
    logoutButtons.forEach(btn => {
        if (btn) btn.addEventListener('click', handleLogout);
    });
    setupInputValidations();
}

document.addEventListener('DOMContentLoaded', () => {
    enforceAuthentication();
    setupCommonEventListeners();
    const isProtectedPage = !window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('index.php');
    if (isProtectedPage) {
        startInactivityTimer();
    }
});
