<?php
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('inbound_operations'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/buttons/2.4.1/css/buttons.bootstrap5.min.css" rel="stylesheet">
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
        
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0"><?php echo __('inbound_operations'); ?></h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header header-primary">
                                <h5 class="card-title mb-0"><?php echo __('current_inbound_receipts'); ?></h5>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="d-flex align-items-center">
                                        <label for="statusFilter" class="form-label me-2 mb-0 small text-nowrap text-white"><?php echo __('status'); ?>:</label>
                                        <select id="statusFilter" class="form-select form-select-sm" style="width: auto;">
                                            <option value=""><?php echo __('all'); ?></option>
                                            <option value="<?php echo __('pending'); ?>"><?php echo __('pending'); ?></option>
                                            <option value="<?php echo __('received'); ?>"><?php echo __('received'); ?></option>
                                            <option value="<?php echo __('partially_received'); ?>"><?php echo __('partially_received'); ?></option>
                                            <option value="<?php echo __('partially_putaway'); ?>"><?php echo __('partially_putaway'); ?></option>
                                            <option value="<?php echo __('completed'); ?>"><?php echo __('completed'); ?></option>
                                            <option value="<?php echo __('cancelled'); ?>"><?php echo __('cancelled'); ?></option>
                                        </select>
                                    </div>
                                    <button id="showCreateReceiptBtn" class="btn btn-light btn-sm text-nowrap"><i class="bi bi-plus-circle me-1"></i> <?php echo __('create'); ?></button>
                                    <div class="card-header-actions">
                                        <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                        <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                        <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="inboundReceiptsTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Receipt ID</th>
                                                <th><?php echo __('receipt_no'); ?></th>
                                                <th><?php echo __('supplier'); ?></th>
                                                <th><?php echo __('arrival_date'); ?></th>
                                                <th><?php echo __('status'); ?></th>
                                                <th><?php echo __('actions'); ?></th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="processingSection" class="row g-4 mt-4 d-none">
                    <div class="col-lg-5">
                        <div class="card shadow-sm h-100">
                             <div class="card-header header-warning">
                                <h5 class="card-title mb-0"><?php echo __('receipt'); ?> <span id="selectedReceiptNumber" class="text-primary"></span></h5>
                                <div class="d-flex align-items-center gap-2">
                                    <button id="addContainerBtn" class="btn btn-light btn-sm"><i class="bi bi-plus-circle"></i> <?php echo __('add_container'); ?></button>
                                    <div class="card-header-actions">
                                        <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                        <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                        <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <h6 class="card-subtitle mb-2 text-muted"><?php echo __('containers'); ?></h6>
                                <div id="containerList" class="list-group" style="max-height: 450px; overflow-y: auto;">
                                    <div class="list-group-item">Select a receipt to see its containers.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-7">
                        <div id="itemProcessingCard" class="card shadow-sm">
                            <div class="card-header header-warning">
                                <h5 class="card-title mb-0"><?php echo __('process_items_for_container'); ?>: <span id="selectedContainerNumber" class="text-primary">None</span></h5>
                                <div class="card-header-actions">
                                    <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                    <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                    <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                </div>
                            </div>
                            <div class="card-body">
                                 <div id="itemActionsContainer" class="mb-3 d-none">
                                     <button id="showAddItemModalBtn" class="btn btn-primary"><i class="bi bi-plus-circle"></i> <?php echo __('add_single_item'); ?></button>
                                     <button id="showBulkImportModalBtn" class="btn btn-outline-success ms-2"><i class="bi bi-file-earmark-spreadsheet"></i> <?php echo __('bulk_add_items'); ?></button>
                                 </div>
                                 <div id="arrivalActionContainer" class="d-none mt-3">
                                    <div class="d-grid">
                                        <button id="markArrivedBtn" class="btn btn-success"><i class="bi bi-truck me-2"></i><?php echo __('mark_container_as_arrived'); ?></button>
                                    </div>
                                 </div>
                                 <hr id="itemActionsSeparator" class="d-none">
                                 <h6 id="itemsListHeader" class="card-subtitle mb-2 text-muted"><?php echo __('container_items'); ?></h6>
                                 
                                 <div id="verificationSearchContainer" class="mb-3 d-none">
                                    <label for="verificationSearchInput" class="form-label"><?php echo __('search_item_to_verify'); ?></label>
                                    <input type="text" id="verificationSearchInput" class="form-control" placeholder="<?php echo __('search_by_name_sku_article'); ?>">
                                 </div>

                                 <div id="containerItemsList" class="list-group mb-3" style="max-height: 350px; overflow-y: auto;">
                                     <div class="list-group-item">Select a container to see items.</div>
                                 </div>
                                 <div id="verificationActionContainer" class="d-none mt-3">
                                    <div class="d-grid">
                                        <button id="confirmVerificationBtn" class="btn btn-primary"><i class="bi bi-check-circle-fill me-2"></i><?php echo __('confirm_verification_and_receive'); ?></button>
                                    </div>
                                 </div>
                                 <div id="putawaySection" class="d-none">
                                     <hr>
                                     <h6 class="card-subtitle mb-2 text-muted"><?php echo __('putaway_items'); ?></h6>
                                     <p id="putawayInstructions" class="small text-muted"><?php echo __('select_an_item_from_the_list_to_put_it_away'); ?></p>
                                 </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/2.4.1/js/dataTables.buttons.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/2.4.1/js/buttons.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vanillajs-datepicker@1.3.4/dist/js/datepicker-full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/inbound.js" defer></script>
</body>
</html>
