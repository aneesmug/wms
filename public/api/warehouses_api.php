<?php
// api/warehouses_api.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(false); // Do not require a warehouse to be selected for this API

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

// A global admin can perform any action. 
if (!isset($_SESSION['is_global_admin']) || !$_SESSION['is_global_admin']) {
    // For other users, restrict CUD operations to managers
    if ($method !== 'GET') { 
        sendJsonResponse(['success' => false, 'message' => 'You do not have permission to manage warehouses.'], 403);
        exit;
    }
}

switch ($method) {
    case 'GET':
        if ($action === 'get_transfer_targets') {
            handleGetTransferTargets($conn);
        } else {
            handleGetWarehouses($conn);
        }
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
    sendJsonResponse(['success' => true, 'data' => $warehouses]);
}

function handleGetTransferTargets($conn) {
    $user_id = $_SESSION['user_id'];
    $is_global_admin = $_SESSION['is_global_admin'] ?? false;
    $current_warehouse_id = get_current_warehouse_id();

    if ($is_global_admin) {
        $sql = "SELECT warehouse_id, warehouse_name FROM warehouses WHERE is_active = TRUE";
        $params = [];
        $types = "";
        if ($current_warehouse_id) {
            $sql .= " AND warehouse_id != ?";
            $params[] = $current_warehouse_id;
            $types .= "i";
        }
    } else {
        $sql = "
            SELECT DISTINCT w.warehouse_id, w.warehouse_name
            FROM warehouses w
            JOIN user_warehouse_roles uwr ON w.warehouse_id = uwr.warehouse_id
            WHERE w.is_active = TRUE 
            AND uwr.user_id = ? 
            AND uwr.role IN ('operator', 'manager')
        ";
        $params = [$user_id];
        $types = "i";

        if ($current_warehouse_id) {
            $sql .= " AND w.warehouse_id != ?";
            $params[] = $current_warehouse_id;
            $types .= "i";
        }
    }
    
    $sql .= " ORDER BY warehouse_name ASC";

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $warehouses = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $warehouses]);
}

function handleCreateWarehouse($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    // MODIFICATION: Add validation for all required fields
    $name = sanitize_input($input['warehouse_name'] ?? '');
    $country = sanitize_input($input['country'] ?? '');
    $zip_input = $input['zip'] ?? ''; // Get as string to check if empty before filtering

    if (empty($name) || empty($country) || $zip_input === '') {
        sendJsonResponse(['success' => false, 'message' => 'Warehouse Name, Country, and ZIP Code are required fields.'], 400);
        return;
    }

    $is_active = isset($input['is_active']) && $input['is_active'] === true ? 1 : 0;
    $zip = filter_var($zip_input, FILTER_VALIDATE_INT);

    $stmt = $conn->prepare("INSERT INTO warehouses (warehouse_name, address, city, country, zip, is_active) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param(
        "ssssii",
        $name,
        sanitize_input($input['address'] ?? null),
        sanitize_input($input['city'] ?? null),
        $country,
        $zip,
        $is_active
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
    
    // MODIFICATION: Add validation for all required fields
    $name = sanitize_input($input['warehouse_name'] ?? '');
    $country = sanitize_input($input['country'] ?? '');
    $zip_input = $input['zip'] ?? ''; // Get as string to check if empty before filtering

    if (empty($name) || empty($country) || $zip_input === '') {
        sendJsonResponse(['success' => false, 'message' => 'Warehouse Name, Country, and ZIP Code are required fields.'], 400);
        return;
    }

    $is_active = isset($input['is_active']) && $input['is_active'] === true ? 1 : 0;
    $zip = filter_var($zip_input, FILTER_VALIDATE_INT);

    $stmt = $conn->prepare("UPDATE warehouses SET warehouse_name = ?, address = ?, city = ?, country = ?, zip = ?, is_active = ? WHERE warehouse_id = ?");
    $stmt->bind_param(
        "ssssiii",
        $name,
        sanitize_input($input['address'] ?? null),
        sanitize_input($input['city'] ?? null),
        $country,
        $zip,
        $is_active,
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
