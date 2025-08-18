<?php
/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English text for titles, headers, buttons, and table columns with the `__()` translation function.
* 2. Added the required script tag in the <head> to load translations with `JSON_UNESCAPED_UNICODE`.
* 3. The entire page is now fully localizable.
*/
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('warehouse_management'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
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
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0"><?php echo __('warehouse_management'); ?></h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

        <main class="flex-grow-1 p-4 p-md-5 bg-light">
            <div class="container-fluid">
                <div class="card shadow-sm">
                    <div class="card-header header-primary d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0"><?php echo __('all_warehouses'); ?></h5>
                        <div class="d-flex align-items-center gap-2">
                            <button id="addWarehouseBtn" class="btn btn-light btn-sm"><i class="bi bi-plus-circle me-1"></i> <?php echo __('add_new_warehouse'); ?></button>
                            <div class="card-header-actions">
                                <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table id="warehousesTable" class="table table-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th><?php echo __('name'); ?></th>
                                        <th><?php echo __('city'); ?></th>
                                        <th><?php echo __('country'); ?></th>
                                        <th><?php echo __('active'); ?></th>
                                        <th class="text-end"><?php echo __('actions'); ?></th>
                                    </tr>
                                </thead>
                                <tbody>
                                </tbody>
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
    <script src="js/main.js"></script>
    <script src="js/warehouses.js" defer></script>
</body>
</html>
