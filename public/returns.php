<?php
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('returns_management'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
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
                <div class="d-flex justify-content-between align-items-center py-3">
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark"><?php echo __('returns_management'); ?></h1>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header header-primary">
                                <h5 class="card-title mb-0"><?php echo __('rmas'); ?></h5>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="card-header-actions">
                                        <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                        <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                        <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="returnsTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th><?php echo __('return_no'); ?></th>
                                                <th><?php echo __('original_order_no'); ?></th>
                                                <th><?php echo __('customer'); ?></th>
                                                <th><?php echo __('reason'); ?></th>
                                                <th><?php echo __('status'); ?></th>
                                                <th><?php echo __('created_at'); ?></th>
                                                <th><?php echo __('actions'); ?></th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-12">
                        <div id="returnProcessingArea" class="card shadow-sm d-none">
                            <div class="card-header header-warning d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><?php echo __('process_return'); ?>: <span id="selectedReturnNumber" class="text-primary"></span></h5>
                                <input type="hidden" id="currentReturnId">
                            </div>
                            <div class="card-body">
                                <h6 class="card-subtitle mb-2 text-muted"><?php echo __('items_to_inspect'); ?></h6>
                                <div class="table-responsive">
                                    <table class="table table-bordered">
                                        <thead class="table-light">
                                            <tr>
                                                <th><?php echo __('sku'); ?></th>
                                                <th><?php echo __('product'); ?></th>
                                                <th><?php echo __('article_no'); ?></th>
                                                <th><?php echo __('expected_dot'); ?></th>
                                                <th><?php echo __('received_dot'); ?></th>
                                                <th><?php echo __('expected_qty'); ?></th>
                                                <th><?php echo __('processed_qty'); ?></th>
                                                <th><?php echo __('condition'); ?></th>
                                                <th><?php echo __('putaway_location'); ?></th>
                                                <th><?php echo __('actions'); ?></th>
                                            </tr>
                                        </thead>
                                        <tbody id="returnItemsTableBody"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <iframe id="print-frame-returns" style="display:none;"></iframe>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/returns.js" defer></script>
</body>
</html>
