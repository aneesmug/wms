<?php
// api/users_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

// Allow non-admins to access their own profile actions
$action = sanitize_input($_GET['action'] ?? '');
$profile_actions = ['get_current_user_profile', 'update_current_user_profile', 'change_own_password'];

if (!in_array($action, $profile_actions)) {
    require_global_admin();
} else {
    // For profile actions, just ensure the user is logged in.
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user_id'])) {
        sendJsonResponse(['success' => false, 'message' => 'Unauthorized'], 401);
        exit;
    }
}

$conn = getDbConnection();
date_default_timezone_set('UTC'); 

try {
    switch ($action) {
        // Existing Admin actions
        case 'get_users': handleGetUsers($conn); break;
        case 'get_user_details': handleGetUserDetails($conn); break;
        case 'create_user': handleCreateUser($conn); break;
        case 'update_user': handleUpdateUser($conn); break;
        case 'delete_user': handleDeleteUser($conn); break;
        case 'change_password': handleChangePassword($conn); break; // Admin changing other's password
        case 'get_all_warehouses': handleGetAllWarehouses($conn); break;
        case 'get_all_roles': handleGetAllRoles(); break;
        
        // New Self-service Profile actions
        case 'get_current_user_profile': handleGetCurrentUserProfile($conn); break;
        case 'update_current_user_profile': handleUpdateCurrentUserProfile($conn); break;
        case 'change_own_password': handleChangeOwnPassword($conn); break;

        default:
            sendJsonResponse(['success' => false, 'message' => 'Invalid action specified.'], 400);
            break;
    }
} catch (Exception $e) {
    error_log("Error in users_api.php: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'An internal server error occurred.'], 500);
} finally {
    if ($conn) $conn->close();
}

// --- NEW SELF-SERVICE FUNCTIONS ---

function handleGetCurrentUserProfile($conn) {
    $user_id = $_SESSION['user_id'];
    
    $stmt = $conn->prepare("SELECT user_id, username, full_name, profile_image_url, is_global_admin FROM users WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        sendJsonResponse(['success' => false, 'message' => 'User not found.'], 404);
        return;
    }

    $user['warehouse_roles'] = [];
    if (!$user['is_global_admin']) {
        $stmt = $conn->prepare("
            SELECT w.warehouse_name, uwr.role 
            FROM user_warehouse_roles uwr
            JOIN warehouses w ON uwr.warehouse_id = w.warehouse_id
            WHERE uwr.user_id = ? AND w.is_active = 1
        ");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $roles = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        $user['warehouse_roles'] = $roles;
    }

    sendJsonResponse(['success' => true, 'user' => $user]);
}

function handleUpdateCurrentUserProfile($conn) {
    $user_id = $_SESSION['user_id'];
    $input = json_decode(file_get_contents('php://input'), true);

    $full_name = sanitize_input($input['full_name'] ?? '');
    $profile_image_base64 = $input['profile_image'] ?? null;

    if (empty($full_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Full name is required.'], 400);
        return;
    }

    $new_image_url = handleImageUpload($profile_image_base64);
    
    if ($new_image_url) {
        $stmt = $conn->prepare("SELECT profile_image_url FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $old_image_url = $stmt->get_result()->fetch_object()->profile_image_url;
        $stmt->close();

        $stmt = $conn->prepare("UPDATE users SET full_name = ?, profile_image_url = ? WHERE user_id = ?");
        $stmt->bind_param("ssi", $full_name, $new_image_url, $user_id);
    } else {
        $stmt = $conn->prepare("UPDATE users SET full_name = ? WHERE user_id = ?");
        $stmt->bind_param("si", $full_name, $user_id);
    }

    if ($stmt->execute()) {
        if ($new_image_url) deleteOldImage($old_image_url);
        $_SESSION['full_name'] = $full_name; // Update session
        if ($new_image_url) $_SESSION['profile_image_url'] = $new_image_url;
        sendJsonResponse(['success' => true, 'message' => 'Profile updated.', 'new_image_url' => $new_image_url]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to update profile.'], 500);
    }
    $stmt->close();
}

function handleChangeOwnPassword($conn) {
    $user_id = $_SESSION['user_id'];
    $input = json_decode(file_get_contents('php://input'), true);

    $current_password = $input['current_password'] ?? '';
    $new_password = $input['new_password'] ?? '';

    if (empty($current_password) || empty($new_password)) {
        sendJsonResponse(['success' => false, 'message' => 'All password fields are required.'], 400);
        return;
    }

    $stmt = $conn->prepare("SELECT password_hash FROM users WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user || !password_verify($current_password, $user['password_hash'])) {
        sendJsonResponse(['success' => false, 'message' => 'Your current password is not correct.'], 403);
        return;
    }

    $new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE user_id = ?");
    $stmt->bind_param("si", $new_password_hash, $user_id);

    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Password changed successfully.']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to change password.'], 500);
    }
    $stmt->close();
}


// --- EXISTING ADMIN FUNCTIONS ---

function handleImageUpload(?string $base64Image): ?string {
    if (empty($base64Image)) return null;
    if (strpos($base64Image, ';base64,') === false) return null;
    list(, $data) = explode(',', $base64Image);
    $imageData = base64_decode($data);
    if ($imageData === false) return null;
    $uploadDir = dirname(__DIR__) . '/Uploads/users/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0775, true);
    $filename = 'user_' . bin2hex(random_bytes(12)) . '.jpeg';
    $filePath = $uploadDir . $filename;
    if (file_put_contents($filePath, $imageData) === false) return null;
    return 'Uploads/users/' . $filename;
}

function deleteOldImage(?string $imageUrl) {
    if (empty($imageUrl)) return;
    $filePath = dirname(__DIR__) . '/' . $imageUrl;
    if (file_exists($filePath) && is_file($filePath)) @unlink($filePath);
}

function handleGetUsers($conn) {
    $sql = "
        SELECT 
            u.user_id, 
            u.username, 
            u.full_name, 
            u.profile_image_url, 
            u.is_global_admin,
            GROUP_CONCAT(CONCAT(w.warehouse_name, ': ', uwr.role) SEPARATOR '; ') as warehouse_roles
        FROM users u
        LEFT JOIN user_warehouse_roles uwr ON u.user_id = uwr.user_id
        LEFT JOIN warehouses w ON uwr.warehouse_id = w.warehouse_id AND w.is_active = 1
        GROUP BY u.user_id
        ORDER BY u.full_name;
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
    $user['warehouse_roles'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'user' => $user]);
}

function handleCreateUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = sanitize_input($input['username'] ?? '');
    $full_name = sanitize_input($input['full_name'] ?? '');
    $password = $input['password'] ?? '';
    if (empty($username) || empty($full_name) || empty($password)) sendJsonResponse(['success' => false, 'message' => 'Required fields are missing.'], 400);
    if ($password !== ($input['confirm_password'] ?? '')) sendJsonResponse(['success' => false, 'message' => 'Passwords do not match.'], 400);
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    $is_global_admin = !empty($input['is_global_admin']) ? 1 : 0;
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO users (username, full_name, password_hash, is_global_admin) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("sssi", $username, $full_name, $password_hash, $is_global_admin);
        $stmt->execute();
        $user_id = $stmt->insert_id;
        $stmt->close();
        if (!$is_global_admin && !empty($input['warehouse_roles'])) {
            $stmt = $conn->prepare("INSERT INTO user_warehouse_roles (user_id, warehouse_id, role) VALUES (?, ?, ?)");
            foreach ($input['warehouse_roles'] as $role_info) {
                $stmt->bind_param("iis", $user_id, $role_info['warehouse_id'], $role_info['role']);
                $stmt->execute();
            }
            $stmt->close();
        }
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'User created.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => 'Database error.'], 500);
    }
}

function handleUpdateUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$user_id) sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);
    $full_name = sanitize_input($input['full_name'] ?? '');
    $is_global_admin = !empty($input['is_global_admin']) ? 1 : 0;
    $conn->begin_transaction();
    try {
        $new_image_url = handleImageUpload($input['profile_image'] ?? null);
        if ($new_image_url) {
            $stmt = $conn->prepare("SELECT profile_image_url FROM users WHERE user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            deleteOldImage($stmt->get_result()->fetch_object()->profile_image_url);
            $stmt->close();
            $stmt = $conn->prepare("UPDATE users SET full_name = ?, profile_image_url = ?, is_global_admin = ? WHERE user_id = ?");
            $stmt->bind_param("ssii", $full_name, $new_image_url, $is_global_admin, $user_id);
        } else {
            $stmt = $conn->prepare("UPDATE users SET full_name = ?, is_global_admin = ? WHERE user_id = ?");
            $stmt->bind_param("sii", $full_name, $is_global_admin, $user_id);
        }
        $stmt->execute();
        $stmt->close();
        $stmt = $conn->prepare("DELETE FROM user_warehouse_roles WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
        if (!$is_global_admin && !empty($input['warehouse_roles'])) {
            $stmt = $conn->prepare("INSERT INTO user_warehouse_roles (user_id, warehouse_id, role) VALUES (?, ?, ?)");
            foreach ($input['warehouse_roles'] as $role_info) {
                $stmt->bind_param("iis", $user_id, $role_info['warehouse_id'], $role_info['role']);
                $stmt->execute();
            }
            $stmt->close();
        }
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'User updated.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => 'Database error.'], 500);
    }
}

function handleChangePassword($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);
    $password = $input['password'] ?? '';
    if (!$user_id || empty($password) || $password !== $input['confirm_password']) sendJsonResponse(['success' => false, 'message' => 'Invalid data.'], 400);
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE user_id = ?");
    $stmt->bind_param("si", $password_hash, $user_id);
    if ($stmt->execute()) sendJsonResponse(['success' => true, 'message' => 'Password updated.']);
    else sendJsonResponse(['success' => false, 'message' => 'Update failed.'], 500);
    $stmt->close();
}

function handleDeleteUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$user_id) sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);
    if ($user_id === ($_SESSION['user_id'] ?? null)) sendJsonResponse(['success' => false, 'message' => 'Cannot delete yourself.'], 403);
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("SELECT profile_image_url FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        deleteOldImage($stmt->get_result()->fetch_object()->profile_image_url);
        $stmt->close();
        $stmt = $conn->prepare("DELETE FROM user_warehouse_roles WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
        $stmt = $conn->prepare("DELETE FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'User deleted.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => 'Database error.'], 500);
    }
}

function handleGetAllWarehouses($conn) {
    $result = $conn->query("SELECT warehouse_id, warehouse_name FROM warehouses WHERE is_active = 1 ORDER BY warehouse_name");
    sendJsonResponse(['success' => true, 'warehouses' => $result->fetch_all(MYSQLI_ASSOC)]);
}

function handleGetAllRoles() {
    sendJsonResponse(['success' => true, 'roles' => ['manager', 'operator', 'viewer', 'picker', 'driver']]);
}
