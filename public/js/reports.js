// reports.js
// This script handles the functionality of the WMS reports page.
// It uses jQuery, DataTables.js, jsPDF, SheetJS, and SweetAlert2.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const reportTypeSelect = document.getElementById('reportType');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportTitle = document.getElementById('reportTitle');
    const reportFilterInput = document.getElementById('reportFilterInput');
    const reportFilterLabel = document.getElementById('reportFilterLabel');
    const exportButtonsContainer = document.getElementById('exportButtonsContainer');
    const printBtn = document.getElementById('printReportBtn');
    const pdfBtn = document.getElementById('exportPdfBtn');
    const xlsxBtn = document.getElementById('exportXlsxBtn');

    let reportTable = null; // Will hold the DataTable instance
    let currentReportData = []; // Holds the raw data of the current report
    let currentReportHeaders = []; // Holds the formatted headers of the current report

    // --- DataTable Initialization ---
    function initializeDataTable(data = [], columns = []) {
        if ($.fn.DataTable.isDataTable('#reportTable')) {
            $('#reportTable').DataTable().destroy();
            $('#reportTable').empty();
        }
        reportTable = $('#reportTable').DataTable({
            data: data,
            columns: columns,
            responsive: true,
            language: {
                emptyTable: "Select a report type and click 'Generate Report' to see results."
            }
        });
    }

    // --- Event Handlers ---
    generateReportBtn.addEventListener('click', generateReport);
    reportTypeSelect.addEventListener('change', updateFilterUI);
    printBtn.addEventListener('click', printReport);
    pdfBtn.addEventListener('click', exportPDF);
    xlsxBtn.addEventListener('click', exportExcel);

    // --- Core Report Generation ---
    async function generateReport() {
        const reportType = reportTypeSelect.value;
        if (!reportType) {
            Swal.fire('Warning', 'Please select a report type.', 'warning');
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const filterValue = reportFilterInput.value;
        let queryString = `api/reports_api.php?action=${reportType}&startDate=${startDate}&endDate=${endDate}`;
        if (filterValue) {
            queryString += `&filter=${encodeURIComponent(filterValue)}`;
        }
        
        reportTitle.textContent = 'Generating...';
        exportButtonsContainer.style.display = 'none';
        reportTable.clear().draw();
        reportTable.settings()[0].oLanguage.sEmptyTable = "Loading report data...";
        reportTable.draw();

        try {
            const response = await fetch(queryString);
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to fetch report data.');
            }
            renderTable(reportType, result.data);
        } catch (error) {
            console.error('Report generation error:', error);
            reportTitle.textContent = 'Error Generating Report';
            Swal.fire('Error', error.message, 'error');
            renderTable(null, []);
        }
    }

    // --- UI Update Functions ---
    function renderTable(reportType, data) {
        const selectedOption = reportType ? reportTypeSelect.querySelector(`option[value="${reportType}"]`) : null;
        reportTitle.textContent = selectedOption ? `Report: ${selectedOption.textContent}` : 'Report Results';
        
        currentReportData = data; // Store raw data for exports

        const emptyMessage = reportType ? "No data found for the selected criteria." : "Select a report type and click 'Generate Report' to see results.";
        
        if (data && data.length > 0) {
            const headers = Object.keys(data[0]);
            currentReportHeaders = headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
            const columns = headers.map((header, index) => ({ 
                data: header, 
                title: currentReportHeaders[index]
            }));
            initializeDataTable(data, columns);
            exportButtonsContainer.style.display = 'inline-flex';
        } else {
            currentReportHeaders = [];
            initializeDataTable([], []);
            exportButtonsContainer.style.display = 'none';
        }
        reportTable.settings()[0].oLanguage.sEmptyTable = emptyMessage;
        reportTable.draw();
    }

    function updateFilterUI() {
        const selectedOption = reportTypeSelect.options[reportTypeSelect.selectedIndex];
        const filterContainer = reportFilterInput.parentElement;
        if (selectedOption.dataset.filterRequired === 'true') {
            reportFilterLabel.textContent = selectedOption.dataset.filterLabel || 'Filter';
            reportFilterInput.placeholder = selectedOption.dataset.filterPlaceholder || 'Enter filter value...';
            reportFilterInput.type = selectedOption.dataset.filterType || 'text';
            filterContainer.style.display = 'block';
        } else {
            filterContainer.style.display = 'none';
            reportFilterInput.value = '';
        }
    }

    // --- Custom Export Functions ---

    function printReport() {
        // Get the DataTable instance
        const table = $('#reportTable').DataTable();
        
        // Correctly get the table header and body as jQuery objects and then clone them
        const tableHeader = $(table.table().header()).clone();
        const tableBody = $(table.table().body()).clone();

        // Reconstruct the table HTML for printing
        const tableHtml = $('<table>')
            .addClass('table table-bordered')
            .append(tableHeader)
            .append(tableBody)
            .prop('outerHTML');

        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'absolute';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(`
            <html>
                <head>
                    <title>Print Report</title>
                    <style>
                        @page {
                            size: A4 landscape; /* Set page to landscape */
                            margin: 20px; /* Set margins */
                        }
                        body {
                            font-family: sans-serif;
                            margin: 0;
                        }
                        h1, h2 {
                            text-align: center;
                            margin-bottom: 0.5rem;
                        }
                        h1 { font-size: 16pt; }
                        h2 { font-size: 12pt; font-weight: normal; }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 8pt; /* Drastically reduce font size */
                        }
                        th, td {
                            border: 1px solid #ccc; /* Lighter border for printing */
                            padding: 4px; /* Reduce cell padding */
                            text-align: left;
                            word-wrap: break-word; /* Wrap long text within cells */
                        }
                        thead th {
                            background-color: #f2f2f2; /* Light grey background for header */
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <h1>WMS Reports & Analytics</h1>
                    <h2>${reportTitle.textContent}</h2>
                    ${tableHtml}
                </body>
            </html>
        `);
        frameDoc.close();

        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            document.body.removeChild(printFrame);
        }, 500);
    }

    function exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4'
        });

        doc.autoTable({
            head: [currentReportHeaders],
            body: currentReportData.map(row => Object.values(row)),
            startY: 60,
            styles: {
                fontSize: 8
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold'
            },
            margin: { top: 60 }
        });

        doc.text(`${reportTitle.textContent}`, 40, 40);
        doc.save(`${reportTypeSelect.value}_report.pdf`);
    }

    function exportExcel() {
        const ws = XLSX.utils.json_to_sheet(currentReportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${reportTypeSelect.value}_report.xlsx`);
    }
    
    // --- Initial Setup ---
    updateFilterUI();
    initializeDataTable();
});
