<?php
// api/picking_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, ['picker', 'operator', 'manager']);
$current_warehouse_id = get_current_warehouse_id();
$current_user_id = $_SESSION['user_id'];

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'getOrdersForPicking':
        handleGetOrdersForPicking($conn, $current_warehouse_id);
        break;
    case 'getOrderDetails':
        handleGetOrderDetails($conn, $current_warehouse_id);
        break;
    case 'pickItem':
        handlePickItem($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'unpickItem':
        handleUnpickItem($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'getPickStickers':
        handleGetPickStickers($conn, $current_warehouse_id);
        break;
    // --- FIX: Added new action for the A4 Pick Report ---
    case 'getPickReport':
        handleGetPickReport($conn, $current_warehouse_id);
        break;
    case 'stageOrder':
        handleStageOrder($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'assignDriver':
        handleAssignDriver($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'getDrivers':
        handleGetDrivers($conn, $current_warehouse_id);
        break;
    case 'getShippingAreas':
        handleGetShippingAreas($conn, $current_warehouse_id);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Invalid picking action.'], 400);
        break;
}

// --- FIX: Added new function to generate data for the A4 Pick Report ---
function handleGetPickReport($conn, $warehouse_id) {
    $order_id = filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
    if (!$order_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400);
        return;
    }

    // Get Order Header Details
    $stmt_order = $conn->prepare("
        SELECT 
            oo.order_number, oo.reference_number, oo.required_ship_date,
            c.customer_name, c.address_line1, c.address_line2, c.city,
            w.warehouse_name
        FROM outbound_orders oo
        JOIN customers c ON oo.customer_id = c.customer_id
        JOIN warehouses w ON oo.warehouse_id = w.warehouse_id
        WHERE oo.order_id = ? AND oo.warehouse_id = ?
    ");
    $stmt_order->bind_param("ii", $order_id, $warehouse_id);
    $stmt_order->execute();
    $order_details = $stmt_order->get_result()->fetch_assoc();
    $stmt_order->close();

    if (!$order_details) {
        sendJsonResponse(['success' => false, 'message' => 'Order not found.'], 404);
        return;
    }

    // Get Order Items and suggest a pick location based on FIFO (oldest dot_code)
    $stmt_items = $conn->prepare("
        SELECT 
            oi.product_id,
            p.sku,
            p.product_name,
            p.barcode,
            oi.ordered_quantity,
            (SELECT wl.location_code 
             FROM inventory i 
             JOIN warehouse_locations wl ON i.location_id = wl.location_id
             WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0
             ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC 
             LIMIT 1) as location_code,
            (SELECT i.batch_number 
             FROM inventory i 
             WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0
             ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC 
             LIMIT 1) as batch_number,
            (SELECT i.dot_code 
             FROM inventory i 
             WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0
             ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC 
             LIMIT 1) as dot_code
        FROM outbound_items oi
        JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
    ");
    $stmt_items->bind_param("iiii", $warehouse_id, $warehouse_id, $warehouse_id, $order_id);
    $stmt_items->execute();
    $items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_items->close();

    sendJsonResponse(['success' => true, 'data' => ['order_details' => $order_details, 'items' => $items]]);
}


function handleGetOrdersForPicking($conn, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT oo.order_id, oo.order_number, oo.reference_number, oo.status, oo.required_ship_date, c.customer_name
        FROM outbound_orders oo 
        JOIN customers c ON oo.customer_id = c.customer_id
        WHERE oo.warehouse_id = ? AND oo.status IN ('Pending Pick', 'Partially Picked', 'Picked', 'Ready for Pickup', 'Assigned')
        ORDER BY oo.required_ship_date ASC
    ");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $orders]);
}

function handleGetOrderDetails($conn, $warehouse_id) {
    $order_id = filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
    if (!$order_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT 
            oo.order_id, oo.order_number, oo.status, oo.shipping_area_location_id, 
            sl.location_code as shipping_area_code,
            u.full_name as driver_name
        FROM outbound_orders oo 
        LEFT JOIN warehouse_locations sl ON oo.shipping_area_location_id = sl.location_id
        LEFT JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id
        LEFT JOIN users u ON ooa.driver_user_id = u.user_id
        WHERE oo.order_id = ? AND oo.warehouse_id = ?
    ");
    $stmt->bind_param("ii", $order_id, $warehouse_id);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$order) {
        sendJsonResponse(['success' => false, 'message' => 'Order not found in this warehouse.'], 404);
        return;
    }
    
    $stmt_items = $conn->prepare("
        SELECT oi.outbound_item_id, oi.product_id, oi.ordered_quantity, oi.picked_quantity, p.sku, p.product_name, p.barcode 
        FROM outbound_items oi 
        JOIN products p ON oi.product_id = p.product_id 
        WHERE oi.order_id = ?
    ");
    $stmt_items->bind_param("i", $order_id);
    $stmt_items->execute();
    $items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_items->close();
    
    $stmt_picks = $conn->prepare("
        SELECT p.pick_id, p.outbound_item_id, p.location_id, p.batch_number, p.dot_code, p.picked_quantity, wl.location_code 
        FROM outbound_item_picks p 
        JOIN outbound_items oi ON p.outbound_item_id = oi.outbound_item_id 
        JOIN warehouse_locations wl ON p.location_id = wl.location_id 
        WHERE oi.order_id = ?
    ");
    $stmt_picks->bind_param("i", $order_id);
    $stmt_picks->execute();
    $picks_data = $stmt_picks->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_picks->close();
    
    $picks_by_item = [];
    foreach ($picks_data as $pick) {
        $picks_by_item[$pick['outbound_item_id']][] = $pick;
    }
    foreach ($items as &$item) {
        $item['picks'] = $picks_by_item[$item['outbound_item_id']] ?? [];
    }
    unset($item);
    
    $order['items'] = $items;
    sendJsonResponse(['success' => true, 'data' => $order]);
}

function handlePickItem($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)($input['order_id'] ?? 0);
    $product_barcode = trim($input['product_barcode'] ?? '');
    $location_id = (int)($input['location_id'] ?? 0);
    $picked_quantity = (int)($input['picked_quantity'] ?? 0);
    $batch_number = !empty($input['batch_number']) && $input['batch_number'] !== 'N/A' ? trim($input['batch_number']) : null;
    $dot_code = !empty($input['dot_code']) ? trim($input['dot_code']) : null;

    if (empty($order_id) || empty($product_barcode) || empty($location_id) || empty($dot_code) || $picked_quantity <= 0) { 
        sendJsonResponse(['success' => false, 'message' => 'Order ID, Product, Location, DOT Code, and a valid Quantity are required.'], 400); 
        return; 
    }
    
    $conn->begin_transaction();
    try {
        $stmt_prod = $conn->prepare("SELECT product_id FROM products WHERE barcode = ? OR sku = ?");
        $stmt_prod->bind_param("ss", $product_barcode, $product_barcode);
        $stmt_prod->execute();
        $product = $stmt_prod->get_result()->fetch_assoc();
        $stmt_prod->close();
        if (!$product) throw new Exception("Product not found.");
        $product_id = $product['product_id'];
        
        $stmt_item = $conn->prepare("SELECT outbound_item_id, ordered_quantity, picked_quantity FROM outbound_items WHERE order_id = ? AND product_id = ?");
        $stmt_item->bind_param("ii", $order_id, $product_id);
        $stmt_item->execute();
        $order_item = $stmt_item->get_result()->fetch_assoc();
        $stmt_item->close();
        if (!$order_item) throw new Exception("This product is not on the selected order.");
        $outbound_item_id = $order_item['outbound_item_id'];

        $total_picked = (int)$order_item['picked_quantity'];
        if (($total_picked + $picked_quantity) > $order_item['ordered_quantity']) { throw new Exception("Over-picking not allowed. Ordered: {$order_item['ordered_quantity']}, Already Picked: {$total_picked}, Trying to Pick: {$picked_quantity}."); }
        
        $stmt_inv = $conn->prepare("SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ? AND location_id = ? AND (batch_number = ? OR (batch_number IS NULL AND ? IS NULL)) AND dot_code = ?");
        $stmt_inv->bind_param("iiisss", $warehouse_id, $product_id, $location_id, $batch_number, $batch_number, $dot_code);
        $stmt_inv->execute();
        $inventory = $stmt_inv->get_result()->fetch_assoc();
        $stmt_inv->close();
        if (!$inventory || $inventory['quantity'] < $picked_quantity) { throw new Exception("Insufficient stock for this DOT code at location. Available: " . ($inventory['quantity'] ?? 0)); }
        
        $stmt_update_inv = $conn->prepare("UPDATE inventory SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ? AND location_id = ? AND (batch_number = ? OR (batch_number IS NULL AND ? IS NULL)) AND dot_code = ?");
        $stmt_update_inv->bind_param("iiiisss", $picked_quantity, $warehouse_id, $product_id, $location_id, $batch_number, $batch_number, $dot_code);
        $stmt_update_inv->execute();
        $stmt_update_inv->close();
        
        $stmt_insert_pick = $conn->prepare("INSERT INTO outbound_item_picks (outbound_item_id, location_id, batch_number, dot_code, picked_quantity, picked_by_user_id, picked_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $stmt_insert_pick->bind_param("iissii", $outbound_item_id, $location_id, $batch_number, $dot_code, $picked_quantity, $user_id);
        $stmt_insert_pick->execute();
        $pick_id = $stmt_insert_pick->insert_id;
        $stmt_insert_pick->close();
        
        $stmt_sticker = $conn->prepare("INSERT INTO outbound_pick_stickers (pick_id, sticker_code) VALUES (?, ?)");
        for ($i = 0; $i < $picked_quantity; $i++) {
            $timestamp_part = substr(microtime(true) * 10000, -5);
            $pick_part = str_pad($pick_id, 5, '0', STR_PAD_LEFT);
            $i_part = str_pad($i, 2, '0', STR_PAD_LEFT);
            $sticker_code = $pick_part . $timestamp_part . $i_part;
            if (strlen($sticker_code) > 12) $sticker_code = substr($sticker_code, 0, 12);
            $stmt_sticker->bind_param("is", $pick_id, $sticker_code);
            $stmt_sticker->execute();
        }
        $stmt_sticker->close();
        
        updateOutboundItemAndOrderStatus($conn, $order_id, $user_id);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Item picked successfully. Stickers generated.']);
    } catch (Exception $e) {
        $conn->rollback();
        ob_clean();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleUnpickItem($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $pick_id = (int)($input['pick_id'] ?? 0);
    if (empty($pick_id)) { sendJsonResponse(['success' => false, 'message' => 'Pick ID is required.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt_pick = $conn->prepare("SELECT p.picked_quantity, p.location_id, p.batch_number, p.dot_code, oi.order_id, o.status, oi.product_id FROM outbound_item_picks p JOIN outbound_items oi ON p.outbound_item_id = oi.outbound_item_id JOIN outbound_orders o ON oi.order_id = o.order_id WHERE p.pick_id = ? AND o.warehouse_id = ?");
        $stmt_pick->bind_param("ii", $pick_id, $warehouse_id);
        $stmt_pick->execute();
        $pick = $stmt_pick->get_result()->fetch_assoc();
        $stmt_pick->close();
        if (!$pick) throw new Exception("Pick record not found in this warehouse.");
        if (in_array($pick['status'], ['Shipped', 'Delivered', 'Cancelled', 'Assigned', 'Ready for Pickup', 'Out for Delivery'])) { 
            throw new Exception("Cannot unpick from a {$pick['status']} order."); 
        }

        $stmt_inv_check = $conn->prepare("SELECT inventory_id FROM inventory WHERE product_id = ? AND location_id = ? AND (batch_number = ? OR (batch_number IS NULL AND ? IS NULL)) AND dot_code = ? AND warehouse_id = ?");
        $stmt_inv_check->bind_param("iissii", $pick['product_id'], $pick['location_id'], $pick['batch_number'], $pick['batch_number'], $pick['dot_code'], $warehouse_id);
        $stmt_inv_check->execute();
        $inventory_record = $stmt_inv_check->get_result()->fetch_assoc();
        $stmt_inv_check->close();
        if ($inventory_record) {
            $stmt_update_inv = $conn->prepare("UPDATE inventory SET quantity = quantity + ? WHERE inventory_id = ?");
            $stmt_update_inv->bind_param("ii", $pick['picked_quantity'], $inventory_record['inventory_id']);
            $stmt_update_inv->execute();
            $stmt_update_inv->close();
        } else {
            $stmt_insert_inv = $conn->prepare("INSERT INTO inventory (product_id, warehouse_id, location_id, quantity, batch_number, dot_code) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt_insert_inv->bind_param("iiiiss", $pick['product_id'], $warehouse_id, $pick['location_id'], $pick['picked_quantity'], $pick['batch_number'], $pick['dot_code']);
            $stmt_insert_inv->execute();
            $stmt_insert_inv->close();
        }
        $stmt_delete_pick = $conn->prepare("DELETE FROM outbound_item_picks WHERE pick_id = ?");
        $stmt_delete_pick->bind_param("i", $pick_id);
        $stmt_delete_pick->execute();
        $stmt_delete_pick->close();
        updateOutboundItemAndOrderStatus($conn, $pick['order_id'], $user_id);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Item unpicked successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleStageOrder($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $shipping_area_location_id = filter_var($input['shipping_area_location_id'] ?? 0, FILTER_VALIDATE_INT);

    if (empty($order_id) || empty($shipping_area_location_id)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and a Shipping Area are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check_order = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_check_order->bind_param("ii", $order_id, $warehouse_id);
        $stmt_check_order->execute();
        $order = $stmt_check_order->get_result()->fetch_assoc();
        $stmt_check_order->close();

        if (!$order) {
            throw new Exception("Order not found in this warehouse.");
        }
        if (!in_array($order['status'], ['Picked', 'Partially Picked'])) {
            throw new Exception("Order must be in 'Picked' or 'Partially Picked' status to be staged. Current status: " . $order['status']);
        }

        $stmt_check_loc = $conn->prepare("
            SELECT wl.location_id 
            FROM warehouse_locations wl
            JOIN location_types lt ON wl.location_type_id = lt.type_id
            WHERE wl.location_id = ? AND wl.warehouse_id = ? AND lt.type_name = 'shipping_area' AND wl.is_active = 1
        ");
        $stmt_check_loc->bind_param("ii", $shipping_area_location_id, $warehouse_id);
        $stmt_check_loc->execute();
        if ($stmt_check_loc->get_result()->num_rows === 0) {
            throw new Exception("The selected location is not a valid, active shipping area.");
        }
        $stmt_check_loc->close();

        $new_status = 'Ready for Pickup';
        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = ?, shipping_area_location_id = ? WHERE order_id = ?");
        $stmt_update->bind_param("sii", $new_status, $shipping_area_location_id, $order_id);
        $stmt_update->execute();
        $stmt_update->close();

        $stmt_loc_code = $conn->prepare("SELECT location_code FROM warehouse_locations WHERE location_id = ?");
        $stmt_loc_code->bind_param("i", $shipping_area_location_id);
        $stmt_loc_code->execute();
        $location_code = $stmt_loc_code->get_result()->fetch_assoc()['location_code'] ?? 'Unknown';
        $stmt_loc_code->close();

        logOrderHistory($conn, $order_id, $new_status, $user_id, "Order staged at shipping area: {$location_code}.");

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Order successfully staged at {$location_code}."]);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleAssignDriver($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $driver_user_id = filter_var($input['driver_user_id'] ?? 0, FILTER_VALIDATE_INT);

    if (empty($order_id) || empty($driver_user_id)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and Driver ID are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_check->bind_param("ii", $order_id, $warehouse_id);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        
        if (!$order || !in_array($order['status'], ['Ready for Pickup', 'Assigned'])) {
            throw new Exception("Order must be in 'Ready for Pickup' or 'Assigned' status to assign a driver.", 400);
        }
        $stmt_check->close();

        $stmt_delete = $conn->prepare("DELETE FROM outbound_order_assignments WHERE order_id = ?");
        $stmt_delete->bind_param("i", $order_id);
        $stmt_delete->execute();
        $stmt_delete->close();
        
        $stmt_assign = $conn->prepare("INSERT INTO outbound_order_assignments (order_id, driver_user_id) VALUES (?, ?)");
        $stmt_assign->bind_param("ii", $order_id, $driver_user_id);
        $stmt_assign->execute();
        $stmt_assign->close();

        $new_status = 'Assigned';
        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
        $stmt_update->bind_param("si", $new_status, $order_id);
        $stmt_update->execute();
        $stmt_update->close();
        
        $stmt_driver = $conn->prepare("SELECT full_name FROM users WHERE user_id = ?");
        $stmt_driver->bind_param("i", $driver_user_id);
        $stmt_driver->execute();
        $driver_name = $stmt_driver->get_result()->fetch_assoc()['full_name'] ?? 'Unknown Driver';
        $stmt_driver->close();

        logOrderHistory($conn, $order_id, $new_status, $user_id, "Assigned to driver: {$driver_name}.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Driver {$driver_name} assigned successfully."]);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleGetPickStickers($conn, $warehouse_id) {
    $order_id = filter_var($_GET['order_id'] ?? 0, FILTER_VALIDATE_INT);
    if (!$order_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400); return; }
    $stmt_verify = $conn->prepare("SELECT order_id FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
    $stmt_verify->bind_param("ii", $order_id, $warehouse_id);
    $stmt_verify->execute();
    if (!$stmt_verify->get_result()->fetch_assoc()) { sendJsonResponse(['success' => false, 'message' => 'Order not found in this warehouse.'], 404); return; }
    $stmt_verify->close();
    
    $stmt = $conn->prepare("
        SELECT 
            s.sticker_code, p.product_name, p.sku, p.barcode, p.expiry_years, oip.dot_code,
            oo.order_number, oo.tracking_number, c.customer_name, c.phone,
            c.address_line1, c.address_line2, c.city, c.state, c.zip_code, c.country,
            w.warehouse_name, w.address as warehouse_address, w.city as warehouse_city,
            ROW_NUMBER() OVER(PARTITION BY oi.product_id ORDER BY s.sticker_id) as item_sequence,
            oi.ordered_quantity as item_total
        FROM outbound_pick_stickers s
        JOIN outbound_item_picks oip ON s.pick_id = oip.pick_id
        JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id
        JOIN products p ON oi.product_id = p.product_id
        JOIN outbound_orders oo ON oi.order_id = oo.order_id
        JOIN customers c ON oo.customer_id = c.customer_id
        JOIN warehouses w ON oo.warehouse_id = w.warehouse_id
        WHERE oi.order_id = ?
        ORDER BY p.product_name, s.sticker_id
    ");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $stickers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $stickers]);
}

function handleGetDrivers($conn, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT u.user_id, u.full_name 
        FROM users u
        JOIN user_warehouse_roles uwr ON u.user_id = uwr.user_id
        WHERE uwr.role = 'driver' AND uwr.warehouse_id = ?
        ORDER BY u.full_name ASC
    ");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $drivers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $drivers]);
}

function handleGetShippingAreas($conn, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT wl.location_id, wl.location_code
        FROM warehouse_locations wl
        JOIN location_types lt ON wl.location_type_id = lt.type_id
        WHERE wl.warehouse_id = ? AND lt.type_name = 'shipping_area' AND wl.is_active = 1
        ORDER BY wl.location_code
    ");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $areas = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $areas]);
}

function updateOutboundItemAndOrderStatus($conn, $order_id, $user_id) {
    $sql = "UPDATE outbound_items oi 
            LEFT JOIN (
                SELECT outbound_item_id, SUM(picked_quantity) as total_picked 
                FROM outbound_item_picks 
                GROUP BY outbound_item_id
            ) p ON oi.outbound_item_id = p.outbound_item_id 
            SET oi.picked_quantity = COALESCE(p.total_picked, 0) 
            WHERE oi.order_id = ?;";
    $stmt_update_items = $conn->prepare($sql);
    $stmt_update_items->bind_param("i", $order_id);
    $stmt_update_items->execute();
    $stmt_update_items->close();

    $stmt_sums = $conn->prepare("
        SELECT SUM(ordered_quantity) AS total_ordered, SUM(picked_quantity) AS total_picked 
        FROM outbound_items 
        WHERE order_id = ?
    ");
    $stmt_sums->bind_param("i", $order_id);
    $stmt_sums->execute();
    $sums = $stmt_sums->get_result()->fetch_assoc();
    $stmt_sums->close();

    $new_status = 'Pending Pick';
    if (($sums['total_ordered'] ?? 0) > 0) {
        if (($sums['total_picked'] ?? 0) > 0) {
            $new_status = ((int)$sums['total_picked'] >= (int)$sums['total_ordered']) ? 'Picked' : 'Partially Picked';
        }
    } else {
        $new_status = 'New';
    }
    
    $stmt_update_order = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
    $stmt_update_order->bind_param("si", $new_status, $order_id);
    $stmt_update_order->execute();
    $stmt_update_order->close();
}

function logOrderHistory($conn, $order_id, $status, $user_id, $notes = '') {
    $stmt = $conn->prepare("INSERT INTO order_history (order_id, status, updated_by_user_id, notes) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isis", $order_id, $status, $user_id, $notes);
    if (!$stmt->execute()) {
        error_log("Failed to log order history: " . $stmt->error);
    }
    $stmt->close();
}
