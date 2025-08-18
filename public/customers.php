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
    <title>WMS - <?php echo __('customer_management'); ?></title>
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
        
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0"><?php echo __('customer_management'); ?></h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="row g-4">
                        <div class="col-12">
                            <div class="card shadow-sm h-100">
                                <div class="card-header header-primary d-flex justify-content-between align-items-center">
                                    <h5 class="card-title mb-0"><?php echo __('customer_list'); ?></h5>
                                    <div class="d-flex align-items-center gap-2">
                                        <button id="addCustomerBtn" class="btn btn-light btn-sm"><i class="bi bi-plus-circle me-1"></i> <?php echo __('add_new_customer'); ?></button>
                                        <div class="card-header-actions">
                                            <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                            <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                            <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
                                        </div>
                                    </div>
                                </div>
                                <div class="card-body">
                                    <div class="table-responsive">
                                        <table id="customersTable" class="table table-hover" style="width:100%">
                                            <thead>
                                                <tr>
                                                    <th><?php echo __('customer_code'); ?></th>
                                                    <th><?php echo __('customer_name'); ?></th>
                                                    <th><?php echo __('contact'); ?></th>
                                                    <th><?php echo __('phone'); ?></th>
                                                    <th><?php echo __('total_orders'); ?></th>
                                                    <th class="text-end"><?php echo __('actions'); ?></th>
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
            </main>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/customers.js" defer></script>
</body>
</html>
