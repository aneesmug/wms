<div class="ms-3">
    <?php
        $current_lang = $_SESSION['lang'] ?? 'en';
        $next_lang = ($current_lang === 'en') ? 'ar' : 'en';
        $button_text = ($current_lang === 'en') ? 'العربية' : 'English';
    ?>
    <a href="#" class="btn btn-outline-secondary btn-sm" id="language-toggle-btn" data-lang="<?php echo $next_lang; ?>">
        <i class="bi bi-translate me-1"></i> <?php echo $button_text; ?>
    </a>
</div>