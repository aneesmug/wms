<?php
/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English text for labels, titles, and placeholders with the `__()` translation function.
* 2. Ensured the script tag for loading translations includes `JSON_UNESCAPED_UNICODE` for proper Arabic character support.
* 3. All user-facing elements on this page are now fully localizable.
*/
require_once __DIR__ . '/helpers/auth_helper.php';
$pageTitle = $pageTitle ?? __('inventory_control');
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('wms_inventory_control'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/buttons/2.4.1/css/buttons.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
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
        
        <?php require_once __DIR__ . '/includes/header.php'; ?>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="card shadow-sm mb-4">
                        <div class="card-header header-primary">
                            <h5 class="card-title mb-0"><?php echo __('search_inventory'); ?></h5>
                            <div class="card-header-actions">
                                <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-4">
                                    <label for="searchProductInput" class="form-label"><?php echo __('product_article_sku'); ?></label>
                                    <input type="text" id="searchProductInput" name="searchProductInput" placeholder="<?php echo __('scan_or_type_product'); ?>" class="form-control">
                                </div>
                                <div class="col-md-3">
                                    <label for="searchLocationSelect" class="form-label"><?php echo __('location_filter'); ?></label>
                                    <select id="searchLocationSelect" name="searchLocationSelect" class="form-select"></select>
                                </div>
                                <div class="col-md-3">
                                    <label for="searchTireTypeSelect" class="form-label"><?php echo __('tire_type_filter'); ?></label>
                                    <select id="searchTireTypeSelect" name="searchTireTypeSelect" class="form-select"></select>
                                </div>
                                <div class="col-md-2 d-flex gap-2">
                                    <button id="searchBtn" class="btn btn-primary w-100"><?php echo __('search'); ?></button>
                                    <button id="clearSearchBtn" type="button" class="btn btn-secondary w-100"><?php echo __('clear'); ?></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card shadow-sm mb-4">
                        <div class="card-header header-primary">
                            <h5 class="card-title mb-0"><?php echo __('current_stock'); ?></h5>
                            <div class="card-header-actions">
                                <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table id="inventoryTable" class="table table-hover" style="width:100%">
                                    <thead>
                                        <tr>
                                            <th><?php echo __('sku'); ?></th>
                                            <th><?php echo __('product_name'); ?></th>
                                            <th><?php echo __('article_no'); ?></th>
                                            <th><?php echo __('location'); ?></th>
                                            <th><?php echo __('quantity'); ?></th>
                                            <th><?php echo __('batch_dot_expiry'); ?></th>
                                            <th><?php echo __('last_moved'); ?></th>
                                            <th><?php echo __('actions'); ?></th>
                                        </tr>
                                    </thead>
                                    <tbody id="inventoryTableBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/inventory.js" defer></script>
</body>
</html>
