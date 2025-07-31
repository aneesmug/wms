<?php
// api/driver_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, ['driver']);
$current_user_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

// --- Helper function to check and update order status after scan ---
function checkAndUpdateOrderStatusAfterScan($conn, $order_id, $driver_id) {
    $stmt_status = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ?");
    $stmt_status->bind_param("i", $order_id);
    $stmt_status->execute();
    $current_status = $stmt_status->get_result()->fetch_assoc()['status'] ?? '';
    $stmt_status->close();

    if ($current_status !== 'Assigned') {
        return ['updated' => false];
    }

    $stmt_ordered = $conn->prepare("SELECT SUM(ordered_quantity) as total_ordered FROM outbound_items WHERE order_id = ?");
    $stmt_ordered->bind_param("i", $order_id);
    $stmt_ordered->execute();
    $total_ordered = (int)($stmt_ordered->get_result()->fetch_assoc()['total_ordered'] ?? 0);
    $stmt_ordered->close();

    $stmt_scanned = $conn->prepare("SELECT SUM(quantity_scanned) as total_scanned FROM outbound_driver_scans WHERE order_id = ? AND scanned_by_driver_id = ?");
    $stmt_scanned->bind_param("ii", $order_id, $driver_id);
    $stmt_scanned->execute();
    $total_scanned = (int)($stmt_scanned->get_result()->fetch_assoc()['total_scanned'] ?? 0);
    $stmt_scanned->close();

    if ($total_ordered > 0 && $total_scanned >= $total_ordered) {
        $new_status = 'Out for Delivery';
        
        $stmt_update = $conn->prepare("
            UPDATE outbound_orders 
            SET status = ?, 
                out_for_delivery_date = NOW(),
                actual_ship_date = NOW(),
                shipped_by = ?
            WHERE order_id = ? AND status = 'Assigned'
        ");
        $stmt_update->bind_param("sii", $new_status, $driver_id, $order_id);
        $stmt_update->execute();
        $affected_rows = $stmt_update->affected_rows;
        $stmt_update->close();

        if ($affected_rows > 0) {
            logOrderHistory($conn, $order_id, $new_status, $driver_id, "Driver has scanned all items. Order is now out for delivery.");
            return ['updated' => true, 'new_status' => $new_status];
        }
    }
    
    return ['updated' => false];
}


switch ($action) {
    case 'getAssignedOrders':
        handleGetAssignedOrders($conn, $current_user_id);
        break;
    case 'getDeliveredOrders':
        handleGetDeliveredOrders($conn, $current_user_id);
        break;
    case 'rejectOrder':
        handleRejectOrder($conn, $current_user_id);
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
            oo.delivery_photo_path,
            CONCAT_WS(', ', NULLIF(c.address_line1, ''), NULLIF(c.address_line2, ''), c.city) as full_address,
            (SELECT SUM(oi.ordered_quantity) FROM outbound_items oi WHERE oi.order_id = oo.order_id) as total_items,
            (SELECT SUM(ods.quantity_scanned) FROM outbound_driver_scans ods WHERE ods.order_id = oo.order_id AND ods.scanned_by_driver_id = ?) as scanned_items_count
        FROM outbound_orders oo
        JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id
        JOIN customers c ON oo.customer_id = c.customer_id
        WHERE ooa.driver_user_id = ? AND oo.status IN ('Assigned', 'Out for Delivery')
        ORDER BY oo.required_ship_date ASC
    ");
    $stmt->bind_param("ii", $driver_id, $driver_id);
    $stmt->execute();
    $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $orders]);
}

function handleGetDeliveredOrders($conn, $driver_id) {
    // MODIFICATION: Added customer phone and address fields to the query
    $stmt = $conn->prepare("
        SELECT 
            oo.order_id, oo.order_number, oo.status, c.customer_name,
            oo.delivery_photo_path, oo.delivered_to_name, oo.actual_delivery_date,
            oo.delivered_to_phone as receiver_phone,
            c.phone as customer_phone,
            CONCAT_WS(', ', NULLIF(c.address_line1, ''), NULLIF(c.address_line2, ''), c.city) as full_address
        FROM outbound_orders oo
        JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id
        JOIN customers c ON oo.customer_id = c.customer_id
        WHERE ooa.driver_user_id = ? AND oo.status = 'Delivered'
        ORDER BY oo.actual_delivery_date DESC
    ");
    $stmt->bind_param("i", $driver_id);
    $stmt->execute();
    $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $orders]);
}


function handleRejectOrder($conn, $driver_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $rejection_note = sanitize_input($input['rejection_note'] ?? '');

    if (empty($order_id) || empty($rejection_note)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and a rejection note are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("
            SELECT oo.status 
            FROM outbound_orders oo
            JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id
            WHERE oo.order_id = ? AND ooa.driver_user_id = ?
        ");
        $stmt_check->bind_param("ii", $order_id, $driver_id);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$order) {
            throw new Exception("Order not found or you are not assigned to it.", 404);
        }
        if ($order['status'] !== 'Assigned') {
            throw new Exception("This order cannot be rejected as it is not in 'Assigned' status.", 409);
        }

        $new_status = 'Ready for Pickup';
        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
        $stmt_update->bind_param("si", $new_status, $order_id);
        $stmt_update->execute();
        $stmt_update->close();

        $stmt_delete = $conn->prepare("DELETE FROM outbound_order_assignments WHERE order_id = ? AND driver_user_id = ?");
        $stmt_delete->bind_param("ii", $order_id, $driver_id);
        $stmt_delete->execute();
        $stmt_delete->close();

        logOrderHistory($conn, $order_id, 'Rejected', $driver_id, "Driver rejected assignment. Reason: " . $rejection_note);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order has been rejected and returned to the assignment pool.']);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleVerifyDelivery($conn, $driver_id) {
    $order_id = filter_var($_POST['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $delivery_code = sanitize_input($_POST['delivery_code'] ?? '');
    $receiver_name = sanitize_input($_POST['receiver_name'] ?? '');
    $receiver_phone = sanitize_input($_POST['receiver_phone'] ?? '');

    if (empty($order_id) || empty($receiver_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and Receiver Name are required.'], 400);
        return;
    }

    if (!isset($_FILES['delivery_photo']) || $_FILES['delivery_photo']['error'] !== UPLOAD_ERR_OK) {
        sendJsonResponse(['success' => false, 'message' => 'A proof of delivery photo is required and must be uploaded successfully.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_assign = $conn->prepare("SELECT assignment_id FROM outbound_order_assignments WHERE order_id = ? AND driver_user_id = ?");
        $stmt_assign->bind_param("ii", $order_id, $driver_id);
        $stmt_assign->execute();
        if (!$stmt_assign->get_result()->fetch_assoc()) {
            throw new Exception("You are not assigned to this order.", 403);
        }
        $stmt_assign->close();

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

        if (!empty($delivery_code) && $order['delivery_confirmation_code'] !== $delivery_code) {
            logOrderHistory($conn, $order_id, 'Delivery Attempted', $driver_id, "Failed delivery attempt by driver. Incorrect confirmation code provided.");
            $conn->commit(); 
            throw new Exception("Incorrect Delivery Code.", 403);
        }

        $photo = $_FILES['delivery_photo'];
        $upload_dir = __DIR__ . '/../uploads/delivery_proof/';
        if (!is_dir($upload_dir)) {
            if (!mkdir($upload_dir, 0775, true)) {
                 throw new Exception("Failed to create upload directory.");
            }
        }
        $file_ext = strtolower(pathinfo($photo['name'], PATHINFO_EXTENSION));
        $allowed_exts = ['jpg', 'jpeg', 'png', 'gif'];
        if (!in_array($file_ext, $allowed_exts)) {
            throw new Exception("Invalid file type. Only JPG, PNG, and GIF are allowed.");
        }
        $file_name = "delivery_{$order_id}_" . time() . "." . $file_ext;
        $file_path = $upload_dir . $file_name;
        $db_path = "uploads/delivery_proof/" . $file_name;

        if (!move_uploaded_file($photo['tmp_name'], $file_path)) {
            throw new Exception("Failed to save delivery photo. Check directory permissions.");
        }

        $stmt = $conn->prepare("UPDATE outbound_orders SET status = 'Delivered', actual_delivery_date = NOW(), delivered_to_name = ?, delivered_to_phone = ?, delivery_photo_path = ? WHERE order_id = ?");
        $stmt->bind_param("sssi", $receiver_name, $receiver_phone, $db_path, $order_id);
        $stmt->execute();
        $stmt->close();

        logOrderHistory($conn, $order_id, 'Delivered', $driver_id, "Successfully delivered to {$receiver_name}. Photo proof uploaded.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order successfully marked as delivered!']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
    }
}

function handleGetOrderDetailsForScan($conn, $driver_id) {
    $order_id = filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
    if (!$order_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400); return; }

    $stmt = $conn->prepare("SELECT oo.order_number FROM outbound_orders oo JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id WHERE oo.order_id = ? AND ooa.driver_user_id = ?");
    $stmt->bind_param("ii", $order_id, $driver_id);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    if (!$order) { sendJsonResponse(['success' => false, 'message' => 'Order not found or you are not assigned to it.'], 404); return; }
    $stmt->close();

    $stmt_items = $conn->prepare("
        SELECT 
            oi.product_id, p.sku, p.product_name, p.article_no, oi.ordered_quantity,
            (SELECT SUM(quantity_scanned) FROM outbound_driver_scans WHERE order_id = oi.order_id AND product_id = oi.product_id AND scanned_by_driver_id = ?) as scanned_quantity
        FROM outbound_items oi
        JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
    ");
    $stmt_items->bind_param("ii", $driver_id, $order_id);
    $stmt_items->execute();
    $order['items'] = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_items->close();

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

    $barcode_or_sticker = $barcode_or_sticker_raw;
    if (strlen($barcode_or_sticker_raw) === 13 && is_numeric($barcode_or_sticker_raw)) {
        $barcode_or_sticker = substr($barcode_or_sticker_raw, 0, 12);
    }

    $conn->begin_transaction();
    try {
        $product_id = null;
        $sticker_id = null;

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
            $product_id = $sticker_info['product_id'];
            $sticker_id = $sticker_info['sticker_id'];
            
            $stmt_check_scan = $conn->prepare("SELECT scan_id FROM outbound_driver_scans WHERE sticker_id = ?");
            $stmt_check_scan->bind_param("i", $sticker_id);
            $stmt_check_scan->execute();
            if ($stmt_check_scan->get_result()->fetch_assoc()) {
                throw new Exception("This sticker has already been scanned.");
            }
            $stmt_check_scan->close();
        } else {
            $stmt_product = $conn->prepare("
                SELECT oi.product_id
                FROM outbound_items oi
                JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ? AND p.barcode = ?
                LIMIT 1
            ");
            $stmt_product->bind_param("is", $request_order_id, $barcode_or_sticker);
            $stmt_product->execute();
            $product_info = $stmt_product->get_result()->fetch_assoc();
            $stmt_product->close();

            if (!$product_info) {
                if ($barcode_or_sticker !== $barcode_or_sticker_raw) {
                     $stmt_product_raw = $conn->prepare("
                        SELECT oi.product_id
                        FROM outbound_items oi
                        JOIN products p ON oi.product_id = p.product_id
                        WHERE oi.order_id = ? AND p.barcode = ?
                        LIMIT 1
                    ");
                    $stmt_product_raw->bind_param("is", $request_order_id, $barcode_or_sticker_raw);
                    $stmt_product_raw->execute();
                    $product_info = $stmt_product_raw->get_result()->fetch_assoc();
                    $stmt_product_raw->close();
                }

                if (!$product_info) {
                    throw new Exception("Invalid code. Item not found on this order.");
                }
            }
            $product_id = $product_info['product_id'];
        }
        
        $stmt_quantities = $conn->prepare("SELECT ordered_quantity FROM outbound_items WHERE order_id = ? AND product_id = ?");
        $stmt_quantities->bind_param("ii", $request_order_id, $product_id);
        $stmt_quantities->execute();
        $ordered_quantity = $stmt_quantities->get_result()->fetch_assoc()['ordered_quantity'] ?? 0;
        $stmt_quantities->close();
        
        if ($ordered_quantity == 0) {
            throw new Exception("Item is not on this order in sufficient quantity.");
        }

        $stmt_scanned = $conn->prepare("
            SELECT SUM(quantity_scanned) as total_scanned
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

        $stmt_log = $conn->prepare("INSERT INTO outbound_driver_scans (order_id, product_id, sticker_id, scanned_by_driver_id, quantity_scanned) VALUES (?, ?, ?, ?, 1)");
        $stmt_log->bind_param("iiii", $request_order_id, $product_id, $sticker_id, $driver_id);
        $stmt_log->execute();
        $stmt_log->close();
        
        $update_result = checkAndUpdateOrderStatusAfterScan($conn, $request_order_id, $driver_id);

        $conn->commit();
        
        $response_data = [
            'success' => true,
            'message' => 'Item scan successful!',
            'data' => [
                'product_id' => $product_id,
                'new_scanned_quantity' => $total_scanned + 1
            ]
        ];

        if ($update_result['updated']) {
            $response_data['data']['order_status_updated'] = true;
            $response_data['data']['new_order_status'] = $update_result['new_status'];
            $response_data['message'] = 'Final item scanned. Order is now Out for Delivery!';
        }

        sendJsonResponse($response_data);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function logOrderHistory($conn, $order_id, $status, $user_id, $notes = '') {
    $stmt = $conn->prepare("INSERT INTO order_history (order_id, status, updated_by_user_id, notes) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isis", $order_id, $status, $user_id, $notes);
    if (!$stmt->execute()) {
        error_log("Failed to log order history: " . $stmt->error);
    }
    $stmt->close();
}
