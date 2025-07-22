<?php
// api/batch_search.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

// Authenticate user and ensure a warehouse is selected.
authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleBatchSearch($conn, $current_warehouse_id);
} else {
    sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
}

function handleBatchSearch($conn, $warehouse_id) {
    $search_term = trim($_GET['search_term'] ?? '');

    if (empty($search_term)) {
        sendJsonResponse(['success' => false, 'message' => 'A search term is required.'], 400);
        return;
    }

    // This query now uses an exact match (=) instead of LIKE.
    // This is more precise and ensures that only the exact batch or receipt number is found.
    $sql = "
        SELECT 
            i.batch_number,
            i.quantity,
            i.expiry_date,
            p.product_name,
            p.sku,
            wl.location_code,
            ir.receipt_number AS source_receipt_number
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        JOIN inbound_receipts ir ON i.receipt_id = ir.receipt_id
        WHERE i.warehouse_id = ? AND (i.batch_number = ? OR ir.receipt_number = ?)
        ORDER BY i.batch_number ASC
    ";

    $stmt = $conn->prepare($sql);
    // Bind the search term twice: once for the batch_number check and once for the receipt_number check.
    $stmt->bind_param("iss", $warehouse_id, $search_term, $search_term);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    if (empty($result)) {
        sendJsonResponse(['success' => false, 'message' => 'No printable labels found for the given Batch or Receipt No.'], 404);
        return;
    }

    sendJsonResponse(['success' => true, 'data' => $result]);
}
