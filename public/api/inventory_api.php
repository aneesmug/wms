<?php
// api/inventory.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        authorize_user_role(['viewer', 'operator', 'manager']);
        $action = filter_input(INPUT_GET, 'action', FILTER_SANITIZE_STRING);
        if ($action === 'location_stock') {
            handleGetLocationStock($conn, $current_warehouse_id);
        } else {
            handleGetInventory($conn, $current_warehouse_id);
        }
        break;
    case 'POST':
        authorize_user_role(['operator', 'manager']);
        handleInventoryAdjustment($conn, $current_warehouse_id);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetLocationStock($conn, $warehouse_id) {
    $product_id = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT);
    if (!$product_id) {
        sendJsonResponse(['success' => false, 'message' => 'Product ID is required.'], 400);
        return;
    }

    $sql = "
        SELECT 
            wl.location_id, wl.location_code, wl.max_capacity_units,
            COALESCE(SUM(i.quantity), 0) AS occupied_capacity,
            (wl.max_capacity_units - COALESCE(SUM(i.quantity), 0)) AS available_capacity
        FROM warehouse_locations wl
        LEFT JOIN inventory i ON wl.location_id = i.location_id
        WHERE wl.warehouse_id = ? AND wl.is_active = 1
        GROUP BY wl.location_id, wl.location_code, wl.max_capacity_units
        ORDER BY wl.location_code ASC
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $locations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    foreach ($locations as &$location) {
        if ($location['max_capacity_units'] === null) {
            $location['availability_html'] = '<span class="badge bg-success">Available: &infin;</span>';
        } elseif ((int)$location['available_capacity'] > 0) {
            $location['availability_html'] = '<span class="badge bg-success">Available: ' . $location['available_capacity'] . '</span>';
        } else {
            $location['availability_html'] = '<span class="badge bg-danger">Stock Full</span>';
        }
    }
    unset($location);

    sendJsonResponse(['success' => true, 'data' => $locations]);
}

function handleGetInventory($conn, $warehouse_id) {
    $product_id = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT);
    $location_code = sanitize_input($_GET['location_code'] ?? '');

    // MODIFICATION: Added i.dot_code to the SELECT statement
    $sql = "
        SELECT
            i.inventory_id, i.quantity, i.batch_number, i.expiry_date, i.last_moved_at, i.dot_code,
            p.product_id, p.sku, p.product_name, p.barcode,
            wl.location_id, wl.location_code, wl.location_type
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        WHERE i.warehouse_id = ? AND i.quantity > 0
    ";
    $params = [$warehouse_id];
    $types = "i";

    if ($product_id) { $sql .= " AND i.product_id = ?"; $params[] = $product_id; $types .= "i"; }
    if (!empty($location_code)) { $sql .= " AND wl.location_code = ?"; $params[] = $location_code; $types .= "s"; }
    
    $sql .= " ORDER BY p.product_name, wl.location_code";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $inventory_data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    sendJsonResponse(['success' => true, 'data' => $inventory_data]);
}

function handleInventoryAdjustment($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action_type = sanitize_input($input['action_type'] ?? '');

    if (empty($action_type)) {
        sendJsonResponse(['success' => false, 'message' => "Action type is required."], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $message = '';
        if ($action_type === 'adjust_quantity') {
            adjustInventoryQuantity($conn, $input, $warehouse_id);
            $message = 'Inventory quantity adjusted successfully.';
        } elseif ($action_type === 'transfer') {
            transferInventory($conn, $input, $warehouse_id);
            $message = 'Inventory transferred successfully.';
        } else {
            throw new Exception('Invalid action type provided.');
        }
        
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => $message]);

    } catch (Exception $e) {
        $conn->rollback();
        error_log("Inventory adjustment error: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function adjustInventoryQuantity($conn, $input, $warehouse_id) {
    $product_id = filter_var($input['product_id'] ?? 0, FILTER_VALIDATE_INT);
    $location_barcode = sanitize_input($input['current_location_barcode'] ?? '');
    $quantity_change = filter_var($input['quantity_change'] ?? 0, FILTER_VALIDATE_INT);
    $batch_number = sanitize_input($input['batch_number'] ?? null) ?: null;
    $expiry_date = sanitize_input($input['expiry_date'] ?? null) ?: null;

    if (empty($product_id) || empty($location_barcode) || $quantity_change === false || $quantity_change === 0) {
        throw new Exception("Product, location, and a non-zero quantity are required.");
    }
    
    $location_data = getLocationDataFromBarcode($conn, $location_barcode, $warehouse_id);
    $location_id = $location_data['location_id'];

    if ($quantity_change > 0 && $location_data['max_capacity_units'] !== null) {
        $stmt_total = $conn->prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory WHERE location_id = ?");
        $stmt_total->bind_param("i", $location_id);
        $stmt_total->execute();
        $current_total_qty = $stmt_total->get_result()->fetch_assoc()['total'];
        $stmt_total->close();
        if (($current_total_qty + $quantity_change) > $location_data['max_capacity_units']) {
            throw new Exception("Adding {$quantity_change} units to {$location_barcode} exceeds its capacity of {$location_data['max_capacity_units']}. Current stock: {$current_total_qty}.");
        }
    }

    $stmt_update = $conn->prepare("UPDATE inventory SET quantity = quantity + ?, last_moved_at = CURRENT_TIMESTAMP WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND warehouse_id = ?");
    $stmt_update->bind_param("iisis", $quantity_change, $product_id, $location_id, $batch_number, $warehouse_id);
    $stmt_update->execute();
    $affected_rows = $stmt_update->affected_rows;
    $stmt_update->close();

    if ($affected_rows === 0 && $quantity_change > 0) {
        $stmt_insert = $conn->prepare("INSERT INTO inventory (warehouse_id, product_id, location_id, quantity, batch_number, expiry_date, last_moved_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)");
        $stmt_insert->bind_param("iiiiss", $warehouse_id, $product_id, $location_id, $quantity_change, $batch_number, $expiry_date);
        if (!$stmt_insert->execute()) {
             throw new Exception("Database error during insert.");
        }
        $stmt_insert->close();
    } elseif ($affected_rows === 0 && $quantity_change < 0) {
        throw new Exception("Insufficient stock. The specified item batch was not found at this location.");
    }
    
    $stmt_cleanup = $conn->prepare("DELETE FROM inventory WHERE quantity <= 0");
    $stmt_cleanup->execute();
    $stmt_cleanup->close();
}

function transferInventory($conn, $input, $warehouse_id) {
    $product_id = filter_var($input['product_id'] ?? 0, FILTER_VALIDATE_INT);
    $from_location_barcode = sanitize_input($input['current_location_barcode'] ?? '');
    $to_location_barcode = sanitize_input($input['new_location_barcode'] ?? '');
    $quantity = filter_var($input['quantity_change'] ?? 0, FILTER_VALIDATE_INT);
    $batch_number = sanitize_input($input['batch_number'] ?? null) ?: null;

    if (empty($from_location_barcode) || empty($to_location_barcode) || $quantity <= 0) {
        throw new Exception("From/to locations and a positive quantity are required for transfer.");
    }
    if ($from_location_barcode === $to_location_barcode) {
        throw new Exception("Cannot transfer to the same location.");
    }

    $from_location_id = getLocationDataFromBarcode($conn, $from_location_barcode, $warehouse_id)['location_id'];
    
    $stmt_find = $conn->prepare("SELECT expiry_date, quantity FROM inventory WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND warehouse_id = ?");
    $stmt_find->bind_param("iisi", $product_id, $from_location_id, $batch_number, $warehouse_id);
    $stmt_find->execute();
    $source_item = $stmt_find->get_result()->fetch_assoc();
    $stmt_find->close();

    if (!$source_item || $source_item['quantity'] < $quantity) {
        throw new Exception("Insufficient stock for this batch to perform transfer. Available: " . ($source_item['quantity'] ?? 0));
    }

    // Decrement from source location
    adjustInventoryQuantity($conn, [
        'product_id' => $product_id,
        'current_location_barcode' => $from_location_barcode,
        'quantity_change' => -$quantity,
        'batch_number' => $batch_number
    ], $warehouse_id);

    // Increment at destination location
    adjustInventoryQuantity($conn, [
        'product_id' => $product_id,
        'current_location_barcode' => $to_location_barcode,
        'quantity_change' => $quantity,
        'batch_number' => $batch_number,
        'expiry_date' => $source_item['expiry_date']
    ], $warehouse_id);
}

function getProductIdFromBarcode($conn, $barcode) {
    $stmt = $conn->prepare("SELECT product_id FROM products WHERE barcode = ?");
    $stmt->bind_param("s", $barcode);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$result) throw new Exception("Product not found with barcode: {$barcode}");
    return $result['product_id'];
}

function getLocationDataFromBarcode($conn, $location_code, $warehouse_id) {
    $stmt = $conn->prepare("SELECT location_id, max_capacity_units FROM warehouse_locations WHERE location_code = ? AND warehouse_id = ? AND is_active = 1");
    $stmt->bind_param("si", $location_code, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$result) throw new Exception("Active location '{$location_code}' not found in this warehouse.");
    return $result;
}
