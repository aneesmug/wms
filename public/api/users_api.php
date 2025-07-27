<?php
// api/users_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

require_global_admin();

$conn = getDbConnection();

// Set a default timezone to avoid warnings
date_default_timezone_set('UTC'); 

// The sendJsonResponse() function has been removed from this file.
// It will now use the version declared in your config/config.php file.

$action = sanitize_input($_GET['action'] ?? '');

try {
    switch ($action) {
        case 'get_users':
            handleGetUsers($conn);
            break;
        case 'get_user_details':
            handleGetUserDetails($conn);
            break;
        case 'create_user':
            handleCreateUser($conn);
            break;
        case 'update_user':
            handleUpdateUser($conn);
            break;
        case 'delete_user':
            handleDeleteUser($conn);
            break;
        case 'change_password':
            handleChangePassword($conn);
            break;
        case 'get_all_warehouses':
            handleGetAllWarehouses($conn);
            break;
        case 'get_all_roles':
            handleGetAllRoles();
            break;
        default:
            sendJsonResponse(['success' => false, 'message' => 'Invalid action specified.'], 400);
            break;
    }
} catch (Exception $e) {
    error_log("Error in users_api.php: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'An internal server error occurred.'], 500);
} finally {
    if ($conn) {
        $conn->close();
    }
}

function handleImageUpload(?string $base64Image): ?string {
    if (empty($base64Image)) {
        return null;
    }

    if (strpos($base64Image, ';base64,') === false) {
        error_log('handleImageUpload: Invalid Base64 format');
        return null;
    }

    list($type, $data) = explode(';', $base64Image);
    list(, $data) = explode(',', $data);
    $imageData = base64_decode($data);
    
    if ($imageData === false) {
        error_log('handleImageUpload: Failed to decode Base64 data');
        return null;
    }

    $extension = strtolower(str_replace('data:image/', '', $type));
    if (!in_array($extension, ['jpeg', 'jpg', 'png'])) {
        error_log('handleImageUpload: Invalid image extension: ' . $extension);
        return null; // Only allow safe image types
    }

    $uploadDir = dirname(__DIR__) . '/Uploads/users/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
            error_log('handleImageUpload: Failed to create directory: ' . $uploadDir);
            return null;
        }
    }

    if (!is_writable($uploadDir)) {
        error_log('handleImageUpload: Directory not writable: ' . $uploadDir);
        return null;
    }

    $filename = 'user_' . bin2hex(random_bytes(12)) . '.' . $extension;
    $filePath = $uploadDir . $filename;

    if (file_put_contents($filePath, $imageData) === false) {
        error_log('handleImageUpload: Failed to save image to: ' . $filePath);
        return null;
    }

    return 'Uploads/users/' . $filename;
}

function deleteOldImage(?string $imageUrl) {
    if (empty($imageUrl)) {
        return;
    }
    $filePath = dirname(__DIR__) . '/' . $imageUrl;
    if (file_exists($filePath) && is_file($filePath)) {
        @unlink($filePath);
    }
}

function handleGetUsers($conn) {
    $sql = "
        SELECT 
            u.user_id, u.username, u.full_name, u.profile_image_url, u.is_global_admin,
            GROUP_CONCAT(CONCAT(w.warehouse_name, ':', uwr.role) SEPARATOR ';') as warehouse_roles
        FROM users u
        LEFT JOIN user_warehouse_roles uwr ON u.user_id = uwr.user_id
        LEFT JOIN warehouses w ON uwr.warehouse_id = w.warehouse_id AND w.is_active = 1
        GROUP BY u.user_id ORDER BY u.full_name;
    ";
    $result = $conn->query($sql);
    $users = $result->fetch_all(MYSQLI_ASSOC);
    sendJsonResponse(['success' => true, 'users' => $users]);
}

function handleGetUserDetails($conn) {
    $user_id = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
    if (!$user_id) sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);

    $stmt = $conn->prepare("SELECT user_id, username, full_name, profile_image_url, is_global_admin FROM users WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) sendJsonResponse(['success' => false, 'message' => 'User not found.'], 404);

    $stmt = $conn->prepare("SELECT warehouse_id, role FROM user_warehouse_roles WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $roles = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $user['warehouse_roles'] = $roles;
    sendJsonResponse(['success' => true, 'user' => $user]);
}

function handleCreateUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $username = sanitize_input($input['username'] ?? '');
    $full_name = sanitize_input($input['full_name'] ?? '');
    $password = $input['password'] ?? '';
    $confirm_password = $input['confirm_password'] ?? '';
    $is_global_admin = !empty($input['is_global_admin']) ? 1 : 0;
    $warehouse_roles = $input['warehouse_roles'] ?? [];

    if (isset($input['profile_image'])) sendJsonResponse(['success' => false, 'message' => 'Image upload is not permitted during user creation.'], 400);
    if (empty($username) || empty($full_name) || empty($password)) sendJsonResponse(['success' => false, 'message' => 'Username, Full Name, and Password are required.'], 400);
    if ($password !== $confirm_password) sendJsonResponse(['success' => false, 'message' => 'Passwords do not match.'], 400);
    
    $stmt = $conn->prepare("SELECT user_id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        $stmt->close();
        sendJsonResponse(['success' => false, 'message' => 'Username already exists.'], 409);
    }
    $stmt->close();

    $conn->begin_transaction();
    try {
        $password_hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO users (username, full_name, password_hash, is_global_admin) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("sssi", $username, $full_name, $password_hash, $is_global_admin);
        if (!$stmt->execute()) throw new Exception('Database error on user insert: ' . $stmt->error);
        $user_id = $stmt->insert_id;
        $stmt->close();

        if (!$is_global_admin && !empty($warehouse_roles)) {
            $stmt = $conn->prepare("INSERT INTO user_warehouse_roles (user_id, warehouse_id, role) VALUES (?, ?, ?)");
            foreach ($warehouse_roles as $role_info) {
                $warehouse_id = filter_var($role_info['warehouse_id'], FILTER_VALIDATE_INT);
                $role = sanitize_input($role_info['role']);
                if ($warehouse_id && !empty($role)) {
                    $stmt->bind_param("iis", $user_id, $warehouse_id, $role);
                    $stmt->execute();
                }
            }
            $stmt->close();
        }

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'User created successfully.', 'user_id' => $user_id]);
    } catch (Exception $e) {
        $conn->rollback();
        error_log('handleCreateUser Error: ' . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Failed to create user.'], 500);
    }
}

function handleUpdateUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$user_id) sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);

    $username = sanitize_input($input['username'] ?? '');
    $full_name = sanitize_input($input['full_name'] ?? '');
    $is_global_admin = !empty($input['is_global_admin']) ? 1 : 0;
    $warehouse_roles = $input['warehouse_roles'] ?? [];
    $profile_image_base64 = $input['profile_image'] ?? null;

    if (empty($username) || empty($full_name)) sendJsonResponse(['success' => false, 'message' => 'Username and Full Name are required.'], 400);

    $conn->begin_transaction();
    try {
        $new_image_url = handleImageUpload($profile_image_base64);
        $old_image_url = null;

        if ($new_image_url) {
            $stmt = $conn->prepare("SELECT profile_image_url FROM users WHERE user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $old_image_url = $stmt->get_result()->fetch_object()->profile_image_url;
            $stmt->close();

            $stmt = $conn->prepare("UPDATE users SET username = ?, full_name = ?, profile_image_url = ?, is_global_admin = ? WHERE user_id = ?");
            $stmt->bind_param("sssii", $username, $full_name, $new_image_url, $is_global_admin, $user_id);
        } else {
            $stmt = $conn->prepare("UPDATE users SET username = ?, full_name = ?, is_global_admin = ? WHERE user_id = ?");
            $stmt->bind_param("ssii", $username, $full_name, $is_global_admin, $user_id);
        }
        if (!$stmt->execute()) throw new Exception('Database error on user update: ' . $stmt->error);
        $stmt->close();

        if ($new_image_url) deleteOldImage($old_image_url);

        $stmt = $conn->prepare("DELETE FROM user_warehouse_roles WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();

        if (!$is_global_admin && !empty($warehouse_roles)) {
            $stmt = $conn->prepare("INSERT INTO user_warehouse_roles (user_id, warehouse_id, role) VALUES (?, ?, ?)");
            foreach ($warehouse_roles as $role_info) {
                $warehouse_id = filter_var($role_info['warehouse_id'], FILTER_VALIDATE_INT);
                $role = sanitize_input($role_info['role']);
                if ($warehouse_id && !empty($role)) {
                    $stmt->bind_param("iis", $user_id, $warehouse_id, $role);
                    $stmt->execute();
                }
            }
            $stmt->close();
        }

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'User updated successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        error_log('handleUpdateUser Error: ' . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Failed to update user.'], 500);
    }
}

function handleChangePassword($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);
    $password = $input['password'] ?? '';
    $confirm_password = $input['confirm_password'] ?? '';

    if (!$user_id || empty($password) || $password !== $confirm_password) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid data provided. Please ensure passwords match.'], 400);
    }

    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE user_id = ?");
    $stmt->bind_param("si", $password_hash, $user_id);
    
    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Password updated successfully.']);
    } else {
        error_log('handleChangePassword Error: ' . $stmt->error);
        sendJsonResponse(['success' => false, 'message' => 'Failed to update password.'], 500);
    }
    $stmt->close();
}

function handleDeleteUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);

    if (!$user_id) sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);
    if ($user_id === 1 || $user_id === ($_SESSION['user_id'] ?? null)) sendJsonResponse(['success' => false, 'message' => 'This user account cannot be deleted.'], 403);

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT profile_image_url FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $image_url = $stmt->get_result()->fetch_object()->profile_image_url;
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM user_warehouse_roles WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
        
        deleteOldImage($image_url);

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'User deleted successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        error_log('handleDeleteUser Error: ' . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete user.'], 500);
    }
}

function handleGetAllWarehouses($conn) {
    $result = $conn->query("SELECT warehouse_id, warehouse_name FROM warehouses WHERE is_active = 1 ORDER BY warehouse_name");
    $warehouses = $result->fetch_all(MYSQLI_ASSOC);
    sendJsonResponse(['success' => true, 'warehouses' => $warehouses]);
}

function handleGetAllRoles() {
    $roles = ['manager', 'operator', 'viewer', 'picker', 'driver'];
    sendJsonResponse(['success' => true, 'roles' => $roles]);
}
