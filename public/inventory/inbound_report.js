$(document).ready(function() {
    // --- DOM Elements ---
    const receiptSelect = document.getElementById('receiptSelect');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const printReportBtn = document.getElementById('printReportBtn');
    const reportContainer = document.getElementById('reportContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            showMessageBox('Please select a warehouse first.', 'warning');
            return;
        }
        await loadReceipts();
    }

    async function loadReceipts() {
        try {
            const response = await fetchData('api/inbound.php');
            if (response && response.success && Array.isArray(response.data)) {
                receiptSelect.innerHTML = '<option value="">Select a receipt</option>';
                response.data.forEach(receipt => {
                    const option = new Option(`${receipt.receipt_number} - ${receipt.supplier_name} (${receipt.status})`, receipt.receipt_id);
                    receiptSelect.add(option);
                });

                // Initialize Select2 on the receipt dropdown
                $(receiptSelect).select2({
                    placeholder: 'Search and select a receipt',
                    theme: "bootstrap-5"
                });
            } else {
                console.error("Failed to load receipts or invalid data format:", response);
            }
        } catch (error) {
            console.error("Error in loadReceipts:", error);
            showMessageBox('Could not load receipt data.', 'error');
        }
    }

    async function generateReport() {
        const receiptId = $(receiptSelect).val(); // Use jQuery to get value from Select2
        if (!receiptId) {
            showMessageBox('Please select a receipt.', 'error');
            return;
        }

        const response = await fetchData(`api/inbound.php?action=getReportData&receipt_id=${receiptId}`);
        
        if (response.success && response.data) {
            let receipt, items;

            // Robustly parse the data from the server to prevent errors
            if (response.data.receipt && response.data.items) {
                // This handles the expected data structure from the getReportData action
                receipt = response.data.receipt;
                items = response.data.items;
            } else if (response.data.receipt_number && response.data.items) {
                // This is a fallback, handling data if the general getInbound action was called
                receipt = response.data;
                items = response.data.items;
            } else {
                // If the data structure is still not recognized, show an error.
                console.error("Unexpected data structure received for report:", response.data);
                showMessageBox('Failed to process report due to an unexpected data format.', 'error');
                reportContainer.innerHTML = '';
                printReportBtn.classList.add('d-none');
                return;
            }
            
            if (!receipt) {
                showMessageBox('Could not find receipt details in the server response.', 'error');
                reportContainer.innerHTML = '';
                printReportBtn.classList.add('d-none');
                return;
            }

            let itemsHtml = '';

            items.forEach(item => {
                if (item.expected_quantity > 0) {
                    itemsHtml += `
                        <tr class="table-light">
                            <td>${item.sku}</td>
                            <td>${item.product_name}</td>
                            <td><strong>${item.batch_number}</strong> (Source)</td>
                            <td><strong>${item.received_quantity}</strong></td>
                            <td><em>(${item.putaway_quantity})</em></td>
                            <td>
                                <svg class="barcode"
                                  jsbarcode-value="${item.barcode}"
                                  jsbarcode-textmargin="0"
                                  jsbarcode-fontoptions="bold"
                                  jsbarcode-height="40">
                                </svg>
                                <small class="d-block text-muted">Product Barcode</small>
                            </td>
                        </tr>
                    `;
                } else if (item.status === 'Putaway') { 
                    itemsHtml += `
                        <tr>
                            <td colspan="2" class="text-end fst-italic border-end-0">↳ Putaway to ${item.final_location_code}</td>
                            <td class="border-start-0">${item.batch_number}</td>
                            <td>-</td>
                            <td>${item.putaway_quantity}</td>
                            <td>
                                <svg class="barcode"
                                  jsbarcode-value="${item.batch_number}"
                                  jsbarcode-textmargin="0"
                                  jsbarcode-fontoptions="bold"
                                  jsbarcode-height="40">
                                </svg>
                            </td>
                        </tr>
                    `;
                }
            });

            const reportHtml = `
                <div class="card shadow-sm printable-area">
                    <div class="card-header bg-dark text-white">
                        <h3 class="mb-0">Inbound Receipt: ${receipt.receipt_number}</h3>
                    </div>
                    <div class="card-body">
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <p><strong>Supplier:</strong> ${receipt.supplier_name}</p>
                                <p><strong>Status:</strong> <span class="badge bg-primary">${receipt.status}</span></p>
                            </div>
                            <div class="col-md-6 text-md-end">
                                <p><strong>Expected Arrival:</strong> ${receipt.expected_arrival_date}</p>
                                <p><strong>Actual Arrival:</strong> ${receipt.actual_arrival_date || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead class="table-light">
                                    <tr>
                                        <th>SKU</th>
                                        <th>Product Name</th>
                                        <th>Batch Number</th>
                                        <th>Received Qty</th>
                                        <th>Putaway Qty</th>
                                        <th>Barcode</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            reportContainer.innerHTML = reportHtml;
            JsBarcode(".barcode").init();
            printReportBtn.classList.remove('d-none');
        } else {
            showMessageBox(response.message || 'Failed to generate report.', 'error');
            reportContainer.innerHTML = '';
            printReportBtn.classList.add('d-none');
        }
    }

    function printReport() {
        window.print();
    }

    // --- Event Listeners ---
    if (generateReportBtn) generateReportBtn.addEventListener('click', generateReport);
    if (printReportBtn) printReportBtn.addEventListener('click', printReport);
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        fetchData('api/auth.php?action=logout').then(() => window.location.href = 'index.html');
    });

    // --- Initialize Page ---
    initializePage();
});
