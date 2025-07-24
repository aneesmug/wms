<?php
// api/users_api.php

// This API should only be accessible to Global Admins.
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

// Enforce authentication and global admin privileges for the entire script
require_global_admin();

$conn = getDbConnection();

// Start Output Buffering to prevent any accidental output before sending JSON
ob_start();

// Sanitize the action from the GET request
$action = sanitize_input($_GET['action'] ?? '');

try {
    // Route the request to the appropriate handler based on the action
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
    // Catch any unexpected errors during execution
    error_log("Error in users_api.php: " . $e->getMessage());
    sendJsonResponse(['success' => false, 'message' => 'An internal server error occurred.'], 500);
} finally {
    // Clean the output buffer and close the database connection
    ob_end_flush();
    $conn->close();
}

/**
 * Handles saving a Base64 encoded image to the server.
 * @param string|null $base64Image The Base64 encoded image string.
 * @return string|null The relative path to the saved image or null if no image was provided or an error occurred.
 */
function handleImageUpload(?string $base64Image): ?string {
    if (empty($base64Image)) {
        return null;
    }

    // Define the upload directory and create it if it doesn't exist
    $uploadDir = __DIR__ . '/../uploads/users/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
             error_log('Failed to create user upload directory: ' . $uploadDir);
             return null;
        }
    }

    // Extract image data from Base64 string
    if (strpos($base64Image, ';base64,') === false) {
        return null; // Invalid Base64 string format
    }
    list($type, $data) = explode(';', $base64Image);
    list(, $data)      = explode(',', $data);
    $imageData = base64_decode($data);
    
    // Determine file extension and validate image type
    $extension = strtolower(str_replace('data:image/', '', $type));
    if (!in_array($extension, ['jpeg', 'jpg', 'png', 'gif'])) {
        return null; // Invalid image type
    }

    // Generate a unique filename to prevent collisions
    $filename = uniqid('user_', true) . '.' . $extension;
    $filePath = $uploadDir . $filename;

    // Save the file to the server
    if (file_put_contents($filePath, $imageData)) {
        // Return the relative path for web access
        return 'uploads/users/' . $filename;
    }

    error_log('Failed to save user image to: ' . $filePath);
    return null;
}

/**
 * Handles fetching a list of all users and their assigned roles.
 */
function handleGetUsers($conn) {
    $sql = "
        SELECT 
            u.user_id, 
            u.username, 
            u.full_name, 
            u.profile_image_url,
            u.is_global_admin,
            GROUP_CONCAT(CONCAT(w.warehouse_name, ':', uwr.role) SEPARATOR ';') as warehouse_roles
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

/**
 * Handles fetching detailed information for a single user.
 */
function handleGetUserDetails($conn) {
    $user_id = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
    if (!$user_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);
        return;
    }

    // Get user base details
    $stmt = $conn->prepare("SELECT user_id, username, full_name, profile_image_url, is_global_admin FROM users WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        sendJsonResponse(['success' => false, 'message' => 'User not found.'], 404);
        return;
    }

    // Get warehouse roles
    $stmt = $conn->prepare("SELECT warehouse_id, role FROM user_warehouse_roles WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $roles = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $user['warehouse_roles'] = $roles;
    sendJsonResponse(['success' => true, 'user' => $user]);
}

/**
 * Handles creating a new user and assigning roles.
 */
function handleCreateUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    // --- Validation ---
    $username = sanitize_input($input['username'] ?? '');
    $full_name = sanitize_input($input['full_name'] ?? '');
    $password = $input['password'] ?? '';
    $confirm_password = $input['confirm_password'] ?? '';
    $is_global_admin = !empty($input['is_global_admin']) ? 1 : 0;
    $warehouse_roles = $input['warehouse_roles'] ?? [];
    $profile_image_base64 = $input['profile_image'] ?? null;

    if (empty($username) || empty($full_name) || empty($password)) {
        sendJsonResponse(['success' => false, 'message' => 'Username, Full Name, and Password are required.'], 400);
        return;
    }
    if ($password !== $confirm_password) {
        sendJsonResponse(['success' => false, 'message' => 'Passwords do not match.'], 400);
        return;
    }
    
    // Check if username already exists
    $stmt = $conn->prepare("SELECT user_id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        sendJsonResponse(['success' => false, 'message' => 'Username already exists.'], 409);
        $stmt->close();
        return;
    }
    $stmt->close();

    // --- Database Operations ---
    $conn->begin_transaction();
    try {
        $profile_image_url = handleImageUpload($profile_image_base64);

        // Insert into users table
        $password_hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO users (username, full_name, profile_image_url, password_hash, is_global_admin) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssi", $username, $full_name, $profile_image_url, $password_hash, $is_global_admin);
        $stmt->execute();
        $user_id = $stmt->insert_id;
        $stmt->close();

        // Insert into user_warehouse_roles if not a global admin
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
        sendJsonResponse(['success' => true, 'message' => 'User created successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        error_log("User creation failed: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Failed to create user due to a server error.'], 500);
    }
}

/**
 * Handles updating an existing user's details and roles (but not password).
 */
function handleUpdateUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    // --- Validation ---
    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$user_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);
        return;
    }

    $username = sanitize_input($input['username'] ?? '');
    $full_name = sanitize_input($input['full_name'] ?? '');
    $is_global_admin = !empty($input['is_global_admin']) ? 1 : 0;
    $warehouse_roles = $input['warehouse_roles'] ?? [];
    $profile_image_base64 = $input['profile_image'] ?? null;

    if (empty($username) || empty($full_name)) {
        sendJsonResponse(['success' => false, 'message' => 'Username and Full Name are required.'], 400);
        return;
    }

    // --- Database Operations ---
    $conn->begin_transaction();
    try {
        $profile_image_url = handleImageUpload($profile_image_base64);

        // Build the update query dynamically based on whether a new image was provided
        if ($profile_image_url) {
            $stmt = $conn->prepare("UPDATE users SET username = ?, full_name = ?, profile_image_url = ?, is_global_admin = ? WHERE user_id = ?");
            $stmt->bind_param("sssii", $username, $full_name, $profile_image_url, $is_global_admin, $user_id);
        } else {
            $stmt = $conn->prepare("UPDATE users SET username = ?, full_name = ?, is_global_admin = ? WHERE user_id = ?");
            $stmt->bind_param("ssii", $username, $full_name, $is_global_admin, $user_id);
        }
        $stmt->execute();
        $stmt->close();

        // First, delete all existing roles for the user to ensure a clean slate
        $stmt = $conn->prepare("DELETE FROM user_warehouse_roles WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();

        // Then, insert the new roles if not a global admin
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
        error_log("User update failed: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Failed to update user due to a server error.'], 500);
    }
}

/**
 * Handles changing a user's password.
 */
function handleChangePassword($conn) {
    $input = json_decode(file_get_contents('php://input'), true);

    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);
    $password = $input['password'] ?? '';
    $confirm_password = $input['confirm_password'] ?? '';

    if (!$user_id || empty($password) || $password !== $confirm_password) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid data provided. Please ensure passwords match.'], 400);
        return;
    }

    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE user_id = ?");
    $stmt->bind_param("si", $password_hash, $user_id);
    
    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Password updated successfully.']);
    } else {
        error_log("Password update failed: " . $stmt->error);
        sendJsonResponse(['success' => false, 'message' => 'Failed to update password.'], 500);
    }
    $stmt->close();
}


/**
 * Handles deleting a user.
 */
function handleDeleteUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $user_id = filter_var($input['user_id'] ?? null, FILTER_VALIDATE_INT);

    if (!$user_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid User ID.'], 400);
        return;
    }
    // Protect primary admin and self-deletion
    if ($user_id === 1 || $user_id === ($_SESSION['user_id'] ?? null)) {
        sendJsonResponse(['success' => false, 'message' => 'This user account cannot be deleted.'], 403);
        return;
    }

    $conn->begin_transaction();
    try {
        // Delete associated roles first
        $stmt = $conn->prepare("DELETE FROM user_warehouse_roles WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();

        // Delete the user
        $stmt = $conn->prepare("DELETE FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'User deleted successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        error_log("User deletion failed: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete user due to a server error.'], 500);
    }
}

/**
 * Fetches all active warehouses for role assignment dropdowns.
 */
function handleGetAllWarehouses($conn) {
    $result = $conn->query("SELECT warehouse_id, warehouse_name FROM warehouses WHERE is_active = 1 ORDER BY warehouse_name");
    $warehouses = $result->fetch_all(MYSQLI_ASSOC);
    sendJsonResponse(['success' => true, 'warehouses' => $warehouses]);
}

/**
 * Returns a hardcoded list of available roles.
 */
function handleGetAllRoles() {
    $roles = ['manager', 'operator', 'viewer', 'picker', 'driver'];
    sendJsonResponse(['success' => true, 'roles' => $roles]);
}
