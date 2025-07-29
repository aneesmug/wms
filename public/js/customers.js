// public/js/customers.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    
    // --- State & Config ---
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    let customersTable = null;

    if (addCustomerBtn) addCustomerBtn.addEventListener('click', () => showCustomerForm(null));

    initializePage();

    async function initializePage() {
        const canManage = ['operator', 'manager'].includes(currentWarehouseRole);
        if (addCustomerBtn) addCustomerBtn.style.display = canManage ? 'block' : 'none';
        
        initializeCustomersDataTable();
        await loadCustomers();
    }

    function initializeCustomersDataTable() {
        customersTable = $('#customersTable').DataTable({
            responsive: true,
            "order": [[1, "asc"]],
            columns: [
                { data: 'customer_code', defaultContent: 'N/A' },
                { data: 'customer_name' },
                { data: 'contact_person', defaultContent: 'N/A' },
                { data: 'phone', defaultContent: 'N/A' },
                // MODIFICATION: Added order_count column
                { data: 'order_count', className: 'text-center' },
                { 
                    data: null,
                    orderable: false,
                    className: 'text-end',
                    render: function(data, type, row) {
                        const canDelete = currentWarehouseRole === 'manager';
                        let actionsHtml = `<a href="customer_details.php?id=${row.customer_id}" class="btn btn-sm btn-outline-secondary view-details-btn" title="View Details"><i class="bi bi-person-lines-fill"></i></a>`;
                        if (canDelete) {
                            actionsHtml += `<button data-id="${row.customer_id}" class="btn btn-sm btn-outline-danger delete-btn ms-2" title="Delete"><i class="bi bi-trash"></i></button>`;
                        }
                        return actionsHtml;
                    }
                }
            ]
        });
        $('#customersTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadCustomers() {
        try {
            const response = await fetchData('api/customers_api.php');
            if (response?.success && Array.isArray(response.data)) {
                customersTable.clear().rows.add(response.data).draw();
            }
        } catch (error) {
            Swal.fire('Error', `Could not load customers: ${error.message}`, 'error');
        }
    }

    async function showCustomerForm(customer) {
        const isEditing = customer !== null;
        Swal.fire({
            title: isEditing ? `Edit Customer: ${customer.customer_name}` : 'Add New Customer',
            html: `
                <form id="swalCustomerForm" class="text-start mt-3">
                    <div class="row">
                        <div class="col-md-6 mb-3"><label for="swal-customerName" class="form-label">Customer Name*</label><input type="text" id="swal-customerName" class="form-control" value="${isEditing ? customer.customer_name : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-customerCode" class="form-label">Customer Code*</label><input type="text" id="swal-customerCode" class="form-control" value="${isEditing ? customer.customer_code || '' : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-contactPerson" class="form-label">Contact Person*</label><input type="text" id="swal-contactPerson" class="form-control" value="${isEditing ? customer.contact_person || '' : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-email" class="form-label">Email</label><input type="email" id="swal-email" class="form-control" value="${isEditing ? customer.email || '' : ''}"></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone" class="form-label">Phone*</label><input type="tel" id="swal-phone" class="form-control" value="${isEditing ? customer.phone || '' : ''}" required></div>
                        <div class="col-md-6 mb-3"><label for="swal-phone2" class="form-label">Alt. Phone</label><input type="tel" id="swal-phone2" class="form-control" value="${isEditing ? customer.phone2 || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine1" class="form-label">Address Line 1*</label><input type="text" id="swal-addressLine1" class="form-control" value="${isEditing ? customer.address_line1 || '' : ''}" required></div>
                        <div class="col-12 mb-3"><label for="swal-addressLine2" class="form-label">Address Line 2</label><input type="text" id="swal-addressLine2" class="form-control" value="${isEditing ? customer.address_line2 || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-city" class="form-label">City*</label><input type="text" id="swal-city" class="form-control" value="${isEditing ? customer.city || '' : ''}" required></div>
                        <div class="col-md-4 mb-3"><label for="swal-state" class="form-label">State</label><input type="text" id="swal-state" class="form-control" value="${isEditing ? customer.state || '' : ''}"></div>
                        <div class="col-md-4 mb-3"><label for="swal-zipCode" class="form-label">Zip Code</label><input type="text" id="swal-zipCode" class="form-control" value="${isEditing ? customer.zip_code || '' : ''}"></div>
                        <div class="col-12 mb-3"><label for="swal-country" class="form-label">Country*</label><input type="text" id="swal-country" class="form-control" value="${isEditing ? customer.country || '' : ''}" required></div>
                    </div>
                </form>`,
            width: '800px', showCancelButton: true, confirmButtonText: isEditing ? 'Save Changes' : 'Create Customer', focusConfirm: false,
            preConfirm: () => {
                const requiredFields = {
                    'swal-customerName': 'Customer Name',
                    'swal-customerCode': 'Customer Code',
                    'swal-contactPerson': 'Contact Person',
                    'swal-phone': 'Phone',
                    'swal-addressLine1': 'Address Line 1',
                    'swal-city': 'City',
                    'swal-country': 'Country'
                };
                const missingFields = [];
                for (const [id, name] of Object.entries(requiredFields)) {
                    const input = document.getElementById(id);
                    if (!input.value.trim()) {
                        missingFields.push(name);
                    }
                }

                if (missingFields.length > 0) {
                    Swal.showValidationMessage(`The following fields are required: ${missingFields.join(', ')}`);
                    return false;
                }

                return {
                    customer_id: isEditing ? customer.customer_id : null,
                    customer_name: document.getElementById('swal-customerName').value,
                    customer_code: document.getElementById('swal-customerCode').value,
                    contact_person: document.getElementById('swal-contactPerson').value,
                    email: document.getElementById('swal-email').value,
                    phone: document.getElementById('swal-phone').value,
                    phone2: document.getElementById('swal-phone2').value,
                    address_line1: document.getElementById('swal-addressLine1').value,
                    address_line2: document.getElementById('swal-addressLine2').value,
                    city: document.getElementById('swal-city').value,
                    state: document.getElementById('swal-state').value,
                    zip_code: document.getElementById('swal-zipCode').value,
                    country: document.getElementById('swal-country').value,
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const data = result.value;
                const method = isEditing ? 'PUT' : 'POST';
                try {
                    const apiResult = await fetchData('api/customers_api.php', method, data);
                    if (apiResult?.success) {
                        Swal.fire('Success!', apiResult.message, 'success');
                        await loadCustomers();
                    }
                } catch (error) { Swal.fire('Error!', error.message, 'error'); }
            }
        });
    }

    function addTableButtonListeners() {
        $('#customersTable tbody').off('click').on('click', '.delete-btn', handleDeleteClick);
    }

    function handleDeleteClick(event) {
        const id = event.target.closest('button').dataset.id;
        Swal.fire({ title: 'Delete Customer?', text: "This may fail if they have existing orders. This action cannot be undone.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const apiResult = await fetchData(`api/customers_api.php?action=delete`, 'POST', { id: id });
                    if (apiResult?.success) { 
                        Swal.fire('Deleted!', 'Customer has been deleted.', 'success'); 
                        await loadCustomers(); 
                    }
                } catch (error) { 
                    Swal.fire('Error', error.message, 'error'); 
                }
            }
        });
    }
});
