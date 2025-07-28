<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - Returns Management</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <div id="content">
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <h1 class="h4 mb-0 text-dark">Returns Management</h1>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <!-- Returns List -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Return Merchandise Authorizations (RMAs)</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="returnsTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Return #</th>
                                                <th>Original Order #</th>
                                                <th>Customer</th>
                                                <th>Reason</th>
                                                <th>Status</th>
                                                <th>Created At</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Return Processing Area -->
                    <div class="col-12">
                        <div id="returnProcessingArea" class="card shadow-sm d-none">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Process Return: <span id="selectedReturnNumber" class="text-primary"></span></h5>
                                <input type="hidden" id="currentReturnId">
                            </div>
                            <div class="card-body">
                                <h6 class="card-subtitle mb-2 text-muted">Items to Inspect</h6>
                                <div class="table-responsive">
                                    <table class="table table-bordered">
                                        <thead class="table-light">
                                            <tr>
                                                <th>SKU</th>
                                                <th>Product</th>
                                                <th>Barcode</th>
                                                <th>Expected</th>
                                                <th>Processed</th>
                                                <th>Condition</th>
                                                <th>Putaway Location</th>
                                                <th>Actions</th>
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
    
    <!-- MODIFICATION: Hidden iframe for printing -->
    <iframe id="print-frame-returns" style="display:none;"></iframe>

    <!-- JavaScript Libraries -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    
    <!-- Custom Application Scripts -->
    <script src="js/main.js"></script>
    <script src="js/returns.js" defer></script>
</body>
</html>
