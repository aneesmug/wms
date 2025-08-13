<?php
// api/reports_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

// Get DB connection and start output buffering
$conn = getDbConnection();
ob_start();

// Authenticate user and get current warehouse context
authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

// Route request based on 'action' parameter
$action = $_GET['action'] ?? '';

switch ($action) {
    // Dashboard Reports (Unaffected)
    case 'dashboardSummary': getDashboardSummary($conn, $current_warehouse_id); break;
    case 'getWeeklyActivity': getWeeklyActivity($conn, $current_warehouse_id); break;
    case 'getFastMovingItems': getFastMovingItems($conn, $current_warehouse_id); break;

    // --- GROUPED REPORTS ---
    
    // Global Reports
    case 'allWarehouseStockSummary': getAllWarehouseStockSummary($conn); break;
    case 'blockedAndLockedStock': getBlockedAndLockedStock($conn); break;

    // Inbound Operations
    case 'grReport': getGrReport($conn, $current_warehouse_id); break;
    case 'inboundHistory': getInboundHistory($conn, $current_warehouse_id); break;
    case 'receivingDiscrepancy': getReceivingDiscrepancy($conn, $current_warehouse_id); break;
    case 'supplierPerformance': getSupplierPerformance($conn, $current_warehouse_id); break;

    // Outbound Operations
    case 'outboundHistory': getOutboundHistory($conn, $current_warehouse_id); break;
    case 'returnHistory': getReturnHistory($conn, $current_warehouse_id); break;
    case 'onTimeShipment': getOnTimeShipment($conn, $current_warehouse_id); break;
    case 'orderLifecycle': getOrderLifecycleAnalysis($conn, $current_warehouse_id); break;
    case 'fillRate': getFillRateReport($conn, $current_warehouse_id); break;
    case 'orderMovementHistory': getOrderMovementHistory($conn, $current_warehouse_id); break;

    // Inventory Management
    case 'inventorySummary': getInventorySummary($conn, $current_warehouse_id); break;
    case 'stockByLocation': getStockByLocation($conn, $current_warehouse_id); break;
    case 'inventoryAging': getInventoryAging($conn, $current_warehouse_id); break;
    case 'transferHistory': getTransferHistory($conn, $current_warehouse_id); break;
    case 'deadStock': getDeadStockReport($conn, $current_warehouse_id); break;
    case 'expiringStock': getExpiringStock($conn, $current_warehouse_id); break; 
    case 'productMovement': getProductMovement($conn, $current_warehouse_id); break;
    // MODIFICATION: Added scrapHistory case
    case 'scrapHistory': getScrapHistory($conn, $current_warehouse_id); break;

    // Performance & User Activity
    case 'pickerPerformance': getPickerPerformance($conn, $current_warehouse_id); break;
    case 'userProductivity': getUserProductivity($conn, $current_warehouse_id); break;
    case 'orderFulfillmentLeadTime': getOrderFulfillmentLeadTime($conn, $current_warehouse_id); break;
    
    // Financial & Auditing
    case 'inventoryValuation': getInventoryValuation($conn, $current_warehouse_id); break;
    case 'stockAdjustmentHistory': getStockAdjustmentHistory($conn, $current_warehouse_id); break;
    case 'locationCapacity': getLocationCapacity($conn, $current_warehouse_id); break;
    case 'customerTransactionHistory': getCustomerTransactionHistory($conn); break;
    
    default:
        sendJsonResponse(['success' => false, 'message' => 'Invalid report action specified.'], 400);
        break;
}

// --- NEW GR REPORT FUNCTION ---

function getGrReport($conn, $warehouse_id) {
    $receipt_number = sanitize_input($_GET['filter'] ?? null);
    if (empty($receipt_number)) {
        sendJsonResponse(['success' => false, 'message' => 'Receipt Number is required for this report.'], 400);
        return;
    }

    $sql = "
        SELECT 
            p.article_no AS `Item Number`,
            p.product_name AS `Product Name`,
            ii.received_quantity AS `Quantity`,
            ii.dot_code AS `Batch Number`,
            irc.bl_number AS `Customer Reference`,
            irc.container_number AS `Customer Requisition`,
            irc.reference_number AS `Reference No`,
            DATE(irc.actual_arrival_date) AS `Requested receipt date`,
            w.warehouse_name AS Warehouse,
            irc.serial_number AS `Serial No`
        FROM inbound_items ii
        JOIN products p ON ii.product_id = p.product_id
        JOIN inbound_receipts ir ON ii.receipt_id = ir.receipt_id
        JOIN inbound_receipt_containers irc ON ii.container_id = irc.container_id
        JOIN warehouses w ON ir.warehouse_id = w.warehouse_id
        WHERE ir.receipt_number = ? AND ir.warehouse_id = ?
        ORDER BY irc.reference_number ASC
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $receipt_number, $warehouse_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    if (!empty($data)) {
        $total_quantity = 0;
        foreach ($data as $row) {
            $total_quantity += (int)$row['Quantity'];
        }

        // Add a total row
        $data[] = [
            'Item Number' => '',
            'Product Name' => 'Total',
            'Quantity' => $total_quantity,
            'Batch Number' => '',
            'Customer Reference' => '',
            'Customer Requisition' => '',
            'Reference No' => '',
            'Requested receipt date' => '',
            'Warehouse' => '',
            'Serial No' => ''
        ];
    }
    
    sendJsonResponse(['success' => true, 'data' => $data]);
}


// --- Dashboard Functions (Existing - Unchanged) ---

function getDashboardSummary($conn, $warehouse_id) {
    if (!$warehouse_id) {
        sendJsonResponse(['success' => false, 'message' => 'No warehouse selected.'], 400);
        return;
    }
    $summary = ['totalProducts' => 0, 'openInbounds' => 0, 'pendingOutbounds' => 0, 'shippedToday' => 0, 'receivedToday' => 0, 'activeLocations' => 0];
    $execute_query = function($sql, $params, $types) use ($conn) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $result ? reset($result) ?? 0 : 0;
    };
    $summary['totalProducts'] = $execute_query("SELECT SUM(quantity) FROM inventory WHERE warehouse_id = ?", [$warehouse_id], "i");
    $summary['openInbounds'] = $execute_query("SELECT COUNT(*) FROM inbound_receipts WHERE warehouse_id = ? AND status NOT IN ('Completed', 'Cancelled')", [$warehouse_id], "i");
    $summary['pendingOutbounds'] = $execute_query("SELECT COUNT(*) FROM outbound_orders WHERE warehouse_id = ? AND status NOT IN ('Shipped', 'Cancelled')", [$warehouse_id], "i");
    $summary['shippedToday'] = $execute_query("SELECT COUNT(*) FROM outbound_orders WHERE warehouse_id = ? AND status = 'Shipped' AND DATE(actual_ship_date) = CURDATE()", [$warehouse_id], "i");
    $summary['receivedToday'] = $execute_query("SELECT COUNT(*) FROM inbound_receipts WHERE warehouse_id = ? AND status = 'Completed' AND DATE(updated_at) = CURDATE()", [$warehouse_id], "i");
    $summary['activeLocations'] = $execute_query("SELECT COUNT(DISTINCT location_id) FROM inventory WHERE warehouse_id = ? AND quantity > 0", [$warehouse_id], "i");
    sendJsonResponse(['success' => true, 'data' => $summary]);
}

function getWeeklyActivity($conn, $warehouse_id) {
    if (!$warehouse_id) { sendJsonResponse(['success' => false, 'message' => 'No warehouse selected.'], 400); return; }
    $dates = [];
    for ($i = 29; $i >= 0; $i--) { $dates[date('Y-m-d', strtotime("-$i days"))] = ['inbound' => 0, 'outbound' => 0]; }
    $start_date = date('Y-m-d', strtotime('-29 days'));
    $sql_inbound = "SELECT DATE(updated_at) as date, COUNT(*) as count FROM inbound_receipts WHERE warehouse_id = ? AND status = 'Completed' AND DATE(updated_at) >= ? GROUP BY DATE(updated_at)";
    $stmt_inbound = $conn->prepare($sql_inbound);
    $stmt_inbound->bind_param("is", $warehouse_id, $start_date);
    $stmt_inbound->execute();
    $result_inbound = $stmt_inbound->get_result();
    while ($row = $result_inbound->fetch_assoc()) { if (isset($dates[$row['date']])) { $dates[$row['date']]['inbound'] = (int)$row['count']; } }
    $stmt_inbound->close();
    $sql_outbound = "SELECT DATE(actual_ship_date) as date, COUNT(*) as count FROM outbound_orders WHERE warehouse_id = ? AND status = 'Shipped' AND DATE(actual_ship_date) >= ? GROUP BY DATE(actual_ship_date)";
    $stmt_outbound = $conn->prepare($sql_outbound);
    $stmt_outbound->bind_param("is", $warehouse_id, $start_date);
    $stmt_outbound->execute();
    $result_outbound = $stmt_outbound->get_result();
    while ($row = $result_outbound->fetch_assoc()) { if (isset($dates[$row['date']])) { $dates[$row['date']]['outbound'] = (int)$row['count']; } }
    $stmt_outbound->close();
    $chart_data = ['labels' => array_keys($dates), 'datasets' => [['label' => 'Receipts Completed', 'data' => array_column($dates, 'inbound'), 'backgroundColor' => 'rgba(23, 162, 184, 0.6)', 'borderColor' => 'rgb(23, 162, 184)', 'borderWidth' => 1], ['label' => 'Orders Shipped', 'data' => array_column($dates, 'outbound'), 'backgroundColor' => 'rgba(255, 193, 7, 0.6)', 'borderColor' => 'rgb(255, 193, 7)', 'borderWidth' => 1]]];
    sendJsonResponse(['success' => true, 'data' => $chart_data]);
}

function getFastMovingItems($conn, $warehouse_id) {
    if (!$warehouse_id) { sendJsonResponse(['success' => true, 'data' => []]); return; }
    $stmt = $conn->prepare("SELECT p.sku, p.product_name, p.article_no, SUM(oip.picked_quantity) AS total_units_picked FROM outbound_item_picks AS oip JOIN outbound_items AS oi ON oip.outbound_item_id = oi.outbound_item_id JOIN products AS p ON oi.product_id = p.product_id JOIN outbound_orders AS oo ON oi.order_id = oo.order_id WHERE oo.warehouse_id = ? AND oip.picked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY p.product_id, p.sku, p.product_name, p.article_no ORDER BY total_units_picked DESC LIMIT 10");
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $items]);
}

// --- Helper for date filtering ---
function addDateFilter($sql, &$params, &$types, $date_column) {
    $start_date = sanitize_input($_GET['start_date'] ?? null);
    $end_date = sanitize_input($_GET['end_date'] ?? null);
    if ($start_date) {
        $sql .= " AND DATE($date_column) >= ?";
        $params[] = $start_date;
        $types .= "s";
    }
    if ($end_date) {
        $sql .= " AND DATE($date_column) <= ?";
        $params[] = $end_date;
        $types .= "s";
    }
    return $sql;
}

// --- NEW AND MODIFIED REPORT FUNCTIONS ---

function getBlockedAndLockedStock($conn) {
    $sql = "
        SELECT 
            w.warehouse_name,
            p.sku,
            p.product_name,
            p.article_no,
            wl.location_code,
            i.quantity,
            i.batch_number,
            i.dot_code,
            CASE
                WHEN wl.is_locked = 1 THEN 'Locked Location'
                WHEN lt.type_name = 'block_area' THEN 'Block Area'
                ELSE 'Unknown'
            END as reason
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id
        WHERE i.quantity > 0 AND (wl.is_locked = 1 OR lt.type_name = 'block_area')
        ORDER BY w.warehouse_name, reason, p.product_name
    ";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getAllWarehouseStockSummary($conn) {
    $sql = "
        SELECT 
            w.warehouse_name,
            p.sku,
            p.product_name,
            p.article_no,
            wl.location_code,
            i.quantity
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        WHERE i.quantity > 0
        ORDER BY w.warehouse_name, p.product_name, wl.location_code
    ";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getTransferHistory($conn, $warehouse_id) {
    $sql = "
        SELECT 
            to.transfer_order_number,
            sw.warehouse_name as source_warehouse,
            dw.warehouse_name as destination_warehouse,
            p.sku,
            p.product_name,
            p.article_no,
            toi.quantity,
            to.status,
            to.created_at,
            u.full_name as created_by
        FROM transfer_orders `to`
        JOIN transfer_order_items toi ON to.transfer_id = toi.transfer_id
        JOIN warehouses sw ON to.source_warehouse_id = sw.warehouse_id
        JOIN warehouses dw ON to.destination_warehouse_id = dw.warehouse_id
        JOIN products p ON toi.product_id = p.product_id
        LEFT JOIN users u ON to.created_by_user_id = u.user_id
        WHERE to.source_warehouse_id = ? OR to.destination_warehouse_id = ?
    ";
    $params = [$warehouse_id, $warehouse_id];
    $types = "ii";
    $sql = addDateFilter($sql, $params, $types, 'to.created_at');
    $sql .= " ORDER BY to.created_at DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getReturnHistory($conn, $warehouse_id) {
    $sql = "
        SELECT 
            r.return_number,
            oo.order_number,
            c.customer_name,
            p.sku,
            p.product_name,
            p.article_no,
            ri.expected_quantity,
            ri.processed_quantity,
            ri.condition,
            r.status as return_status,
            r.created_at as return_date,
            u.full_name as created_by
        FROM returns r
        JOIN return_items ri ON r.return_id = ri.return_id
        JOIN outbound_orders oo ON r.order_id = oo.order_id
        JOIN customers c ON r.customer_id = c.customer_id
        JOIN products p ON ri.product_id = p.product_id
        LEFT JOIN users u ON r.created_by = u.user_id
        WHERE oo.warehouse_id = ?
    ";
    $params = [$warehouse_id];
    $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'r.created_at');
    $sql .= " ORDER BY r.created_at DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}


function getReceivingDiscrepancy($conn, $warehouse_id) {
    $sql = "
        SELECT
            ir.receipt_number,
            s.supplier_name,
            ir.actual_arrival_date,
            p.sku,
            p.product_name,
            p.article_no,
            ii.expected_quantity,
            ii.received_quantity,
            (ii.received_quantity - ii.expected_quantity) AS discrepancy
        FROM inbound_items ii
        JOIN inbound_receipts ir ON ii.receipt_id = ir.receipt_id
        JOIN products p ON ii.product_id = p.product_id
        JOIN suppliers s ON ir.supplier_id = s.supplier_id
        WHERE ir.warehouse_id = ? AND ii.expected_quantity != ii.received_quantity
    ";
    $params = [$warehouse_id];
    $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'ir.actual_arrival_date');
    $sql .= " ORDER BY ir.actual_arrival_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getOnTimeShipment($conn, $warehouse_id) {
    $sql = "
        SELECT
            oo.order_number,
            c.customer_name,
            oo.order_date,
            oo.required_ship_date,
            oo.actual_ship_date,
            CASE
                WHEN oo.actual_ship_date IS NULL THEN 'Not Shipped'
                WHEN DATE(oo.actual_ship_date) <= DATE(oo.required_ship_date) THEN 'On-Time'
                ELSE 'Late'
            END AS on_time_status,
            DATEDIFF(oo.actual_ship_date, oo.required_ship_date) as days_late
        FROM outbound_orders oo
        JOIN customers c ON oo.customer_id = c.customer_id
        WHERE oo.warehouse_id = ? AND oo.status IN ('Shipped', 'Delivered', 'Partially Returned', 'Completed')
    ";
    $params = [$warehouse_id];
    $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'oo.order_date');
    $sql .= " ORDER BY oo.order_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getExpiringStock($conn, $warehouse_id) {
    // Default to showing items expiring in the next 90 days
    $days_filter = filter_input(INPUT_GET, 'days', FILTER_VALIDATE_INT) ?: 90;

    $sql = "
        SELECT
            p.sku,
            p.product_name,
            p.article_no,
            i.quantity,
            wl.location_code,
            i.batch_number,
            i.expiry_date,
            DATEDIFF(i.expiry_date, NOW()) AS days_to_expiry
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouse_locations wl ON i.location_id = wl.location_id
        WHERE i.warehouse_id = ? 
          AND i.expiry_date IS NOT NULL
          AND i.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ORDER BY days_to_expiry ASC
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $warehouse_id, $days_filter);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getUserProductivity($conn, $warehouse_id) {
    $sql = "
        SELECT u.full_name, 'Picking' as activity_type, COUNT(DISTINCT oi.order_id) as items, SUM(oip.picked_quantity) as quantity, DATE(oip.picked_at) as activity_date
        FROM outbound_item_picks oip
        JOIN users u ON oip.picked_by_user_id = u.user_id
        JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id
        JOIN outbound_orders oo ON oi.order_id = oo.order_id
        WHERE oo.warehouse_id = ?
        GROUP BY u.full_name, activity_date

        UNION ALL

        SELECT u.full_name, 'Receiving' as activity_type, COUNT(DISTINCT ir.receipt_id) as items, SUM(ii.received_quantity) as quantity, DATE(ir.actual_arrival_date) as activity_date
        FROM inbound_items ii
        JOIN inbound_receipts ir ON ii.receipt_id = ir.receipt_id
        JOIN users u ON ir.received_by = u.user_id
        WHERE ir.warehouse_id = ? AND ir.status = 'Completed'
        GROUP BY u.full_name, activity_date

        UNION ALL

        SELECT u.full_name, 'Adjustments' as activity_type, COUNT(sa.adjustment_id) as items, SUM(ABS(sa.quantity_adjusted)) as quantity, DATE(sa.adjustment_timestamp) as activity_date
        FROM stock_adjustments sa
        JOIN users u ON sa.user_id = u.user_id
        WHERE sa.warehouse_id = ?
        GROUP BY u.full_name, activity_date
    ";

    $params = [$warehouse_id, $warehouse_id, $warehouse_id];
    $types = "iii";

    // This is a complex query to filter by date, so we wrap it
    $outer_sql = "SELECT * FROM ($sql) AS productivity WHERE 1=1";
    $outer_sql = addDateFilter($outer_sql, $params, $types, 'activity_date');
    $outer_sql .= " ORDER BY activity_date DESC, full_name ASC";
    
    $stmt = $conn->prepare($outer_sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}


// --- EXISTING REPORT FUNCTIONS (Unchanged) ---

function getInventorySummary($conn, $warehouse_id) {
    $sql = "SELECT p.sku, p.product_name, p.article_no, SUM(i.quantity) AS total_quantity, GROUP_CONCAT(DISTINCT wl.location_code SEPARATOR ', ') AS locations_list FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN warehouse_locations wl ON i.location_id = wl.location_id WHERE i.warehouse_id = ? AND i.quantity > 0 GROUP BY p.product_id, p.article_no ORDER BY p.product_name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getStockByLocation($conn, $warehouse_id) {
    $sql = "SELECT wl.location_code, lt.type_name as location_type, p.sku, p.product_name, p.article_no, i.quantity, i.batch_number, i.expiry_date FROM inventory i JOIN warehouse_locations wl ON i.location_id = wl.location_id JOIN products p ON i.product_id = p.product_id LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id WHERE i.warehouse_id = ? AND i.quantity > 0 ORDER BY wl.location_code ASC, p.product_name ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getInboundHistory($conn, $warehouse_id) {
    $sql = "SELECT ir.receipt_number, s.supplier_name, ir.actual_arrival_date, ir.status AS receipt_status, p.sku, p.product_name, p.article_no, ii.expected_quantity, ii.received_quantity, ii.putaway_quantity, wl.location_code AS final_location, u.full_name AS received_by_user FROM inbound_receipts ir JOIN inbound_items ii ON ir.receipt_id = ii.receipt_id JOIN products p ON ii.product_id = p.product_id JOIN suppliers s ON ir.supplier_id = s.supplier_id LEFT JOIN warehouse_locations wl ON ii.final_location_id = wl.location_id LEFT JOIN users u ON ir.received_by = u.user_id WHERE ir.warehouse_id = ?";
    $params = [$warehouse_id];
    $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'ir.actual_arrival_date');
    $sql .= " ORDER BY ir.actual_arrival_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getOutboundHistory($conn, $warehouse_id) {
    $sql = "SELECT oo.order_number, c.customer_name, oo.order_date, oo.actual_ship_date, oo.status AS order_status, p.sku, p.product_name, p.article_no, oi.ordered_quantity, oi.picked_quantity, oi.shipped_quantity, (SELECT wl.location_code FROM warehouse_locations wl JOIN outbound_item_picks oip ON wl.location_id = oip.location_id WHERE oip.outbound_item_id = oi.outbound_item_id LIMIT 1) as picked_from_location, u.full_name AS picked_by_user FROM outbound_orders oo JOIN outbound_items oi ON oo.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id JOIN customers c ON oo.customer_id = c.customer_id LEFT JOIN users u ON oo.picked_by = u.user_id WHERE oo.warehouse_id = ?";
    $params = [$warehouse_id];
    $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'oo.order_date');
    $sql .= " ORDER BY oo.order_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getProductMovement($conn, $warehouse_id) {
    $sku_or_article_no = sanitize_input($_GET['filter'] ?? null);
    if (empty($sku_or_article_no)) { sendJsonResponse(['success' => false, 'message' => 'SKU or Article No is required for this report.'], 400); return; }
    $product_id_stmt = $conn->prepare("SELECT product_id FROM products WHERE sku = ? OR article_no = ?");
    $product_id_stmt->bind_param("ss", $sku_or_article_no, $sku_or_article_no);
    $product_id_stmt->execute();
    $product_result = $product_id_stmt->get_result()->fetch_assoc();
    $product_id_stmt->close();
    if (!$product_result) { sendJsonResponse(['success' => false, 'message' => 'Product not found.'], 404); return; }
    $product_id = $product_result['product_id'];
    $params = []; $types = "";
    $inbound_sql = "SELECT 'INBOUND' as movement_type, ir.receipt_number as reference, ir.updated_at as transaction_date, p.product_name, p.article_no, ii.received_quantity as quantity_change, '' as from_location, wl.location_code as to_location, ir.status, u.full_name as performed_by FROM inbound_items ii JOIN inbound_receipts ir ON ii.receipt_id = ir.receipt_id JOIN products p ON ii.product_id = p.product_id LEFT JOIN warehouse_locations wl ON ii.final_location_id = wl.location_id LEFT JOIN users u ON ir.received_by = u.user_id WHERE ii.product_id = ? AND ir.warehouse_id = ?";
    $params = array_merge($params, [$product_id, $warehouse_id]); $types .= "ii";
    $inbound_sql = addDateFilter($inbound_sql, $params, $types, 'ir.updated_at');
    $outbound_sql = "SELECT 'OUTBOUND' as movement_type, oo.order_number as reference, oip.picked_at as transaction_date, p.product_name, p.article_no, oip.picked_quantity * -1 as quantity_change, wl.location_code as from_location, '' as to_location, oo.status, u.full_name as performed_by FROM outbound_item_picks oip JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id JOIN outbound_orders oo ON oi.order_id = oo.order_id JOIN products p ON oi.product_id = p.product_id JOIN warehouse_locations wl ON oip.location_id = wl.location_id LEFT JOIN users u ON oip.picked_by_user_id = u.user_id WHERE oi.product_id = ? AND oo.warehouse_id = ?";
    $params = array_merge($params, [$product_id, $warehouse_id]); $types .= "ii";
    $outbound_sql = addDateFilter($outbound_sql, $params, $types, 'oip.picked_at');
    $adjustment_sql = "SELECT 'ADJUSTMENT' as movement_type, sa.reason_code as reference, sa.adjustment_timestamp as transaction_date, p.product_name, p.article_no, sa.quantity_adjusted as quantity_change, CASE WHEN sa.quantity_adjusted < 0 THEN wl.location_code ELSE '' END as from_location, CASE WHEN sa.quantity_adjusted >= 0 THEN wl.location_code ELSE '' END as to_location, sa.reason_code as status, u.full_name as performed_by FROM stock_adjustments sa JOIN products p ON sa.product_id = p.product_id JOIN users u ON sa.user_id = u.user_id JOIN warehouse_locations wl ON sa.location_id = wl.location_id WHERE sa.product_id = ? AND sa.warehouse_id = ?";
    $params = array_merge($params, [$product_id, $warehouse_id]); $types .= "ii";
    $adjustment_sql = addDateFilter($adjustment_sql, $params, $types, 'sa.adjustment_timestamp');
    $full_sql = "($inbound_sql) UNION ALL ($outbound_sql) UNION ALL ($adjustment_sql) ORDER BY transaction_date DESC";
    $stmt = $conn->prepare($full_sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getCustomerTransactionHistory($conn) {
    $customer_id = filter_input(INPUT_GET, 'filter', FILTER_VALIDATE_INT);
    if (!$customer_id) { sendJsonResponse(['success' => false, 'message' => 'A valid numeric Customer ID is required.'], 400); return; }
    $sql = "SELECT c.customer_name, ct.transaction_date, ct.transaction_type, ct.amount, oo.order_number, ct.notes, u.full_name as created_by_user FROM customer_transactions ct JOIN customers c ON ct.customer_id = c.customer_id LEFT JOIN outbound_orders oo ON ct.order_id = oo.order_id LEFT JOIN users u ON ct.created_by = u.user_id WHERE ct.customer_id = ? ORDER BY ct.transaction_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $customer_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getOrderMovementHistory($conn, $warehouse_id) {
    $order_number = sanitize_input($_GET['filter'] ?? null);
    if (empty($order_number)) { sendJsonResponse(['success' => false, 'message' => 'Order Number is required.'], 400); return; }
    $sql = "SELECT oo.order_number, c.customer_name, h.status, h.notes, h.created_at, u.full_name as user_name FROM order_history h JOIN outbound_orders oo ON h.order_id = oo.order_id JOIN customers c ON oo.customer_id = c.customer_id LEFT JOIN users u ON h.updated_by_user_id = u.user_id WHERE oo.warehouse_id = ? AND oo.order_number = ? ORDER BY h.created_at ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("is", $warehouse_id, $order_number);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getPickerPerformance($conn, $warehouse_id) {
    $sql = "SELECT u.full_name AS picker_name, COUNT(DISTINCT oip.outbound_item_id) AS total_lines, COUNT(DISTINCT oo.order_id) AS total_orders, SUM(oip.picked_quantity) AS total_quantity, GREATEST(1, TIMESTAMPDIFF(HOUR, MIN(oip.picked_at), MAX(oip.picked_at))) AS hours_worked, ROUND(SUM(oip.picked_quantity) / GREATEST(1, TIMESTAMPDIFF(MINUTE, MIN(oip.picked_at), MAX(oip.picked_at)) / 60), 2) AS picks_per_hour FROM outbound_item_picks oip JOIN users u ON oip.picked_by_user_id = u.user_id JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id JOIN outbound_orders oo ON oi.order_id = oo.order_id WHERE oo.warehouse_id = ? ";
    $params = [$warehouse_id]; $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'oip.picked_at');
    $sql .= " GROUP BY u.user_id, u.full_name ORDER BY total_quantity DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getOrderFulfillmentLeadTime($conn, $warehouse_id) {
    $sql = "SELECT oo.order_number, c.customer_name, oo.order_date, (SELECT MIN(picked_at) FROM outbound_item_picks oip JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = oo.order_id) AS first_pick_time, oo.actual_ship_date, oo.out_for_delivery_date, oo.actual_delivery_date, ROUND(TIMESTAMPDIFF(MINUTE, oo.order_date, (SELECT MIN(picked_at) FROM outbound_item_picks oip JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = oo.order_id)) / 60, 2) AS time_to_pick_hours, ROUND(TIMESTAMPDIFF(HOUR, (SELECT MAX(picked_at) FROM outbound_item_picks oip JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = oo.order_id), oo.actual_ship_date), 2) AS time_to_ship_hours, DATEDIFF(oo.actual_delivery_date, oo.actual_ship_date) AS transit_days FROM outbound_orders oo JOIN customers c ON oo.customer_id = c.customer_id WHERE oo.warehouse_id = ?";
    $params = [$warehouse_id]; $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'oo.order_date');
    $sql .= " ORDER BY oo.order_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getSupplierPerformance($conn, $warehouse_id) {
    $sql = "SELECT s.supplier_name, ir.receipt_number, ir.expected_arrival_date, ir.actual_arrival_date, DATEDIFF(ir.actual_arrival_date, ir.expected_arrival_date) as days_early_late, SUM(ii.expected_quantity) as total_expected_quantity, SUM(ii.received_quantity) as total_received_quantity, ROUND((SUM(ii.received_quantity) / SUM(ii.expected_quantity)) * 100, 2) as fill_rate_percent FROM inbound_receipts ir JOIN suppliers s ON ir.supplier_id = s.supplier_id JOIN inbound_items ii ON ir.receipt_id = ii.receipt_id WHERE ir.warehouse_id = ? AND ir.status = 'Completed' ";
    $params = [$warehouse_id]; $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'ir.actual_arrival_date');
    $sql .= " GROUP BY ir.receipt_id ORDER BY s.supplier_name, ir.actual_arrival_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getOrderLifecycleAnalysis($conn, $warehouse_id) {
    $sql = "SELECT oo.order_number, c.customer_name, oo.order_date, (SELECT MIN(picked_at) FROM outbound_item_picks oip JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = oo.order_id) AS first_pick_time, oo.actual_ship_date, oo.out_for_delivery_date, oo.actual_delivery_date, ROUND(TIMESTAMPDIFF(MINUTE, oo.order_date, (SELECT MIN(picked_at) FROM outbound_item_picks oip JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = oo.order_id)) / 60, 2) AS time_to_pick_hours, ROUND(TIMESTAMPDIFF(HOUR, (SELECT MAX(picked_at) FROM outbound_item_picks oip JOIN outbound_items oi ON oip.outbound_item_id = oi.outbound_item_id WHERE oi.order_id = oo.order_id), oo.actual_ship_date), 2) AS time_to_ship_hours, DATEDIFF(oo.actual_delivery_date, oo.actual_ship_date) AS transit_days FROM outbound_orders oo JOIN customers c ON oo.customer_id = c.customer_id WHERE oo.warehouse_id = ?";
    $params = [$warehouse_id]; $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'oo.order_date');
    $sql .= " ORDER BY oo.order_date DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getFillRateReport($conn, $warehouse_id) {
    $sql = "SELECT oo.order_number, c.customer_name, p.sku, p.product_name, p.article_no, oi.ordered_quantity, oi.shipped_quantity, ROUND((oi.shipped_quantity / oi.ordered_quantity) * 100, 2) AS line_item_fill_rate_percent FROM outbound_items oi JOIN outbound_orders oo ON oi.order_id = oo.order_id JOIN products p ON oi.product_id = p.product_id JOIN customers c ON oo.customer_id = c.customer_id WHERE oo.warehouse_id = ? AND oo.status IN ('Shipped', 'Delivered', 'Completed', 'Partially Returned')";
    $params = [$warehouse_id]; $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'oo.order_date');
    $sql .= " ORDER BY oo.order_date DESC, line_item_fill_rate_percent ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getInventoryAging($conn, $warehouse_id) {
    $sql = "SELECT p.sku, p.product_name, p.article_no, i.batch_number, i.quantity, DATE(i.created_at) AS receipt_date, DATEDIFF(NOW(), i.created_at) AS age_days, CASE WHEN DATEDIFF(NOW(), i.created_at) <= 30 THEN '0-30 Days' WHEN DATEDIFF(NOW(), i.created_at) <= 60 THEN '31-60 Days' WHEN DATEDIFF(NOW(), i.created_at) <= 90 THEN '61-90 Days' ELSE '90+ Days' END AS aging_bracket FROM inventory i JOIN products p ON i.product_id = p.product_id WHERE i.warehouse_id = ? AND i.quantity > 0 ORDER BY age_days DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getInventoryValuation($conn, $warehouse_id) {
    $sql = "SELECT w.warehouse_name, p.sku, p.product_name, p.article_no, SUM(i.quantity) AS total_on_hand_quantity, i.unit_cost, SUM(i.quantity * i.unit_cost) AS total_value FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN warehouses w ON i.warehouse_id = w.warehouse_id WHERE i.warehouse_id = ? AND i.quantity > 0 AND i.unit_cost IS NOT NULL GROUP BY i.product_id, i.unit_cost, p.article_no ORDER BY total_value DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getDeadStockReport($conn, $warehouse_id) {
    $sql = "SELECT p.sku, p.product_name, p.article_no, i.quantity, wl.location_code, i.batch_number, DATEDIFF(NOW(), i.last_moved_at) AS days_since_last_movement, i.last_moved_at FROM inventory i JOIN products p ON i.product_id = p.product_id JOIN warehouse_locations wl ON i.location_id = wl.location_id WHERE i.warehouse_id = ?";
    $params = [$warehouse_id]; $types = "i";
    $days_filter = filter_input(INPUT_GET, 'days', FILTER_VALIDATE_INT) ?: 90;
    $sql .= " AND i.last_moved_at < DATE_SUB(NOW(), INTERVAL ? DAY)";
    $params[] = $days_filter; $types .= "i";
    $sql .= " ORDER BY days_since_last_movement DESC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getLocationCapacity($conn, $warehouse_id) {
    $sql = "SELECT wl.location_code, lt.type_name AS location_type, wl.max_capacity_units, COALESCE(SUM(i.quantity), 0) AS current_units, CASE WHEN wl.max_capacity_units > 0 THEN ROUND((COALESCE(SUM(i.quantity), 0) / wl.max_capacity_units) * 100, 2) ELSE 0 END AS utilization_percent FROM warehouse_locations wl LEFT JOIN inventory i ON wl.location_id = i.location_id AND i.quantity > 0 LEFT JOIN location_types lt ON wl.location_type_id = lt.type_id WHERE wl.warehouse_id = ? AND wl.is_active = 1 GROUP BY wl.location_id ORDER BY utilization_percent DESC, wl.location_code ASC";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $warehouse_id);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function getStockAdjustmentHistory($conn, $warehouse_id) {
    $sql = "SELECT sa.adjustment_timestamp, p.sku, p.product_name, p.article_no, wl.location_code, u.full_name, sa.quantity_adjusted, sa.reason_code, sa.notes FROM stock_adjustments sa JOIN products p ON sa.product_id = p.product_id JOIN users u ON sa.user_id = u.user_id JOIN warehouse_locations wl ON sa.location_id = wl.location_id WHERE sa.warehouse_id = ? ";
    $params = [$warehouse_id]; $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'sa.adjustment_timestamp');
    $sql .= " ORDER BY sa.adjustment_timestamp DESC";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        if (strpos($conn->error, "Table 'stock_adjustments' doesn't exist") !== false) { sendJsonResponse(['success' => false, 'message' => 'The `stock_adjustments` table does not exist. Please run the provided SQL script to create it.'], 400); return; }
        sendJsonResponse(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error], 500); return;
    }
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

// MODIFICATION: New function for Scrap History Report
function getScrapHistory($conn, $warehouse_id) {
    $sql = "
        SELECT 
            oo.order_number AS `Order Number`,
            oo.reference_number AS `Reference/Reason`,
            DATE(oo.updated_at) AS `Scrapped Date`,
            u.full_name AS `Scrapped By`,
            p.sku AS `SKU`,
            p.product_name AS `Product Name`,
            p.article_no AS `Article No`,
            oi.ordered_quantity AS `Quantity Scrapped`
        FROM outbound_orders oo
        JOIN outbound_items oi ON oo.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.product_id
        LEFT JOIN users u ON oo.picked_by = u.user_id
        WHERE oo.warehouse_id = ? 
          AND oo.order_type = 'Scrap' 
          AND oo.status = 'Scrapped'
    ";
    $params = [$warehouse_id];
    $types = "i";
    $sql = addDateFilter($sql, $params, $types, 'oo.updated_at');
    $sql .= " ORDER BY oo.updated_at DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $data = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    sendJsonResponse(['success' => true, 'data' => $data]);
}
?>
