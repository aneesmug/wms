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
