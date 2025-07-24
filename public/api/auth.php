<?php
// api/auth.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();

ob_start();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin($conn);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check_auth':
        checkAuthentication();
        break;
    case 'set_warehouse':
        handleSetWarehouse($conn);
        break;
    case 'get_user_warehouses':
        handleGetUserWarehouses($conn);
        break;
    default:
        sendJsonResponse(['message' => 'Invalid action'], 400);
        break;
}

function handleLogin($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = sanitize_input($input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($username) || empty($password)) {
        sendJsonResponse(['message' => 'Username and password are required'], 400);
    }

    $stmt = $conn->prepare("SELECT user_id, username, password_hash, is_global_admin, full_name FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['full_name'] = $user['full_name'];
        $_SESSION['is_global_admin'] = (bool)$user['is_global_admin'];
        
        $stmt = $conn->prepare("
            SELECT uwr.warehouse_id, w.warehouse_name, uwr.role 
            FROM user_warehouse_roles uwr
            JOIN warehouses w ON uwr.warehouse_id = w.warehouse_id
            WHERE uwr.user_id = ? AND w.is_active = 1
        ");
        $stmt->bind_param("i", $user['user_id']);
        $stmt->execute();
        $roles_result = $stmt->get_result();
        $_SESSION['assigned_warehouses'] = $roles_result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        unset_current_warehouse();

        sendJsonResponse([
            'success' => true, 
            'message' => 'Login successful',
        ]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Invalid username or password'], 401);
    }
}

function handleLogout() {
    $_SESSION = [];
    session_destroy();
    sendJsonResponse(['success' => true, 'message' => 'Logged out successfully']);
}

function checkAuthentication() {
    if (isset($_SESSION['user_id'])) {
        sendJsonResponse([
            'authenticated' => true, 
            'user' => [
                'username' => $_SESSION['username'],
                'full_name' => $_SESSION['full_name'] ?? 'N/A',
                'is_global_admin' => $_SESSION['is_global_admin'] ?? false
            ], 
            'current_warehouse_id' => get_current_warehouse_id(), 
            'current_warehouse_name' => get_current_warehouse_name(),
            'current_warehouse_role' => get_current_warehouse_role()
        ]);
    } else {
        sendJsonResponse(['authenticated' => false]);
    }
}

function handleGetUserWarehouses($conn) {
    if (!isset($_SESSION['user_id'])) {
        sendJsonResponse(['success' => false, 'message' => 'Unauthorized'], 401);
        return;
    }

    if ($_SESSION['is_global_admin']) {
        $stmt = $conn->prepare("SELECT warehouse_id, warehouse_name FROM warehouses WHERE is_active = 1 ORDER BY warehouse_name");
    } else {
        $stmt = $conn->prepare("
            SELECT w.warehouse_id, w.warehouse_name 
            FROM warehouses w
            JOIN user_warehouse_roles uwr ON w.warehouse_id = uwr.warehouse_id
            WHERE uwr.user_id = ? AND w.is_active = 1
            ORDER BY w.warehouse_name
        ");
        $stmt->bind_param("i", $_SESSION['user_id']);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $warehouses = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJsonResponse(['success' => true, 'warehouses' => $warehouses]);
}


function handleSetWarehouse($conn) {
    if (!isset($_SESSION['user_id'])) {
        sendJsonResponse(['success' => false, 'message' => 'Unauthorized: Please log in.'], 401);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $warehouse_id = filter_var($input['warehouse_id'] ?? null, FILTER_VALIDATE_INT);
    
    if (!$warehouse_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid warehouse ID provided.'], 400);
        return;
    }

    $user_id = $_SESSION['user_id'];
    $user_role_for_warehouse = null;
    $warehouse_name = '';

    if ($_SESSION['is_global_admin']) {
        $user_role_for_warehouse = 'manager';
        $stmt = $conn->prepare("SELECT warehouse_name FROM warehouses WHERE warehouse_id = ?");
        $stmt->bind_param("i", $warehouse_id);
        $stmt->execute();
        $warehouse_name = $stmt->get_result()->fetch_assoc()['warehouse_name'] ?? null;
        $stmt->close();
    } else {
        foreach ($_SESSION['assigned_warehouses'] as $wh) {
            if ($wh['warehouse_id'] == $warehouse_id) {
                // --- FIX: Trim whitespace from the role to prevent auth issues ---
                $user_role_for_warehouse = trim($wh['role']);
                $warehouse_name = $wh['warehouse_name'];
                break;
            }
        }
    }

    if ($user_role_for_warehouse === null || $warehouse_name === null) {
        sendJsonResponse(['success' => false, 'message' => 'You do not have permission to access this warehouse.'], 403);
        return;
    }
    
    set_current_warehouse($warehouse_id, $warehouse_name, $user_role_for_warehouse);
    
    sendJsonResponse([
        'success' => true, 
        'message' => 'Warehouse set successfully.',
        'role' => $user_role_for_warehouse
    ]);
}
