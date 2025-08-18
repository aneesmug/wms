<?php
/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English text for titles, headers, buttons, and form labels with the `__()` translation function.
* 2. Added the required script tag in the <head> to load translations with `JSON_UNESCAPED_UNICODE`.
* 3. The entire page, including modals and dynamic content, is now fully localizable.
*/
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('user_management'); ?> - WMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
        <link rel="stylesheet" href="css/style-rtl.css">
    <?php endif; ?>
    <script> window.lang = <?php echo json_encode($translations, JSON_UNESCAPED_UNICODE); ?>; </script>
</head>
<body class="bg-light">
    <div id="content">
        <?php include 'includes/menu.php'; ?>

        <div class="flex-grow-1 d-flex flex-column">
            <header class="bg-white shadow-sm border-bottom">
                <div class="container-fluid px-4">
                    <div class="d-flex justify-content-between align-items-center py-3">
                        <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                            <i class="bi bi-list"></i>
                        </button>
                        <h1 class="h4 mb-0 text-dark"><?php echo __('user_management'); ?></h1>
                    </div>
                </div>
            </header>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <?php if (!isset($_SESSION['is_global_admin']) || $_SESSION['is_global_admin'] !== true): ?>
                        <div class="alert alert-danger"><?php echo __('access_denied_page'); ?></div>
                    <?php else: ?>
                        <div class="card shadow-sm">
                            <div class="card-header d-flex justify-content-between align-items-center flex-wrap">
                                <h5 class="card-title mb-0 me-auto"><?php echo __('user_list'); ?></h5>
                                <div class="d-flex align-items-center ms-3">
                                    <div class="btn-group">
                                        <button type="button" class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" data-bs-auto-close="outside">
                                            <i class="bi bi-filter"></i> <?php echo __('filter'); ?>
                                        </button>
                                        <div id="filterContainer" class="dropdown-menu p-3" style="width: 350px;">
                                        </div>
                                    </div>
                                    <button class="btn btn-primary btn-sm ms-3" id="addUserBtn">
                                        <i class="bi bi-plus-circle me-1"></i> <?php echo __('add_new_user'); ?>
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="usersTable" class="table table-hover align-middle" style="width:100%">
                                        <thead class="table-light">
                                            <tr>
                                                <th><?php echo __('user'); ?></th>
                                                <th><?php echo __('username'); ?></th>
                                                <th><?php echo __('global_admin'); ?></th>
                                                <th><?php echo __('assigned_locations_roles'); ?></th>
                                                <th class="text-end"><?php echo __('actions'); ?></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>
            </main>
        </div>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="userModal" tabindex="-1" aria-labelledby="userModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header"><h5 class="modal-title" id="userModalLabel"><?php echo __('user_details'); ?></h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo __('close'); ?>"></button></div>
                <div class="modal-body">
                    <form id="userForm" class="text-start" novalidate>
                        <input type="hidden" id="userId" name="user_id">
                        <div class="mb-3 text-center" id="profileImageSection" style="display: none;"><img id="profileImagePreview" src="uploads/users/default.png" alt="Profile Preview" class="rounded-circle mb-2" style="width: 120px; height: 120px; object-fit: cover; cursor: pointer;"><div><input type="file" id="profileImageInput" class="d-none" accept="image/*"><button type="button" id="changeImageBtn" class="btn btn-sm btn-outline-secondary mt-2"><i class="bi bi-upload"></i> <?php echo __('change_image'); ?></button></div></div>
                        <div class="row"><div class="col-md-6 mb-3"><label for="fullName" class="form-label"><?php echo __('full_name'); ?></label><input type="text" class="form-control" id="fullName" name="full_name" required></div><div class="col-md-6 mb-3"><label for="username" class="form-label"><?php echo __('username'); ?></label><input type="text" class="form-control" id="username" name="username" required></div></div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="preferred_language" class="form-label"><?php echo __('preferred_language'); ?></label>
                                <select class="form-select" id="preferred_language" name="preferred_language" required>
                                    <option value="" disabled selected><?php echo __('select_language'); ?></option>
                                    <option value="en"><?php echo __('english'); ?></option>
                                    <option value="ar"><?php echo __('arabic'); ?></option>
                                </select>
                            </div>
                        </div>
                        <div id="passwordSection"><div class="mb-3"><label for="password" class="form-label"><?php echo __('password'); ?></label><div class="input-group"><input type="password" class="form-control" id="password" name="password"><button class="btn btn-outline-secondary" type="button" id="togglePassword"><i class="bi bi-eye-slash"></i></button></div></div><div class="mb-3"><label for="confirmPassword" class="form-label"><?php echo __('confirm_password'); ?></label><div class="input-group"><input type="password" class="form-control" id="confirmPassword" name="confirm_password"><button class="btn btn-outline-secondary" type="button" id="toggleConfirmPassword"><i class="bi bi-eye-slash"></i></button></div></div></div>
                        <div id="changePasswordBtnContainer" class="mb-3" style="display: none;"><label class="form-label"><?php echo __('password'); ?></label><div><button type="button" class="btn btn-secondary" id="changePasswordBtn"><i class="bi bi-key me-2"></i><?php echo __('change_password'); ?></button></div></div>
                        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="isGlobalAdmin" name="is_global_admin"><label class="form-check-label" for="isGlobalAdmin"><?php echo __('is_global_admin'); ?></label></div>
                        <hr>
                        <div id="warehouseRolesSection">
                            <h5><?php echo __('warehouse_permissions'); ?></h5>
                            <p class="text-muted small"><?php echo __('assign_roles_for_warehouses'); ?></p>
                            <button type="button" class="btn btn-outline-secondary" id="managePermissionsBtn">
                                <i class="bi bi-shield-check me-1"></i> <?php echo __('manage_permissions'); ?>
                            </button>
                            <span id="permissionsCount" class="ms-3 text-muted"><?php echo __('no_permissions_assigned'); ?></span>
                        </div>
                    </form>
                </div>
                <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo __('cancel'); ?></button><button type="button" class="btn btn-primary" id="saveUserBtn"><?php echo __('save_changes'); ?></button></div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="permissionsModal" tabindex="-1" aria-labelledby="permissionsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="permissionsModalLabel"><?php echo __('manage_warehouse_permissions'); ?></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="<?php echo __('close'); ?>"></button>
                </div>
                <div class="modal-body">
                    <p class="text-muted"><?php echo __('select_role_for_warehouse'); ?></p>
                    <div id="permissionsMatrixContainer" class="table-responsive">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><?php echo __('cancel'); ?></button>
                    <button type="button" class="btn btn-primary" id="applyPermissionsBtn"><?php echo __('apply_permissions'); ?></button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.0.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/users.js"></script>
</body>
</html>
