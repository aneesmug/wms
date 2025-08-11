<?php
// 004-inbound.php
?>
<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Inbound Operations</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/buttons/2.4.1/css/buttons.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <!-- Datepicker CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/css/datepicker-bs5.min.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
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
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0">Inbound Operations</h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <!-- Receipts Table -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header d-flex justify-content-between align-items-center flex-wrap">
                                <h5 class="card-title mb-2 mb-md-0">Current Inbound Receipts</h5>
                                <div class="d-flex align-items-center gap-3">
                                    <div class="d-flex align-items-center">
                                        <label for="statusFilter" class="form-label me-2 mb-0 small text-nowrap">Status:</label>
                                        <select id="statusFilter" class="form-select form-select-sm" style="width: auto;">
                                            <option value="">All</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Received">Received</option>
                                            <option value="Partially Received">Partially Received</option>
                                            <option value="Partially Putaway">Partially Putaway</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <button id="showCreateReceiptBtn" class="btn btn-primary btn-sm text-nowrap"><i class="bi bi-plus-circle me-1"></i> Create New Receipt</button>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="inboundReceiptsTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Receipt ID</th> <!-- Hidden -->
                                                <th>Receipt No.</th>
                                                <th>Supplier</th>
                                                <th>B/L No.</th> <!-- Hidden -->
                                                <th>Container No.</th> <!-- Hidden -->
                                                <th>Serial No.</th> <!-- Hidden -->
                                                <th>Expected Date</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody><!-- DataTable will populate this --></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Processing Section (Initially Hidden) -->
                <div id="processingSection" class="row g-4 mt-4 d-none">
                    <!-- Form Column -->
                    <div class="col-lg-7">
                        <div id="receivePutawaySection" class="card shadow-sm">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Process Receipt <span id="selectedReceiptDisplay" class="text-primary fw-normal"></span></h5>
                            </div>
                            <div class="card-body">
                                 <div class="row g-3">
                                    <div class="col-12">
                                        <label for="scanarticle_noInput" class="form-label">Product</label>
                                        <select id="scanarticle_noInput" name="scanarticle_noInput" class="form-select" style="width: 100%;"></select>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="itemQuantity" class="form-label">Quantity</label>
                                        <input type="number" id="itemQuantity" name="itemQuantity" value="1" min="1" class="form-control numeric-only" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="unitCost" class="form-label">Unit Cost</label>
                                        <input type="number" id="unitCost" name="unitCost" placeholder="0.00" step="0.01" min="0" class="form-control numeric-only">
                                    </div>
                                    <div class="col-12">
                                        <label for="inboundBatchNumber" class="form-label">Batch Number (Source)</label>
                                        <input type="text" id="inboundBatchNumber" name="inboundBatchNumber" placeholder="Auto-generated or select from right" class="form-control">
                                    </div>
                                    <div class="col-12">
                                        <label for="inboundDotCode" class="form-label">DOT Manufacture Code (WW/YY)</label>
                                        <select id="inboundDotCode" name="inboundDotCode" class="form-select" style="width: 100%;" required>
                                            <!-- Options will be populated by JavaScript -->
                                        </select>
                                    </div>
                                    <div class="col-12">
                                        <label for="scanLocationInput" class="form-label">Location for Putaway</label>
                                        <select id="scanLocationInput" name="scanLocationInput" class="form-select" style="width: 100%;"></select>
                                    </div>
                                    <div class="col-12 d-grid gap-2 d-md-flex justify-content-md-end">
                                        <button id="receiveItemBtn" class="btn btn-info text-white">Receive</button>
                                        <button id="putawayItemBtn" class="btn btn-secondary">Putaway</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Putaway Candidates Column -->
                    <div class="col-lg-5">
                        <div class="card shadow-sm h-100">
                            <div class="card-body">
                                <h6 class="card-subtitle mb-2 text-muted">Items Ready for Putaway</h6>
                                <div id="putawayCandidatesList" class="list-group" style="max-height: 400px; overflow-y: auto;">
                                    <!-- JS populates this -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <!-- JavaScript Libraries -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/2.4.1/js/dataTables.buttons.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/2.4.1/js/buttons.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <!-- Datepicker JS -->
    <script src="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/js/datepicker-full.min.js"></script>
    
    <script>
        // Initialize Bootstrap tooltips for the desktop sidebar icons
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl)
        })
    </script>

    <!-- Your existing JS files -->
    <script src="js/api.js"></script>
    <script src="js/barcodeScanner.js"></script>
    <script src="js/main.js"></script>
    <script src="js/inbound.js" defer></script>
</body>
</html>
