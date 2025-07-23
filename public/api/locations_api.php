<?php
// api/locations.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null); 

// MODIFICATION: Allow fetching locations for a specified warehouse, not just the current one.
$target_warehouse_id = filter_input(INPUT_GET, 'warehouse_id', FILTER_VALIDATE_INT);
if (!$target_warehouse_id) {
    $target_warehouse_id = get_current_warehouse_id();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // User must have at least 'viewer' role for the target warehouse to see its locations
        authorize_user_role(['viewer', 'operator', 'manager'], $target_warehouse_id);
        handleGetRequest($conn, $target_warehouse_id);
        break;
    case 'POST':
        authorize_user_role(['operator', 'manager'], $target_warehouse_id);
        handleCreateLocation($conn, $target_warehouse_id);
        break;
    case 'PUT':
        authorize_user_role(['operator', 'manager'], $target_warehouse_id);
        handleUpdateLocation($conn, $target_warehouse_id);
        break;
    case 'DELETE':
        authorize_user_role(['manager'], $target_warehouse_id);
        handleDeleteLocation($conn, $target_warehouse_id);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetRequest($conn, $warehouse_id) {
    if (isset($_GET['action']) && $_GET['action'] == 'get_types') {
        $stmt = $conn->prepare("SELECT type_id, type_name FROM location_types WHERE is_active = 1 ORDER BY type_name ASC");
        $stmt->execute();
        $result = $stmt->get_result();
        $types = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        sendJsonResponse(['success' => true, 'data' => $types]);
    } elseif (isset($_GET['id'])) {
        getLocationById($conn, $warehouse_id, $_GET['id']);
    } else {
        getAllLocations($conn, $warehouse_id);
    }
}

function getAllLocations($conn, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT 
            wl.location_id, wl.location_code, lt.type_name as location_type, wl.location_type_id,
            wl.max_capacity_units, wl.max_capacity_weight, wl.max_capacity_volume, 
            wl.is_active, COALESCE(SUM(i.quantity), 0) AS occupied_capacity
        FROM warehouse_locations wl
        LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
        LEFT JOIN inventory i ON wl.location_id = i.location_id AND i.warehouse_id = wl.warehouse_id
        WHERE wl.warehouse_id = ? 
        GROUP BY wl.location_id, lt.type_name
        ORDER BY wl.location_code ASC
    ");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $locations = [];
    while ($row = $result->fetch_assoc()) {
        $max_cap = $row['max_capacity_units'];
        $occupied = $row['occupied_capacity'];
        $row['available_capacity'] = ($max_cap !== null) ? ($max_cap - $occupied) : null;
        $row['is_full'] = ($max_cap !== null && $row['available_capacity'] <= 0);
        $locations[] = $row;
    }
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $locations]);
}

function getLocationById($conn, $warehouse_id, $location_id) {
    $location_id = filter_var($location_id, FILTER_VALIDATE_INT);
    if (!$location_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Location ID provided.'], 400);
    }

    $stmt = $conn->prepare("
        SELECT 
            wl.*, lt.type_name as location_type, COALESCE(SUM(i.quantity), 0) AS occupied_capacity
        FROM warehouse_locations wl
        LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
        LEFT JOIN inventory i ON wl.location_id = i.location_id AND i.warehouse_id = wl.warehouse_id
        WHERE wl.location_id = ? AND wl.warehouse_id = ?
        GROUP BY wl.location_id, lt.type_name
    ");
    $stmt->bind_param("ii", $location_id, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($location = $result->fetch_assoc()) {
        $max_cap = $location['max_capacity_units'];
        $occupied = $location['occupied_capacity'];
        $location['available_capacity'] = ($max_cap !== null) ? ($max_cap - $occupied) : null;
        $location['is_full'] = ($max_cap !== null && $location['available_capacity'] <= 0);
        sendJsonResponse(['success' => true, 'data' => $location]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Location not found or not in selected warehouse'], 404);
    }
    $stmt->close();
}

function handleCreateLocation($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);

    $location_code = sanitize_input($input['location_code'] ?? '');
    if (empty($location_code)) {
        sendJsonResponse(['success' => false, 'message' => 'Location Code is required'], 400);
    }
    
    $location_type_id = filter_var($input['location_type_id'], FILTER_VALIDATE_INT);
    if (!$location_type_id) {
        sendJsonResponse(['success' => false, 'message' => 'A valid Location Type is required.'], 400);
    }

    $max_capacity_units = isset($input['max_capacity_units']) && $input['max_capacity_units'] !== '' ? filter_var($input['max_capacity_units'], FILTER_VALIDATE_INT) : null;
    $max_capacity_weight = isset($input['max_capacity_weight']) && $input['max_capacity_weight'] !== '' ? filter_var($input['max_capacity_weight'], FILTER_VALIDATE_FLOAT, FILTER_FLAG_ALLOW_FRACTION) : null;
    $max_capacity_volume = isset($input['max_capacity_volume']) && $input['max_capacity_volume'] !== '' ? filter_var($input['max_capacity_volume'], FILTER_VALIDATE_FLOAT, FILTER_FLAG_ALLOW_FRACTION) : null;
    $is_active = isset($input['is_active']) ? (bool)$input['is_active'] : true;

    $stmt_check = $conn->prepare("SELECT location_id FROM warehouse_locations WHERE location_code = ? AND warehouse_id = ?");
    $stmt_check->bind_param("si", $location_code, $warehouse_id);
    $stmt_check->execute();
    if ($stmt_check->get_result()->num_rows > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Location Code already exists in this warehouse.'], 409);
        $stmt_check->close();
        return;
    }
    $stmt_check->close();

    $stmt = $conn->prepare("INSERT INTO warehouse_locations (warehouse_id, location_code, location_type_id, max_capacity_units, max_capacity_weight, max_capacity_volume, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("isiiddi", $warehouse_id, $location_code, $location_type_id, $max_capacity_units, $max_capacity_weight, $max_capacity_volume, $is_active);

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Location created successfully', 'location_id' => $stmt->insert_id], 201);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to create location', 'error' => $stmt->error], 500);
    }
    $stmt->close();
}

function handleUpdateLocation($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);

    $location_id = filter_var($input['location_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$location_id) {
        sendJsonResponse(['success' => false, 'message' => 'Location ID is required.'], 400);
    }

    $fields = ['location_code', 'location_type_id', 'max_capacity_units', 'max_capacity_weight', 'max_capacity_volume', 'is_active'];
    $set_clauses = [];
    $bind_params = [];
    $bind_types = "";

    foreach ($fields as $field) {
        if (array_key_exists($field, $input)) {
            $set_clauses[] = "$field = ?";
            $value = $input[$field];
            
            if ($field === 'location_code') {
                $bind_params[] = sanitize_input($value);
                $bind_types .= "s";
            } elseif ($field === 'location_type_id' || $field === 'is_active' || $field === 'max_capacity_units') {
                $bind_params[] = ($value === '' || $value === null) ? null : filter_var($value, FILTER_VALIDATE_INT);
                $bind_types .= "i";
            } else { // weight, volume
                $bind_params[] = ($value === '' || $value === null) ? null : filter_var($value, FILTER_VALIDATE_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
                $bind_types .= "d";
            }
        }
    }

    if (empty($set_clauses)) {
        sendJsonResponse(['success' => true, 'message' => 'No fields provided for update.'], 200);
        return;
    }

    $sql = "UPDATE warehouse_locations SET " . implode(", ", $set_clauses) . " WHERE location_id = ? AND warehouse_id = ?";
    $bind_types .= "ii";
    $bind_params[] = $location_id;
    $bind_params[] = $warehouse_id;

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($bind_types, ...$bind_params);

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Location updated successfully.'], 200);
    } else {
        if ($conn->errno == 1062) {
             sendJsonResponse(['success' => false, 'message' => 'Update failed: This Location Code is already in use.'], 409);
        } else {
             sendJsonResponse(['success' => false, 'message' => 'Failed to update location.', 'error' => $stmt->error], 500);
        }
    }
    $stmt->close();
}

function handleDeleteLocation($conn, $warehouse_id) {
    $location_id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$location_id) {
        sendJsonResponse(['success' => false, 'message' => 'Location ID is required.'], 400);
    }
    
    $stmt_check = $conn->prepare("SELECT COUNT(*) as inventory_count FROM inventory WHERE location_id = ? AND warehouse_id = ?");
    $stmt_check->bind_param("ii", $location_id, $warehouse_id);
    $stmt_check->execute();
    $inventory_count = $stmt_check->get_result()->fetch_assoc()['inventory_count'];
    $stmt_check->close();

    if ($inventory_count > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Cannot delete location: It contains inventory.'], 400);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM warehouse_locations WHERE location_id = ? AND warehouse_id = ?");
    $stmt->bind_param("ii", $location_id, $warehouse_id);

    if ($stmt->execute() && $stmt->affected_rows > 0) {
        sendJsonResponse(['success' => true, 'message' => 'Location deleted successfully'], 200);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete location or not found.'], 500);
    }
    $stmt->close();
}
