document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const resultsContainer = document.getElementById('resultsContainer');
    const printArea = document.getElementById('print-area');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    /**
     * Main search function triggered by button or Enter key.
     */
    async function performSearch() {
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) {
            // Use SweetAlert2 for notifications
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Please enter a Batch or Receipt Number to search.',
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        if (!currentWarehouseId) {
            // Use SweetAlert2 for notifications
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Please select a warehouse first.',
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        resultsContainer.innerHTML = `<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

        try {
            const response = await fetchData(`api/batch_search_api.php?search_term=${encodeURIComponent(searchTerm)}`);
            
            if (response.success && response.data.length > 0) {
                resultsContainer.innerHTML = `<div class="alert alert-success">Found ${response.data.length} label(s). Preparing for printing...</div>`;
                generateAndPrintLabels(response.data);
            } else {
                resultsContainer.innerHTML = `<div class="alert alert-warning">${response.message || 'No results found.'}</div>`;
            }
        } catch (error) {
            console.error('Search failed:', error);
            resultsContainer.innerHTML = `<div class="alert alert-danger">An error occurred during the search.</div>`;
        }
    }

    /**
     * Generates the HTML for all labels, renders barcodes, and triggers printing.
     * @param {Array<object>} labelData - An array of objects, each containing data for one label.
     */
    function generateAndPrintLabels(labelData) {
        // Clear any previous labels
        printArea.innerHTML = '';
        
        // Build the HTML for all labels
        labelData.forEach(data => {
            const labelHtml = `
                <div class="printable-label">
                    <h5>Batch Details: ${data.batch_number || ''}</h5>
                    <p class="mt-3">
                        <strong>Product:</strong> ${data.product_name || 'N/A'} (${data.sku || 'N/A'})
                    </p>
                    <p><strong>Stored Location:</strong> <span class="location-highlight">${data.location_code || 'N/A'}</span></p>
                    <p><strong>Available Quantity:</strong> <span class="fw-bold">${data.quantity || 'N/A'}</span></p>
                    <hr>
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>Source Receipt:</strong><br>
                            ${data.source_receipt_number || 'N/A'}
                        </div>
                        <div>
                            <strong>Expiry Date:</strong><br>
                            ${data.expiry_date || 'N/A'}
                        </div>
                    </div>
                    <div class="barcode-section">
                        <p class="mb-0" style="font-size: 10pt;">Batch Barcode</p>
                        <svg class="barcode" id="barcode-${data.batch_number}"></svg>
                    </div>
                </div>
            `;
            printArea.innerHTML += labelHtml;
        });

        // Render the barcodes for all the newly created SVG elements
        labelData.forEach(data => {
            const barcodeElement = document.getElementById(`barcode-${data.batch_number}`);
            if (barcodeElement) {
                JsBarcode(barcodeElement, data.batch_number, {
                    format: "CODE128",
                    displayValue: true,
                    fontSize: 16,
                    width: 1.5,
                    height: 40,
                    margin: 5
                });
            }
        });

        // Trigger the print dialog
        window.print();
    }

    // --- Event Listeners ---
    if (searchBtn) searchBtn.addEventListener('click', performSearch);
    if (searchInput) searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        fetchData('api/auth.php?action=logout').then(() => window.location.href = 'index.html');
    });
});
