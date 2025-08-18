// public/js/reports.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const reportTypeSelect = document.getElementById('reportType');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const reportFilterInput = document.getElementById('reportFilterInput');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportTitle = document.getElementById('reportTitle');
    const reportTableHeader = document.getElementById('reportTableHeader');
    const reportTableBody = document.getElementById('reportTableBody');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // --- Event Listeners ---
    if (generateReportBtn) generateReportBtn.addEventListener('click', generateReport);
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportTableToCSV);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // --- Core Functions ---

    /**
     * Fetches and displays the selected report based on the filter criteria.
     */
    async function generateReport() {
        const reportType = reportTypeSelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const filterValue = reportFilterInput ? reportFilterInput.value.trim() : '';

        // *** FIX: Validate that required filters are provided ***
        const requiresFilter = ['productMovement', 'customerTransactionHistory', 'orderMovementHistory'];
        if (requiresFilter.includes(reportType) && !filterValue) {
            let requiredField = "a filter value";
            if(reportType === 'productMovement') requiredField = "a SKU";
            if(reportType === 'customerTransactionHistory') requiredField = "a Customer ID";
            if(reportType === 'orderMovementHistory') requiredField = "an Order Number";
            
            showMessageBox(`Please provide ${requiredField} in the filter input for this report.`, 'warning');
            return; // Stop execution
        }

        let url = `api/reports.php?action=${reportType}`;
        const queryParams = [];

        // Add date filters if applicable
        if (startDate) {
            queryParams.push(`start_date=${startDate}`);
        }
        if (endDate) {
            queryParams.push(`end_date=${endDate}`);
        }

        // Add the generic text filter if a value is provided
        if (filterValue) {
             if (reportType === 'productMovement') {
                queryParams.push(`sku=${encodeURIComponent(filterValue)}`);
            } else if (reportType === 'customerTransactionHistory') {
                queryParams.push(`customer_id=${encodeURIComponent(filterValue)}`);
            } else if (reportType === 'orderMovementHistory') {
                queryParams.push(`filter=${encodeURIComponent(filterValue)}`);
            }
        }
        
        if (queryParams.length > 0) {
            url += '&' + queryParams.join('&');
        }

        reportTitle.textContent = `Generating Report...`;
        reportTableHeader.innerHTML = '';
        reportTableBody.innerHTML = `<tr><td colspan="12" class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>`;
        
        if (exportCsvBtn) {
            exportCsvBtn.classList.add('d-none');
        }

        const response = await fetchData(url);
        
        if (response?.success && Array.isArray(response.data)) {
            displayReport(reportType, response.data);
            if (response.data.length > 0 && exportCsvBtn) {
                exportCsvBtn.classList.remove('d-none');
            }
        } else {
            reportTitle.textContent = 'Error';
            reportTableBody.innerHTML = `<tr><td colspan="12" class="text-center p-4">${response?.message || 'Failed to load report data.'}</td></tr>`;
            if (exportCsvBtn) {
                exportCsvBtn.classList.add('d-none');
            }
        }
    }

    /**
     * Renders the fetched report data into the HTML table.
     * @param {string} reportType - The type of report being displayed.
     * @param {Array} data - The array of data objects from the API.
     */
    function displayReport(reportType, data) {
        reportTableBody.innerHTML = '';
        let headers = [];
        let title = '';

        const reportConfig = {
            inventorySummary: { title: 'Inventory Summary', headers: ['SKU', 'Product Name', 'Total Quantity', 'Locations'] },
            stockByLocation: { title: 'Stock By Location', headers: ['Location', 'Type', 'SKU', 'Product', 'Qty', 'Batch/Expiry'] },
            inboundHistory: { title: 'Inbound History', headers: ['Receipt#', 'Supplier', 'Arrival', 'Status', 'SKU', 'Product', 'Expected', 'Received', 'Putaway', 'Location', 'User'] },
            outboundHistory: { title: 'Outbound History', headers: ['Order#', 'Customer', 'Order Date', 'Ship Date', 'Status', 'SKU', 'Product', 'Ordered', 'Picked', 'Shipped', 'Location', 'User'] },
            productMovement: { title: 'Product Movement', headers: ['Type', 'Ref', 'Date', 'Product', 'Qty Change', 'To', 'From', 'Status', 'User'] },
            customerTransactionHistory: { title: 'Customer Transaction History', headers: ['Customer', 'Date', 'Type', 'Amount', 'Order#', 'Notes', 'User']},
            orderMovementHistory: { title: 'Order Movement History', headers: ['Order #', 'Customer', 'Status', 'Timestamp', 'User', 'Notes'] }
        };

        if (reportConfig[reportType]) {
            title = reportConfig[reportType].title;
            headers = reportConfig[reportType].headers;
        }

        reportTitle.textContent = title;
        reportTableHeader.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

        if (data.length === 0) {
            reportTableBody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center p-4">No data found for this report.</td></tr>`;
            return;
        }

        data.forEach(row => {
            const tr = reportTableBody.insertRow();
            let cells = [];
            switch (reportType) {
                case 'inventorySummary':
                    cells = [row.sku, row.product_name, row.total_quantity, row.locations_list];
                    break;
                case 'stockByLocation':
                    cells = [row.location_code, row.location_type, row.sku, row.product_name, row.quantity, `${row.batch_number || ''} ${row.expiry_date || ''}`.trim()];
                    break;
                case 'inboundHistory':
                    cells = [row.receipt_number, row.supplier_name, row.actual_arrival_date, row.receipt_status, row.sku, row.product_name, row.expected_quantity, row.received_quantity, row.putaway_quantity, row.final_location, row.received_by_user];
                    break;
                case 'outboundHistory':
                     cells = [row.order_number, row.customer_name, new Date(row.order_date).toLocaleDateString(), row.actual_ship_date, row.order_status, row.sku, row.product_name, row.ordered_quantity, row.picked_quantity, row.shipped_quantity, row.picked_from_location, row.picked_by_user || row.shipped_by_user];
                    break;
                case 'productMovement':
                    cells = [row.movement_type, row.reference, new Date(row.transaction_date).toLocaleDateString(), row.product_name, row.quantity_change, row.to_location, row.from_location, row.status, row.performed_by];
                    break;
                case 'customerTransactionHistory':
                    cells = [row.customer_name, new Date(row.transaction_date).toLocaleString(), row.transaction_type, row.amount, row.order_number, row.notes, row.created_by_user];
                    break;
                case 'orderMovementHistory':
                    cells = [row.order_number, row.customer_name, row.status, new Date(row.created_at).toLocaleString(), row.user_name || 'System', row.notes || ''];
                    break;
            }
            tr.innerHTML = cells.map(c => `<td>${c || 'N/A'}</td>`).join('');
        });
    }

    /**
     * Exports the currently displayed report table to a CSV file.
     */
    function exportTableToCSV() {
        const table = document.getElementById("reportTable");
        if (!table) return;
        let csv = [];
        for (let i = 0; i < table.rows.length; i++) {
            let row = [], cols = table.rows[i].querySelectorAll("td, th");
            for (let j = 0; j < cols.length; j++) {
                let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, "").replace(/(\s\s)/gm, " ");
                data = data.replace(/"/g, '""');
                row.push('"' + data + '"');
            }
            csv.push(row.join(","));
        }
        const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
        const downloadLink = document.createElement("a");
        const reportName = reportTitle.textContent.replace(/ /g, "_").toLowerCase();
        downloadLink.download = `${reportName}_${new Date().toISOString().slice(0,10)}.csv`;
        downloadLink.href = window.URL.createObjectURL(csvFile);
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    async function handleLogout() {
        await fetchData('api/auth.php?action=logout');
        redirectToLogin();
    }
});
