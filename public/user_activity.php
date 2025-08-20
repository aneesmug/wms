<?php
/*
* MODIFICATION SUMMARY:
* 1. Replaced all hardcoded English text for titles and headers with the `__()` translation function.
* 2. Added the required script tag in the <head> to load translations with `JSON_UNESCAPED_UNICODE`.
* 3. The entire page is now fully localizable.
*/
require_once __DIR__ . '/helpers/auth_helper.php';
require_global_admin();
$pageTitle = $pageTitle ?? __('user_login_activity');
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>" class="h-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('user_login_activity'); ?> - WMS</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
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
            <?php require_once __DIR__ . '/includes/header.php'; ?>

            <main class="flex-grow-1 p-4 p-md-5 bg-light">
                <div class="container-fluid">
                    <div class="card shadow-sm">
                        <div class="card-header header-primary d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0"><?php echo __('login_activity_overview'); ?></h5>
                            <div class="d-flex align-items-center gap-2">
                                <div class="card-header-actions">
                                    <button type="button" class="btn-card-header" data-action="refresh" title="<?php echo __('refresh'); ?>"><i class="bi bi-arrow-counterclockwise"></i></button>
                                    <button type="button" class="btn-card-header" data-action="maximize" title="<?php echo __('maximize'); ?>"><i class="bi bi-arrows-fullscreen"></i></button>
                                    <button type="button" class="btn-card-header" data-action="close" title="<?php echo __('close'); ?>"><i class="bi bi-x-lg"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <h6 class="mb-3"><?php echo __('login_locations_map'); ?></h6>
                            <div id="activityMap" style="height: 450px; width: 100%; border-radius: .25rem; border: 1px solid #dee2e6;"></div>
                            
                            <hr class="my-4">

                            <h6 class="mb-3"><?php echo __('detailed_login_history'); ?></h6>
                            <div class="table-responsive">
                                <table id="activityTable" class="table table-hover align-middle" style="width:100%">
                                    <thead class="table-light">
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.0.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script src="js/main.js"></script>
    <script src="js/user_activity.js"></script>
</body>
</html>
