<?php
// api/warehouses_api.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(false); // Do not require a warehouse to be selected for this API

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

// A global admin can perform any action. A regular user must have the 'manager' role.
// The authorize_user_role() function checks this against the currently selected warehouse.
// Since this page manages ALL warehouses, we do a manual check here.
if (!isset($_SESSION['is_global_admin']) || !$_SESSION['is_global_admin']) {
    if ($method !== 'GET') { // Allow GET for all authenticated users, but restrict CUD
        sendJsonResponse(['success' => false, 'message' => 'You do not have permission to manage warehouses.'], 403);
        exit;
    }
}


switch ($method) {
    case 'GET':
        handleGetWarehouses($conn);
        break;
    case 'POST':
        handleCreateWarehouse($conn);
        break;
    case 'PUT':
        handleUpdateWarehouse($conn);
        break;
    case 'DELETE':
        handleDeleteWarehouse($conn);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetWarehouses($conn) {
    $result = $conn->query("SELECT warehouse_id, warehouse_name, address, city, country, zip, is_active FROM warehouses ORDER BY warehouse_name ASC");
    if (!$result) {
        error_log("warehouses_api.php: Database query failed: " . $conn->error);
        sendJsonResponse(['success' => false, 'data' => [], 'message' => 'Failed to fetch warehouses.'], 500);
        return;
    }
    $warehouses = $result->fetch_all(MYSQLI_ASSOC);
    // Return in DataTables format
    sendJsonResponse(['success' => true, 'data' => $warehouses]);
}

function handleCreateWarehouse($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    // --- Validation ---
    $name = sanitize_input($input['warehouse_name'] ?? '');
    if (empty($name)) {
        sendJsonResponse(['success' => false, 'message' => 'Warehouse Name is required.'], 400);
        return;
    }
    // Add other validation as needed for address, city, etc.

    $stmt = $conn->prepare("INSERT INTO warehouses (warehouse_name, address, city, country, zip, is_active) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param(
        "ssssii",
        $name,
        sanitize_input($input['address'] ?? null),
        sanitize_input($input['city'] ?? null),
        sanitize_input($input['country'] ?? null),
        filter_var($input['zip'] ?? null, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE),
        filter_var($input['is_active'] ?? 1, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
    );

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Warehouse created successfully.'], 201);
    } else {
        error_log("Create warehouse failed: " . $stmt->error);
        sendJsonResponse(['success' => false, 'message' => 'Failed to create warehouse.'], 500);
    }
    $stmt->close();
}

function handleUpdateWarehouse($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = filter_var($input['warehouse_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJsonResponse(['success' => false, 'message' => 'Warehouse ID is required.'], 400);
        return;
    }
    
    $name = sanitize_input($input['warehouse_name'] ?? '');
    if (empty($name)) {
        sendJsonResponse(['success' => false, 'message' => 'Warehouse Name is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("UPDATE warehouses SET warehouse_name = ?, address = ?, city = ?, country = ?, zip = ?, is_active = ? WHERE warehouse_id = ?");
    $stmt->bind_param(
        "ssssiii",
        $name,
        sanitize_input($input['address'] ?? null),
        sanitize_input($input['city'] ?? null),
        sanitize_input($input['country'] ?? null),
        filter_var($input['zip'] ?? null, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE),
        filter_var($input['is_active'] ?? 1, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
        $id
    );

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Warehouse updated successfully.']);
    } else {
        error_log("Update warehouse failed: " . $stmt->error);
        sendJsonResponse(['success' => false, 'message' => 'Failed to update warehouse.'], 500);
    }
    $stmt->close();
}

function handleDeleteWarehouse($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = filter_var($input['warehouse_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        sendJsonResponse(['success' => false, 'message' => 'Warehouse ID is required.'], 400);
        return;
    }

    // --- Safety Check: Prevent deletion if locations or inventory exist ---
    $stmt_loc = $conn->prepare("SELECT COUNT(*) as count FROM warehouse_locations WHERE warehouse_id = ?");
    $stmt_loc->bind_param("i", $id);
    $stmt_loc->execute();
    if ($stmt_loc->get_result()->fetch_assoc()['count'] > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Cannot delete warehouse: It still contains locations.'], 409);
        return;
    }
    $stmt_loc->close();

    $stmt_inv = $conn->prepare("SELECT COUNT(*) as count FROM inventory WHERE warehouse_id = ?");
    $stmt_inv->bind_param("i", $id);
    $stmt_inv->execute();
    if ($stmt_inv->get_result()->fetch_assoc()['count'] > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Cannot delete warehouse: It still contains inventory.'], 409);
        return;
    }
    $stmt_inv->close();
    
    // --- Deletion ---
    $stmt = $conn->prepare("DELETE FROM warehouses WHERE warehouse_id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            sendJsonResponse(['success' => true, 'message' => 'Warehouse deleted successfully.']);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Warehouse not found.'], 404);
        }
    } else {
        error_log("Delete warehouse failed: " . $stmt->error);
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete warehouse.'], 500);
    }
    $stmt->close();
}
