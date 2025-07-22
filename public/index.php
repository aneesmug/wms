<!DOCTYPE html>
<html lang="en" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WMS Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <!-- SweetAlert2 for notifications -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="d-flex align-items-center py-4 bg-light h-100">
    
    <main class="form-signin w-100 m-auto" style="max-width: 400px;">
        <form id="loginForm">
            <div class="text-center mb-4">
                <i class="bi bi-box-seam" style="font-size: 4rem; color: var(--bs-primary);"></i>
                <h1 class="h3 mb-3 fw-normal">WMS Login</h1>
                <p class="text-muted">Please sign in to continue</p>
            </div>

            <div class="form-floating mb-3">
                <input type="text" class="form-control" id="username" name="username" placeholder="Username" required>
                <label for="username">Username</label>
            </div>
            <div class="form-floating mb-3">
                <input type="password" class="form-control" id="password" name="password" placeholder="Password" required>
                <label for="password">Password</label>
            </div>

            <button class="w-100 btn btn-lg btn-primary" type="submit">Sign in</button>
            <p class="mt-5 mb-3 text-muted text-center">&copy; 2024-2025</p>
        </form>
    </main>
    
    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    
    <!-- **FIX:** Replaced inline script with external file includes for proper functionality -->
    <script src="js/main.js"></script>
    <script src="js/auth.js"></script>
</body>
</html>
