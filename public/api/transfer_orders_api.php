<?php
// Enable full error reporting for debugging purposes.
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set header at the very top to avoid issues.
header('Content-Type: application/json');

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
ob_start(); // Start output buffering to catch any stray output

authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

$action = $_GET['action'] ?? '';

// A centralized function to safely send JSON response and terminate the script.
function send_json_response($data) {
    ob_end_clean(); // Clear buffer to prevent mixing errors with JSON
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Helper function to check if a location is locked
function checkLocationLockById($conn, $location_id) {
    $stmt = $conn->prepare("SELECT location_code, is_locked FROM warehouse_locations WHERE location_id = ?");
    $stmt->bind_param("i", $location_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($result && $result['is_locked'] == 1) {
        throw new Exception("Operation failed: Location '{$result['location_code']}' is locked and cannot be used for transfers.");
    }
}

switch ($action) {
    case 'get_transfer_history': getTransferHistory($conn, $current_warehouse_id); break;
    case 'get_products_in_warehouse': getProductsInWarehouse($conn, $current_warehouse_id); break;
    case 'get_product_inventory': getProductInventory($conn); break;
    case 'create_transfer': createTransfer($conn); break;
    case 'get_transfer_details_for_print': getTransferDetailsForPrint($conn); break;
    default: send_json_response(['status' => 'error', 'message' => 'Invalid action specified.']);
}

function getTransferHistory($conn, $warehouse_id) {
    $sql = "SELECT 
                t.transfer_id,
                t.transfer_order_number,
                sw.warehouse_name AS source_warehouse,
                dw.warehouse_name AS destination_warehouse,
                t.created_at,
                t.status,
                COALESCE(SUM(ti.quantity), 0) as total_quantity
            FROM transfer_orders t
            JOIN warehouses sw ON t.source_warehouse_id = sw.warehouse_id
            JOIN warehouses dw ON t.destination_warehouse_id = dw.warehouse_id
            LEFT JOIN transfer_order_items ti ON t.transfer_id = ti.transfer_id
            WHERE t.source_warehouse_id = ? OR t.destination_warehouse_id = ?
            GROUP BY t.transfer_id
            ORDER BY t.created_at DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $warehouse_id, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $history = $result->fetch_all(MYSQLI_ASSOC);
    
    send_json_response(['status' => 'success', 'data' => $history]);
}

function getProductsInWarehouse($conn, $warehouse_id) {
    if (empty($warehouse_id)) {
        send_json_response(['status' => 'error', 'message' => 'Warehouse ID is required.']);
    }

    $sql = "SELECT 
                p.product_id, p.product_name, p.sku, p.article_no, 
                COALESCE(SUM(i.quantity), 0) AS total_stock
            FROM products p
            LEFT JOIN inventory i ON p.product_id = i.product_id 
            JOIN warehouse_locations wl ON i.location_id = wl.location_id
            WHERE i.warehouse_id = ? AND wl.is_locked = 0
            GROUP BY p.product_id, p.product_name, p.sku, p.article_no
            ORDER BY p.product_name";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $products = $result->fetch_all(MYSQLI_ASSOC);
    
    send_json_response(['status' => 'success', 'data' => $products]);
}

function getProductInventory($conn) {
    $warehouse_id = $_GET['warehouse_id'] ?? 0;
    $product_id = $_GET['product_id'] ?? 0;

    if (empty($warehouse_id) || empty($product_id)) {
        send_json_response(['status' => 'error', 'message' => 'Warehouse and Product IDs are required.']);
    }

    $sql = "SELECT 
                wl.location_id, 
                wl.location_code AS location_name, 
                SUM(i.quantity) AS quantity,
                (SELECT batch_number FROM inventory WHERE location_id = wl.location_id AND product_id = ? ORDER BY created_at DESC LIMIT 1) as batch_number,
                (SELECT dot_code FROM inventory WHERE location_id = wl.location_id AND product_id = ? ORDER BY created_at DESC LIMIT 1) as dot_code
            FROM inventory i
            JOIN warehouse_locations wl ON i.location_id = wl.location_id
            WHERE i.warehouse_id = ? AND i.product_id = ? AND i.quantity > 0 AND wl.is_locked = 0
            GROUP BY wl.location_id, wl.location_code";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iiii", $product_id, $product_id, $warehouse_id, $product_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $inventory = $result->fetch_all(MYSQLI_ASSOC);

    send_json_response(['status' => 'success', 'data' => $inventory]);
}

function createTransfer($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    $items = $data['items'] ?? [];

    if (empty($items)) {
        send_json_response(['status' => 'error', 'message' => 'No items provided for transfer.']);
    }

    $conn->begin_transaction();
    try {
        // Check lock status before proceeding
        foreach ($items as $item) {
            checkLocationLockById($conn, $item['sourceLocationId']);
            checkLocationLockById($conn, $item['destLocationId']);
        }

        $order_number = 'TRN-' . date('Ymd-His');
        $sql_header = "INSERT INTO transfer_orders (transfer_order_number, source_warehouse_id, destination_warehouse_id, notes, created_by_user_id, status) VALUES (?, ?, ?, ?, ?, 'Completed')";
        $stmt_header = $conn->prepare($sql_header);
        $stmt_header->bind_param("siisi", $order_number, $data['source_warehouse_id'], $data['destination_warehouse_id'], $data['notes'], $_SESSION['user_id']);
        $stmt_header->execute();
        $transfer_id = $conn->insert_id;

        foreach ($items as $item) {
            $sql_item = "INSERT INTO transfer_order_items (transfer_id, product_id, quantity, source_location_id, destination_location_id, batch_number, dot_code) VALUES (?, ?, ?, ?, ?, ?, ?)";
            $stmt_item = $conn->prepare($sql_item);
            $stmt_item->bind_param("iiiiiss", $transfer_id, $item['productId'], $item['quantity'], $item['sourceLocationId'], $item['destLocationId'], $item['batch'], $item['dot']);
            $stmt_item->execute();

            $sql_decrease = "UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND location_id = ? AND batch_number <=> ?";
            $stmt_decrease = $conn->prepare($sql_decrease);
            $stmt_decrease->bind_param("iiss", $item['quantity'], $item['productId'], $item['sourceLocationId'], $item['batch']);
            $stmt_decrease->execute();

            $sql_check_dest = "SELECT inventory_id FROM inventory WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code <=> ?";
            $stmt_check_dest = $conn->prepare($sql_check_dest);
            $stmt_check_dest->bind_param("iiss", $item['productId'], $item['destLocationId'], $item['batch'], $item['dot']);
            $stmt_check_dest->execute();
            if ($stmt_check_dest->get_result()->num_rows > 0) {
                $sql_increase = "UPDATE inventory SET quantity = quantity + ? WHERE product_id = ? AND location_id = ? AND batch_number <=> ? AND dot_code <=> ?";
                $stmt_increase = $conn->prepare($sql_increase);
                $stmt_increase->bind_param("iisss", $item['quantity'], $item['productId'], $item['destLocationId'], $item['batch'], $item['dot']);
                $stmt_increase->execute();
            } else {
                $sql_insert = "INSERT INTO inventory (product_id, warehouse_id, location_id, quantity, batch_number, dot_code) VALUES (?, ?, ?, ?, ?, ?)";
                $stmt_insert = $conn->prepare($sql_insert);
                $stmt_insert->bind_param("iiiiss", $item['productId'], $data['destination_warehouse_id'], $item['destLocationId'], $item['quantity'], $item['batch'], $item['dot']);
                $stmt_insert->execute();
            }
        }

        $conn->commit();
        send_json_response(['status' => 'success', 'message' => 'Transfer order created successfully!', 'transfer_id' => $transfer_id]);

    } catch (Exception $e) {
        $conn->rollback();
        error_log("Transfer Order Error: " . $e->getMessage());
        send_json_response(['status' => 'error', 'message' => 'Failed to create transfer order: ' . $e->getMessage()]);
    }
}

function getTransferDetailsForPrint($conn) {
    $transfer_id = $_GET['id'] ?? 0;
    if (!$transfer_id) {
        send_json_response(['status' => 'error', 'message' => 'Invalid Transfer ID.']);
    }

    $sql_header = "SELECT t.*, sw.warehouse_name as source_warehouse, dw.warehouse_name as dest_warehouse, dw.address as dest_address, dw.city as dest_city, u.full_name as created_by
                   FROM transfer_orders t
                   JOIN warehouses sw ON t.source_warehouse_id = sw.warehouse_id
                   JOIN warehouses dw ON t.destination_warehouse_id = dw.warehouse_id
                   JOIN users u ON t.created_by_user_id = u.user_id
                   WHERE t.transfer_id = ?";
    $stmt_header = $conn->prepare($sql_header);
    $stmt_header->bind_param("i", $transfer_id);
    $stmt_header->execute();
    $header = $stmt_header->get_result()->fetch_assoc();

    if ($header) {
        $sql_items = "SELECT 
                        ti.*, 
                        p.product_name, p.sku, p.article_no, 
                        sl.location_code as source_location,
                        dl.location_code as destination_location
                      FROM transfer_order_items ti
                      JOIN products p ON ti.product_id = p.product_id
                      JOIN warehouse_locations sl ON ti.source_location_id = sl.location_id
                      JOIN warehouse_locations dl ON ti.destination_location_id = dl.location_id
                      WHERE ti.transfer_id = ?";
        $stmt_items = $conn->prepare($sql_items);
        $stmt_items->bind_param("i", $transfer_id);
        $stmt_items->execute();
        $items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
        
        send_json_response(['status' => 'success', 'header' => $header, 'items' => $items]);
    } else {
        send_json_response(['status' => 'error', 'message' => 'Transfer order not found.']);
    }
}

$conn->close();
