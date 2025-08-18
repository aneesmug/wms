<?php
// MODIFICATION SUMMARY:
// 1. Updated the language switcher logic to preserve all existing URL parameters (e.g., tracking_number).
// 2. The script now reads the current query string, modifies only the 'lang' parameter, and rebuilds the URL.

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/helpers/language_helper.php';
$lang = isset($_GET['lang']) && $_GET['lang'] === 'ar' ? 'ar' : 'en';
load_language($lang);

// --- Language Switcher Logic ---
$queryParams = $_GET;
$queryParams['lang'] = ($lang === 'ar') ? 'en' : 'ar';
$queryString = http_build_query($queryParams);
$other_lang_text = ($lang === 'ar') ? 'English' : 'العربية';
?>
<!DOCTYPE html>
<html lang="<?php echo $lang; ?>" dir="<?php echo $lang === 'ar' ? 'rtl' : 'ltr'; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('confirm_delivery'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if ($lang === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
    <?php endif; ?>
    <style>
        body { background-color: #f8f9fa; }
        .public-page-container { max-width: 600px; }
        .logo { max-width: 220px; }
    </style>
</head>
<body>
    <div class="container my-4">
        <div class="d-flex justify-content-end mb-2">
            <a href="?<?php echo $queryString; ?>" class="btn btn-outline-secondary btn-sm">
                <i class="bi bi-translate me-1"></i> <?php echo $other_lang_text; ?>
            </a>
        </div>
        <div class="public-page-container mx-auto">
            <div class="text-center mb-4">
                <img src="img/logo.png" alt="Company Logo" class="logo">
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <h2 class="card-title text-center"><?php echo __('proof_of_delivery'); ?></h2>
                    <p class="card-text text-center text-muted mb-4"><?php echo __('pod_instructions'); ?></p>
                    
                    <form id="deliveryConfirmationForm" enctype="multipart/form-data">
                        <div class="mb-3">
                            <label for="trackingNumberInput" class="form-label"><?php echo __('tracking_or_order_no'); ?></label>
                            <input type="text" id="trackingNumberInput" class="form-control form-control-lg" required>
                        </div>
                        <div class="mb-3">
                            <label for="confirmationCodeInput" class="form-label"><?php echo __('delivery_confirmation_code'); ?></label>
                            <input type="text" id="confirmationCodeInput" class="form-control form-control-lg" placeholder="Enter 6-digit code if provided">
                        </div>
                        <hr>
                        <div class="mb-3">
                            <label for="receiverNameInput" class="form-label"><?php echo __('receiver_full_name'); ?></label>
                            <input type="text" id="receiverNameInput" class="form-control" required>
                        </div>
                         <div class="mb-3">
                            <label for="receiverPhoneInput" class="form-label"><?php echo __('receiver_phone_optional'); ?></label>
                            <input type="tel" id="receiverPhoneInput" class="form-control">
                        </div>
                        <div class="mb-3">
                            <label for="deliveryPhotoInput" class="form-label"><?php echo __('pod_photo'); ?></label>
                            <input type="file" id="deliveryPhotoInput" class="form-control" accept="image/*" required>
                            <div class="form-text"><?php echo __('pod_photo_instructions'); ?></div>
                        </div>
                        <div class="d-grid mt-4">
                            <button type="submit" id="submitDeliveryBtn" class="btn btn-success btn-lg"><?php echo __('confirm_delivery'); ?></button>
                        </div>
                    </form>
                    <div class="text-center mt-3">
                        <button type="button" id="reportFailureBtn" class="btn btn-link text-danger"><?php echo __('report_failed_delivery'); ?></button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="js/delivery_confirmation.js"></script>
</body>
</html>
