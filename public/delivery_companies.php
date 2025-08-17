<?php
// 012-delivery_companies.php
// MODIFICATION SUMMARY:
// - The main table has been simplified to show company details.
// - A new column with a '+' icon has been added to expand and view drivers for each company.
// - An "Add Driver" button will be dynamically added by JavaScript for each company row.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS - Delivery Companies</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        /* Style for the expand/collapse icon */
        td.dt-control {
            background: url('https://datatables.net/examples/resources/details_open.png') no-repeat center center;
            cursor: pointer;
        }
        tr.dt-shown td.dt-control {
            background: url('https://datatables.net/examples/resources/details_close.png') no-repeat center center;
        }
        /* Style for the nested driver table */
        .driver-table {
            width: 100%;
        }
        .driver-table th, .driver-table td {
            font-size: 0.9em;
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
                    <h1 class="h4 mb-0 text-dark">Manage Delivery Companies</h1>
                </div>
            </div>
        </header>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="card shadow-sm">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0">Companies List</h5>
                        <button id="addCompanyBtn" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle me-1"></i> Add New Company</button>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table id="companiesTable" class="table table-hover" style="width:100%">
                                <thead>
                                    <tr>
                                        <th></th> <!-- Expander column -->
                                        <th>Company Name</th>
                                        <th>Contact Person</th>
                                        <th>Phone Number</th>
                                        <th>Email</th>
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
        </main>
    </div>
    
    <!-- JavaScript Libraries -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    
    <!-- Custom Application Scripts -->
    <script src="js/main.js"></script>
    <script src="js/delivery_companies.js" defer></script>
</body>
</html>
