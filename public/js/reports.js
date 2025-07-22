// public/js/reports.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const reportTypeSelect = document.getElementById('reportType');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const reportFilterInput = document.getElementById('reportFilterInput');
    const reportFilterLabel = document.getElementById('reportFilterLabel');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportTitle = document.getElementById('reportTitle');
    const reportTableHeader = document.getElementById('reportTableHeader');
    const reportTableBody = document.getElementById('reportTableBody');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn'); // PDF button
    const logoutBtn = document.getElementById('logoutBtn');

    // --- Event Listeners ---
    if (generateReportBtn) generateReportBtn.addEventListener('click', generateReport);
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportTableToCSV);
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportTableToPDF); // PDF listener
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (reportTypeSelect) reportTypeSelect.addEventListener('change', updateFilterUI);

    // --- SweetAlert2 Helper ---
    /**
     * Shows a SweetAlert2 notification.
     * @param {string} title - The title of the alert.
     * @param {string} text - The main text of the alert.
     * @param {string} icon - 'success', 'error', 'warning', 'info', 'question'.
     */
    function showFeedback(title, text, icon) {
        Swal.fire({
            title: title,
            text: text,
            icon: icon,
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
        });
    }


    // --- UI Functions ---

    /**
     * Updates the filter input label and placeholder based on the selected report.
     */
    function updateFilterUI() {
        const selectedOption = reportTypeSelect.options[reportTypeSelect.selectedIndex];
        const requiresFilter = selectedOption.dataset.filterRequired === 'true';
        const filterLabel = selectedOption.dataset.filterLabel || 'Filter';
        const filterPlaceholder = selectedOption.dataset.filterPlaceholder || 'Optional filter...';
        const filterType = selectedOption.dataset.filterType || 'text';
        
        const noDateReports = [
            'inventoryValuation', 'locationCapacity', 'inventoryAging', 
            'stockByLocation', 'inventorySummary', 'deadStock'
        ];
        const needsDate = !noDateReports.includes(reportTypeSelect.value);

        const startDateContainer = startDateInput.parentElement;
        const endDateContainer = endDateInput.parentElement;

        if (needsDate) {
            startDateContainer.classList.remove('d-none');
            endDateContainer.classList.remove('d-none');
        } else {
            startDateContainer.classList.add('d-none');
            endDateContainer.classList.add('d-none');
            // Clear values when hiding
            startDateInput.value = '';
            endDateInput.value = '';
        }

        reportFilterLabel.textContent = filterLabel;
        reportFilterInput.placeholder = filterPlaceholder;
        reportFilterInput.type = filterType;
        reportFilterInput.disabled = !requiresFilter;

        if(requiresFilter) {
            reportFilterInput.classList.add('is-invalid');
        } else {
            reportFilterInput.value = '';
            reportFilterInput.classList.remove('is-invalid');
        }
    }


    // --- Core Functions ---

    /**
     * Fetches and displays the selected report based on the filter criteria.
     */
    async function generateReport() {
        const reportType = reportTypeSelect.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const filterValue = reportFilterInput.value.trim();
        const selectedOption = reportTypeSelect.options[reportTypeSelect.selectedIndex];

        if (!reportType) {
            showFeedback('Selection Missing', 'Please select a report type.', 'warning');
            return;
        }

        if (selectedOption.dataset.filterRequired === 'true') {
            if (!filterValue) {
                const requiredField = selectedOption.dataset.filterLabel || 'a filter value';
                showFeedback('Input Required', `Please provide a ${requiredField} in the filter input for this report.`, 'warning');
                reportFilterInput.focus();
                return;
            }
            if (selectedOption.dataset.filterType === 'number' && !/^\d+$/.test(filterValue)) {
                showFeedback('Invalid Input', `${selectedOption.dataset.filterLabel} must be a valid number.`, 'error');
                reportFilterInput.focus();
                return;
            }
        }

        let url = `api/reports_api.php?action=${reportType}`;
        const queryParams = [];

        if (startDate) queryParams.push(`start_date=${startDate}`);
        if (endDate) queryParams.push(`end_date=${endDate}`);
        
        if (filterValue) {
            const paramName = reportType === 'productMovement' ? 'sku' : 'filter';
            if (reportType === 'customerTransactionHistory') {
                 queryParams.push(`customer_id=${encodeURIComponent(filterValue)}`);
            } else {
                queryParams.push(`${paramName}=${encodeURIComponent(filterValue)}`);
            }
        }
        
        if (queryParams.length > 0) {
            url += '&' + queryParams.join('&');
        }

        reportTitle.textContent = `Generating Report...`;
        reportTableHeader.innerHTML = '';
        reportTableBody.innerHTML = `<tr><td colspan="12" class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>`;
        exportCsvBtn.classList.add('d-none');
        exportPdfBtn.classList.add('d-none');


        const response = await fetchData(url);
        
        if (response?.success && Array.isArray(response.data)) {
            displayReport(reportType, response.data);
            if (response.data.length > 0) {
                exportCsvBtn.classList.remove('d-none');
                exportPdfBtn.classList.remove('d-none');
            }
        } else {
            const errorTitle = response?.message ? 'Error Generating Report' : 'Request Failed';
            const errorMessage = response?.message || 'An unknown error occurred while fetching the report data.';
            reportTitle.textContent = 'Error';
            reportTableBody.innerHTML = `<tr><td colspan="12" class="text-center p-4 text-danger">${errorMessage}</td></tr>`;
            exportCsvBtn.classList.add('d-none');
            exportPdfBtn.classList.add('d-none');
            showFeedback(errorTitle, errorMessage, 'error');
        }
    }

    /**
     * Renders the fetched report data into the HTML table.
     * @param {string} reportType - The type of report being displayed.
     * @param {Array} data - The array of data objects from the API.
     */
    function displayReport(reportType, data) {
        reportTableBody.innerHTML = '';

        const reportConfig = {
            // Standard
            inventorySummary: { title: 'Inventory Summary', headers: ['SKU', 'Product Name', 'Total Quantity', 'Locations'] },
            stockByLocation: { title: 'Stock By Location', headers: ['Location', 'Type', 'SKU', 'Product', 'Qty', 'Batch/Expiry'] },
            inboundHistory: { title: 'Inbound History', headers: ['Receipt#', 'Supplier', 'Arrival', 'Status', 'SKU', 'Product', 'Expected', 'Received', 'Putaway', 'Location', 'User'] },
            outboundHistory: { title: 'Outbound History', headers: ['Order#', 'Customer', 'Order Date', 'Ship Date', 'Status', 'SKU', 'Product', 'Ordered', 'Picked', 'Shipped', 'Location', 'User'] },
            productMovement: { title: 'Product Movement', headers: ['Type', 'Ref #', 'Date', 'Product', 'Qty Change', 'From', 'To', 'Status', 'User'] },
            customerTransactionHistory: { title: 'Customer Transaction History', headers: ['Customer', 'Date', 'Type', 'Amount', 'Order#', 'Notes', 'User']},
            orderMovementHistory: { title: 'Order Movement History', headers: ['Order #', 'Customer', 'Status', 'Timestamp', 'User', 'Notes'] },
            // Performance
            pickerPerformance: { title: 'Picker Performance', headers: ['Picker', 'Total Orders', 'Total Lines', 'Total Qty', 'Hours Worked', 'Picks/Hour'] },
            orderFulfillmentLeadTime: { title: 'Order Fulfillment Lead Time', headers: ['Order#', 'Customer', 'Order Date', 'First Pick', 'Last Pick', 'Ship Date', 'Time to Pick (Hrs)', 'Time to Ship (Days)'] },
            supplierPerformance: { title: 'Supplier Performance', headers: ['Supplier', 'Receipt#', 'Expected', 'Arrived', 'Days Early/Late', 'Expected Qty', 'Received Qty', 'Fill Rate %'] },
            orderLifecycle: { title: 'Order Lifecycle Analysis', headers: ['Order#', 'Customer', 'Order Date', 'First Pick', 'Shipped', 'Out for Delivery', 'Delivered', 'To Pick (Hrs)', 'To Ship (Hrs)', 'Transit (Days)'] },
            fillRate: { title: 'Fill Rate Report', headers: ['Order#', 'Customer', 'SKU', 'Product', 'Ordered', 'Shipped', 'Fill Rate %'] },
            // Financial & Aging
            inventoryAging: { title: 'Inventory Aging', headers: ['SKU', 'Product', 'Batch', 'Qty', 'Receipt Date', 'Age (Days)', 'Aging Bracket'] },
            inventoryValuation: { title: 'Inventory Valuation', headers: ['Warehouse', 'SKU', 'Product', 'On-Hand Qty', 'Unit Cost', 'Total Value'] },
            deadStock: { title: 'Dead Stock Report', headers: ['SKU', 'Product', 'Qty', 'Location', 'Batch', 'Last Moved', 'Days Unmoved'] },
            // Capacity & Auditing
            locationCapacity: { title: 'Location Capacity & Utilization', headers: ['Location', 'Type', 'Max Units', 'Current Units', 'Utilization %'] },
            stockAdjustmentHistory: { title: 'Stock Adjustment History', headers: ['Date', 'SKU', 'Product', 'Location', 'User', 'Qty Adjusted', 'Reason', 'Notes'] }
        };

        const config = reportConfig[reportType];
        if (!config) {
            console.error('No report configuration found for:', reportType);
            reportTableBody.innerHTML = `<tr><td colspan="12" class="text-center p-4">Report configuration is missing.</td></tr>`;
            return;
        }

        reportTitle.textContent = config.title;
        reportTableHeader.innerHTML = `<tr>${config.headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

        if (data.length === 0) {
            reportTableBody.innerHTML = `<tr><td colspan="${config.headers.length}" class="text-center p-4">No data found for this report.</td></tr>`;
            return;
        }

        data.forEach(row => {
            const tr = reportTableBody.insertRow();
            let cells = [];
            const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleString() : 'N/A';
            const formatDateOnly = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';

            switch (reportType) {
                // Standard
                case 'inventorySummary': cells = [row.sku, row.product_name, row.total_quantity, row.locations_list]; break;
                case 'stockByLocation': cells = [row.location_code, row.location_type, row.sku, row.product_name, row.quantity, `${row.batch_number || ''} ${row.expiry_date || ''}`.trim()]; break;
                case 'inboundHistory': cells = [row.receipt_number, row.supplier_name, formatDateOnly(row.actual_arrival_date), row.receipt_status, row.sku, row.product_name, row.expected_quantity, row.received_quantity, row.putaway_quantity, row.final_location, row.received_by_user]; break;
                case 'outboundHistory': cells = [row.order_number, row.customer_name, formatDateOnly(row.order_date), formatDateOnly(row.actual_ship_date), row.order_status, row.sku, row.product_name, row.ordered_quantity, row.picked_quantity, row.shipped_quantity, row.picked_from_location, row.picked_by_user || row.shipped_by_user]; break;
                case 'productMovement': cells = [row.movement_type, row.reference, formatDate(row.transaction_date), row.product_name, row.quantity_change, row.from_location, row.to_location, row.status, row.performed_by]; break;
                case 'customerTransactionHistory': cells = [row.customer_name, formatDate(row.transaction_date), row.transaction_type, row.amount, row.order_number, row.notes, row.created_by_user]; break;
                case 'orderMovementHistory': cells = [row.order_number, row.customer_name, row.status, formatDate(row.created_at), row.user_name || 'System', row.notes || '']; break;
                // Performance
                case 'pickerPerformance': cells = [row.picker_name, row.total_orders, row.total_lines, row.total_quantity, row.hours_worked, row.picks_per_hour]; break;
                case 'orderFulfillmentLeadTime': cells = [row.order_number, row.customer_name, formatDateOnly(row.order_date), formatDate(row.first_pick_time), formatDate(row.last_pick_time), formatDateOnly(row.actual_ship_date), row.time_to_pick_hours, row.time_to_ship_days]; break;
                case 'supplierPerformance': cells = [row.supplier_name, row.receipt_number, formatDateOnly(row.expected_arrival_date), formatDateOnly(row.actual_arrival_date), row.days_early_late, row.total_expected_quantity, row.total_received_quantity, row.fill_rate_percent]; break;
                case 'orderLifecycle': cells = [row.order_number, row.customer_name, formatDate(row.order_date), formatDate(row.first_pick_time), formatDate(row.actual_ship_date), formatDate(row.out_for_delivery_date), formatDate(row.actual_delivery_date), row.time_to_pick_hours, row.time_to_ship_hours, row.transit_days]; break;
                case 'fillRate': cells = [row.order_number, row.customer_name, row.sku, row.product_name, row.ordered_quantity, row.shipped_quantity, row.line_item_fill_rate_percent]; break;
                // Financial & Aging
                case 'inventoryAging': cells = [row.sku, row.product_name, row.batch_number, row.quantity, formatDateOnly(row.receipt_date), row.age_days, row.aging_bracket]; break;
                case 'inventoryValuation': cells = [row.warehouse_name, row.sku, row.product_name, row.total_on_hand_quantity, row.unit_cost, row.total_value]; break;
                case 'deadStock': cells = [row.sku, row.product_name, row.quantity, row.location_code, row.batch_number, formatDate(row.last_moved_at), row.days_since_last_movement]; break;
                // Capacity & Auditing
                case 'locationCapacity': cells = [row.location_code, row.location_type, row.max_capacity_units, row.current_units, row.utilization_percent]; break;
                case 'stockAdjustmentHistory': cells = [formatDate(row.adjustment_timestamp), row.sku, row.product_name, row.location_code, row.full_name, row.quantity_adjusted, row.reason_code, row.notes]; break;
            }
            tr.innerHTML = cells.map(c => `<td>${c !== null && c !== undefined ? c : 'N/A'}</td>`).join('');
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

    /**
     * Exports the currently displayed report table to a PDF file.
     */
    function exportTableToPDF() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            showFeedback('Error', 'PDF library not loaded.', 'error');
            return;
        }
        const doc = new jsPDF();
        const reportName = reportTitle.textContent;
        const table = document.getElementById("reportTable");

        doc.autoTable({
            html: table,
            startY: 20,
            headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: 'bold' },
            didDrawPage: function (data) {
                // Header
                doc.setFontSize(18);
                doc.setTextColor(40);
                doc.text(reportName, data.settings.margin.left, 15);
            }
        });

        const pdfFileName = `${reportName.replace(/ /g, "_").toLowerCase()}_${new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(pdfFileName);
    }

    async function handleLogout() {
        Swal.fire({
            title: 'Are you sure?',
            text: "You will be logged out.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, log out!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await fetchData('api/auth.php?action=logout');
                redirectToLogin();
            }
        });
    }

    // Initial UI setup
    updateFilterUI();
});
