<?php
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS <?php echo __('reports_analytics'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/2.0.8/css/dataTables.bootstrap5.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/litepicker/dist/css/litepicker.css"/>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
    <?php endif; ?>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <div id="content">
        
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0"><?php echo __('reports_analytics'); ?></h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="card shadow-sm mb-4">
                        <div class="card-header header-primary">
                            <h5 class="card-title mb-0"><?php echo __('generate_report'); ?></h5>
                            <div class="card-header-actions">
                                <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-4">
                                    <label for="reportType" class="form-label"><?php echo __('report_type'); ?></label>
                                    <select id="reportType" name="reportType" class="form-select">
                                        <option value="" selected disabled>-- Select a Report --</option>
                                        
                                        <optgroup label="Global Reports (All Warehouses)">
                                            <option value="allWarehouseStockSummary" data-date-filter="false">All Warehouse Stock Summary</option>
                                            <option value="blockedAndLockedStock" data-date-filter="false">Blocked & Locked Stock</option>
                                        </optgroup>

                                        <optgroup label="Inbound Operations">
                                            <option value="grReport" data-filter-required="true" data-filter-label="Receipt No." data-filter-placeholder="Enter Receipt Number..." data-date-filter="true">Goods Received Note (GRN)</option>
                                            <option value="inboundHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 1, "title": "Supplier"}, {"columnIndex": 3, "title": "Status"}, {"columnIndex": 4, "title": "SKU"}, {"columnIndex": 7, "title": "Tire Type"}, {"columnIndex": 12, "title": "Receiver"}]'>Inbound History</option>
                                            <option value="receivingDiscrepancy" data-date-filter="true">Receiving Discrepancy</option>
                                            <option value="supplierPerformance" data-date-filter="true">Supplier Performance</option>
                                        </optgroup>

                                        <optgroup label="Outbound Operations">
                                            <option value="customerOrderDetails" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 1, "title": "Customer"}, {"columnIndex": 3, "title": "Status"}, {"columnIndex": 6, "title": "Product Name"}, {"columnIndex": 5, "title": "Article No"}, {"columnIndex": 10, "title": "Picker"}]'>Customer Order Details</option>
                                            <option value="outboundHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 1, "title": "Customer"}, {"columnIndex": 4, "title": "Status"}, {"columnIndex": 5, "title": "SKU"}, {"columnIndex": 8, "title": "Tire Type"}, {"columnIndex": 13, "title": "Picker"}]'>Outbound History</option>
                                            <option value="returnHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 2, "title": "Customer"}, {"columnIndex": 6, "title": "Tire Type"}, {"columnIndex": 9, "title": "Condition"}, {"columnIndex": 10, "title": "Status"}]'>Return History</option>
                                            <option value="onTimeShipment" data-date-filter="true">On-Time Shipment</option>
                                            <option value="orderLifecycle" data-date-filter="true">Order Lifecycle Analysis</option>
                                            <option value="fillRate" data-date-filter="true">Fill Rate Report</option>
                                            <option value="orderMovementHistory" data-filter-required="true" data-filter-label="Order #" data-filter-placeholder="Enter Order Number..." data-date-filter="false">Order Movement History</option>
                                        </optgroup>

                                        <optgroup label="Inventory Management">
                                            <option value="productMasterList" data-date-filter="false" data-adv-filters-config='[{"columnIndex": 0, "title": "SKU"}, {"columnIndex": 1, "title": "Name"}, {"columnIndex": 3, "title": "Article No"}, {"columnIndex": 4, "title": "Tire Type"}]'>Product Master List</option>
                                            <option value="inventorySummary" data-date-filter="false">Inventory Summary</option>
                                            <option value="stockByLocation" data-date-filter="false">Stock By Location</option>
                                            <option value="inventoryAging" data-date-filter="false">Inventory Aging (By Receipt)</option>
                                            <option value="dotCodeAging" data-date-filter="false">DOT Code Aging (By Manufacture)</option>
                                            <option value="transferHistory" data-date-filter="true">Transfer History</option>
                                            <option value="deadStock" data-date-filter="false">Dead Stock Report</option>
                                            <option value="expiringStock" data-date-filter="false">Expiring Stock Report</option>
                                            <option value="productMovement" data-filter-required="true" data-filter-label="SKU / Article No" data-filter-placeholder="Enter Product SKU/Article No..." data-date-filter="true">Product Movement</option>
                                            <option value="scrapHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 3, "title": "Scrapped By"}, {"columnIndex": 4, "title": "SKU"}, {"columnIndex": 7, "title": "Tire Type"}]'>Scrap History</option>
                                        </optgroup>
                                        
                                        <optgroup label="Performance & User Activity">
                                            <option value="pickerPerformance" data-date-filter="true">Picker Performance</option>
                                            <option value="driverPerformance" data-date-filter="true">Driver Performance</option>
                                            <option value="userProductivity" data-date-filter="true">User Productivity Report</option>
                                            <option value="orderFulfillmentLeadTime" data-date-filter="true">Order Fulfillment Lead Time</option>
                                        </optgroup>
                                        
                                        <optgroup label="Financial & Auditing">
                                            <option value="inventoryValuation" data-date-filter="false">Inventory Valuation</option>
                                            <option value="stockAdjustmentHistory" data-date-filter="true">Stock Adjustment History</option>
                                            <option value="locationCapacity" data-date-filter="false">Location Capacity & Utilization</option>
                                            <option value="customerTransactionHistory" data-filter-required="true" data-filter-label="Customer ID" data-filter-placeholder="Enter Customer ID..." data-filter-type="number" data-date-filter="true">Customer Transactions</option>
                                        </optgroup>

                                    </select>
                                </div>
                                <div class="col-md-4" id="dateRangeContainer" style="display: none;">
                                    <label for="dateRangePicker" class="form-label"><?php echo __('date_range'); ?></label>
                                    <div class="input-group">
                                        <input type="text" id="dateRangePicker" name="dateRangePicker" class="form-control">
                                        <button class="btn btn-outline-secondary" type="button" id="clearDateRangeBtn" title="Clear date range">
                                            <i class="bi bi-x-lg"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-4" id="mainFilterContainer" style="display: none;">
                                    <label id="reportFilterLabel" for="reportFilterInput" class="form-label">Filter</label>
                                    <input type="text" id="reportFilterInput" name="reportFilterInput" class="form-control" placeholder="Optional filter...">
                                </div>
                            </div>
                            <div class="row mt-3">
                               <div class="col-12 text-end">
                                    <button id="generateReportBtn" class="btn btn-primary"><?php echo __('generate_report'); ?></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card shadow-sm">
                        <div class="card-header header-warning d-flex justify-content-between align-items-center">
                            <h5 id="reportTitle" class="card-title mb-0"><?php echo __('report_results'); ?></h5>
                            <div class="d-flex align-items-center gap-2">
                                <div class="btn-toolbar">
                                    <div class="btn-group me-2" id="exportButtonsContainer" style="display: none;">
                                        <button id="exportPdfBtn" class="btn btn-sm btn-danger"><i class="bi bi-file-earmark-pdf me-1"></i> PDF</button>
                                        <button id="exportXlsxBtn" class="btn btn-sm btn-success"><i class="bi bi-file-earmark-excel me-1"></i> Excel</button>
                                        <button id="printReportBtn" class="btn btn-sm btn-info"><i class="bi bi-printer me-1"></i> Print</button>
                                    </div>
                                    <div class="dropdown" id="filterDropdownContainer" style="display: none;">
                                        <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" id="filterDropdownBtn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                                            <i class="bi bi-filter me-1"></i> <?php echo __('filter'); ?>
                                        </button>
                                        <div class="dropdown-menu p-3" aria-labelledby="filterDropdownBtn" style="width: 320px;">
                                            <div id="advancedFilterContainer">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="card-header-actions">
                                    <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                    <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                    <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-striped table-hover w-100" id="reportTable">
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.js"></script>
    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.bootstrap5.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/litepicker/dist/litepicker.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/reports.js" defer></script>

</body>
</html>
