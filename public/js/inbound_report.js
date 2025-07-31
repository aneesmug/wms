$(document).ready(function() {
    // --- DOM Elements ---
    const receiptSelect = $('#receiptSelect');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const printReportBtn = document.getElementById('printReportBtn');
    const reportContainer = document.getElementById('reportContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentWarehouseId = localStorage.getItem('current_warehouse_id');

    // --- Core Functions ---

    async function initializePage() {
        if (!currentWarehouseId) {
            Swal.fire('Warehouse Not Selected', 'Please select a warehouse from the main dashboard first.', 'warning');
            return;
        }
        await loadReceipts();
    }

    async function loadReceipts() {
        try {
            const response = await fetchData('api/inbound_api.php');
            if (response && response.success && Array.isArray(response.data)) {
                const options = response.data.map(receipt => 
                    new Option(`${receipt.receipt_number} - ${receipt.supplier_name} (${receipt.status})`, receipt.receipt_id)
                );
                receiptSelect.empty().append(new Option('Select a receipt', '')).append(options);

                // Initialize Select2 on the receipt dropdown
                receiptSelect.select2({
                    placeholder: 'Search and select a receipt',
                    theme: "bootstrap-5"
                });
            } else {
                console.error("Failed to load receipts or invalid data format:", response);
                Swal.fire('Load Error', 'Failed to load receipts or data format is invalid.', 'error');
            }
        } catch (error) {
            console.error("Error in loadReceipts:", error);
            Swal.fire('Load Error', 'Could not load receipt data from the server.', 'error');
        }
    }

    async function generateReport() {
        const receiptId = receiptSelect.val();
        if (!receiptId) {
            Swal.fire('Input Required', 'Please select a receipt to generate a report.', 'error');
            return;
        }

        try {
            const response = await fetchData(`api/inbound_api.php?action=getReportData&receipt_id=${receiptId}`);
            
            if (response.success && response.data && response.data.receipt) {
                const { receipt, items } = response.data;
                
                let itemsHtml = '';
                items.forEach(item => {
                    // Item received (original line from an expected order)
                    if (item.expected_quantity > 0) {
                        itemsHtml += `
                            <tr class="table-light">
                                <td>${item.sku || 'N/A'}</td>
                                <td>${item.product_name || 'N/A'}</td>
                                <td><strong>${item.batch_number || 'N/A'}</strong></td>
                                <td><strong>${item.received_quantity || 0}</strong></td>
                                <td><em>(${item.putaway_quantity || 0})</em></td>
                                <td>
                                    <svg class="barcode"
                                      jsbarcode-value="${item.article_no}"
                                      jsbarcode-textmargin="0"
                                      jsbarcode-fontoptions="bold"
                                      jsbarcode-height="40">
                                    </svg>
                                </td>
                            </tr>
                        `;
                    // Item putaway (details of where it was stored)
                    } else if (item.status === 'Putaway') { 
                        itemsHtml += `
                            <tr>
                                <td colspan="2" class="text-end fst-italic border-end-0">↳ Putaway to <strong>${item.final_location_code}</strong></td>
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
                                            <th>Article No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${itemsHtml || '<tr><td colspan="6">No item data available for this receipt.</td></tr>'}
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
                Swal.fire('Report Error', response.message || 'Failed to generate the report. The data may be missing or invalid.', 'error');
                reportContainer.innerHTML = '';
                printReportBtn.classList.add('d-none');
            }
        } catch(error) {
            console.error("Error in generateReport:", error);
            Swal.fire('System Error', 'An unexpected error occurred while generating the report.', 'error');
        }
    }

    function printReport() {
        window.print();
    }

    // --- Event Listeners ---
    if (generateReportBtn) generateReportBtn.addEventListener('click', generateReport);
    if (printReportBtn) printReportBtn.addEventListener('click', printReport);
    
    // Note: This assumes the included 'menu.php' provides a button with id="logoutBtn"
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Swal.fire({
                title: 'Are you sure?',
                text: "You will be logged out.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, logout!'
            }).then((result) => {
                if (result.isConfirmed) {
                    fetchData('api/auth.php?action=logout')
                        .then(() => {
                            window.location.href = 'index.html';
                        })
                        .catch(err => {
                            Swal.fire('Error', 'Logout failed. Please try again.', 'error');
                            console.error("Logout failed:", err);
                        });
                }
            });
        });
    }

    // --- Initialize Page ---
    initializePage();
});