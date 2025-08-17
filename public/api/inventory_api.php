<?php
// api/inventory_api.php
// MODIFICATION SUMMARY:
// 1. Added a `calculateExpiryDate` helper function (from inbound_api.php) to calculate expiry dates from DOT codes.
// 2. Modified `adjustInventoryQuantity` to handle sticker generation when stock is added.
//    - It now reliably gets the `inventory_id` for both new and existing stock.
//    - It calculates and saves the `expiry_date` for new stock.
//    - It programmatically finds or creates a "System Internal" supplier and a daily "MANUAL-YYYYMMDD" receipt to associate with the stock, which is required for sticker generation.
//    - It generates sticker data in the `inbound_putaway_stickers` table for each unit added.
//    - It returns the `inventory_id` of the affected stock.
// 3. Updated `handleInventoryAdjustment` to include the new `inventory_id` in the API response, allowing the frontend to trigger the print dialog.

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();
$current_user_id = $_SESSION['user_id'];

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        authorize_user_role(['picker','viewer', 'operator', 'manager']);
        $action = filter_input(INPUT_GET, 'action', FILTER_SANITIZE_STRING);
        if ($action === 'location_stock') {
            $warehouse_id_for_stock = filter_input(INPUT_GET, 'warehouse_id', FILTER_VALIDATE_INT) ?: $current_warehouse_id;
            handleGetLocationStock($conn, $warehouse_id_for_stock);
        } else {
            handleGetInventory($conn, $current_warehouse_id);
        }
        break;
    case 'POST':
        authorize_user_role(['manager']);
        $input = json_decode(file_get_contents('php://input'), true);
        handleInventoryAdjustment($conn, $input, $current_warehouse_id, $current_user_id);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function checkLocationLock($conn, $location_code, $warehouse_id) {
    $stmt = $conn->prepare("SELECT is_locked FROM warehouse_locations WHERE location_code = ? AND warehouse_id = ?");
    $stmt->bind_param("si", $location_code, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($result && $result['is_locked'] == 1) {
        throw new Exception("Operation failed: Location '{$location_code}' is locked and cannot be modified.");
    }
}


function calculateExpiryDate($dot_code, $expiry_years) {
    if (empty($dot_code) || strlen($dot_code) !== 4 || !is_numeric($dot_code) || $expiry_years === null || !is_numeric($expiry_years)) { return null; }
    $week = (int)substr($dot_code, 0, 2);
    $year = (int)substr($dot_code, 2, 2);
    $full_year = 2000 + $year;
    if ($week < 1 || $week > 53) return null;
    try {
        $manufacture_date = new DateTime();
        $manufacture_date->setISODate($full_year, $week);
        $manufacture_date->add(new DateInterval("P{$expiry_years}Y"));
        return $manufacture_date->format('Y-m-d');
    } catch (Exception $e) {
        return null;
    }
}

// MODIFICATION: This function now sends raw capacity data for the frontend to interpret.
function handleGetLocationStock($conn, $warehouse_id) {
    $sql = "
        SELECT 
            wl.location_id, wl.location_code, wl.max_capacity_units, lt.type_name,
            (SELECT COALESCE(SUM(inv.quantity), 0) FROM inventory inv WHERE inv.location_id = wl.location_id) AS occupied_capacity
        FROM warehouse_locations wl
        LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
        WHERE wl.warehouse_id = ? 
          AND wl.is_active = 1
          AND wl.is_locked = 0
          AND (lt.type_name IS NULL OR lt.type_name NOT IN ('shipping_area', 'staging_area', 'shipping_bay'))
        ORDER BY wl.location_code ASC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $locations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($locations as &$location) {
        $max_cap = $location['max_capacity_units'];
        // If max_capacity_units is NULL, available_capacity is also NULL (unknown/infinite).
        if ($max_cap === null) {
            $location['available_capacity'] = null;
        } else {
            $occupied = (int)$location['occupied_capacity'];
            $location['available_capacity'] = (int)$max_cap - $occupied;
        }
    }
    unset($location);
    sendJsonResponse(['success' => true, 'data' => $locations]);
}

function handleGetInventory($conn, $warehouse_id) {
    $product_id = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT);
    $location_code = sanitize_input($_GET['location_code'] ?? '');
    $tire_type_id = filter_input(INPUT_GET, 'tire_type_id', FILTER_VALIDATE_INT);

    $sql = "
        SELECT
            p.product_id, p.sku, p.product_name, p.article_no, p.expiry_years, p.tire_type_id, p.is_active,
            i.inventory_id, COALESCE(i.quantity, 0) AS quantity, i.batch_number, i.dot_code, i.last_moved_at,
            wl.location_id, wl.location_code, lt.type_name AS location_type
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id AND i.warehouse_id = ?
        LEFT JOIN warehouse_locations wl ON i.location_id = wl.location_id
        LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
        WHERE p.is_active = 1
    ";
    
    $params = [$warehouse_id];
    $types = "i";

    if ($product_id) { 
        $sql .= " AND p.product_id = ?"; 
        $params[] = $product_id; 
        $types .= "i"; 
    }
    if ($tire_type_id) { 
        $sql .= " AND p.tire_type_id = ?"; 
        $params[] = $tire_type_id; 
        $types .= "i"; 
    }

    if (!empty($location_code)) { 
        $sql .= " AND wl.location_code = ?"; 
        $params[] = $location_code; 
        $types .= "s"; 
    }
    
    $sql .= " ORDER BY p.product_name, wl.location_code";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $inventory_data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    foreach ($inventory_data as &$item) {
        $item['calculated_expiry_date'] = null;
        if (!empty($item['dot_code'])) {
            $item['calculated_expiry_date'] = calculateExpiryDate($item['dot_code'], $item['expiry_years']);
        }
    }
    unset($item);
    
    sendJsonResponse(['success' => true, 'data' => $inventory_data]);
}


function handleInventoryAdjustment($conn, $input, $warehouse_id, $user_id) {
    $action_type = sanitize_input($input['action_type'] ?? '');
    if (empty($action_type)) {
        sendJsonResponse(['success' => false, 'message' => "Action type is required."], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $message = '';
        $inventory_id = null;
        if ($action_type === 'adjust_quantity') {
            checkLocationLock($conn, $input['current_location_article_no'], $warehouse_id);
            $inventory_id = adjustInventoryQuantity($conn, $input, $warehouse_id, $user_id);
            $message = 'Inventory quantity adjusted successfully.';
        } elseif ($action_type === 'transfer' || $action_type === 'block_item') {
            checkLocationLock($conn, $input['current_location_article_no'], $warehouse_id);
            checkLocationLock($conn, $input['new_location_article_no'], $warehouse_id);
            
            if ($action_type === 'block_item') {
                $to_location_article_no = sanitize_input($input['new_location_article_no'] ?? '');
                $dest_location_type = getLocationTypeByCode($conn, $to_location_article_no, $warehouse_id);

                if ($dest_location_type !== 'block_area') {
                    throw new Exception("The destination location is not a designated 'block_area'.");
                }
            }
            
            transferInventory($conn, $input, $warehouse_id, $user_id);
            
            if ($action_type === 'block_item') {
                $message = 'Item has been blocked and moved successfully.';
            } else {
                 $message = 'Inventory transferred successfully.';
            }
        } else {
            throw new Exception('Invalid action type provided.');
        }
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => $message, 'inventory_id' => $inventory_id]);
    } catch (Exception $e) {
        $conn->rollback();
        error_log("Inventory adjustment error: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}


function adjustInventoryQuantity($conn, $input, $warehouse_id, $user_id) {
    $product_id = filter_var($input['product_id'] ?? 0, FILTER_VALIDATE_INT);
    $location_article_no = sanitize_input($input['current_location_article_no'] ?? '');
    $quantity_change = filter_var($input['quantity_change'] ?? 0, FILTER_VALIDATE_INT);
    $batch_number = sanitize_input($input['batch_number'] ?? null) ?: null;
    $dot_code = sanitize_input($input['dot_code'] ?? null) ?: null;

    if (empty($product_id) || empty($location_article_no) || $quantity_change === 0) {
        throw new Exception("Product, location, and a non-zero quantity are required.");
    }
    
    $location_data = getLocationDataFromarticle_no($conn, $location_article_no, $warehouse_id);
    $location_id = $location_data['location_id'];

    if ($quantity_change > 0 && $location_data['max_capacity_units'] !== null) {
        $stmt_total = $conn->prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory WHERE location_id = ?");
        $stmt_total->bind_param("i", $location_id);
        $stmt_total->execute();
        $current_total_qty = $stmt_total->get_result()->fetch_assoc()['total'];
        $stmt_total->close();
        if (($current_total_qty + $quantity_change) > $location_data['max_capacity_units']) {
            throw new Exception("Adding {$quantity_change} units to {$location_article_no} exceeds its total capacity of {$location_data['max_capacity_units']}. Current stock: {$current_total_qty}.");
        }
    }

    $inventory_id = null;

    // Find existing inventory item
    $stmt_find = $conn->prepare("SELECT inventory_id, quantity FROM inventory WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code <=> ? AND warehouse_id = ?");
    $stmt_find->bind_param("iissi", $product_id, $location_id, $batch_number, $dot_code, $warehouse_id);
    $stmt_find->execute();
    $existing_item = $stmt_find->get_result()->fetch_assoc();
    $stmt_find->close();

    if ($existing_item) {
        $inventory_id = $existing_item['inventory_id'];
        if ($quantity_change < 0 && $existing_item['quantity'] < abs($quantity_change)) {
            throw new Exception("Insufficient stock. The specified item batch/DOT has only {$existing_item['quantity']} units at this location.");
        }
        $stmt_update = $conn->prepare("UPDATE inventory SET quantity = quantity + ?, last_moved_at = CURRENT_TIMESTAMP WHERE inventory_id = ?");
        $stmt_update->bind_param("ii", $quantity_change, $inventory_id);
        $stmt_update->execute();
        $stmt_update->close();
    } else if ($quantity_change > 0) {
        if (empty($batch_number)) {
            $batch_number = 'INV-' . strtoupper(bin2hex(random_bytes(4)));
        }

        $stmt_prod = $conn->prepare("SELECT expiry_years FROM products WHERE product_id = ?");
        $stmt_prod->bind_param("i", $product_id);
        $stmt_prod->execute();
        $product_data = $stmt_prod->get_result()->fetch_assoc();
        $stmt_prod->close();
        $expiry_years = $product_data['expiry_years'] ?? 2;
        $expiry_date = calculateExpiryDate($dot_code, $expiry_years);

        $stmt_insert = $conn->prepare("INSERT INTO inventory (warehouse_id, product_id, location_id, quantity, batch_number, dot_code, expiry_date, last_moved_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)");
        $stmt_insert->bind_param("iiiisss", $warehouse_id, $product_id, $location_id, $quantity_change, $batch_number, $dot_code, $expiry_date);
        if (!$stmt_insert->execute()) {
             throw new Exception("Database error during insert.");
        }
        $inventory_id = $stmt_insert->insert_id;
        $stmt_insert->close();
    } else { // $quantity_change < 0 and no item found
        throw new Exception("Insufficient stock. The specified item batch/DOT was not found at this location.");
    }

    // Sticker Generation for positive quantity changes
    if ($inventory_id && $quantity_change > 0) {
        // Find or create a "System Internal" supplier
        $stmt_supplier = $conn->prepare("SELECT supplier_id FROM suppliers WHERE supplier_name = 'System Internal'");
        $stmt_supplier->execute();
        $supplier_res = $stmt_supplier->get_result()->fetch_assoc();
        $stmt_supplier->close();
        if ($supplier_res) {
            $system_supplier_id = $supplier_res['supplier_id'];
        } else {
            $stmt_insert_supplier = $conn->prepare("INSERT INTO suppliers (supplier_name, is_active) VALUES ('System Internal', 1)");
            $stmt_insert_supplier->execute();
            $system_supplier_id = $stmt_insert_supplier->insert_id;
            $stmt_insert_supplier->close();
        }

        // Find or create a daily manual receipt
        $receipt_number = 'MANUAL-' . date('Ymd');
        $stmt_receipt = $conn->prepare("SELECT receipt_id FROM inbound_receipts WHERE receipt_number = ? AND warehouse_id = ?");
        $stmt_receipt->bind_param("si", $receipt_number, $warehouse_id);
        $stmt_receipt->execute();
        $receipt_res = $stmt_receipt->get_result()->fetch_assoc();
        $stmt_receipt->close();
        if ($receipt_res) {
            $manual_receipt_id = $receipt_res['receipt_id'];
        } else {
            $stmt_insert_receipt = $conn->prepare("INSERT INTO inbound_receipts (warehouse_id, receipt_number, supplier_id, status, received_by, actual_arrival_date) VALUES (?, ?, ?, 'Completed', ?, NOW())");
            $stmt_insert_receipt->bind_param("isii", $warehouse_id, $receipt_number, $system_supplier_id, $user_id);
            $stmt_insert_receipt->execute();
            $manual_receipt_id = $stmt_insert_receipt->insert_id;
            $stmt_insert_receipt->close();
        }
        
        // Update inventory record with the receipt_id
        $stmt_update_inv_receipt = $conn->prepare("UPDATE inventory SET receipt_id = ? WHERE inventory_id = ?");
        $stmt_update_inv_receipt->bind_param("ii", $manual_receipt_id, $inventory_id);
        $stmt_update_inv_receipt->execute();
        $stmt_update_inv_receipt->close();

        // Generate sticker records
        $stmt_sticker = $conn->prepare("INSERT INTO inbound_putaway_stickers (inventory_id, receipt_id, unique_barcode) VALUES (?, ?, ?)");
        for ($i = 0; $i < $quantity_change; $i++) {
            $unique_id = strtoupper(bin2hex(random_bytes(3)));
            $barcode = "MAN-{$dot_code}-{$unique_id}";
            $stmt_sticker->bind_param("iis", $inventory_id, $manual_receipt_id, $barcode);
            if (!$stmt_sticker->execute()) { throw new Exception("Failed to generate sticker barcode: " . $stmt_sticker->error); }
        }
        $stmt_sticker->close();
    }

    $reason_code = $quantity_change > 0 ? 'Manual Add' : 'Manual Remove';
    $notes = "Manual adjustment of {$quantity_change} units for product ID {$product_id} at location {$location_article_no}.";
    $stmt_adj = $conn->prepare("INSERT INTO stock_adjustments (product_id, warehouse_id, location_id, user_id, quantity_adjusted, reason_code, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt_adj->bind_param("iiiiiss", $product_id, $warehouse_id, $location_id, $user_id, $quantity_change, $reason_code, $notes);
    $stmt_adj->execute();
    $stmt_adj->close();

    $stmt_cleanup = $conn->prepare("DELETE FROM inventory WHERE quantity <= 0");
    $stmt_cleanup->execute();
    $stmt_cleanup->close();

    return $inventory_id;
}

function transferInventory($conn, $input, $warehouse_id, $user_id) {
    $product_id = filter_var($input['product_id'] ?? 0, FILTER_VALIDATE_INT);
    $from_location_article_no = sanitize_input($input['current_location_article_no'] ?? '');
    $to_location_article_no = sanitize_input($input['new_location_article_no'] ?? '');
    $quantity = filter_var($input['quantity_change'] ?? 0, FILTER_VALIDATE_INT);
    $batch_number = sanitize_input($input['batch_number'] ?? null) ?: null;
    $dot_code = sanitize_input($input['dot_code'] ?? null) ?: null;

    if (empty($from_location_article_no) || empty($to_location_article_no) || $quantity <= 0) {
        throw new Exception("From/to locations and a positive quantity are required for transfer.");
    }
    if ($from_location_article_no === $to_location_article_no) {
        throw new Exception("Cannot transfer to the same location.");
    }

    $from_location_id = getLocationDataFromarticle_no($conn, $from_location_article_no, $warehouse_id)['location_id'];
    
    $stmt_find = $conn->prepare("SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code <=> ? AND warehouse_id = ?");
    $stmt_find->bind_param("iissi", $product_id, $from_location_id, $batch_number, $dot_code, $warehouse_id);
    $stmt_find->execute();
    $source_item = $stmt_find->get_result()->fetch_assoc();
    $stmt_find->close();

    if (!$source_item || $source_item['quantity'] < $quantity) {
        throw new Exception("Insufficient stock for this batch/DOT to perform transfer. Available: " . ($source_item['quantity'] ?? 0));
    }

    adjustInventoryQuantity($conn, ['product_id' => $product_id, 'current_location_article_no' => $from_location_article_no, 'quantity_change' => -$quantity, 'batch_number' => $batch_number, 'dot_code' => $dot_code], $warehouse_id, $user_id);
    adjustInventoryQuantity($conn, ['product_id' => $product_id, 'current_location_article_no' => $to_location_article_no, 'quantity_change' => $quantity, 'batch_number' => $batch_number, 'dot_code' => $dot_code], $warehouse_id, $user_id);
}

function getLocationDataFromarticle_no($conn, $location_code, $warehouse_id) {
    $stmt = $conn->prepare("SELECT location_id, max_capacity_units FROM warehouse_locations WHERE location_code = ? AND warehouse_id = ? AND is_active = 1");
    $stmt->bind_param("si", $location_code, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$result) throw new Exception("Active location '{$location_code}' not found in warehouse ID {$warehouse_id}.");
    return $result;
}

function getLocationTypeByCode($conn, $location_code, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT lt.type_name 
        FROM warehouse_locations wl
        LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
        WHERE wl.location_code = ? AND wl.warehouse_id = ?
    ");
    $stmt->bind_param("si", $location_code, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $result ? $result['type_name'] : null;
}
