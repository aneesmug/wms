<?php
// print_label_returns.php

require_once __DIR__ . '/config/config.php';

$conn = getDbConnection();
ob_start();

authenticate_user(true, null);
$current_warehouse_id = get_current_warehouse_id();

$inventory_id = filter_input(INPUT_GET, 'inventory_id', FILTER_VALIDATE_INT);

if (!$inventory_id) {
    die("Invalid Inventory ID.");
}

// MODIFICATION: Fetch main inventory details, and join to returns/orders to get identifying numbers
$stmt_inv = $conn->prepare("
    SELECT 
        i.inventory_id, i.quantity, i.dot_code, i.expiry_date, i.batch_number,
        p.product_name, p.sku, p.barcode AS product_barcode, p.expiry_years,
        wl.location_code,
        r.return_number,
        oo.order_number
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouse_locations wl ON i.location_id = wl.location_id
    LEFT JOIN return_putaway_stickers rps ON i.inventory_id = rps.inventory_id
    LEFT JOIN returns r ON rps.return_id = r.return_id
    LEFT JOIN outbound_orders oo ON r.order_id = oo.order_id
    WHERE i.inventory_id = ? AND i.warehouse_id = ?
    GROUP BY i.inventory_id
");
$stmt_inv->bind_param("ii", $inventory_id, $current_warehouse_id);
$stmt_inv->execute();
$inventory_details = $stmt_inv->get_result()->fetch_assoc();
$stmt_inv->close();

if (!$inventory_details) {
    die("Inventory item not found or does not belong to this warehouse.");
}

// Fetch associated sticker barcodes
$stmt_stickers = $conn->prepare("SELECT unique_barcode FROM return_putaway_stickers WHERE inventory_id = ?");
$stmt_stickers->bind_param("i", $inventory_id);
$stmt_stickers->execute();
$stickers = $stmt_stickers->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt_stickers->close();

// Helper function to calculate expiry DOT
function calculateExpiryDot($manu_dot, $expiry_years) {
    if (empty($manu_dot) || strlen($manu_dot) !== 4 || !is_numeric($manu_dot) || $expiry_years === null) {
        return 'N/A';
    }
    $week = substr($manu_dot, 0, 2);
    $year = (int)substr($manu_dot, 2, 2);
    $expiry_year = ($year + (int)$expiry_years) % 100; // Get last two digits of expiry year
    return $week . '/' . str_pad($expiry_year, 2, '0', STR_PAD_LEFT);
}

$manu_dot_formatted = (!empty($inventory_details['dot_code'])) ? substr($inventory_details['dot_code'], 0, 2) . '/' . substr($inventory_details['dot_code'], 2, 2) : 'N/A';
$expiry_dot_formatted = calculateExpiryDot($inventory_details['dot_code'], $inventory_details['expiry_years']);
$sticker_count = count($stickers);
$current_sticker = 0;

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Print Return Putaway Stickers</title>
    <style>
        @media print {
            @page {
                size: 15cm 10cm landscape;
                margin: 0;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                margin: 0; padding: 0;
            }
        }
        body {
            font-family: Arial, sans-serif;
        }
        .sticker {
            width: 150mm;
            height: 100mm;
            border: 2px solid #D32F2F; /* Red border for returns */
            padding: 5mm;
            box-sizing: border-box;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            font-size: 11pt; /* Slightly smaller font to fit new fields */
            position: relative; /* Needed for absolute positioning */
        }
        .sticker:last-child {
            page-break-after: auto;
        }
        /* MODIFICATION: Added a header stamp for returned items */
        .return-header {
            position: absolute;
            top: 14mm;
            right: 5mm;
            font-size: 14pt;
            font-weight: bold;
            color: #D32F2F;
            border: 2px solid #D32F2F;
            padding: 1mm 3mm;
            transform: rotate(-10deg);
            opacity: 0.8;
        }
        .product-name {
            margin-top: 5mm; /* FIX: Added margin to push the content down */
            font-weight: bold;
            font-size: 14pt; /* Adjusted font size */
            text-align: left;
            border-bottom: 2px solid #000;
            padding-bottom: 2mm;
            margin-bottom: 3mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .details-grid {
            display: grid;
            /* MODIFICATION: Adjusted grid to fit more info */
            grid-template-columns: 90px 1fr; 
            gap: 1.5mm 4mm; /* Adjusted gap */
            font-size: 12pt;
        }
        .details-grid > div {
            display: contents;
        }
        .details-grid strong {
            font-weight: bold;
        }
        .barcode-container {
            text-align: center;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-top: 3mm;
        }
        svg.barcode {
            width: 90%;
            height: 22mm;
        }
        .footer {
            text-align: center;
            font-size: 12pt;
            margin-top: auto;
        }
    </style>
</head>
<body>
    <?php foreach ($stickers as $sticker): $current_sticker++; ?>
    <div class="sticker">
        <div class="return-header">RETURNED ITEM</div>

        <div class="details-grid">
            <div><strong>Product:</strong></div>
            <div><?= htmlspecialchars($inventory_details['product_name'] ?? '') ?></div>
            
            <div><strong>SKU:</strong></div>
            <div><?= htmlspecialchars($inventory_details['sku'] ?? '') ?></div>
            
            <div><strong>Batch:</strong></div>
            <div><?= htmlspecialchars($inventory_details['batch_number'] ?? '') ?></div>

            <!-- MODIFICATION: Added RMA and Order numbers -->
            <div><strong>RMA #:</strong></div>
            <div><?= htmlspecialchars($inventory_details['return_number'] ?? 'N/A') ?></div>

            <div><strong>Orig. Order:</strong></div>
            <div><?= htmlspecialchars($inventory_details['order_number'] ?? 'N/A') ?></div>

            <div><strong>Manu. DOT:</strong></div>
            <div><?= htmlspecialchars($manu_dot_formatted) ?></div>

            <div><strong>Expiry DOT:</strong></div>
            <div><?= htmlspecialchars($expiry_dot_formatted) ?></div>

            <div><strong>Location:</strong></div>
            <div><?= htmlspecialchars($inventory_details['location_code'] ?? '') ?></div>

        </div>
        <div class="barcode-container">
            <svg class="barcode"
                jsbarcode-format="CODE128"
                jsbarcode-value="<?= htmlspecialchars($sticker['unique_barcode'] ?? '') ?>"
                jsbarcode-textmargin="0"
                jsbarcode-fontoptions="bold"
                jsbarcode-height="60"
                jsbarcode-fontSize="16">
            </svg>
        </div>
        <div class="footer">
            <?= $current_sticker ?> / <?= $sticker_count ?>
        </div>
    </div>
    <?php endforeach; ?>

    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            JsBarcode(".barcode").init();
            window.print();
            setTimeout(function() { window.close(); }, 100);
        });
    </script>
</body>
</html>
