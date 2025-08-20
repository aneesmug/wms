<?php
/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English text for labels, titles, and buttons with the `__()` translation function.
* 2. Ensured the script tag for loading translations includes `JSON_UNESCAPED_UNICODE` for proper Arabic character support.
* 3. All user-facing elements on this page are now fully localizable.
*/
require_once __DIR__ . '/helpers/auth_helper.php';
$pageTitle = $pageTitle ?? __('internal_inventory_transfer');
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('internal_inventory_transfer'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
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
                <div class="row justify-content-center">
                    <div class="col-lg-8 col-md-10">
                        <div class="card shadow-sm">
                            <div class="card-header header-primary">
                                <h5 class="card-title mb-0"><?php echo __('create_transfer'); ?></h5>
                                <div class="card-header-actions">
                                    <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                    <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                    <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
                                </div>
                            </div>
                            <div class="card-body">
                                <form id="transferForm">
                                    <div class="row g-3">
                                        <div class="col-md-6">
                                            <label for="fromLocationSelect" class="form-label"><?php echo __('from_location'); ?> <span class="text-danger">*</span></label>
                                            <select id="fromLocationSelect" class="form-select" required></select>
                                        </div>

                                        <div class="col-md-6">
                                            <label for="productSelect" class="form-label"><?php echo __('product'); ?> <span class="text-danger">*</span></label>
                                            <select id="productSelect" class="form-select" required disabled></select>
                                        </div>

                                        <div class="col-md-6">
                                            <label for="availableQtyInput" class="form-label"><?php echo __('available_at_location'); ?></label>
                                            <input type="text" id="availableQtyInput" class="form-control" readonly placeholder="<?php echo __('select_a_product'); ?>">
                                        </div>

                                        <div class="col-md-6">
                                            <label for="quantityInput" class="form-label"><?php echo __('quantity_to_transfer'); ?> <span class="text-danger">*</span></label>
                                            <input type="number" id="quantityInput" class="form-control" min="1" required disabled>
                                            <div id="quantity-error-message" class="text-danger small mt-1"></div>
                                        </div>

                                        <div class="col-12">
                                            <label for="toLocationSelect" class="form-label"><?php echo __('to_location'); ?> <span class="text-danger">*</span></label>
                                            <select id="toLocationSelect" class="form-select" required disabled></select>
                                        </div>
                                    </div>

                                    <div class="mt-4 text-end">
                                        <button type="button" id="clearFormBtn" class="btn btn-secondary"><?php echo __('clear'); ?></button>
                                        <button type="submit" id="submitTransferBtn" class="btn btn-primary" disabled><?php echo __('submit_transfer'); ?></button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/inventory_transfer.js" defer></script>
</body>
</html>
