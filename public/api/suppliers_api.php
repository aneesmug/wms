<?php
// api/suppliers.php

// CRITICAL: Ensure NO whitespace, BOM, or any characters before this opening PHP tag.

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(); // Suppliers can be managed by authenticated users

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetSuppliers($conn);
        break;
    case 'POST':
        handleCreateSupplier($conn);
        break;
    case 'PUT':
        handleUpdateSupplier($conn);
        break;
    case 'DELETE':
        handleDeleteSupplier($conn);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetSuppliers($conn) {
    if (isset($_GET['id'])) {
        $supplier_id = sanitize_input($_GET['id']);
        $stmt = $conn->prepare("SELECT * FROM suppliers WHERE supplier_id = ?");
        $stmt->bind_param("i", $supplier_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($supplier = $result->fetch_assoc()) {
            sendJsonResponse(['success' => true, 'data' => $supplier]);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Supplier not found'], 404);
        }
        $stmt->close();
    } else {
        // MODIFIED: Removed "WHERE is_active = TRUE" to fetch all suppliers for the DataTable
        $result = $conn->query("SELECT * FROM suppliers ORDER BY supplier_name ASC");
        if (!$result) {
            // It's better to throw an exception here and let the global error handler catch it
            // This prevents sending a JSON response before headers are finalized.
            error_log("Database query failed in handleGetSuppliers: " . $conn->error);
            sendJsonResponse(['success' => false, 'message' => 'Error fetching suppliers.'], 500);
            return;
        }
        $suppliers = [];
        while ($row = $result->fetch_assoc()) {
            $suppliers[] = $row;
        }
        // This is the format DataTables expects by default ({ "data": [...] })
        sendJsonResponse(['success' => true, 'data' => $suppliers]);
    }
}

function handleCreateSupplier($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $supplier_name = sanitize_input($input['supplier_name'] ?? '');
    $contact_person = sanitize_input($input['contact_person'] ?? null);
    $email = sanitize_input($input['email'] ?? null);
    $phone = sanitize_input($input['phone'] ?? null);
    // Address fields are not in the new form, but keeping them in the backend is fine
    $address_line1 = sanitize_input($input['address_line1'] ?? '');
    $address_line2 = sanitize_input($input['address_line2'] ?? '');
    $city = sanitize_input($input['city'] ?? '');
    $state = sanitize_input($input['state'] ?? '');
    $zip_code = sanitize_input($input['zip_code'] ?? '');
    $country = sanitize_input($input['country'] ?? '');
    $payment_terms = sanitize_input($input['payment_terms'] ?? null);
    $tax_id = sanitize_input($input['tax_id'] ?? null);
    $is_active = isset($input['is_active']) ? (int)(bool)$input['is_active'] : 1;


    if (empty($supplier_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Supplier Name is required'], 400);
        return;
    }

    $stmt = $conn->prepare("INSERT INTO suppliers (supplier_name, contact_person, email, phone, address_line1, address_line2, city, state, zip_code, country, payment_terms, tax_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssssssssis", 
        $supplier_name, $contact_person, $email, $phone, $address_line1, $address_line2, 
        $city, $state, $zip_code, $country, $payment_terms, $tax_id, $is_active
    );

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Supplier created successfully', 'supplier_id' => $stmt->insert_id], 201);
    } else {
        if ($conn->errno == 1062) { // Duplicate entry for supplier_name
            sendJsonResponse(['success' => false, 'message' => 'A supplier with this name already exists.'], 409);
        } else {
            error_log("Failed to create supplier: " . $conn->error);
            sendJsonResponse(['success' => false, 'message' => 'Failed to create supplier'], 500);
        }
    }
    $stmt->close();
}

function handleUpdateSupplier($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $supplier_id = sanitize_input($input['supplier_id'] ?? '');
    if (empty($supplier_id)) {
        sendJsonResponse(['success' => false, 'message' => 'Supplier ID is required for update'], 400);
        return;
    }

    // Initialize an array to hold the fields to be updated
    $fields = [];
    if (isset($input['supplier_name'])) $fields['supplier_name'] = sanitize_input($input['supplier_name']);
    if (isset($input['contact_person'])) $fields['contact_person'] = sanitize_input($input['contact_person']);
    if (isset($input['email'])) $fields['email'] = sanitize_input($input['email']);
    if (isset($input['phone'])) $fields['phone'] = sanitize_input($input['phone']);
    if (isset($input['payment_terms'])) $fields['payment_terms'] = sanitize_input($input['payment_terms']);
    if (isset($input['tax_id'])) $fields['tax_id'] = sanitize_input($input['tax_id']);
    if (array_key_exists('is_active', $input)) $fields['is_active'] = (int)(bool)$input['is_active'];

    if (empty($fields)) {
        sendJsonResponse(['success' => true, 'message' => 'No fields provided for update.'], 200); 
        return; 
    }
    
    // Check for duplicate supplier name
    if (isset($fields['supplier_name'])) {
        $stmt_check = $conn->prepare("SELECT supplier_id FROM suppliers WHERE supplier_name = ? AND supplier_id != ?");
        $stmt_check->bind_param("si", $fields['supplier_name'], $supplier_id);
        $stmt_check->execute();
        if ($stmt_check->get_result()->num_rows > 0) {
            sendJsonResponse(['success' => false, 'message' => 'Another supplier with this name already exists.'], 409);
            $stmt_check->close();
            return;
        }
        $stmt_check->close();
    }

    $set_clauses = [];
    $bind_params = [];
    $bind_types = "";

    foreach ($fields as $key => $value) {
        $set_clauses[] = "$key = ?";
        $bind_params[] = &$fields[$key]; // Pass by reference for bind_param
        $bind_types .= ($key === 'is_active') ? 'i' : 's';
    }

    $sql = "UPDATE suppliers SET " . implode(", ", $set_clauses) . " WHERE supplier_id = ?";
    $bind_params[] = &$supplier_id;
    $bind_types .= "i";

    $stmt = $conn->prepare($sql);
    // Use call_user_func_array to bind params dynamically
    call_user_func_array([$stmt, 'bind_param'], array_merge([$bind_types], $bind_params));

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            sendJsonResponse(['success' => true, 'message' => 'Supplier updated successfully'], 200);
        } else {
            // Check if the supplier actually exists
            $stmt_check_exists = $conn->prepare("SELECT supplier_id FROM suppliers WHERE supplier_id = ?");
            $stmt_check_exists->bind_param("i", $supplier_id);
            $stmt_check_exists->execute();
            if ($stmt_check_exists->get_result()->num_rows > 0) {
                sendJsonResponse(['success' => true, 'message' => 'No changes were made to the supplier.'], 200);
            } else {
                sendJsonResponse(['success' => false, 'message' => 'Supplier not found'], 404);
            }
            $stmt_check_exists->close();
        }
    } else {
        error_log("Failed to update supplier: " . $conn->error);
        sendJsonResponse(['success' => false, 'message' => 'Failed to update supplier'], 500);
    }
    $stmt->close();
}

function handleDeleteSupplier($conn) {
    if (!isset($_GET['id'])) {
        sendJsonResponse(['success' => false, 'message' => 'Supplier ID is required for deletion'], 400);
        return;
    }
    $supplier_id = sanitize_input($_GET['id']);

    // Check if supplier is referenced in inbound receipts
    $stmt_check_receipts = $conn->prepare("SELECT COUNT(*) FROM inbound_receipts WHERE supplier_id = ?");
    $stmt_check_receipts->bind_param("i", $supplier_id);
    $stmt_check_receipts->execute();
    $result_check = $stmt_check_receipts->get_result()->fetch_row();
    $stmt_check_receipts->close();

    if ($result_check[0] > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Cannot delete supplier: It is referenced by existing inbound receipts.'], 400);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM suppliers WHERE supplier_id = ?");
    $stmt->bind_param("i", $supplier_id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            sendJsonResponse(['success' => true, 'message' => 'Supplier deleted successfully'], 200);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Supplier not found'], 404);
        }
    } else {
        error_log("Failed to delete supplier: " . $conn->error);
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete supplier'], 500);
    }
    $stmt->close();
}

