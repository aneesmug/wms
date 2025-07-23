<?php
// api/driver_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

// Note: The helper functions sendJsonResponse() and sanitize_input() 
// are assumed to be declared in the required files above (e.g., auth_helper.php).
// They have been removed from this file to prevent redeclaration errors.

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

    // Get the detailed log of items already scanned
    $stmt_scans = $conn->prepare("
        SELECT 
            ods.scan_id, ods.scanned_at, p.sku, p.product_name, ops.sticker_code 
        FROM outbound_driver_scans ods
        JOIN products p ON ods.product_id = p.product_id
        LEFT JOIN outbound_pick_stickers ops ON ods.sticker_id = ops.sticker_id
        WHERE ods.order_id = ? AND ods.scanned_by_driver_id = ?
        ORDER BY ods.scanned_at DESC
    ");
    $stmt_scans->bind_param("ii", $order_id, $driver_id);
    $stmt_scans->execute();
    $order['scanned_items_log'] = $stmt_scans->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_scans->close();


    sendJsonResponse(['success' => true, 'data' => $order]);
}

function handleScanOrderItem($conn, $driver_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $request_order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $barcode_or_sticker_raw = sanitize_input($input['barcode'] ?? '');

    if (!$request_order_id || !$barcode_or_sticker_raw) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and item barcode/sticker are required.'], 400);
        return;
    }

    // MODIFICATION: Handle EAN-13 check digit. If barcode is 13 digits, trim the last one.
    $barcode_or_sticker = $barcode_or_sticker_raw;
    if (strlen($barcode_or_sticker_raw) === 13 && is_numeric($barcode_or_sticker_raw)) {
        $barcode_or_sticker = substr($barcode_or_sticker_raw, 0, 12);
    }

    $conn->begin_transaction();
    try {
        $product_id = null;
        $sticker_id = null; // Can be null if scanning a generic EAN-13 barcode

        // Step 1: Check if the scanned code is a unique sticker assigned to this order
        $stmt_sticker = $conn->prepare("
            SELECT s.sticker_id, oi.product_id
            FROM outbound_pick_stickers s
            JOIN outbound_item_picks oip ON s.pick_id = oip.pick_id
            JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id
            WHERE s.sticker_code = ? AND oi.order_id = ?
        ");
        $stmt_sticker->bind_param("si", $barcode_or_sticker, $request_order_id);
        $stmt_sticker->execute();
        $sticker_info = $stmt_sticker->get_result()->fetch_assoc();
        $stmt_sticker->close();

        if ($sticker_info) {
            // Found a unique sticker for this order
            $product_id = $sticker_info['product_id'];
            $sticker_id = $sticker_info['sticker_id'];
            
            // Verify this specific sticker hasn't been scanned before
            $stmt_check_scan = $conn->prepare("SELECT scan_id FROM outbound_driver_scans WHERE sticker_id = ?");
            $stmt_check_scan->bind_param("i", $sticker_id);
            $stmt_check_scan->execute();
            if ($stmt_check_scan->get_result()->fetch_assoc()) {
                throw new Exception("This sticker has already been scanned.");
            }
            $stmt_check_scan->close();
        } else {
            // If not a sticker, check if it's a product barcode (EAN-13) on this order
            $stmt_product = $conn->prepare("
                SELECT oi.product_id
                FROM outbound_items oi
                JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ? AND p.barcode = ?
                LIMIT 1
            ");
            $stmt_product->bind_param("is", $barcode_or_sticker, $request_order_id);
            $stmt_product->execute();
            $product_info = $stmt_product->get_result()->fetch_assoc();
            $stmt_product->close();

            if (!$product_info) {
                // If still not found, try the original raw scan in case it was a 13-digit non-EAN code
                if ($barcode_or_sticker !== $barcode_or_sticker_raw) {
                     $stmt_product_raw = $conn->prepare("
                        SELECT oi.product_id
                        FROM outbound_items oi
                        JOIN products p ON oi.product_id = p.product_id
                        WHERE oi.order_id = ? AND p.barcode = ?
                        LIMIT 1
                    ");
                    $stmt_product_raw->bind_param("is", $barcode_or_sticker_raw, $request_order_id);
                    $stmt_product_raw->execute();
                    $product_info = $stmt_product_raw->get_result()->fetch_assoc();
                    $stmt_product_raw->close();
                }

                if (!$product_info) {
                    throw new Exception("Invalid code. Item not found on this order.");
                }
            }
            $product_id = $product_info['product_id'];
            // sticker_id remains null
        }
        
        // Step 2: Now that we have a product_id, check the ordered vs. scanned quantities
        $stmt_quantities = $conn->prepare("SELECT ordered_quantity FROM outbound_items WHERE order_id = ? AND product_id = ?");
        $stmt_quantities->bind_param("ii", $request_order_id, $product_id);
        $stmt_quantities->execute();
        $ordered_quantity = $stmt_quantities->get_result()->fetch_assoc()['ordered_quantity'] ?? 0;
        $stmt_quantities->close();
        
        if ($ordered_quantity == 0) {
            throw new Exception("Item is not on this order in sufficient quantity.");
        }

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

        // Step 3: Log the scan (sticker_id can be NULL)
        $stmt_log = $conn->prepare("INSERT INTO outbound_driver_scans (order_id, product_id, sticker_id, scanned_by_driver_id, quantity_scanned) VALUES (?, ?, ?, ?, 1)");
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

function logOrderHistory($conn, $order_id, $status, $user_id, $notes = '') {
    $stmt = $conn->prepare("INSERT INTO order_history (order_id, status, updated_by_user_id, notes) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isis", $order_id, $status, $user_id, $notes);
    if (!$stmt->execute()) {
        // Log error to PHP error log for debugging
        error_log("Failed to log order history: " . $stmt->error);
    }
    $stmt->close();
}
