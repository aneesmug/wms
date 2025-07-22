<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Reports & Analytics</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/buttons/2.4.1/css/buttons.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <!-- SweetAlert2 CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
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
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0">Reports & Analytics</h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <!-- Report Selection and Filters -->
                    <div class="card shadow-sm mb-4">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Generate Report</h5>
                        </div>
                        <div class="card-body">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-3">
                                    <label for="reportType" class="form-label">Report Type</label>
                                    <select id="reportType" name="reportType" class="form-select">
                                        <option value="" selected disabled>-- Select a Report --</option>
                                        <optgroup label="Standard Reports">
                                            <option value="inventorySummary">Inventory Summary</option>
                                            <option value="stockByLocation">Stock By Location</option>
                                            <option value="inboundHistory">Inbound History</option>
                                            <option value="outboundHistory">Outbound History</option>
                                            <option value="productMovement" data-filter-required="true" data-filter-label="SKU / Barcode" data-filter-placeholder="Enter Product SKU/Barcode...">Product Movement</option>
                                            <option value="customerTransactionHistory" data-filter-required="true" data-filter-label="Customer ID" data-filter-placeholder="Enter Customer ID..." data-filter-type="number">Customer Transactions</option>
                                            <option value="orderMovementHistory" data-filter-required="true" data-filter-label="Order #" data-filter-placeholder="Enter Order Number...">Order Movement History</option>
                                        </optgroup>
                                        <optgroup label="Performance & Efficiency">
                                            <option value="pickerPerformance">Picker Performance</option>
                                            <option value="orderFulfillmentLeadTime">Order Fulfillment Lead Time</option>
                                            <option value="supplierPerformance">Supplier Performance</option>
                                            <option value="orderLifecycle">Order Lifecycle Analysis</option>
                                            <option value="fillRate">Fill Rate Report</option>
                                        </optgroup>
                                        <optgroup label="Financial & Aging">
                                            <option value="inventoryAging">Inventory Aging</option>
                                            <option value="inventoryValuation">Inventory Valuation</option>
                                            <option value="deadStock">Dead Stock Report</option>
                                        </optgroup>
                                        <optgroup label="Capacity & Auditing">
                                            <option value="locationCapacity">Location Capacity & Utilization</option>
                                            <option value="stockAdjustmentHistory">Stock Adjustment History</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <label for="startDate" class="form-label">Start Date</label>
                                    <input type="date" id="startDate" name="startDate" class="form-control">
                                </div>
                                <div class="col-md-3">
                                    <label for="endDate" class="form-label">End Date</label>
                                    <input type="date" id="endDate" name="endDate" class="form-control">
                                </div>
                                <div class="col-md-3">
                                    <label id="reportFilterLabel" for="reportFilterInput" class="form-label">Filter</label>
                                    <input type="text" id="reportFilterInput" name="reportFilterInput" class="form-control" placeholder="Optional filter...">
                                </div>
                                <div class="col-12 text-end">
                                    <button id="generateReportBtn" class="btn btn-primary">Generate Report</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Report Display Area -->
                    <div class="card shadow-sm">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 id="reportTitle" class="card-title mb-0">Report Results</h5>
                            <div class="btn-group">
                                <button id="exportCsvBtn" class="btn btn-sm btn-outline-secondary d-none">
                                    <i class="bi bi-download me-1"></i> Export to CSV
                                </button>
                                <button id="exportPdfBtn" class="btn btn-sm btn-outline-danger d-none">
                                    <i class="bi bi-file-earmark-pdf me-1"></i> Export to PDF
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-striped table-hover" id="reportTable">
                                    <thead id="reportTableHeader" class="table-light">
                                        <!-- Headers populated by JS -->
                                    </thead>
                                    <tbody id="reportTableBody">
                                        <tr>
                                            <td colspan="12" class="text-center p-4 text-muted">Select a report type and click "Generate Report" to see results.</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    <!-- SweetAlert2 handles all modals and messages -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <!-- jsPDF for PDF Export -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/reports.js" defer></script>
</body>
</html>
