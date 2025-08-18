<?php
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - <?php echo __('customer_details'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
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
                    <a href="customers.php" class="btn btn-outline-secondary me-3"><i class="bi bi-arrow-left"></i> <?php echo __('back_to_customers'); ?></a>
                    <h1 id="customerNameHeader" class="h4 mb-0 text-dark mx-auto"><?php echo __('customer_details'); ?></h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

        <main class="flex-grow-1 p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <div class="col-lg-4">
                        <div class="card shadow-sm h-100">
                            <div class="card-header header-primary d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><i class="bi bi-person-badge me-2"></i><?php echo __('customer_information'); ?></h5>
                                <div class="d-flex align-items-center gap-2">
                                    <button id="editCustomerBtn" class="btn btn-outline-light btn-sm"><i class="bi bi-pencil"></i> <?php echo __('edit'); ?></button>
                                    <div class="card-header-actions">
                                        <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                        <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                        <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body" id="customerInfoCard">
                                <div class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-8">
                        <div class="card shadow-sm h-100">
                            <div class="card-header header-primary d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><i class="bi bi-receipt me-2"></i><?php echo __('order_return_history'); ?></h5>
                                <div class="d-flex align-items-center gap-2">
                                    <button id="createReturnBtn" class="btn btn-warning btn-sm"><i class="bi bi-box-arrow-left me-1"></i> <?php echo __('create_return'); ?></button>
                                    <div class="card-header-actions">
                                        <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                        <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                        <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="ordersTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th><?php echo __('number'); ?></th>
                                                <th><?php echo __('type'); ?></th>
                                                <th><?php echo __('status'); ?></th>
                                                <th><?php echo __('date'); ?></th>
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

                <div class="row g-4 mt-1">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header header-warning d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><i class="bi bi-cash-coin me-2"></i><?php echo __('financial_transactions'); ?></h5>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="card-header-actions">
                                        <button type="button" class="btn-card-header" data-action="refresh" title="Refresh"><i class="bi bi-arrow-counterclockwise"></i></button>
                                        <button type="button" class="btn-card-header" data-action="maximize" title="Maximize"><i class="bi bi-arrows-fullscreen"></i></button>
                                        <button type="button" class="btn-card-header" data-action="close" title="Close"><i class="bi bi-x-lg"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-lg-8">
                                        <h6><?php echo __('transaction_history'); ?></h6>
                                        <div class="table-responsive">
                                            <table class="table table-sm table-striped">
                                                <thead>
                                                    <tr>
                                                        <th><?php echo __('date'); ?></th>
                                                        <th><?php echo __('type'); ?></th>
                                                        <th><?php echo __('amount'); ?></th>
                                                        <th><?php echo __('order_ref'); ?></th>
                                                        <th><?php echo __('notes'); ?></th>
                                                        <th><?php echo __('created_by'); ?></th>
                                                    </tr>
                                                </thead>
                                                <tbody id="transactionsTableBody"></tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="col-lg-4 border-start" id="addTransactionSection">
                                        <h6><?php echo __('add_new_transaction'); ?></h6>
                                        <form id="transactionForm">
                                            <div class="mb-3">
                                                <label for="transactionType" class="form-label"><?php echo __('type'); ?></label>
                                                <select id="transactionType" class="form-select" required>
                                                    <option value="payment">Payment</option>
                                                    <option value="refund">Refund</option>
                                                    <option value="credit">Credit</option>
                                                    <option value="debit">Debit</option>
                                                </select>
                                            </div>
                                            <div class="mb-3">
                                                <label for="transactionAmount" class="form-label"><?php echo __('amount'); ?></label>
                                                <input type="number" id="transactionAmount" class="form-control" step="0.01" min="0" required>
                                            </div>
                                            <div class="mb-3">
                                                <label for="transactionOrder" class="form-label"><?php echo __('related_order_optional'); ?></label>
                                                <select id="transactionOrder" class="form-select">
                                                    <option value="">None</option>
                                                </select>
                                            </div>
                                            <div class="mb-3">
                                                <label for="transactionNotes" class="form-label"><?php echo __('notes'); ?></label>
                                                <textarea id="transactionNotes" class="form-control" rows="3"></textarea>
                                            </div>
                                            <div class="d-grid">
                                                <button type="submit" id="saveTransactionBtn" class="btn btn-success"><?php echo __('save_transaction'); ?></button>
                                            </div>
                                        </form>
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
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/customer_details.js" defer></script>
</body>
</html>
