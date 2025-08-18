/*
* MODIFICATION SUMMARY:
* 1. INTEGRATED TRANSLATION: Replaced all user-facing strings with the global `__` function to support multi-language capabilities. This includes modal titles, button texts, placeholders, and confirmation/error messages.
* 2. Updated the `loadLocations` function to filter the source locations. The "From Location" dropdown will now only display locations that have an occupied capacity greater than zero.
* 3. The "To Location" dropdown will still show all valid destination locations (including empty ones).
* 4. Added references for the new error message div and the submit button.
* 5. Created a new comprehensive validation function `handleQuantityChange` that is called whenever the transfer quantity is modified.
* 6. This function first checks if the entered quantity exceeds the available stock. If it does, it disables the "To Location" and "Submit" buttons and displays an error message.
* 7. If the quantity is valid, it clears the error and proceeds to call `validateToLocationCapacity` to check destination space.
* 8. The submit button is now enabled only when all conditions are met (valid quantity and a selected destination).
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & DOM Elements ---
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');
    const transferForm = document.getElementById('transferForm');
    const fromLocationSelect = $('#fromLocationSelect');
    const toLocationSelect = $('#toLocationSelect');
    const productSelect = $('#productSelect');
    const quantityInput = document.getElementById('quantityInput');
    const availableQtyInput = document.getElementById('availableQtyInput');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const submitTransferBtn = document.getElementById('submitTransferBtn');
    const quantityErrorMessage = document.getElementById('quantity-error-message');

    let allLocations = [];

    // --- Initial Page Load ---
    initializePage();

    // --- Event Listeners ---
    fromLocationSelect.on('change', handleFromLocationChange);
    productSelect.on('change', handleProductChange);
    quantityInput.addEventListener('input', handleQuantityChange);
    toLocationSelect.on('change', handleQuantityChange);
    transferForm.addEventListener('submit', handleFormSubmit);
    clearFormBtn.addEventListener('click', resetForm);

    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            return Swal.fire({
                title: __('no_warehouse_selected'),
                text: __('select_warehouse_on_dashboard'),
                icon: 'warning',
                confirmButtonText: __('go_to_dashboard'),
                allowOutsideClick: false,
            }).then(() => { window.location.href = 'dashboard.php'; });
        }

        fromLocationSelect.select2({ 
            theme: 'bootstrap-5', 
            placeholder: __('select_source_location'),
            templateResult: formatLocationOption,
            templateSelection: formatLocationOption,
            escapeMarkup: m => m
        });
        toLocationSelect.select2({ 
            theme: 'bootstrap-5', 
            placeholder: __('select_a_destination'),
            templateResult: formatLocationOption,
            templateSelection: formatLocationOption,
            escapeMarkup: m => m
        });
        productSelect.select2({
            theme: 'bootstrap-5',
            placeholder: __('select_product_to_move'),
            templateResult: formatProductOption,
            templateSelection: formatProductSelection
        });

        await loadLocations();
        resetForm();
    }

    async function loadLocations() {
        try {
            const response = await fetchData(`api/locations_api.php?warehouse_id=${currentWarehouseId}`);
            if (response.success && Array.isArray(response.data)) {
                allLocations = response.data.filter(loc => 
                    loc.is_locked != 1 && 
                    loc.location_type !== 'block_area' &&
                    loc.is_active == 1
                ).map(loc => ({
                    ...loc,
                    available_capacity: loc.max_capacity_units === null ? null : loc.max_capacity_units - loc.occupied_capacity
                }));

                const fromLocations = allLocations.filter(loc => loc.occupied_capacity > 0);
                
                updateLocationDropdown(fromLocationSelect, fromLocations);
            } else {
                throw new Error(response.message || __('failed_to_load_locations'));
            }
        } catch (error) {
            console.error('Error loading locations:', error);
            Swal.fire(__('error'), __('could_not_load_locations'), 'error');
        }
    }

    function updateLocationDropdown($selectElement, locations) {
        const currentValue = $selectElement.val();
        $selectElement.empty().append(new Option('', '', true, true));
        locations.forEach(loc => {
            const option = new Option(loc.location_code, loc.location_id, false, false);
            $(option).data('locationData', loc);
            $selectElement.append(option);
        });

        if (locations.some(loc => loc.location_id == currentValue)) {
            $selectElement.val(currentValue);
        } else {
            $selectElement.val(null);
        }
        $selectElement.trigger('change.select2');
    }

    async function handleFromLocationChange() {
        const fromLocationId = fromLocationSelect.val();
        
        resetProductAndQuantity();
        updateLocationDropdown(toLocationSelect, []);
        toLocationSelect.prop('disabled', true);

        if (fromLocationId) {
            const destinationLocations = allLocations.filter(loc => loc.location_id != fromLocationId);
            updateLocationDropdown(toLocationSelect, destinationLocations);
            toLocationSelect.prop('disabled', false);
            await loadProductsForLocation(fromLocationId);
        }
    }

    async function loadProductsForLocation(locationId) {
        productSelect.prop('disabled', true).empty();
        try {
            const response = await fetchData(`api/inventory_api.php?action=get_inventory_by_location&location_id=${locationId}`);
            if (response.success && Array.isArray(response.data)) {
                productSelect.append(new Option('', '', true, true));
                if (response.data.length === 0) {
                     Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: __('no_stock_at_this_location'), showConfirmButton: false, timer: 3000 });
                } else {
                    response.data.forEach(item => {
                        const optionText = `${item.article_no || item.sku} - ${item.product_name}`;
                        const option = new Option(optionText, item.inventory_id, false, false);
                        $(option).data('itemData', item);
                        productSelect.append(option);
                    });
                }
                productSelect.prop('disabled', false);
                productSelect.val(null).trigger('change.select2');
            } else {
                throw new Error(response.message || __('failed_to_load_products_for_location'));
            }
        } catch (error) {
            console.error('Error loading products:', error);
            Swal.fire(__('error'), error.message, 'error');
        }
    }

    function handleProductChange() {
        const selectedOption = productSelect.find('option:selected');
        const item = $(selectedOption).data('itemData');

        if (item && item.quantity) {
            availableQtyInput.value = item.quantity;
            quantityInput.disabled = false;
            quantityInput.max = item.quantity;
            quantityInput.value = 1;
        } else {
            resetAvailableAndTransferQty();
        }
        handleQuantityChange();
    }

    function handleQuantityChange() {
        const quantityToMove = parseInt(quantityInput.value, 10);
        const maxQuantity = parseInt(quantityInput.max, 10);
        let isStockValid = true;

        if (quantityToMove > maxQuantity) {
            quantityErrorMessage.textContent = __('quantity_exceeds_available_stock');
            toLocationSelect.prop('disabled', true);
            isStockValid = false;
        } else {
            quantityErrorMessage.textContent = '';
            if (fromLocationSelect.val()) {
                toLocationSelect.prop('disabled', false);
            }
        }

        validateToLocationCapacity();

        const isFormComplete = fromLocationSelect.val() && productSelect.val() && toLocationSelect.val() && quantityToMove > 0;
        submitTransferBtn.disabled = !isStockValid || !isFormComplete;
    }

    function validateToLocationCapacity() {
        const quantityToMove = parseInt(quantityInput.value, 10) || 0;
        let isSelectedDisabled = false;

        toLocationSelect.find('option').each(function() {
            const option = $(this);
            const locationData = option.data('locationData');
            if (!locationData) return;

            if (locationData.available_capacity === null || (quantityToMove > 0 && quantityToMove > locationData.available_capacity)) {
                option.prop('disabled', true);
                if (option.is(':selected')) {
                    isSelectedDisabled = true;
                }
            } else {
                option.prop('disabled', false);
            }
        });

        if (isSelectedDisabled) {
            toLocationSelect.val(null).trigger('change.select2');
        } else {
            toLocationSelect.trigger('change.select2');
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        const inventoryId = productSelect.val();
        const toLocationId = toLocationSelect.val();
        const quantity = parseInt(quantityInput.value, 10);
        const maxQuantity = parseInt(quantityInput.max, 10);
        const selectedProductOption = productSelect.find('option:selected');
        const selectedToLocationOption = toLocationSelect.find('option:selected');

        if (!inventoryId || !toLocationId || !quantity || quantity <= 0 || quantity > maxQuantity) {
            return Swal.fire(__('invalid_input'), __('correct_errors_before_submit'), 'error');
        }

        const payload = {
            action: 'internal_transfer',
            inventory_id: inventoryId,
            to_location_id: toLocationId,
            quantity: quantity
        };

        Swal.fire({
            title: __('confirm_transfer'),
            html: `${__('are_you_sure_transfer')} <strong>${quantity}</strong> ${__('unit_s_of')} <strong>${selectedProductOption.text()}</strong> ${__('to_location')} <strong>${selectedToLocationOption.text()}</strong>?`,
            icon: 'question',
            showCancelButton: true,
            cancelButtonText: __('cancel'),
            confirmButtonText: __('yes_transfer_it'),
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetchData('api/inventory_api.php', 'POST', payload);
                    if (response.success) {
                        await Swal.fire(__('success'), response.message, 'success');
                        await loadLocations();
                        resetForm();
                    } else {
                        throw new Error(response.message || __('an_unknown_error_occurred'));
                    }
                } catch (error) {
                    console.error('Transfer failed:', error);
                    Swal.fire(__('transfer_failed'), error.message, 'error');
                }
            }
        });
    }

    // --- Helper Functions ---

    function resetForm() {
        transferForm.reset();
        fromLocationSelect.val(null).trigger('change');
    }

    function resetProductAndQuantity() {
        productSelect.empty().append(new Option('', '', true, true)).prop('disabled', true);
        productSelect.val(null).trigger('change.select2');
        resetAvailableAndTransferQty();
    }

    function resetAvailableAndTransferQty() {
        availableQtyInput.value = '';
        availableQtyInput.placeholder = __('select_a_product');
        quantityInput.value = '';
        quantityInput.disabled = true;
        quantityErrorMessage.textContent = '';
        submitTransferBtn.disabled = true;
        validateToLocationCapacity();
    }

    function formatLocationOption(state) {
        if (!state.id) { return state.text; }
        const locationData = $(state.element).data('locationData');
        if (!locationData) { return state.text; }

        const quantityToMove = parseInt(quantityInput.value, 10) || 0;
        const available = locationData.available_capacity;
        let badge = '';

        if (available === null) {
            badge = `<span class="badge bg-secondary float-end">${__('space_not_set')}</span>`;
        } else if (quantityToMove > 0 && quantityToMove > available) {
            badge = `<span class="badge bg-danger float-end">${__('space_not_available')} (${__('avail')}: ${available})</span>`;
        } else {
            badge = `<span class="badge bg-success float-end">${__('available')}: ${available}</span>`;
        }
        
        return `<div>${state.text}${badge}</div>`;
    }

    function formatProductOption(state) {
        if (!state.id) { return state.text; }
        const item = $(state.element).data('itemData');
        if (!item) { return state.text; }

        const batchInfo = item.batch_number ? `${__('batch')}: ${item.batch_number}` : '';
        const dotInfo = item.dot_code ? `${__('dot')}: ${item.dot_code}` : '';
        const details = [batchInfo, dotInfo].filter(Boolean).join(', ');

        return $(`
            <div>
                <div>${state.text}</div>
                <small class="text-muted">${__('available')}: ${item.quantity} | ${details}</small>
            </div>
        `);
    }

    function formatProductSelection(state) {
        return state.text || __('select_product_to_move');
    }
});
