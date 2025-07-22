<?php
// api/driver_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, ['driver']);
$current_user_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'getAssignedOrders':
        handleGetAssignedOrders($conn, $current_user_id);
        break;
    case 'getOrderDetailsForScan':
        handleGetOrderDetailsForScan($conn, $current_user_id);
        break;
    case 'scanOrderItem':
        handleScanOrderItem($conn, $current_user_id);
        break;
    case 'verifyDelivery':
        handleVerifyDelivery($conn, $current_user_id);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Invalid driver action.'], 400);
        break;
}

function handleGetAssignedOrders($conn, $driver_id) {
    $stmt = $conn->prepare("
        SELECT 
            oo.order_id, oo.order_number, oo.status, oo.tracking_number, c.customer_name,
            (SELECT SUM(oi.ordered_quantity) FROM outbound_items oi WHERE oi.order_id = oo.order_id) as total_items,
            (SELECT COUNT(DISTINCT ods.scan_id) FROM outbound_driver_scans ods WHERE ods.order_id = oo.order_id AND ods.scanned_by_driver_id = ?) as scanned_items_count
        FROM outbound_orders oo
        JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id
        JOIN customers c ON oo.customer_id = c.customer_id
        WHERE ooa.driver_user_id = ? AND oo.status IN ('Out for Delivery')
        ORDER BY oo.required_ship_date ASC
    ");
    $stmt->bind_param("ii", $driver_id, $driver_id);
    $stmt->execute();
    $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $orders]);
}

function handleGetOrderDetailsForScan($conn, $driver_id) {
    $order_id = filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
    if (!$order_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400); return; }

    // First, get order details and verify assignment
    $stmt = $conn->prepare("SELECT oo.order_number FROM outbound_orders oo JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id WHERE oo.order_id = ? AND ooa.driver_user_id = ?");
    $stmt->bind_param("ii", $order_id, $driver_id);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    if (!$order) { sendJsonResponse(['success' => false, 'message' => 'Order not found or you are not assigned to it.'], 404); return; }
    $stmt->close();

    // Get items on the order and how many have been scanned by this driver
    $stmt_items = $conn->prepare("
        SELECT 
            oi.product_id, p.sku, p.product_name, p.barcode, oi.ordered_quantity,
            (SELECT COUNT(scan_id) FROM outbound_driver_scans WHERE order_id = oi.order_id AND product_id = oi.product_id AND scanned_by_driver_id = ?) as scanned_quantity
        FROM outbound_items oi
        JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
    ");
    $stmt_items->bind_param("ii", $driver_id, $order_id);
    $stmt_items->execute();
    $order['items'] = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_items->close();

    sendJsonResponse(['success' => true, 'data' => $order]);
}

function handleScanOrderItem($conn, $driver_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $request_order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $sticker_code = sanitize_input($input['barcode'] ?? '');

    if (!$request_order_id || !$sticker_code) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and item sticker code are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        // Step 1: Find the sticker and its associated product/order info
        $stmt_sticker = $conn->prepare("
            SELECT s.sticker_id, oi.product_id, oi.order_id, oi.ordered_quantity
            FROM outbound_pick_stickers s
            JOIN outbound_item_picks oip ON s.pick_id = oip.pick_id
            JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id
            WHERE s.sticker_code = ?
        ");
        $stmt_sticker->bind_param("s", $sticker_code);
        $stmt_sticker->execute();
        $sticker_info = $stmt_sticker->get_result()->fetch_assoc();
        $stmt_sticker->close();

        if (!$sticker_info) {
            throw new Exception("Invalid sticker code. Item not found.");
        }

        $sticker_id = $sticker_info['sticker_id'];
        $product_id = $sticker_info['product_id'];
        $actual_order_id = $sticker_info['order_id'];
        $ordered_quantity = $sticker_info['ordered_quantity'];

        // Step 2: Verify the sticker belongs to the order the driver is processing
        if ($actual_order_id != $request_order_id) {
            throw new Exception("This item does not belong to the current order.");
        }

        // Check if this specific sticker has already been scanned.
        $stmt_check_scan = $conn->prepare("SELECT scan_id FROM outbound_driver_scans WHERE sticker_id = ?");
        $stmt_check_scan->bind_param("i", $sticker_id);
        $stmt_check_scan->execute();
        if ($stmt_check_scan->get_result()->fetch_assoc()) {
            throw new Exception("This sticker has already been scanned.");
        }
        $stmt_check_scan->close();

        // Step 3: Check if all units for this product have been scanned
        $stmt_scanned = $conn->prepare("
            SELECT COUNT(scan_id) as total_scanned
            FROM outbound_driver_scans
            WHERE order_id = ? AND product_id = ? AND scanned_by_driver_id = ?
        ");
        $stmt_scanned->bind_param("iii", $request_order_id, $product_id, $driver_id);
        $stmt_scanned->execute();
        $total_scanned = $stmt_scanned->get_result()->fetch_assoc()['total_scanned'] ?? 0;
        $stmt_scanned->close();

        if ($total_scanned >= $ordered_quantity) {
            throw new Exception("All units of this product have already been scanned.");
        }

        // Step 4: Log the scan, now including the unique sticker ID
        $stmt_log = $conn->prepare("INSERT INTO outbound_driver_scans (order_id, product_id, sticker_id, scanned_by_driver_id, quantity_scanned) VALUES (?, ?, ?, ?, 1)");
        // CORRECTION: The number of type specifiers ('i') must match the number of variables being bound.
        $stmt_log->bind_param("iiii", $request_order_id, $product_id, $sticker_id, $driver_id);
        $stmt_log->execute();
        $stmt_log->close();

        $conn->commit();
        sendJsonResponse([
            'success' => true,
            'message' => 'Item scan successful!',
            'data' => [
                'product_id' => $product_id,
                'new_scanned_quantity' => $total_scanned + 1
            ]
        ]);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}


function handleVerifyDelivery($conn, $driver_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $delivery_code = sanitize_input($input['delivery_code'] ?? '');
    $receiver_name = sanitize_input($input['receiver_name'] ?? '');

    if (empty($order_id) || empty($delivery_code) || empty($receiver_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID, Receiver Name, and Delivery Code are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        // Verify the driver is assigned to this order
        $stmt_assign = $conn->prepare("SELECT assignment_id FROM outbound_order_assignments WHERE order_id = ? AND driver_user_id = ?");
        $stmt_assign->bind_param("ii", $order_id, $driver_id);
        $stmt_assign->execute();
        if (!$stmt_assign->get_result()->fetch_assoc()) {
            throw new Exception("You are not assigned to this order.", 403);
        }
        $stmt_assign->close();

        // Verify the delivery code and order status
        $stmt_verify = $conn->prepare("SELECT delivery_confirmation_code, status FROM outbound_orders WHERE order_id = ?");
        $stmt_verify->bind_param("i", $order_id);
        $stmt_verify->execute();
        $order = $stmt_verify->get_result()->fetch_assoc();
        $stmt_verify->close();

        if (!$order) {
            throw new Exception("Order not found.", 404);
        }
        if ($order['status'] === 'Delivered') {
            throw new Exception("This order has already been marked as delivered.", 409);
        }
        if ($order['delivery_confirmation_code'] !== $delivery_code) {
            logOrderHistory($conn, $order_id, 'Delivery Attempted', $driver_id, "Failed delivery attempt by driver. Incorrect confirmation code provided.");
            $conn->commit();
            throw new Exception("Incorrect Delivery Code.", 403);
        }

        // Update the order to 'Delivered'
        $stmt = $conn->prepare("UPDATE outbound_orders SET status = 'Delivered', actual_delivery_date = NOW(), delivered_to_name = ? WHERE order_id = ?");
        $stmt->bind_param("si", $receiver_name, $order_id);
        $stmt->execute();
        $stmt->close();

        logOrderHistory($conn, $order_id, 'Delivered', $driver_id, "Successfully delivered to {$receiver_name}.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order successfully marked as delivered!']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
    }
}

// MODIFICATION: Added the missing logOrderHistory function.
function logOrderHistory($conn, $order_id, $status, $user_id, $notes = '') {
    $stmt = $conn->prepare("INSERT INTO order_history (order_id, status, updated_by_user_id, notes) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isis", $order_id, $status, $user_id, $notes);
    if (!$stmt->execute()) {
        // Log error to PHP error log for debugging
        error_log("Failed to log order history: " . $stmt->error);
    }
    $stmt->close();
}
