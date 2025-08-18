<?php
// includes/menu.php

// MODIFICATION SUMMARY:
// 1. Added a check for the current language (`$is_rtl`).
// 2. Conditionally changed Bootstrap classes for RTL support:
//    - Desktop sidebar dropdowns are now `dropstart` instead of `dropend`.
//    - Desktop icon tooltips are now placed on the `left` instead of the `right`.
//    - The mobile offcanvas menu now opens from the `end` (right) instead of the `start` (left).
// 3. This ensures the menu layout correctly adapts when switching to Arabic.

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$is_rtl = (isset($_SESSION['lang']) && $_SESSION['lang'] === 'ar');

$permissions = [
    'manager' => [
        'dashboard.php', 'inbound.php', 'outbound.php', 'inventory.php', 
        'locations.php', 'products.php', 'customers.php', 'suppliers.php', 
        'reports.php', 'inbound_report.php', 'batch_search.php', 'users.php',
        'warehouses.php', 'picking.php', 'returns.php', 'transfer_order.php',
        'delivery_companies.php', 'inventory_transfer.php'
    ],
    'operator' => [
        'dashboard.php', 'inbound.php', 'outbound.php', 'inventory.php', 
        'locations.php', 'batch_search.php', 'picking.php', 'returns.php', 'transfer_order.php',
        'inventory_transfer.php'
    ],
    'picker' => [
        'dashboard.php', 'inventory.php', 'picking.php',
    ],
    'viewer' => [
        'dashboard.php', 'inventory.php', 'products.php', 'reports.php', 'returns.php', 'inbound.php', 'outbound.php', 'customers.php',
    ],
    'driver' => [
        'delivery.php'
    ],
    'guest' => []
];

$currentUserRole = $_SESSION['current_warehouse_role'] ?? 'guest';
if (isset($_SESSION['is_global_admin']) && $_SESSION['is_global_admin'] === true) {
    $currentUserRole = 'manager';
}

function can_access($page, $permissionMap, $role) {
    if ($page === 'profile.php') {
        return true;
    }
    return isset($permissionMap[$role]) && in_array($page, $permissionMap[$role]);
}

$current_page = basename($_SERVER['PHP_SELF']);

$menu_items = [
    'dashboard' => ['label' => __('dashboard'), 'url' => 'dashboard.php', 'icon' => 'bi-speedometer2'],
    'delivery' => ['label' => __('my_deliveries'), 'url' => 'delivery.php', 'icon' => 'bi-truck'],
    'operations' => [
        'label' => __('operations'), 'icon' => 'bi-arrows-angle-contract', 'submenu' => [
            ['label' => __('inbound'), 'url' => 'inbound.php', 'icon' => 'bi-box-arrow-in-down'],
            ['label' => __('outbound'), 'url' => 'outbound.php', 'icon' => 'bi-box-arrow-up-right'],
            ['label' => __('picking'), 'url' => 'picking.php', 'icon' => 'bi-box-seam'],
            ['label' => __('returns'), 'url' => 'returns.php', 'icon' => 'bi-arrow-return-left'],
            ['label' => __('transfer_order'), 'url' => 'transfer_order.php', 'icon' => 'bi-arrows-expand']
        ]
    ],
    'inventory' => [
        'label' => __('inventory'), 'icon' => 'bi-boxes', 'submenu' => [
            ['label' => __('stock'), 'url' => 'inventory.php', 'icon' => 'bi-box'],
            ['label' => __('internal_transfer'), 'url' => 'inventory_transfer.php', 'icon' => 'bi-arrows-move']
        ]
    ],
    'master_data' => [
        'label' => __('master_data'), 'icon' => 'bi-database', 'submenu' => [
            ['label' => __('products'), 'url' => 'products.php', 'icon' => 'bi-tag'],
            ['label' => __('locations'), 'url' => 'locations.php', 'icon' => 'bi-geo-alt'],
            ['label' => __('warehouses'), 'url' => 'warehouses.php', 'icon' => 'bi-buildings'],
            ['label' => __('customers'), 'url' => 'customers.php', 'icon' => 'bi-people'],
            ['label' => __('suppliers'), 'url' => 'suppliers.php', 'icon' => 'bi-truck'],
            ['label' => __('delivery_companies'), 'url' => 'delivery_companies.php', 'icon' => 'bi-truck-front']
        ]
    ],
    'tools' => [
        'label' => __('tools_reports'), 'icon' => 'bi-tools', 'submenu' => [
            ['label' => __('reports'), 'url' => 'reports.php', 'icon' => 'bi-file-earmark-bar-graph'],
            ['label' => __('inbound_report'), 'url' => 'inbound_report.php', 'icon' => 'bi-printer'],
            ['label' => __('batch_search'), 'url' => 'batch_search.php', 'icon' => 'bi-search'],
            ['label' => __('users'), 'url' => 'users.php', 'icon' => 'bi-people'],
            ['label' => __('user_activity'), 'url' => 'user_activity.php', 'icon' => 'bi-person-bounding-box', 'admin_only' => true]
        ]
    ]
];

function is_submenu_active($submenu_items, $current_page) {
    foreach ($submenu_items as $item) {
        if ($current_page == $item['url']) return true;
    }
    return false;
}
?>

<!-- Desktop Icon-only Sidebar -->
<div class="sidebar d-none d-md-flex flex-column flex-shrink-0 bg-dark">
    <a href="dashboard.php" class="d-block p-3 link-light text-decoration-none text-center" title="WMS Home" data-bs-toggle="tooltip" data-bs-placement="<?php echo $is_rtl ? 'left' : 'right'; ?>">
        <i class="bi bi-box-seam fs-4"></i>
    </a>
    <hr class="mt-0">
    <ul class="nav nav-pills nav-flush flex-column mb-auto text-center">
        <?php foreach ($menu_items as $key => $item): ?>
            <?php
            if (isset($item['submenu'])) {
                $canShow = false;
                foreach ($item['submenu'] as $sub_item) {
                    if (isset($sub_item['admin_only']) && $sub_item['admin_only'] === true) {
                        if (isset($_SESSION['is_global_admin']) && $_SESSION['is_global_admin']) $canShow = true;
                    } else if (can_access($sub_item['url'], $permissions, $currentUserRole)) {
                        $canShow = true;
                    }
                }
                if (!$canShow) continue;
            } else {
                if (!can_access($item['url'], $permissions, $currentUserRole)) continue;
            }
            ?>
            <?php if (isset($item['submenu'])): ?>
                <li class="nav-item <?php echo $is_rtl ? 'dropstart' : 'dropend'; ?>">
                    <a href="#" class="nav-link text-white <?php echo is_submenu_active($item['submenu'], $current_page) ? 'active' : ''; ?>" data-bs-toggle="dropdown" aria-expanded="false" title="<?php echo $item['label']; ?>" data-bs-placement="<?php echo $is_rtl ? 'left' : 'right'; ?>">
                        <i class="bi <?php echo $item['icon']; ?>"></i>
                    </a>
                    <ul class="dropdown-menu">
                        <li><h6 class="dropdown-header"><?php echo $item['label']; ?></h6></li>
                        <?php foreach ($item['submenu'] as $sub_item): ?>
                            <?php 
                                if (isset($sub_item['admin_only']) && $sub_item['admin_only'] === true) {
                                    if (!isset($_SESSION['is_global_admin']) || !$_SESSION['is_global_admin']) continue;
                                } else if (!can_access($sub_item['url'], $permissions, $currentUserRole)) {
                                    continue;
                                }
                            ?>
                            <li><a class="dropdown-item <?php echo $current_page == $sub_item['url'] ? 'active' : ''; ?>" href="<?php echo $sub_item['url']; ?>"><i class="bi <?php echo $sub_item['icon']; ?> me-2"></i> <?php echo $sub_item['label']; ?></a></li>
                        <?php endforeach; ?>
                    </ul>
                </li>
            <?php else: ?>
                <li class="nav-item">
                    <a href="<?php echo $item['url']; ?>" class="nav-link text-white <?php echo $current_page == $item['url'] ? 'active' : ''; ?>" title="<?php echo $item['label']; ?>" data-bs-toggle="tooltip" data-bs-placement="<?php echo $is_rtl ? 'left' : 'right'; ?>">
                        <i class="bi <?php echo $item['icon']; ?>"></i>
                    </a>
                </li>
            <?php endif; ?>
        <?php endforeach; ?>
    </ul>
    <hr>
    <div class="dropdown pb-3 text-center">
        <a href="#" class="d-block link-light text-decoration-none dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
            <img id="userProfileImageDesktop" src="uploads/users/default.png" alt="User" width="32" height="32" class="rounded-circle">
        </a>
        <ul class="dropdown-menu dropdown-menu-dark text-small shadow">
            <li><h6 id="userFullNameDesktop" class="dropdown-header">Loading...</h6></li>
            <li><span id="userRoleDesktop" class="dropdown-item-text text-white-50 px-3">Loading...</span></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="profile.php"><i class="bi bi-person-fill me-2"></i><?php echo __('my_profile'); ?></a></li>
            <li><a id="logoutBtnDesktop" class="dropdown-item" href="#"><i class="bi bi-box-arrow-left me-2"></i><?php echo __('logout'); ?></a></li>
        </ul>
    </div>
</div>

<div class="offcanvas <?php echo $is_rtl ? 'offcanvas-end' : 'offcanvas-start'; ?> bg-dark text-white d-md-none" tabindex="-1" id="mobileSidebar" aria-labelledby="mobileSidebarLabel">
    <div class="offcanvas-header border-bottom border-secondary">
        <h5 class="offcanvas-title" id="mobileSidebarLabel"><i class="bi bi-box-seam me-2"></i>WMS Menu</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body d-flex flex-column">
        <div class="d-flex align-items-center mb-3 p-2 border-bottom border-secondary">
            <img id="userProfileImageMobile" src="uploads/users/default.png" alt="User" width="40" height="40" class="rounded-circle me-3">
            <div>
                <div id="userFullNameMobile" class="fw-bold">Loading...</div>
                <div id="userRoleMobile" class="text-white-50 small">Loading...</div>
            </div>
        </div>
        <ul class="nav nav-pills flex-column mb-auto">
             <li><a class="nav-link text-white <?php echo $current_page == 'profile.php' ? 'active' : ''; ?>" href="profile.php"><i class="bi bi-person-fill me-2"></i><?php echo __('my_profile'); ?></a></li>
            <?php foreach ($menu_items as $key => $item): ?>
                <?php
                if (isset($item['submenu'])) {
                    $canShow = false;
                     foreach ($item['submenu'] as $sub_item) {
                        if (isset($sub_item['admin_only']) && $sub_item['admin_only'] === true) {
                            if (isset($_SESSION['is_global_admin']) && $_SESSION['is_global_admin']) $canShow = true;
                        } else if (can_access($sub_item['url'], $permissions, $currentUserRole)) {
                            $canShow = true;
                        }
                    }
                    if (!$canShow) continue;
                } else {
                    if (!can_access($item['url'], $permissions, $currentUserRole)) continue;
                }
                ?>
                <?php if (isset($item['submenu'])): ?>
                    <li>
                        <a href="#<?php echo $key; ?>SubmenuMobile" data-bs-toggle="collapse" class="nav-link text-white d-flex justify-content-between align-items-center">
                            <span><i class="bi <?php echo $item['icon']; ?> me-2"></i><span><?php echo $item['label']; ?></span></span>
                            <i class="bi bi-chevron-down"></i>
                        </a>
                        <ul class="collapse list-unstyled flex-column ms-4 <?php echo is_submenu_active($item['submenu'], $current_page) ? 'show' : ''; ?>" id="<?php echo $key; ?>SubmenuMobile">
                            <?php foreach ($item['submenu'] as $sub_item): ?>
                                <?php 
                                    if (isset($sub_item['admin_only']) && $sub_item['admin_only'] === true) {
                                        if (!isset($_SESSION['is_global_admin']) || !$_SESSION['is_global_admin']) continue;
                                    } else if (!can_access($sub_item['url'], $permissions, $currentUserRole)) {
                                        continue;
                                    }
                                ?>
                                <li><a href="<?php echo $sub_item['url']; ?>" class="nav-link text-white <?php echo $current_page == $sub_item['url'] ? 'active' : ''; ?>"><i class="bi <?php echo $sub_item['icon']; ?> me-2"></i><span><?php echo $sub_item['label']; ?></span></a></li>
                            <?php endforeach; ?>
                        </ul>
                    </li>
                <?php else: ?>
                    <li class="nav-item">
                        <a href="<?php echo $item['url']; ?>" class="nav-link text-white d-flex align-items-center <?php echo $current_page == $item['url'] ? 'active' : ''; ?>">
                            <i class="bi <?php echo $item['icon']; ?> me-2"></i><span><?php echo $item['label']; ?></span>
                        </a>
                    </li>
                <?php endif; ?>
            <?php endforeach; ?>
        </ul>
        <hr>
        <button id="logoutBtnMobile" class="btn btn-danger w-100"><i class="bi bi-box-arrow-left me-2"></i><span><?php echo __('logout'); ?></span></button>
    </div>
</div>
