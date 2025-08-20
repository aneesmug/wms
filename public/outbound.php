<?php
    /*
    * MODIFICATION SUMMARY:
    * 1. Added translation support for all static text using the `__()` function.
    * 2. Added a new column 'Delivery Address' to the main orders table.
    */
    require_once __DIR__ . '/helpers/auth_helper.php';
    $pageTitle = $pageTitle ?? __('outbound_orders');
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('outbound_orders'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/css/datepicker-bs5.min.css">
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
        
       <?php require_once __DIR__ . '/includes/header.php'; ?>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header header-primary d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><?php echo __('all_orders'); ?></h5>
                                <div class="d-flex align-items-center gap-2">
                                    <select id="statusFilter" class="form-select form-select-sm me-2" style="width: auto;">
                                        <option value=""><?php echo __('all_statuses'); ?></option>
                                        <option value="New"><?php echo __('new'); ?></option>
                                        <option value="Pending Pick"><?php echo __('pending_pick'); ?></option>
                                        <option value="Partially Picked"><?php echo __('partially_picked'); ?></option>
                                        <option value="Picked"><?php echo __('picked'); ?></option>
                                        <option value="Ready for Pickup"><?php echo __('ready_for_pickup'); ?></option>
                                        <option value="Assigned"><?php echo __('assigned'); ?></option>
                                        <option value="Shipped"><?php echo __('shipped'); ?></option>
                                        <option value="Out for Delivery"><?php echo __('out_for_delivery'); ?></option>
                                        <option value="Delivered"><?php echo __('delivered'); ?></option>
                                        <option value="Delivery Failed"><?php echo __('delivery_failed'); ?></option>
                                        <option value="Partially Returned"><?php echo __('partially_returned'); ?></option>
                                        <option value="Returned"><?php echo __('returned'); ?></option>
                                        <option value="Cancelled"><?php echo __('cancelled'); ?></option>
                                        <option value="Scrapped"><?php echo __('scrapped'); ?></option>
                                    </select>
                                    <button id="showCreateOrderModalBtn" class="btn btn-light btn-sm text-nowrap"><i class="bi bi-plus-circle me-1"></i> <?php echo __('new_order'); ?></button>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="outboundOrdersTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th><?php echo __('order_no'); ?></th>
                                                <th><?php echo __('reference_no'); ?></th>
                                                <th><?php echo __('customer_type'); ?></th>
                                                <th><?php echo __('delivery_address'); ?></th>
                                                <th><?php echo __('assigned_to'); ?></th>
                                                <th><?php echo __('ship_by'); ?></th>
                                                <th><?php echo __('status'); ?></th>
                                                <th class="text-end"><?php echo __('actions'); ?></th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-12">
                        <div id="orderProcessingArea" class="card shadow-sm d-none">
                            <div class="card-header header-warning d-flex justify-content-between align-items-center">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h5 class="card-title mb-0"><?php echo __('order_details'); ?>: <span id="selectedOrderNumberDisplay" class="text-primary"></span></h5>
                                    <div>
                                        <button id="editOrderBtn" class="btn btn-sm btn-outline-secondary d-none"><i class="bi bi-pencil"></i> <?php echo __('edit_order'); ?></button>
                                        <button id="printPickReportBtn" class="btn btn-sm btn-outline-light ms-2 d-none"><i class="bi bi-file-earmark-text me-1"></i> <?php echo __('print_pick_report'); ?></button>
                                        <button id="printDeliveryReportBtn" class="btn btn-sm btn-outline-success ms-2 d-none"><i class="bi bi-receipt me-1"></i> <?php echo __('print_delivery_report'); ?></button>
                                    </div>
                                    
                                </div>
                                <input type="hidden" id="currentOrderId">
                            </div>
                            <div class="card-body">
                                <div class="row mb-3">
                                    <div class="col-md-4" id="shippingAreaDisplay"></div>
                                    <div class="col-md-4" id="trackingNumberDisplay"></div>
                                    <div class="col-md-4" id="proofOfDeliveryDisplay"></div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-12" id="assignedDriverDisplay">
                                    </div>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-bordered">
                                        <thead class="table-light">
                                            <tr>
                                                <th><?php echo __('sku'); ?></th>
                                                <th><?php echo __('product'); ?></th>
                                                <th><?php echo __('article_no'); ?></th>
                                                <th><?php echo __('ordered'); ?></th>
                                                <th><?php echo __('picked'); ?></th>
                                                <th><?php echo __('batch'); ?></th>
                                                <th><?php echo __('dot'); ?></th>
                                                <th><?php echo __('location'); ?></th>
                                                <th class="text-center"><?php echo __('actions'); ?></th>
                                            </tr>
                                        </thead>
                                        <tbody id="orderItemsTableBody"></tbody>
                                    </table>
                                </div>
                                <div id="addItemContainer" class="mt-3">
                                </div>
                            </div>
                            <div class="card-footer text-end" id="managementActionsArea" style="display: none;">
                                <button id="cancelOrderBtn" class="btn btn-outline-danger me-2"><?php echo __('cancel_order'); ?></button>
                                <button id="shipOrderBtn" class="btn btn-success d-none"><?php echo __('ship_order'); ?></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/js/datepicker-full.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/outbound.js" defer></script>
</body>
</html>
