<?php
/**
 * api/picking_api.php
 * Handles all backend logic for the order picking process.
 */
/********************************************************************
* MODIFICATION SUMMARY:
* - Modified the `handleAssignDriver` function to allow changing a driver after an order has been assigned or is out for delivery.
* - The status check now permits 'Assigned' and 'Out for Delivery' statuses, in addition to 'Staged' and 'Delivery Failed'.
* - This enables the new "Change Driver" functionality on the frontend.
* - Added `customer_code` to the SELECT statement in `handleGetOrdersForPicking` to enable searching and displaying by customer code.
********************************************************************/

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';
require_once __DIR__ . '/../helpers/order_helper.php';

$conn = getDbConnection();
ob_start();

// Authenticate the user and ensure they have a role that can access picking functionality.
authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();
$current_user_id = $_SESSION['user_id'];

// Ensure a warehouse is selected for all operations.
if (!$current_warehouse_id) {
    sendJsonResponse(['success' => false, 'message' => 'No warehouse selected. Please select a warehouse from the dashboard.'], 400);
    exit;
}

$action = $_GET['action'] ?? '';

// Authorize all actions in this file for users with appropriate roles.
authorize_user_role(['picker', 'operator', 'manager']);

// Route requests based on the action parameter.
switch ($action) {
    case 'getOrdersForPicking':
        handleGetOrdersForPicking($conn, $current_warehouse_id);
        break;
    case 'getOrderCountsByStatus': 
        handleGetOrderCountsByStatus($conn, $current_warehouse_id);
        break;
    case 'getOrderDetails':
        handleGetOrderDetails($conn, $current_warehouse_id);
        break;
    case 'getDotsForProduct':
        handleGetDotsForProduct($conn, $current_warehouse_id);
        break;
    case 'getLocationsForDot':
        handleGetLocationsForDot($conn, $current_warehouse_id);
        break;
    case 'getBatchesForLocationDot':
        handleGetBatchesForLocationDot($conn, $current_warehouse_id);
        break;
    case 'getPickReport':
        handleGetPickReport($conn, $current_warehouse_id);
        break;
    case 'getPickStickers':
        handleGetPickStickers($conn, $current_warehouse_id);
        break;
    case 'markStickersPrinted':
        handleMarkStickersPrinted($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'getShippingAreas':
        handleGetShippingAreas($conn, $current_warehouse_id);
        break;
    case 'getDrivers':
        handleGetDrivers($conn, $current_warehouse_id);
        break;
    case 'getDeliveryCompanies': 
        handleGetDeliveryCompanies($conn);
        break;
    case 'pickItem':
        handlePickItem($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'unpickItem':
        handleUnpickItem($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'stageOrder':
        handleStageOrder($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'scrapOrder':
        handleScrapOrder($conn, $current_warehouse_id, $current_user_id);
        break;
    case 'assignDriver':
        handleAssignDriver($conn, $current_warehouse_id, $current_user_id);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Invalid picking action provided.'], 400);
        break;
}


function handleGetOrdersForPicking($conn, $warehouse_id) {
    $status_filter = $_GET['status'] ?? 'Pending Pick';
    $allowed_statuses = ['New', 'Pending Pick', 'Partially Picked', 'Picked', 'Staged', 'Assigned', 'Delivery Failed'];
    
    $sql = "SELECT o.order_id, o.order_number, c.customer_id, c.customer_code, reference_number,  COALESCE(c.customer_name, 'Scrap Order') as customer_name, o.order_date, o.status, o.reference_number, o.required_ship_date 
            FROM outbound_orders o
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            WHERE o.warehouse_id = ?";

    if ($status_filter !== 'all') {
        if ($status_filter === 'Pending Pick') {
            $sql .= " AND o.status IN ('New', 'Pending Pick')";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $warehouse_id);
        } elseif (in_array($status_filter, $allowed_statuses)) {
            $sql .= " AND o.status = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("is", $warehouse_id, $status_filter);
        } else {
            $sql .= " AND o.status IN ('New', 'Pending Pick')";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("i", $warehouse_id);
        }
    } else {
        $sql .= " AND o.status IN ('" . implode("','", $allowed_statuses) . "')";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $warehouse_id);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $orders = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $orders]);
}

function handleGetOrderCountsByStatus($conn, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT
            CASE
                WHEN status = 'New' THEN 'Pending Pick'
                ELSE status
            END AS status_group,
            COUNT(order_id) as order_count
        FROM outbound_orders
        WHERE warehouse_id = ? AND status IN ('New', 'Pending Pick', 'Partially Picked', 'Picked', 'Staged', 'Assigned', 'Delivery Failed')
        GROUP BY status_group
    ");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $counts = [];
    while ($row = $result->fetch_assoc()) {
        $counts[$row['status_group']] = $row['order_count'];
    }
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $counts]);
}


function handleGetOrderDetails($conn, $warehouse_id) {
    $order_id = filter_var($_GET['order_id'], FILTER_VALIDATE_INT);
    if(!$order_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400); return; }
    
    $stmt = $conn->prepare("
        SELECT oo.*, COALESCE(c.customer_name, 'Scrap Order') as customer_name, sl.location_code as shipping_area_code
        FROM outbound_orders oo 
        LEFT JOIN customers c ON oo.customer_id = c.customer_id 
        LEFT JOIN warehouse_locations sl ON oo.shipping_area_location_id = sl.location_id
        WHERE oo.order_id = ? AND oo.warehouse_id = ?
    ");
    $stmt->bind_param("ii", $order_id, $warehouse_id);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$order) { sendJsonResponse(['success' => false, 'message' => 'Outbound order not found.'], 404); return; }
    
    $stmt_items = $conn->prepare("SELECT oi.*, p.sku, p.product_name, p.article_no FROM outbound_items oi JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id = ?");
    $stmt_items->bind_param("i", $order_id);
    $stmt_items->execute();
    $items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_items->close();
    
    $stmt_picks = $conn->prepare("SELECT p.pick_id, p.outbound_item_id, p.location_id, p.batch_number, p.dot_code, p.picked_quantity, wl.location_code FROM outbound_item_picks p JOIN outbound_items oi ON p.outbound_item_id = oi.outbound_item_id JOIN warehouse_locations wl ON p.location_id = wl.location_id WHERE oi.order_id = ?");
    $stmt_picks->bind_param("i", $order_id);
    $stmt_picks->execute();
    $picks_data = $stmt_picks->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_picks->close();
    
    $picks_by_item = [];
    foreach ($picks_data as $pick) { $picks_by_item[$pick['outbound_item_id']][] = $pick; }
    foreach ($items as &$item) { $item['picks'] = $picks_by_item[$item['outbound_item_id']] ?? []; }
    unset($item);
    $order['items'] = $items;

    $stmt_assign = $conn->prepare("SELECT ooa.*, u.full_name as driver_name, dc.company_name FROM outbound_order_assignments ooa LEFT JOIN users u ON ooa.driver_user_id = u.user_id LEFT JOIN delivery_companies dc ON ooa.third_party_company_id = dc.company_id WHERE ooa.order_id = ? ORDER BY ooa.assigned_at DESC");
    $stmt_assign->bind_param("i", $order_id);
    $stmt_assign->execute();
    $assignment = $stmt_assign->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_assign->close();
    $order['assignment'] = $assignment;

    sendJsonResponse(['success' => true, 'data' => $order]);
}

function handleGetDotsForProduct($conn, $warehouse_id) {
    $product_id = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT);
    if (!$product_id) {
        sendJsonResponse(['success' => false, 'message' => 'Product ID is required.'], 400);
        return;
    }

    $stmt_unlocked = $conn->prepare("
        SELECT DISTINCT i.dot_code
        FROM inventory i
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        WHERE i.product_id = ? AND i.warehouse_id = ? AND i.quantity > 0 AND i.dot_code IS NOT NULL AND i.dot_code != ''
        AND wl.is_locked = 0
        ORDER BY SUBSTRING(i.dot_code, 3, 2) ASC, SUBSTRING(i.dot_code, 1, 2) ASC
    ");
    $stmt_unlocked->bind_param("ii", $product_id, $warehouse_id);
    $stmt_unlocked->execute();
    $result_unlocked = $stmt_unlocked->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_unlocked->close();

    if (count($result_unlocked) > 0) {
        sendJsonResponse(['success' => true, 'data' => $result_unlocked]);
        return;
    }

    $stmt_any = $conn->prepare("
        SELECT COUNT(*) as stock_count
        FROM inventory i
        WHERE i.product_id = ? AND i.warehouse_id = ? AND i.quantity > 0
    ");
    $stmt_any->bind_param("ii", $product_id, $warehouse_id);
    $stmt_any->execute();
    $any_stock_exists = $stmt_any->get_result()->fetch_assoc()['stock_count'] > 0;
    $stmt_any->close();

    if ($any_stock_exists) {
        sendJsonResponse(['success' => false, 'message' => "This item location is locked, so you can't pick item from locked location"]);
        return;
    }

    sendJsonResponse(['success' => true, 'data' => []]);
}

function handleGetLocationsForDot($conn, $warehouse_id) {
    $product_id = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT);
    $dot_code = sanitize_input($_GET['dot_code'] ?? '');

    if (!$product_id || !$dot_code) {
        sendJsonResponse(['success' => false, 'message' => 'Product ID and DOT Code are required.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT
            wl.location_id,
            wl.location_code,
            SUM(i.quantity) as available_quantity
        FROM inventory i
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        WHERE i.product_id = ? AND i.dot_code = ? AND i.warehouse_id = ? AND i.quantity > 0 AND wl.is_locked = 0
        GROUP BY wl.location_id, wl.location_code
        ORDER BY wl.location_code ASC
    ");
    $stmt->bind_param("isi", $product_id, $dot_code, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJsonResponse(['success' => true, 'data' => $result]);
}

function handleGetBatchesForLocationDot($conn, $warehouse_id) {
    $product_id = filter_input(INPUT_GET, 'product_id', FILTER_VALIDATE_INT);
    $dot_code = sanitize_input($_GET['dot_code'] ?? '');
    $location_id = filter_input(INPUT_GET, 'location_id', FILTER_VALIDATE_INT);

    if (!$product_id || !$dot_code || !$location_id) {
        sendJsonResponse(['success' => false, 'message' => 'Product ID, DOT Code, and Location ID are required.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT
            batch_number,
            quantity
        FROM inventory
        WHERE product_id = ? AND dot_code = ? AND location_id = ? AND warehouse_id = ? AND quantity > 0
    ");
    $stmt->bind_param("isii", $product_id, $dot_code, $location_id, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJsonResponse(['success' => true, 'data' => $result]);
}

function handlePickItem($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);

    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $product_id = filter_var($input['product_id'] ?? 0, FILTER_VALIDATE_INT);
    $location_id = filter_var($input['location_id'] ?? 0, FILTER_VALIDATE_INT);
    $picked_quantity = filter_var($input['picked_quantity'] ?? 0, FILTER_VALIDATE_INT);
    $batch_number = sanitize_input($input['batch_number'] ?? null);
    $dot_code = sanitize_input($input['dot_code'] ?? '');

    if (!$order_id || !$product_id || !$location_id || !$dot_code || $picked_quantity <= 0) {
        sendJsonResponse(['success' => false, 'message' => 'Missing required data. Ensure Product, DOT, Location, and Quantity are provided.'], 400);
        return;
    }
    
    $conn->begin_transaction();
    try {
        $stmt_lock_check = $conn->prepare("SELECT is_locked FROM warehouse_locations WHERE location_id = ? AND warehouse_id = ?");
        $stmt_lock_check->bind_param("ii", $location_id, $warehouse_id);
        $stmt_lock_check->execute();
        $location_status = $stmt_lock_check->get_result()->fetch_assoc();
        $stmt_lock_check->close();

        if ($location_status && $location_status['is_locked'] == 1) {
            throw new Exception("this item location is locked you can't pick item from locked location");
        }

        $stmt_item = $conn->prepare("SELECT outbound_item_id, ordered_quantity, picked_quantity FROM outbound_items WHERE order_id = ? AND product_id = ?");
        $stmt_item->bind_param("ii", $order_id, $product_id);
        $stmt_item->execute();
        $order_item = $stmt_item->get_result()->fetch_assoc();
        $stmt_item->close();

        if (!$order_item) {
            throw new Exception("This product is not on the selected order.");
        }
        $needed_qty = $order_item['ordered_quantity'] - $order_item['picked_quantity'];
        if ($picked_quantity > $needed_qty) {
            throw new Exception("Picking this quantity ({$picked_quantity}) would exceed the amount needed ({$needed_qty}).");
        }

        $stmt_inv = $conn->prepare("SELECT inventory_id, quantity FROM inventory WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code = ? AND warehouse_id = ?");
        $stmt_inv->bind_param("iissi", $product_id, $location_id, $batch_number, $dot_code, $warehouse_id);
        $stmt_inv->execute();
        $inventory_item = $stmt_inv->get_result()->fetch_assoc();
        $stmt_inv->close();

        if (!$inventory_item || $inventory_item['quantity'] < $picked_quantity) {
            throw new Exception("Insufficient stock for the selected item/location/batch/DOT. Available: " . ($inventory_item['quantity'] ?? 0));
        }

        $stmt_update_inv = $conn->prepare("UPDATE inventory SET quantity = quantity - ? WHERE inventory_id = ?");
        $stmt_update_inv->bind_param("ii", $picked_quantity, $inventory_item['inventory_id']);
        $stmt_update_inv->execute();
        $stmt_update_inv->close();

        $stmt_insert_pick = $conn->prepare("INSERT INTO outbound_item_picks (outbound_item_id, location_id, batch_number, dot_code, picked_quantity, picked_by_user_id) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt_insert_pick->bind_param("iissii", $order_item['outbound_item_id'], $location_id, $batch_number, $dot_code, $picked_quantity, $user_id);
        $stmt_insert_pick->execute();
        $pick_id = $stmt_insert_pick->insert_id;
        $stmt_insert_pick->close();
        
        for ($i = 1; $i <= $picked_quantity; $i++) {
            $timestamp_part = substr(time(), -8); 
            $random_part = str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT);
            $sticker_code = $timestamp_part . $random_part;

            $stmt_sticker = $conn->prepare("INSERT INTO outbound_pick_stickers (pick_id, sticker_code) VALUES (?, ?)");
            $stmt_sticker->bind_param("is", $pick_id, $sticker_code);
            $stmt_sticker->execute();
            $stmt_sticker->close();
        }

        $stmt_check_picker = $conn->prepare("SELECT picked_by FROM outbound_orders WHERE order_id = ?");
        $stmt_check_picker->bind_param("i", $order_id);
        $stmt_check_picker->execute();
        $order_picker = $stmt_check_picker->get_result()->fetch_assoc();
        $stmt_check_picker->close();

        if ($order_picker && is_null($order_picker['picked_by'])) {
            $stmt_set_picker = $conn->prepare("UPDATE outbound_orders SET picked_by = ? WHERE order_id = ?");
            $stmt_set_picker->bind_param("ii", $user_id, $order_id);
            $stmt_set_picker->execute();
            $stmt_set_picker->close();
        }

        $stmt_reset_print = $conn->prepare("UPDATE outbound_orders SET stickers_printed_at = NULL WHERE order_id = ?");
        $stmt_reset_print->bind_param("i", $order_id);
        $stmt_reset_print->execute();
        $stmt_reset_print->close();

        updateOutboundItemAndOrderStatus($conn, $order_id, $user_id);

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Successfully picked {$picked_quantity} units."]);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleUnpickItem($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $pick_id = filter_var($input['pick_id'] ?? 0, FILTER_VALIDATE_INT);
    if (!$pick_id) {
        sendJsonResponse(['success' => false, 'message' => 'Pick ID is required.'], 400);
        return;
    }
    
    $conn->begin_transaction();
    try {
        $stmt_pick = $conn->prepare("SELECT p.*, oi.order_id, oi.product_id FROM outbound_item_picks p JOIN outbound_items oi ON p.outbound_item_id = oi.outbound_item_id WHERE p.pick_id = ?");
        $stmt_pick->bind_param("i", $pick_id);
        $stmt_pick->execute();
        $pick_data = $stmt_pick->get_result()->fetch_assoc();
        $stmt_pick->close();

        if (!$pick_data) {
            throw new Exception("Pick record not found.");
        }

        $stmt_lock_check = $conn->prepare("SELECT is_locked FROM warehouse_locations WHERE location_id = ? AND warehouse_id = ?");
        $stmt_lock_check->bind_param("ii", $pick_data['location_id'], $warehouse_id);
        $stmt_lock_check->execute();
        $location_status = $stmt_lock_check->get_result()->fetch_assoc();
        $stmt_lock_check->close();

        if ($location_status && $location_status['is_locked'] == 1) {
            throw new Exception("Cannot unpick to a locked location.");
        }

        $stmt_inv_check = $conn->prepare("SELECT inventory_id FROM inventory WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code = ? AND warehouse_id = ?");
        $stmt_inv_check->bind_param("iissi", $pick_data['product_id'], $pick_data['location_id'], $pick_data['batch_number'], $pick_data['dot_code'], $warehouse_id);
        $stmt_inv_check->execute();
        $inventory_record = $stmt_inv_check->get_result()->fetch_assoc();
        $stmt_inv_check->close();

        if ($inventory_record) {
            $stmt_update_inv = $conn->prepare("UPDATE inventory SET quantity = quantity + ? WHERE inventory_id = ?");
            $stmt_update_inv->bind_param("ii", $pick_data['picked_quantity'], $inventory_record['inventory_id']);
            $stmt_update_inv->execute();
            $stmt_update_inv->close();
        } else {
            $stmt_insert_inv = $conn->prepare("INSERT INTO inventory (product_id, warehouse_id, location_id, quantity, batch_number, dot_code) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt_insert_inv->bind_param("iiiiss", $pick_data['product_id'], $warehouse_id, $pick_data['location_id'], $pick_data['picked_quantity'], $pick_data['batch_number'], $pick_data['dot_code']);
            $stmt_insert_inv->execute();
            $stmt_insert_inv->close();
        }

        $stmt_delete_stickers = $conn->prepare("DELETE FROM outbound_pick_stickers WHERE pick_id = ?");
        $stmt_delete_stickers->bind_param("i", $pick_id);
        $stmt_delete_stickers->execute();
        $stmt_delete_stickers->close();
        
        $stmt_delete_pick = $conn->prepare("DELETE FROM outbound_item_picks WHERE pick_id = ?");
        $stmt_delete_pick->bind_param("i", $pick_id);
        $stmt_delete_pick->execute();
        $stmt_delete_pick->close();

        $stmt_reset_print = $conn->prepare("UPDATE outbound_orders SET stickers_printed_at = NULL WHERE order_id = ?");
        $stmt_reset_print->bind_param("i", $pick_data['order_id']);
        $stmt_reset_print->execute();
        $stmt_reset_print->close();

        updateOutboundItemAndOrderStatus($conn, $pick_data['order_id'], $user_id);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Item unpicked and returned to stock.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleStageOrder($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $shipping_area_location_id = filter_var($input['shipping_area_location_id'] ?? 0, FILTER_VALIDATE_INT);

    if (!$order_id || !$shipping_area_location_id) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and Shipping Area are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("UPDATE outbound_orders SET status = 'Staged', shipping_area_location_id = ? WHERE order_id = ? AND warehouse_id = ? AND status = 'Picked'");
        $stmt->bind_param("iii", $shipping_area_location_id, $order_id, $warehouse_id);
        $stmt->execute();
        if ($stmt->affected_rows === 0) {
            throw new Exception("Order must be in 'Picked' status to be staged.");
        }
        $stmt->close();
        logOrderHistory($conn, $order_id, 'Staged', $user_id, 'Order has been staged for pickup.');
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order staged successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleScrapOrder($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);

    if (!$order_id) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID is required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status, order_type FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_check->bind_param("ii", $order_id, $warehouse_id);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$order) {
            throw new Exception("Order not found or does not belong to this warehouse.");
        }
        if ($order['order_type'] !== 'Scrap') {
            throw new Exception("This action is only for Scrap orders.");
        }
        if ($order['status'] !== 'Picked') {
            throw new Exception("Order must be in 'Picked' status to be scrapped.");
        }
        
        $stmt_picks = $conn->prepare("
            SELECT oi.product_id, oip.picked_quantity 
            FROM outbound_item_picks oip
            JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id
            WHERE oi.order_id = ?
        ");
        $stmt_picks->bind_param("i", $order_id);
        $stmt_picks->execute();
        $picked_items = $stmt_picks->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_picks->close();

        $stmt_adj = $conn->prepare("INSERT INTO stock_adjustments (product_id, warehouse_id, location_id, user_id, quantity_adjusted, reason_code, notes) VALUES (?, ?, ?, ?, ?, 'Scrap', ?)");
        $scrap_location_id = 0; 
        $notes = "Scrapped via Outbound Order #$order_id";
        foreach ($picked_items as $item) {
            $qty_adjusted = -$item['picked_quantity'];
            $stmt_adj->bind_param("iiiiis", $item['product_id'], $warehouse_id, $scrap_location_id, $user_id, $qty_adjusted, $notes);
        }
        $stmt_adj->close();

        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = 'Scrapped' WHERE order_id = ?");
        $stmt_update->bind_param("i", $order_id);
        $stmt_update->execute();
        $stmt_update->close();

        logOrderHistory($conn, $order_id, 'Scrapped', $user_id, 'All picked items for this order have been scrapped and removed from stock.');
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order scrapped successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}


function handleFileUpload($file, $orderId, $driverIdentifier, $docType) {
    if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    $allowed_exts = ['jpg', 'jpeg', 'png', 'pdf'];
    $file_ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    if (!in_array($file_ext, $allowed_exts)) {
        throw new Exception("Invalid file type for driver document: {$file_ext}. Only JPG, PNG, PDF allowed.");
    }

    $uploadDir = dirname(__DIR__) . '/uploads/driver_documents/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0775, true)) {
            throw new Exception("Failed to create driver document upload directory.");
        }
    }

    $safeDriverName = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $driverIdentifier);
    $filename = "order_{$orderId}_{$docType}_{$safeDriverName}_" . time() . "." . $file_ext;
    $filePath = $uploadDir . $filename;
    
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        throw new Exception("Failed to save driver document to disk.");
    }

    return 'uploads/driver_documents/' . $filename;
}


function handleAssignDriver($conn, $warehouse_id, $user_id) {
    $input_data = [];
    
    if (!empty($_POST)) {
        $input_data = $_POST;
    } 
    else {
        $json_input = json_decode(file_get_contents('php://input'), true);
        if ($json_input) {
            $input_data = $json_input;
        }
    }

    $order_id = $input_data['order_id'] ?? 0;
    $assignment_type = $input_data['assignment_type'] ?? '';

    if (!$order_id || !$assignment_type) {
        sendJsonResponse(['success' => false, 'message' => 'Missing required assignment data.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status, stickers_printed_at FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_check->bind_param("ii", $order_id, $warehouse_id);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        $original_status = $order['status'];

        if (!$order || !in_array($original_status, ['Staged', 'Delivery Failed', 'Assigned', 'Out for Delivery'])) {
            throw new Exception("Order status must be 'Staged', 'Assigned', 'Out for Delivery', or 'Delivery Failed' to assign/change driver.");
        }

        if (is_null($order['stickers_printed_at'])) {
            throw new Exception("Stickers must be printed for this order before a driver can be assigned.");
        }

        $stmt_delete = $conn->prepare("DELETE FROM outbound_order_assignments WHERE order_id = ?");
        $stmt_delete->bind_param("i", $order_id);
        $stmt_delete->execute();
        $stmt_delete->close();
        
        $log_notes = '';

        if ($assignment_type === 'in_house') {
            $driver_user_id = $input_data['driver_user_id'] ?? 0;
            if (!$driver_user_id) throw new Exception("Driver ID is required for in-house assignment.");
            
            $stmt_user = $conn->prepare("SELECT full_name FROM users WHERE user_id = ?");
            $stmt_user->bind_param("i", $driver_user_id);
            $stmt_user->execute();
            $driver_name = $stmt_user->get_result()->fetch_assoc()['full_name'];
            $stmt_user->close();
            $log_notes = "Order assigned to in-house driver: " . $driver_name;
            
            $stmt_assign = $conn->prepare("INSERT INTO outbound_order_assignments (order_id, assigned_by_user_id, assignment_type, driver_user_id) VALUES (?, ?, ?, ?)");
            $stmt_assign->bind_param("iisi", $order_id, $user_id, $assignment_type, $driver_user_id);
            $stmt_assign->execute();
            $stmt_assign->close();

        } elseif ($assignment_type === 'third_party') {
            $third_party_company_id = $_POST['third_party_company_id'] ?? 0;
            $drivers_json = $_POST['drivers'] ?? '[]';
            $third_party_drivers = json_decode($drivers_json, true);

            if (!$third_party_company_id || empty($third_party_drivers)) {
                throw new Exception("Delivery company and at least one driver's details are required.");
            }

            $stmt_comp = $conn->prepare("SELECT company_name FROM delivery_companies WHERE company_id = ?");
            $stmt_comp->bind_param("i", $third_party_company_id);
            $stmt_comp->execute();
            $company_name = $stmt_comp->get_result()->fetch_assoc()['company_name'];
            $stmt_comp->close();
            
            $driver_names_for_log = array_map(function($d) { return $d['name']; }, $third_party_drivers);
            $log_notes = "Order assigned to third-party: " . $company_name . " with drivers: " . implode(', ', $driver_names_for_log);

            $stmt_assign = $conn->prepare("INSERT INTO outbound_order_assignments (order_id, assigned_by_user_id, assignment_type, third_party_company_id, third_party_driver_name, third_party_driver_mobile, third_party_driver_id_path, third_party_driver_license_path, waybill_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            foreach ($third_party_drivers as $index => $driver) {
                $name = sanitize_input($driver['name']);
                $mobile = sanitize_input($driver['mobile']);
                $waybill = sanitize_input($driver['waybill']);
                
                $id_path = handleFileUpload($_FILES['id_file_' . $index] ?? null, $order_id, $name, 'id');
                $license_path = handleFileUpload($_FILES['license_file_' . $index] ?? null, $order_id, $name, 'license');

                if (!empty($name)) {
                    $stmt_assign->bind_param("iisisssss", $order_id, $user_id, $assignment_type, $third_party_company_id, $name, $mobile, $id_path, $license_path, $waybill);
                    $stmt_assign->execute();
                }
            }
            $stmt_assign->close();
        } else {
            throw new Exception("Invalid assignment type.");
        }

        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = 'Assigned' WHERE order_id = ?");
        $stmt_update->bind_param("i", $order_id);
        $stmt_update->execute();
        $stmt_update->close();

        logOrderHistory($conn, $order_id, 'Assigned', $user_id, $log_notes);

        if ($original_status !== 'Delivery Failed') {
            $stmt_scanned = $conn->prepare("SELECT COUNT(scan_id) as total_scanned FROM outbound_driver_scans WHERE order_id = ?");
            $stmt_scanned->bind_param("i", $order_id);
            $stmt_scanned->execute();
            $total_scanned = (int)($stmt_scanned->get_result()->fetch_assoc()['total_scanned'] ?? 0);
            $stmt_scanned->close();

            if ($total_scanned > 0) { 
                $stmt_stickers = $conn->prepare("SELECT COUNT(ops.sticker_id) as total_stickers FROM outbound_pick_stickers ops JOIN outbound_item_picks oip ON ops.pick_id = oip.pick_id JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = ?");
                $stmt_stickers->bind_param("i", $order_id);
                $stmt_stickers->execute();
                $total_stickers = (int)($stmt_stickers->get_result()->fetch_assoc()['total_stickers'] ?? 0);
                $stmt_stickers->close();

                if ($total_stickers > 0 && $total_scanned >= $total_stickers) {
                    $new_status = 'Out for Delivery';
                    $stmt_ofd = $conn->prepare("UPDATE outbound_orders SET status = ?, out_for_delivery_date = NOW() WHERE order_id = ?");
                    $stmt_ofd->bind_param("si", $new_status, $order_id);
                    $stmt_ofd->execute();
                    $stmt_ofd->close();
                    logOrderHistory($conn, $order_id, $new_status, $user_id, "Order re-assigned and automatically set to Out for Delivery as all items were previously scanned.");
                }
            }
        }

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Driver(s) assigned successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleMarkStickersPrinted($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);

    if (!$order_id) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("UPDATE outbound_orders SET stickers_printed_at = NOW() WHERE order_id = ? AND warehouse_id = ?");
    $stmt->bind_param("ii", $order_id, $warehouse_id);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            logOrderHistory($conn, $order_id, 'Stickers Printed', $user_id, 'Stickers have been printed for all picked items.');
            sendJsonResponse(['success' => true, 'message' => 'Sticker print status recorded.']);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Order not found or no update was necessary.'], 404);
        }
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to update sticker print status.'], 500);
    }
    $stmt->close();
}


function handleGetShippingAreas($conn, $warehouse_id) {
    $stmt = $conn->prepare("SELECT l.location_id, l.location_code FROM warehouse_locations l JOIN location_types lt ON l.location_type_id = lt.type_id WHERE l.warehouse_id = ? AND l.is_active = 1 AND lt.type_name IN ('shipping_area', 'shipping_bay')");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $areas = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $areas]);
}

function handleGetDrivers($conn, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT u.user_id, u.full_name 
        FROM users u 
        JOIN user_warehouse_roles uwr ON u.user_id = uwr.user_id 
        WHERE uwr.role = 'driver' AND uwr.warehouse_id = ?
    ");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $drivers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $drivers]);
}

function handleGetDeliveryCompanies($conn) {
    $sql = "SELECT company_id, company_name FROM delivery_companies WHERE is_active = 1 ORDER BY company_name ASC";
    $result = $conn->query($sql);
    $companies = $result->fetch_all(MYSQLI_ASSOC);
    sendJsonResponse(['success' => true, 'data' => $companies]);
}

// MODIFICATION: Updated to provide detailed counts for stickers
function handleGetPickStickers($conn, $warehouse_id) {
    $order_id = filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
    if (!$order_id) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID is required.'], 400);
        return;
    }
    
    $sql = "
        SELECT 
            ops.sticker_code,
            oo.order_number, oo.tracking_number,
            COALESCE(c.customer_name, 'Scrap Order') as customer_name, 
            c.address_line1, c.address_line2, c.city, c.state, c.zip_code, c.country,
            p.product_name, p.article_no, p.expiry_years,
            oi.ordered_quantity,
            oip.dot_code,
            w.warehouse_name, w.address as warehouse_address, w.city as warehouse_city,
            (SELECT SUM(oi_inner.ordered_quantity) FROM outbound_items oi_inner WHERE oi_inner.order_id = oo.order_id) as total_order_quantity
        FROM outbound_pick_stickers ops
        JOIN outbound_item_picks oip ON ops.pick_id = oip.pick_id
        JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id
        JOIN outbound_orders oo ON oi.order_id = oo.order_id
        LEFT JOIN customers c ON oo.customer_id = c.customer_id
        JOIN products p ON oi.product_id = p.product_id
        JOIN warehouses w ON oo.warehouse_id = w.warehouse_id
        WHERE oo.order_id = ? AND oo.warehouse_id = ?
        ORDER BY oi.outbound_item_id, ops.sticker_id
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $order_id, $warehouse_id);
    $stmt->execute();
    $stickers_data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $final_stickers = [];
    $per_article_counter = [];
    $overall_counter = 0;

    foreach ($stickers_data as $sticker) {
        $article_no = $sticker['article_no'];

        if (!isset($per_article_counter[$article_no])) {
            $per_article_counter[$article_no] = 0;
        }

        $per_article_counter[$article_no]++;
        $overall_counter++;

        $sticker['item_sequence'] = $per_article_counter[$article_no];
        $sticker['item_total_quantity'] = $sticker['ordered_quantity'];
        $sticker['overall_sequence'] = $overall_counter;
        $sticker['overall_total_quantity'] = $sticker['total_order_quantity'];

        $final_stickers[] = $sticker;
    }

    sendJsonResponse(['success' => true, 'data' => $final_stickers]);
}

function handleGetPickReport($conn, $warehouse_id) {
    $order_id = filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
    if (!$order_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400);
        return;
    }

    $stmt_order = $conn->prepare("
        SELECT 
            oo.order_number, oo.reference_number, oo.required_ship_date,
            COALESCE(c.customer_name, 'Scrap Order') as customer_name, 
            c.address_line1, c.address_line2, c.city,
            w.warehouse_name
        FROM outbound_orders oo
        LEFT JOIN customers c ON oo.customer_id = c.customer_id
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

    $stmt_items = $conn->prepare("
        SELECT 
            oi.product_id,
            p.sku,
            p.product_name,
            p.article_no,
            oi.ordered_quantity,
            (SELECT wl.location_code 
             FROM inventory i 
             JOIN warehouse_locations wl ON i.location_id = wl.location_id
             WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0 AND i.dot_code IS NOT NULL AND wl.is_locked = 0
             ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC 
             LIMIT 1) as location_code,
            (SELECT i.batch_number 
             FROM inventory i 
             JOIN warehouse_locations wl ON i.location_id = wl.location_id
             WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0 AND i.dot_code IS NOT NULL AND wl.is_locked = 0
             ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC 
             LIMIT 1) as batch_number,
            (SELECT i.dot_code 
             FROM inventory i 
             JOIN warehouse_locations wl ON i.location_id = wl.location_id
             WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0 AND i.dot_code IS NOT NULL AND wl.is_locked = 0
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


function updateOutboundItemAndOrderStatus($conn, $order_id, $user_id) {
    $sql_update_items = "
        UPDATE outbound_items oi
        LEFT JOIN (
            SELECT outbound_item_id, SUM(picked_quantity) as total_picked
            FROM outbound_item_picks
            GROUP BY outbound_item_id
        ) p ON oi.outbound_item_id = p.outbound_item_id
        SET oi.picked_quantity = COALESCE(p.total_picked, 0)
        WHERE oi.order_id = ?;
    ";
    $stmt_update_items = $conn->prepare($sql_update_items);
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

    $stmt_current_order = $conn->prepare("SELECT status, order_type FROM outbound_orders WHERE order_id = ?");
    $stmt_current_order->bind_param("i", $order_id);
    $stmt_current_order->execute();
    $current_order = $stmt_current_order->get_result()->fetch_assoc();
    $stmt_current_order->close();
    
    $current_status = $current_order['status'];
    $order_type = $current_order['order_type'];

    if (in_array($current_status, ['Staged', 'Assigned', 'Out for Delivery', 'Delivered', 'Cancelled', 'Delivery Failed', 'Scrapped'])) {
        return;
    }

    $new_status = 'Pending Pick';
    if ($sums['total_ordered'] > 0) {
        if ($sums['total_picked'] > 0) {
            $new_status = ($sums['total_picked'] >= $sums['total_ordered']) ? 'Picked' : 'Partially Picked';
        }
    } else {
        $new_status = 'New';
    }

    if ($new_status !== $current_status) {
        if ($new_status === 'Picked' && $order_type === 'Customer') {
            $tracking_number = 'TRK-' . $order_id . '-' . substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 6);
            $delivery_code = rand(100000, 999999);

            $stmt_update_order = $conn->prepare("UPDATE outbound_orders SET status = ?, tracking_number = ?, delivery_confirmation_code = ? WHERE order_id = ?");
            $stmt_update_order->bind_param("sssi", $new_status, $tracking_number, $delivery_code, $order_id);
            logOrderHistory($conn, $order_id, 'Picked & Ready', $user_id, "Order fully picked. Tracking #: $tracking_number generated.");
        } else {
            $stmt_update_order = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
            $stmt_update_order->bind_param("si", $new_status, $order_id);
        }
        
        $stmt_update_order->execute();
        $stmt_update_order->close();
    }
}
