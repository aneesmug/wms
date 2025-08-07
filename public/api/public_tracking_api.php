<?php
/**
 * api/public_tracking_api.php
 * Provides a public endpoint to fetch order details and history using a tracking number or order number.
 */
header('Content-Type: application/json');

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

$response = ['status' => 'error', 'message' => 'Invalid request.'];

if ($conn->connect_error) {
    error_log("DB connection failed in public_tracking_api.php: " . $conn->connect_error);
    $response['message'] = 'A connection error occurred with the tracking service.';
    echo json_encode($response);
    exit();
}

$tracking_or_order_number = trim($_GET['tracking_number'] ?? '');

if (!empty($tracking_or_order_number)) {
    // MODIFICATION: Replaced helper function with direct, robust queries to ensure history is fetched.
    $stmt = $conn->prepare("
        SELECT 
            oo.order_id,
            oo.order_number,
            oo.tracking_number,
            oo.status,
            oo.required_ship_date,
            c.customer_name
        FROM outbound_orders oo
        JOIN customers c ON oo.customer_id = c.customer_id
        WHERE oo.tracking_number = ? OR oo.order_number = ?
    ");
    $stmt->bind_param("ss", $tracking_or_order_number, $tracking_or_order_number);
    $stmt->execute();
    $orderData = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($orderData) {
        $order_id = $orderData['order_id'];
        
        // Fetch the order history
        $stmt_history = $conn->prepare("
            SELECT 
                oh.status as status_update,
                oh.notes,
                oh.created_at as timestamp
            FROM order_history oh
            WHERE oh.order_id = ?
            ORDER BY oh.created_at DESC
        ");
        $stmt_history->bind_param("i", $order_id);
        $stmt_history->execute();
        $history = $stmt_history->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_history->close();
        
        $orderData['history'] = $history;
        
        $response = [
            'status' => 'success',
            'order' => $orderData
        ];
    } else {
        $response['message'] = 'Tracking or Order number not found.';
    }
} else {
    $response['message'] = 'Please provide a valid tracking or order number.';
}

$conn->close();
echo json_encode($response);
