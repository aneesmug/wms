<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management - WMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <!-- SweetAlert2 CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <!-- Croppie CSS -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-light">
    <!-- Main container that includes sidebar and content -->
    <div id="content">
        <?php include 'includes/menu.php'; // Include the shared sidebar navigation ?>

        <!-- Main Content Area -->
        <div class="flex-grow-1 d-flex flex-column">
            
            <!-- Top Header Bar -->
            <header class="bg-white shadow-sm border-bottom">
                <div class="container-fluid px-4">
                    <div class="d-flex justify-content-between align-items-center py-3">
                        <h1 class="h4 mb-0 text-dark">User Management</h1>
                        <button class="btn btn-primary" id="addUserBtn">
                            <i class="bi bi-plus-circle me-1"></i> Add New User
                        </button>
                    </div>
                </div>
            </header>

            <!-- Page-specific Content -->
            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <?php
                    // Security check: Ensure only global admins can see the content.
                    if (!isset($_SESSION['is_global_admin']) || $_SESSION['is_global_admin'] !== true) {
                        echo '<div class="alert alert-danger">You do not have permission to access this page.</div>';
                    } else {
                    ?>
                        <!-- User table card -->
                        <div class="card shadow-sm">
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-hover align-middle">
                                        <thead class="table-light">
                                            <tr>
                                                <th>User</th>
                                                <th>Username</th>
                                                <th>Global Admin</th>
                                                <th>Assigned Warehouses & Roles</th>
                                                <th class="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="usersTableBody">
                                            <!-- User rows will be dynamically inserted here by JavaScript -->
                                            <tr><td colspan="5" class="text-center p-4">Loading users...</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    <?php
                    } // End of admin-only content block
                    ?>
                </div>
            </main>
        </div>
    </div>

    <!-- Hidden Form for SweetAlert2 -->
    <div id="userFormContainer" style="display: none;">
        <form id="userForm" class="text-start">
            <input type="hidden" id="userId" name="user_id">
            
            <!-- Profile Image Section -->
            <div class="mb-3 text-center">
                <img id="profileImagePreview" src="assets/images/default-user.png" alt="Profile Preview" class="rounded-circle mb-2" style="width: 120px; height: 120px; object-fit: cover;">
                <div id="croppieContainer" class="mt-2" style="display: none; width: 100%; height: 300px;"></div>
                <label for="profileImage" class="btn btn-sm btn-outline-secondary mt-2">
                    <i class="bi bi-upload"></i> Choose Image
                </label>
                <input type="file" id="profileImage" name="profile_image" class="d-none" accept="image/*">
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="fullName" class="form-label">Full Name</label>
                    <input type="text" class="form-control" id="fullName" name="full_name" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input type="text" class="form-control" id="username" name="username" required>
                </div>
            </div>

            <!-- Password section for new users -->
            <div id="passwordSection">
                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <div class="input-group">
                        <input type="password" class="form-control" id="password" name="password" required>
                        <button class="btn btn-outline-secondary" type="button" id="togglePassword">
                            <i class="bi bi-eye-slash"></i>
                        </button>
                    </div>
                </div>
                <div class="mb-3">
                    <label for="confirmPassword" class="form-label">Confirm Password</label>
                    <div class="input-group">
                        <input type="password" class="form-control" id="confirmPassword" name="confirm_password" required>
                         <button class="btn btn-outline-secondary" type="button" id="toggleConfirmPassword">
                            <i class="bi bi-eye-slash"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Change password button for existing users -->
            <div id="changePasswordBtnContainer" class="mb-3" style="display: none;">
                 <label class="form-label">Password</label>
                 <div>
                    <button type="button" class="btn btn-secondary" id="changePasswordBtn">
                        <i class="bi bi-key me-2"></i>Change Password
                    </button>
                 </div>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch" id="isGlobalAdmin" name="is_global_admin">
                <label class="form-check-label" for="isGlobalAdmin">Is Global Admin</label>
            </div>

            <hr>

            <div id="warehouseRolesSection">
                <h5>Warehouse Permissions</h5>
                <p class="text-muted small">Assign roles for specific warehouses. This is disabled for Global Admins.</p>
                
                <div class="row g-3 align-items-end" id="addRoleControls">
                    <div class="col-md-5">
                        <label for="warehouseSelect" class="form-label">Warehouse</label>
                        <select id="warehouseSelect" class="form-select"></select>
                    </div>
                    <div class="col-md-5">
                        <label for="roleSelect" class="form-label">Role</label>
                        <select id="roleSelect" class="form-select"></select>
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-success w-100" id="addRoleBtn">Add</button>
                    </div>
                </div>

                <div class="mt-3">
                    <h6 class="mb-2">Assigned Roles</h6>
                    <ul class="list-group" id="assignedRolesList">
                        <!-- Assigned roles will be listed here -->
                    </ul>
                </div>
            </div>
        </form>
    </div>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- SweetAlert2 -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <!-- Croppie JS -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.js"></script>
    <!-- Load utility scripts first -->
    <script src="js/api.js"></script>
    <script src="js/main.js"></script>
    <!-- Page-specific script -->
    <script src="js/users.js"></script>
</body>
</html>
