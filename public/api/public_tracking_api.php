<?php
// public_tracking.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once __DIR__ . '/api/config/config.php';

$conn = getDbConnection();
$input = json_decode(file_get_contents("php://input"));

$order_number = sanitize_input($input->order_number ?? '');
$customer_email = sanitize_input($input->customer_email ?? '');

if (empty($order_number) || empty($customer_email)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Order Number and Customer Email are required.']);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT oo.order_id, oo.status as current_status, c.customer_name FROM outbound_orders oo JOIN customers c ON oo.customer_id = c.customer_id WHERE oo.order_number = ? AND c.email = ?");
    $stmt->bind_param("ss", $order_number, $customer_email);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found or email does not match.']);
        exit;
    }

    $stmt = $conn->prepare("SELECT status, notes, created_at FROM order_history WHERE order_id = ? ORDER BY created_at ASC");
    $stmt->bind_param("i", $order['order_id']);
    $stmt->execute();
    $history = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'order_number' => $order_number,
            'customer_name' => $order['customer_name'],
            'current_status' => $order['current_status'],
            'history' => $history
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An internal error occurred.']);
}
$conn->close();
