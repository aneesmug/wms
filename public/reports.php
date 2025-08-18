<?php
/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English text for titles, headers, buttons, and select options with the `__()` translation function.
* 2. Added the required script tag in the <head> to load translations with `JSON_UNESCAPED_UNICODE`.
* 3. The entire page, including all report names in the dropdown, is now fully localizable.
*/
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('reports_analytics'); ?></title>
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
        <link rel="stylesheet" href="css/style-rtl.css">
    <?php endif; ?>
    <script> window.lang = <?php echo json_encode($translations, JSON_UNESCAPED_UNICODE); ?>; </script>
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
                                <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-4">
                                    <label for="reportType" class="form-label"><?php echo __('report_type'); ?></label>
                                    <select id="reportType" name="reportType" class="form-select">
                                        <option value="" selected disabled>-- <?php echo __('select_a_report'); ?> --</option>
                                        
                                        <optgroup label="<?php echo __('global_reports'); ?>">
                                            <option value="allWarehouseStockSummary" data-date-filter="false"><?php echo __('all_warehouse_stock_summary'); ?></option>
                                            <option value="blockedAndLockedStock" data-date-filter="false"><?php echo __('blocked_locked_stock'); ?></option>
                                        </optgroup>

                                        <optgroup label="<?php echo __('inbound_operations'); ?>">
                                            <option value="grReport" data-filter-required="true" data-filter-label="<?php echo __('receipt_no'); ?>" data-filter-placeholder="<?php echo __('enter_receipt_number'); ?>" data-date-filter="true"><?php echo __('goods_received_note'); ?></option>
                                            <option value="inboundHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 1, "title": "<?php echo __('supplier'); ?>"}, {"columnIndex": 3, "title": "<?php echo __('status'); ?>"}, {"columnIndex": 4, "title": "<?php echo __('sku'); ?>"}, {"columnIndex": 7, "title": "<?php echo __('tire_type'); ?>"}, {"columnIndex": 12, "title": "<?php echo __('receiver'); ?>"}]'><?php echo __('inbound_history'); ?></option>
                                            <option value="receivingDiscrepancy" data-date-filter="true"><?php echo __('receiving_discrepancy'); ?></option>
                                            <option value="supplierPerformance" data-date-filter="true"><?php echo __('supplier_performance'); ?></option>
                                        </optgroup>

                                        <optgroup label="<?php echo __('outbound_operations'); ?>">
                                            <option value="customerOrderDetails" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 1, "title": "<?php echo __('customer'); ?>"}, {"columnIndex": 3, "title": "<?php echo __('status'); ?>"}, {"columnIndex": 6, "title": "<?php echo __('product_name'); ?>"}, {"columnIndex": 5, "title": "<?php echo __('article_no'); ?>"}, {"columnIndex": 10, "title": "<?php echo __('picker'); ?>"}]'><?php echo __('customer_order_details'); ?></option>
                                            <option value="outboundHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 1, "title": "<?php echo __('customer'); ?>"}, {"columnIndex": 4, "title": "<?php echo __('status'); ?>"}, {"columnIndex": 5, "title": "<?php echo __('sku'); ?>"}, {"columnIndex": 8, "title": "<?php echo __('tire_type'); ?>"}, {"columnIndex": 13, "title": "<?php echo __('picker'); ?>"}]'><?php echo __('outbound_history'); ?></option>
                                            <option value="returnHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 2, "title": "<?php echo __('customer'); ?>"}, {"columnIndex": 6, "title": "<?php echo __('tire_type'); ?>"}, {"columnIndex": 9, "title": "<?php echo __('condition'); ?>"}, {"columnIndex": 10, "title": "<?php echo __('status'); ?>"}]'><?php echo __('return_history'); ?></option>
                                            <option value="onTimeShipment" data-date-filter="true"><?php echo __('on_time_shipment'); ?></option>
                                            <option value="orderLifecycle" data-date-filter="true"><?php echo __('order_lifecycle_analysis'); ?></option>
                                            <option value="fillRate" data-date-filter="true"><?php echo __('fill_rate_report'); ?></option>
                                            <option value="orderMovementHistory" data-filter-required="true" data-filter-label="<?php echo __('order_no'); ?>" data-filter-placeholder="<?php echo __('enter_order_number'); ?>" data-date-filter="false"><?php echo __('order_movement_history'); ?></option>
                                        </optgroup>

                                        <optgroup label="<?php echo __('inventory_management'); ?>">
                                            <option value="productMasterList" data-date-filter="false" data-adv-filters-config='[{"columnIndex": 0, "title": "<?php echo __('sku'); ?>"}, {"columnIndex": 1, "title": "<?php echo __('name'); ?>"}, {"columnIndex": 3, "title": "<?php echo __('article_no'); ?>"}, {"columnIndex": 4, "title": "<?php echo __('tire_type'); ?>"}]'><?php echo __('product_master_list'); ?></option>
                                            <option value="inventorySummary" data-date-filter="false"><?php echo __('inventory_summary'); ?></option>
                                            <option value="stockByLocation" data-date-filter="false"><?php echo __('stock_by_location'); ?></option>
                                            <option value="inventoryAging" data-date-filter="false"><?php echo __('inventory_aging_by_receipt'); ?></option>
                                            <option value="dotCodeAging" data-date-filter="false"><?php echo __('dot_code_aging_by_manufacture'); ?></option>
                                            <option value="transferHistory" data-date-filter="true"><?php echo __('transfer_history'); ?></option>
                                            <option value="deadStock" data-date-filter="false"><?php echo __('dead_stock_report'); ?></option>
                                            <option value="expiringStock" data-date-filter="false"><?php echo __('expiring_stock_report'); ?></option>
                                            <option value="productMovement" data-filter-required="true" data-filter-label="<?php echo __('sku_or_article_no'); ?>" data-filter-placeholder="<?php echo __('enter_sku_or_article'); ?>" data-date-filter="true"><?php echo __('product_movement'); ?></option>
                                            <option value="scrapHistory" data-date-filter="true" data-adv-filters-config='[{"columnIndex": 3, "title": "<?php echo __('scrapped_by'); ?>"}, {"columnIndex": 4, "title": "<?php echo __('sku'); ?>"}, {"columnIndex": 7, "title": "<?php echo __('tire_type'); ?>"}]'><?php echo __('scrap_history'); ?></option>
                                        </optgroup>
                                        
                                        <optgroup label="<?php echo __('performance_and_user_activity'); ?>">
                                            <option value="pickerPerformance" data-date-filter="true"><?php echo __('picker_performance'); ?></option>
                                            <option value="driverPerformance" data-date-filter="true"><?php echo __('driver_performance'); ?></option>
                                            <option value="userProductivity" data-date-filter="true"><?php echo __('user_productivity_report'); ?></option>
                                            <option value="orderFulfillmentLeadTime" data-date-filter="true"><?php echo __('order_fulfillment_lead_time'); ?></option>
                                        </optgroup>
                                        
                                        <optgroup label="<?php echo __('financial_and_auditing'); ?>">
                                            <option value="inventoryValuation" data-date-filter="false"><?php echo __('inventory_valuation'); ?></option>
                                            <option value="stockAdjustmentHistory" data-date-filter="true"><?php echo __('stock_adjustment_history'); ?></option>
                                            <option value="locationCapacity" data-date-filter="false"><?php echo __('location_capacity_utilization'); ?></option>
                                            <option value="customerTransactionHistory" data-filter-required="true" data-filter-label="<?php echo __('customer_id'); ?>" data-filter-placeholder="<?php echo __('enter_customer_id'); ?>" data-filter-type="number" data-date-filter="true"><?php echo __('customer_transactions'); ?></option>
                                        </optgroup>

                                    </select>
                                </div>
                                <div class="col-md-4" id="dateRangeContainer" style="display: none;">
                                    <label for="dateRangePicker" class="form-label"><?php echo __('date_range'); ?></label>
                                    <div class="input-group">
                                        <input type="text" id="dateRangePicker" name="dateRangePicker" class="form-control">
                                        <button class="btn btn-outline-secondary" type="button" id="clearDateRangeBtn" title="<?php echo __('clear_date_range'); ?>">
                                            <i class="bi bi-x-lg"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-4" id="mainFilterContainer" style="display: none;">
                                    <label id="reportFilterLabel" for="reportFilterInput" class="form-label"><?php echo __('filter'); ?></label>
                                    <input type="text" id="reportFilterInput" name="reportFilterInput" class="form-control" placeholder="<?php echo __('optional_filter'); ?>">
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
                                        <button id="printReportBtn" class="btn btn-sm btn-info"><i class="bi bi-printer me-1"></i> <?php echo __('print'); ?></button>
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
                                    <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                    <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                    <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
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
