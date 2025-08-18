<?php
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('order_picking_processing'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
     <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
    <?php endif; ?>
    <style>
        .order-card {
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            border-width: 1px;
        }
        .order-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-color: var(--bs-primary);
        }
        .order-card.selected {
            border-color: var(--bs-primary);
            border-width: 2px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .card-body-hover {
            min-height: 140px;
        }
    </style>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <div id="content" class="d-flex flex-column">
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex align-items-center justify-content-between py-3">
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark"><?php echo __('order_picking_processing'); ?></h1>
                    <div id="managementActionsArea" class="d-none">
                        <button id="printPickReportBtn" class="btn btn-sm btn-outline-secondary" disabled><i class="bi bi-file-earmark-text me-1"></i> <?php echo __('print_pick_report'); ?></button>
                        <button id="printStickersBtn" class="btn btn-sm btn-outline-secondary" disabled><i class="bi bi-printer me-1"></i> Print Stickers</button>
                    </div>
                </div>
            </div>
        </header>

        <main class="flex-grow-1 p-4">
            <div class="row g-4">
                <div class="col-lg-12">
                    <div class="card h-100 shadow-sm">
                        <div class="card-header header-primary d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0"><?php echo __('orders_for_picking'); ?></h5>
                            <div class="d-flex align-items-center gap-2">
                                <div class="input-group input-group-sm" style="width: 250px;">
                                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                    <input type="search" id="orderSearchInput" class="form-control border-start-0" placeholder="<?php echo __('search_by_order_customer'); ?>">
                                </div>
                                <select id="pickingStatusFilter" class="form-select form-select-sm" style="width: auto;">
                                    <option value="all"><?php echo __('show_all'); ?></option>
                                    <option value="Pending Pick">Pending Pick</option>
                                    <option value="Partially Picked">Partially Picked</option>
                                    <option value="Picked">Picked</option>
                                    <option value="Staged">Staged</option>
                                    <option value="Delivery Failed">Delivery Failed</option>
                                    <option value="Assigned">Assigned</option>
                                </select>
                                <div class="card-header-actions">
                                    <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                    <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                    <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="notificationArea" class="mb-3"></div>
                            <div id="ordersGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3">
                            </div>
                             <div id="noOrdersMessage" class="text-center p-5 d-none">
                                <i class="bi bi-box-seam" style="font-size: 3rem;"></i>
                                <h5 class="mt-3">No orders found for the selected filter.</h5>
                            </div>
                            <nav id="paginationNav" class="mt-4 d-flex justify-content-center"></nav>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <div id="pickingProcessArea" class="d-none">
                        <div class="card shadow-sm">
                            <div class="card-header header-warning d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><?php echo __('processing_order'); ?>: <span id="selectedOrderNumberDisplay" class="text-primary"></span></h5>
                                <div class="card-header-actions">
                                    <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                    <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                    <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                </div>
                            </div>
                            <div class="card-body">
                                <input type="hidden" id="currentOrderId">
                                <div class="mb-3">
                                    <h6><?php echo __('items_to_pick'); ?>:</h6>
                                    <div class="table-responsive">
                                        <table class="table table-bordered">
                                            <thead class="table-light">
                                                <tr>
                                                    <th><?php echo __('item_no'); ?></th>
                                                    <th><?php echo __('product'); ?></th>
                                                    <th><?php echo __('sku'); ?></th>
                                                    <th><?php echo __('article_no'); ?></th>
                                                    <th><?php echo __('ordered'); ?></th>
                                                    <th><?php echo __('picked'); ?></th>
                                                    <th colspan="4"></th>
                                                </tr>
                                            </thead>
                                            <tbody id="orderItemsTableBody"></tbody>
                                        </table>
                                    </div>
                                </div>
                                
                                <div id="pickActionsArea" class="d-none">
                                    <hr>
                                    <h6><?php echo __('perform_pick'); ?>:</h6>
                                    <div class="row g-3 align-items-end">
                                        <div class="col-md-2">
                                            <label for="pickItemNumberInput" class="form-label"><?php echo __('item_no'); ?></label>
                                            <input type="text" class="form-control numeric-only" id="pickItemNumberInput" placeholder="e.g., 1">
                                        </div>
                                        <div class="col-md-3">
                                            <label for="pickDotCodeSelect" class="form-label"><?php echo __('dot'); ?></label>
                                            <select id="pickDotCodeSelect" class="form-select"></select>
                                        </div>
                                        <div class="col-md-3">
                                            <label for="pickLocationSelect" class="form-label"><?php echo __('location'); ?></label>
                                            <select id="pickLocationSelect" class="form-select"></select>
                                        </div>
                                        <div class="col-md-2">
                                            <label for="pickBatchNumberSelect" class="form-label"><?php echo __('batch'); ?></label>
                                            <select id="pickBatchNumberSelect" class="form-select"></select>
                                        </div>
                                        <div class="col-md-1">
                                            <label for="pickQuantityInput" class="form-label"><?php echo __('qty'); ?></label>
                                            <input type="number" class="form-control numeric-only" id="pickQuantityInput" min="1" value="1">
                                        </div>
                                        <div class="col-md-1">
                                            <button id="pickItemBtn" class="btn btn-success w-100" disabled><i class="bi bi-check-lg"></i></button>
                                        </div>
                                    </div>
                                    <div id="pickQuantityError" class="text-danger small mt-1"></div>
                                </div>
                                
                                <div id="stagingActionsArea" class="d-none mt-3">
                                    <hr>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="mb-1"><strong><?php echo __('shipping_area'); ?>:</strong> <span id="shippingAreaDisplay" class="">Not Staged</span></p>
                                            <p class="mb-0"><strong><?php echo __('driver'); ?>:</strong> <span id="driverInfoDisplay" class="">Not Assigned</span></p>
                                        </div>
                                        <div class="d-flex gap-2 flex-wrap">
                                            <button id="scrapOrderBtn" class="btn btn-danger d-none"><i class="bi bi-trash-fill me-1"></i> <?php echo __('scrap_items'); ?></button>
                                            <button id="stageOrderBtn" class="btn btn-warning d-none"><?php echo __('stage_for_pickup'); ?></button>
                                            <button id="assignDriverBtn" class="btn btn-primary d-none"><i class="bi bi-person-plus-fill me-1"></i> <?php echo __('assign_driver'); ?></button>
                                            <button id="changeDriverBtn" class="btn btn-info d-none"><i class="bi bi-person-vcard me-1"></i> <?php echo __('change_driver'); ?></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/notifications.js"></script>
    <script src="js/picking.js"></script>
</body>
</html>
