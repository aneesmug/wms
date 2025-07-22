<?php
// api/warehouses.php

// CRITICAL: Ensure NO whitespace, BOM, or any characters before this opening PHP tag.

require_once __DIR__ . '/../config/config.php';

// FIX: Initialize $conn immediately after including config.php
$conn = getDbConnection();
// CRITICAL: Start Output Buffering at the very beginning of the script.
ob_start();

// --- DEBUGGING LOGS ---
// Log the session status and user ID before calling authenticate_user
error_log("warehouses.php: Session status: " . session_status()); // 0=NONE, 1=ACTIVE, 2=DISABLED
error_log("warehouses.php: _SESSION user_id: " . (isset($_SESSION['user_id']) ? $_SESSION['user_id'] : 'NOT SET'));
// --- END DEBUGGING LOGS ---


// Authenticate user, but DO NOT require a warehouse to be selected yet,
// as this API provides the list for selection.
// We pass 'false' to authenticate_user() to skip the warehouse selection check.
authenticate_user(false); // This parameter is crucial here!

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetWarehouses($conn);
        break;
    case 'POST':
        // Optional: Implement create warehouse
        sendJsonResponse(['message' => 'POST method not implemented for Warehouses (read-only example)'], 405);
        break;
    // ... Implement PUT/DELETE if needed for warehouse management
    default:
        sendJsonResponse(['message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetWarehouses($conn) {
    // Fetch all active warehouses
    $result = $conn->query("SELECT warehouse_id, warehouse_name, address, city FROM warehouses WHERE is_active = TRUE ORDER BY warehouse_name ASC");
    if (!$result) {
        // Log MySQL error if query fails, but don't expose directly to client
        error_log("warehouses.php: Database query failed: " . $conn->error);
        throw new Exception("Database query failed to fetch warehouses."); // Throw generic exception
    }
    $warehouses = [];
    while ($row = $result->fetch_assoc()) {
        $warehouses[] = $row;
    }
    sendJsonResponse($warehouses);
}
