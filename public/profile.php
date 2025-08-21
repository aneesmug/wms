<?php
/*
* MODIFICATION SUMMARY:
* 1. Added a language switcher dropdown menu to the main header.
* 2. The dropdown allows users to select between English and Arabic.
* 3. The currently active language is highlighted in the dropdown.
*/

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// This helper now handles both authentication and language loading.
require_once __DIR__ . '/helpers/auth_helper.php';

// Redirect if not logged in (this check is also inside authenticate_user, but good for clarity)
if (!isset($_SESSION['user_id'])) {
    header("Location: index.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('my_profile'); ?> - WMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
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
                        <h1 class="h4 mb-0 text-dark"><?php echo __('my_profile'); ?></h1>
                        <!-- Language Switcher Dropdown -->
                        <?php require_once __DIR__ . '/helpers/lang_helper.php'; ?>
                    </div>
                </div>
            </header>

            <main class="flex-grow-1 p-4 p-md-5">
                <div class="container-fluid">
                    <div class="row">
                        <!-- Profile Details Column -->
                        <div class="col-lg-8">
                            <!-- Update Profile Card -->
                            <div class="card shadow-sm mb-4">
                                <div class="card-header">
                                    <h5 class="mb-0"><?php echo __('profile_information'); ?></h5>
                                </div>
                                <div class="card-body">
                                    <form id="profileForm">
                                        <div class="text-center mb-4">
                                            <img id="profileImagePreview" src="uploads/users/default.png" alt="Profile Preview" 
                                                 class="rounded-circle mb-2" style="width: 150px; height: 150px; object-fit: cover; cursor: pointer;">
                                            <div>
                                                <label for="profileImageInput" class="btn btn-sm btn-outline-secondary">
                                                    <i class="bi bi-upload"></i> <?php echo __('change_image'); ?>
                                                </label>
                                                <input type="file" id="profileImageInput" class="d-none" accept="image/*">
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="fullName" class="form-label"><?php echo __('full_name'); ?></label>
                                            <input type="text" class="form-control" id="fullName" name="full_name" required>
                                        </div>
                                        <button type="submit" class="btn btn-primary"><?php echo __('save_profile_changes'); ?></button>
                                    </form>
                                </div>
                            </div>
                            <!-- Change Password Card -->
                            <div class="card shadow-sm">
                                <div class="card-header">
                                    <h5 class="mb-0"><?php echo __('change_password'); ?></h5>
                                </div>
                                <div class="card-body">
                                    <form id="passwordForm">
                                        <div class="mb-3">
                                            <label for="currentPassword" class="form-label"><?php echo __('current_password'); ?></label>
                                            <input type="password" class="form-control" id="currentPassword" required>
                                        </div>
                                        <div class="mb-3">
                                            <label for="newPassword" class="form-label"><?php echo __('new_password'); ?></label>
                                            <input type="password" class="form-control" id="newPassword" required>
                                        </div>
                                        <div class="mb-3">
                                            <label for="confirmNewPassword" class="form-label"><?php echo __('confirm_new_password'); ?></label>
                                            <input type="password" class="form-control" id="confirmNewPassword" required>
                                        </div>
                                        <button type="submit" class="btn btn-primary"><?php echo __('change_password'); ?></button>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <!-- Roles and Permissions Column -->
                        <div class="col-lg-4">
                            <div class="card shadow-sm">
                                <div class="card-header">
                                    <h5 class="mb-0"><?php echo __('my_roles'); ?></h5>
                                </div>
                                <div class="card-body">
                                    <p class="text-muted"><?php echo __('roles_description'); ?></p>
                                    <ul class="list-group" id="userRolesList">
                                        <!-- Roles will be dynamically inserted here -->
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/croppie/2.6.5/croppie.min.js"></script>
    <script src="js/api.js"></script>
    <script src="js/main.js"></script>
    <script src="js/profile.js"></script>
</body>
</html>
