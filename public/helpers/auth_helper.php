<?php
// helpers/auth_helper.php

// Ensure session is started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Sends a JSON response to the client and terminates the script.
 * This function is defined with function_exists to prevent errors if it's included multiple times.
 *
 * @param mixed $data The data to encode as JSON.
 * @param int $statusCode The HTTP status code to send.
 */
if (!function_exists('sendJsonResponse')) {
    function sendJsonResponse($data, $statusCode = 200) {
        // Clear any previous output
        if (ob_get_level() > 0) {
            ob_end_clean();
        }
        header('Content-Type: application/json');
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
}

/**
 * Sanitizes user input to prevent XSS and other injection attacks.
 *
 * @param string $data The input string.
 * @return string The sanitized string.
 */
if (!function_exists('sanitize_input')) {
    function sanitize_input($data) {
        $data = trim($data);
        $data = stripslashes($data);
        $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
        return $data;
    }
}

/**
 * Ensures that the current user is authenticated (logged in) and is a global admin.
 * If the user does not meet these criteria, it sends an appropriate JSON error
 * response and terminates the script execution.
 */
function require_global_admin() {
    // First, check if a user is logged in at all.
    if (!isset($_SESSION['user_id'])) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Authentication required. Please log in to continue.'
        ], 401); // 401 Unauthorized
    }

    // Next, check if the logged-in user has global admin privileges.
    if (!isset($_SESSION['is_global_admin']) || $_SESSION['is_global_admin'] !== true) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Forbidden. You do not have the necessary permissions to access this resource.'
        ], 403); // 403 Forbidden
    }
}

?>
