<?php
require_once __DIR__ . '/helpers/auth_helper.php';
$pageTitle = $pageTitle ?? __('my_deliveries');
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('my_deliveries'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
        <link rel="stylesheet" href="css/style-rtl.css">
    <?php endif; ?>
    <script> window.lang = <?php echo json_encode($translations, JSON_UNESCAPED_UNICODE); ?>; </script>
    <style>
        #assignedOrdersTable tbody tr, #deliveredOrdersTable tbody tr { cursor: pointer; }
        #scanner-video { max-width: 100%; border-radius: 0.5rem; }
    </style>
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
                    <h1 class="h4 mb-0 text-dark"><?= $pageTitle ?? __('default_page') ?></h1>
                    <?php require_once __DIR__ . '/helpers/lang_helper.php'; ?>
                </div>
            </div>
        </header>

        <main class="container-fluid p-4">
            <div class="row g-4">
                <div class="col-lg-12 col-xl-12">
                    <div class="card">
                        <div class="card-header header-warning p-0 border-bottom">
                            <ul class="nav nav-tabs nav-fill" id="deliveryTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="active-tab" data-bs-toggle="tab" data-bs-target="#active-orders" type="button" role="tab" aria-controls="active-orders" aria-selected="true"><?php echo __('active'); ?></button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="history-tab" data-bs-toggle="tab" data-bs-target="#history-orders" type="button" role="tab" aria-controls="history-orders" aria-selected="false"><?php echo __('history'); ?></button>
                                </li>
                            </ul>
                        </div>
                        <div class="card-body p-0">
                            <div class="tab-content" id="deliveryTabsContent">
                                <div class="tab-pane fade show active p-2" id="active-orders" role="tabpanel" aria-labelledby="active-tab">
                                    <div class="table-responsive">
                                        <table id="assignedOrdersTable" class="table table-striped table-hover" style="width:100%">
                                            <thead>
                                                <tr>
                                                    <th><?php echo __('order_no'); ?></th>
                                                    <th><?php echo __('customer'); ?></th>
                                                    <th><?php echo __('status'); ?></th>
                                                </tr>
                                            </thead>
                                            <tbody></tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="tab-pane fade p-2" id="history-orders" role="tabpanel" aria-labelledby="history-tab">
                                    <div class="table-responsive">
                                        <table id="deliveredOrdersTable" class="table table-striped table-hover" style="width:100%">
                                            <thead>
                                                <tr>
                                                    <th><?php echo __('order_no'); ?></th>
                                                    <th><?php echo __('customer'); ?></th>
                                                    <th><?php echo __('status'); ?></th>
                                                    <th><?php echo __('date'); ?></th>
                                                </tr>
                                            </thead>
                                            <tbody></tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12 col-xl-12">
                    <div id="orderDetailsArea" class="d-none">
                        <div class="card">
                            <div class="card-header header-warning d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><?php echo __('order_details'); ?>: <span id="orderNumberDisplay" class="text-primary"></span></h5>
                                <span id="orderStatusBadge" class="badge"></span>
                            </div>
                            <div class="card-body">
                                <input type="hidden" id="currentOrderId">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6><?php echo __('customer_information'); ?></h6>
                                        <p class="mb-1"><strong><?php echo __('name'); ?>:</strong> <span id="customerName"></span></p>
                                        <p class="mb-1"><strong><?php echo __('address'); ?>:</strong> <span id="customerAddress"></span></p>
                                    </div>
                                    <div class="col-md-6">
                                        <h6><?php echo __('order_summary'); ?></h6>
                                        <p class="mb-1"><strong><?php echo __('total_items'); ?>:</strong> <span id="totalItems"></span></p>
                                        <p class="mb-1"><strong><?php echo __('items_scanned'); ?>:</strong> <span id="scannedItems"></span></p>
                                        <div id="deliveryProofSection" class="d-none mt-2">
                                             <p class="mb-1"><strong><?php echo __('delivered_to'); ?>:</strong> <span id="deliveredToName"></span></p>
                                             <p class="mb-1"><strong><?php echo __('receiver_phone'); ?>:</strong> <span id="receiverPhone"></span></p>
                                             <p class="mb-1"><a href="#" id="deliveryPhotoLink" target="_blank" class="btn btn-sm btn-outline-info"><i class="bi bi-camera"></i> <?php echo __('view_proof'); ?></a></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="card-footer text-end" id="actionButtons">
                            </div>
                        </div>
                    </div>

                    <div id="scanArea" class="card mt-4 d-none">
                        <div class="card-header header-warning d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0"><?php echo __('scan_items_for_pickup'); ?></h5>
                            <button id="cancelScanBtn" class="btn btn-sm btn-outline-secondary"><?php echo __('cancel_scan'); ?></button>
                        </div>
                        <div class="card-body">
                            <div class="row g-4">
                                <div class="col-md-6">
                                    <h6><?php echo __('items_to_scan'); ?></h6>
                                    <ul id="scanItemList" class="list-group"></ul>
                                </div>
                                <div class="col-md-6">
                                    <h6><?php echo __('scanner'); ?></h6>
                                    <video id="scanner-video"></video>
                                    <input type="text" id="manualScanInput" class="form-control mt-2" placeholder="<?php echo __('or_enter_sticker_code_manually'); ?>">
                                    <div id="scanFeedback" class="mt-2"></div>
                                </div>
                            </div>
                            <hr>
                            <h6><?php echo __('scan_history'); ?></h6>
                            <div class="table-responsive" style="max-height: 250px;">
                                <table class="table table-sm table-striped">
                                    <thead>
                                        <tr>
                                            <th><?php echo __('time'); ?></th>
                                            <th><?php echo __('product'); ?></th>
                                            <th><?php echo __('sticker'); ?></th>
                                        </tr>
                                    </thead>
                                    <tbody id="scanHistoryTableBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div id="noOrderSelected" class="text-center p-5 bg-white rounded shadow-sm">
                        <i class="bi bi-box-seam" style="font-size: 4rem;"></i>
                        <h5 class="mt-3"><?php echo __('select_an_order_to_view_details'); ?></h5>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script type="text/javascript" src="https://unpkg.com/@zxing/library@latest/umd/index.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/delivery.js"></script>
</body>
</html>
