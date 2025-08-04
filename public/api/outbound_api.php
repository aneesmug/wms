<?php
// api/outbound.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';
require_once __DIR__ . '/../helpers/order_helper.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();
$current_user_id = $_SESSION['user_id'];

if (!$current_warehouse_id && $_SERVER['REQUEST_METHOD'] !== 'GET' && !isset($_GET['action']) && !isset($_GET['customer_id'])) {
    sendJsonResponse(['success' => false, 'message' => 'No warehouse selected. Please select a warehouse from the dashboard.'], 400);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        authorize_user_role(['viewer', 'operator', 'manager', 'picker']);
        if ($action === 'getOrderHistory') {
            handleGetOrderHistory($conn, $current_warehouse_id);
        } 
        elseif ($action === 'getPickReport') {
            handleGetPickReport($conn, $current_warehouse_id);
        }
        else {
            handleGetOutbound($conn, $current_warehouse_id);
        }
        break;
    case 'POST':
        authorize_user_role(['operator', 'manager']);
        if ($action === 'createOrder') {
            handleCreateOutboundOrder($conn, $current_warehouse_id, $current_user_id);
        } elseif ($action === 'updateOrder') { 
            handleUpdateOrder($conn, $current_warehouse_id, $current_user_id);
        } elseif ($action === 'addItem') {
            handleAddItemToOrder($conn, $current_warehouse_id);
        } elseif ($action === 'bulkAddItems') { // New action for bulk upload
            handleBulkAddItems($conn, $current_warehouse_id, $current_user_id);
        } elseif ($action === 'shipOrder') {
            handleShipOrder($conn, $current_warehouse_id, $current_user_id);
        } elseif ($action === 'cancelOrder') {
            handleCancelOrder($conn, $current_warehouse_id, $current_user_id);
        } elseif ($action === 'updateOrderItem') {
            handleUpdateOrderItem($conn, $current_warehouse_id, $current_user_id);
        } elseif ($action === 'deleteOrderItem') {
            handleDeleteOrderItem($conn, $current_warehouse_id);
        } elseif ($action === 'markOutForDelivery') {
            handleMarkOutForDelivery($conn, $current_warehouse_id, $current_user_id);
        } elseif ($action === 'markDelivered') {
            handleMarkDelivered($conn, $current_warehouse_id, $current_user_id);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Invalid POST action'], 400);
        }
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleBulkAddItems($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $items = $input['items'] ?? [];

    if (!$order_id || empty($items)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID and a list of items are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        // First, check if the order exists and belongs to the warehouse
        $stmt_check_order = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_check_order->bind_param("ii", $order_id, $warehouse_id);
        $stmt_check_order->execute();
        $order = $stmt_check_order->get_result()->fetch_assoc();
        $stmt_check_order->close();

        if (!$order) {
            throw new Exception("Order not found or does not belong to this warehouse.");
        }
        if (!in_array($order['status'], ['New', 'Pending Pick', 'Partially Picked'])) {
            throw new Exception("Cannot add items to an order with status '{$order['status']}'.");
        }

        $success_count = 0;
        $failed_items = [];

        foreach ($items as $item) {
            $article_no = trim($item['Article No'] ?? '');
            $quantity = filter_var($item['Quantity'] ?? 0, FILTER_VALIDATE_INT);

            if (empty($article_no) || $quantity <= 0) {
                $failed_items[] = ['item' => $article_no ?: 'N/A', 'reason' => 'Missing Article No or invalid quantity.'];
                continue;
            }

            // Check product validity (exists, is active, not in blocked area, has stock)
            $stmt_prod = $conn->prepare("SELECT p.product_id, p.is_active, COALESCE(inv.available_stock, 0) as available_stock FROM products p LEFT JOIN (SELECT i.product_id, SUM(i.quantity) AS available_stock FROM inventory i JOIN warehouse_locations wl ON i.location_id = wl.location_id LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id WHERE i.warehouse_id = ? AND (lt.type_name IS NULL OR lt.type_name != 'block_area') GROUP BY i.product_id) AS inv ON p.product_id = inv.product_id WHERE p.article_no = ?");
            $stmt_prod->bind_param("is", $warehouse_id, $article_no);
            $stmt_prod->execute();
            $product_data = $stmt_prod->get_result()->fetch_assoc();
            $stmt_prod->close();

            if (!$product_data) {
                $failed_items[] = ['item' => $article_no, 'reason' => 'Product with this Article No not found.'];
                continue;
            }
            if ($product_data['is_active'] != 1) {
                $failed_items[] = ['item' => $article_no, 'reason' => 'Product is inactive.'];
                continue;
            }
            if ($product_data['available_stock'] <= 0) {
                $failed_items[] = ['item' => $article_no, 'reason' => 'No available stock.'];
                continue;
            }
            if ($quantity > $product_data['available_stock']) {
                $failed_items[] = ['item' => $article_no, 'reason' => "Requested quantity ({$quantity}) exceeds available stock ({$product_data['available_stock']})."];
                continue;
            }

            $product_id = $product_data['product_id'];

            // Check if item already exists in order
            $stmt_existing = $conn->prepare("SELECT outbound_item_id, ordered_quantity FROM outbound_items WHERE order_id = ? AND product_id = ?");
            $stmt_existing->bind_param("ii", $order_id, $product_id);
            $stmt_existing->execute();
            $existing_item = $stmt_existing->get_result()->fetch_assoc();
            $stmt_existing->close();

            if ($existing_item) {
                $new_quantity = $existing_item['ordered_quantity'] + $quantity;
                $stmt_update = $conn->prepare("UPDATE outbound_items SET ordered_quantity = ? WHERE outbound_item_id = ?");
                $stmt_update->bind_param("ii", $new_quantity, $existing_item['outbound_item_id']);
                $stmt_update->execute();
                $stmt_update->close();
            } else {
                $stmt_insert = $conn->prepare("INSERT INTO outbound_items (order_id, product_id, ordered_quantity) VALUES (?, ?, ?)");
                $stmt_insert->bind_param("iii", $order_id, $product_id, $quantity);
                $stmt_insert->execute();
                $stmt_insert->close();
            }
            $success_count++;
        }

        if ($success_count > 0) {
            updateOutboundItemAndOrderStatus($conn, $order_id, $user_id);
        }
        
        $conn->commit();
        sendJsonResponse([
            'success' => true, 
            'message' => "Bulk operation complete. {$success_count} items processed successfully.",
            'data' => [
                'success_count' => $success_count,
                'failed_count' => count($failed_items),
                'failed_items' => $failed_items
            ]
        ]);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}


function handleUpdateOrder($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $customer_id = filter_var($input['customer_id'] ?? 0, FILTER_VALIDATE_INT);
    $reference_number = sanitize_input($input['reference_number'] ?? null);
    $required_ship_date = sanitize_input($input['required_ship_date'] ?? '');
    $delivery_note = sanitize_input($input['delivery_note'] ?? null);

    if (!$order_id || !$customer_id || empty($required_ship_date)) {
        sendJsonResponse(['success' => false, 'message' => 'Order ID, Customer, and Required Ship Date are mandatory.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_check->bind_param("ii", $order_id, $warehouse_id);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$order) {
            throw new Exception("Order not found or does not belong to this warehouse.");
        }
        if (!in_array($order['status'], ['New', 'Pending Pick', 'Partially Picked'])) {
            throw new Exception("Cannot edit an order with status '{$order['status']}'.");
        }

        $stmt = $conn->prepare("UPDATE outbound_orders SET customer_id = ?, reference_number = ?, required_ship_date = ?, delivery_note = ? WHERE order_id = ?");
        $stmt->bind_param("isssi", $customer_id, $reference_number, $required_ship_date, $delivery_note, $order_id);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to update order details: " . $stmt->error);
        }
        $stmt->close();

        logOrderHistory($conn, $order_id, 'Updated', $user_id, 'Order details have been updated.');
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order details updated successfully.']);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
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

    $stmt_items = $conn->prepare("
        SELECT 
            oi.product_id, p.sku, p.product_name, p.article_no, oi.ordered_quantity, oi.picked_quantity,
            (SELECT wl.location_code FROM inventory i JOIN warehouse_locations wl ON i.location_id = wl.location_id LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0 AND (lt.type_name IS NULL OR lt.type_name != 'block_area') ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC LIMIT 1) as location_code,
            (SELECT i.batch_number FROM inventory i JOIN warehouse_locations wl ON i.location_id = wl.location_id LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0 AND (lt.type_name IS NULL OR lt.type_name != 'block_area') ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC LIMIT 1) as batch_number,
            (SELECT i.dot_code FROM inventory i JOIN warehouse_locations wl ON i.location_id = wl.location_id LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id WHERE i.product_id = oi.product_id AND i.warehouse_id = ? AND i.quantity > 0 AND (lt.type_name IS NULL OR lt.type_name != 'block_area') ORDER BY SUBSTRING(i.dot_code, 3, 2), SUBSTRING(i.dot_code, 1, 2) ASC LIMIT 1) as dot_code
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

function handleGetOutbound($conn, $warehouse_id) {
    if (isset($_GET['order_id'])) {
        $order_id = filter_var($_GET['order_id'], FILTER_VALIDATE_INT);
        if(!$order_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400); return; }
        
        $sql = "
            SELECT 
                oo.*, c.customer_name, sl.location_code as shipping_area_code,
                picker.full_name as picker_name,
                shipper.full_name as shipper_name,
                driver.full_name as driver_name
            FROM outbound_orders oo 
            JOIN customers c ON oo.customer_id = c.customer_id 
            LEFT JOIN warehouse_locations sl ON oo.shipping_area_location_id = sl.location_id
            LEFT JOIN users picker ON oo.picked_by = picker.user_id
            LEFT JOIN users shipper ON oo.shipped_by = shipper.user_id
            LEFT JOIN outbound_order_assignments ooa ON oo.order_id = ooa.order_id
            LEFT JOIN users driver ON ooa.driver_user_id = driver.user_id
            WHERE oo.order_id = ? AND oo.warehouse_id = ?
        ";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ii", $order_id, $warehouse_id);
        $stmt->execute();
        $order = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$order) { sendJsonResponse(['success' => false, 'message' => 'Outbound order not found.'], 404); return; }
        
        // MODIFICATION START: Updated query to also fetch returned_quantity
        $stmt_items = $conn->prepare("
            SELECT
                oi.outbound_item_id,
                oi.product_id,
                p.sku,
                p.product_name,
                p.article_no,
                oi.ordered_quantity,
                oi.picked_quantity,
                COALESCE(SUM(ri.expected_quantity), 0) as returned_quantity,
                (oi.picked_quantity - COALESCE(SUM(ri.expected_quantity), 0)) as returnable_quantity
            FROM
                outbound_items oi
            JOIN
                products p ON oi.product_id = p.product_id
            LEFT JOIN
                return_items ri ON oi.outbound_item_id = ri.outbound_item_id
            LEFT JOIN
                returns r ON ri.return_id = r.return_id AND r.status != 'Cancelled'
            WHERE
                oi.order_id = ?
            GROUP BY
                oi.outbound_item_id, p.sku, p.product_name, p.article_no, oi.ordered_quantity, oi.picked_quantity
        ");
        // MODIFICATION END

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
        sendJsonResponse(['success' => true, 'data' => $order]);
    } else {
        $customer_id_filter = filter_input(INPUT_GET, 'customer_id', FILTER_VALIDATE_INT);
        $sql = "
            SELECT oo.order_id, oo.order_number, oo.reference_number, oo.status, oo.required_ship_date, oo.tracking_number, c.customer_name, sl.location_code as shipping_area_code
            FROM outbound_orders oo 
            JOIN customers c ON oo.customer_id = c.customer_id
            LEFT JOIN warehouse_locations sl ON oo.shipping_area_location_id = sl.location_id
        ";
        $params = [];
        $types = "";
        if ($customer_id_filter) {
            $sql .= " WHERE oo.customer_id = ?";
            $params[] = $customer_id_filter;
            $types .= "i";
        } else {
            if (!$warehouse_id) { sendJsonResponse(['success' => true, 'data' => []]); return; }
            $sql .= " WHERE oo.warehouse_id = ?";
            $params[] = $warehouse_id;
            $types .= "i";
        }
        $sql .= " ORDER BY oo.order_date DESC";
        $stmt = $conn->prepare($sql);
        if (!empty($params)) { $stmt->bind_param($types, ...$params); }
        $stmt->execute();
        $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        sendJsonResponse(['success' => true, 'data' => $orders]);
    }
}

function handleGetOrderHistory($conn, $warehouse_id) {
    $order_id = filter_var($_GET['order_id'] ?? 0, FILTER_VALIDATE_INT);
    if (!$order_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Order ID.'], 400); return; }
    $stmt_verify = $conn->prepare("SELECT order_id FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
    $stmt_verify->bind_param("ii", $order_id, $warehouse_id);
    $stmt_verify->execute();
    if (!$stmt_verify->get_result()->fetch_assoc()) { sendJsonResponse(['success' => false, 'message' => 'Order not found in this warehouse.'], 404); return; }
    $stmt_verify->close();
    $stmt = $conn->prepare("SELECT oh.status, oh.notes, oh.created_at, u.username as user_name FROM order_history oh LEFT JOIN users u ON oh.updated_by_user_id = u.user_id WHERE oh.order_id = ? ORDER BY oh.created_at ASC");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $history = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $history]);
}

function handleShipOrder($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)$input['order_id'];
    if (empty($order_id)) { sendJsonResponse(['success' => false, 'message' => 'Order ID is required for shipping.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt->bind_param("ii", $order_id, $warehouse_id);
        $stmt->execute();
        $order_data = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$order_data) { throw new Exception("Order not found or does not belong to selected warehouse."); }
        
        if (!in_array($order_data['status'], ['Picked', 'Ready for Pickup', 'Assigned'])) { 
            throw new Exception("Order must be in 'Picked', 'Ready for Pickup', or 'Assigned' status to be shipped. Current status: " . $order_data['status']); 
        }

        $tracking_number = 'TRK-' . $order_id . '-' . substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 6);
        $delivery_code = rand(100000, 999999);
        $stmt = $conn->prepare("UPDATE outbound_orders SET status = 'Shipped', actual_ship_date = NOW(), shipped_by = ?, tracking_number = ?, delivery_confirmation_code = ? WHERE order_id = ?");
        $stmt->bind_param("issi", $user_id, $tracking_number, $delivery_code, $order_id);
        $stmt->execute();
        $stmt->close();
        logOrderHistory($conn, $order_id, 'Shipped', $user_id, "Order shipped with Tracking #: $tracking_number. A delivery confirmation code has been generated.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Order successfully shipped with Tracking #: $tracking_number"]);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleCancelOrder($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    if (empty($order_id)) { sendJsonResponse(['success' => false, 'message' => 'Order ID is required to cancel.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_check->bind_param("ii", $order_id, $warehouse_id);
        $stmt_check->execute();
        $order = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();
        if (!$order) { throw new Exception("Order not found or does not belong to this warehouse."); }
        if (in_array($order['status'], ['Shipped', 'Delivered', 'Cancelled'])) { throw new Exception("Cannot cancel an order that is already {$order['status']}."); }
        
        $stmt_items = $conn->prepare("SELECT p.picked_quantity, p.location_id, p.batch_number, p.dot_code, oi.product_id FROM outbound_item_picks p JOIN outbound_items oi ON p.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = ?");
        $stmt_items->bind_param("i", $order_id);
        $stmt_items->execute();
        $picked_items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_items->close();
        
        foreach ($picked_items as $item) {
            $stmt_inv_check = $conn->prepare("SELECT inventory_id FROM inventory WHERE product_id = ? AND location_id = ? AND (batch_number = ? OR (batch_number IS NULL AND ? IS NULL)) AND dot_code = ? AND warehouse_id = ?");
            $stmt_inv_check->bind_param("iissii", $item['product_id'], $item['location_id'], $item['batch_number'], $item['batch_number'], $item['dot_code'], $warehouse_id);
            $stmt_inv_check->execute();
            $inventory_record = $stmt_inv_check->get_result()->fetch_assoc();
            $stmt_inv_check->close();
            if ($inventory_record) {
                $stmt_update_inv = $conn->prepare("UPDATE inventory SET quantity = quantity + ? WHERE inventory_id = ?");
                $stmt_update_inv->bind_param("ii", $item['picked_quantity'], $inventory_record['inventory_id']);
                $stmt_update_inv->execute();
                $stmt_update_inv->close();
            } else {
                $stmt_insert_inv = $conn->prepare("INSERT INTO inventory (product_id, warehouse_id, location_id, quantity, batch_number, dot_code) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt_insert_inv->bind_param("iiiiss", $item['product_id'], $warehouse_id, $item['location_id'], $item['picked_quantity'], $item['batch_number'], $item['dot_code']);
                $stmt_insert_inv->execute();
                $stmt_insert_inv->close();
            }
        }
        
        $stmt_delete_picks = $conn->prepare("DELETE FROM outbound_item_picks WHERE outbound_item_id IN (SELECT outbound_item_id FROM outbound_items WHERE order_id = ?)");
        $stmt_delete_picks->bind_param("i", $order_id);
        $stmt_delete_picks->execute();
        $stmt_delete_picks->close();
        
        $stmt_reset_items = $conn->prepare("UPDATE outbound_items SET picked_quantity = 0 WHERE order_id = ?");
        $stmt_reset_items->bind_param("i", $order_id);
        $stmt_reset_items->execute();
        $stmt_reset_items->close();
        
        $stmt_cancel = $conn->prepare("UPDATE outbound_orders SET status = 'Cancelled' WHERE order_id = ?");
        $stmt_cancel->bind_param("i", $order_id);
        $stmt_cancel->execute();
        $stmt_cancel->close();
        
        logOrderHistory($conn, $order_id, 'Cancelled', $user_id, 'Order has been cancelled. All picked items returned to stock.');
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order cancelled successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleMarkOutForDelivery($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    if (empty($order_id)) { sendJsonResponse(['success' => false, 'message' => 'Order ID is required.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("UPDATE outbound_orders SET status = 'Out for Delivery', out_for_delivery_date = NOW() WHERE order_id = ? AND warehouse_id = ? AND status = 'Shipped'");
        $stmt->bind_param("ii", $order_id, $warehouse_id);
        $stmt->execute();
        if ($stmt->affected_rows === 0) { throw new Exception("Order could not be updated. It might not be in 'Shipped' status or does not exist.", 400); }
        $stmt->close();
        logOrderHistory($conn, $order_id, 'Out for Delivery', $user_id, "The package is on its way for final delivery.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order marked as Out for Delivery.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleMarkDelivered($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = filter_var($input['order_id'] ?? 0, FILTER_VALIDATE_INT);
    $delivery_code = sanitize_input($input['delivery_code'] ?? '');
    $receiver_name = sanitize_input($input['receiver_name'] ?? '');
    $receiver_phone = sanitize_input($input['receiver_phone'] ?? '');
    if (empty($order_id) || empty($delivery_code) || empty($receiver_name)) { sendJsonResponse(['success' => false, 'message' => 'Order ID, Receiver Name, and Delivery Code are required.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt_verify = $conn->prepare("SELECT delivery_confirmation_code, status FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt_verify->bind_param("ii", $order_id, $warehouse_id);
        $stmt_verify->execute();
        $order = $stmt_verify->get_result()->fetch_assoc();
        $stmt_verify->close();
        if (!$order) { throw new Exception("Order not found.", 404); }
        if ($order['status'] === 'Delivered') { throw new Exception("This order has already been marked as delivered.", 409); }
        if ($order['delivery_confirmation_code'] !== $delivery_code) {
            logOrderHistory($conn, $order_id, 'Delivery Attempted', $user_id, "Failed delivery attempt. Incorrect confirmation code provided.");
            $conn->commit();
            throw new Exception("Incorrect Delivery Code. Please verify the code with the customer.", 403);
        }
        $stmt = $conn->prepare("UPDATE outbound_orders SET status = 'Delivered', actual_delivery_date = NOW(), delivered_to_name = ?, delivered_to_phone = ? WHERE order_id = ?");
        $stmt->bind_param("ssi", $receiver_name, $receiver_phone, $order_id);
        $stmt->execute();
        $stmt->close();
        logOrderHistory($conn, $order_id, 'Delivered', $user_id, "Successfully delivered to {$receiver_name}.");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Order successfully marked as delivered!']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
    }
}

function handleCreateOutboundOrder($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $customer_id = filter_var($input['customer_id'] ?? null, FILTER_VALIDATE_INT);
    $required_ship_date = sanitize_input($input['required_ship_date'] ?? '');
    $delivery_note = sanitize_input($input['delivery_note'] ?? null);
    $reference_number = sanitize_input($input['reference_number'] ?? null);

    if (empty($customer_id) || empty($required_ship_date)) { sendJsonResponse(['success' => false, 'message' => 'Customer and Required Ship Date are required.'], 400); return; }
    
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO outbound_orders (warehouse_id, customer_id, required_ship_date, status, delivery_note, reference_number) VALUES (?, ?, ?, 'New', ?, ?)");
        $stmt->bind_param("iisss", $warehouse_id, $customer_id, $required_ship_date, $delivery_note, $reference_number);

        if (!$stmt->execute()) { throw new Exception('Failed to create initial outbound order record: ' . $stmt->error, 500); }
        $order_id = $stmt->insert_id;
        $stmt->close();
        $order_number = 'ORD-' . date('Ymd') . '-' . str_pad($order_id, 4, '0', STR_PAD_LEFT);
        $stmt_update = $conn->prepare("UPDATE outbound_orders SET order_number = ? WHERE order_id = ?");
        $stmt_update->bind_param("si", $order_number, $order_id);
        if (!$stmt_update->execute()) { throw new Exception('Failed to set the order number.', 500); }
        $stmt_update->close();
        logOrderHistory($conn, $order_id, 'New', $user_id, "Order created with number: $order_number");
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Outbound order $order_number created successfully.", 'order_id' => $order_id], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleAddItemToOrder($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $order_id = (int)$input['order_id'];
    $product_article_no = trim($input['product_article_no'] ?? '');
    $ordered_quantity = filter_var($input['ordered_quantity'] ?? 0, FILTER_VALIDATE_INT);
    if (empty($order_id) || empty($product_article_no) || $ordered_quantity <= 0) { sendJsonResponse(['success' => false, 'message' => 'Order ID, Product Article No, and Quantity are required.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT order_id FROM outbound_orders WHERE order_id = ? AND warehouse_id = ?");
        $stmt->bind_param("ii", $order_id, $warehouse_id);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) { throw new Exception("Order not found or does not belong to selected warehouse."); }
        $stmt->close();
        $stmt = $conn->prepare("SELECT product_id, is_active FROM products WHERE article_no = ?");
        $stmt->bind_param("s", $product_article_no);
        $stmt->execute();
        $product_data = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$product_data) { throw new Exception("Product not found with the provided Article No."); }
        if ($product_data['is_active'] != 1) {
            throw new Exception("Cannot add an inactive product to an order.");
        }
        $product_id = $product_data['product_id'];
        $stmt = $conn->prepare("SELECT outbound_item_id, ordered_quantity FROM outbound_items WHERE order_id = ? AND product_id = ?");
        $stmt->bind_param("ii", $order_id, $product_id);
        $stmt->execute();
        $existing_item = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($existing_item) {
            $new_quantity = $existing_item['ordered_quantity'] + $ordered_quantity;
            $stmt = $conn->prepare("UPDATE outbound_items SET ordered_quantity = ? WHERE outbound_item_id = ?");
            $stmt->bind_param("ii", $new_quantity, $existing_item['outbound_item_id']);
        } else {
            $stmt = $conn->prepare("INSERT INTO outbound_items (order_id, product_id, ordered_quantity) VALUES (?, ?, ?)");
            $stmt->bind_param("iii", $order_id, $product_id, $ordered_quantity);
        }
        if (!$stmt->execute()) { throw new Exception("Failed to add/update item in order: " . $stmt->error); }
        $stmt->close();
        updateOutboundItemAndOrderStatus($conn, $order_id, $_SESSION['user_id']);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Item added/updated in order.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleUpdateOrderItem($conn, $warehouse_id, $user_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $outbound_item_id = filter_var($input['outbound_item_id'] ?? 0, FILTER_VALIDATE_INT);
    $new_quantity = filter_var($input['new_quantity'] ?? 0, FILTER_VALIDATE_INT);
    if (empty($outbound_item_id) || $new_quantity <= 0) { sendJsonResponse(['success' => false, 'message' => 'Valid Item ID and a quantity greater than 0 are required.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT oi.order_id, oo.status, oi.picked_quantity FROM outbound_items oi JOIN outbound_orders oo ON oi.order_id = oo.order_id WHERE oi.outbound_item_id = ? AND oo.warehouse_id = ?");
        $stmt->bind_param("ii", $outbound_item_id, $warehouse_id);
        $stmt->execute();
        $item_data = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$item_data) throw new Exception("Item not found or does not belong to this warehouse.");
        if ($item_data['status'] === 'Shipped' || $item_data['status'] === 'Delivered') throw new Exception("Cannot edit item in an order that has already been shipped.");
        if ($new_quantity < $item_data['picked_quantity']) throw new Exception("New quantity cannot be less than the quantity already picked (" . $item_data['picked_quantity'] . "). Please un-pick items first.");
        $stmt = $conn->prepare("UPDATE outbound_items SET ordered_quantity = ? WHERE outbound_item_id = ?");
        $stmt->bind_param("ii", $new_quantity, $outbound_item_id);
        if (!$stmt->execute()) throw new Exception("Failed to update item quantity.");
        $stmt->close();
        updateOutboundItemAndOrderStatus($conn, $item_data['order_id'], $user_id);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Item quantity updated successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleDeleteOrderItem($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $outbound_item_id = filter_var($input['outbound_item_id'] ?? 0, FILTER_VALIDATE_INT);
    if (empty($outbound_item_id)) { sendJsonResponse(['success' => false, 'message' => 'Valid Item ID is required.'], 400); return; }
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT oi.order_id, oo.status, oi.picked_quantity FROM outbound_items oi JOIN outbound_orders oo ON oi.order_id = oo.order_id WHERE oi.outbound_item_id = ? AND oo.warehouse_id = ?");
        $stmt->bind_param("ii", $outbound_item_id, $warehouse_id);
        $stmt->execute();
        $item_data = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$item_data) throw new Exception("Item not found or does not belong to this warehouse.");
        if ($item_data['status'] === 'Shipped' || $item_data['status'] === 'Delivered') throw new Exception("Cannot delete item from an order that has already been shipped.");
        if ($item_data['picked_quantity'] > 0) throw new Exception("Cannot delete an item that has already been picked. Please un-pick the item first if you need to remove it.");
        $stmt = $conn->prepare("DELETE FROM outbound_items WHERE outbound_item_id = ?");
        $stmt->bind_param("i", $outbound_item_id);
        if (!$stmt->execute()) throw new Exception("Failed to delete item from order.");
        $stmt->close();
        updateOutboundItemAndOrderStatus($conn, $item_data['order_id'], $_SESSION['user_id']);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Item removed from order successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function updateOutboundItemAndOrderStatus($conn, $order_id, $user_id) {
    $sql = "UPDATE outbound_items oi LEFT JOIN (SELECT outbound_item_id, SUM(picked_quantity) as total_picked FROM outbound_item_picks GROUP BY outbound_item_id) p ON oi.outbound_item_id = p.outbound_item_id SET oi.picked_quantity = COALESCE(p.total_picked, 0) WHERE oi.order_id = ?;";
    $stmt_update_items = $conn->prepare($sql);
    $stmt_update_items->bind_param("i", $order_id);
    $stmt_update_items->execute();
    $stmt_update_items->close();
    $stmt_sums = $conn->prepare("SELECT SUM(ordered_quantity) AS total_ordered, SUM(picked_quantity) AS total_picked FROM outbound_items WHERE order_id = ?");
    $stmt_sums->bind_param("i", $order_id);
    $stmt_sums->execute();
    $sums = $stmt_sums->get_result()->fetch_assoc();
    $stmt_sums->close();
    $new_status = 'Pending Pick';
    if ($sums['total_ordered'] > 0) {
        if ($sums['total_picked'] > 0) {
            $new_status = ($sums['total_picked'] >= $sums['total_ordered']) ? 'Picked' : 'Partially Picked';
        }
    } else {
        $new_status = 'New';
    }
    $stmt_update_order = $conn->prepare("UPDATE outbound_orders SET status = ? WHERE order_id = ?");
    $stmt_update_order->bind_param("si", $new_status, $order_id);
    $stmt_update_order->execute();
    $stmt_update_order->close();
}
