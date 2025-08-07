<?php
// helpers/order_helper.php

/**
 * Logs an entry into the order_history table.
 */
function logOrderHistory($conn, $order_id, $status, $user_id, $notes = '') {
    $stmt = $conn->prepare("INSERT INTO order_history (order_id, status, notes, updated_by_user_id) VALUES (?, ?, ?, ?)");
    if ($stmt === false) {
        // Handle error, maybe log it or throw an exception
        error_log("Failed to prepare statement for logOrderHistory: " . $conn->error);
        return;
    }
    $stmt->bind_param("issi", $order_id, $status, $notes, $user_id);
    $stmt->execute();
    $stmt->close();
}

/**
 * Generates a unique order number.
 */
function generateOrderNumber($conn) {
    $date_prefix = date('Ymd');
    $stmt = $conn->prepare("SELECT COUNT(*) as today_count FROM outbound_orders WHERE order_number LIKE ?");
    $search_prefix = "ORD-" . $date_prefix . "-%";
    $stmt->bind_param("s", $search_prefix);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $next_num = $result['today_count'] + 1;
    $stmt->close();
    return "ORD-" . $date_prefix . "-" . str_pad($next_num, 4, '0', STR_PAD_LEFT);
}

/**
 * Updates an order's status to 'Out for Delivery' after all items are scanned.
 * This function centralizes the logic for both in-house and third-party drivers.
 */
function updateOrderStatusToOutForDelivery($conn, $order_id) {
    $conn->begin_transaction();
    try {
        // Get assignment details to determine who shipped the order
        $stmt_assign = $conn->prepare(
            "SELECT ooa.assignment_type, ooa.driver_user_id, ooa.assigned_by_user_id, dc.company_name, ooa.third_party_driver_name 
             FROM outbound_order_assignments ooa
             LEFT JOIN delivery_companies dc ON ooa.third_party_company_id = dc.company_id
             WHERE ooa.order_id = ? ORDER BY ooa.assigned_at DESC LIMIT 1"
        );
        $stmt_assign->bind_param("i", $order_id);
        $stmt_assign->execute();
        $assignment = $stmt_assign->get_result()->fetch_assoc();
        $stmt_assign->close();

        if (!$assignment) {
            throw new Exception("No assignment found for this order.");
        }

        $shipped_by_user_id = null;
        $history_user_id = null;
        $notes = '';

        if ($assignment['assignment_type'] === 'in_house') {
            $shipped_by_user_id = $assignment['driver_user_id'];
            $history_user_id = $assignment['driver_user_id'];
            $notes = 'Driver has scanned all items. Order is now out for delivery.';
        } else { // third_party
            $shipped_by_user_id = $assignment['assigned_by_user_id']; // The employee who handed over the goods
            $history_user_id = $assignment['assigned_by_user_id'];
            $driver_info = $assignment['third_party_driver_name'] ? $assignment['third_party_driver_name'] . " from " . $assignment['company_name'] : $assignment['company_name'];
            $notes = "Third-party driver ($driver_info) has scanned all items. Order is now out for delivery.";
        }

        // Update the order status
        $new_status = 'Out for Delivery';
        $stmt_update = $conn->prepare(
            "UPDATE outbound_orders 
             SET status = ?, out_for_delivery_date = NOW(), actual_ship_date = CURDATE(), shipped_by = ? 
             WHERE order_id = ?"
        );
        $stmt_update->bind_param("sii", $new_status, $shipped_by_user_id, $order_id);
        $stmt_update->execute();
        $stmt_update->close();

        // Log this event in the order history
        logOrderHistory($conn, $order_id, $new_status, $history_user_id, $notes);

        $conn->commit();
        return ['updated' => true, 'new_status' => $new_status];
    } catch (Exception $e) {
        $conn->rollback();
        // Log the error message
        error_log("Error in updateOrderStatusToOutForDelivery: " . $e->getMessage());
        return ['updated' => false, 'error' => $e->getMessage()];
    }
}
