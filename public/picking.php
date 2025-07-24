<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Order Picking & Processing</title>
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
                    <h1 class="h4 mb-0 text-dark">Order Picking & Processing</h1>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Orders for Picking / Processing</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="pickingOrdersTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Order No.</th>
                                                <th>Reference No.</th>
                                                <th>Customer</th>
                                                <th>Req. Ship Date</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="pickingOrdersTableBody"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-12">
                        <div id="pickingProcessArea" class="card shadow-sm d-none">
                            <div class="card-header d-flex justify-content-between align-items-center flex-wrap">
                                <div>
                                    <h5 class="card-title mb-0">Process Order: <span id="selectedOrderNumberDisplay" class="text-primary fw-normal"></span></h5>
                                    <div id="shippingAreaDisplay" class="mt-1 text-muted small"></div>
                                    <div id="driverInfoDisplay" class="mt-1 text-muted small"></div>
                                    <input type="hidden" id="currentOrderId">
                                </div>
                                <div class="btn-group">
                                    <button id="printPickReportBtn" class="btn btn-sm btn-outline-secondary d-none">
                                        <i class="bi bi-file-earmark-text me-1"></i> Print Pick Report
                                    </button>
                                    <button id="printStickersBtn" class="btn btn-sm btn-outline-secondary d-none">
                                        <i class="bi bi-printer me-1"></i> Print Item Stickers
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                <h6 class="card-subtitle mb-2 text-muted">Order Items</h6>
                                <div class="table-responsive mb-3">
                                    <table class="table table-bordered">
                                        <thead class="table-light">
                                            <tr>
                                                <th>SKU</th>
                                                <th>Product</th>
                                                <th>Ordered</th>
                                                <th>Picked</th>
                                                <th>Batch</th>
                                                <th>DOT</th>
                                                <th>Location</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="orderItemsTableBody"></tbody>
                                    </table>
                                </div>

                                <div id="actionsContainer" class="p-3 bg-light rounded border">
                                    <div id="pickActionsArea" class="d-none">
                                        <h6 class="mb-3">Pick Items</h6>
                                        <div class="row g-3">
                                            <div class="col-md-6">
                                                <label for="pickItemNumberInput" class="form-label">Item Barcode/SKU</label>
                                                <input type="text" id="pickItemNumberInput" class="form-control" placeholder="Scan or enter...">
                                            </div>
                                            <div class="col-md-6">
                                                <label for="pickLocationSelect" class="form-label">Pick Location</label>
                                                <select id="pickLocationSelect" class="form-select"></select>
                                            </div>
                                            <div class="col-md-4">
                                                <label for="pickBatchNumberSelect" class="form-label">Batch Number</label>
                                                <select id="pickBatchNumberSelect" class="form-select" disabled><option value="">Select location first</option></select>
                                            </div>
                                            <div class="col-md-4">
                                                <label for="pickDotCodeSelect" class="form-label">DOT Code (FIFO)</label>
                                                <select id="pickDotCodeSelect" class="form-select" disabled><option value="">Select batch first</option></select>
                                            </div>
                                            <div class="col-md-4">
                                                <label for="pickQuantityInput" class="form-label">Quantity to Pick</label>
                                                <input type="number" id="pickQuantityInput" value="1" min="1" class="form-control">
                                                <div id="pickQuantityError" class="text-danger small mt-1"></div>
                                            </div>
                                        </div>
                                        <div class="mt-3">
                                            <button id="pickItemBtn" class="btn btn-info text-white">Pick Item</button>
                                        </div>
                                    </div>
                                    <div id="managementActionsArea" class="mt-4 pt-4 border-top d-none">
                                        <h6 class="mb-3">Management Actions</h6>
                                        <div class="d-flex gap-2 flex-wrap">
                                            <button id="stageOrderBtn" class="btn btn-warning d-none">Stage for Pickup</button>
                                            <button id="assignDriverBtn" class="btn btn-primary d-none"><i class="bi bi-person-plus-fill me-1"></i> Assign Driver</button>
                                        </div>
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
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    
    <!-- Custom Application Scripts -->
    <script src="js/main.js"></script>
    <script src="js/picking.js" defer></script>
</body>
</html>
