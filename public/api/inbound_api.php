<?php
// api/inbound.php

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

// Authenticate user and ensure a warehouse is selected for ALL inbound operations.
authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// --- MODIFIED HELPER FUNCTION ---
// Converts a WWYY DOT code into a YYYY-MM-DD expiry date.
function convertDotToDate($dot_code, $expiry_years = 2) { // Default to 2 years if not provided
    if (!preg_match('/^(\d{2})(\d{2})$/', $dot_code, $matches)) {
        return null;
    }
    $week = (int)$matches[1];
    $year = (int)$matches[2];
    $full_year = 2000 + $year;

    if ($week < 1 || $week > 54) {
        return null;
    }

    $date = new DateTime();
    $date->setISODate($full_year, $week);
    
    // Use the dynamic expiry years
    $date->modify("+" . (int)$expiry_years . " years"); 
    
    return $date->format('Y-m-d');
}


// Authorize based on the request method and user's role.
switch ($method) {
    case 'GET':
        authorize_user_role(['viewer', 'operator', 'manager']);
        if ($action === 'getAvailableLocations') {
            handleGetAvailableLocations($conn, $current_warehouse_id);
        } elseif ($action === 'getReportData') {
            handleGetReportData($conn, $current_warehouse_id);
        } elseif ($action === 'getProductsWithInventory') {
            handleGetProductsWithInventory($conn, $current_warehouse_id);
        } elseif ($action === 'getBinLocation') {
            handleGetBinLocation($conn, $current_warehouse_id);
        } elseif ($action === 'getInventoryDetailsByBatch') {
            handleGetInventoryDetailsByBatch($conn, $current_warehouse_id);
        } elseif ($action === 'getInventoryLabelData') {
            handleGetInventoryLabelData($conn, $current_warehouse_id);
        } elseif ($action === 'getStickersForInventory') {
            handleGetStickersForInventory($conn, $current_warehouse_id);
        } elseif ($action === 'getPutawayHistory') {
            handleGetPutawayHistory($conn, $current_warehouse_id);
        } else {
            handleGetInbound($conn, $current_warehouse_id);
        }
        break;
    case 'POST':
        authorize_user_role(['operator', 'manager']);
        if ($action === 'createReceipt') {
            handleCreateReceipt($conn, $current_warehouse_id);
        } elseif ($action === 'receiveItem') {
            handleReceiveItem($conn, $current_warehouse_id);
        } elseif ($action === 'putawayItem') {
            handlePutawayItem($conn, $current_warehouse_id);
        } elseif ($action === 'cancelReceipt') {
            handleCancelReceipt($conn, $current_warehouse_id);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Invalid POST action'], 400);
        }
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetPutawayHistory($conn, $warehouse_id) {
    $receipt_id = filter_input(INPUT_GET, 'receipt_id', FILTER_VALIDATE_INT);
    if (!$receipt_id) {
        sendJsonResponse(['success' => false, 'message' => 'A valid Receipt ID is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT 
            i.inventory_id,
            i.quantity,
            i.dot_code,
            p.product_name,
            p.sku,
            wl.location_code
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        WHERE i.receipt_id = ? AND i.warehouse_id = ?
        ORDER BY i.created_at DESC
    ");
    $stmt->bind_param("ii", $receipt_id, $warehouse_id);
    $stmt->execute();
    $history = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJsonResponse(['success' => true, 'data' => $history]);
}

function handleGetStickersForInventory($conn, $warehouse_id) {
    $inventory_id = filter_input(INPUT_GET, 'inventory_id', FILTER_VALIDATE_INT);
    if (!$inventory_id) {
        sendJsonResponse(['success' => false, 'message' => 'A valid Inventory ID is required.'], 400);
        return;
    }
    
    $stmt = $conn->prepare("SELECT unique_barcode FROM inbound_putaway_stickers WHERE inventory_id = ?");
    $stmt->bind_param("i", $inventory_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    sendJsonResponse(['success' => true, 'data' => $result]);
}


function handleGetInventoryLabelData($conn, $warehouse_id) {
    $inventory_id = filter_input(INPUT_GET, 'inventory_id', FILTER_VALIDATE_INT);
    if (!$inventory_id) {
        sendJsonResponse(['success' => false, 'message' => 'A valid Inventory ID is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT 
            i.inventory_id, i.quantity, i.dot_code, i.expiry_date, i.batch_number,
            p.product_name, p.sku, p.barcode AS product_barcode, p.expiry_years,
            wl.location_code, ir.receipt_number
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        JOIN inbound_receipts ir ON i.receipt_id = ir.receipt_id
        WHERE i.inventory_id = ? AND i.warehouse_id = ?
    ");
    $stmt->bind_param("ii", $inventory_id, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($result) {
        sendJsonResponse(['success' => true, 'data' => $result]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Inventory item not found.'], 404);
    }
}

function handleGetInventoryDetailsByBatch($conn, $warehouse_id) {
    $batch_number = trim($_GET['batch_number'] ?? '');
    if (empty($batch_number)) {
        sendJsonResponse(['success' => false, 'message' => 'Batch number is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT 
            i.batch_number,
            i.quantity,
            i.expiry_date,
            i.dot_code,
            p.product_name,
            p.sku,
            wl.location_code,
            ir.receipt_number AS source_receipt_number
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        JOIN inbound_receipts ir ON i.receipt_id = ir.receipt_id
        WHERE i.batch_number = ? AND i.warehouse_id = ?
        LIMIT 1
    ");
    $stmt->bind_param("si", $batch_number, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($result) {
        sendJsonResponse(['success' => true, 'data' => $result]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Batch details not found.'], 404);
    }
}

function handleGetBinLocation($conn, $warehouse_id) {
    $stmt = $conn->prepare("
        SELECT wl.location_code 
        FROM warehouse_locations wl
        JOIN location_types lt ON wl.location_type_id = lt.type_id
        WHERE wl.warehouse_id = ? AND lt.type_name = 'bin' AND wl.is_active = 1
        ORDER BY wl.location_id ASC 
        LIMIT 1
    ");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($result) {
        sendJsonResponse(['success' => true, 'data' => $result]);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'No active "bin" location found for this warehouse. Please create a location with the type "bin".'], 404);
    }
}


function handleGetProductsWithInventory($conn, $warehouse_id) {
    $sql = "
        SELECT 
            p.product_id,
            p.sku,
            p.product_name,
            p.barcode,
            p.expiry_years,
            COALESCE(SUM(i.quantity), 0) AS total_stock
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id AND i.warehouse_id = ?
        GROUP BY p.product_id, p.sku, p.product_name, p.barcode, p.expiry_years
        ORDER BY p.product_name ASC
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $products = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $products]);
}

function handleGetReportData($conn, $warehouse_id) {
    $receipt_id = filter_input(INPUT_GET, 'receipt_id', FILTER_VALIDATE_INT);
    if (!$receipt_id) {
        sendJsonResponse(['success' => false, 'message' => 'A valid Receipt ID is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("
        SELECT ir.*, s.supplier_name 
        FROM inbound_receipts ir 
        LEFT JOIN suppliers s ON ir.supplier_id = s.supplier_id
        WHERE ir.receipt_id = ? AND ir.warehouse_id = ?
    ");
    $stmt->bind_param("ii", $receipt_id, $warehouse_id);
    $stmt->execute();
    $receipt = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$receipt) {
        sendJsonResponse(['success' => false, 'message' => 'Receipt not found.'], 404);
        return;
    }

    $stmt_items = $conn->prepare("SELECT ii.*, p.sku, p.product_name, p.barcode FROM inbound_items ii JOIN products p ON ii.product_id = p.product_id WHERE ii.receipt_id = ? AND ii.expected_quantity > 0");
    $stmt_items->bind_param("i", $receipt_id);
    $stmt_items->execute();
    $main_items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_items->close();

    $stmt_putaways = $conn->prepare("
        SELECT i.quantity, i.batch_number, i.expiry_date, i.dot_code, i.product_id, i.unit_cost, wl.location_code AS final_location_code
        FROM inventory i
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        WHERE i.receipt_id = ?
    ");
    $stmt_putaways->bind_param("i", $receipt_id);
    $stmt_putaways->execute();
    $putaway_details = $stmt_putaways->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_putaways->close();

    $putaway_details_by_product = [];
    foreach($putaway_details as $detail) {
        $putaway_details_by_product[$detail['product_id']][] = $detail;
    }

    $report_items = [];
    foreach ($main_items as $item) {
        $report_items[] = $item; 

        if (isset($putaway_details_by_product[$item['product_id']])) {
            foreach ($putaway_details_by_product[$item['product_id']] as $detail) {
                $report_items[] = [
                    'sku' => $item['sku'],
                    'product_name' => $item['product_name'],
                    'barcode' => $item['barcode'],
                    'status' => 'Putaway',
                    'batch_number' => $detail['batch_number'],
                    'expected_quantity' => 0,
                    'received_quantity' => 0,
                    'putaway_quantity' => $detail['quantity'],
                    'final_location_code' => $detail['final_location_code'],
                    'expiry_date' => $detail['expiry_date'],
                    'dot_code' => $detail['dot_code'],
                    'unit_cost' => $detail['unit_cost']
                ];
            }
        }
    }

    sendJsonResponse(['success' => true, 'data' => ['receipt' => $receipt, 'items' => $report_items]]);
}


function handleGetAvailableLocations($conn, $warehouse_id) {
    $sql = "
        SELECT
            wl.location_id,
            wl.location_code,
            wl.max_capacity_units,
            COALESCE(inv_sum.total_quantity, 0) as current_usage,
            (wl.max_capacity_units - COALESCE(inv_sum.total_quantity, 0)) as available_capacity
        FROM 
            warehouse_locations wl
        LEFT JOIN 
            (SELECT location_id, SUM(quantity) as total_quantity 
             FROM inventory 
             GROUP BY location_id) AS inv_sum 
        ON 
            wl.location_id = inv_sum.location_id
        WHERE 
            wl.warehouse_id = ? AND wl.is_active = 1
        HAVING
            available_capacity IS NOT NULL AND available_capacity > 0
        ORDER BY 
            wl.location_code ASC;
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $locations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJsonResponse(['success' => true, 'data' => $locations]);
}


// --- MODIFIED FUNCTION ---
function handleGetInbound($conn, $warehouse_id) {
    if (isset($_GET['receipt_id'])) {
        $receipt_id = filter_var($_GET['receipt_id'], FILTER_VALIDATE_INT);
        if(!$receipt_id) {
            sendJsonResponse(['success' => false, 'message' => 'Invalid Receipt ID.'], 400);
            return;
        }

        $stmt = $conn->prepare("
            SELECT ir.*, s.supplier_name, u.full_name AS received_by_user 
            FROM inbound_receipts ir 
            LEFT JOIN suppliers s ON ir.supplier_id = s.supplier_id
            LEFT JOIN users u ON ir.received_by = u.user_id 
            WHERE ir.receipt_id = ? AND ir.warehouse_id = ?
        ");
        $stmt->bind_param("ii", $receipt_id, $warehouse_id);
        $stmt->execute();
        $receipt = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$receipt) {
            sendJsonResponse(['success' => false, 'message' => 'Inbound receipt not found.'], 404);
            return;
        }

        // MODIFIED: Added p.barcode
        $stmt_items = $conn->prepare("
            SELECT 
                ii.*, p.sku, p.product_name, p.barcode
            FROM inbound_items ii 
            JOIN products p ON ii.product_id = p.product_id 
            WHERE ii.receipt_id = ?
        ");
        $stmt_items->bind_param("i", $receipt_id);
        $stmt_items->execute();
        $items = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_items->close();

        $stmt_putaways = $conn->prepare("
            SELECT 
                i.inventory_id, i.quantity, i.batch_number, i.source_inbound_item_id, wl.location_code
            FROM inventory i
            JOIN warehouse_locations wl ON i.location_id = wl.location_id
            WHERE i.receipt_id = ?
        ");
        $stmt_putaways->bind_param("i", $receipt_id);
        $stmt_putaways->execute();
        $putaways_flat = $stmt_putaways->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_putaways->close();
        
        $putaways_grouped = [];
        foreach ($putaways_flat as $putaway) {
            $key = $putaway['source_inbound_item_id'];
            if (!isset($putaways_grouped[$key])) {
                $putaways_grouped[$key] = [];
            }
            $putaways_grouped[$key][] = $putaway;
        }

        foreach ($items as &$item) {
            $key = $item['inbound_item_id'];
            $item['putaways'] = $putaways_grouped[$key] ?? [];
        }
        unset($item);

        $receipt['items'] = $items;
        sendJsonResponse(['success' => true, 'data' => $receipt]);

    } else {
        $stmt = $conn->prepare("SELECT ir.*, w.warehouse_name, s.supplier_name FROM inbound_receipts ir JOIN warehouses w ON ir.warehouse_id = w.warehouse_id LEFT JOIN suppliers s ON ir.supplier_id = s.supplier_id WHERE ir.warehouse_id = ? ORDER BY ir.expected_arrival_date DESC, ir.receipt_id DESC");
        $stmt->bind_param("i", $warehouse_id);
        $stmt->execute();
        $receipts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        sendJsonResponse(['success' => true, 'data' => $receipts]);
    }
}

function handleCreateReceipt($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);

    $supplier_id = filter_var($input['supplier_id'] ?? null, FILTER_VALIDATE_INT);
    $expected_arrival_date = sanitize_input($input['expected_arrival_date'] ?? '');
    $received_by = $_SESSION['user_id'];

    if (empty($supplier_id) || empty($expected_arrival_date)) {
        sendJsonResponse(['success' => false, 'message' => 'Supplier and Expected Arrival Date are required.'], 400);
        return;
    }
    
    $conn->begin_transaction();
    try {
        do {
            $receipt_number = 'RCPT-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
            $stmt_check = $conn->prepare("SELECT receipt_id FROM inbound_receipts WHERE receipt_number = ? AND warehouse_id = ?");
            $stmt_check->bind_param("si", $receipt_number, $warehouse_id);
            $stmt_check->execute();
            $result_check = $stmt_check->get_result();
            $stmt_check->close();
        } while ($result_check->num_rows > 0);

        $stmt = $conn->prepare("INSERT INTO inbound_receipts (warehouse_id, receipt_number, supplier_id, expected_arrival_date, status, received_by) VALUES (?, ?, ?, ?, 'Pending', ?)");
        $stmt->bind_param("isisi", $warehouse_id, $receipt_number, $supplier_id, $expected_arrival_date, $received_by);
        
        if (!$stmt->execute()) {
             throw new Exception('Failed to create receipt in database.');
        }
        $receipt_id = $stmt->insert_id;
        $stmt->close();

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Receipt {$receipt_number} created successfully.", 'receipt_id' => $receipt_id, 'receipt_number' => $receipt_number], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleReceiveItem($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['receipt_id'])) { sendJsonResponse(['success' => false, 'message' => 'Receipt ID is missing.'], 400); return; }
    if (empty($input['barcode'])) { sendJsonResponse(['success' => false, 'message' => 'Product barcode is missing.'], 400); return; }
    if (!isset($input['received_quantity']) || !is_numeric($input['received_quantity']) || $input['received_quantity'] <= 0) { sendJsonResponse(['success' => false, 'message' => 'A valid, positive quantity is required.'], 400); return; }
    if (empty($input['dot_code'])) { sendJsonResponse(['success' => false, 'message' => 'DOT Code (WWYY) is a required field.'], 400); return; }

    $receipt_id = (int)$input['receipt_id'];
    $barcode = trim($input['barcode']);
    $received_quantity = (int)$input['received_quantity'];
    $batch_number = trim($input['batch_number'] ?? '');
    $dot_code = trim($input['dot_code']);
    $unit_cost = isset($input['unit_cost']) && is_numeric($input['unit_cost']) ? (float)$input['unit_cost'] : null;

    $conn->begin_transaction();

    try {
        $stmt_prod = $conn->prepare("SELECT product_id, expiry_years FROM products WHERE barcode = ?");
        $stmt_prod->bind_param("s", $barcode);
        $stmt_prod->execute();
        $product = $stmt_prod->get_result()->fetch_assoc();
        $stmt_prod->close();
        if (!$product) {
            throw new Exception("Product not found for the given barcode.");
        }
        $product_id = $product['product_id'];
        $expiry_years = $product['expiry_years'];

        $expiry_date = convertDotToDate($dot_code, $expiry_years);
        if ($expiry_date === null) {
            throw new Exception("Invalid DOT format. Please use WWYY.");
        }

        if (empty($batch_number)) {
            $batch_number = 'BCH-' . date('ym') . '-' . strtoupper(bin2hex(random_bytes(4)));
        }

        $stmt_check_arrival = $conn->prepare("SELECT actual_arrival_date FROM inbound_receipts WHERE receipt_id = ?");
        $stmt_check_arrival->bind_param("i", $receipt_id);
        $stmt_check_arrival->execute();
        $receipt_data = $stmt_check_arrival->get_result()->fetch_assoc();
        $stmt_check_arrival->close();

        if ($receipt_data && is_null($receipt_data['actual_arrival_date'])) {
            $stmt_set_arrival = $conn->prepare("UPDATE inbound_receipts SET actual_arrival_date = NOW() WHERE receipt_id = ?");
            $stmt_set_arrival->bind_param("i", $receipt_id);
            $stmt_set_arrival->execute();
            $stmt_set_arrival->close();
        }

        $received_location_id = null;
        $stmt_rec_loc = $conn->prepare("SELECT location_id FROM warehouse_locations WHERE warehouse_id = ? AND location_type_id = (SELECT type_id FROM location_types WHERE type_name = 'receiving_bay' LIMIT 1) LIMIT 1");
        $stmt_rec_loc->bind_param("i", $warehouse_id);
        $stmt_rec_loc->execute();
        $rec_loc_data = $stmt_rec_loc->get_result()->fetch_assoc();
        if ($rec_loc_data) {
            $received_location_id = $rec_loc_data['location_id'];
        }
        $stmt_rec_loc->close();

        $status = 'Received';
        $stmt_insert = $conn->prepare("
            INSERT INTO inbound_items (
                receipt_id, product_id, expected_quantity, received_quantity,
                batch_number, expiry_date, dot_code, unit_cost, status, received_location_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt_insert->bind_param(
            "iiissssdsi", 
            $receipt_id, $product_id, $received_quantity, $received_quantity, 
            $batch_number, $expiry_date, $dot_code, $unit_cost, $status, $received_location_id
        );
        
        if (!$stmt_insert->execute()) {
            throw new Exception("Failed to create new item record: " . $stmt_insert->error);
        }
        $stmt_insert->close();
        $user_message = "Item received successfully with batch: $batch_number";

        updateReceiptStatus($conn, $receipt_id);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => $user_message]);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handlePutawayItem($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $receipt_id = (int)($input['receipt_id'] ?? 0);
    $inbound_item_id = (int)($input['inbound_item_id'] ?? 0);
    $location_barcode = trim($input['location_barcode'] ?? '');
    $putaway_quantity = (int)($input['putaway_quantity'] ?? 0);

    if ($putaway_quantity <= 0) {
        sendJsonResponse(['success' => false, 'message' => 'Quantity must be positive'], 400);
        return;
    }
    
    $conn->begin_transaction();

    try {
        $stmt = $conn->prepare("SELECT * FROM inbound_items WHERE inbound_item_id = ? AND receipt_id = ? AND (received_quantity - putaway_quantity) >= ?");
        $stmt->bind_param("iii", $inbound_item_id, $receipt_id, $putaway_quantity);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$item) {
            throw new Exception("No received item available for putaway matching the criteria (check quantity).");
        }
        $product_id = $item['product_id'];

        $is_expired = (!empty($item['expiry_date']) && strtotime($item['expiry_date']) < strtotime('today'));
        $final_location_id = null;

        if ($is_expired) {
            $stmt_bin = $conn->prepare("
                SELECT wl.location_id 
                FROM warehouse_locations wl
                JOIN location_types lt ON wl.location_type_id = lt.type_id
                WHERE wl.warehouse_id = ? AND lt.type_name = 'bin' AND wl.is_active = 1
                LIMIT 1
            ");
            $stmt_bin->bind_param("i", $warehouse_id);
            $stmt_bin->execute();
            $bin_location_data = $stmt_bin->get_result()->fetch_assoc();
            $stmt_bin->close();

            if (!$bin_location_data) {
                throw new Exception("Product is expired, but no 'bin' location is configured for this warehouse.");
            }
            $final_location_id = $bin_location_data['location_id'];
        } else {
            if (empty($location_barcode)) {
                 throw new Exception("Location is required for non-expired items.");
            }
            
            $stmt_loc = $conn->prepare("
                SELECT 
                    wl.location_id, wl.max_capacity_units,
                    COALESCE(SUM(i.quantity), 0) AS current_usage
                FROM warehouse_locations wl
                LEFT JOIN inventory i ON wl.location_id = i.location_id
                WHERE wl.location_code = ? AND wl.warehouse_id = ? AND wl.is_active = 1
                GROUP BY wl.location_id, wl.max_capacity_units
            ");
            $stmt_loc->bind_param("si", $location_barcode, $warehouse_id);
            $stmt_loc->execute();
            $location_data = $stmt_loc->get_result()->fetch_assoc();
            $stmt_loc->close();

            if (!$location_data) {
                throw new Exception("Location not found or is inactive in this warehouse");
            }

            if (isset($location_data['max_capacity_units'])) {
                $available_capacity = $location_data['max_capacity_units'] - $location_data['current_usage'];
                if ($putaway_quantity > $available_capacity) {
                    throw new Exception("Not enough space in location '{$location_barcode}'. Available capacity: {$available_capacity} units.");
                }
            }
            
            $final_location_id = $location_data['location_id'];
        }

        $stmt = $conn->prepare("UPDATE inbound_items SET putaway_quantity = putaway_quantity + ?, final_location_id = ? WHERE inbound_item_id = ?");
        $stmt->bind_param("iii", $putaway_quantity, $final_location_id, $item['inbound_item_id']);
        if (!$stmt->execute()) {
            throw new Exception("Failed to update source item record: " . $stmt->error);
        }
        $stmt->close();
        
        $new_batch_number = 'BCH-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));

        $stmt = $conn->prepare("
            INSERT INTO inventory (
                warehouse_id, product_id, receipt_id, source_inbound_item_id, location_id, quantity, 
                batch_number, expiry_date, dot_code, unit_cost
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("iiiisissds", 
            $warehouse_id, 
            $product_id, 
            $receipt_id,
            $inbound_item_id,
            $final_location_id,
            $putaway_quantity, 
            $new_batch_number,
            $item['expiry_date'],
            $item['dot_code'],
            $item['unit_cost']
        );
        if (!$stmt->execute()) {
            throw new Exception("Failed to update inventory: " . $conn->error);
        }
        $new_inventory_id = $stmt->insert_id;
        $stmt->close();

        $stmt_sticker = $conn->prepare("INSERT INTO inbound_putaway_stickers (inventory_id, receipt_id, unique_barcode) VALUES (?, ?, ?)");
        for ($i = 0; $i < $putaway_quantity; $i++) {
            $unique_id = strtoupper(bin2hex(random_bytes(3)));
            $barcode_value = "INB-{$item['dot_code']}-{$unique_id}";
            $stmt_sticker->bind_param("iis", $new_inventory_id, $receipt_id, $barcode_value);
            if (!$stmt_sticker->execute()) {
                throw new Exception("Failed to generate sticker barcode: " . $stmt_sticker->error);
            }
        }
        $stmt_sticker->close();

        updateReceiptStatus($conn, $receipt_id);

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Item putaway successfully.", 'inventory_id' => $new_inventory_id]);
    } catch (Exception $e) {
        $conn->rollback();
        error_log("Putaway Error: " . $e->getMessage());
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function updateReceiptStatus($conn, $receipt_id) {
    $stmt = $conn->prepare("
        SELECT 
            SUM(received_quantity) AS total_received,
            SUM(putaway_quantity) AS total_putaway
        FROM inbound_items
        WHERE receipt_id = ?
    ");
    $stmt->bind_param("i", $receipt_id);
    $stmt->execute();
    $summary = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $new_status = 'Pending';
    if ($summary['total_received'] > 0) {
        if ($summary['total_putaway'] >= $summary['total_received']) {
            $new_status = 'Completed';
        } elseif ($summary['total_putaway'] > 0) {
            $new_status = 'Partially Putaway';
        } else {
            $new_status = 'Received';
        }
    }
    
    $stmt_update = $conn->prepare("UPDATE inbound_receipts SET status = ?, updated_at = NOW() WHERE receipt_id = ?");
    $stmt_update->bind_param("si", $new_status, $receipt_id);
    $stmt_update->execute();
    $stmt_update->close();

    $main_item_status = ($summary['total_putaway'] > 0) ? 'Partially Putaway' : 'Received';
    if ($summary['total_putaway'] >= $summary['total_received']) {
        $main_item_status = 'Putaway';
    }

    $stmt_item_update = $conn->prepare("UPDATE inbound_items SET status = ? WHERE receipt_id = ? AND expected_quantity > 0");
    $stmt_item_update->bind_param("si", $main_item_status, $receipt_id);
    $stmt_item_update->execute();
    $stmt_item_update->close();
}

function handleCancelReceipt($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $receipt_id = filter_var($input['receipt_id'] ?? null, FILTER_VALIDATE_INT);

    if (!$receipt_id) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid Receipt ID provided.'], 400);
        return;
    }
    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status FROM inbound_receipts WHERE receipt_id = ? AND warehouse_id = ?");
        $stmt_check->bind_param("ii", $receipt_id, $warehouse_id);
        $stmt_check->execute();
        $receipt = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$receipt) {
            throw new Exception("Receipt not found.", 404);
        }

        if ($receipt['status'] !== 'Pending') {
            throw new Exception("Cannot cancel receipt. Status is '{$receipt['status']}'. Only pending receipts can be cancelled.", 409);
        }

        $stmt_update = $conn->prepare("UPDATE inbound_receipts SET status = 'Cancelled' WHERE receipt_id = ?");
        $stmt_update->bind_param("i", $receipt_id);
        
        if (!$stmt_update->execute()) {
             throw new Exception('Failed to update receipt status in the database.');
        }
        $stmt_update->close();

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Receipt has been cancelled successfully.'], 200);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}
