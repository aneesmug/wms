/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings in UI elements, alerts, and modals with the `__()` translation function.
* 2. This includes placeholders, DataTable language settings, SweetAlert2 titles and messages, and error notifications.
* 3. The entire JavaScript functionality for this page is now fully localizable.
*/

document.addEventListener('DOMContentLoaded', () => {
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    let companiesTable = null;
    let allCompanies = [];

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

    function initializePage() {
        initializeCompaniesDataTable();
        loadCompanies();
    }

    function initializeCompaniesDataTable() {
        companiesTable = $('#companiesTable').DataTable({
            responsive: true,
            order: [[1, "asc"]],
            columns: [
                {
                    className: 'dt-control',
                    orderable: false,
                    data: null,
                    defaultContent: '',
                    width: '15px'
                },
                { data: 'company_name' },
                { data: 'contact_person' },
                { data: 'phone_number' },
                { data: 'email' },
                {
                    data: 'is_active',
                    render: function (data, type, row) {
                        return data == 1 ? `<span class="badge bg-success">${__('active')}</span>` : `<span class="badge bg-danger">${__('inactive')}</span>`;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-end',
                    render: function (data, type, row) {
                        const toggleBtnIcon = row.is_active == 1 ? 'bi-toggle-off' : 'bi-toggle-on';
                        const toggleBtnClass = row.is_active == 1 ? 'btn-outline-danger' : 'btn-outline-success';
                        const toggleBtnTitle = row.is_active == 1 ? __('deactivate') : __('activate');
                        return `
                            <button class="btn btn-sm btn-success add-driver-btn" title="${__('add_driver')}" data-company-id="${row.company_id}"><i class="bi bi-person-plus-fill"></i></button>
                            <button class="btn btn-sm btn-outline-primary edit-company-btn ms-1" title="${__('edit_company')}" data-company-id="${row.company_id}"><i class="bi bi-pencil-square"></i></button>
                            <button class="btn btn-sm ${toggleBtnClass} toggle-status-btn ms-1" title="${toggleBtnTitle}" data-company-id="${row.company_id}"><i class="bi ${toggleBtnIcon}"></i></button>
                            <button class="btn btn-sm btn-outline-danger delete-company-btn ms-1" title="${__('delete_company')}" data-company-id="${row.company_id}"><i class="bi bi-trash"></i></button>
                        `;
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
            }
        });

        $('#companiesTable tbody').on('click', 'td.dt-control', handleExpandRow);
        $('#companiesTable tbody').on('click', '.edit-company-btn', handleEditCompany);
        $('#companiesTable tbody').on('click', '.toggle-status-btn', handleToggleStatus);
        $('#companiesTable tbody').on('click', '.delete-company-btn', handleDeleteCompany);
        $('#companiesTable tbody').on('click', '.add-driver-btn', handleShowAddDriverModal);
    }

    async function loadCompanies() {
        const response = await fetchData('api/delivery_companies_api.php');
        if (response.success && Array.isArray(response.data)) {
            allCompanies = response.data;
            companiesTable.clear().rows.add(allCompanies).draw();
        } else {
            Toast.fire({ icon: 'error', title: __('failed_to_load_companies') });
        }
    }

    function handleExpandRow() {
        var tr = $(this).closest('tr');
        var row = companiesTable.row(tr);

        if (row.child.isShown()) {
            row.child.hide();
            tr.removeClass('dt-shown');
        } else {
            const companyData = row.data();
            row.child(__('loading_drivers')).show();
            tr.addClass('dt-shown');
            
            fetchData(`api/delivery_companies_api.php?action=getDrivers&company_id=${companyData.company_id}`)
                .then(response => {
                    if(response.success) {
                        row.child(formatDriverTable(response.data, companyData.company_id)).show();
                        tr.next().find('.edit-driver-btn').on('click', handleEditDriver);
                        tr.next().find('.delete-driver-btn').on('click', handleDeleteDriver);
                    } else {
                        row.child(__('could_not_load_drivers')).show();
                    }
                });
        }
    }

    function formatDriverTable(drivers, companyId) {
        if (drivers.length === 0) {
            return `<div class="p-3 text-center">${__('no_drivers_found')}</div>`;
        }
        let table = '<table class="table table-sm driver-table">';
        table += `<thead class="table-light"><tr><th>${__('name')}</th><th>${__('mobile')}</th><th>${__('driver_id_number')}</th><th>${__('documents')}</th><th class="text-end">${__('actions')}</th></tr></thead><tbody>`;
        drivers.forEach(driver => {
            const idLink = driver.driver_id_path ? `<a href="${driver.driver_id_path}" target="_blank" class="btn btn-sm btn-outline-secondary"><i class="bi bi-file-earmark-person"></i> ${__('id')}</a>` : '';
            const licenseLink = driver.driver_license_path ? `<a href="${driver.driver_license_path}" target="_blank" class="btn btn-sm btn-outline-secondary ms-1"><i class="bi bi-card-checklist"></i> ${__('license')}</a>` : '';
            
            table += `
                <tr>
                    <td>${driver.driver_name}</td>
                    <td>${driver.driver_mobile}</td>
                    <td>${driver.driver_id_number || __('n_a')}</td>
                    <td>${idLink} ${licenseLink}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary edit-driver-btn" data-company-id="${companyId}" data-driver-id="${driver.driver_id}"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger delete-driver-btn ms-1" data-driver-id="${driver.driver_id}"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        table += '</tbody></table>';
        return table;
    }
    
    function handleShowAddDriverModal(event) {
        const companyId = event.currentTarget.dataset.companyId;
        showDriverForm(companyId);
    }

    function handleEditDriver(event) {
        const companyId = event.currentTarget.dataset.companyId;
        const driverId = event.currentTarget.dataset.driverId;
        
        fetchData(`api/delivery_companies_api.php?action=getDrivers&company_id=${companyId}`)
            .then(response => {
                if(response.success) {
                    const driverData = response.data.find(d => d.driver_id == driverId);
                    if (driverData) {
                        showDriverForm(companyId, driverData);
                    } else {
                        Toast.fire({icon: 'error', title: __('driver_not_found')});
                    }
                }
            });
    }

    function showDriverForm(companyId, driverData = null) {
        const isEditing = driverData !== null;
        const title = isEditing ? __('edit_driver') : __('add_new_driver');

        Swal.fire({
            title: title,
            html: `
                <form id="driverFormSwal" class="text-start p-2" enctype="multipart/form-data">
                    <input type="hidden" name="company_id" value="${companyId}">
                    <input type="hidden" name="driver_id" value="${isEditing ? driverData.driver_id : ''}">
                    <div class="mb-3">
                        <label for="swalDriverName" class="form-label">${__('driver_name')}*</label>
                        <input type="text" class="form-control" id="swalDriverName" name="driver_name" value="${isEditing ? driverData.driver_name : ''}" required>
                    </div>
                    <div class="mb-3">
                        <label for="swalDriverMobile" class="form-label">${__('driver_mobile_no')}*</label>
                        <input type="tel" class="form-control saudi-mobile-number" id="swalDriverMobile" name="driver_mobile" value="${isEditing ? driverData.driver_mobile : ''}" required>
                    </div>
                    <div class="mb-3">
                        <label for="swalDriverIdNumber" class="form-label">${__('driver_id_number')}</label>
                        <input type="text" class="form-control numeric-only" id="swalDriverIdNumber" name="driver_id_number" value="${isEditing && driverData.driver_id_number ? driverData.driver_id_number : ''}">
                    </div>
                    <div class="mb-3">
                        <label for="swalDriverIdPath" class="form-label">${__('attach_id')}</label>
                        <input type="file" class="form-control" id="swalDriverIdPath" name="driver_id_path" accept="image/*,application/pdf">
                        ${isEditing && driverData.driver_id_path ? `<small class="text-muted mt-1 d-block">${__('current_file')}: <a href="${driverData.driver_id_path}" target="_blank">${__('view_file')}</a></small>` : ''}
                    </div>
                    <div class="mb-3">
                        <label for="swalDriverLicensePath" class="form-label">${__('attach_driving_license')}</label>
                        <input type="file" class="form-control" id="swalDriverLicensePath" name="driver_license_path" accept="image/*,application/pdf">
                        ${isEditing && driverData.driver_license_path ? `<small class="text-muted mt-1 d-block">${__('current_file')}: <a href="${driverData.driver_license_path}" target="_blank">${__('view_file')}</a></small>` : ''}
                    </div>
                </form>
            `,
            showCancelButton: true,
            confirmButtonText: __('save_driver'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            didOpen: () => {
                if (typeof setupInputValidations === 'function') setupInputValidations();
            },
            preConfirm: () => {
                const form = document.getElementById('driverFormSwal');
                if (!form.reportValidity()) {
                    Swal.showValidationMessage(__('fill_required_fields_correctly'));
                    return false;
                }
                return new FormData(form);
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const formData = result.value;
                const response = await fetchData('api/delivery_companies_api.php?action=saveDriver', 'POST', formData);
                if (response.success) {
                    Toast.fire({ icon: 'success', title: response.message });
                    loadCompanies();
                } else {
                    Swal.fire(__('error'), response.message, 'error');
                }
            }
        });
    }

    function handleDeleteDriver(event) {
        const driverId = event.currentTarget.dataset.driverId;
        Swal.fire({
            title: __('delete_driver_q'),
            text: __("action_cannot_be_undone"),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: __('yes_delete_it'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/delivery_companies_api.php?action=deleteDriver', 'POST', { driver_id: driverId });
                if (response.success) {
                    Toast.fire({ icon: 'success', title: response.message });
                    loadCompanies();
                } else {
                    Swal.fire(__('error'), response.message, 'error');
                }
            }
        });
    }

    function handleShowAddCompanyModal() { showCompanyForm(); }

    function handleEditCompany(event) {
        const companyId = event.currentTarget.dataset.companyId;
        const companyData = allCompanies.find(c => c.company_id == companyId);
        if (companyData) showCompanyForm(companyData);
    }
    
    function showCompanyForm(companyData = null) {
        const isEditing = companyData !== null;
        Swal.fire({
            title: isEditing ? __('edit_company') : __('add_new_company'),
            html: `
                <form id="companyFormSwal" class="text-start p-2">
                    <input type="hidden" name="company_id" value="${isEditing ? companyData.company_id : ''}">
                    <div class="mb-3"><label for="swalCompanyName" class="form-label">${__('company_name')}*</label><input type="text" class="form-control" id="swalCompanyName" name="company_name" value="${isEditing ? companyData.company_name : ''}" required></div>
                    <div class="mb-3"><label for="swalContactPerson" class="form-label">${__('contact_person')}</label><input type="text" class="form-control" id="swalContactPerson" name="contact_person" value="${isEditing && companyData.contact_person ? companyData.contact_person : ''}"></div>
                    <div class="mb-3"><label for="swalPhoneNumber" class="form-label">${__('phone_number')}</label><input type="tel" class="form-control saudi-mobile-number" id="swalPhoneNumber" name="phone_number" value="${isEditing && companyData.phone_number ? companyData.phone_number : ''}"></div>
                    <div class="mb-3"><label for="swalEmail" class="form-label">${__('email')}</label><input type="email" class="form-control email-validation" id="swalEmail" name="email" value="${isEditing && companyData.email ? companyData.email : ''}"></div>
                </form>
            `,
            showCancelButton: true,
            confirmButtonText: __('save_company'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
            didOpen: () => { if (typeof setupInputValidations === 'function') setupInputValidations(); },
            preConfirm: () => {
                const form = document.getElementById('companyFormSwal');
                if (!form.reportValidity()) {
                    Swal.showValidationMessage(__('fill_required_fields_correctly'));
                    return false;
                }
                const formData = new FormData(form);
                return Object.fromEntries(formData.entries());
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/delivery_companies_api.php', 'POST', result.value);
                if (response.success) {
                    Toast.fire({ icon: 'success', title: response.message });
                    loadCompanies();
                } else {
                    Swal.fire(__('error'), response.message, 'error');
                }
            }
        });
    }

    function handleToggleStatus(event) {
        const companyId = event.currentTarget.dataset.companyId;
        Swal.fire({
            title: __('change_status_q'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: __('yes_change_it'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/delivery_companies_api.php?action=toggleStatus', 'POST', { company_id: companyId });
                if (response.success) {
                    Toast.fire({ icon: 'success', title: response.message });
                    loadCompanies();
                } else {
                    Swal.fire(__('error'), response.message, 'error');
                }
            }
        });
    }

    function handleDeleteCompany(event) {
        const companyId = event.currentTarget.dataset.companyId;
        Swal.fire({
            title: __('delete_company_q'),
            text: __("delete_company_warning"),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: __('yes_delete_it'),
            cancelButtonText: __('cancel'),
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await fetchData('api/delivery_companies_api.php', 'DELETE', { company_id: companyId });
                if (response.success) {
                    Swal.fire(__('deleted'), response.message, 'success');
                    loadCompanies();
                } else {
                    Swal.fire(__('error'), response.message, 'error');
                }
            }
        });
    }

    initializePage();
    addCompanyBtn.addEventListener('click', handleShowAddCompanyModal);
});
