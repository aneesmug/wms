<?php
require_once __DIR__ . '/helpers/auth_helper.php';
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('wms_login'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
    <?php endif; ?>
</head>
<body class="d-flex align-items-center py-4 bg-light h-100">
    
    <main class="form-signin w-100 m-auto" style="max-width: 400px;">
        <form id="loginForm">
            <div class="text-center mb-4">
                <i class="bi bi-box-seam" style="font-size: 4rem; color: var(--bs-primary);"></i>
                <h1 class="h3 mb-3 fw-normal"><?php echo __('wms_login'); ?></h1>
                <p class="text-muted"><?php echo __('please_sign_in'); ?></p>
            </div>

            <div class="form-floating mb-3">
                <input type="text" class="form-control" id="username" name="username" placeholder="<?php echo __('username'); ?>" required>
                <label for="username"><?php echo __('username'); ?></label>
            </div>
            <div class="form-floating mb-3">
                <input type="password" class="form-control" id="password" name="password" placeholder="<?php echo __('password'); ?>" required>
                <label for="password"><?php echo __('password'); ?></label>
            </div>

            <div class="form-check text-start my-3">
                <input class="form-check-input" type="checkbox" value="remember-me" id="rememberMe">
                <label class="form-check-label" for="rememberMe">
                    <?php echo __('remember_me'); ?>
                </label>
            </div>

            <button class="w-100 btn btn-lg btn-primary" type="submit"><?php echo __('sign_in'); ?></button>
            <p class="mt-5 mb-3 text-muted text-center">&copy; 2024-2025</p>
        </form>
    </main>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="js/api.js"></script>
    <script src="js/main.js"></script>
    <script src="js/auth.js"></script>
</body>
</html>
