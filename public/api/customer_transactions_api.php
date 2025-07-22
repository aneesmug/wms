<?php
// api/customer_transactions.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        authorize_user_role(['viewer', 'operator', 'manager']);
        handleGetTransactions($conn);
        break;
    case 'POST':
        authorize_user_role(['operator', 'manager']);
        handleCreateTransaction($conn);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetTransactions($conn) {
    $customer_id = filter_input(INPUT_GET, 'customer_id', FILTER_VALIDATE_INT);
    if (!$customer_id) {
        sendJsonResponse(['success' => false, 'message' => 'A valid Customer ID is required.'], 400);
        return;
    }
    $stmt = $conn->prepare("SELECT ct.transaction_id, ct.transaction_type, ct.amount, ct.transaction_date, ct.notes, oo.order_number, u.full_name as created_by_user FROM customer_transactions ct LEFT JOIN outbound_orders oo ON ct.order_id = oo.order_id LEFT JOIN users u ON ct.created_by = u.user_id WHERE ct.customer_id = ? ORDER BY ct.transaction_date DESC");
    $stmt->bind_param("i", $customer_id);
    $stmt->execute();
    $transactions = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $transactions]);
}

function handleCreateTransaction($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $customer_id = filter_var($input['customer_id'] ?? null, FILTER_VALIDATE_INT);
    $order_id = filter_var($input['order_id'] ?? null, FILTER_VALIDATE_INT) ?: null;
    $transaction_type = sanitize_input($input['transaction_type'] ?? '');
    $amount = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT);
    $notes = sanitize_input($input['notes'] ?? '');
    $created_by = $_SESSION['user_id'];

    if (!$customer_id || empty($transaction_type) || $amount === null) {
        sendJsonResponse(['success' => false, 'message' => 'Customer ID, Transaction Type, and Amount are required.'], 400);
        return;
    }
    
    $valid_types = ['payment', 'refund', 'credit', 'debit'];
    if (!in_array($transaction_type, $valid_types)) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid transaction type.'], 400);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO customer_transactions (customer_id, order_id, transaction_type, amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iisdsi", $customer_id, $order_id, $transaction_type, $amount, $notes, $created_by);

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Transaction created successfully', 'transaction_id' => $stmt->insert_id], 201);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to create transaction.', 'error' => $stmt->error], 500);
    }
    $stmt->close();
}
