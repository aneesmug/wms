<!-- 
/********************************************************************
* MODIFICATION SUMMARY:
* - Added a new "Change Driver" button to the staging actions area.
* - This button will be controlled by picking.js to appear when a driver has already been assigned to an order,
* allowing users to re-assign a different driver if needed.
* - Updated the search input placeholder to include "Customer Name/Code".
********************************************************************/
-->
<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Order Picking & Processing</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .order-card {
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            border-width: 1px;
        }
        .order-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-color: var(--bs-primary);
        }
        .order-card.selected {
            border-color: var(--bs-primary);
            border-width: 2px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .card-body-hover {
            min-height: 140px;
        }
    </style>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <div id="content" class="d-flex flex-column">
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex align-items-center justify-content-between py-3">
                    <!-- This button toggles the offcanvas menu on mobile -->
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark">Order Picking & Processing</h1>
                    <div id="managementActionsArea" class="d-none">
                        <button id="printPickReportBtn" class="btn btn-sm btn-outline-secondary" disabled><i class="bi bi-file-earmark-text me-1"></i> Print Pick Report</button>
                        <button id="printStickersBtn" class="btn btn-sm btn-outline-secondary" disabled><i class="bi bi-printer me-1"></i> Print Stickers</button>
                    </div>
                </div>
            </div>
        </header>

        <main class="flex-grow-1 p-4">
            <div class="row g-4">
                <!-- Orders Column -->
                <div class="col-lg-12">
                    <div class="card h-100">
                        <div class="card-header">
                            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                <h5 class="card-title mb-0">Orders for Picking</h5>
                                <div class="d-flex flex-wrap align-items-center gap-2">
                                    <div class="input-group input-group-sm" style="width: 250px;">
                                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                        <input type="search" id="orderSearchInput" class="form-control border-start-0" placeholder="Search by Order #, Customer Name/Code...">
                                    </div>
                                    <select id="pickingStatusFilter" class="form-select form-select-sm w-auto">
                                        <option value="all">Show All</option>
                                        <option value="Pending Pick">Pending Pick</option>
                                        <option value="Partially Picked">Partially Picked</option>
                                        <option value="Picked">Picked</option>
                                        <option value="Staged">Staged</option>
                                        <option value="Delivery Failed">Delivery Failed</option>
                                        <option value="Assigned">Assigned</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <!-- Notification Alert Area -->
                            <div id="notificationArea" class="mb-3"></div>
                            
                            <!-- Order Cards Grid -->
                            <div id="ordersGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3">
                                <!-- Order cards will be injected here by JS -->
                            </div>
                             <div id="noOrdersMessage" class="text-center p-5 d-none">
                                <i class="bi bi-box-seam" style="font-size: 3rem;"></i>
                                <h5 class="mt-3">No orders found for the selected filter.</h5>
                            </div>


                            <!-- Pagination -->
                            <nav id="paginationNav" class="mt-4 d-flex justify-content-center"></nav>
                        </div>
                    </div>
                </div>

                <!-- Picking Process Column -->
                <div class="col-lg-12">
                    <div id="pickingProcessArea" class="d-none">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Processing Order: <span id="selectedOrderNumberDisplay" class="text-primary"></span></h5>
                            </div>
                            <div class="card-body">
                                <input type="hidden" id="currentOrderId">
                                <div class="mb-3">
                                    <h6>Items to Pick:</h6>
                                    <div class="table-responsive">
                                        <table class="table table-bordered">
                                            <thead class="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Product</th>
                                                    <th>SKU</th>
                                                    <th>Article No</th>
                                                    <th>Ordered</th>
                                                    <th>Picked</th>
                                                    <th colspan="4"></th> <!-- Placeholder for pick details header -->
                                                </tr>
                                            </thead>
                                            <tbody id="orderItemsTableBody"></tbody>
                                        </table>
                                    </div>
                                </div>
                                
                                <div id="pickActionsArea" class="d-none">
                                    <hr>
                                    <h6>Perform Pick:</h6>
                                    <div class="row g-3 align-items-end">
                                        <div class="col-md-2">
                                            <label for="pickItemNumberInput" class="form-label">Item #</label>
                                            <input type="text" class="form-control numeric-only" id="pickItemNumberInput" placeholder="e.g., 1">
                                        </div>
                                        <div class="col-md-3">
                                            <label for="pickDotCodeSelect" class="form-label">DOT</label>
                                            <select id="pickDotCodeSelect" class="form-select"></select>
                                        </div>
                                        <div class="col-md-3">
                                            <label for="pickLocationSelect" class="form-label">Location</label>
                                            <select id="pickLocationSelect" class="form-select"></select>
                                        </div>
                                        <div class="col-md-2">
                                            <label for="pickBatchNumberSelect" class="form-label">Batch</label>
                                            <select id="pickBatchNumberSelect" class="form-select"></select>
                                        </div>
                                        <div class="col-md-1">
                                            <label for="pickQuantityInput" class="form-label">Qty</label>
                                            <input type="number" class="form-control numeric-only" id="pickQuantityInput" min="1" value="1">
                                        </div>
                                        <div class="col-md-1">
                                            <button id="pickItemBtn" class="btn btn-success w-100" disabled><i class="bi bi-check-lg"></i></button>
                                        </div>
                                    </div>
                                    <div id="pickQuantityError" class="text-danger small mt-1"></div>
                                </div>
                                
                                <div id="stagingActionsArea" class="d-none mt-3">
                                    <hr>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="mb-1"><strong>Shipping Area:</strong> <span id="shippingAreaDisplay" class="">Not Staged</span></p>
                                            <p class="mb-0"><strong>Driver:</strong> <span id="driverInfoDisplay" class="">Not Assigned</span></p>
                                        </div>
                                        <div class="d-flex gap-2 flex-wrap">
                                            <button id="scrapOrderBtn" class="btn btn-danger d-none"><i class="bi bi-trash-fill me-1"></i> Scrap Items</button>
                                            <button id="stageOrderBtn" class="btn btn-warning d-none">Stage for Pickup</button>
                                            <button id="assignDriverBtn" class="btn btn-primary d-none"><i class="bi bi-person-plus-fill me-1"></i> Assign Driver</button>
                                            <button id="changeDriverBtn" class="btn btn-info d-none"><i class="bi bi-person-vcard me-1"></i> Change Driver</button>
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
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>

    <!-- Custom Scripts -->
    <script src="js/main.js"></script>
    <script src="js/notifications.js"></script>
    <script src="js/picking.js"></script>
</body>
</html>
