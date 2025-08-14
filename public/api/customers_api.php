<?php
// api/customers_api.php

// MODIFICATION SUMMARY:
// 1. New action 'get_order_history': Fetches a detailed list of all items a customer has ordered, including the specific DOT code for each item from the original pick. It also calculates the quantity already returned for each item.
// 2. handleGetCustomerDetails: This function has been simplified. It no longer fetches detailed order and item information, as this is now handled by the new 'get_order_history' action, making the initial load faster.

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        authorize_user_role(['viewer', 'operator', 'manager']);
        if ($action === 'get_details') {
            handleGetCustomerDetails($conn);
        } elseif ($action === 'get_order_history') {
            // MODIFICATION: Added new action
            handleGetCustomerOrderHistory($conn);
        } else {
            handleGetCustomers($conn);
        }
        break;
    case 'POST':
        if ($action === 'delete') {
            authorize_user_role(['manager']);
            handleDeleteCustomer($conn);
        } else {
            authorize_user_role(['operator', 'manager']);
            handleCreateCustomer($conn);
        }
        break;
    case 'PUT':
        authorize_user_role(['operator', 'manager']);
        handleUpdateCustomer($conn);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

// MODIFICATION: New function to get detailed order history with DOT codes
function handleGetCustomerOrderHistory($conn) {
    $customer_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$customer_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Customer ID.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT
            oo.order_id,
            oo.order_number,
            oo.order_date,
            p.product_id,
            p.product_name,
            p.sku,
            p.article_no,
            oi.outbound_item_id,
            oip.dot_code,
            oip.picked_quantity,
            (
                SELECT COALESCE(SUM(ri_sub.expected_quantity), 0)
                FROM return_items ri_sub
                JOIN returns r_sub ON ri_sub.return_id = r_sub.return_id
                WHERE ri_sub.outbound_item_id = oi.outbound_item_id
                AND r_sub.status != 'Cancelled'
            ) as returned_quantity
        FROM
            outbound_orders oo
        JOIN
            outbound_items oi ON oo.order_id = oi.order_id
        JOIN
            products p ON oi.product_id = p.product_id
        LEFT JOIN
            outbound_item_picks oip ON oi.outbound_item_id = oip.outbound_item_id
        WHERE
            oo.customer_id = ?
            AND oo.status IN ('Shipped', 'Delivered', 'Partially Returned', 'Returned')
            AND oi.picked_quantity > 0
        GROUP BY
            oi.outbound_item_id, oo.order_id, oo.order_number, oo.order_date, p.product_id, p.product_name, p.sku, p.article_no, oip.dot_code, oip.picked_quantity
        ORDER BY
            oo.order_date DESC, p.product_name ASC
    ");

    $stmt->bind_param("i", $customer_id);
    $stmt->execute();
    $history = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJsonResponse(['success' => true, 'data' => $history]);
}


function handleGetCustomerDetails($conn) {
    $customer_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$customer_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Customer ID.'], 400);
        return;
    }

    $stmt_details = $conn->prepare("SELECT * FROM customers WHERE customer_id = ?");
    $stmt_details->bind_param("i", $customer_id);
    $stmt_details->execute();
    $details = $stmt_details->get_result()->fetch_assoc();
    $stmt_details->close();

    if (!$details) {
        sendJsonResponse(['success' => false, 'message' => 'Customer not found.'], 404);
        return;
    }
    
    // MODIFICATION: Simplified this function. No longer fetching all orders and items here.
    // That logic is moved to the new handleGetCustomerOrderHistory function.
    $stmt_orders = $conn->prepare("SELECT order_id, order_number, status, order_date FROM outbound_orders WHERE customer_id = ? ORDER BY order_date DESC");
    $stmt_orders->bind_param("i", $customer_id);
    $stmt_orders->execute();
    $orders = $stmt_orders->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_orders->close();

    $stmt_returns = $conn->prepare("SELECT return_id, return_number, status, created_at FROM returns WHERE customer_id = ? ORDER BY created_at DESC");
    $stmt_returns->bind_param("i", $customer_id);
    $stmt_returns->execute();
    $returns = $stmt_returns->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_returns->close();

    sendJsonResponse(['success' => true, 'data' => [
        'details' => $details,
        'orders' => $orders,
        'returns' => $returns
    ]]);
}

function handleGetCustomers($conn) {
    $sql = "
        SELECT 
            c.customer_id, 
            c.customer_code, 
            c.customer_name, 
            c.contact_person, 
            c.email, 
            c.phone, 
            c.city,
            (SELECT COUNT(*) FROM outbound_orders oo WHERE oo.customer_id = c.customer_id) as order_count
        FROM customers c 
        ORDER BY c.customer_name ASC
    ";
    $result = $conn->query($sql);
    if (!$result) {
        error_log("handleGetCustomers SQL Error: " . $conn->error);
        sendJsonResponse(['success' => false, 'message' => 'Database query failed.'], 500);
        return;
    }
    $customers = $result->fetch_all(MYSQLI_ASSOC);
    sendJsonResponse(['success' => true, 'data' => $customers]);
}

function validateCustomerData($input) {
    $errors = [];
    $required_fields = [
        'customer_name' => 'Customer Name',
        'customer_code' => 'Customer Code',
        'contact_person' => 'Contact Person',
        'phone' => 'Phone',
        'address_line1' => 'Address Line 1',
        'country' => 'Country',
        'city' => 'City'
    ];

    foreach ($required_fields as $field => $label) {
        if (empty(trim($input[$field] ?? ''))) {
            $errors[] = $label;
        }
    }

    if (!empty($errors)) {
        return "The following fields are required: " . implode(', ', $errors) . '.';
    }
    return null;
}

function handleCreateCustomer($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $validation_error = validateCustomerData($input);
    if ($validation_error) {
        sendJsonResponse(['success' => false, 'message' => $validation_error], 400);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO customers (customer_code, customer_name, contact_person, email, phone, phone2, address_line1, address_line2, city, state, zip_code, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param(
        "ssssssssssss",
        sanitize_input($input['customer_code']),
        sanitize_input($input['customer_name']),
        sanitize_input($input['contact_person']),
        sanitize_input($input['email'] ?? null),
        sanitize_input($input['phone']),
        sanitize_input($input['phone2'] ?? null),
        sanitize_input($input['address_line1']),
        sanitize_input($input['address_line2'] ?? null),
        sanitize_input($input['city']),
        sanitize_input($input['state'] ?? null),
        sanitize_input($input['zip_code'] ?? null),
        sanitize_input($input['country'])
    );

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Customer created successfully', 'customer_id' => $stmt->insert_id], 201);
    } else {
        if ($conn->errno == 1062) {
            sendJsonResponse(['success' => false, 'message' => 'A customer with this name or code already exists.'], 409);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Failed to create customer', 'error' => $stmt->error], 500);
        }
    }
    $stmt->close();
}

function handleUpdateCustomer($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $customer_id = filter_var($input['customer_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$customer_id) {
        sendJsonResponse(['success' => false, 'message' => 'Customer ID is required for update.'], 400);
        return;
    }

    $validation_error = validateCustomerData($input);
    if ($validation_error) {
        sendJsonResponse(['success' => false, 'message' => $validation_error], 400);
        return;
    }

    $fields = ['customer_code', 'customer_name', 'contact_person', 'email', 'phone', 'phone2', 'address_line1', 'address_line2', 'city', 'state', 'zip_code', 'country'];
    $set_clauses = [];
    $bind_params = [];
    $bind_types = "";

    foreach ($fields as $field) {
        if (isset($input[$field])) {
            $set_clauses[] = "$field = ?";
            $bind_params[] = sanitize_input($input[$field]);
            $bind_types .= "s";
        }
    }

    if (empty($set_clauses)) {
        sendJsonResponse(['success' => true, 'message' => 'No fields provided for update.'], 200);
        return;
    }

    $sql = "UPDATE customers SET " . implode(", ", $set_clauses) . " WHERE customer_id = ?";
    $bind_types .= "i";
    $bind_params[] = $customer_id;

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($bind_types, ...$bind_params);

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Customer updated successfully.'], 200);
    } else {
        if ($conn->errno == 1062) {
             sendJsonResponse(['success' => false, 'message' => 'Update failed: A customer with this name or code already exists.'], 409);
        } else {
             sendJsonResponse(['success' => false, 'message' => 'Failed to update customer.', 'error' => $stmt->error], 500);
        }
    }
    $stmt->close();
}

function handleDeleteCustomer($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $customer_id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$customer_id) {
        sendJsonResponse(['success' => false, 'message' => 'Customer ID is required for deletion.'], 400);
        return;
    }
    
    $stmt_check = $conn->prepare("SELECT COUNT(*) as order_count FROM outbound_orders WHERE customer_id = ?");
    $stmt_check->bind_param("i", $customer_id);
    $stmt_check->execute();
    $order_count = $stmt_check->get_result()->fetch_assoc()['order_count'];
    $stmt_check->close();

    if ($order_count > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Cannot delete customer: They have existing outbound orders.'], 409);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM customers WHERE customer_id = ?");
    $stmt->bind_param("i", $customer_id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            sendJsonResponse(['success' => true, 'message' => 'Customer deleted successfully.'], 200);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Customer not found.'], 404);
        }
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete customer.', 'error' => $stmt->error], 500);
    }
    $stmt->close();
}
