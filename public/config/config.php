<?php
// config/config.php

// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root'); // Your MySQL username
define('DB_PASS', 'admin123');     // Your MySQL password
define('DB_NAME', 'almutlak_wms_final_db'); // The database name

// Establish database connection
function getDbConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    // Check connection
    if ($conn->connect_error) {
        error_log("Connection failed: " . $conn->connect_error);
        // Use a generic message for the user
        sendJsonResponse(['message' => 'Database connection failed. Please contact support.', 'error' => true], 500);
    }

    $conn->set_charset("utf8mb4");
    return $conn;
}

// Set up error reporting for development (should be disabled for production)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Set default timezone
date_default_timezone_set('Asia/Riyadh');

// Start session for user authentication
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Function to validate and sanitize input
function sanitize_input($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    return $data;
}

// Function for sending JSON responses
function sendJsonResponse($data, $statusCode = 200) {
    // Clear any previously buffered output to prevent JSON errors
    if (ob_get_level() > 0) {
        ob_clean();
    }
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit();
}

/**
 * Retrieves the current warehouse ID from the session.
 * @return int|null
 */
function get_current_warehouse_id() {
    return $_SESSION['current_warehouse_id'] ?? null;
}

/**
 * Retrieves the current warehouse name from the session.
 * @return string|null
 */
function get_current_warehouse_name() {
    return $_SESSION['current_warehouse_name'] ?? null;
}

/**
 * Retrieves the current warehouse role from the session.
 * @return string|null
 */
function get_current_warehouse_role() {
    // If user is global admin, their role is always 'manager'
    if (isset($_SESSION['is_global_admin']) && $_SESSION['is_global_admin']) {
        return 'manager';
    }
    return $_SESSION['current_warehouse_role'] ?? null;
}

/**
 * Sets the current warehouse details in the session.
 * @param int $warehouse_id
 * @param string $warehouse_name
 * @param string $role
 */
function set_current_warehouse($warehouse_id, $warehouse_name, $role) {
    $_SESSION['current_warehouse_id'] = $warehouse_id;
    $_SESSION['current_warehouse_name'] = $warehouse_name;
    $_SESSION['current_warehouse_role'] = $role;
}

/**
 * Unsets the current warehouse selection from the session.
 */
function unset_current_warehouse() {
    unset($_SESSION['current_warehouse_id']);
    unset($_SESSION['current_warehouse_name']);
    unset($_SESSION['current_warehouse_role']);
}

/**
 * Authorizes a user based on their role for the current warehouse.
 * A global admin is always authorized.
 *
 * @param array $allowed_roles An array of roles that are permitted (e.g., ['manager', 'operator']).
 */
function authorize_user_role(array $allowed_roles) {
    // If user is a global admin, they are always authorized.
    if (isset($_SESSION['is_global_admin']) && $_SESSION['is_global_admin'] === true) {
        return; // Authorized
    }

    $current_role = get_current_warehouse_role();

    if ($current_role === null) {
        sendJsonResponse(['message' => 'Access Denied: No role assigned for this warehouse.'], 403);
    }

    // Check if the user's current role is in the list of allowed roles.
    if (!in_array($current_role, $allowed_roles)) {
        sendJsonResponse(['message' => 'Access Denied: You do not have sufficient permissions to perform this action.'], 403);
    }
}


/**
 * Core authentication and authorization check.
 * This should be called at the beginning of any protected API script.
 *
 * @param bool $require_warehouse If true, also checks if a warehouse is selected.
 * @param array|null $allowed_roles If provided, checks if the user has one of the required roles for the action.
 */
function authenticate_user($require_warehouse = true, array $allowed_roles = null) {
    if (!isset($_SESSION['user_id'])) {
        sendJsonResponse(['message' => 'Unauthorized: Please log in.', 'error' => true], 401);
    }

    if ($require_warehouse && !isset($_SESSION['current_warehouse_id'])) {
        sendJsonResponse(['message' => 'No warehouse selected. Please select a warehouse to proceed.', 'error' => true], 400);
    }

    // If specific roles are required, perform the authorization check.
    if ($require_warehouse && $allowed_roles !== null) {
        authorize_user_role($allowed_roles);
    }
}

/**
 * Checks if a user has a specific role for a given warehouse based on session data.
 * This is a critical security function.
 *
 * @param mysqli $conn The database connection.
 * @param int $user_id The ID of the user.
 * @param int $warehouse_id The ID of the warehouse.
 * @param array $allowed_roles An array of strings representing the roles to check for (e.g., ['operator', 'manager']).
 * @return bool True if the user has one of the allowed roles, false otherwise.
 */
function check_user_role_for_warehouse($conn, $user_id, $warehouse_id, $allowed_roles) {
    // Global admins have all permissions for all warehouses.
    if (isset($_SESSION['is_global_admin']) && $_SESSION['is_global_admin']) {
        return true;
    }

    // Check against the roles stored in the session during login.
    $roles_in_session = $_SESSION['assigned_warehouses'] ?? [];
    foreach ($roles_in_session as $assignment) {
        if ($assignment['warehouse_id'] == $warehouse_id) {
            // Found the role for the target warehouse, check if it's in the allowed list.
            return in_array($assignment['role'], $allowed_roles);
        }
    }
    
    // If the loop finishes, the user is not assigned to the target warehouse or has no valid role.
    return false;
}
