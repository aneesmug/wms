<?php
/**
 * api/public_tracking_api.php
 * Provides a public endpoint to fetch order details and history using a tracking number.
 * This version includes its own database connection to bypass potential include path issues.
 */
// Set required headers
header('Content-Type: application/json');
// --- Robust File Inclusion for Helper ---
// We still need the helper function.
require_once __DIR__ . '/../config/config.php';
require_once dirname(__DIR__) . '/helpers/order_helper.php';

$conn = getDbConnection();
ob_start();

// Initialize the response array
$response = ['status' => 'error', 'message' => 'Invalid request.'];

// **Critical Check:** Ensure the database connection is valid before proceeding.
if ($conn->connect_error) {
    error_log("Direct DB connection failed in public_tracking_api.php: " . $conn->connect_error);
    $response['message'] = 'A connection error occurred with the tracking service.';
    echo json_encode($response);
    exit(); // Stop execution immediately
}

// Check if a tracking number is provided and not empty
if (isset($_GET['tracking_number']) && !empty(trim($_GET['tracking_number']))) {
    $trackingNumber = trim($_GET['tracking_number']);

    // Use the helper function to get order data
    $orderData = get_order_by_tracking_number($trackingNumber, $conn);

    if ($orderData) {
        // Success response if order is found
        $response = [
            'status' => 'success',
            'order' => $orderData
        ];
    } else {
        // Not found response
        $response['message'] = 'Tracking number not found.';
    }
} else {
    $response['message'] = 'Please provide a valid tracking number.';
}

// Close the database connection
$conn->close();

// Send the final JSON response
echo json_encode($response);
