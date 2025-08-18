<?php
// helpers/auth_helper.php

// MODIFICATION SUMMARY:
// 1. CRITICAL FIX: Added a require_once for the main config.php file at the very top.
// 2. This ensures that a database connection ($conn) is always available before the language helper is loaded.
// 3. This resolves the "Call to undefined function __()" fatal error in users.php and other pages.

// Ensure config is loaded first to establish DB connection
require_once __DIR__ . '/../config/config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Include the new language helper to make its functions available everywhere
require_once __DIR__ . '/language_helper.php';

// Initialize language from session if user is logged in
if (isset($_SESSION['lang'])) {
    load_language($_SESSION['lang']);
} else {
    load_language('en'); // Default to English if no language is set
}


if (!function_exists('sendJsonResponse')) {
    function sendJsonResponse($data, $statusCode = 200) {
        if (ob_get_level() > 0) {
            ob_end_clean();
        }
        header('Content-Type: application/json');
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
}

if (!function_exists('sanitize_input')) {
    function sanitize_input($data) {
        $data = trim($data);
        $data = stripslashes($data);
        $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
        return $data;
    }
}

if (!function_exists('authenticate_user')) {
    function authenticate_user(bool $warehouse_required = false, ?array $allowed_roles = null) {
        if (!isset($_SESSION['user_id'])) {
            sendJsonResponse(['success' => false, 'message' => 'Authentication required. Please log in.'], 401);
            exit;
        }

        if ($warehouse_required && (!isset($_SESSION['current_warehouse_id']) || empty($_SESSION['current_warehouse_id']))) {
            sendJsonResponse(['success' => false, 'message' => 'Please select a warehouse to proceed.'], 403);
            exit;
        }

        if ($allowed_roles !== null) {
            authorize_user_role($allowed_roles);
        }
    }
}

if (!function_exists('authorize_user_role')) {
    function authorize_user_role(array $allowed_roles) {
        $current_role = $_SESSION['current_warehouse_role'] ?? null;
        $is_global_admin = $_SESSION['is_global_admin'] ?? false;

        if ($is_global_admin) {
            return;
        }

        if ($current_role === null) {
            sendJsonResponse(['success' => false, 'message' => 'No role found for the current warehouse. Please select a warehouse.'], 403);
            exit;
        }

        if (!in_array($current_role, $allowed_roles)) {
            sendJsonResponse(['success' => false, 'message' => 'Access Denied: You do not have sufficient permissions to perform this action.'], 403);
            exit;
        }
    }
}

if (!function_exists('require_global_admin')) {
    function require_global_admin() {
        if (!isset($_SESSION['user_id'])) {
            sendJsonResponse(['success' => false, 'message' => 'Authentication required. Please log in to continue.'], 401);
        }

        if (!isset($_SESSION['is_global_admin']) || $_SESSION['is_global_admin'] !== true) {
            sendJsonResponse(['success' => false, 'message' => 'Forbidden. You do not have the necessary permissions to access this resource.'], 403);
        }
    }
}
