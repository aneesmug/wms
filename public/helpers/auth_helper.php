<?php
// helpers/auth_helper.php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
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
