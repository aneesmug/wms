<?php
// 013-delivery_companies_api.php
// api/delivery_companies_api.php
// MODIFICATION SUMMARY:
// - Added `getDrivers` action to fetch drivers for a company.
// - Added `saveDriver` action to handle creating/updating driver info, including file uploads.
// - Added `deleteDriver` action to remove a driver and their associated files.
// - Added a file upload helper function `handleDriverFileUpload`.

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
authenticate_user(true, ['manager']);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Determine if the request is multipart/form-data (for file uploads) or JSON
if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false) {
    $data = $_POST;
} else {
    $data = json_decode(file_get_contents('php://input'), true);
}


switch ($method) {
    case 'GET':
        if ($action === 'getDrivers') {
            handleGetDrivers($conn);
        } else {
            handleGetCompanies($conn);
        }
        break;
    case 'POST':
        if ($action === 'toggleStatus') {
            handleToggleStatus($conn, $data);
        } elseif ($action === 'saveDriver') {
            handleSaveDriver($conn, $_POST, $_FILES); // Pass POST and FILES separately
        } elseif ($action === 'deleteDriver') {
            handleDeleteDriver($conn, $data);
        } else {
            handleSaveCompany($conn, $data);
        }
        break;
    case 'DELETE':
        handleDeleteCompany($conn, $data);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetCompanies($conn) {
    $result = $conn->query("SELECT *, (SELECT COUNT(*) FROM delivery_company_drivers dcd WHERE dcd.company_id = dc.company_id) as driver_count FROM delivery_companies dc ORDER BY company_name ASC");
    if ($result) {
        $companies = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse(['success' => true, 'data' => $companies]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to fetch companies: ' . $conn->error], 500);
    }
}

function handleGetDrivers($conn) {
    $company_id = filter_input(INPUT_GET, 'company_id', FILTER_VALIDATE_INT);
    if (!$company_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Company ID.'], 400);
        return;
    }
    $stmt = $conn->prepare("SELECT * FROM delivery_company_drivers WHERE company_id = ? ORDER BY driver_name ASC");
    $stmt->bind_param("i", $company_id);
    $stmt->execute();
    $drivers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $drivers]);
}

function handleSaveCompany($conn, $data) {
    $company_id = filter_var($data['company_id'] ?? null, FILTER_VALIDATE_INT);
    $company_name = sanitize_input($data['company_name'] ?? '');
    $contact_person = sanitize_input($data['contact_person'] ?? null);
    $phone_number = sanitize_input($data['phone_number'] ?? null);
    $email = filter_var($data['email'] ?? null, FILTER_SANITIZE_EMAIL);

    if (empty($company_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Company Name is required.'], 400);
        return;
    }

    if ($company_id) {
        $stmt = $conn->prepare("UPDATE delivery_companies SET company_name = ?, contact_person = ?, phone_number = ?, email = ? WHERE company_id = ?");
        $stmt->bind_param("ssssi", $company_name, $contact_person, $phone_number, $email, $company_id);
    } else {
        $stmt = $conn->prepare("INSERT INTO delivery_companies (company_name, contact_person, phone_number, email) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $company_name, $contact_person, $phone_number, $email);
    }

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Company saved successfully.']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to save company: ' . $stmt->error], 500);
    }
    $stmt->close();
}

function handleToggleStatus($conn, $data) {
    $company_id = filter_var($data['company_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$company_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Company ID.'], 400);
        return;
    }
    $stmt = $conn->prepare("UPDATE delivery_companies SET is_active = !is_active WHERE company_id = ?");
    $stmt->bind_param("i", $company_id);
    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Company status updated.']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to update status: ' . $stmt->error], 500);
    }
    $stmt->close();
}

function handleDeleteCompany($conn, $data) {
    $company_id = filter_var($data['company_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$company_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Company ID.'], 400);
        return;
    }
    $stmt_check = $conn->prepare("SELECT COUNT(*) as count FROM outbound_order_assignments WHERE third_party_company_id = ?");
    $stmt_check->bind_param("i", $company_id);
    $stmt_check->execute();
    $result = $stmt_check->get_result()->fetch_assoc();
    $stmt_check->close();
    if ($result['count'] > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Cannot delete company. It is assigned to outbound orders.'], 409);
        return;
    }
    $stmt = $conn->prepare("DELETE FROM delivery_companies WHERE company_id = ?");
    $stmt->bind_param("i", $company_id);
    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Company deleted successfully.']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete company: ' . $stmt->error], 500);
    }
    $stmt->close();
}

function handleSaveDriver($conn, $post_data, $files_data) {
    $driver_id = filter_var($post_data['driver_id'] ?? null, FILTER_VALIDATE_INT);
    $company_id = filter_var($post_data['company_id'] ?? 0, FILTER_VALIDATE_INT);
    $driver_name = sanitize_input($post_data['driver_name'] ?? '');
    $driver_mobile = sanitize_input($post_data['driver_mobile'] ?? '');
    $driver_id_number = sanitize_input($post_data['driver_id_number'] ?? null);

    if (empty($driver_name) || empty($driver_mobile) || empty($company_id)) {
        sendJsonResponse(['success' => false, 'message' => 'Company, Driver Name, and Mobile are required.'], 400);
        return;
    }

    try {
        $id_path = handleDriverFileUpload($files_data['driver_id_path'] ?? null, $company_id, $driver_name, 'id');
        $license_path = handleDriverFileUpload($files_data['driver_license_path'] ?? null, $company_id, $driver_name, 'license');

        if ($driver_id) { // Update existing driver
            $stmt_paths = $conn->prepare("SELECT driver_id_path, driver_license_path FROM delivery_company_drivers WHERE driver_id = ?");
            $stmt_paths->bind_param("i", $driver_id);
            $stmt_paths->execute();
            $existing_paths = $stmt_paths->get_result()->fetch_assoc();
            $stmt_paths->close();

            $final_id_path = $id_path ?? $existing_paths['driver_id_path'];
            $final_license_path = $license_path ?? $existing_paths['driver_license_path'];

            $stmt = $conn->prepare("UPDATE delivery_company_drivers SET driver_name = ?, driver_mobile = ?, driver_id_number = ?, driver_id_path = ?, driver_license_path = ? WHERE driver_id = ?");
            $stmt->bind_param("sssssi", $driver_name, $driver_mobile, $driver_id_number, $final_id_path, $final_license_path, $driver_id);
        } else { // Insert new driver
            $stmt = $conn->prepare("INSERT INTO delivery_company_drivers (company_id, driver_name, driver_mobile, driver_id_number, driver_id_path, driver_license_path) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("isssss", $company_id, $driver_name, $driver_mobile, $driver_id_number, $id_path, $license_path);
        }

        if ($stmt->execute()) {
            sendJsonResponse(['success' => true, 'message' => 'Driver saved successfully.']);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Failed to save driver: ' . $stmt->error], 500);
        }
        $stmt->close();
    } catch (Exception $e) {
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

function handleDeleteDriver($conn, $data) {
    $driver_id = filter_var($data['driver_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$driver_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Driver ID.'], 400);
        return;
    }
    
    // It's good practice to check if the driver is linked to any assignments, but for simplicity, we'll just delete.
    // In a real-world scenario, you might want to prevent deletion if the driver has assignments.
    
    $stmt_paths = $conn->prepare("SELECT driver_id_path, driver_license_path FROM delivery_company_drivers WHERE driver_id = ?");
    $stmt_paths->bind_param("i", $driver_id);
    $stmt_paths->execute();
    $paths = $stmt_paths->get_result()->fetch_assoc();
    $stmt_paths->close();

    $stmt = $conn->prepare("DELETE FROM delivery_company_drivers WHERE driver_id = ?");
    $stmt->bind_param("i", $driver_id);
    if ($stmt->execute()) {
        // Delete files from server
        if ($paths) {
            if ($paths['driver_id_path'] && file_exists(dirname(__DIR__) . '/' . $paths['driver_id_path'])) {
                unlink(dirname(__DIR__) . '/' . $paths['driver_id_path']);
            }
            if ($paths['driver_license_path'] && file_exists(dirname(__DIR__) . '/' . $paths['driver_license_path'])) {
                unlink(dirname(__DIR__) . '/' . $paths['driver_license_path']);
            }
        }
        sendJsonResponse(['success' => true, 'message' => 'Driver deleted successfully.']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete driver: ' . $stmt->error], 500);
    }
    $stmt->close();
}

function handleDriverFileUpload($file, $companyId, $driverIdentifier, $docType) {
    if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $uploadDir = dirname(__DIR__) . '/uploads/driver_documents/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }
    $file_ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $safeDriverName = preg_replace('/[^a-zA-Z0-9-_\.]/', '_', $driverIdentifier);
    $filename = "company_{$companyId}_{$docType}_{$safeDriverName}_" . time() . "." . $file_ext;
    $filePath = $uploadDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        throw new Exception("Failed to save driver document.");
    }
    return 'uploads/driver_documents/' . $filename;
}
?>
