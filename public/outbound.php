<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Outbound Operations</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <!-- Custom Style for new statuses -->
    <style>
        .bg-purple {
            color: #fff;
            background-color: #6f42c1; /* Bootstrap's purple */
        }
        .bg-orange {
            color: #000;
            background-color: #fd7e14; /* Bootstrap's orange */
        }
    </style>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <div id="content">
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <h1 class="h4 mb-0 text-dark">Outbound Operations</h1>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header d-flex justify-content-between align-items-center flex-wrap">
                                <h5 class="card-title mb-0">Current Outbound Orders</h5>
                                <div class="d-flex align-items-center gap-3">
                                    <div class="d-flex align-items-center">
                                        <label for="statusFilter" class="form-label me-2 mb-0">Status:</label>
                                        <select id="statusFilter" class="form-select form-select-sm" style="width: auto;">
                                            <option value="">All</option>
                                            <option value="New">New</option>
                                            <option value="Pending Pick">Pending Pick</option>
                                            <option value="Partially Picked">Partially Picked</option>
                                            <option value="Picked">Picked</option>
                                            <option value="Ready for Pickup">Ready for Pickup</option>
                                            <option value="Assigned">Assigned</option>
                                            <option value="Shipped">Shipped</option>
                                            <option value="Out for Delivery">Out for Delivery</option>
                                            <option value="Delivered">Delivered</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <button id="showCreateOrderModalBtn" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Create New Order</button>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="outboundOrdersTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Order No.</th>
                                                <th>Reference No.</th>
                                                <th>Customer</th>
                                                <th>Shipping Area</th>
                                                <th>Tracking #</th>
                                                <th>Req. Ship Date</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="outboundOrdersTableBody"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-12">
                        <div id="orderProcessingArea" class="card shadow-sm d-none">
                            <div class="card-header d-flex justify-content-between align-items-center flex-wrap">
                                <div>
                                    <h5 class="card-title mb-0">Process Order: <span id="selectedOrderNumberDisplay" class="text-primary fw-normal"></span></h5>
                                    <div id="shippingAreaDisplay" class="mt-1 text-muted small"></div>
                                    <div id="trackingNumberDisplay" class="mt-1 text-muted small"></div>
                                    <!-- MODIFICATION: Added container for Proof of Delivery -->
                                    <div id="proofOfDeliveryDisplay" class="mt-1 text-muted small"></div>
                                    <input type="hidden" id="currentOrderId">
                                </div>
                                <div class="btn-group">
                                    <button id="printPickReportBtn" class="btn btn-sm btn-outline-secondary d-none">
                                        <i class="bi bi-file-earmark-text me-1"></i> Print Pick Report
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
                                                <th>Barcode</th>
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

                                <div id="addItemContainer" class="mb-4"></div>

                                <div id="actionsContainer" class="p-3 bg-light rounded border">
                                    <div id="managementActionsArea" class="mt-4 pt-4 border-top">
                                        <h6 class="mb-3">Management Actions</h6>
                                        <div class="d-flex gap-2 flex-wrap">
                                            <button id="shipOrderBtn" class="btn btn-success d-none">Manually Ship</button>
                                            <button id="cancelOrderBtn" class="btn btn-danger">Cancel Order</button>
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
    <script src="js/outbound.js" defer></script>
</body>
</html>
