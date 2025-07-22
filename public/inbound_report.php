<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Inbound Report</title>
    
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <!-- SweetAlert2 CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
    
    <style>
        /* General page styles for Select2 dropdown */
        .select2-container--bootstrap-5 .select2-selection {
            width: 100%;
        }

        /* Print-specific styles for 10cm x 15cm sticker */
        @media print {
            @page {
                /* size: 10cm 15cm; */
                margin: 5mm; /* Margin for the printable area */
            }

            /* Hide everything on the page by default */
            body * {
                visibility: hidden;
            }

            /* Make the report container and all its child elements visible */
            #reportContainer, #reportContainer * {
                visibility: visible;
            }

            /* Position the report container to fill the entire print page */
            #reportContainer {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: auto;
                margin: 0;
                padding: 0;
            }

            .printable-area {
                width: 100%;
                border: 1px solid #666; /* Add a border for the sticker outline */
                box-shadow: none !important;
                padding: 1rem;
                font-size: 10pt; /* Adjust base font size for sticker */
            }

            .printable-area .card-header h3 {
                font-size: 14pt; /* Larger font for the main header */
            }

            .printable-area .card-body p {
                font-size: 10pt;
                margin-bottom: 0.5rem;
            }

            .printable-area .table {
                font-size: 9pt; /* Smaller font for table content */
                margin-top: 1rem;
            }
            
            .printable-area .table th,
            .printable-area .table td {
                padding: 0.25rem; /* Reduce padding in table cells */
            }

            .barcode {
                max-width: 100%;
                height: 30px !important; /* Adjust barcode height */
            }

            /* Ensure background colors are printed */
            body {
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }
        }
    </style>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <!-- Main Content -->
    <div id="content">
        
        <header class="bg-white shadow-sm border-bottom no-print">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <!-- This button toggles the offcanvas menu on mobile -->
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0">Inbound Receipt Report</h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-12">
                        <div class="card shadow-sm no-print">
                            <div class="card-body">
                                <h5 class="card-title">Select Receipt to Generate Report</h5>
                                <div class="row g-3 align-items-end">
                                    <div class="col-md-8">
                                        <label for="receiptSelect" class="form-label">Inbound Receipt</label>
                                        <select id="receiptSelect" class="form-select" style="width: 100%;"></select>
                                    </div>
                                    <div class="col-md-4">
                                        <button id="generateReportBtn" class="btn btn-primary w-100">Generate Report</button>
                                        <button id="printReportBtn" class="btn btn-secondary w-100 mt-2 d-none">Print Report</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="reportContainer" class="mt-4">
                            <!-- Report will be injected here by JavaScript -->
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <!-- JavaScript Libraries -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <!-- SweetAlert2 JS -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    
    <!-- Custom Application Scripts -->
    <script src="js/api.js"></script>
    <script src="js/main.js"></script>
    <script src="js/inbound_report.js" defer></script>

</body>
</html>
