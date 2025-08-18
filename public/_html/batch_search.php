<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Batch Search & Print</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        /* This container is hidden off-screen by default */
        #print-area {
            position: absolute;
            left: -9999px;
            top: -9999px;
        }

        /* Styles for the printable labels */
        .printable-label {
            width: 15cm;
            height: 10cm;
            padding: 0.5cm;
            background-color: #fff;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            display: flex;
            flex-direction: column;
            overflow: hidden; /* Prevents content from spilling out */
        }
        .printable-label h5 {
            font-size: 14pt;
            font-weight: bold;
            margin: 0;
        }
        .printable-label p { margin-bottom: 0.6rem; }
        .printable-label strong { font-weight: 600; }
        .location-highlight {
            background-color: #e9ecef;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 13pt;
            display: inline-block;
        }
        .barcode-section {
            text-align: center;
            margin-top: auto;
        }
        .barcode {
            display: block;
            margin-left: auto;
            margin-right: auto;
        }

        /* Print-specific styles */
        @media print {
            @page {
                size: 15cm 10cm; /* Enforce landscape layout */
                margin: 0;
            }

            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            /* Hide everything in the body except the print area */
            body > *:not(#print-area) {
                display: none !important;
            }
            
            /* Make the print area visible and position it correctly for printing */
            #print-area {
                position: static;
                top: 0;
                left: 0;
            }
            .printable-label {
                border: none;
                margin: 0;
                box-shadow: none;
                page-break-after: always; /* Ensures each label is on a new page */
            }
        }
    </style>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <!-- Main Content -->
    <div id="content">
        
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <!-- This button toggles the offcanvas menu on mobile -->
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0">Print Batch Labels</h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>
        
            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="row justify-content-center">
                        <div class="col-lg-8">
                            <div class="card shadow-sm">
                                <div class="card-body">
                                    <h5 class="card-title">Find Labels to Print</h5>
                                    <p class="card-text text-muted">Enter a Batch or Receipt Number to generate printable labels.</p>
                                    <div class="input-group mb-3">
                                        <input type="text" id="searchInput" class="form-control" placeholder="Enter Batch or Receipt Number...">
                                        <button id="searchBtn" class="btn btn-primary" type="button"><i class="bi bi-search"></i> Generate & Print</button>
                                    </div>
                                </div>
                            </div>

                            <div id="resultsContainer" class="mt-4">
                                <!-- Search results will be injected here -->
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- This area is hidden on screen and used to build the labels for printing -->
    <div id="print-area"></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="js/api.js"></script>
    <script src="js/main.js"></script>
    <script src="js/batch_search.js" defer></script>
</body>
</html>
