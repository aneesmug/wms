<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Reports & Analytics</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/2.0.8/css/dataTables.bootstrap5.css" rel="stylesheet">
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
                                        
                                        <optgroup label="Global Reports (All Warehouses)">
                                            <option value="allWarehouseStockSummary">All Warehouse Stock Summary</option>
                                            <option value="blockedAndLockedStock">Blocked & Locked Stock</option>
                                        </optgroup>

                                        <optgroup label="Inbound Operations">
                                            <option value="grReport" data-filter-required="true" data-filter-label="Receipt No." data-filter-placeholder="Enter Receipt Number...">Goods Received Note (GRN)</option>
                                            <option value="inboundHistory">Inbound History</option>
                                            <option value="receivingDiscrepancy">Receiving Discrepancy</option>
                                            <option value="supplierPerformance">Supplier Performance</option>
                                        </optgroup>

                                        <optgroup label="Outbound Operations">
                                            <option value="outboundHistory">Outbound History</option>
                                            <option value="returnHistory">Return History</option>
                                            <option value="onTimeShipment">On-Time Shipment</option>
                                            <option value="orderLifecycle">Order Lifecycle Analysis</option>
                                            <option value="fillRate">Fill Rate Report</option>
                                            <option value="orderMovementHistory" data-filter-required="true" data-filter-label="Order #" data-filter-placeholder="Enter Order Number...">Order Movement History</option>
                                        </optgroup>

                                        <optgroup label="Inventory Management">
                                            <option value="inventorySummary">Inventory Summary</option>
                                            <option value="stockByLocation">Stock By Location</option>
                                            <option value="inventoryAging">Inventory Aging</option>
                                            <option value="transferHistory">Transfer History</option>
                                            <option value="deadStock">Dead Stock Report</option>
                                            <option value="expiringStock">Expiring Stock Report</option>
                                            <option value="productMovement" data-filter-required="true" data-filter-label="SKU / Article No" data-filter-placeholder="Enter Product SKU/Article No...">Product Movement</option>
                                            <!-- MODIFICATION: Added Scrap History report option -->
                                            <option value="scrapHistory">Scrap History</option>
                                        </optgroup>
                                        
                                        <optgroup label="Performance & User Activity">
                                            <option value="pickerPerformance">Picker Performance</option>
                                            <option value="userProductivity">User Productivity Report</option>
                                            <option value="orderFulfillmentLeadTime">Order Fulfillment Lead Time</option>
                                        </optgroup>
                                        
                                        <optgroup label="Financial & Auditing">
                                            <option value="inventoryValuation">Inventory Valuation</option>
                                            <option value="stockAdjustmentHistory">Stock Adjustment History</option>
                                            <option value="locationCapacity">Location Capacity & Utilization</option>
                                            <option value="customerTransactionHistory" data-filter-required="true" data-filter-label="Customer ID" data-filter-placeholder="Enter Customer ID..." data-filter-type="number">Customer Transactions</option>
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
                                <div class="col-md-3" style="display: none;">
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
                            <div id="exportButtonsContainer" class="btn-group" style="display: none;">
                                <button id="exportPdfBtn" class="btn btn-sm btn-danger"><i class="bi bi-file-earmark-pdf me-1"></i> PDF</button>
                                <button id="exportXlsxBtn" class="btn btn-sm btn-success"><i class="bi bi-file-earmark-excel me-1"></i> Excel</button>
                                <button id="printReportBtn" class="btn btn-sm btn-info"><i class="bi bi-printer me-1"></i> Print</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-striped table-hover w-100" id="reportTable">
                                    <!-- Headers and body will be populated by DataTables -->
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- SCRIPTS -->
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <!-- Bootstrap Bundle JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- SweetAlert2 -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    
    <!-- DataTables Core -->
    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.js"></script>
    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.bootstrap5.js"></script>

    <!-- Export Libraries -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"></script>

    <!-- App-specific scripts -->
    <script src="js/main.js"></script>
    <script src="js/reports.js" defer></script>

</body>
</html>
