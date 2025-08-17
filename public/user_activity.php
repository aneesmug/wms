<?php
/*
* MODIFICATION SUMMARY:
* 1. Restructured the entire page to match the layout of `users.php`.
* 2. Integrated the standard header and menu structure.
* 3. Combined the map and the data table into a single Bootstrap card (`.card`) for a consistent look and feel.
* 4. The map is now displayed at the top of the card body, followed by the detailed activity table.
*/

require_once __DIR__ . '/helpers/auth_helper.php';

// This page is for global admins only
require_global_admin();

// Note: The header and footer includes are now part of the main layout structure
?>
<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Login Activity - WMS</title>
    <!-- CSS Dependencies from users.php -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <!-- Leaflet CSS for the map -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
</head>
<body class="bg-light">
    <div id="content">
        <?php include 'includes/menu.php'; ?>

        <div class="flex-grow-1 d-flex flex-column">
            <header class="bg-white shadow-sm border-bottom">
                <div class="container-fluid px-4">
                    <div class="d-flex justify-content-between align-items-center py-3">
                        <!-- This button toggles the offcanvas menu on mobile -->
                        <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                            <i class="bi bi-list"></i>
                        </button>
                        <h1 class="h4 mb-0 text-dark">User Login Activity</h1>
                    </div>
                </div>
            </header>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="card shadow-sm">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Login Activity Overview</h5>
                        </div>
                        <div class="card-body">
                            <!-- Map Visualization Section -->
                            <h6 class="mb-3">Login Locations Map</h6>
                            <div id="activityMap" style="height: 450px; width: 100%; border-radius: .25rem; border: 1px solid #dee2e6;"></div>
                            
                            <hr class="my-4">

                            <!-- Data Table Section -->
                            <h6 class="mb-3">Detailed Login History</h6>
                            <div class="table-responsive">
                                <table id="activityTable" class="table table-hover align-middle" style="width:100%">
                                    <thead class="table-light">
                                        <!-- Headers are populated by DataTables in JS -->
                                    </thead>
                                    <tbody>
                                        <!-- Data will be loaded by DataTables -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <!-- JS Dependencies from users.php -->
    <script src="https://code.jquery.com/jquery-3.7.0.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    
    <!-- Leaflet JS for the map -->
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    
    <!-- Core and Page-specific JS -->
    <script src="js/api.js"></script>
    <script src="js/main.js"></script>
    <script src="js/user_activity.js"></script>
</body>
</html>
