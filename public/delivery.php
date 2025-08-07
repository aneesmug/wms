<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Deliveries</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .order-card, #deliveredOrdersTable tbody tr { cursor: pointer; }
        .order-card:hover { background-color: #f8f9fa; }
        #scanner-video { max-width: 100%; border-radius: 0.5rem; }
    </style>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <div id="content">
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <h1 class="h4 py-3 mb-0 text-dark">My Deliveries</h1>
            </div>
        </header>

        <main class="container-fluid p-4">
            <div class="row g-4">
                <!-- Orders Column with Tabs -->
                <div class="col-lg-5 col-xl-4">
                    <div class="card">
                        <div class="card-header p-0 border-bottom">
                            <ul class="nav nav-tabs nav-fill" id="deliveryTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="active-tab" data-bs-toggle="tab" data-bs-target="#active-orders" type="button" role="tab" aria-controls="active-orders" aria-selected="true">Active</button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="history-tab" data-bs-toggle="tab" data-bs-target="#history-orders" type="button" role="tab" aria-controls="history-orders" aria-selected="false">History</button>
                                </li>
                            </ul>
                        </div>
                        <div class="card-body p-0">
                            <div class="tab-content" id="deliveryTabsContent">
                                <div class="tab-pane fade show active" id="active-orders" role="tabpanel" aria-labelledby="active-tab">
                                    <div id="assignedOrdersList" class="list-group list-group-flush" style="max-height: 70vh; overflow-y: auto;">
                                        <div class="p-4 text-center text-muted">Loading active orders...</div>
                                    </div>
                                </div>
                                <div class="tab-pane fade p-2" id="history-orders" role="tabpanel" aria-labelledby="history-tab">
                                    <div class="table-responsive">
                                        <table id="deliveredOrdersTable" class="table table-striped table-hover" style="width:100%">
                                            <thead>
                                                <tr>
                                                    <th>Order #</th>
                                                    <th>Customer</th>
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
                </div>

                <!-- Order Details & Scanning Column -->
                <div class="col-lg-7 col-xl-8">
                    <div id="orderDetailsArea" class="d-none">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="card-title mb-0">Order Details: <span id="orderNumberDisplay" class="text-primary"></span></h5>
                                <span id="orderStatusBadge" class="badge"></span>
                            </div>
                            <div class="card-body">
                                <input type="hidden" id="currentOrderId">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>Customer Information</h6>
                                        <p class="mb-1"><strong>Name:</strong> <span id="customerName"></span></p>
                                        <p class="mb-1"><strong>Address:</strong> <span id="customerAddress"></span></p>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Order Summary</h6>
                                        <p class="mb-1"><strong>Total Items:</strong> <span id="totalItems"></span></p>
                                        <p class="mb-1"><strong>Items Scanned:</strong> <span id="scannedItems"></span></p>
                                        <div id="deliveryProofSection" class="d-none mt-2">
                                             <p class="mb-1"><strong>Delivered To:</strong> <span id="deliveredToName"></span></p>
                                             <p class="mb-1"><strong>Receiver Phone:</strong> <span id="receiverPhone"></span></p>
                                             <p class="mb-1"><a href="#" id="deliveryPhotoLink" target="_blank" class="btn btn-sm btn-outline-info"><i class="bi bi-camera"></i> View Proof</a></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="card-footer text-end" id="actionButtons">
                                <!-- Action buttons will be dynamically inserted here -->
                            </div>
                        </div>
                    </div>

                    <!-- MODIFICATION: New Scan Area -->
                    <div id="scanArea" class="card mt-4 d-none">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0">Scan Items for Pickup</h5>
                            <button id="cancelScanBtn" class="btn btn-sm btn-outline-secondary">Cancel Scan</button>
                        </div>
                        <div class="card-body">
                            <div class="row g-4">
                                <div class="col-md-6">
                                    <h6>Items to Scan</h6>
                                    <ul id="scanItemList" class="list-group"></ul>
                                </div>
                                <div class="col-md-6">
                                    <h6>Scanner</h6>
                                    <video id="scanner-video"></video>
                                    <input type="text" id="manualScanInput" class="form-control mt-2" placeholder="Or enter sticker code manually...">
                                    <div id="scanFeedback" class="mt-2"></div>
                                </div>
                            </div>
                            <hr>
                            <h6>Scan History</h6>
                            <div class="table-responsive" style="max-height: 250px;">
                                <table class="table table-sm table-striped">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Product</th>
                                            <th>Sticker</th>
                                        </tr>
                                    </thead>
                                    <tbody id="scanHistoryTableBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div id="noOrderSelected" class="text-center p-5 bg-white rounded shadow-sm">
                        <i class="bi bi-box-seam" style="font-size: 4rem;"></i>
                        <h5 class="mt-3">Select an order to view details.</h5>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script type="text/javascript" src="https://unpkg.com/@zxing/library@latest/umd/index.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/notifications.js"></script>
    <script src="js/delivery.js"></script>
</body>
</html>