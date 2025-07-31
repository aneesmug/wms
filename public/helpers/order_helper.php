<?php
// helpers/order_helper.php

if (!function_exists('logOrderHistory')) {
    /**
     * Logs an entry into the order_history table.
     *
     * @param mysqli $conn The database connection object.
     * @param int $order_id The ID of the order to log history for.
     * @param string $status The new status of the order.
     * @param int $user_id The ID of the user performing the action.
     * @param string $notes Optional notes about the history event.
     * @return void
     */
    function logOrderHistory($conn, $order_id, $status, $user_id, $notes = '') {
        $stmt = $conn->prepare("INSERT INTO order_history (order_id, status, updated_by_user_id, notes) VALUES (?, ?, ?, ?)");
        if (!$stmt) {
            // Log error if prepare fails
            error_log("Prepare failed for logOrderHistory: " . $conn->error);
            return;
        }
        
        $stmt->bind_param("isis", $order_id, $status, $user_id, $notes);
        
        if (!$stmt->execute()) {
            // Log error if execute fails
            error_log("Failed to log order history for order_id {$order_id}: " . $stmt->error);
        }
        
        $stmt->close();
    }
}

function get_order_by_tracking_number($trackingNumber, $conn) {
    // Defensive check to ensure the database connection object is valid.
    if (!$conn || !($conn instanceof mysqli)) {
        error_log("Invalid database connection provided to get_order_by_tracking_number.");
        return null; // Return null to indicate failure and prevent fatal errors.
    }

    // Fetches the main order details, using the correct column 'required_ship_date'
    // and aliasing it as 'expected_delivery_date' for front-end compatibility.
    $sql = "SELECT o.order_id, o.status, o.required_ship_date AS expected_delivery_date
            FROM outbound_orders o
            WHERE o.tracking_number = ?";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        // Handle SQL preparation error
        error_log("SQL prepare failed for outbound_orders: " . $conn->error);
        return null;
    }

    $stmt->bind_param("s", $trackingNumber);
    $stmt->execute();
    $result = $stmt->get_result();
    $order = $result->fetch_assoc();
    $stmt->close();

    // If an order was found, fetch its history
    if ($order) {
        // --- CORRECTED SQL QUERY for order_history ---
        // Selects from the correct columns 'status' and 'created_at' and renames them
        // to 'status_update' and 'timestamp' for front-end compatibility.
        $sql_history = "SELECT oh.status AS status_update, oh.created_at AS timestamp
                        FROM order_history oh
                        WHERE oh.order_id = ?
                        ORDER BY oh.created_at DESC";

        $stmt_history = $conn->prepare($sql_history);
        if ($stmt_history) {
            $stmt_history->bind_param("i", $order['order_id']);
            $stmt_history->execute();
            $result_history = $stmt_history->get_result();

            $history = [];
            while ($row = $result_history->fetch_assoc()) {
                $history[] = $row;
            }
            $order['history'] = $history;
            $stmt_history->close();
        } else {
            // Handle SQL preparation error for history
            error_log("SQL prepare failed for order_history: " . $conn->error);
            $order['history'] = [];
        }
        return $order;
    }

    // Return null if no order was found
    return null;
}