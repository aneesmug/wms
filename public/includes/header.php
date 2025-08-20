<header class="bg-white shadow-sm border-bottom">
    <div class="container-fluid px-4">
        <div class="d-flex justify-content-between align-items-center py-3">
            <button class="btn btn-outline-secondary d-md-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                <i class="bi bi-list"></i>
            </button>
            <h1 class="h4 mb-0 text-dark"><?= $pageTitle ?? __('default_page') ?></h1>
            <div class="d-flex align-items-center">
                <label for="warehouseSelector" class="form-label me-2 mb-0"><?php echo __('warehouse'); ?>:</label>
                <select id="warehouseSelector" class="form-select form-select-sm" style="width: auto;"></select>
                <!-- Language Switcher Dropdown -->
                <?php require_once __DIR__ . '/../helpers/lang_helper.php'; ?>
            </div>
        </div>
    </div>
</header>