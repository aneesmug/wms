<?php
// includes/menu.php

// Ensure session is started, as we need to access session variables.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// --- Role-Based Access Control (RBAC) Map ---
$permissions = [
    'manager' => [
        'dashboard.php', 'inbound.php', 'outbound.php', 'inventory.php', 
        'locations.php', 'products.php', 'customers.php', 'suppliers.php', 
        'reports.php', 'inbound_report.php', 'batch_search.php', 'users.php',
        'warehouses.php', 'picking.php'
    ],
    'operator' => [
        'dashboard.php', 'inbound.php', 'outbound.php', 'inventory.php', 
        'locations.php', 'batch_search.php', 'picking.php'
    ],
    'picker' => [
        'dashboard.php', 'inventory.php', 'picking.php'
    ],
    'viewer' => [
        'dashboard.php', 'inventory.php', 'reports.php', 'inbound_report.php'
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
    return isset($permissionMap[$role]) && in_array($page, $permissionMap[$role]);
}

$current_page = basename($_SERVER['PHP_SELF']);

$menu_items = [
    'dashboard' => ['label' => 'Dashboard', 'url' => 'dashboard.php', 'icon' => 'bi-speedometer2'],
    'delivery' => ['label' => 'My Deliveries', 'url' => 'delivery.php', 'icon' => 'bi-truck'],
    'operations' => [
        'label' => 'Operations', 'icon' => 'bi-arrows-angle-contract', 'submenu' => [
            ['label' => 'Inbound', 'url' => 'inbound.php', 'icon' => 'bi-box-arrow-in-down'],
            ['label' => 'Outbound', 'url' => 'outbound.php', 'icon' => 'bi-box-arrow-up-right'],
            ['label' => 'Picking', 'url' => 'picking.php', 'icon' => 'bi-box-seam']
        ]
    ],
    'inventory' => [
        'label' => 'Inventory', 'icon' => 'bi-boxes', 'submenu' => [
            ['label' => 'Stock', 'url' => 'inventory.php', 'icon' => 'bi-box']
        ]
    ],
    'master_data' => [
        'label' => 'Master Data', 'icon' => 'bi-database', 'submenu' => [
            ['label' => 'Products', 'url' => 'products.php', 'icon' => 'bi-tag'],
            ['label' => 'Locations', 'url' => 'locations.php', 'icon' => 'bi-geo-alt'],
            ['label' => 'Warehouses', 'url' => 'warehouses.php', 'icon' => 'bi-buildings'],
            ['label' => 'Customers', 'url' => 'customers.php', 'icon' => 'bi-people'],
            ['label' => 'Suppliers', 'url' => 'suppliers.php', 'icon' => 'bi-truck']
        ]
    ],
    'tools' => [
        'label' => 'Tools & Reports', 'icon' => 'bi-tools', 'submenu' => [
            ['label' => 'Reports', 'url' => 'reports.php', 'icon' => 'bi-file-earmark-bar-graph'],
            ['label' => 'Inbound Report', 'url' => 'inbound_report.php', 'icon' => 'bi-printer'],
            ['label' => 'Batch Search', 'url' => 'batch_search.php', 'icon' => 'bi-search'],
            ['label' => 'Users', 'url' => 'users.php', 'icon' => 'bi-people']
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
    <a href="dashboard.php" class="d-block p-3 link-light text-decoration-none text-center" title="WMS Home" data-bs-toggle="tooltip" data-bs-placement="right">
        <i class="bi bi-box-seam fs-4"></i>
    </a>
    <hr class="mt-0">
    <ul class="nav nav-pills nav-flush flex-column mb-auto text-center">
        <?php foreach ($menu_items as $key => $item): ?>
            <?php
            if (isset($item['submenu'])) {
                $canShow = false;
                foreach ($item['submenu'] as $sub_item) if (can_access($sub_item['url'], $permissions, $currentUserRole)) $canShow = true;
                if (!$canShow) continue;
            } else {
                if (!can_access($item['url'], $permissions, $currentUserRole)) continue;
            }
            ?>
            <?php if (isset($item['submenu'])): ?>
                <li class="nav-item dropend">
                    <a href="#" class="nav-link text-white <?php echo is_submenu_active($item['submenu'], $current_page) ? 'active' : ''; ?>" data-bs-toggle="dropdown" aria-expanded="false" title="<?php echo $item['label']; ?>" data-bs-placement="right">
                        <i class="bi <?php echo $item['icon']; ?>"></i>
                    </a>
                    <ul class="dropdown-menu">
                        <li><h6 class="dropdown-header"><?php echo $item['label']; ?></h6></li>
                        <?php foreach ($item['submenu'] as $sub_item): ?>
                            <?php if (can_access($sub_item['url'], $permissions, $currentUserRole)): ?>
                                <li><a class="dropdown-item <?php echo $current_page == $sub_item['url'] ? 'active' : ''; ?>" href="<?php echo $sub_item['url']; ?>"><i class="bi <?php echo $sub_item['icon']; ?> me-2"></i> <?php echo $sub_item['label']; ?></a></li>
                            <?php endif; ?>
                        <?php endforeach; ?>
                    </ul>
                </li>
            <?php else: ?>
                <li class="nav-item">
                    <a href="<?php echo $item['url']; ?>" class="nav-link text-white <?php echo $current_page == $item['url'] ? 'active' : ''; ?>" title="<?php echo $item['label']; ?>" data-bs-toggle="tooltip" data-bs-placement="right">
                        <i class="bi <?php echo $item['icon']; ?>"></i>
                    </a>
                </li>
            <?php endif; ?>
        <?php endforeach; ?>
    </ul>
    <hr>
    <!-- User Info Dropdown (Desktop) -->
    <div class="dropdown pb-3 text-center">
        <a href="#" class="d-block link-light text-decoration-none dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
            <img id="userProfileImageDesktop" src="uploads/users/default.png" alt="User" width="32" height="32" class="rounded-circle">
        </a>
        <ul class="dropdown-menu dropdown-menu-dark text-small shadow" style="left: auto; right: 10px;">
            <li><h6 id="userFullNameDesktop" class="dropdown-header">Loading...</h6></li>
            <li><span id="userRoleDesktop" class="dropdown-item-text text-white-50 px-3">Loading...</span></li>
            <li><hr class="dropdown-divider"></li>
            <li><a id="logoutBtnDesktop" class="dropdown-item" href="#"><i class="bi bi-box-arrow-left me-2"></i>Logout</a></li>
        </ul>
    </div>
</div>

<!-- Mobile Offcanvas Sidebar -->
<div class="offcanvas offcanvas-start bg-dark text-white d-md-none" tabindex="-1" id="mobileSidebar" aria-labelledby="mobileSidebarLabel">
    <div class="offcanvas-header border-bottom border-secondary">
        <h5 class="offcanvas-title" id="mobileSidebarLabel"><i class="bi bi-box-seam me-2"></i>WMS Menu</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body d-flex flex-column">
        <!-- User Info (Mobile) -->
        <div class="d-flex align-items-center mb-3 p-2 border-bottom border-secondary">
            <img id="userProfileImageMobile" src="uploads/users/default.png" alt="User" width="40" height="40" class="rounded-circle me-3">
            <div>
                <div id="userFullNameMobile" class="fw-bold">Loading...</div>
                <div id="userRoleMobile" class="text-white-50 small">Loading...</div>
            </div>
        </div>
        <ul class="nav nav-pills flex-column mb-auto">
            <?php foreach ($menu_items as $key => $item): ?>
                <?php
                if (isset($item['submenu'])) {
                    $canShow = false;
                    foreach ($item['submenu'] as $sub_item) if (can_access($sub_item['url'], $permissions, $currentUserRole)) $canShow = true;
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
                                <?php if (can_access($sub_item['url'], $permissions, $currentUserRole)): ?>
                                    <li><a href="<?php echo $sub_item['url']; ?>" class="nav-link text-white <?php echo $current_page == $sub_item['url'] ? 'active' : ''; ?>"><i class="bi <?php echo $sub_item['icon']; ?> me-2"></i><span><?php echo $sub_item['label']; ?></span></a></li>
                                <?php endif; ?>
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
        <button id="logoutBtnMobile" class="btn btn-danger w-100"><i class="bi bi-box-arrow-left me-2"></i><span>Logout</span></button>
    </div>
</div>
