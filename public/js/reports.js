/*
MODIFICATION SUMMARY
- This file contains the logic to create the advanced filter UI inside the `advancedFilterContainer`.
- When a report is rendered, this script checks the selected report option for a `data-adv-filters-config` attribute.
- If found, it makes the "Filter" dropdown visible and calls the `initializeAdvancedFilter` function (from main.js)
  to build the filter UI based on the configuration you set in `reports.php`.
- This approach is data-driven, meaning you can add or change filters in the future just by editing the HTML attribute.
*/
// reports.js
// This script handles the functionality of the WMS reports page.
// It uses jQuery, DataTables.js, jsPDF, SheetJS, and SweetAlert2.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selectors ---
    const reportTypeSelect = document.getElementById('reportType');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportTitle = document.getElementById('reportTitle');
    const reportFilterInput = document.getElementById('reportFilterInput');
    const mainFilterContainer = document.getElementById('mainFilterContainer');
    const dateRangeContainer = document.getElementById('dateRangeContainer');
    const clearDateRangeBtn = document.getElementById('clearDateRangeBtn');
    const exportButtonsContainer = document.getElementById('exportButtonsContainer');
    const filterDropdownContainer = document.getElementById('filterDropdownContainer');
    const printBtn = document.getElementById('printReportBtn');
    const pdfBtn = document.getElementById('exportPdfBtn');
    const xlsxBtn = document.getElementById('exportXlsxBtn');

    let reportTable = null; // Will hold the DataTable instance
    let datePicker = null; // Will hold the Litepicker instance
    let currentReportData = []; // Holds the raw data of the current report
    let currentReportHeaders = []; // Holds the formatted headers of the current report

    // --- Initializations ---
    $('#reportType').select2({
        theme: 'bootstrap-5',
        placeholder: 'Select a report...'
    });

    datePicker = new Litepicker({
        element: document.getElementById('dateRangePicker'),
        singleMode: false,
        format: 'YYYY-MM-DD'
    });

    // --- DataTable Initialization ---
    function initializeDataTable(data = [], columns = []) {
        if ($.fn.DataTable.isDataTable('#reportTable')) {
            $('#reportTable').DataTable().destroy();
            $('#reportTable').empty(); // Clear table structure
        }

        reportTable = $('#reportTable').DataTable({
            data: data,
            columns: columns,
            responsive: true,
            language: {
                emptyTable: "Select a report type and click 'Generate Report' to see results."
            },
            lengthMenu: [
                [10, 25, 50, -1],
                ['10 rows', '25 rows', '50 rows', 'Show All']
            ]
        });
    }

    // --- Event Handlers ---
    generateReportBtn.addEventListener('click', generateReport);
    $('#reportType').on('change', updateFilterUI);
    clearDateRangeBtn.addEventListener('click', () => {
        if(datePicker) {
            datePicker.clearSelection();
        }
    });
    printBtn.addEventListener('click', printReport);
    pdfBtn.addEventListener('click', exportPDF);
    xlsxBtn.addEventListener('click', exportExcel);

    // --- Core Report Generation ---
    async function generateReport() {
        const reportType = $('#reportType').val();
        if (!reportType) {
            Swal.fire('Warning', 'Please select a report type.', 'warning');
            return;
        }

        let queryString = `api/reports_api.php?action=${reportType}`;
        
        if (dateRangeContainer.style.display !== 'none' && datePicker.getDate()) {
            queryString += `&dateRange=${datePicker.getStartDate().format('YYYY-MM-DD')} - ${datePicker.getEndDate().format('YYYY-MM-DD')}`;
        }

        if (mainFilterContainer.style.display !== 'none' && reportFilterInput.value) {
            queryString += `&filter=${encodeURIComponent(reportFilterInput.value)}`;
        }
        
        reportTitle.textContent = 'Generating...';
        exportButtonsContainer.style.display = 'none';
        filterDropdownContainer.style.display = 'none';

        if (reportTable) {
            reportTable.clear().draw();
            reportTable.settings()[0].oLanguage.sEmptyTable = "Loading report data...";
            reportTable.draw();
        }

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
        
        currentReportData = data;

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

            // Initialize Advanced Filter if configured
            const advFiltersConfigAttr = selectedOption ? selectedOption.dataset.advFiltersConfig : null;
            if (advFiltersConfigAttr && typeof initializeAdvancedFilter === 'function') {
                try {
                    const columnsConfig = JSON.parse(advFiltersConfigAttr);
                    filterDropdownContainer.style.display = 'inline-block';
                    initializeAdvancedFilter(reportTable, 'advancedFilterContainer', columnsConfig);
                } catch (e) {
                    console.error("Failed to parse advanced filters config:", e);
                    filterDropdownContainer.style.display = 'none';
                }
            } else {
                filterDropdownContainer.style.display = 'none';
            }

        } else {
            currentReportHeaders = [];
            initializeDataTable([], []);
            exportButtonsContainer.style.display = 'none';
            filterDropdownContainer.style.display = 'none';
        }
        if (reportTable) {
            reportTable.settings()[0].oLanguage.sEmptyTable = emptyMessage;
            reportTable.draw();
        }
    }

    function updateFilterUI() {
        const selectedOption = $('#reportType').find(':selected')[0];
        
        if (selectedOption && selectedOption.dataset.filterRequired === 'true') {
            mainFilterContainer.style.display = 'block';
            document.getElementById('reportFilterLabel').textContent = selectedOption.dataset.filterLabel || 'Filter';
            reportFilterInput.placeholder = selectedOption.dataset.filterPlaceholder || 'Enter filter value...';
            reportFilterInput.type = selectedOption.dataset.filterType || 'text';
        } else {
            mainFilterContainer.style.display = 'none';
            reportFilterInput.value = '';
        }

        if (selectedOption && selectedOption.dataset.dateFilter === 'true') {
            dateRangeContainer.style.display = 'block';
        } else {
            dateRangeContainer.style.display = 'none';
            datePicker.clearSelection();
        }
    }

    // --- Helper for Unique Filenames ---
    function generateUniqueFilename(baseName) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const randomPart = Math.random().toString(36).substring(2, 8);
        return `${baseName}_${year}${month}${day}_${hours}${minutes}${seconds}_${randomPart}`;
    }

    // --- Custom Export Functions ---
    function printReport() {
        const table = $('#reportTable').DataTable();
        const tableHeader = $(table.table().header()).clone();
        const tableBody = $(table.table().body()).clone();
        const tableHtml = $('<table>').addClass('table table-bordered').append(tableHeader).append(tableBody).prop('outerHTML');
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'absolute';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(`
            <html><head><title>Print Report</title>
            <style>
                @page { size: A4 landscape; margin: 20px; }
                body { font-family: sans-serif; margin: 0; }
                h1, h2 { text-align: center; margin-bottom: 0.5rem; }
                h1 { font-size: 16pt; } h2 { font-size: 12pt; font-weight: normal; }
                table { width: 100%; border-collapse: collapse; font-size: 8pt; }
                th, td { border: 1px solid #ccc; padding: 4px; text-align: left; word-wrap: break-word; }
                thead th { background-color: #f2f2f2; font-weight: bold; }
            </style></head><body>
            <h1>WMS Reports & Analytics</h1><h2>${reportTitle.textContent}</h2>${tableHtml}
            </body></html>`);
        frameDoc.close();
        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            document.body.removeChild(printFrame);
        }, 500);
    }

    function exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const fileNameBase = $('#reportType').val() || 'report';
        const uniqueFileName = generateUniqueFilename(fileNameBase);

        doc.autoTable({
            head: [currentReportHeaders],
            body: currentReportData.map(row => Object.values(row)),
            startY: 60,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            margin: { top: 60 }
        });
        doc.text(`${reportTitle.textContent}`, 40, 40);
        doc.save(`${uniqueFileName}.pdf`);
    }

    function exportExcel() {
        const ws = XLSX.utils.json_to_sheet(currentReportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        const fileNameBase = $('#reportType').val() || 'report';
        const uniqueFileName = generateUniqueFilename(fileNameBase);
        XLSX.writeFile(wb, `${uniqueFileName}.xlsx`);
    }
    
    // --- Initial Setup ---
    updateFilterUI();
    initializeDataTable();
});
