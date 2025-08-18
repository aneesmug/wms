<?php
    require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('dashboard'); ?> - WMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
    <?php endif; ?>
</head>
<body class="bg-light">
    <div id="content">
    <?php include 'includes/menu.php'; ?>
        <div class="flex-grow-1 d-flex flex-column">
            <header class="bg-white shadow-sm border-bottom">
                <div class="container-fluid px-4">
                    <div class="d-flex justify-content-between align-items-center py-3">
                        <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                            <i class="bi bi-list"></i>
                        </button>
                        <h1 class="h4 mb-0 text-dark"><?php echo __('dashboard'); ?></h1>
                        <div class="d-flex align-items-center">
                            <label for="warehouseSelector" class="form-label me-2 mb-0"><?php echo __('warehouse'); ?>:</label>
                            <select id="warehouseSelector" class="form-select form-select-sm" style="width: auto;"></select>
                        </div>
                    </div>
                </div>
            </header>
            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-4 mb-4">
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-success text-white p-3 rounded-3 me-3">
                                        <i class="bi bi-cash-coin fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('total_stock_value'); ?></h5>
                                        <p class="card-text fs-4 fw-bold" id="stockValue">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-primary text-white p-3 rounded-3 me-3">
                                        <i class="bi bi-boxes fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('total_inventory_units'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="totalProducts">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-info text-white p-3 rounded-3 me-3">
                                        <i class="bi bi-box-arrow-in-down fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('open_inbound_receipts'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="openInbounds">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-warning text-dark p-3 rounded-3 me-3">
                                        <i class="bi bi-hourglass-split fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('orders_pending_pick'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="pendingPick">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-warning text-dark p-3 rounded-3 me-3">
                                        <i class="bi bi-box-arrow-up-right fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('total_pending_orders'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="pendingOutbounds">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                         <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-success text-white p-3 rounded-3 me-3">
                                        <i class="bi bi-truck fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('orders_shipped_today'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="shippedToday">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-secondary text-white p-3 rounded-3 me-3">
                                        <i class="bi bi-check2-circle fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('receipts_completed_today'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="receivedToday">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-danger text-white p-3 rounded-3 me-3">
                                        <i class="bi bi-geo-alt-fill fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('active_locations'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="activeLocations">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card h-100 shadow-sm">
                                <div class="card-body d-flex align-items-center">
                                    <div class="bg-dark text-white p-3 rounded-3 me-3">
                                        <i class="bi bi-arrow-return-left fs-2"></i>
                                    </div>
                                    <div>
                                        <h5 class="card-title text-muted"><?php echo __('returns_today'); ?></h5>
                                        <p class="card-text fs-2 fw-bold" id="returnsToday">---</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="quickActionsSection" style="display: none;">
                        <h3 class="h5 mb-3"><?php echo __('quick_actions'); ?></h3>
                        <div class="row g-3">
                            <div class="col-sm-6 col-lg-3">
                                <a href="inbound.php" class="d-block card bg-primary text-white text-decoration-none shadow-sm hover-lift">
                                    <div class="card-body text-center py-4">
                                        <i class="bi bi-box-arrow-in-down fs-1 mb-2"></i>
                                        <p class="card-text fw-semibold"><?php echo __('receive_goods'); ?></p>
                                    </div>
                                </a>
                            </div>
                            <div class="col-sm-6 col-lg-3">
                                <a href="outbound.php" class="d-block card bg-success text-white text-decoration-none shadow-sm hover-lift">
                                    <div class="card-body text-center py-4">
                                        <i class="bi bi-box-arrow-up-right fs-1 mb-2"></i>
                                        <p class="card-text fw-semibold"><?php echo __('process_shipments'); ?></p>
                                    </div>
                                </a>
                            </div>
                            <div class="col-sm-6 col-lg-3">
                                <a href="inventory.php" class="d-block card bg-info text-white text-decoration-none shadow-sm hover-lift">
                                    <div class="card-body text-center py-4">
                                        <i class="bi bi-boxes fs-1 mb-2"></i>
                                        <p class="card-text fw-semibold"><?php echo __('view_inventory'); ?></p>
                                    </div>
                                </a>
                            </div>
                            <div class="col-sm-6 col-lg-3">
                                <a href="reports.php" class="d-block card bg-danger text-white text-decoration-none shadow-sm hover-lift">
                                    <div class="card-body text-center py-4">
                                        <i class="bi bi-file-earmark-bar-graph fs-1 mb-2"></i>
                                        <p class="card-text fw-semibold"><?php echo __('generate_reports'); ?></p>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="row g-4 mt-4">
                        <div class="col-lg-8">
                            <div class="card shadow-sm">
                                <div class="card-body">
                                    <h5 class="card-title"><?php echo __('last_30_days_activity'); ?></h5>
                                    <div style="height: 400px;">
                                        <canvas id="activityChart"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-lg-4">
                            <div class="card shadow-sm">
                                <div class="card-header">
                                    <h5 class="card-title mb-0"><i class="bi bi-graph-up-arrow me-2"></i><?php echo __('top_10_fast_moving'); ?></h5>
                                    <small class="text-muted">Based on units picked in the last 30 days.</small>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table class="table table-striped table-sm">
                                            <thead>
                                                <tr>
                                                    <th><?php echo __('sku'); ?></th>
                                                    <th><?php echo __('product_name'); ?></th>
                                                    <th class="text-end"><?php echo __('units_picked'); ?></th>
                                                </tr>
                                            </thead>
                                            <tbody id="fastMovingItemsTableBody">
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="js/api.js"></script>
    <script src="js/barcodeScanner.js"></script>
    <script src="js/main.js"></script>
    <script src="js/dashboard.js" defer></script>
</body>
</html>