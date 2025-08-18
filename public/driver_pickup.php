<?php
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('verify_order_pickup'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
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
                <div class="d-flex align-items-center py-3">
                    <a href="delivery.php" class="btn btn-outline-secondary me-3"><i class="bi bi-arrow-left"></i></a>
                    <h1 class="h4 mb-0 text-dark"><?php echo __('verify_pickup_for'); ?> <span id="orderNumberDisplay" class="text-primary"></span></h1>
                </div>
            </div>
        </header>

        <main class="p-4">
            <div class="container-fluid">
                <div class="row g-4">
                    <div class="col-lg-6">
                        <div class="card shadow-sm">
                            <div class="card-header">
                                <h5 class="card-title mb-0"><?php echo __('items_to_pick'); ?></h5>
                            </div>
                            <div class="card-body">
                                <ul id="itemList" class="list-group">
                                </ul>
                            </div>
                        </div>

                        <div class="card shadow-sm mt-4">
                            <div class="card-header bg-light">
                                <h5 class="card-title mb-0"><i class="bi bi-check-all"></i> <?php echo __('recently_scanned_items'); ?></h5>
                            </div>
                            <div class="card-body p-0">
                                <ul id="scannedItemList" class="list-group list-group-flush">
                                    <li class="list-group-item text-muted"><?php echo __('no_items_scanned_yet'); ?></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card shadow-sm">
                            <div class="card-header">
                                <h5 class="card-title mb-0"><?php echo __('scan_item_barcode'); ?></h5>
                            </div>
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <video id="video" class="w-100 rounded border bg-dark"></video>
                                </div>
                                <div class="mb-3 d-flex justify-content-between">
                                    <div class="flex-grow-1 me-2">
                                        <label for="sourceSelect" class="form-label"><?php echo __('select_camera'); ?></label>
                                        <select id="sourceSelect" class="form-select"></select>
                                    </div>
                                    <div>
                                        <label class="form-label">&nbsp;</label>
                                        <button id="torchButton" class="btn btn-outline-secondary w-100" style="display: none;"><i class="bi bi-flashlight"></i></button>
                                    </div>
                                </div>
                                <input type="text" id="barcodeInput" class="form-control mt-3" placeholder="<?php echo __('or_enter_barcode_manually'); ?>">
                                <div id="scanFeedback" class="mt-2"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script type="text/javascript" src="https://unpkg.com/@zxing/library@latest/umd/index.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/driver_pickup.js"></script>
</body>
</html>
