/*
* MODIFICATION SUMMARY:
* 1. Added an event listener to handle clicks on the new language switcher.
* 2. When a new language is selected, it calls the `update_preferred_language` API endpoint.
* 3. Upon a successful API response, it displays a confirmation message and reloads the page to apply the language change.
*/

// public/js/main.js

// --- Global Translation Function ---
// This function relies on a 'lang' object being defined in the global scope,
// typically in a <script> tag in your main layout file, populated from PHP.
// Example: <script>window.lang = <?php echo json_encode($translations); ?>;</script>
function __(key, defaultText = '') {
    // Check if the global language object has been defined by PHP.
    if (typeof window.lang === 'undefined' || window.lang === null) {
        // Log an error for easier debugging if the object is missing.
        console.error("Translation Error: The global 'lang' object is not defined. Make sure it's included correctly in your PHP template.");
        return defaultText || key;
    }

    // New check: Warn if the lang object seems empty.
    if (Object.keys(window.lang).length < 5) {
        console.warn("Translation Warning: The global 'lang' object is defined but appears to be empty or incomplete. Check the output of json_encode in your PHP template.", window.lang);
    }

    // Check if the specific key exists in the language object.
    if (typeof window.lang[key] !== 'undefined') {
        return window.lang[key];
    }

    // If the key is not found, return the default text or the key itself.
    return defaultText || key;
}


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
    if (Swal.isVisible() && Swal.getTitle() === __('session_locked')) {
        return;
    }
    pauseTimer();
    Swal.fire({
        title: __('session_locked'),
        html: `<p>${__('inactive_prompt')}</p><input type="password" id="reauth-password" class="swal2-input" placeholder="${__('password')}">`,
        icon: 'warning',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCancelButton: true,
        confirmButtonText: __('unlock'),
        cancelButtonText: __('logout'),
        preConfirm: async () => {
            const password = document.getElementById('reauth-password').value;
            if (!password) {
                Swal.showValidationMessage(__('password_required'));
                return false;
            }
            const result = await fetchData('api/auth.php?action=reauthenticate', 'POST', { password });
            if (!result || !result.success) {
                Swal.showValidationMessage(result.message || __('incorrect_password'));
                return false;
            }
            return result;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showMessageBox(__('session_unlocked'), 'success');
            resetInactivityTimer(); 
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            handleLogout();
        }
    });
}

function resetInactivityTimer() {
    if (Swal.isVisible() && Swal.getTitle() === __('session_locked')) {
        return;
    }
    clearTimeout(inactivityTimer);
    timeRemaining = INACTIVITY_TIMEOUT;
    timerStartTime = Date.now();
    timerPaused = false;
    inactivityTimer = setTimeout(showLockScreen, INACTIVITY_TIMEOUT);
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
    if (Swal.isVisible() && Swal.getTitle() === __('session_locked')) {
        const result = await fetchData('api/auth.php?action=logout', 'POST');
        if (result && result.success) redirectToLogin();
        return;
    }
    showConfirmationModal(__('confirm_logout_title'), __('confirm_logout_text'), async () => {
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
        title: __('select_warehouse_title'),
        html: `<p>${__('select_warehouse_prompt')}</p><select id="swal-warehouse-select" class="form-select mt-3">${warehouseOptions}</select>`,
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCancelButton: false,
        confirmButtonText: __('confirm_and_continue'),
        preConfirm: () => {
            const select = document.getElementById('swal-warehouse-select');
            const warehouseId = select.value;
            const warehouseName = select.options[select.selectedIndex].text;
            if (!warehouseId) {
                Swal.showValidationMessage(__('must_select_warehouse'));
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
    const displayName = user.full_name || __('user');
    let displayRole = __('no_role_assigned');
    if (user.is_global_admin) {
        displayRole = __('global_admin');
    } else if (current_warehouse_role) {
        displayRole = __(current_warehouse_role, current_warehouse_role.charAt(0).toUpperCase() + current_warehouse_role.slice(1));
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
        const isFormData = data instanceof FormData;
        
        const options = {
            method: method,
            headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        };

        if (method === 'GET') {
            url += (url.includes('?') ? '&' : '?') + `_=${new Date().getTime()}`;
        }

        if (data) {
            options.body = isFormData ? data : JSON.stringify(data);
        }

        const response = await fetch(url, options);
        // It's possible for a file upload to return no JSON body on success
        if (response.ok && response.headers.get('Content-Length') === '0') {
            return { success: true };
        }
        
        const result = await response.json();

        if (!response.ok) {
            console.error(`API Error: ${response.status} - ${result.message || __('unknown_error')}`);
            showMessageBox(result.message || `${__('error_occurred')} (Status: ${response.status})`, 'error');
            
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
        showMessageBox(__('network_error'), 'error');
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
        confirmButtonText: __('yes_confirm'),
        cancelButtonText: __('cancel'),
        allowOutsideClick: false,
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
        container.innerHTML = `<div id="filter-rules-list" class="mb-2"></div><button id="add-filter-btn" class="btn btn-sm btn-outline-secondary w-100"><i class="bi bi-plus-lg"></i> ${__('add_rule')}</button><hr class="my-2"><div class="d-flex justify-content-end"><button id="clear-filters-btn" class="btn btn-sm btn-light me-2">${__('clear')}</button><button id="apply-filters-btn" class="btn btn-sm btn-primary">${__('apply')}</button></div>`;
        addFilterRule();
    };
    const addFilterRule = () => {
        const list = document.getElementById('filter-rules-list');
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'filter-rule p-2 mb-2 border rounded';
        const columnOptions = columnsConfig.map(c => `<option value="${c.columnIndex}">${c.title}</option>`).join('');
        ruleDiv.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2"><select class="form-select form-select-sm filter-column">${columnOptions}</select><button class="btn btn-sm btn-outline-danger remove-rule-btn ms-2"><i class="bi bi-trash"></i></button></div><div class="d-flex"><select class="form-select form-select-sm filter-condition me-1" style="width: 100px;"><option value="contain">${__('contain')}</option><option value="exact">${__('exact')}</option><option value="startsWith">${__('starts_with')}</option><option value="endsWith">${__('ends_with')}</option></select><input type="text" class="form-control form-control-sm filter-value" placeholder="${__('keyword')}..."></div>`;
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
                    title: __('no_warehouse_access_title'),
                    text: __('no_warehouse_access_text'),
                    icon: 'error',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    confirmButtonText: __('logout')
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

    // Language Switcher Logic
    document.body.addEventListener('click', async (event) => {
        const langLink = event.target.closest('[data-lang]');
        if (!langLink) return;

        event.preventDefault();
        const selectedLang = langLink.dataset.lang;
        const currentLang = document.documentElement.lang;

        if (selectedLang === currentLang) {
            return; // Do nothing if already selected
        }

        const result = await fetchData('api/users_api.php?action=update_preferred_language', 'POST', { lang: selectedLang });

        if (result && result.success) {
            const message = selectedLang === 'ar' 
                ? 'تم تحديث اللغة. سيتم تحديث الصفحة...' 
                : 'Language updated. The page will now refresh...';

            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
            });

            await Toast.fire({ icon: 'success', title: message });
            window.location.reload();
        }
        // Error case is handled by fetchData which shows a message.
    });

    // Card Actions (Refresh, Maximize, Close)
    document.body.addEventListener('click', function(event) {
        const button = event.target.closest('.btn-card-header');
        if (!button) return;

        const card = button.closest('.card');
        if (!card) return;

        const action = button.dataset.action;

        switch (action) {
            case 'refresh':
                location.reload();
                break;
            case 'maximize':
                card.classList.toggle('card-maximized');
                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.toggle('bi-arrows-fullscreen');
                    icon.classList.toggle('bi-arrows-angle-contract');
                }
                break;
            case 'close':
                card.style.display = 'none';
                break;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    enforceAuthentication();
    setupCommonEventListeners();
    const isProtectedPage = !window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('index.php');
    if (isProtectedPage) {
        startInactivityTimer();
    }
});
