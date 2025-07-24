<?php
// api/products.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

// Authenticate user
authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

// Handle GET requests for specific actions
if ($method === 'GET') {
    if ($action === 'get_tire_types') {
        authorize_user_role(['picker', 'viewer', 'operator', 'manager']);
        handleGetTireTypes($conn);
        exit;
    }
}


// Apply role-based authorization for each action
switch ($method) {
    case 'GET':
        authorize_user_role(['picker', 'viewer', 'operator', 'manager']);
        if (!$current_warehouse_id) {
            sendJsonResponse(['success' => false, 'message' => 'A warehouse must be selected to view products.'], 400);
            return;
        }
        handleGetProducts($conn, $current_warehouse_id);
        break;
    case 'POST':
        authorize_user_role(['operator', 'manager']);
        handleCreateProduct($conn);
        break;
    case 'PUT':
        authorize_user_role(['operator', 'manager']);
        handleUpdateProduct($conn);
        break;
    case 'DELETE':
        authorize_user_role(['manager']);
        handleDeleteProduct($conn);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

/**
 * Fetches all tire types from the database.
 */
function handleGetTireTypes($conn) {
    $result = $conn->query("SELECT tire_type_id, tire_type_name FROM tire_types ORDER BY tire_type_name ASC");
    if ($result) {
        $tire_types = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse(['success' => true, 'data' => $tire_types]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to fetch tire types.'], 500);
    }
}


function handleGetProducts($conn, $warehouse_id) {
    // This function will now be used by DataTables, which expects a specific JSON format.
    $sql = "
        SELECT 
            p.product_id, p.sku, p.product_name, p.description,
            p.unit_of_measure, p.weight, p.volume, p.barcode,
            p.tire_type_id, p.expiry_years, -- MODIFIED: Added expiry_years
            tt.tire_type_name,
            COALESCE(inv.total_quantity, 0) AS total_quantity
        FROM 
            products p
        LEFT JOIN
            tire_types tt ON p.tire_type_id = tt.tire_type_id
        LEFT JOIN 
            (SELECT product_id, SUM(quantity) AS total_quantity 
             FROM inventory 
             WHERE warehouse_id = ? 
             GROUP BY product_id) AS inv ON p.product_id = inv.product_id
        ORDER BY 
            p.product_name ASC;
    ";
    
    $stmt = $conn->prepare($sql);
    if ($stmt === false) {
        error_log("handleGetProducts SQL Error: " . $conn->error);
        sendJsonResponse(['data' => []]); // Datatables expects 'data' array even on error
        return;
    }
    
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $products = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    sendJsonResponse(['success' => true, 'data' => $products]);
}


function handleCreateProduct($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $sku = sanitize_input($input['sku'] ?? '');
    $product_name = sanitize_input($input['product_name'] ?? '');
    if (empty($sku) || empty($product_name)) {
        sendJsonResponse(['success' => false, 'message' => 'SKU and Product Name are required'], 400);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO products (sku, product_name, description, unit_of_measure, weight, volume, barcode, tire_type_id, expiry_years) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param(
        "ssssddsis", // MODIFIED: Added 's' for expiry_years
        $sku,
        $product_name,
        sanitize_input($input['description'] ?? null),
        sanitize_input($input['unit_of_measure'] ?? null),
        filter_var($input['weight'] ?? null, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE),
        filter_var($input['volume'] ?? null, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE),
        sanitize_input($input['barcode'] ?? null),
        filter_var($input['tire_type_id'] ?? null, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE),
        filter_var($input['expiry_years'] ?? null, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE) // MODIFIED
    );

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Product created successfully', 'product_id' => $stmt->insert_id], 201);
    } else {
        if ($conn->errno == 1062) {
            sendJsonResponse(['success' => false, 'message' => 'A product with this SKU or Barcode already exists.'], 409);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Failed to create product', 'error' => $stmt->error], 500);
        }
    }
    $stmt->close();
}

function handleUpdateProduct($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $product_id = filter_var($input['product_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$product_id) {
        sendJsonResponse(['success' => false, 'message' => 'Product ID is required for update'], 400);
        return;
    }

    $fields = ['sku', 'product_name', 'description', 'unit_of_measure', 'weight', 'volume', 'barcode', 'tire_type_id', 'expiry_years']; // MODIFIED
    $set_clauses = [];
    $bind_params = [];
    $bind_types = "";

    foreach ($fields as $field) {
        if (array_key_exists($field, $input)) {
            $set_clauses[] = "$field = ?";
            $value = $input[$field];
            $bind_params[] = $value;
            if ($field === 'weight' || $field === 'volume') {
                $bind_types .= "d";
            } else if ($field === 'tire_type_id' || $field === 'expiry_years') { // MODIFIED
                $bind_types .= "i";
            }
            else {
                $bind_types .= "s";
            }
        }
    }

    if (empty($set_clauses)) {
        sendJsonResponse(['success' => true, 'message' => 'No fields provided to update.'], 200);
        return;
    }

    $sql = "UPDATE products SET " . implode(", ", $set_clauses) . " WHERE product_id = ?";
    $bind_types .= "i";
    $bind_params[] = $product_id;

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($bind_types, ...$bind_params);

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Product updated successfully.'], 200);
    } else {
        if ($conn->errno == 1062) {
            sendJsonResponse(['success' => false, 'message' => 'Update failed: This SKU or Barcode is already in use.'], 409);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Failed to update product.', 'error' => $stmt->error], 500);
        }
    }
    $stmt->close();
}

function handleDeleteProduct($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $product_id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$product_id) {
        sendJsonResponse(['success' => false, 'message' => 'Product ID is required for deletion'], 400);
        return;
    }

    $tables_to_check = ['inventory', 'inbound_items', 'outbound_items'];
    foreach ($tables_to_check as $table) {
        $stmt_check = $conn->prepare("SELECT COUNT(*) as count FROM `$table` WHERE product_id = ?");
        $stmt_check->bind_param("i", $product_id);
        $stmt_check->execute();
        $count = $stmt_check->get_result()->fetch_assoc()['count'];
        $stmt_check->close();
        if ($count > 0) {
            sendJsonResponse(['success' => false, 'message' => "Cannot delete product: It is referenced by existing {$table} records."], 409);
            return;
        }
    }

    $stmt = $conn->prepare("DELETE FROM products WHERE product_id = ?");
    $stmt->bind_param("i", $product_id);
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            sendJsonResponse(['success' => true, 'message' => 'Product deleted successfully.'], 200);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Product not found.'], 404);
        }
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete product.', 'error' => $stmt->error], 500);
    }
    $stmt->close();
}
?>
