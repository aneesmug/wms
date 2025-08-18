// js/inventory_transfer.js
// --- MODIFICATION SUMMARY ---
// 1. Updated the `loadLocations` function to filter the source locations. The "From Location" dropdown will now only display locations that have an occupied capacity greater than zero.
// 2. The "To Location" dropdown will still show all valid destination locations (including empty ones).
// 3. Added references for the new error message div and the submit button.
// 4. Created a new comprehensive validation function `handleQuantityChange` that is called whenever the transfer quantity is modified.
// 5. This function first checks if the entered quantity exceeds the available stock. If it does, it disables the "To Location" and "Submit" buttons and displays an error message.
// 6. If the quantity is valid, it clears the error and proceeds to call `validateToLocationCapacity` to check destination space.
// 7. The submit button is now enabled only when all conditions are met (valid quantity and a selected destination).

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
    toLocationSelect.on('change', handleQuantityChange); // Also validate on destination change
    transferForm.addEventListener('submit', handleFormSubmit);
    clearFormBtn.addEventListener('click', resetForm);

    // --- Core Functions ---

    /**
     * Initializes the page, sets up Select2 dropdowns, and loads initial data.
     */
    async function initializePage() {
        if (!currentWarehouseId) {
            return Swal.fire({
                title: 'No Warehouse Selected',
                text: 'Please select a warehouse on the Dashboard to continue.',
                icon: 'warning',
                confirmButtonText: 'Go to Dashboard',
                allowOutsideClick: false,
            }).then(() => { window.location.href = 'dashboard.php'; });
        }

        fromLocationSelect.select2({ 
            theme: 'bootstrap-5', 
            placeholder: 'Select a source location',
            templateResult: formatLocationOption,
            templateSelection: formatLocationOption,
            escapeMarkup: m => m
        });
        toLocationSelect.select2({ 
            theme: 'bootstrap-5', 
            placeholder: 'Select a destination',
            templateResult: formatLocationOption,
            templateSelection: formatLocationOption,
            escapeMarkup: m => m
        });
        productSelect.select2({
            theme: 'bootstrap-5',
            placeholder: 'Select a product to move',
            templateResult: formatProductOption,
            templateSelection: formatProductSelection
        });

        await loadLocations();
        resetForm();
    }

    /**
     * Loads all valid warehouse locations for transfers.
     */
    async function loadLocations() {
        try {
            const response = await fetchData(`api/locations_api.php?warehouse_id=${currentWarehouseId}`);
            if (response.success && Array.isArray(response.data)) {
                // allLocations stores all valid destinations
                allLocations = response.data.filter(loc => 
                    loc.is_locked != 1 && 
                    loc.location_type !== 'block_area' &&
                    loc.is_active == 1
                ).map(loc => ({
                    ...loc,
                    available_capacity: loc.max_capacity_units === null ? null : loc.max_capacity_units - loc.occupied_capacity
                }));

                // fromLocations is a subset of allLocations, only containing locations with stock
                const fromLocations = allLocations.filter(loc => loc.occupied_capacity > 0);
                
                updateLocationDropdown(fromLocationSelect, fromLocations);
            } else {
                throw new Error(response.message || 'Failed to load locations.');
            }
        } catch (error) {
            console.error('Error loading locations:', error);
            Swal.fire('Error', 'Could not load warehouse locations. Please try again.', 'error');
        }
    }

    /**
     * Updates the options of an existing Select2 location dropdown.
     */
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

    /**
     * Handles the user changing the 'From Location' dropdown.
     */
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

    /**
     * Loads inventory items for a specific location and populates the product dropdown.
     */
    async function loadProductsForLocation(locationId) {
        productSelect.prop('disabled', true).empty();
        try {
            const response = await fetchData(`api/inventory_api.php?action=get_inventory_by_location&location_id=${locationId}`);
            if (response.success && Array.isArray(response.data)) {
                productSelect.append(new Option('', '', true, true));
                if (response.data.length === 0) {
                     Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'No stock at this location.', showConfirmButton: false, timer: 3000 });
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
                throw new Error(response.message || 'Failed to load products for this location.');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            Swal.fire('Error', error.message, 'error');
        }
    }

    /**
     * Handles the user changing the 'Product' dropdown.
     */
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
        handleQuantityChange(); // Validate after product change
    }

    /**
     * Central validation function for quantity changes.
     */
    function handleQuantityChange() {
        const quantityToMove = parseInt(quantityInput.value, 10);
        const maxQuantity = parseInt(quantityInput.max, 10);
        let isStockValid = true;

        // 1. Validate against available stock
        if (quantityToMove > maxQuantity) {
            quantityErrorMessage.textContent = 'Quantity exceeds available stock at this location.';
            toLocationSelect.prop('disabled', true);
            isStockValid = false;
        } else {
            quantityErrorMessage.textContent = '';
            // Only re-enable 'To Location' if a 'From Location' is actually selected
            if (fromLocationSelect.val()) {
                toLocationSelect.prop('disabled', false);
            }
        }

        // 2. Validate destination capacity
        validateToLocationCapacity();

        // 3. Set final state of submit button
        const isFormComplete = fromLocationSelect.val() && productSelect.val() && toLocationSelect.val() && quantityToMove > 0;
        submitTransferBtn.disabled = !isStockValid || !isFormComplete;
    }

    /**
     * Validates destination locations based on the quantity input.
     */
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


    /**
     * Handles the form submission to perform the inventory transfer.
     */
    async function handleFormSubmit(event) {
        event.preventDefault();
        const inventoryId = productSelect.val();
        const toLocationId = toLocationSelect.val();
        const quantity = parseInt(quantityInput.value, 10);
        const maxQuantity = parseInt(quantityInput.max, 10);
        const selectedProductOption = productSelect.find('option:selected');
        const selectedToLocationOption = toLocationSelect.find('option:selected');

        // Final check before submit, though button should be disabled
        if (!inventoryId || !toLocationId || !quantity || quantity <= 0 || quantity > maxQuantity) {
            return Swal.fire('Invalid Input', 'Please correct the errors before submitting.', 'error');
        }

        const payload = {
            action: 'internal_transfer',
            inventory_id: inventoryId,
            to_location_id: toLocationId,
            quantity: quantity
        };

        Swal.fire({
            title: 'Confirm Transfer',
            html: `Are you sure you want to transfer <strong>${quantity}</strong> unit(s) of <strong>${selectedProductOption.text()}</strong> to location <strong>${selectedToLocationOption.text()}</strong>?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, transfer it!',
            allowOutsideClick: false,
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetchData('api/inventory_api.php', 'POST', payload);
                    if (response.success) {
                        await Swal.fire('Success!', response.message, 'success');
                        await loadLocations();
                        resetForm();
                    } else {
                        throw new Error(response.message || 'An unknown error occurred.');
                    }
                } catch (error) {
                    console.error('Transfer failed:', error);
                    Swal.fire('Transfer Failed', error.message, 'error');
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
        availableQtyInput.placeholder = 'Select a product';
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
            badge = `<span class="badge bg-secondary float-end">Space not set</span>`;
        } else if (quantityToMove > 0 && quantityToMove > available) {
            badge = `<span class="badge bg-danger float-end">Space not available (Avail: ${available})</span>`;
        } else {
            badge = `<span class="badge bg-success float-end">Available: ${available}</span>`;
        }
        
        return `<div>${state.text}${badge}</div>`;
    }

    function formatProductOption(state) {
        if (!state.id) { return state.text; }
        const item = $(state.element).data('itemData');
        if (!item) { return state.text; }

        const batchInfo = item.batch_number ? `Batch: ${item.batch_number}` : '';
        const dotInfo = item.dot_code ? `DOT: ${item.dot_code}` : '';
        const details = [batchInfo, dotInfo].filter(Boolean).join(', ');

        return $(`
            <div>
                <div>${state.text}</div>
                <small class="text-muted">Available: ${item.quantity} | ${details}</small>
            </div>
        `);
    }

    function formatProductSelection(state) {
        return state.text || 'Select a product to move';
    }
});
