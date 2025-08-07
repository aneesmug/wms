// public/js/returns.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const returnProcessingArea = document.getElementById('returnProcessingArea');
    const selectedReturnNumber = document.getElementById('selectedReturnNumber');
    const currentReturnIdInput = document.getElementById('currentReturnId');
    const returnItemsTableBody = document.getElementById('returnItemsTableBody');

    // --- State Variables ---
    let returnsTable = null;
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const currentWarehouseRole = localStorage.getItem('current_warehouse_role');
    
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

    initializePage();

    // --- Functions ---
    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire('Warning', 'Please select a warehouse on the Dashboard to manage returns.', 'warning');
            return;
        }
        initializeReturnsDataTable();
        await loadReturns();
    }

    function initializeReturnsDataTable() {
        returnsTable = $('#returnsTable').DataTable({
            responsive: true,
            order: [[5, 'desc']],
            columns: [
                { data: 'return_number' },
                { data: 'order_number' },
                { data: 'customer_name' },
                { data: 'reason', defaultContent: 'N/A' },
                { data: 'status' },
                { data: 'created_at' },
                { data: 'actions', orderable: false, searchable: false }
            ]
        });
        $('#returnsTable').on('draw.dt', addTableButtonListeners);
    }

    async function loadReturns() {
        try {
            const response = await fetchData('api/returns_api.php');
            if (response.success && Array.isArray(response.data)) {
                const tableData = response.data.map(ret => {
                    let actionButtons = '';
                    const canProcess = ['operator', 'manager'].includes(currentWarehouseRole) && !['Completed', 'Cancelled'].includes(ret.status);

                    if (canProcess) {
                        actionButtons = `<button class="btn btn-sm btn-primary process-return-btn" data-return-id="${ret.return_id}" data-return-number="${ret.return_number}" title="Process Return"><i class="bi bi-gear"></i></button>`;
                    } else if (['Completed', 'Processing'].includes(ret.status)) {
                        actionButtons = `<button class="btn btn-sm btn-outline-secondary view-details-btn" data-return-id="${ret.return_id}" data-return-number="${ret.return_number}" title="View Details"><i class="bi bi-eye"></i></button>`;
                    } else {
                        actionButtons = `<span class="text-muted">View Only</span>`;
                    }

                    return {
                        return_number: ret.return_number,
                        order_number: ret.order_number,
                        customer_name: ret.customer_name,
                        reason: ret.reason,
                        status: `<span class="badge bg-warning text-dark">${ret.status}</span>`,
                        created_at: new Date(ret.created_at).toLocaleDateString(),
                        actions: actionButtons
                    };
                });
                returnsTable.clear().rows.add(tableData).draw();
            }
        } catch (error) {
            Swal.fire('Error', `Could not load returns: ${error.message}`, 'error');
        }
    }

    function addTableButtonListeners() {
        $('#returnsTable tbody').off('click', '.process-return-btn, .view-details-btn').on('click', '.process-return-btn, .view-details-btn', function() {
            const returnId = this.dataset.returnId;
            const returnNumber = this.dataset.returnNumber;

            currentReturnIdInput.value = returnId;
            selectedReturnNumber.textContent = `#${returnNumber}`;
            returnProcessingArea.classList.remove('d-none');
            
            loadReturnItems(returnId);
            
            $('html, body').animate({
                scrollTop: $("#returnProcessingArea").offset().top
            }, 500);
        });
    }

    async function loadReturnItems(returnId) {
        returnItemsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">Loading items...</td></tr>`;
        try {
            const response = await fetchData(`api/returns_api.php?return_id=${returnId}`);
            if (response.success && response.data) {
                populateReturnItemsTable(response.data.items);
            } else {
                returnItemsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">Could not load items.</td></tr>`;
            }
        } catch (error) {
            Swal.fire('Error', `Could not load return items: ${error.message}`, 'error');
        }
    }

    function populateReturnItemsTable(items) {
        returnItemsTableBody.innerHTML = '';
        if (items.length === 0) {
            returnItemsTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No items found for this return.</td></tr>`;
            return;
        }

        items.forEach(item => {
            const isFullyProcessed = item.processed_quantity >= item.expected_quantity;
            const mainRow = returnItemsTableBody.insertRow();
            mainRow.className = isFullyProcessed ? 'table-success fw-bold' : 'fw-bold';

            mainRow.innerHTML = `
                <td>${item.sku}</td>
                <td>${item.product_name}</td>
                <td>${item.article_no || 'N/A'}</td>
                <td>${item.expected_quantity}</td>
                <td>${item.processed_quantity}</td>
                <td>${item.condition || 'N/A'}</td>
                <td></td>
                <td class="text-center">
                    ${!isFullyProcessed ? `<button class="btn btn-sm btn-info inspect-item-btn" 
                                            data-return-item-id="${item.return_item_id}" 
                                            data-product-id="${item.product_id}" 
                                            data-remaining-qty="${item.expected_quantity - item.processed_quantity}"
                                            title="Inspect & Put Away">
                                            <i class="bi bi-box-arrow-in-down"></i>
                                         </button>` : '<span class="badge bg-success">Complete</span>'}
                </td>
            `;

            if (item.putaways && item.putaways.length > 0) {
                item.putaways.forEach(putaway => {
                    const putawayRow = returnItemsTableBody.insertRow();
                    putawayRow.className = 'table-light';
                    putawayRow.innerHTML = `
                        <td colspan="6" class="text-end fst-italic py-1">
                            ↳ Putaway to <strong>${putaway.location_code}</strong>
                        </td>
                        <td class="py-1">${putaway.quantity}</td>
                        <td class="text-center py-1">
                            <button class="btn btn-sm btn-outline-secondary reprint-sticker-btn" data-inventory-id="${putaway.inventory_id}" title="Reprint Sticker">
                                <i class="bi bi-printer"></i>
                            </button>
                        </td>
                    `;
                });
            }
        });

        $('.inspect-item-btn').off('click').on('click', showInspectionModal);
        $('.reprint-sticker-btn').off('click').on('click', function() {
            const inventoryId = $(this).data('inventory-id');
            $('#print-frame-returns').attr('src', `print_label_returns.php?inventory_id=${inventoryId}`);
        });
    }

    async function showInspectionModal(event) {
        const button = event.currentTarget;
        const returnItemId = button.dataset.returnItemId;
        const productId = button.dataset.productId;
        const remainingQty = button.dataset.remainingQty;

        const { value: formValues } = await Swal.fire({
            title: 'Inspect & Put Away Item',
            html: `
                <form id="inspectForm" class="text-start mt-3">
                    <div class="mb-3">
                        <label for="swal-quantity" class="form-label">Quantity to Process</label>
                        <input type="number" id="swal-quantity" class="form-control" value="${remainingQty}" min="1" max="${remainingQty}" required>
                    </div>
                    <div class="mb-3">
                        <label for="swal-condition" class="form-label">Condition</label>
                        <select id="swal-condition" class="form-select">
                            <option value="Good" selected>Good (Return to Stock)</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Scrap">Scrap</option>
                        </select>
                    </div>
                    <div id="putaway-location-group" class="mb-3">
                        <label for="swal-location-select" class="form-label">Putaway Location</label>
                        <select id="swal-location-select" class="form-select" style="width:100%"></select>
                    </div>
                </form>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Submit Inspection',
            didOpen: async () => {
                const conditionSelect = document.getElementById('swal-condition');
                const locationGroup = document.getElementById('putaway-location-group');
                const quantityInput = document.getElementById('swal-quantity');
                const $locationSelect = $('#swal-location-select');

                const formatLocation = (location) => {
                    if (!location.id) return location.text;
                    
                    const $option = $(location.element);
                    const available = parseInt($option.data('available'), 10);
                    const isFull = $option.data('full') === true;
                    const quantityToMove = parseInt(quantityInput.value, 10) || 0;
                    
                    let badge = '';

                    if (isFull) {
                        badge = `<span class="badge bg-danger float-end">Full</span>`;
                    } else if (!isNaN(available) && quantityToMove > available) {
                        badge = `<span class="badge bg-danger float-end">Not enough space (Avail: ${available})</span>`;
                    } else if (available !== null && available !== undefined) {
                        badge = `<span class="badge bg-success float-end">Available: ${available}</span>`;
                    } else {
                        badge = `<span class="badge bg-success float-end">Available: &infin;</span>`;
                    }
                    
                    return $(`<div>${location.text} ${badge}</div>`);
                };

                $locationSelect.select2({
                    placeholder: 'Loading locations...',
                    theme: 'bootstrap-5',
                    dropdownParent: $('.swal2-container'),
                    templateResult: formatLocation,
                    templateSelection: formatLocation,
                    escapeMarkup: m => m
                });

                try {
                    const response = await fetchData(`api/returns_api.php?action=get_putaway_locations&warehouse_id=${currentWarehouseId}`);
                    $locationSelect.empty().append(new Option('', '', true, true));
                    if (response.success && Array.isArray(response.data)) {
                        response.data.forEach(loc => {
                            const option = new Option(loc.location_code, loc.location_code, false, false);
                            option.dataset.available = loc.available_capacity;
                            option.dataset.full = loc.is_full;
                            $locationSelect.append(option);
                        });
                    }
                    validateLocationCapacity();
                } catch (e) {
                    console.error("Failed to load locations", e);
                    $locationSelect.select2({ placeholder: 'Error loading locations', theme: 'bootstrap-5', dropdownParent: $('.swal2-container') });
                }

                function validateLocationCapacity() {
                    const quantity = parseInt(quantityInput.value, 10);
                    if (isNaN(quantity) || quantity <= 0) return;

                    $locationSelect.find('option').each(function() {
                        const option = $(this);
                        if (!option.val()) return;
                        
                        const available = parseInt(option.data('available'), 10);
                        if (!isNaN(available) && quantity > available) {
                            option.prop('disabled', true);
                        } else {
                            option.prop('disabled', false);
                        }
                    });
                    
                    $locationSelect.select2('destroy').select2({
                        placeholder: 'Scan or select a location...',
                        theme: 'bootstrap-5',
                        dropdownParent: $('.swal2-container'),
                        templateResult: formatLocation,
                        templateSelection: formatLocation,
                        escapeMarkup: m => m
                    });
                }

                quantityInput.addEventListener('input', validateLocationCapacity);
                conditionSelect.addEventListener('change', (e) => {
                    locationGroup.style.display = e.target.value === 'Good' ? 'block' : 'none';
                });
            },
            preConfirm: () => {
                const quantity = document.getElementById('swal-quantity').value;
                const condition = document.getElementById('swal-condition').value;
                const locationCode = document.getElementById('swal-location-select').value;

                if (!quantity || parseInt(quantity) <= 0 || parseInt(quantity) > remainingQty) {
                    Swal.showValidationMessage(`Please enter a quantity between 1 and ${remainingQty}.`);
                    return false;
                }
                if (condition === 'Good' && !locationCode) {
                    Swal.showValidationMessage('A putaway location is required for items in good condition.');
                    return false;
                }
                return {
                    return_item_id: returnItemId,
                    quantity: parseInt(quantity),
                    condition: condition,
                    location_barcode: locationCode
                };
            }
        });

        if (formValues) {
            handleProcessItem(formValues);
        }
    }

    async function handleProcessItem(data) {
        try {
            const result = await fetchData('api/returns_api.php?action=process_item', 'POST', data);
            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Putaway Successful!',
                    text: result.message,
                    showCancelButton: true,
                    confirmButtonText: '<i class="bi bi-printer"></i> Print Stickers',
                    cancelButtonText: 'Close',
                }).then((dialogResult) => {
                    if (dialogResult.isConfirmed && result.inventory_id) {
                        $('#print-frame-returns').attr('src', `print_label_returns.php?inventory_id=${result.inventory_id}`);
                    }
                });

                const currentReturnId = currentReturnIdInput.value;
                if (currentReturnId) {
                    await loadReturnItems(currentReturnId);
                }
                await loadReturns();
            }
        } catch (error) {
            Swal.fire('Error', `Failed to process item: ${error.message}`, 'error');
        }
    }
});
