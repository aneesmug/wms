<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - Customer Details</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <!-- Main Content -->
    <div id="content">
        
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <a href="customers.php" class="btn btn-outline-secondary me-3"><i class="bi bi-arrow-left"></i> Back to Customers</a>
                    <h1 id="customerNameHeader" class="h4 mb-0 text-dark mx-auto">Customer Details</h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

        <main class="flex-grow-1 p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <!-- Customer Information -->
                    <div class="col-lg-4">
                        <div class="card shadow-sm h-100">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0"><i class="bi bi-person-badge me-2"></i>Customer Information</h5>
                                <button id="editCustomerBtn" class="btn btn-outline-primary btn-sm"><i class="bi bi-pencil"></i> Edit</button>
                            </div>
                            <div class="card-body" id="customerInfoCard">
                                <div class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>
                            </div>
                        </div>
                    </div>

                    <!-- Orders and Returns -->
                    <div class="col-lg-8">
                        <div class="card shadow-sm h-100">
                            <div class="card-header">
                                <h5 class="card-title mb-0"><i class="bi bi-receipt me-2"></i>Order & Return History</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="ordersTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Number</th>
                                                <th>Type</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Customer Transactions -->
                <div class="row g-4 mt-1">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header">
                                <h5 class="card-title mb-0"><i class="bi bi-cash-coin me-2"></i>Financial Transactions</h5>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-lg-8">
                                        <h6>Transaction History</h6>
                                        <div class="table-responsive">
                                            <table class="table table-sm table-striped">
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Type</th>
                                                        <th>Amount</th>
                                                        <th>Order Ref</th>
                                                        <th>Notes</th>
                                                        <th>Created By</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="transactionsTableBody"></tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="col-lg-4 border-start" id="addTransactionSection">
                                        <h6>Add New Transaction</h6>
                                        <form id="transactionForm">
                                            <div class="mb-3">
                                                <label for="transactionType" class="form-label">Type</label>
                                                <select id="transactionType" class="form-select" required>
                                                    <option value="payment">Payment</option>
                                                    <option value="refund">Refund</option>
                                                    <option value="credit">Credit</option>
                                                    <option value="debit">Debit</option>
                                                </select>
                                            </div>
                                            <div class="mb-3">
                                                <label for="transactionAmount" class="form-label">Amount</label>
                                                <input type="number" id="transactionAmount" class="form-control" step="0.01" min="0" required>
                                            </div>
                                            <div class="mb-3">
                                                <label for="transactionOrder" class="form-label">Related Order (Optional)</label>
                                                <select id="transactionOrder" class="form-select">
                                                    <option value="">None</option>
                                                </select>
                                            </div>
                                            <div class="mb-3">
                                                <label for="transactionNotes" class="form-label">Notes</label>
                                                <textarea id="transactionNotes" class="form-control" rows="3"></textarea>
                                            </div>
                                            <div class="d-grid">
                                                <button type="submit" id="saveTransactionBtn" class="btn btn-success">Save Transaction</button>
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

    <!-- JavaScript Libraries -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <!-- Custom Scripts -->
    <script src="js/main.js"></script>
    <script src="js/customer_details.js" defer></script>
</body>
</html>
