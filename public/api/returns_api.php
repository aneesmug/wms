<?php
// api/returns_api.php
// MODIFICATION SUMMARY:
// 1. Added a new 'get_warehouses' action to fetch all active warehouses.
// 2. Modified 'get_putaway_locations' to fetch locations for a specific warehouse ID passed as a parameter, defaulting to the current session's warehouse if not provided.
// 3. Updated 'process_item' to accept a 'putaway_warehouse_id' and use it for location validation and inventory creation, allowing items to be put away in different warehouses.

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
            // MODIFICATION: No longer pass $current_warehouse_id directly
            handleGetPutawayLocations($conn);
        } elseif ($action === 'get_warehouses') {
            // MODIFICATION: Added new action to get all warehouses
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
            // MODIFICATION: Pass current_warehouse_id for context, but the function will use the one from the payload.
            handleProcessItem($conn, $current_warehouse_id, $current_user_id);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Invalid POST action'], 400);
        }
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

// MODIFICATION: New function to get all active warehouses
function handleGetWarehouses($conn) {
    $stmt = $conn->prepare("SELECT warehouse_id, warehouse_name FROM warehouses WHERE is_active = 1 ORDER BY warehouse_name");
    $stmt->execute();
    $result = $stmt->get_result();
    $warehouses = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $warehouses]);
}


// MODIFICATION: Function now gets warehouse_id from GET param
function handleGetPutawayLocations($conn) {
    // If warehouse_id is provided in the request, use it. Otherwise, default to the user's current warehouse.
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

        $stmt_items = $conn->prepare("
            SELECT ri.*, p.sku, p.product_name, p.article_no, wl.location_code as putaway_location_code
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
            
            $stmt_check = $conn->prepare("
                SELECT
                    oi.product_id,
                    oi.picked_quantity,
                    COALESCE(SUM(ri.expected_quantity), 0) AS returned_quantity
                FROM
                    outbound_items oi
                LEFT JOIN
                    return_items ri ON oi.outbound_item_id = ri.outbound_item_id
                LEFT JOIN
                    returns r ON ri.return_id = r.return_id AND r.status != 'Cancelled'
                WHERE
                    oi.outbound_item_id = ? AND oi.order_id = ?
                GROUP BY
                    oi.outbound_item_id, oi.product_id, oi.picked_quantity
            ");
            $stmt_check->bind_param("ii", $outbound_item_id, $order_id);
            $stmt_check->execute();
            $check_result = $stmt_check->get_result()->fetch_assoc();
            $stmt_check->close();

            if (!$check_result) {
                throw new Exception("An item to be returned was not found on the original order.");
            }

            $returnable_quantity = $check_result['picked_quantity'] - $check_result['returned_quantity'];

            if ($quantity > $returnable_quantity) {
                throw new Exception("Return quantity ({$quantity}) for an item exceeds the available returnable quantity ({$returnable_quantity}).");
            }

            $stmt_items = $conn->prepare("INSERT INTO return_items (return_id, product_id, outbound_item_id, expected_quantity) VALUES (?, ?, ?, ?)");
            $stmt_items->bind_param("iiii", $return_id, $check_result['product_id'], $outbound_item_id, $quantity);
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
    // MODIFICATION: Get the target warehouse ID from the request. Default to the current warehouse if not provided.
    $putaway_warehouse_id = filter_var($input['putaway_warehouse_id'] ?? $current_warehouse_id, FILTER_VALIDATE_INT);
    
    if (!$return_item_id || $quantity <= 0 || empty($condition)) {
        sendJsonResponse(['success' => false, 'message' => 'Item ID, quantity, and condition are required.'], 400);
        return;
    }
    
    $conn->begin_transaction();
    try {
        $stmt_item = $conn->prepare("
            SELECT 
                ri.*, 
                r.return_id, 
                r.order_id, 
                p.expiry_years,
                (SELECT oip.dot_code FROM outbound_item_picks oip WHERE oip.outbound_item_id = ri.outbound_item_id LIMIT 1) as dot_code
            FROM return_items ri
            JOIN returns r ON ri.return_id = r.return_id
            JOIN products p ON ri.product_id = p.product_id
            WHERE ri.return_item_id = ?
        ");
        $stmt_item->bind_param("i", $return_item_id);
        $stmt_item->execute();
        $item = $stmt_item->get_result()->fetch_assoc();
        $stmt_item->close();

        if (!$item) throw new Exception("Return item not found or could not be traced to original shipment details.");
        if (($item['processed_quantity'] + $quantity) > $item['expected_quantity']) {
            throw new Exception("Processing quantity exceeds expected quantity.");
        }

        $calculated_expiry_date = calculateExpiryDateForReturn($item['dot_code'], $item['expiry_years']);
        $unit_cost = null;
        $new_inventory_id = null;
        $location_id = null; 

        if ($condition === 'Good') {
            if (empty($location_barcode)) throw new Exception("Location barcode is required for 'Good' items.");
            
            // MODIFICATION: Validate location against the specified putaway warehouse.
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
            
            // MODIFICATION: Use the specified putaway_warehouse_id for the new inventory record.
            $stmt_inv_insert = $conn->prepare("
                INSERT INTO inventory (
                    warehouse_id, product_id, source_inbound_item_id, location_id, quantity, 
                    batch_number, expiry_date, dot_code, unit_cost
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt_inv_insert->bind_param("iiiissssd", 
                $putaway_warehouse_id, $item['product_id'], $return_item_id, $location_id, $quantity, 
                $new_batch_number, $calculated_expiry_date, $item['dot_code'], $unit_cost
            );

            if (!$stmt_inv_insert->execute()) {
                throw new Exception("Failed to insert new inventory record for return: " . $stmt_inv_insert->error);
            }
            $new_inventory_id = $stmt_inv_insert->insert_id;
            $stmt_inv_insert->close();
            
            // MODIFICATION: Use the specified putaway_warehouse_id for the stock adjustment.
            $notes = "Stock added from return item ID: {$return_item_id} for Order ID: {$item['order_id']}.";
            $stmt_adj = $conn->prepare("INSERT INTO stock_adjustments (product_id, warehouse_id, location_id, user_id, quantity_adjusted, reason_code, notes) VALUES (?, ?, ?, ?, ?, 'Return', ?)");
            $stmt_adj->bind_param("iiiiis", $item['product_id'], $putaway_warehouse_id, $location_id, $user_id, $quantity, $notes);
            $stmt_adj->execute();
            $stmt_adj->close();

            $stmt_sticker = $conn->prepare("INSERT INTO return_putaway_stickers (inventory_id, return_id, unique_barcode) VALUES (?, ?, ?)");
            for ($i = 0; $i < $quantity; $i++) {
                $unique_id = strtoupper(bin2hex(random_bytes(3)));
                $barcode_value = "RET-".($item['dot_code'] ?? 'NA')."-{$unique_id}";
                $stmt_sticker->bind_param("iis", $new_inventory_id, $item['return_id'], $barcode_value);
                if (!$stmt_sticker->execute()) {
                    throw new Exception("Failed to generate sticker barcode: " . $stmt_sticker->error);
                }
            }
            $stmt_sticker->close();
        }

        $stmt_update_item = $conn->prepare("UPDATE return_items SET processed_quantity = processed_quantity + ?, `condition` = ?, putaway_location_id = ?, inspected_by = ?, inspected_at = NOW() WHERE return_item_id = ?");
        $stmt_update_item->bind_param("isiii", $quantity, $condition, $location_id, $user_id, $return_item_id);
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
