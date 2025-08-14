<?php
// api/returns_api.php

/*
-- REQUIRED DATABASE CHANGE --
-- Please run the following SQL query on your database to add the necessary columns for DOT code tracking in returns.

ALTER TABLE `return_items`
ADD COLUMN `expected_dot_code` VARCHAR(4) NULL DEFAULT NULL COMMENT 'The DOT code that was shipped to the customer' AFTER `outbound_item_id`,
ADD COLUMN `received_dot_code` VARCHAR(4) NULL DEFAULT NULL COMMENT 'The DOT code of the actual item received back' AFTER `expected_dot_code`;

*/

// MODIFICATION SUMMARY:
// 1. handleCreateReturn: Now fetches the `dot_code` from the original outbound pick and saves it as `expected_dot_code` when creating a return item.
// 2. handleGetReturns: The detailed view now fetches and returns both `expected_dot_code` and `received_dot_code` for each item.
// 3. handleProcessItem:
//    - Now requires a `received_dot_code` in the input.
//    - Validates that the `received_dot_code` matches the `expected_dot_code`.
//    - Saves the verified `received_dot_code` to the `return_items` table upon processing.
//    - Uses the verified `dot_code` when creating a new inventory record for 'Good' condition items.

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';
require_once __DIR__ . '/../helpers/order_helper.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();
$current_user_id = $_SESSION['user_id'];

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        authorize_user_role(['viewer', 'operator', 'manager']);
        if ($action === 'get_putaway_locations') {
            handleGetPutawayLocations($conn);
        } elseif ($action === 'get_warehouses') {
            handleGetWarehouses($conn);
        } else {
            handleGetReturns($conn, $current_warehouse_id);
        }
        break;
    case 'POST':
        if ($action === 'create_return') {
            authorize_user_role(['operator', 'manager']);
            handleCreateReturn($conn, $current_user_id);
        } 
        elseif ($action === 'process_item') {
            authorize_user_role(['operator', 'manager']);
            handleProcessItem($conn, $current_warehouse_id, $current_user_id);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Invalid POST action'], 400);
        }
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetWarehouses($conn) {
    $stmt = $conn->prepare("SELECT warehouse_id, warehouse_name FROM warehouses WHERE is_active = 1 ORDER BY warehouse_name");
    $stmt->execute();
    $result = $stmt->get_result();
    $warehouses = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $warehouses]);
}

function handleGetPutawayLocations($conn) {
    $warehouse_id_to_use = $_GET['warehouse_id'] ?? get_current_warehouse_id();
    if (!$warehouse_id_to_use) {
        sendJsonResponse(['success' => false, 'message' => 'Warehouse ID not specified or found.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT 
            wl.location_id, wl.location_code, wl.max_capacity_units,
            COALESCE(SUM(i.quantity), 0) AS occupied_capacity
        FROM warehouse_locations wl
        LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
        LEFT JOIN inventory i ON wl.location_id = i.location_id
        WHERE wl.warehouse_id = ? 
          AND wl.is_active = 1 
          AND wl.is_locked = 0
          AND (lt.type_name IS NULL OR lt.type_name NOT IN ('bin', 'shipping_area', 'block_area'))
        GROUP BY wl.location_id, wl.location_code, wl.max_capacity_units
        ORDER BY wl.location_code ASC
    ");
    $stmt->bind_param("i", $warehouse_id_to_use);
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

function calculateExpiryDateForReturn($dot_code, $expiry_years) {
    if (empty($dot_code) || strlen($dot_code) !== 4 || !is_numeric($dot_code) || $expiry_years === null || !is_numeric($expiry_years)) {
        return null;
    }
    $week = (int)substr($dot_code, 0, 2);
    $year = (int)substr($dot_code, 2, 2);
    $full_year = 2000 + $year;
    if ($week < 1 || $week > 53) {
        return null;
    }
    try {
        $manufacture_date = new DateTime();
        $manufacture_date->setISODate($full_year, $week);
        $manufacture_date->add(new DateInterval("P{$expiry_years}Y"));
        return $manufacture_date->format('Y-m-d');
    } catch (Exception $e) {
        return null;
    }
}

function updateOriginalOrderStatusAfterReturn($conn, $order_id, $user_id) {
    $stmt_picked = $conn->prepare("SELECT SUM(picked_quantity) as total_picked FROM outbound_items WHERE order_id = ?");
    $stmt_picked->bind_param("i", $order_id);
    $stmt_picked->execute();
    $total_picked = $stmt_picked->get_result()->fetch_assoc()['total_picked'] ?? 0;
    $stmt_picked->close();

    $stmt_returned = $conn->prepare("
        SELECT SUM(ri.expected_quantity) as total_returned 
        FROM return_items ri
        JOIN returns r ON ri.return_id = r.return_id
        WHERE r.order_id = ? AND r.status != 'Cancelled'
    ");
    $stmt_returned->bind_param("i", $order_id);
    $stmt_returned->execute();
    $total_returned = $stmt_returned->get_result()->fetch_assoc()['total_returned'] ?? 0;
    $stmt_returned->close();

    $new_status = 'Shipped';
    if ($total_returned > 0) {
        $new_status = ($total_returned >= $total_picked) ? 'Returned' : 'Partially Returned';
    }

    $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
    $stmt_update->bind_param("si", $new_status, $order_id);
    $stmt_update->execute();
    $stmt_update->close();

    logOrderHistory($conn, $order_id, $new_status, $user_id, "Order status updated after processing return.");
}

function handleGetReturns($conn, $warehouse_id) {
    if (isset($_GET['return_id'])) {
        $return_id = filter_var($_GET['return_id'], FILTER_VALIDATE_INT);
        if (!$return_id) {
            sendJsonResponse(['success' => false, 'message' => 'Invalid Return ID.'], 400);
            return;
        }

        $stmt = $conn->prepare("SELECT r.*, oo.order_number, c.customer_name 
                                FROM returns r 
                                JOIN outbound_orders oo ON r.order_id = oo.order_id
                                JOIN customers c ON r.customer_id = c.customer_id
                                WHERE r.return_id = ? AND oo.warehouse_id = ?");
        $stmt->bind_param("ii", $return_id, $warehouse_id);
        $stmt->execute();
        $return_details = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$return_details) {
            sendJsonResponse(['success' => false, 'message' => 'Return not found.'], 404);
            return;
        }

        // MODIFICATION: Added expected_dot_code and received_dot_code to the query
        $stmt_items = $conn->prepare("
            SELECT 
                ri.*, 
                p.sku, p.product_name, p.article_no, 
                wl.location_code as putaway_location_code
            FROM return_items ri
            JOIN products p ON ri.product_id = p.product_id
            LEFT JOIN warehouse_locations wl ON ri.putaway_location_id = wl.location_id
            WHERE ri.return_id = ?
        ");
        $stmt_items->bind_param("i", $return_id);
        $stmt_items->execute();
        $items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_items->close();
        
        $stmt_putaways = $conn->prepare("
            SELECT
                i.inventory_id, i.quantity, i.batch_number, i.source_inbound_item_id, wl.location_code
            FROM inventory i
            JOIN warehouse_locations wl ON i.location_id = wl.location_id
            JOIN return_putaway_stickers rps ON i.inventory_id = rps.inventory_id
            WHERE rps.return_id = ?
            GROUP BY i.inventory_id, i.quantity, i.batch_number, i.source_inbound_item_id, wl.location_code
        ");
        $stmt_putaways->bind_param("i", $return_id);
        $stmt_putaways->execute();
        $putaways_flat = $stmt_putaways->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_putaways->close();

        $putaways_grouped = [];
        foreach ($putaways_flat as $putaway) {
            $key = $putaway['source_inbound_item_id'];
            if (!isset($putaways_grouped[$key])) {
                $putaways_grouped[$key] = [];
            }
            $putaways_grouped[$key][] = $putaway;
        }

        foreach ($items as &$item) {
            $key = $item['return_item_id'];
            $item['putaways'] = $putaways_grouped[$key] ?? [];
        }
        unset($item);

        $return_details['items'] = $items;
        sendJsonResponse(['success' => true, 'data' => $return_details]);

    } else {
        $stmt = $conn->prepare("
            SELECT r.return_id, r.return_number, r.reason, r.status, r.created_at, oo.order_number, c.customer_name
            FROM returns r
            JOIN outbound_orders oo ON r.order_id = oo.order_id
            JOIN customers c ON r.customer_id = c.customer_id
            WHERE oo.warehouse_id = ?
            ORDER BY r.created_at DESC
        ");
        $stmt->bind_param("i", $warehouse_id);
        $stmt->execute();
        $returns = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        sendJsonResponse(['success' => true, 'data' => $returns]);
    }
}

function handleCreateReturn($conn, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $reason = sanitize_input($input['reason'] ?? '');
    $items_to_return = $input['items'] ?? [];

    if (!$order_id || empty($reason) || empty($items_to_return)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID, reason, and at least one item are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_order = $conn->prepare("SELECT customer_id, status FROM outbound_orders WHERE order_id = ?");
        $stmt_order->bind_param("i", $order_id);
        $stmt_order->execute();
        $order = $stmt_order->get_result()->fetch_assoc();
        $stmt_order->close();

        if (!$order) throw new Exception("Original order not found.");
        if (!in_array($order['status'], ['Shipped', 'Delivered', 'Partially Returned'])) {
            throw new Exception("Cannot create a return for an order with status '{$order['status']}'.");
        }

        $stmt_return = $conn->prepare("INSERT INTO returns (order_id, customer_id, return_number, reason, created_by) VALUES (?, ?, '', ?, ?)");
        $stmt_return->bind_param("iisi", $order_id, $order['customer_id'], $reason, $user_id);
        $stmt_return->execute();
        $return_id = $stmt_return->insert_id;
        $stmt_return->close();

        $return_number = 'RMA-' . date('Ymd') . '-' . str_pad($return_id, 4, '0', STR_PAD_LEFT);
        $stmt_update_num = $conn->prepare("UPDATE returns SET return_number = ? WHERE return_id = ?");
        $stmt_update_num->bind_param("si", $return_number, $return_id);
        $stmt_update_num->execute();
        $stmt_update_num->close();

        foreach ($items_to_return as $item_data) {
            $outbound_item_id = filter_var($item_data['outbound_item_id'], FILTER_VALIDATE_INT);
            $quantity = filter_var($item_data['quantity'], FILTER_VALIDATE_INT);

            if (!$outbound_item_id || !$quantity || $quantity <= 0) throw new Exception("Invalid data for an item to be returned.");
            
            // Fetch original item details including the DOT code from the pick
            // MODIFICATION: Added oip.dot_code to the check
            $stmt_check = $conn->prepare("
                SELECT
                    oi.product_id,
                    oi.picked_quantity,
                    oip.dot_code,
                    COALESCE(SUM(ri.expected_quantity), 0) AS returned_quantity
                FROM
                    outbound_items oi
                LEFT JOIN
                    outbound_item_picks oip ON oi.outbound_item_id = oip.outbound_item_id
                LEFT JOIN
                    return_items ri ON oi.outbound_item_id = ri.outbound_item_id
                LEFT JOIN
                    returns r ON ri.return_id = r.return_id AND r.status != 'Cancelled'
                WHERE
                    oi.outbound_item_id = ? AND oi.order_id = ?
                GROUP BY
                    oi.outbound_item_id, oi.product_id, oi.picked_quantity, oip.dot_code
                LIMIT 1
            ");
            $stmt_check->bind_param("ii", $outbound_item_id, $order_id);
            $stmt_check->execute();
            $check_result = $stmt_check->get_result()->fetch_assoc();
            $stmt_check->close();

            if (!$check_result) {
                throw new Exception("An item to be returned was not found on the original order pick details.");
            }

            $returnable_quantity = $check_result['picked_quantity'] - $check_result['returned_quantity'];

            if ($quantity > $returnable_quantity) {
                throw new Exception("Return quantity ({$quantity}) for an item exceeds the available returnable quantity ({$returnable_quantity}).");
            }
            
            // MODIFICATION: Added expected_dot_code to the insert statement
            $expected_dot_code = $check_result['dot_code'];
            $stmt_items = $conn->prepare("INSERT INTO return_items (return_id, product_id, outbound_item_id, expected_dot_code, expected_quantity) VALUES (?, ?, ?, ?, ?)");
            $stmt_items->bind_param("iiisi", $return_id, $check_result['product_id'], $outbound_item_id, $expected_dot_code, $quantity);
            $stmt_items->execute();
            $stmt_items->close();
        }

        updateOriginalOrderStatusAfterReturn($conn, $order_id, $user_id);
        logOrderHistory($conn, $order_id, 'Return Initiated', $user_id, "Return created with RMA: $return_number.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Return #$return_number created successfully."], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleProcessItem($conn, $current_warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $return_item_id = filter_var($input['return_item_id'] ?? 0, FILTER_VALIDATE_INT);
    $quantity = filter_var($input['quantity'] ?? 0, FILTER_VALIDATE_INT);
    $condition = sanitize_input($input['condition'] ?? '');
    $location_barcode = sanitize_input($input['location_barcode'] ?? '');
    $putaway_warehouse_id = filter_var($input['putaway_warehouse_id'] ?? $current_warehouse_id, FILTER_VALIDATE_INT);
    // MODIFICATION: Get received_dot_code from input
    $received_dot_code = sanitize_input($input['received_dot_code'] ?? '');
    
    // MODIFICATION: Added validation for received_dot_code
    if (!$return_item_id || $quantity <= 0 || empty($condition) || empty($received_dot_code)) {
        sendJsonResponse(['success' => false, 'message' => 'Item ID, quantity, condition, and received DOT code are required.'], 400);
        return;
    }
    if (strlen($received_dot_code) !== 4 || !is_numeric($received_dot_code)) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid DOT code format. It must be 4 digits (WWYY).'], 400);
        return;
    }
    
    $conn->begin_transaction();
    try {
        // MODIFICATION: No longer need to join to get dot_code, it's now in return_items as expected_dot_code
        $stmt_item = $conn->prepare("
            SELECT 
                ri.*, 
                r.return_id, 
                r.order_id, 
                p.expiry_years
            FROM return_items ri
            JOIN returns r ON ri.return_id = r.return_id
            JOIN products p ON ri.product_id = p.product_id
            WHERE ri.return_item_id = ?
        ");
        $stmt_item->bind_param("i", $return_item_id);
        $stmt_item->execute();
        $item = $stmt_item->get_result()->fetch_assoc();
        $stmt_item->close();

        if (!$item) throw new Exception("Return item not found.");
        
        // MODIFICATION: Validate received DOT code against expected DOT code
        if ($item['expected_dot_code'] !== $received_dot_code) {
            throw new Exception("DOT Code Mismatch. Expected: {$item['expected_dot_code']}, Received: {$received_dot_code}. Cannot process item.");
        }
        
        if (($item['processed_quantity'] + $quantity) > $item['expected_quantity']) {
            throw new Exception("Processing quantity exceeds expected quantity.");
        }

        // MODIFICATION: Use the verified received_dot_code for expiry calculation
        $calculated_expiry_date = calculateExpiryDateForReturn($received_dot_code, $item['expiry_years']);
        $unit_cost = null;
        $new_inventory_id = null;
        $location_id = null; 

        if ($condition === 'Good') {
            if (empty($location_barcode)) throw new Exception("Location barcode is required for 'Good' items.");
            
            $stmt_loc = $conn->prepare("
                SELECT wl.location_id, wl.is_locked 
                FROM warehouse_locations wl
                LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
                WHERE wl.location_code = ? 
                  AND wl.warehouse_id = ? 
                  AND wl.is_active = 1
                  AND (lt.type_name IS NULL OR lt.type_name NOT IN ('bin', 'shipping_area', 'block_area'))
            ");
            $stmt_loc->bind_param("si", $location_barcode, $putaway_warehouse_id);
            $stmt_loc->execute();
            $location_data = $stmt_loc->get_result()->fetch_assoc();
            $stmt_loc->close();
            
            if (!$location_data) throw new Exception("Location '{$location_barcode}' is not a valid putaway location in the selected warehouse.");
            if ($location_data['is_locked'] == 1) {
                throw new Exception("This location is locked. You cannot move items into a locked location.");
            }
            $location_id = $location_data['location_id'];

            $new_batch_number = 'RET-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
            
            // MODIFICATION: Use the verified received_dot_code for the new inventory record
            $stmt_inv_insert = $conn->prepare("
                INSERT INTO inventory (
                    warehouse_id, product_id, source_inbound_item_id, location_id, quantity, 
                    batch_number, expiry_date, dot_code, unit_cost
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt_inv_insert->bind_param("iiiissssd", 
                $putaway_warehouse_id, $item['product_id'], $return_item_id, $location_id, $quantity, 
                $new_batch_number, $calculated_expiry_date, $received_dot_code, $unit_cost
            );

            if (!$stmt_inv_insert->execute()) {
                throw new Exception("Failed to insert new inventory record for return: " . $stmt_inv_insert->error);
            }
            $new_inventory_id = $stmt_inv_insert->insert_id;
            $stmt_inv_insert->close();
            
            $notes = "Stock added from return item ID: {$return_item_id} for Order ID: {$item['order_id']}. Verified DOT: {$received_dot_code}.";
            $stmt_adj = $conn->prepare("INSERT INTO stock_adjustments (product_id, warehouse_id, location_id, user_id, quantity_adjusted, reason_code, notes) VALUES (?, ?, ?, ?, ?, 'Return', ?)");
            $stmt_adj->bind_param("iiiiis", $item['product_id'], $putaway_warehouse_id, $location_id, $user_id, $quantity, $notes);
            $stmt_adj->execute();
            $stmt_adj->close();

            $stmt_sticker = $conn->prepare("INSERT INTO return_putaway_stickers (inventory_id, return_id, unique_barcode) VALUES (?, ?, ?)");
            for ($i = 0; $i < $quantity; $i++) {
                $unique_id = strtoupper(bin2hex(random_bytes(3)));
                // MODIFICATION: Use the verified received_dot_code in the sticker
                $barcode_value = "RET-".($received_dot_code ?? 'NA')."-{$unique_id}";
                $stmt_sticker->bind_param("iis", $new_inventory_id, $item['return_id'], $barcode_value);
                if (!$stmt_sticker->execute()) {
                    throw new Exception("Failed to generate sticker barcode: " . $stmt_sticker->error);
                }
            }
            $stmt_sticker->close();
        }

        // MODIFICATION: Update the received_dot_code field in return_items
        $stmt_update_item = $conn->prepare("UPDATE return_items SET processed_quantity = processed_quantity + ?, `condition` = ?, putaway_location_id = ?, inspected_by = ?, inspected_at = NOW(), received_dot_code = ? WHERE return_item_id = ?");
        $stmt_update_item->bind_param("isiisi", $quantity, $condition, $location_id, $user_id, $received_dot_code, $return_item_id);
        $stmt_update_item->execute();
        $stmt_update_item->close();

        $stmt_check_complete = $conn->prepare("SELECT SUM(expected_quantity) as total_expected, SUM(processed_quantity) as total_processed FROM return_items WHERE return_id = ?");
        $stmt_check_complete->bind_param("i", $item['return_id']);
        $stmt_check_complete->execute();
        $totals = $stmt_check_complete->get_result()->fetch_assoc();
        $stmt_check_complete->close();

        if ($totals['total_processed'] >= $totals['total_expected']) {
            $stmt_complete_return = $conn->prepare("UPDATE returns SET status = 'Completed' WHERE return_id = ?");
            $stmt_complete_return->bind_param("i", $item['return_id']);
            $stmt_complete_return->execute();
            $stmt_complete_return->close();
        } elseif ($totals['total_processed'] > 0) {
            $stmt_processing_return = $conn->prepare("UPDATE returns SET status = 'Processing' WHERE return_id = ? AND status = 'Pending'");
            $stmt_processing_return->bind_param("i", $item['return_id']);
            $stmt_processing_return->execute();
            $stmt_processing_return->close();
        }

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Item processed successfully.', 'inventory_id' => $new_inventory_id]);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}
