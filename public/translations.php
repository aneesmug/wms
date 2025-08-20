<?php
require_once __DIR__ . '/helpers/auth_helper.php';
$pageTitle = $pageTitle ?? __('translations');
?>
<!DOCTYPE html>
<html lang="<?php echo $_SESSION['lang'] ?? 'en'; ?>" dir="<?php echo ($_SESSION['lang'] ?? 'en') === 'ar' ? 'rtl' : 'ltr'; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo __('translations'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if (($_SESSION['lang'] ?? 'en') === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
        <link rel="stylesheet" href="css/style-rtl.css">
    <?php endif; ?>
    <script> window.lang = <?php echo json_encode($translations, JSON_UNESCAPED_UNICODE); ?>; </script>
</head>
<body class="bg-light">

    <?php include 'includes/menu.php'; ?>

    <div id="content">
        
        <?php require_once __DIR__ . '/includes/header.php'; ?>

        <main class="p-4 p-md-5">
            <div class="container-fluid">
                <div class="row g-4">
                    <!-- Add New Translation Card -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header header-primary">
                                <h5 class="card-title mb-0"><?php echo __('add_new_translation'); ?></h5>
                            </div>
                            <div class="card-body">
                                <form id="addTranslationForm" class="row g-3">
                                    <div class="col-md-3">
                                        <label for="lang_key" class="form-label"><?php echo __('language_key'); ?></label>
                                        <input type="text" class="form-control" id="lang_key" name="lang_key" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label for="translation_en" class="form-label"><?php echo __('english_translation'); ?></label>
                                        <input type="text" class="form-control" id="translation_en" name="translation_en" required>
                                    </div>
                                    <div class="col-md-4">
                                        <label for="translation_ar" class="form-label"><?php echo __('arabic_translation'); ?></label>
                                        <input type="text" class="form-control" id="translation_ar" name="translation_ar" dir="rtl" required>
                                    </div>
                                    <div class="col-md-1 d-flex align-items-end">
                                        <button type="submit" class="btn btn-primary w-100"><?php echo __('add'); ?></button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- Translations List Card -->
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header">
                                <h5 class="card-title mb-0"><?php echo __('translations_list'); ?></h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table id="translationsTable" class="table table-hover" style="width:100%">
                                        <thead>
                                            <tr>
                                                <th><?php echo __('language_key'); ?></th>
                                                <th><?php echo __('english'); ?></th>
                                                <th><?php echo __('arabic'); ?></th>
                                                <th><?php echo __('actions'); ?></th>
                                            </tr>
                                        </thead>
                                        <tbody></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <script src="js/main.js"></script>
    <script src="js/translations.js" defer></script>
</body>
</html>
