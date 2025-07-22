<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Location Management</title>
    <!-- Stylesheets -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/buttons/2.4.1/css/buttons.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/select2-bootstrap-5-theme@1.3.0/dist/select2-bootstrap-5-theme.min.css" />
    <!-- SweetAlert2 CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <!-- Main Content -->
    <div id="content">
        
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between align-items-center py-3">
                    <!-- This button toggles the offcanvas menu on mobile -->
                    <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                        <i class="bi bi-list"></i>
                    </button>
                    <h1 class="h4 mb-0 text-dark mx-auto mx-md-0">Warehouse Location Management</h1>
                    <span id="currentWarehouseNameDisplay" class="text-muted"></span>
                </div>
            </div>
        </header>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="card shadow-sm">
                        <div class="card-header d-flex justify-content-between align-items-center flex-wrap">
                            <h5 class="card-title mb-2 mb-md-0 me-3">Warehouse Locations</h5>
                            <div class="d-flex align-items-center">
                                <div class="me-3 d-flex align-items-center">
                                    <label for="locationTypeFilter" class="form-label-sm mb-0 me-2">Filter by Type:</label>
                                    <select id="locationTypeFilter" class="form-select form-select-sm" style="width: auto;">
                                        <!-- Options are populated dynamically by locations.js -->
                                    </select>
                                </div>
                                <button id="addNewLocationBtn" class="btn btn-primary btn-sm">
                                    <i class="bi bi-plus-circle me-1"></i> Add New Location
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table id="locationsDataTable" class="table table-hover" style="width:100%">
                                    <thead>
                                        <tr>
                                            <th>Code</th>
                                            <th>Type</th>
                                            <th>Max Units</th>
                                            <th>Used</th>
                                            <th>Avail.</th>
                                            <th>Full?</th>
                                            <th>Active</th>
                                            <th class="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="locationsTableBody">
                                        <!-- Data will be populated by DataTables -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <!-- JavaScript libraries -->
    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    
    <!-- Custom Scripts -->
    <script src="js/main.js"></script>
    <script src="js/locations.js" defer></script>
</body>
</html>
