<?php
// api/inbound.php
// 013-inbound_api.php

/*
* MODIFICATION SUMMARY:
* 013 (2025-08-19): Refined the container status update logic to correctly handle partial verification.
* - `updateContainerStatus`: The logic is now more robust. It ensures that a container remains in the 'Arrived' state as long as there are still items with an 'Expected' status. It will only transition to 'Processing' or other states once ALL items have been verified. This is the key fix to prevent the verification UI from disappearing prematurely.
* - All other functions remain the same as they correctly support the intended workflow.
*/

require_once __DIR__ . '/../config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// --- HELPER FUNCTION ---
function convertDotToDate($dot_code, $expiry_years = 2) {
    if (!preg_match('/^(\d{2})(\d{2})$/', $dot_code, $matches)) { return null; }
    $week = (int)$matches[1];
    $year = (int)$matches[2];
    $full_year = 2000 + $year;
    if ($week < 1 || $week > 54) { return null; }
    $date = new DateTime();
    $date->setISODate($full_year, $week);
    $date->modify("+" . (int)$expiry_years . " years"); 
    return $date->format('Y-m-d');
}

// --- ROUTING ---
switch ($method) {
    case 'GET':
        authorize_user_role(['viewer', 'operator', 'manager']);
        if ($action === 'getAvailableLocations') {
            handleGetAvailableLocations($conn, $current_warehouse_id);
        } elseif ($action === 'getProductsWithInventory') {
            handleGetProductsWithInventory($conn, $current_warehouse_id);
        } elseif ($action === 'getPutawayHistory') {
            handleGetPutawayHistory($conn, $current_warehouse_id);
        } elseif ($action === 'getInventoryLabelData') {
            handleGetInventoryLabelData($conn, $current_warehouse_id);
        } elseif ($action === 'getStickersForInventory') {
            handleGetStickersForInventory($conn, $current_warehouse_id);
        } else {
            handleGetInbound($conn, $current_warehouse_id);
        }
        break;
    case 'POST':
        authorize_user_role(['operator', 'manager']);
        if ($action === 'createReceipt') {
            handleCreateReceipt($conn, $current_warehouse_id);
        } elseif ($action === 'addContainer') {
            handleAddContainer($conn, $current_warehouse_id);
        } elseif ($action === 'updateContainer') {
            handleUpdateContainer($conn, $current_warehouse_id);
        } elseif ($action === 'deleteContainer') {
            handleDeleteContainer($conn, $current_warehouse_id);
        } elseif ($action === 'addExpectedItem') {
            handleAddExpectedItem($conn, $current_warehouse_id);
        } elseif ($action === 'addBulkExpectedItems') {
            handleAddBulkExpectedItems($conn, $current_warehouse_id);
        } elseif ($action === 'markContainerArrived') {
            handleMarkContainerArrived($conn, $current_warehouse_id);
        } elseif ($action === 'verifyAndReceiveItems') {
            handleVerifyAndReceiveItems($conn, $current_warehouse_id);
        } elseif ($action === 'putawayItem') {
            handlePutawayItem($conn, $current_warehouse_id);
        } elseif ($action === 'cancelReceipt') {
            handleCancelReceipt($conn, $current_warehouse_id);
        } elseif ($action === 'updateInboundItem') { 
            handleUpdateInboundItem($conn, $current_warehouse_id);
        } elseif ($action === 'deleteInboundItem') { 
            handleDeleteInboundItem($conn, $current_warehouse_id);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Invalid POST action'], 400);
        }
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

// --- CORE GET FUNCTIONS ---

function handleGetInbound($conn, $warehouse_id) {
    if (isset($_GET['receipt_id'])) {
        $receipt_id = filter_var($_GET['receipt_id'], FILTER_VALIDATE_INT);
        if(!$receipt_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Receipt ID.'], 400); return; }

        $stmt = $conn->prepare("SELECT ir.*, s.supplier_name, u.full_name AS received_by_user FROM inbound_receipts ir LEFT JOIN suppliers s ON ir.supplier_id = s.supplier_id LEFT JOIN users u ON ir.received_by = u.user_id WHERE ir.receipt_id = ? AND ir.warehouse_id = ?");
        $stmt->bind_param("ii", $receipt_id, $warehouse_id);
        $stmt->execute();
        $receipt = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$receipt) { sendJsonResponse(['success' => false, 'message' => 'Inbound receipt not found.'], 404); return; }

        $stmt_containers = $conn->prepare("SELECT * FROM inbound_receipt_containers WHERE receipt_id = ? ORDER BY container_id ASC");
        $stmt_containers->bind_param("i", $receipt_id);
        $stmt_containers->execute();
        $containers = $stmt_containers->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_containers->close();

        $stmt_items = $conn->prepare("SELECT ii.*, p.sku, p.product_name, p.article_no FROM inbound_items ii JOIN products p ON ii.product_id = p.product_id WHERE ii.receipt_id = ?");
        $stmt_items->bind_param("i", $receipt_id);
        $stmt_items->execute();
        $items_flat = $stmt_items->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_items->close();

        $items_grouped = [];
        foreach ($items_flat as $item) {
            $items_grouped[$item['container_id']][] = $item;
        }

        foreach ($containers as &$container) {
            $container['items'] = $items_grouped[$container['container_id']] ?? [];
        }
        unset($container);

        $receipt['containers'] = $containers;
        sendJsonResponse(['success' => true, 'data' => $receipt]);

    } else {
        $stmt = $conn->prepare("SELECT ir.*, w.warehouse_name, s.supplier_name FROM inbound_receipts ir JOIN warehouses w ON ir.warehouse_id = w.warehouse_id LEFT JOIN suppliers s ON ir.supplier_id = s.supplier_id WHERE ir.warehouse_id = ? ORDER BY ir.created_at DESC, ir.receipt_id DESC");
        $stmt->bind_param("i", $warehouse_id);
        $stmt->execute();
        $receipts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        sendJsonResponse(['success' => true, 'data' => $receipts]);
    }
}

// --- CORE POST FUNCTIONS ---

function handleCreateReceipt($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $supplier_id = filter_var($input['supplier_id'] ?? null, FILTER_VALIDATE_INT);
    if (empty($supplier_id)) { sendJsonResponse(['success' => false, 'message' => 'Please select a supplier.'], 400); return; }
    
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

        $stmt = $conn->prepare("INSERT INTO inbound_receipts (warehouse_id, receipt_number, supplier_id, status, received_by) VALUES (?, ?, ?, 'Pending', ?)");
        $stmt->bind_param("isii", $warehouse_id, $receipt_number, $supplier_id, $_SESSION['user_id']);
        if (!$stmt->execute()) { throw new Exception('Failed to create receipt in database.'); }
        $receipt_id = $stmt->insert_id;
        $stmt->close();

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Receipt {$receipt_number} created.", 'receipt_id' => $receipt_id, 'receipt_number' => $receipt_number], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

function handleAddContainer($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $receipt_id = filter_var($input['receipt_id'] ?? null, FILTER_VALIDATE_INT);
    $container_number = sanitize_input($input['container_number'] ?? '');
    $expected_arrival_date = sanitize_input($input['expected_arrival_date'] ?? '');
    $reference_number_input = sanitize_input($input['reference_number'] ?? '');

    if (!$receipt_id || empty($container_number) || empty($expected_arrival_date)) { 
        sendJsonResponse(['success' => false, 'message' => 'Receipt ID, Container No, and Expected Arrival are required.'], 400); 
        return; 
    }

    $conn->begin_transaction();
    try {
        $stmt_get_supplier = $conn->prepare("SELECT supplier_id FROM inbound_receipts WHERE receipt_id = ?");
        $stmt_get_supplier->bind_param("i", $receipt_id);
        $stmt_get_supplier->execute();
        $receipt_data = $stmt_get_supplier->get_result()->fetch_assoc();
        $stmt_get_supplier->close();
        if (!$receipt_data) {
            throw new Exception("Receipt not found.");
        }
        $supplier_id = $receipt_data['supplier_id'];

        $stmt_count = $conn->prepare("SELECT container_id, reference_number FROM inbound_receipt_containers WHERE receipt_id = ? ORDER BY container_id ASC");
        $stmt_count->bind_param("i", $receipt_id);
        $stmt_count->execute();
        $existing_containers = $stmt_count->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt_count->close();
        
        $container_count = count($existing_containers);
        $final_reference_number = '';

        if ($container_count == 0) {
            if (empty($reference_number_input)) {
                throw new Exception("Reference Number is required for the first container.");
            }
            $final_reference_number = $reference_number_input;
        } else {
            $base_ref = $existing_containers[0]['reference_number'];
            $base_ref_parts = explode('-', $base_ref);
            $base_ref = $base_ref_parts[0];

            if ($container_count == 1) {
                $first_container_id = $existing_containers[0]['container_id'];
                $first_ref_updated = $base_ref . '-1';
                $stmt_update_first = $conn->prepare("UPDATE inbound_receipt_containers SET reference_number = ? WHERE container_id = ?");
                $stmt_update_first->bind_param("si", $first_ref_updated, $first_container_id);
                $stmt_update_first->execute();
                $stmt_update_first->close();
            }
            $final_reference_number = $base_ref . '-' . ($container_count + 1);
        }

        $stmt = $conn->prepare("INSERT INTO inbound_receipt_containers (receipt_id, supplier_id, bl_number, container_number, serial_number, reference_number, expected_arrival_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Expected')");
        $stmt->bind_param("iisssss", $receipt_id, $supplier_id, sanitize_input($input['bl_number'] ?? ''), $container_number, sanitize_input($input['serial_number'] ?? ''), $final_reference_number, $expected_arrival_date);
        if (!$stmt->execute()) { throw new Exception("Failed to add container."); }
        $container_id = $stmt->insert_id;
        $stmt->close();
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Container {$container_number} added.", 'container_id' => $container_id], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

function handleUpdateContainer($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $container_id = filter_var($input['container_id'] ?? null, FILTER_VALIDATE_INT);
    $container_number = sanitize_input($input['container_number'] ?? '');
    $expected_arrival_date = sanitize_input($input['expected_arrival_date'] ?? '');
    $reference_number = sanitize_input($input['reference_number'] ?? '');

    if (!$container_id || empty($container_number) || empty($expected_arrival_date)) { sendJsonResponse(['success' => false, 'message' => 'Container ID, Container No, and Expected Arrival are required.'], 400); return; }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status FROM inbound_receipt_containers WHERE container_id = ?");
        $stmt_check->bind_param("i", $container_id);
        $stmt_check->execute();
        $container = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$container) {
             throw new Exception("Container not found.", 404);
        }
        if ($container['status'] !== 'Expected') {
            throw new Exception("Cannot modify a container that is not in 'Expected' status.", 409);
        }

        $stmt = $conn->prepare("UPDATE inbound_receipt_containers SET bl_number = ?, container_number = ?, serial_number = ?, reference_number = ?, expected_arrival_date = ? WHERE container_id = ?");
        $stmt->bind_param("sssssi", sanitize_input($input['bl_number'] ?? ''), $container_number, sanitize_input($input['serial_number'] ?? ''), $reference_number, $expected_arrival_date, $container_id);
        if (!$stmt->execute()) { throw new Exception("Failed to update container."); }
        $stmt->close();
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Container {$container_number} updated."]);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleDeleteContainer($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $container_id = filter_var($input['container_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$container_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Container ID.'], 400); return; }

    $conn->begin_transaction();
    try {
        $stmt_get_receipt = $conn->prepare("SELECT receipt_id, status FROM inbound_receipt_containers WHERE container_id = ?");
        $stmt_get_receipt->bind_param("i", $container_id);
        $stmt_get_receipt->execute();
        $container_data = $stmt_get_receipt->get_result()->fetch_assoc();
        $stmt_get_receipt->close();

        if (!$container_data) { throw new Exception("Container not found."); }
        
        $receipt_id = $container_data['receipt_id'];
        
        if ($container_data['status'] !== 'Expected') {
             throw new Exception("Cannot delete a container that is not in 'Expected' status.", 409);
        }

        $stmt_check = $conn->prepare("SELECT container_id FROM inbound_items WHERE container_id = ? LIMIT 1");
        $stmt_check->bind_param("i", $container_id);
        $stmt_check->execute();
        if ($stmt_check->get_result()->num_rows > 0) {
            throw new Exception("Cannot delete a container that already has expected items. Please delete the items first.", 409);
        }
        $stmt_check->close();

        $stmt = $conn->prepare("DELETE FROM inbound_receipt_containers WHERE container_id = ?");
        $stmt->bind_param("i", $container_id);
        if (!$stmt->execute()) { throw new Exception("Failed to delete container."); }
        $stmt->close();
        
        updateReceiptStatus($conn, $receipt_id);

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Container deleted successfully."]);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}


function handlePutawayItem($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $receipt_id = (int)($input['receipt_id'] ?? 0);
    $inbound_item_id = (int)($input['inbound_item_id'] ?? 0);
    $location_code = trim($input['location_article_no'] ?? '');
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
        if (!$item) { throw new Exception("Not enough quantity available for putaway."); }
        
        $container_id = $item['container_id'];
        $product_id = $item['product_id'];

        $stmt_loc = $conn->prepare("SELECT wl.location_id, wl.max_capacity_units, wl.is_locked, COALESCE(SUM(i.quantity), 0) AS current_usage FROM warehouse_locations wl LEFT JOIN inventory i ON wl.location_id = i.location_id WHERE wl.location_code = ? AND wl.warehouse_id = ? AND wl.is_active = 1 GROUP BY wl.location_id, wl.max_capacity_units, wl.is_locked");
        $stmt_loc->bind_param("si", $location_code, $warehouse_id);
        $stmt_loc->execute();
        $location_data = $stmt_loc->get_result()->fetch_assoc();
        $stmt_loc->close();
        if(!$location_data) { throw new Exception("Location not found, is inactive or is not in this warehouse."); }
        if($location_data['is_locked'] == 1) { throw new Exception("This location is locked and cannot be used for putaway."); }
        if (isset($location_data['max_capacity_units'])) {
            $available_capacity = $location_data['max_capacity_units'] - $location_data['current_usage'];
            if ($putaway_quantity > $available_capacity) {
                throw new Exception("Not enough space in location '{$location_code}'. Available: {$available_capacity} units.");
            }
        }
        $final_location_id = $location_data['location_id'];

        $stmt_update_item = $conn->prepare("UPDATE inbound_items SET putaway_quantity = putaway_quantity + ? WHERE inbound_item_id = ?");
        $stmt_update_item->bind_param("ii", $putaway_quantity, $inbound_item_id);
        if (!$stmt_update_item->execute() || $stmt_update_item->affected_rows === 0) { throw new Exception("Failed to update source item record."); }
        $stmt_update_item->close();
        
        $stmt_check_inv = $conn->prepare("SELECT inventory_id FROM inventory WHERE source_inbound_item_id = ? AND location_id = ?");
        $stmt_check_inv->bind_param("ii", $inbound_item_id, $final_location_id);
        $stmt_check_inv->execute();
        $existing_inv = $stmt_check_inv->get_result()->fetch_assoc();
        $stmt_check_inv->close();

        $new_inventory_id = null;

        if ($existing_inv) {
            $new_inventory_id = $existing_inv['inventory_id'];
            $stmt_update_inv = $conn->prepare("UPDATE inventory SET quantity = quantity + ? WHERE inventory_id = ?");
            $stmt_update_inv->bind_param("ii", $putaway_quantity, $new_inventory_id);
            if (!$stmt_update_inv->execute()) { throw new Exception("Failed to update inventory quantity: " . $stmt_update_inv->error); }
            $stmt_update_inv->close();
        } else {
            $new_batch_number = 'BCH-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
            $stmt_insert_inv = $conn->prepare("INSERT INTO inventory (warehouse_id, product_id, receipt_id, source_inbound_item_id, location_id, quantity, batch_number, expiry_date, dot_code, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt_insert_inv->bind_param("iiiisissds", $warehouse_id, $product_id, $receipt_id, $inbound_item_id, $final_location_id, $putaway_quantity, $new_batch_number, $item['expiry_date'], $item['dot_code'], $item['unit_cost']);
            if (!$stmt_insert_inv->execute()) { throw new Exception("Failed to insert new inventory record: " . $stmt_insert_inv->error); }
            $new_inventory_id = $stmt_insert_inv->insert_id;
            $stmt_insert_inv->close();
        }

        $stmt_sticker = $conn->prepare("INSERT INTO inbound_putaway_stickers (inventory_id, receipt_id, unique_barcode) VALUES (?, ?, ?)");
        for ($i = 0; $i < $putaway_quantity; $i++) {
            $unique_id = strtoupper(bin2hex(random_bytes(3)));
            $article_no_value = "INB-{$item['dot_code']}-{$unique_id}";
            $stmt_sticker->bind_param("iis", $new_inventory_id, $receipt_id, $article_no_value);
            if (!$stmt_sticker->execute()) { throw new Exception("Failed to generate sticker barcode: " . $stmt_sticker->error); }
        }
        $stmt_sticker->close();

        updateContainerStatus($conn, $container_id);
        updateReceiptStatus($conn, $receipt_id);

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => "Item putaway successfully.", 'inventory_id' => $new_inventory_id]);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleUpdateInboundItem($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $inbound_item_id = filter_var($input['inbound_item_id'] ?? null, FILTER_VALIDATE_INT);
    $quantity = filter_var($input['quantity'] ?? null, FILTER_VALIDATE_INT);
    $dot_code = sanitize_input($input['dot_code'] ?? '');
    if (!$inbound_item_id || !$quantity || $quantity <= 0 || empty($dot_code)) { sendJsonResponse(['success' => false, 'message' => 'Valid Item ID, Quantity, and DOT code are required.'], 400); return; }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT ii.status, ii.putaway_quantity, ii.receipt_id, ii.container_id, p.expiry_years FROM inbound_items ii JOIN products p ON ii.product_id = p.product_id WHERE ii.inbound_item_id = ?");
        $stmt_check->bind_param("i", $inbound_item_id);
        $stmt_check->execute();
        $item = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$item) { throw new Exception("Item not found.", 404); }
        if ($item['putaway_quantity'] > 0) { throw new Exception("Cannot edit an item that has been partially or fully put away.", 409); }

        $expiry_date = convertDotToDate($dot_code, $item['expiry_years']);
        if ($expiry_date === null) { throw new Exception("Invalid DOT format provided."); }
        
        if ($item['status'] === 'Expected') {
            $stmt_update = $conn->prepare("UPDATE inbound_items SET expected_quantity = ?, dot_code = ?, expiry_date = ? WHERE inbound_item_id = ?");
            $stmt_update->bind_param("issi", $quantity, $dot_code, $expiry_date, $inbound_item_id);
        } else { // 'Received' or other post-arrival statuses
            $stmt_update = $conn->prepare("UPDATE inbound_items SET received_quantity = ?, expected_quantity = ?, dot_code = ?, expiry_date = ? WHERE inbound_item_id = ?");
            $stmt_update->bind_param("iissi", $quantity, $quantity, $dot_code, $expiry_date, $inbound_item_id);
        }

        if (!$stmt_update->execute()) { throw new Exception("Failed to update item record."); }
        $stmt_update->close();

        updateContainerStatus($conn, $item['container_id']);
        updateReceiptStatus($conn, $item['receipt_id']);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Inbound item updated successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleDeleteInboundItem($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $inbound_item_id = filter_var($input['inbound_item_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$inbound_item_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid item ID.'], 400); return; }

    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT putaway_quantity, receipt_id, container_id FROM inbound_items WHERE inbound_item_id = ?");
        $stmt_check->bind_param("i", $inbound_item_id);
        $stmt_check->execute();
        $item = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();

        if (!$item) { throw new Exception("Item not found.", 404); }
        if ($item['putaway_quantity'] > 0) { throw new Exception("Cannot delete item that has been put away.", 409); }

        $stmt_delete = $conn->prepare("DELETE FROM inbound_items WHERE inbound_item_id = ?");
        $stmt_delete->bind_param("i", $inbound_item_id);
        $stmt_delete->execute();
        $stmt_delete->close();

        updateContainerStatus($conn, $item['container_id']);
        updateReceiptStatus($conn, $item['receipt_id']);
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Inbound item deleted successfully.']);
    } catch (Exception $e) { 
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

function handleCancelReceipt($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $receipt_id = filter_var($input['receipt_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$receipt_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Receipt ID'], 400); return; }
    
    $conn->begin_transaction();
    try {
        $stmt_check = $conn->prepare("SELECT status FROM inbound_receipts WHERE receipt_id = ? AND warehouse_id = ?");
        $stmt_check->bind_param("ii", $receipt_id, $warehouse_id);
        $stmt_check->execute();
        $receipt = $stmt_check->get_result()->fetch_assoc();
        $stmt_check->close();
        if (!$receipt) { throw new Exception("Receipt not found.", 404); }
        if ($receipt['status'] !== 'Pending') { throw new Exception("Only 'Pending' receipts can be cancelled.", 409); }

        $stmt_update = $conn->prepare("UPDATE inbound_receipts SET status = 'Cancelled' WHERE receipt_id = ?");
        $stmt_update->bind_param("i", $receipt_id);
        $stmt_update->execute();
        $stmt_update->close();
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Receipt has been cancelled.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 500);
    }
}

// --- STATUS UPDATE HELPER FUNCTIONS ---

function updateReceiptStatus($conn, $receipt_id) {
    $stmt_containers = $conn->prepare("SELECT status FROM inbound_receipt_containers WHERE receipt_id = ?");
    $stmt_containers->bind_param("i", $receipt_id);
    $stmt_containers->execute();
    $containers = $stmt_containers->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_containers->close();

    $total_containers = count($containers);
    $new_status = 'Pending'; // Default status

    if ($total_containers > 0) {
        $completed_containers = 0;
        $any_processing = false;
        $any_arrived_or_later = false;

        foreach ($containers as $container) {
            if ($container['status'] === 'Completed') {
                $completed_containers++;
            }
            if (!in_array($container['status'], ['Expected', 'Completed'])) {
                $any_processing = true;
            }
             if (!in_array($container['status'], ['Expected'])) {
                $any_arrived_or_later = true;
            }
        }

        if ($completed_containers === $total_containers) {
            $new_status = 'Completed';
        } elseif ($any_processing) {
            $new_status = 'Partially Putaway';
        } elseif ($any_arrived_or_later) {
            $new_status = 'Received';
        } else {
            $new_status = 'Pending';
        }
    } else {
        $new_status = 'Pending';
    }
    
    $stmt_update = $conn->prepare("UPDATE inbound_receipts SET status = ? WHERE receipt_id = ?");
    $stmt_update->bind_param("si", $new_status, $receipt_id);
    $stmt_update->execute();
    $stmt_update->close();
}

function updateContainerStatus($conn, $container_id) {
    if (!$container_id) return;

    $stmt_container = $conn->prepare("SELECT status FROM inbound_receipt_containers WHERE container_id = ?");
    $stmt_container->bind_param("i", $container_id);
    $stmt_container->execute();
    $container = $stmt_container->get_result()->fetch_assoc();
    $stmt_container->close();
    if (!$container) return;
    $current_status = $container['status'];

    if ($current_status === 'Expected') return;

    $stmt_check_expected = $conn->prepare("SELECT COUNT(*) as remaining_expected FROM inbound_items WHERE container_id = ? AND status = 'Expected'");
    $stmt_check_expected->bind_param("i", $container_id);
    $stmt_check_expected->execute();
    $remaining_expected = $stmt_check_expected->get_result()->fetch_assoc()['remaining_expected'];
    $stmt_check_expected->close();

    $stmt_summary = $conn->prepare("SELECT SUM(received_quantity) AS total_received, SUM(putaway_quantity) AS total_putaway FROM inbound_items WHERE container_id = ?");
    $stmt_summary->bind_param("i", $container_id);
    $stmt_summary->execute();
    $summary = $stmt_summary->get_result()->fetch_assoc();
    $stmt_summary->close();

    $total_received = (int)($summary['total_received'] ?? 0);
    $total_putaway = (int)($summary['total_putaway'] ?? 0);

    $new_status = $current_status;

    if ($remaining_expected == 0) {
        if ($total_received > 0) {
            if ($total_putaway >= $total_received) {
                $new_status = 'Completed';
            } elseif ($total_putaway > 0) {
                $new_status = 'Partially Putaway';
            } else {
                $new_status = 'Processing';
            }
        } else {
             $new_status = 'Processing';
        }
    } else {
        $new_status = 'Arrived';
    }

    if ($new_status !== $current_status) {
        $stmt_update = $conn->prepare("UPDATE inbound_receipt_containers SET status = ? WHERE container_id = ?");
        $stmt_update->bind_param("si", $new_status, $container_id);
        $stmt_update->execute();
        $stmt_update->close();
    }
}


// --- OTHER GET FUNCTIONS ---

function handleGetAvailableLocations($conn, $warehouse_id) {
    $sql = "
        SELECT 
            wl.location_id, 
            wl.location_code, 
            wl.max_capacity_units, 
            wl.is_locked,
            COALESCE((SELECT SUM(quantity) FROM inventory WHERE location_id = wl.location_id), 0) as current_usage 
        FROM 
            warehouse_locations wl
        JOIN 
            location_types lt ON wl.location_type_id = lt.type_id
        WHERE 
            wl.warehouse_id = ? 
            AND wl.is_active = 1 
            AND lt.type_name NOT IN ('bin', 'block_area', 'ground')
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $locations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $locations]);
}

function handleGetProductsWithInventory($conn, $warehouse_id) {
    $sql = "SELECT p.product_id, p.sku, p.product_name, p.article_no, p.expiry_years, p.is_active FROM products p ORDER BY p.product_name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $products = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $products]);
}

function handleGetPutawayHistory($conn, $warehouse_id) {
    $receipt_id = filter_input(INPUT_GET, 'receipt_id', FILTER_VALIDATE_INT);
    if (!$receipt_id) { sendJsonResponse(['success' => false, 'message' => 'A valid Receipt ID is required.'], 400); return; }
    $stmt = $conn->prepare("SELECT i.inventory_id, i.quantity, i.dot_code, i.source_inbound_item_id, p.product_name, p.sku, wl.location_code FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN warehouse_locations wl ON i.location_id = wl.location_id WHERE i.receipt_id = ? AND i.warehouse_id = ? ORDER BY i.created_at DESC");
    $stmt->bind_param("ii", $receipt_id, $warehouse_id);
    $stmt->execute();
    $history = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $history]);
}

function handleGetInventoryLabelData($conn, $warehouse_id) {
    $inventory_id = filter_input(INPUT_GET, 'inventory_id', FILTER_VALIDATE_INT);
    if (!$inventory_id) { sendJsonResponse(['success' => false, 'message' => 'A valid Inventory ID is required.'], 400); return; }
    $stmt = $conn->prepare("SELECT i.inventory_id, i.quantity, i.dot_code, i.expiry_date, i.batch_number, p.product_name, p.sku, p.article_no AS product_article_no, p.expiry_years, wl.location_code, ir.receipt_number FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN warehouse_locations wl ON i.location_id = wl.location_id JOIN inbound_receipts ir ON i.receipt_id = ir.receipt_id WHERE i.inventory_id = ? AND i.warehouse_id = ?");
    $stmt->bind_param("ii", $inventory_id, $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($result) { sendJsonResponse(['success' => true, 'data' => $result]); } 
    else { sendJsonResponse(['success' => false, 'message' => 'Inventory item not found.'], 404); }
}

function handleGetStickersForInventory($conn, $warehouse_id) {
    $inventory_id = filter_input(INPUT_GET, 'inventory_id', FILTER_VALIDATE_INT);
    if (!$inventory_id) { sendJsonResponse(['success' => false, 'message' => 'A valid Inventory ID is required.'], 400); return; }
    $stmt = $conn->prepare("SELECT unique_barcode FROM inbound_putaway_stickers WHERE inventory_id = ?");
    $stmt->bind_param("i", $inventory_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $result]);
}


// --- NEW/MODIFIED FUNCTIONS FOR PRE-ARRIVAL & RECEIVING ---

function handleAddExpectedItem($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $receipt_id = filter_var($input['receipt_id'] ?? null, FILTER_VALIDATE_INT);
    $container_id = filter_var($input['container_id'] ?? null, FILTER_VALIDATE_INT);
    $article_no = sanitize_input($input['article_no'] ?? '');
    $expected_quantity = filter_var($input['expected_quantity'] ?? 0, FILTER_VALIDATE_INT);
    $dot_code = sanitize_input($input['dot_code'] ?? '');
    if (!$receipt_id || !$container_id || empty($article_no) || $expected_quantity <= 0 || empty($dot_code)) { sendJsonResponse(['success' => false, 'message' => 'All fields are required.'], 400); return; }

    $conn->begin_transaction();
    try {
        $stmt_prod = $conn->prepare("SELECT product_id, expiry_years, is_active FROM products WHERE article_no = ?");
        $stmt_prod->bind_param("s", $article_no);
        $stmt_prod->execute();
        $product = $stmt_prod->get_result()->fetch_assoc();
        $stmt_prod->close();
        if (!$product) throw new Exception("Product not found.");
        if ($product['is_active'] != 1) throw new Exception("Cannot add an inactive product.");
        
        $expiry_date = convertDotToDate($dot_code, $product['expiry_years']);
        if ($expiry_date === null) throw new Exception("Invalid DOT format.");

        $stmt_find = $conn->prepare("SELECT inbound_item_id FROM inbound_items WHERE receipt_id = ? AND container_id = ? AND product_id = ? AND dot_code = ? AND status = 'Expected'");
        $stmt_find->bind_param("iiis", $receipt_id, $container_id, $product['product_id'], $dot_code);
        $stmt_find->execute();
        $existing_item = $stmt_find->get_result()->fetch_assoc();
        $stmt_find->close();

        if ($existing_item) {
            $stmt_update = $conn->prepare("UPDATE inbound_items SET expected_quantity = expected_quantity + ? WHERE inbound_item_id = ?");
            $stmt_update->bind_param("ii", $expected_quantity, $existing_item['inbound_item_id']);
            if (!$stmt_update->execute()) throw new Exception("Failed to update expected item.");
            $stmt_update->close();
            $user_message = "Updated existing expected item.";
        } else {
            $batch_number = 'BCH-' . date('ym') . '-' . strtoupper(bin2hex(random_bytes(4)));
            $stmt_insert = $conn->prepare("INSERT INTO inbound_items (receipt_id, container_id, product_id, expected_quantity, received_quantity, batch_number, expiry_date, dot_code, unit_cost, status) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 'Expected')");
            $unit_cost = (isset($input['unit_cost']) && is_numeric($input['unit_cost']) ? (float)$input['unit_cost'] : null);
            $stmt_insert->bind_param("iiiisssd", $receipt_id, $container_id, $product['product_id'], $expected_quantity, $batch_number, $expiry_date, $dot_code, $unit_cost);
            if (!$stmt_insert->execute()) throw new Exception("Failed to create expected item: " . $stmt_insert->error);
            $stmt_insert->close();
            $user_message = "Expected item added successfully.";
        }

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => $user_message]);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
    }
}

function handleAddBulkExpectedItems($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $container_id = filter_var($input['container_id'] ?? null, FILTER_VALIDATE_INT);
    $items = $input['items'] ?? [];

    if (!$container_id || empty($items) || !is_array($items)) {
        sendJsonResponse(['success' => false, 'message' => 'Container ID and a list of items are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        $stmt_get_receipt = $conn->prepare("SELECT receipt_id FROM inbound_receipt_containers WHERE container_id = ?");
        $stmt_get_receipt->bind_param("i", $container_id);
        $stmt_get_receipt->execute();
        $container_data = $stmt_get_receipt->get_result()->fetch_assoc();
        $receipt_id = $container_data['receipt_id'] ?? null;
        $stmt_get_receipt->close();
        if (!$receipt_id) throw new Exception("Container not found.");

        $processed_count = 0;
        $error_list = [];
        
        $aggregated_items = [];
        foreach ($items as $item) {
            $key = ($item['article_no'] ?? '') . '-' . ($item['dot'] ?? '');
            if (!isset($aggregated_items[$key])) {
                $aggregated_items[$key] = [
                    'article_no' => $item['article_no'],
                    'qty' => 0,
                    'dot' => $item['dot']
                ];
            }
            $aggregated_items[$key]['qty'] += (int)($item['qty'] ?? 0);
        }

        foreach($aggregated_items as $index => $item) {
            $article_no = sanitize_input($item['article_no'] ?? '');
            $expected_quantity = filter_var($item['qty'] ?? 0, FILTER_VALIDATE_INT);
            $dot_code = sanitize_input($item['dot'] ?? '');

            if (empty($article_no) || $expected_quantity <= 0 || empty($dot_code)) {
                $error_list[] = "Item '{$article_no}': Invalid data provided.";
                continue;
            }

            $stmt_prod = $conn->prepare("SELECT product_id, expiry_years, is_active FROM products WHERE article_no = ?");
            $stmt_prod->bind_param("s", $article_no);
            $stmt_prod->execute();
            $product = $stmt_prod->get_result()->fetch_assoc();
            $stmt_prod->close();
            if (!$product) {
                $error_list[] = "Item '{$article_no}': Product not found.";
                continue;
            }
            if ($product['is_active'] != 1) {
                $error_list[] = "Item '{$article_no}': Product is inactive and was skipped.";
                continue;
            }

            $expiry_date = convertDotToDate($dot_code, $product['expiry_years']);
            if ($expiry_date === null) {
                $error_list[] = "Item '{$article_no}': Invalid DOT format '{$dot_code}'.";
                continue;
            }
            
            $stmt_find = $conn->prepare("SELECT inbound_item_id FROM inbound_items WHERE container_id = ? AND product_id = ? AND dot_code = ? AND status = 'Expected'");
            $stmt_find->bind_param("iis", $container_id, $product['product_id'], $dot_code);
            $stmt_find->execute();
            $existing_item = $stmt_find->get_result()->fetch_assoc();
            $stmt_find->close();

            if ($existing_item) {
                $stmt_update = $conn->prepare("UPDATE inbound_items SET expected_quantity = expected_quantity + ? WHERE inbound_item_id = ?");
                $stmt_update->bind_param("ii", $expected_quantity, $existing_item['inbound_item_id']);
                if ($stmt_update->execute()) {
                    $processed_count++;
                } else {
                    $error_list[] = "Item '{$article_no}': Database error on update.";
                }
                $stmt_update->close();
            } else {
                $batch_number = 'BCH-' . date('ym') . '-' . strtoupper(bin2hex(random_bytes(4)));
                $stmt_insert = $conn->prepare("INSERT INTO inbound_items (receipt_id, container_id, product_id, expected_quantity, received_quantity, status, batch_number, expiry_date, dot_code) VALUES (?, ?, ?, ?, 0, 'Expected', ?, ?, ?)");
                $stmt_insert->bind_param("iiiisss", $receipt_id, $container_id, $product['product_id'], $expected_quantity, $batch_number, $expiry_date, $dot_code);
                if ($stmt_insert->execute()) {
                    $processed_count++;
                } else {
                     $error_list[] = "Item '{$article_no}': Database error on insert.";
                }
                $stmt_insert->close();
            }
        }

        if ($processed_count > 0) {
            $conn->commit();
            $message = "Successfully processed {$processed_count} unique items.";
            if (!empty($error_list)) {
                sendJsonResponse(['success' => true, 'message' => $message . " Some items were skipped.", 'errors' => $error_list]);
            } else {
                sendJsonResponse(['success' => true, 'message' => $message]);
            }
        } else {
             if (!empty($error_list)) {
                throw new Exception("Import failed. " . implode(" ", $error_list));
            } else {
                throw new Exception("Import failed. No valid items were processed.");
            }
        }

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}


function handleMarkContainerArrived($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $container_id = filter_var($input['container_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$container_id) { sendJsonResponse(['success' => false, 'message' => 'Invalid Container ID.'], 400); return; }

    $conn->begin_transaction();
    try {
        $stmt_get_receipt = $conn->prepare("SELECT receipt_id FROM inbound_receipt_containers WHERE container_id = ?");
        $stmt_get_receipt->bind_param("i", $container_id);
        $stmt_get_receipt->execute();
        $container_data = $stmt_get_receipt->get_result()->fetch_assoc();
        $receipt_id = $container_data['receipt_id'] ?? null;
        $stmt_get_receipt->close();
        if (!$receipt_id) throw new Exception("Container not found.");

        $stmt_update_container = $conn->prepare("UPDATE inbound_receipt_containers SET status = 'Arrived', actual_arrival_date = NOW() WHERE container_id = ? AND status = 'Expected'");
        $stmt_update_container->bind_param("i", $container_id);
        $stmt_update_container->execute();
        if($stmt_update_container->affected_rows == 0) {
            throw new Exception("Container was not in 'Expected' status or not found.");
        }
        $stmt_update_container->close();

        $stmt_update_receipt = $conn->prepare("UPDATE inbound_receipts SET actual_arrival_date = COALESCE(actual_arrival_date, NOW()) WHERE receipt_id = ?");
        $stmt_update_receipt->bind_param("i", $receipt_id);
        $stmt_update_receipt->execute();
        $stmt_update_receipt->close();
        
        updateReceiptStatus($conn, $receipt_id);
        
        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Container marked as arrived. Please verify items to receive them.']);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}

function handleVerifyAndReceiveItems($conn, $warehouse_id) {
    $input = json_decode(file_get_contents('php://input'), true);
    $container_id = filter_var($input['container_id'] ?? null, FILTER_VALIDATE_INT);
    $items = $input['items'] ?? [];

    if (!$container_id || empty($items)) {
        sendJsonResponse(['success' => false, 'message' => 'Container ID and items for verification are required.'], 400);
        return;
    }
    
    $conn->begin_transaction();
    try {
        $stmt_get_receipt = $conn->prepare("SELECT receipt_id FROM inbound_receipt_containers WHERE container_id = ?");
        $stmt_get_receipt->bind_param("i", $container_id);
        $stmt_get_receipt->execute();
        $container_data = $stmt_get_receipt->get_result()->fetch_assoc();
        $receipt_id = $container_data['receipt_id'] ?? null;
        $stmt_get_receipt->close();
        if (!$receipt_id) throw new Exception("Container not found.");

        $stmt = $conn->prepare("UPDATE inbound_items SET received_quantity = ?, verified_quantity = ?, status = 'Received' WHERE inbound_item_id = ? AND container_id = ?");

        foreach($items as $item) {
            $verified_qty = (int)$item['verified_quantity'];
            $inbound_item_id = (int)$item['inbound_item_id'];
            $stmt->bind_param("iiii", $verified_qty, $verified_qty, $inbound_item_id, $container_id);
            $stmt->execute();
        }
        $stmt->close();

        updateContainerStatus($conn, $container_id);
        updateReceiptStatus($conn, $receipt_id);

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'All items have been verified and received into stock.']);

    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
    }
}
