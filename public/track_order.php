<?php
// MODIFICATION SUMMARY:
// 1. Added a language switcher button in the top-right corner.
// 2. The button's link and text change dynamically based on the current language detected from the URL.
// 3. This allows public users to toggle between English and Arabic on this page.

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/helpers/language_helper.php';
$lang = isset($_GET['lang']) && $_GET['lang'] === 'ar' ? 'ar' : 'en';
load_language($lang);

$other_lang = ($lang === 'ar') ? 'en' : 'ar';
$other_lang_text = ($lang === 'ar') ? 'English' : 'العربية';
?>
<!DOCTYPE html>
<html lang="<?php echo $lang; ?>" dir="<?php echo $lang === 'ar' ? 'rtl' : 'ltr'; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('track_your_shipment'); ?> - Continental</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="icon" href="favicon.ico" type="image/x-icon">
    <?php if ($lang === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
    <?php endif; ?>
</head>

<body>
    <div class="container my-4">
        <div class="d-flex justify-content-end mb-2">
            <a href="?lang=<?php echo $other_lang; ?>" class="btn btn-outline-secondary btn-sm">
                <i class="bi bi-translate me-1"></i> <?php echo $other_lang_text; ?>
            </a>
        </div>
        <div class="tracking-container-redesigned mx-auto">
            <div class="text-center mb-4">
                <img src="img/logo.png" alt="Company Logo" class="logo">
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <h2 class="card-title text-center"><?php echo __('track_your_shipment'); ?></h2>
                    <p class="card-text text-center text-muted mb-4"><?php echo __('track_instructions'); ?></p>

                    <form id="trackingForm" class="mb-4">
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-truck"></i></span>
                            <input type="text" id="trackingNumber" class="form-control form-control-lg" placeholder="e.g., TRK-12345" required>
                            <button class="btn btn-primary" type="submit" id="trackBtn">
                                <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                                <?php echo __('track'); ?>
                            </button>
                        </div>
                    </form>

                    <div id="trackingResult" class="mt-4 d-none">
                        <div class="card bg-light border-0 mb-4">
                            <div class="card-body">
                                <div class="row align-items-center">
                                    <div class="col-md-6">
                                        <h5 class="mb-1"><?php echo __('order_status'); ?></h5>
                                        <p id="orderStatus" class="h4 fw-bold text-primary mb-0"></p>
                                    </div>
                                    <div class="col-md-6 text-md-end mt-3 mt-md-0">
                                        <h6 class="mb-1 text-muted"><?php echo __('required_ship_date'); ?></h6>
                                        <p id="expectedDelivery" class="fw-bold mb-0"></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h5 class="mt-4 mb-3"><?php echo __('shipment_history'); ?></h5>
                        <div id="trackingTimeline" class="timeline">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="js/notifications.js"></script>
    <script src="js/track_order.js"></script>
</body>
</html>
