<?php
// No direct changes were needed in this file as the logic is handled by the associated JavaScript and backend APIs.
// However, as requested, here is the final version of the file.
?>
<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - Outbound Orders</title>
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
                    <h1 class="h4 mb-0 text-dark">Outbound Orders</h1>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <!-- Orders List -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0">All Orders</h5>
                                <div class="d-flex align-items-center">
                                    <select id="statusFilter" class="form-select form-select-sm me-2" style="width: auto;">
                                        <option value="">All Statuses</option>
                                        <option value="New">New</option>
                                        <option value="Pending Pick">Pending Pick</option>
                                        <option value="Partially Picked">Partially Picked</option>
                                        <option value="Picked">Picked</option>
                                        <option value="Ready for Pickup">Ready for Pickup</option>
                                        <option value="Assigned">Assigned</option>
                                        <option value="Shipped">Shipped</option>
                                        <option value="Out for Delivery">Out for Delivery</option>
                                        <option value="Delivered">Delivered</option>
                                        <option value="Partially Returned">Partially Returned</option>
                                        <option value="Returned">Returned</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                    <button id="showCreateOrderModalBtn" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> New Order</button>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="outboundOrdersTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Order #</th>
                                                <th>Reference #</th>
                                                <th>Customer</th>
                                                <th>Staged At</th>
                                                <th>Tracking #</th>
                                                <th>Ship By</th>
                                                <th>Status</th>
                                                <th class="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Order Processing Area -->
                    <div class="col-12">
                        <div id="orderProcessingArea" class="card shadow-sm d-none">
                            <div class="card-header">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h5 class="card-title mb-0">Order Details: <span id="selectedOrderNumberDisplay" class="text-primary"></span></h5>
                                    <div>
                                        <button id="editOrderBtn" class="btn btn-sm btn-outline-secondary d-none"><i class="bi bi-pencil"></i> Edit Order</button>
                                        <button id="printPickReportBtn" class="btn btn-sm btn-outline-info ms-2 d-none"><i class="bi bi-file-earmark-text me-1"></i> Print Pick Report</button>
                                    </div>
                                </div>
                                <input type="hidden" id="currentOrderId">
                            </div>
                            <div class="card-body">
                                <div class="row mb-3">
                                    <div class="col-md-4" id="shippingAreaDisplay"></div>
                                    <div class="col-md-4" id="trackingNumberDisplay"></div>
                                    <div class="col-md-4" id="proofOfDeliveryDisplay"></div>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-bordered">
                                        <thead class="table-light">
                                            <tr>
                                                <th>SKU</th>
                                                <th>Product</th>
                                                <th>Article No</th>
                                                <th>Ordered</th>
                                                <th>Picked</th>
                                                <th>Batch</th>
                                                <th>DOT</th>
                                                <th>Location</th>
                                                <th class="text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="orderItemsTableBody"></tbody>
                                    </table>
                                </div>
                                <div id="addItemContainer" class="mt-3"></div>
                            </div>
                            <div class="card-footer text-end" id="managementActionsArea" style="display: none;">
                                <button id="cancelOrderBtn" class="btn btn-outline-danger me-2">Cancel Order</button>
                                <button id="shipOrderBtn" class="btn btn-success d-none">Ship Order</button>
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
