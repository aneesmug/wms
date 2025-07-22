<?php
// api/customers.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

// Authenticate user. Although customers are global, actions on them are controlled
// by the user's role within their selected warehouse context.
// We require a warehouse to be selected to establish the user's permission level.
authenticate_user(true, null);

$method = $_SERVER['REQUEST_METHOD'];

// Authorize based on the request method and user's role.
switch ($method) {
    case 'GET':
        // Any authenticated user with a role can view customers.
        authorize_user_role(['viewer', 'operator', 'manager']);
        handleGetCustomers($conn);
        break;
    case 'POST':
        // Only operators and managers can create new customers.
        authorize_user_role(['operator', 'manager']);
        handleCreateCustomer($conn);
        break;
    case 'PUT':
        // Only operators and managers can update customers.
        authorize_user_role(['operator', 'manager']);
        handleUpdateCustomer($conn);
        break;
    case 'DELETE':
        // Deleting customers is restricted to managers.
        authorize_user_role(['manager']);
        handleDeleteCustomer($conn);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetCustomers($conn) {
    if (isset($_GET['id'])) {
        $customer_id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
        if (!$customer_id) {
            sendJsonResponse(['success' => false, 'message' => 'Invalid Customer ID.'], 400);
            return;
        }
        $stmt = $conn->prepare("SELECT * FROM customers WHERE customer_id = ?");
        $stmt->bind_param("i", $customer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($customer = $result->fetch_assoc()) {
            sendJsonResponse(['success' => true, 'data' => $customer]);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Customer not found'], 404);
        }
        $stmt->close();
    } else {
        $result = $conn->query("SELECT * FROM customers ORDER BY customer_name ASC");
        if (!$result) {
            error_log("handleGetCustomers SQL Error: " . $conn->error);
            sendJsonResponse(['success' => false, 'message' => 'Database query failed.'], 500);
            return;
        }
        $customers = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse(['success' => true, 'data' => $customers]);
    }
}

function handleCreateCustomer($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $customer_name = sanitize_input($input['customer_name'] ?? '');
    if (empty($customer_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Customer Name is required'], 400);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO customers (customer_name, contact_person, email, phone, address_line1, address_line2, city, state, zip_code, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param(
        "ssssssssss",
        $customer_name,
        sanitize_input($input['contact_person'] ?? null),
        sanitize_input($input['email'] ?? null),
        sanitize_input($input['phone'] ?? null),
        sanitize_input($input['address_line1'] ?? null),
        sanitize_input($input['address_line2'] ?? null),
        sanitize_input($input['city'] ?? null),
        sanitize_input($input['state'] ?? null),
        sanitize_input($input['zip_code'] ?? null),
        sanitize_input($input['country'] ?? null)
    );

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Customer created successfully', 'customer_id' => $stmt->insert_id], 201);
    } else {
        if ($conn->errno == 1062) { // Duplicate entry
            sendJsonResponse(['success' => false, 'message' => 'A customer with this name already exists.'], 409);
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

    $fields = ['customer_name', 'contact_person', 'email', 'phone', 'address_line1', 'address_line2', 'city', 'state', 'zip_code', 'country'];
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
        if ($stmt->affected_rows > 0) {
            sendJsonResponse(['success' => true, 'message' => 'Customer updated successfully.'], 200);
        } else {
            sendJsonResponse(['success' => true, 'message' => 'No changes were made to the customer.'], 200);
        }
    } else {
        if ($conn->errno == 1062) {
             sendJsonResponse(['success' => false, 'message' => 'Update failed: A customer with this name already exists.'], 409);
        } else {
             sendJsonResponse(['success' => false, 'message' => 'Failed to update customer.', 'error' => $stmt->error], 500);
        }
    }
    $stmt->close();
}

function handleDeleteCustomer($conn) {
    $customer_id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
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
