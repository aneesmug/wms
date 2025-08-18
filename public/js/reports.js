/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English strings in UI elements, alerts, and modals with the `__()` translation function.
* 2. This includes placeholders, DataTable language settings, SweetAlert2 titles and messages, and error notifications.
* 3. The entire JavaScript functionality for this page is now fully localizable.
* 4. Ensured dynamic messages with variables are constructed correctly using translated strings.
*/
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

    let reportTable = null;
    let datePicker = null;
    let currentReportData = [];
    let currentReportHeaders = [];

    // --- Initializations ---
    $('#reportType').select2({
        theme: 'bootstrap-5',
        placeholder: __('select_a_report')
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
            $('#reportTable').empty();
        }

        reportTable = $('#reportTable').DataTable({
            data: data,
            columns: columns,
            responsive: true,
            language: {
                emptyTable: __('select_report_and_generate'),
                search: `<span>${__('search')}:</span> _INPUT_`,
                searchPlaceholder: `${__('search')}...`,
                lengthMenu: `${__('show')} _MENU_ ${__('entries')}`,
                info: `${__('showing')} _START_ ${__('to')} _END_ ${__('of')} _TOTAL_ ${__('entries')}`,
                infoEmpty: `${__('showing')} 0 ${__('to')} 0 ${__('of')} 0 ${__('entries')}`,
                infoFiltered: `(${__('filtered_from')} _MAX_ ${__('total_entries')})`,
                paginate: {
                    first: __('first'),
                    last: __('last'),
                    next: __('next'),
                    previous: __('previous')
                },
                zeroRecords: __('no_matching_records_found'),
                processing: `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">${__('loading')}...</span></div>`
            },
            lengthMenu: [
                [10, 25, 50, -1],
                [`10 ${__('rows')}`, `25 ${__('rows')}`, `50 ${__('rows')}`, __('show_all')]
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
            Swal.fire(__('warning'), __('please_select_report_type'), 'warning');
            return;
        }

        let queryString = `api/reports_api.php?action=${reportType}`;
        
        if (dateRangeContainer.style.display !== 'none' && datePicker.getDate()) {
            queryString += `&dateRange=${datePicker.getStartDate().format('YYYY-MM-DD')} - ${datePicker.getEndDate().format('YYYY-MM-DD')}`;
        }

        if (mainFilterContainer.style.display !== 'none' && reportFilterInput.value) {
            queryString += `&filter=${encodeURIComponent(reportFilterInput.value)}`;
        }
        
        reportTitle.textContent = __('generating');
        exportButtonsContainer.style.display = 'none';
        filterDropdownContainer.style.display = 'none';

        if (reportTable) {
            reportTable.clear().draw();
            reportTable.settings()[0].oLanguage.sEmptyTable = __('loading_report_data');
            reportTable.draw();
        }

        try {
            const response = await fetch(queryString);
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || __('failed_to_fetch_report_data'));
            }
            renderTable(reportType, result.data);
        } catch (error) {
            console.error('Report generation error:', error);
            reportTitle.textContent = __('error_generating_report');
            Swal.fire(__('error'), error.message, 'error');
            renderTable(null, []);
        }
    }

    // --- UI Update Functions ---
    function renderTable(reportType, data) {
        const selectedOption = reportType ? reportTypeSelect.querySelector(`option[value="${reportType}"]`) : null;
        reportTitle.textContent = selectedOption ? `${__('report')}: ${selectedOption.textContent}` : __('report_results');
        
        currentReportData = data;

        const emptyMessage = reportType ? __('no_data_found_criteria') : __('select_report_and_generate');
        
        if (data && data.length > 0) {
            const headers = Object.keys(data[0]);
            currentReportHeaders = headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
            const columns = headers.map((header, index) => ({ 
                data: header, 
                title: currentReportHeaders[index]
            }));
            
            initializeDataTable(data, columns);
            exportButtonsContainer.style.display = 'inline-flex';

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
            document.getElementById('reportFilterLabel').textContent = selectedOption.dataset.filterLabel || __('filter');
            reportFilterInput.placeholder = selectedOption.dataset.filterPlaceholder || __('enter_filter_value');
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
            <html><head><title>${__('print_report')}</title>
            <style>
                @page { size: A4 landscape; margin: 20px; }
                body { font-family: sans-serif; margin: 0; }
                h1, h2 { text-align: center; margin-bottom: 0.5rem; }
                h1 { font-size: 16pt; } h2 { font-size: 12pt; font-weight: normal; }
                table { width: 100%; border-collapse: collapse; font-size: 8pt; }
                th, td { border: 1px solid #ccc; padding: 4px; text-align: left; word-wrap: break-word; }
                thead th { background-color: #f2f2f2; font-weight: bold; }
            </style></head><body>
            <h1>${__('wms_reports_analytics')}</h1><h2>${reportTitle.textContent}</h2>${tableHtml}
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
    
    updateFilterUI();
    initializeDataTable();
});
