<?php
/*
* MODIFICATION SUMMARY:
* 1. The `handleLogin` function now provides specific, machine-readable error codes.
* 2. If the username is not found, it returns an `error_code: 'USERNAME_NOT_FOUND'`.
* 3. If the password is incorrect, it returns an `error_code: 'INCORRECT_PASSWORD'`.
* 4. This allows the frontend JavaScript to distinguish between the two types of errors and handle them differently.
*/

// api/auth.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();

// --- Constants ---
define('REMEMBER_ME_COOKIE_NAME', 'wms_remember_me');
define('REMEMBER_ME_EXPIRATION_DAYS', 30);
define('SESSION_TIMEOUT_SECONDS', 1800); // 30 minutes

// --- Main Action Router ---
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin($conn);
        break;
    case 'logout':
        handleLogout($conn);
        break;
    case 'check_auth':
        checkAuthentication($conn);
        break;
    case 'set_warehouse':
        handleSetWarehouse($conn);
        break;
    case 'get_user_warehouses':
        handleGetUserWarehouses($conn);
        break;
    case 'reauthenticate':
        handleReauthentication($conn);
        break;
    default:
        sendJsonResponse(['message' => 'Invalid action'], 400);
        break;
}

// --- Core Authentication Functions ---

function handleLogin($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = sanitize_input($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $remember_me = !empty($input['remember_me']);

    if (empty($username) || empty($password)) {
        sendJsonResponse(['message' => 'Username and password are required'], 400);
        return;
    }

    $stmt = $conn->prepare("SELECT user_id, username, password_hash, is_global_admin, full_name, profile_image_url FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        sendJsonResponse(['success' => false, 'message' => 'Username not found.', 'error_code' => 'USERNAME_NOT_FOUND'], 404);
        return;
    }

    if (password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $new_session_id = session_id();

        set_user_session($user);
        $_SESSION['last_activity'] = time();
        
        update_active_session_and_log_activity($conn, $user['user_id'], $new_session_id);

        unset_current_warehouse();
        process_warehouse_assignments($conn, $user['user_id']);

        if ($remember_me) {
            create_remember_me_token($conn, $user['user_id']);
        } else {
            clear_remember_me_cookie($conn);
        }
        
        sendJsonResponse(['success' => true, 'message' => 'Login successful']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Incorrect password.', 'error_code' => 'INCORRECT_PASSWORD'], 401);
    }
}

function handleLogout($conn) {
    if (isset($_SESSION['user_id'])) {
        $stmt = $conn->prepare("UPDATE users SET active_session_id = NULL WHERE user_id = ?");
        $stmt->bind_param("i", $_SESSION['user_id']);
        $stmt->execute();
        $stmt->close();
    }
    clear_remember_me_cookie($conn);
    $_SESSION = [];
    session_destroy();
    sendJsonResponse(['success' => true, 'message' => 'Logged out successfully']);
}

function checkAuthentication($conn) {
    if (isset($_SESSION['user_id'])) {
        $stmt = $conn->prepare("SELECT active_session_id FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $_SESSION['user_id']);
        $stmt->execute();
        $active_session_id = $stmt->get_result()->fetch_object()->active_session_id ?? null;
        $stmt->close();

        if ($active_session_id !== session_id()) {
            handleLogout($conn);
            return;
        }

        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT_SECONDS)) {
            $response = refresh_and_get_auth_status_data($conn);
            $response['session_locked'] = true;
            sendJsonResponse($response);
            return;
        }
        
        $_SESSION['last_activity'] = time();

        refresh_and_send_auth_status($conn);
        return;
    }

    if (validate_remember_me_cookie($conn)) {
        refresh_and_send_auth_status($conn);
    } else {
        sendJsonResponse(['authenticated' => false]);
    }
}

function handleReauthentication($conn) {
    if (!isset($_SESSION['user_id'])) {
        sendJsonResponse(['success' => false, 'message' => 'No active session found.'], 401);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $password = $input['password'] ?? '';

    if (empty($password)) {
        sendJsonResponse(['success' => false, 'message' => 'Password is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("SELECT password_hash FROM users WHERE user_id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['last_activity'] = time();
        sendJsonResponse(['success' => true, 'message' => 'Re-authenticated successfully.']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Incorrect password.'], 403);
    }
}


// --- Helper and Logic Functions ---

function set_user_session(array $user) {
    $_SESSION['user_id'] = $user['user_id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['profile_image_url'] = $user['profile_image_url'];
    $_SESSION['is_global_admin'] = (bool)$user['is_global_admin'];
}

function update_active_session_and_log_activity($conn, int $user_id, string $session_id) {
    $stmt = $conn->prepare("UPDATE users SET active_session_id = ? WHERE user_id = ?");
    $stmt->bind_param("si", $session_id, $user_id);
    $stmt->execute();
    $stmt->close();

    $ip_address = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'UNKNOWN';
    
    $lookup_ip = $ip_address;
    if ($lookup_ip === '127.0.0.1' || $lookup_ip === '::1') {
        $lookup_ip = '95.218.208.0';
    }

    $city = 'Unknown';
    $country = 'Unknown';
    $latitude = null;
    $longitude = null;

    try {
        $url = "http://ip-api.com/json/{$lookup_ip}";
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        $geo_response = curl_exec($ch);
        curl_close($ch);

        if ($geo_response) {
            $geo_data = json_decode($geo_response);
            if ($geo_data && $geo_data->status === 'success') {
                $city = $geo_data->city ?? 'N/A';
                $country = $geo_data->country ?? 'N/A';
                $latitude = $geo_data->lat ?? null;
                $longitude = $geo_data->lon ?? null;
            }
        }
    } catch (Exception $e) {
        // Silently fail
    }
    
    $stmt = $conn->prepare("INSERT INTO user_login_activity (user_id, ip_address, user_agent, city, country, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("issssdd", $user_id, $ip_address, $user_agent, $city, $country, $latitude, $longitude);
    $stmt->execute();
    $stmt->close();
}

function process_warehouse_assignments($conn, int $user_id) {
    if ($_SESSION['is_global_admin']) return;

    $stmt = $conn->prepare("
        SELECT uwr.warehouse_id, w.warehouse_name, uwr.role 
        FROM user_warehouse_roles uwr
        JOIN warehouses w ON uwr.warehouse_id = w.warehouse_id
        WHERE uwr.user_id = ? AND w.is_active = 1
    ");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $assigned_warehouses = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    $_SESSION['assigned_warehouses'] = $assigned_warehouses;

    if (count($assigned_warehouses) === 1) {
        $wh = $assigned_warehouses[0];
        set_current_warehouse($wh['warehouse_id'], $wh['warehouse_name'], trim($wh['role']));
    }
}

function refresh_and_get_auth_status_data($conn) {
    $stmt = $conn->prepare("SELECT full_name, profile_image_url FROM users WHERE user_id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $user_data = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $_SESSION['full_name'] = $user_data['full_name'];
    $_SESSION['profile_image_url'] = $user_data['profile_image_url'];

    return [
        'authenticated' => true, 
        'user' => [
            'username' => $_SESSION['username'],
            'full_name' => $_SESSION['full_name'] ?? 'N/A',
            'is_global_admin' => $_SESSION['is_global_admin'] ?? false,
            'profile_image_url' => $_SESSION['profile_image_url']
        ], 
        'current_warehouse_id' => get_current_warehouse_id(), 
        'current_warehouse_name' => get_current_warehouse_name(),
        'current_warehouse_role' => get_current_warehouse_role()
    ];
}

function refresh_and_send_auth_status($conn) {
    sendJsonResponse(refresh_and_get_auth_status_data($conn));
}

function create_remember_me_token($conn, int $user_id) {
    $selector = bin2hex(random_bytes(16));
    $validator = bin2hex(random_bytes(32));
    $validator_hash = hash('sha256', $validator);
    $expires_at = (new DateTime())->add(new DateInterval('P' . REMEMBER_ME_EXPIRATION_DAYS . 'D'))->format('Y-m-d H:i:s');

    $stmt = $conn->prepare("DELETE FROM auth_tokens WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $stmt->close();

    $stmt = $conn->prepare("INSERT INTO auth_tokens (user_id, selector, validator_hash, expires_at) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isss", $user_id, $selector, $validator_hash, $expires_at);
    $stmt->execute();
    $stmt->close();

    $cookie_value = $selector . ':' . $validator;
    setcookie(REMEMBER_ME_COOKIE_NAME, $cookie_value, [
        'expires' => time() + (86400 * REMEMBER_ME_EXPIRATION_DAYS),
        'path' => '/',
        'httponly' => true,
        'secure' => isset($_SERVER['HTTPS']),
        'samesite' => 'Lax'
    ]);
}

function validate_remember_me_cookie($conn): bool {
    if (empty($_COOKIE[REMEMBER_ME_COOKIE_NAME])) {
        return false;
    }

    list($selector, $validator) = explode(':', $_COOKIE[REMEMBER_ME_COOKIE_NAME], 2);
    if (empty($selector) || empty($validator)) {
        return false;
    }

    $stmt = $conn->prepare("SELECT * FROM auth_tokens WHERE selector = ? AND expires_at > NOW()");
    $stmt->bind_param("s", $selector);
    $stmt->execute();
    $token = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$token) {
        clear_remember_me_cookie($conn);
        return false;
    }

    if (hash_equals($token['validator_hash'], hash('sha256', $validator))) {
        $stmt = $conn->prepare("SELECT * FROM users WHERE user_id = ?");
        $stmt->bind_param("i", $token['user_id']);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($user) {
            session_regenerate_id(true);
            $new_session_id = session_id();
            set_user_session($user);
            $_SESSION['last_activity'] = time();

            update_active_session_and_log_activity($conn, $user['user_id'], $new_session_id);

            process_warehouse_assignments($conn, $user['user_id']);
            
            create_remember_me_token($conn, $user['user_id']);
            
            return true;
        }
    }

    $stmt = $conn->prepare("DELETE FROM auth_tokens WHERE user_id = ?");
    $stmt->bind_param("i", $token['user_id']);
    $stmt->execute();
    $stmt->close();
    clear_remember_me_cookie($conn);

    return false;
}

function clear_remember_me_cookie($conn) {
    if (isset($_COOKIE[REMEMBER_ME_COOKIE_NAME])) {
        list($selector) = explode(':', $_COOKIE[REMEMBER_ME_COOKIE_NAME], 2);
        if ($selector) {
            $stmt = $conn->prepare("DELETE FROM auth_tokens WHERE selector = ?");
            $stmt->bind_param("s", $selector);
            $stmt->execute();
            $stmt->close();
        }
        setcookie(REMEMBER_ME_COOKIE_NAME, '', time() - 3600, '/');
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
    $warehouses = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
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
        $stmt = $conn->prepare("SELECT warehouse_name FROM warehouses WHERE warehouse_id = ? AND is_active = 1");
        $stmt->bind_param("i", $warehouse_id);
        $stmt->execute();
        $warehouse_name = $stmt->get_result()->fetch_assoc()['warehouse_name'] ?? null;
        $stmt->close();
    } else {
        $assigned_warehouses = $_SESSION['assigned_warehouses'] ?? [];
        foreach ($assigned_warehouses as $wh) {
            if ($wh['warehouse_id'] == $warehouse_id) {
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
