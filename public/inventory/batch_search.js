document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('batchSearchInput');
    const searchBtn = document.getElementById('batchSearchBtn');
    const resultsContainer = document.getElementById('searchResultsContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    async function performSearch() {
        const batchNumber = searchInput.value.trim();
        if (!batchNumber) {
            showMessageBox('Please enter a batch number to search.', 'error');
            return;
        }

        if (!currentWarehouseId) {
            showMessageBox('Please select a warehouse first.', 'warning');
            return;
        }

        resultsContainer.innerHTML = `<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

        const response = await fetchData(`api/batch_search.php?batch_number=${encodeURIComponent(batchNumber)}`);

        resultsContainer.innerHTML = ''; // Clear previous results

        if (response.success && Array.isArray(response.data) && response.data.length > 0) {
            let allResultsHtml = '';
            response.data.forEach(item => {
                // Defensive check for item_status to prevent "undefined"
                const statusText = item.item_status || 'Status Unknown';
                const locationHtml = statusText === 'In Stock' 
                    ? `<p><strong>Stored Location:</strong> <span class="badge bg-success fs-6">${item.location_code}</span></p>`
                    : `<p><strong>Status:</strong> <span class="badge bg-info fs-6">${statusText} at ${item.location_code}</span></p>`;

                const barcodeHtml = item.barcode 
                    ? `<div class="col-md-4 text-center">
                           <p class="mb-1"><strong>Product Barcode</strong></p>
                           <svg class="barcode"
                             jsbarcode-value="${item.barcode}"
                             jsbarcode-textmargin="0"
                             jsbarcode-fontoptions="bold">
                           </svg>
                       </div>`
                    : '<div class="col-md-4 text-center text-muted"><p>No Barcode Available</p></div>';

                allResultsHtml += `
                    <div class="card shadow-sm printable-area mb-3">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Batch Details: ${item.batch_number}</h5>
                            <button class="btn btn-secondary btn-sm no-print print-batch-btn"><i class="bi bi-printer"></i> Print</button>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <p><strong>Product:</strong> ${item.product_name} (${item.sku})</p>
                                    ${locationHtml}
                                    <p><strong>Available Quantity:</strong> ${item.quantity}</p>
                                    <hr>
                                    <p class="text-muted mb-0">
                                        <strong>Source Receipt:</strong> ${item.receipt_number || 'N/A'} <br>
                                        <strong>Expiry Date:</strong> ${item.expiry_date || 'N/A'}
                                    </p>
                                </div>
                                ${barcodeHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            resultsContainer.innerHTML = allResultsHtml;

            // Initialize all barcodes
            JsBarcode(".barcode").init();
            
            // Add print button listeners
            document.querySelectorAll('.print-batch-btn').forEach(button => {
                button.addEventListener('click', () => {
                    window.print();
                });
            });

        } else {
            showMessageBox('No inventory found for this batch number in the current warehouse.', 'warning');
            resultsContainer.innerHTML = '<div class="alert alert-warning">No results found.</div>';
        }
    }
    
    if(searchBtn) searchBtn.addEventListener('click', performSearch);
    if(searchInput) searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        fetchData('api/auth.php?action=logout').then(() => window.location.href = 'index.html');
    });
});
