<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Deliveries</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .bg-orange {
            color: #000;
            background-color: #fd7e14; /* Bootstrap's orange */
        }
        .card-footer {
            background-color: #f8f9fa;
        }
        .nav-tabs .nav-link.active {
            font-weight: bold;
        }
    </style>
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
                    <h1 class="h4 mb-0 text-dark">My Deliveries</h1>
                </div>
            </div>
        </header>

        <main class="p-4">
            <div class="container-fluid">
                <ul class="nav nav-tabs" id="deliveryTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="active-tab" data-bs-toggle="tab" data-bs-target="#active-deliveries" type="button" role="tab" aria-controls="active-deliveries" aria-selected="true">Active Deliveries</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="completed-tab" data-bs-toggle="tab" data-bs-target="#completed-deliveries" type="button" role="tab" aria-controls="completed-deliveries" aria-selected="false">Completed Deliveries</button>
                    </li>
                </ul>

                <div class="tab-content" id="deliveryTabsContent">
                    <div class="tab-pane fade show active" id="active-deliveries" role="tabpanel" aria-labelledby="active-tab">
                        <div id="ordersGrid" class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4 mt-2">
                            <!-- Active orders will be loaded here -->
                        </div>
                        <div id="loadingSpinnerActive" class="col-12 text-center p-5">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                        <div id="noOrdersMessageActive" class="alert alert-info d-none mt-4">
                            You have no active deliveries assigned.
                        </div>
                    </div>
                    <div class="tab-pane fade" id="completed-deliveries" role="tabpanel" aria-labelledby="completed-tab">
                        <div class="card shadow-sm mt-3">
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="completedOrdersTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th>Order No.</th>
                                                <th>Customer</th>
                                                <th>Delivery Address</th>
                                                <th>Customer Mobile</th>
                                                <th>Delivered To</th>
                                                <th>Receiver Mobile</th>
                                                <th>Delivery Date</th>
                                                <th>Proof</th>
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
        </main>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    
    <script src="js/main.js"></script>
    <script src="js/delivery.js"></script>
</body>
</html>
