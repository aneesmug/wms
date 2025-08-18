<?php
// api/driver_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
ob_start();

$action = $_GET['action'] ?? '';
$public_actions = [
    'getOrderForThirdParty', 
    'scanItemForThirdParty', 
    'reportThirdPartyIssue',
    'verifyThirdPartyDelivery',
    'reportThirdPartyDeliveryFailure'
];

if (!in_array($action, $public_actions)) {
    authenticate_user(true, ['driver']);
    $current_user_id = $_SESSION['user_id'];
} else {
    $current_user_id = null;
}

function checkAndUpdateOrderStatusAfterScan($conn, $order_id, $scanner_id, $is_third_party = false) {
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

    // MODIFICATION: Corrected logic to sum all scans for a third-party order, regardless of the driver.
    if ($is_third_party) {
        $stmt_scanned = $conn->prepare("SELECT SUM(quantity_scanned) as total_scanned FROM outbound_driver_scans WHERE order_id = ?");
        $stmt_scanned->bind_param("i", $order_id);
    } else {
        $stmt_scanned = $conn->prepare("SELECT SUM(quantity_scanned) as total_scanned FROM outbound_driver_scans WHERE order_id = ? AND scanned_by_driver_id = ?");
        $stmt_scanned->bind_param("ii", $order_id, $scanner_id);
    }
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
        $shipped_by_id = $is_third_party ? null : $scanner_id;
        $stmt_update->bind_param("sii", $new_status, $shipped_by_id, $order_id);
        $stmt_update->execute();
        $affected_rows = $stmt_update->affected_rows;
        $stmt_update->close();

        if ($affected_rows > 0) {
            $log_user = $is_third_party ? null : $scanner_id;
            $scanner_name = $is_third_party ? "Third-party drivers" : "Driver ID: $scanner_id";
            logOrderHistory($conn, $order_id, $new_status, $log_user, "$scanner_name has scanned all items. Order is now out for delivery.");
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
    case 'reportFailedDelivery':
        handleReportFailedDelivery($conn, $current_user_id);
        break;
    case 'getOrderForThirdParty':
        handleGetOrderForThirdParty($conn);
        break;
    case 'scanItemForThirdParty':
        handleScanItemForThirdParty($conn);
        break;
    case 'reportThirdPartyIssue':
        handleReportThirdPartyIssue($conn);
        break;
    case 'verifyThirdPartyDelivery':
        handleVerifyThirdPartyDelivery($conn);
        break;
    case 'reportThirdPartyDeliveryFailure':
        handleReportThirdPartyDeliveryFailure($conn);
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
    $stmt = $conn->prepare("
        SELECT DISTINCT
            oo.order_id, oo.order_number, oo.status, c.customer_name,
            COALESCE(oo.actual_delivery_date, oo.updated_at) as actual_delivery_date, 
            oo.updated_at,
            oo.delivered_to_name, oo.delivery_photo_path,
            oo.delivered_to_phone as receiver_phone,
            CONCAT_WS(', ', NULLIF(c.address_line1, ''), NULLIF(c.address_line2, ''), c.city) as full_address,
            (SELECT SUM(oi.ordered_quantity) FROM outbound_items oi WHERE oi.order_id = oo.order_id) as total_items,
            (SELECT SUM(ods.quantity_scanned) FROM outbound_driver_scans ods WHERE ods.order_id = oo.order_id AND ods.scanned_by_driver_id = ?) as scanned_items_count,
            (SELECT notes FROM order_history WHERE order_id = oo.order_id AND status IN ('Delivery Failed', 'Cancelled', 'Rejected') ORDER BY history_id DESC LIMIT 1) as failure_reason
        FROM outbound_orders oo
        JOIN customers c ON oo.customer_id = c.customer_id
        LEFT JOIN (
            SELECT DISTINCT order_id, driver_user_id FROM outbound_order_assignments
            UNION
            SELECT DISTINCT order_id, updated_by_user_id as driver_user_id FROM order_history
        ) as assignments ON oo.order_id = assignments.order_id
        WHERE 
            assignments.driver_user_id = ?
        AND oo.status IN ('Delivered', 'Delivery Failed', 'Returned', 'Partially Returned', 'Cancelled')
        ORDER BY oo.updated_at DESC
    ");
    $stmt->bind_param("ii", $driver_id, $driver_id);
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

        $new_status = 'Staged';
        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
        $stmt_update->bind_param("si", $new_status, $order_id);
        $stmt_update->execute();
        $stmt_update->close();

        $stmt_clear_scans = $conn->prepare("DELETE FROM outbound_driver_scans WHERE order_id = ? AND scanned_by_driver_id = ?");
        $stmt_clear_scans->bind_param("ii", $order_id, $driver_id);
        $stmt_clear_scans->execute();
        $stmt_clear_scans->close();

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
    $barcode_or_sticker = sanitize_input($input['barcode'] ?? '');

    if (!$request_order_id || !$barcode_or_sticker) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and item barcode/sticker are required.'], 400);
        return;
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
            throw new Exception("Invalid code. Item sticker not found on this order.");
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
        
        $update_result = checkAndUpdateOrderStatusAfterScan($conn, $request_order_id, $driver_id, false);

        $conn->commit();
        
        $response_data = [
            'success' => true,
            'message' => __('item_scan_successful'),
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

function handleReportFailedDelivery($conn, $driver_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $reason = sanitize_input($input['reason'] ?? '');

    if (!$order_id || empty($reason)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and a reason are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT oo.status FROM outbound_orders oo JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id WHERE oo.order_id = ? AND ooa.driver_user_id = ?");
        $stmt_check->bind_param("ii", $order_id, $driver_id);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$order) {
            throw new Exception("You are not assigned to this order or the order does not exist.", 403);
        }
        if ($order['status'] !== 'Out for Delivery') {
            throw new Exception("Can only report failure on orders that are 'Out for Delivery'.", 409);
        }

        $new_status = 'Delivery Failed';
        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
        $stmt_update->bind_param("si", $new_status, $order_id);
        $stmt_update->execute();
        $stmt_update->close();

        $stmt_clear_scans = $conn->prepare("DELETE FROM outbound_driver_scans WHERE order_id = ? AND scanned_by_driver_id = ?");
        $stmt_clear_scans->bind_param("ii", $order_id, $driver_id);
        $stmt_clear_scans->execute();
        $stmt_clear_scans->close();
        
        $stmt_unassign = $conn->prepare("DELETE FROM outbound_order_assignments WHERE order_id = ? AND driver_user_id = ?");
        $stmt_unassign->bind_param("ii", $order_id, $driver_id);
        $stmt_unassign->execute();
        $stmt_unassign->close();

        $log_note = "Delivery attempt failed. Reason: " . $reason . ". Order returned for re-assignment.";
        logOrderHistory($conn, $order_id, 'Delivery Failed', $driver_id, $log_note);
        
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Failed delivery attempt has been successfully reported.']);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

// --- Functions for Third-Party Public Page ---

function handleGetOrderForThirdParty($conn) {
    $order_number = sanitize_input($_GET['order_number'] ?? '');
    if (empty($order_number)) {
        sendJsonResponse(['success' => false, 'message' => 'Order Number is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT 
            oo.order_id, 
            oo.order_number, 
            GROUP_CONCAT(DISTINCT ooa.third_party_driver_name SEPARATOR ',') as driver_names
        FROM outbound_orders oo
        JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id
        WHERE (oo.order_number = ? OR oo.tracking_number = ?) 
        AND oo.status = 'Assigned' 
        AND ooa.assignment_type = 'third_party'
        GROUP BY oo.order_id, oo.order_number
    ");
    $stmt->bind_param("ss", $order_number, $order_number);
    $stmt->execute();
    $order_result = $stmt->get_result();
    $order = $order_result->fetch_assoc();
    $stmt->close();

    if (!$order) {
        sendJsonResponse(['success' => false, 'message' => 'Order not found, is not assigned to a third-party, or is not in the correct status for pickup.'], 404);
        return;
    }
    
    $order['drivers'] = explode(',', $order['driver_names']);
    unset($order['driver_names']);

    $stmt_items = $conn->prepare("
        SELECT 
            oi.product_id, p.sku, p.product_name, oi.ordered_quantity,
            COALESCE((SELECT SUM(quantity_scanned) FROM outbound_driver_scans WHERE order_id = oi.order_id AND product_id = oi.product_id), 0) as scanned_quantity
        FROM outbound_items oi
        JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
    ");
    $stmt_items->bind_param("i", $order['order_id']);
    $stmt_items->execute();
    $order['items'] = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_items->close();

    $stmt_history = $conn->prepare("
        SELECT ods.scanned_at, p.product_name, p.sku, ops.sticker_code
        FROM outbound_driver_scans ods
        JOIN products p ON ods.product_id = p.product_id
        LEFT JOIN outbound_pick_stickers ops ON ods.sticker_id = ops.sticker_id
        WHERE ods.order_id = ? AND ods.scanned_by_third_party_name IS NOT NULL
        ORDER BY ods.scanned_at DESC
    ");
    $stmt_history->bind_param("i", $order['order_id']);
    $stmt_history->execute();
    $order['scan_history'] = $stmt_history->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_history->close();

    sendJsonResponse(['success' => true, 'data' => $order]);
}

function handleScanItemForThirdParty($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $barcode = sanitize_input($input['barcode'] ?? '');
    $scanner_name = sanitize_input($input['scanner_name'] ?? '');

    if (!$order_id || !$barcode || !$scanner_name) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID, barcode, and scanner name are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_verify = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ?");
        $stmt_verify->bind_param("i", $order_id);
        $stmt_verify->execute();
        $order_status = $stmt_verify->get_result()->fetch_assoc()['status'];
        $stmt_verify->close();
        if ($order_status !== 'Assigned') {
            throw new Exception("This order is not ready for pickup scanning.");
        }

        $stmt_sticker = $conn->prepare("
            SELECT s.sticker_id, oi.product_id
            FROM outbound_pick_stickers s
            JOIN outbound_item_picks oip ON s.pick_id = oip.pick_id
            JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id
            WHERE s.sticker_code = ? AND oi.order_id = ?
        ");
        $stmt_sticker->bind_param("si", $barcode, $order_id);
        $stmt_sticker->execute();
        $sticker_info = $stmt_sticker->get_result()->fetch_assoc();
        $stmt_sticker->close();
        
        if (!$sticker_info) {
            throw new Exception("Invalid sticker code for this order.");
        }
        $product_id = $sticker_info['product_id'];
        $sticker_id = $sticker_info['sticker_id'];

        $stmt_check_scan = $conn->prepare("SELECT scan_id FROM outbound_driver_scans WHERE sticker_id = ?");
        $stmt_check_scan->bind_param("i", $sticker_id);
        $stmt_check_scan->execute();
        if ($stmt_check_scan->get_result()->fetch_assoc()) {
            throw new Exception("This item sticker has already been scanned.");
        }
        $stmt_check_scan->close();

        $stmt_qty = $conn->prepare("
            SELECT 
                oi.ordered_quantity,
                COALESCE((SELECT SUM(quantity_scanned) FROM outbound_driver_scans WHERE order_id = oi.order_id AND product_id = oi.product_id), 0) as scanned_quantity
            FROM outbound_items oi
            WHERE oi.order_id = ? AND oi.product_id = ?
        ");
        $stmt_qty->bind_param("ii", $order_id, $product_id);
        $stmt_qty->execute();
        $quantities = $stmt_qty->get_result()->fetch_assoc();
        $stmt_qty->close();

        if ($quantities['scanned_quantity'] >= $quantities['ordered_quantity']) {
            throw new Exception("All units for this product have already been scanned.");
        }

        $stmt_log = $conn->prepare("INSERT INTO outbound_driver_scans (order_id, product_id, sticker_id, scanned_by_third_party_name, quantity_scanned) VALUES (?, ?, ?, ?, 1)");
        $stmt_log->bind_param("iiss", $order_id, $product_id, $sticker_id, $scanner_name);
        $stmt_log->execute();
        $scan_id = $stmt_log->insert_id;
        $stmt_log->close();

        $stmt_prod_info = $conn->prepare("SELECT product_name, sku FROM products WHERE product_id = ?");
        $stmt_prod_info->bind_param("i", $product_id);
        $stmt_prod_info->execute();
        $product_info = $stmt_prod_info->get_result()->fetch_assoc();
        $stmt_prod_info->close();

        $update_result = checkAndUpdateOrderStatusAfterScan($conn, $order_id, $scanner_name, true);

        $conn->commit();
        
        $response_data = [
            'success' => true,
            'message' => "Scan successful: " . $product_info['product_name'],
            'data' => [
                'product_id' => $product_id,
                'order_status_updated' => $update_result['updated'],
                'scan_log' => [
                    'scanned_at' => date('Y-m-d H:i:s'),
                    'product_name' => $product_info['product_name'],
                    'sku' => $product_info['sku'],
                    'sticker_code' => $barcode
                ]
            ]
        ];

        sendJsonResponse($response_data);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleReportThirdPartyIssue($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $reason = sanitize_input($input['reason'] ?? '');
    $driver_name = sanitize_input($input['driver_name'] ?? 'Unknown Driver');

    if (!$order_id || empty($reason)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and a reason are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        logOrderHistory($conn, $order_id, 'Pickup Issue Reported', null, "Third-party driver ($driver_name) reported an issue: " . $reason);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Your issue has been reported to the warehouse staff.']);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

function handleVerifyThirdPartyDelivery($conn) {
    $tracking_number = sanitize_input($_POST['tracking_number'] ?? '');
    $delivery_code = sanitize_input($_POST['delivery_code'] ?? '');
    $receiver_name = sanitize_input($_POST['receiver_name'] ?? '');
    $receiver_phone = sanitize_input($_POST['receiver_phone'] ?? '');

    if (empty($tracking_number) || empty($receiver_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Tracking/Order Number and Receiver Name are required.'], 400);
        return;
    }

    if (!isset($_FILES['delivery_photo']) || $_FILES['delivery_photo']['error'] !== UPLOAD_ERR_OK) {
        sendJsonResponse(['success' => false, 'message' => 'A proof of delivery photo is required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_verify = $conn->prepare("SELECT order_id, delivery_confirmation_code, status FROM outbound_orders WHERE tracking_number = ? OR order_number = ?");
        $stmt_verify->bind_param("ss", $tracking_number, $tracking_number);
        $stmt_verify->execute();
        $order = $stmt_verify->get_result()->fetch_assoc();
        $stmt_verify->close();

        if (!$order) {
            throw new Exception("Order not found with the provided Tracking or Order Number.", 404);
        }
        if ($order['status'] !== 'Out for Delivery') {
            throw new Exception("This order is not currently out for delivery. Status: " . $order['status'], 409);
        }

        if (!empty($delivery_code) && $order['delivery_confirmation_code'] !== $delivery_code) {
            logOrderHistory($conn, $order['order_id'], 'Delivery Attempted', null, "Failed delivery attempt by third-party. Incorrect confirmation code provided.");
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
        $file_name = "delivery_{$order['order_id']}_" . time() . "." . $file_ext;
        $file_path = $upload_dir . $file_name;
        $db_path = "uploads/delivery_proof/" . $file_name;

        if (!move_uploaded_file($photo['tmp_name'], $file_path)) {
            throw new Exception("Failed to save delivery photo.");
        }

        $stmt = $conn->prepare("UPDATE outbound_orders SET status = 'Delivered', actual_delivery_date = NOW(), delivered_to_name = ?, delivered_to_phone = ?, delivery_photo_path = ? WHERE order_id = ?");
        $stmt->bind_param("sssi", $receiver_name, $receiver_phone, $db_path, $order['order_id']);
        $stmt->execute();
        $stmt->close();

        logOrderHistory($conn, $order['order_id'], 'Delivered', null, "Successfully delivered by third-party to {$receiver_name}. Photo proof uploaded.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order successfully marked as delivered!']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
    }
}

function handleReportThirdPartyDeliveryFailure($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $tracking_number = sanitize_input($input['tracking_number'] ?? '');
    $reason = sanitize_input($input['reason'] ?? '');
    $notes = sanitize_input($input['notes'] ?? '');

    if (!$tracking_number || empty($reason)) {
        sendJsonResponse(['success' => false, 'message' => 'Tracking Number and a reason are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT order_id, status FROM outbound_orders WHERE tracking_number = ? OR order_number = ?");
        $stmt_check->bind_param("ss", $tracking_number, $tracking_number);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$order) {
            throw new Exception("Order not found with the provided Tracking or Order Number.", 404);
        }
        if ($order['status'] !== 'Out for Delivery') {
            throw new Exception("Can only report failure on orders that are 'Out for Delivery'. Current status: " . $order['status'], 409);
        }

        $new_status = 'Delivery Failed';
        $stmt_update = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
        $stmt_update->bind_param("si", $new_status, $order['order_id']);
        $stmt_update->execute();
        $stmt_update->close();

        $stmt_clear_scans = $conn->prepare("DELETE FROM outbound_driver_scans WHERE order_id = ?");
        $stmt_clear_scans->bind_param("i", $order['order_id']);
        $stmt_clear_scans->execute();
        $stmt_clear_scans->close();
        
        $stmt_unassign = $conn->prepare("DELETE FROM outbound_order_assignments WHERE order_id = ?");
        $stmt_unassign->bind_param("i", $order['order_id']);
        $stmt_unassign->execute();
        $stmt_unassign->close();

        $full_reason = $reason;
        if (!empty($notes)) {
            $full_reason .= ". Notes: " . $notes;
        }
        logOrderHistory($conn, $order['order_id'], 'Delivery Failed', null, "Third-party delivery failed. Reason: " . $full_reason);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Failed delivery attempt has been reported. The warehouse has been notified.']);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
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
