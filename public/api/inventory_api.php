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
        authorize_user_role(['picker', 'viewer', 'operator', 'manager']);
        $action = filter_input(INPUT_GET, 'action', FILTER_SANITIZE_STRING);
        if ($action === 'location_stock') {
            $warehouse_id_for_stock = filter_input(INPUT_GET, 'warehouse_id', FILTER_VALIDATE_INT) ?: $current_warehouse_id;
            handleGetLocationStock($conn, $warehouse_id_for_stock);
        } else {
            handleGetInventory($conn, $current_warehouse_id);
        }
        break;
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $action_type = sanitize_input($input['action_type'] ?? '');

        if ($action_type === 'transfer_inter_warehouse') {
            authorize_user_role(['manager']);
            handleInterWarehouseTransfer($conn, $input, $current_warehouse_id);
        } else {
            authorize_user_role(['manager']);
            handleInventoryAdjustment($conn, $input, $current_warehouse_id);
        }
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function calculateExpiryDate($dot_code, $expiry_years) {
    if (empty($dot_code) || strlen($dot_code) !== 4 || !is_numeric($dot_code) || $expiry_years === null || !is_numeric($expiry_years)) {
        return null;
    }
    $week = (int)substr($dot_code, 0, 2);
    $year = (int)substr($dot_code, 2, 2);
    $full_year = 2000 + $year;
    if ($week < 1 || $week > 53) return null;
    $manufacture_date = new DateTime();
    $manufacture_date->setISODate($full_year, $week);
    $manufacture_date->add(new DateInterval("P{$expiry_years}Y"));
    return $manufacture_date->format('Y-m-d');
}

function handleGetLocationStock($conn, $warehouse_id) {
    // The product_id is required by the front-end to initiate the call, but is not used in the query
    // to ensure we get the total capacity of the location, matching the location management page.
    $product_id = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT);
    if (!$product_id) {
        sendJsonResponse(['success' => false, 'message' => 'Product ID is required to check location stock.'], 400);
        return;
    }

    // BUG FIX #2: This query now uses a subquery to get the total occupied capacity
    // of ALL products in a location, which matches the location management screen logic.
    $sql = "
        SELECT 
            wl.location_id, wl.location_code, wl.max_capacity_units,
            (SELECT COALESCE(SUM(inv.quantity), 0) FROM inventory inv WHERE inv.location_id = wl.location_id) AS occupied_capacity
        FROM warehouse_locations wl
        WHERE wl.warehouse_id = ? AND wl.is_active = 1
        ORDER BY wl.location_code ASC
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $locations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($locations as &$location) {
        $max_cap = $location['max_capacity_units'];
        $occupied = $location['occupied_capacity'];
        $available_capacity = ($max_cap !== null) ? ($max_cap - $occupied) : null;
        $location['available_capacity'] = $available_capacity;

        if ($max_cap === null) {
            $location['availability_html'] = '<span class="badge bg-success">Available: &infin;</span>';
        } elseif ($available_capacity > 0) {
            $location['availability_html'] = '<span class="badge bg-success">Available: ' . $available_capacity . '</span>';
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
    $sql = "
        SELECT
            i.inventory_id, i.quantity, i.batch_number, i.dot_code, i.last_moved_at,
            i.product_id, 
            p.sku, p.product_name, p.barcode, p.expiry_years,
            wl.location_id, wl.location_code, wl.location_type
        FROM inventory i
        LEFT JOIN products p ON i.product_id = p.product_id
        LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
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
    foreach ($inventory_data as &$item) {
        $item['calculated_expiry_date'] = calculateExpiryDate($item['dot_code'], $item['expiry_years']);
    }
    unset($item);
    sendJsonResponse(['success' => true, 'data' => $inventory_data]);
}

function handleInventoryAdjustment($conn, $input, $warehouse_id) {
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
    $dot_code = sanitize_input($input['dot_code'] ?? null) ?: null;

    if (empty($product_id) || empty($location_barcode) || $quantity_change === 0) {
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
            throw new Exception("Adding {$quantity_change} units to {$location_barcode} exceeds its total capacity of {$location_data['max_capacity_units']}. Current stock: {$current_total_qty}.");
        }
    }

    $stmt_update = $conn->prepare("UPDATE inventory SET quantity = quantity + ?, last_moved_at = CURRENT_TIMESTAMP WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code <=> ? AND warehouse_id = ?");
    $stmt_update->bind_param("iisssi", $quantity_change, $product_id, $location_id, $batch_number, $dot_code, $warehouse_id);
    $stmt_update->execute();
    $affected_rows = $stmt_update->affected_rows;
    $stmt_update->close();

    if ($affected_rows === 0 && $quantity_change > 0) {
        $stmt_insert = $conn->prepare("INSERT INTO inventory (warehouse_id, product_id, location_id, quantity, batch_number, dot_code, last_moved_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)");
        $stmt_insert->bind_param("iiiiss", $warehouse_id, $product_id, $location_id, $quantity_change, $batch_number, $dot_code);
        if (!$stmt_insert->execute()) {
             throw new Exception("Database error during insert.");
        }
        $stmt_insert->close();
    } elseif ($affected_rows === 0 && $quantity_change < 0) {
        throw new Exception("Insufficient stock. The specified item batch/DOT was not found at this location.");
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
    $dot_code = sanitize_input($input['dot_code'] ?? null) ?: null;

    if (empty($from_location_barcode) || empty($to_location_barcode) || $quantity <= 0) {
        throw new Exception("From/to locations and a positive quantity are required for transfer.");
    }
    if ($from_location_barcode === $to_location_barcode) {
        throw new Exception("Cannot transfer to the same location.");
    }

    $from_location_id = getLocationDataFromBarcode($conn, $from_location_barcode, $warehouse_id)['location_id'];
    
    $stmt_find = $conn->prepare("SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code <=> ? AND warehouse_id = ?");
    $stmt_find->bind_param("iissi", $product_id, $from_location_id, $batch_number, $dot_code, $warehouse_id);
    $stmt_find->execute();
    $source_item = $stmt_find->get_result()->fetch_assoc();
    $stmt_find->close();

    if (!$source_item || $source_item['quantity'] < $quantity) {
        throw new Exception("Insufficient stock for this batch/DOT to perform transfer. Available: " . ($source_item['quantity'] ?? 0));
    }

    adjustInventoryQuantity($conn, ['product_id' => $product_id, 'current_location_barcode' => $from_location_barcode, 'quantity_change' => -$quantity, 'batch_number' => $batch_number, 'dot_code' => $dot_code], $warehouse_id);
    adjustInventoryQuantity($conn, ['product_id' => $product_id, 'current_location_barcode' => $to_location_barcode, 'quantity_change' => $quantity, 'batch_number' => $batch_number, 'dot_code' => $dot_code], $warehouse_id);
}

function handleInterWarehouseTransfer($conn, $input, $from_warehouse_id) {
    $to_warehouse_id = filter_var($input['to_warehouse_id'] ?? 0, FILTER_VALIDATE_INT);
    $quantity = filter_var($input['quantity_change'] ?? 0, FILTER_VALIDATE_INT);

    if (empty($to_warehouse_id) || empty($from_warehouse_id) || $quantity <= 0) {
        sendJsonResponse(['success' => false, 'message' => 'Source warehouse, destination warehouse, and a positive quantity are required.'], 400);
        return;
    }
    if ($from_warehouse_id == $to_warehouse_id) {
        sendJsonResponse(['success' => false, 'message' => 'Source and destination warehouses cannot be the same.'], 400);
        return;
    }

    if (!check_user_role_for_warehouse($conn, $_SESSION['user_id'], $to_warehouse_id, ['manager'])) {
        sendJsonResponse(['success' => false, 'message' => 'You do not have permission to transfer stock to the destination warehouse.'], 403);
        return;
    }

    $conn->begin_transaction();
    try {
        // BUG FIX #1: Create a separate input for the source to make the quantity negative.
        $source_input = $input;
        $source_input['quantity_change'] = -$quantity; // This correctly subtracts from the source.
        adjustInventoryQuantity($conn, $source_input, $from_warehouse_id);
        
        $destination_input = $input;
        $destination_input['current_location_barcode'] = $input['new_location_barcode'];
        adjustInventoryQuantity($conn, $destination_input, $to_warehouse_id);

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Stock successfully transferred between warehouses.']);

    } catch (Exception $e) {
        $conn->rollback();
        error_log("Inter-warehouse transfer error: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function getLocationDataFromBarcode($conn, $location_code, $warehouse_id) {
    $stmt = $conn->prepare("SELECT location_id, max_capacity_units FROM warehouse_locations WHERE location_code = ? AND warehouse_id = ? AND is_active = 1");
    $stmt->bind_param("si", $location_code, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$result) throw new Exception("Active location '{$location_code}' not found in warehouse ID {$warehouse_id}.");
    return $result;
}
