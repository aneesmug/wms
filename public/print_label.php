<?php
// 002-print_label.php
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Print Inventory Labels</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
        
        @page {
            size: 15cm 10cm;
            margin: 0;
        }

        body {
            font-family: 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
        }
        
        .label-container {
            width: 15cm;
            height: 10cm;
            padding: 0.25in;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            page-break-after: always;
            overflow: hidden;
        }

        .label-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            grid-template-rows: auto auto auto auto auto auto 1fr; /* Main layout structure */
            gap: 3px 15px;
            width: 100%;
            height: 100%;
            font-size: 12pt;
        }

        .product-name {
            grid-column: 1 / -1;
            font-size: 16pt;
            font-weight: bold;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
            margin-bottom: 5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .label {
            font-weight: bold;
            text-align: right;
        }

        .value {
            text-align: left;
        }
        
        .sticker-count {
            grid-column: 1 / -1;
            text-align: center;
            font-weight: bold;
            font-size: 10pt;
            padding-top: 5px;
        }

        .barcode-container {
            grid-column: 1 / -1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding-top: 5px;
        }

        .barcode-svg {
            width: 100%;
            height: 60px;
        }

        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>

    <div id="loading" class="no-print" style="padding: 1in; font-size: 18pt;">Generating labels...</div>
    <div id="error" class="no-print" style="color: red; display: none; padding: 1in; font-size: 18pt;"></div>

    <!-- This is a template that will be cloned for each label -->
    <div id="labelTemplate" style="display: none;">
        <div class="label-container">
            <div class="label-grid">
                <div class="product-name"></div>
                
                <div class="label">SKU:</div>
                <div class="sku value"></div>
                
                <div class="label">Batch:</div>
                <div class="batchNumber value"></div>

                <div class="label">Manu. DOT:</div>
                <div class="dotCode value"></div>

                <div class="label">Expiry DOT:</div>
                <div class="expiryDot value"></div>
                
                <div class="label">Location:</div>
                <div class="location value"></div>

                <div class="label">Unique ID:</div>
                <div class="uniqueId value"></div>

                <div class="barcode-container">
                    <svg class="barcode-svg"></svg>
                </div>
                
                <div class="sticker-count"></div>
            </div>
        </div>
    </div>


    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <script src="js/api.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', async function() {
            const urlParams = new URLSearchParams(window.location.search);
            const inventoryId = urlParams.get('inventory_id');
            const loadingEl = document.getElementById('loading');
            const errorEl = document.getElementById('error');
            const template = document.getElementById('labelTemplate');

            if (!inventoryId) {
                loadingEl.style.display = 'none';
                errorEl.textContent = 'Error: No Inventory ID provided.';
                errorEl.style.display = 'block';
                return;
            }

            try {
                const [labelDataResponse, stickerDataResponse] = await Promise.all([
                    fetchData(`api/inbound_api.php?action=getInventoryLabelData&inventory_id=${inventoryId}`),
                    fetchData(`api/inbound_api.php?action=getStickersForInventory&inventory_id=${inventoryId}`)
                ]);

                if (labelDataResponse.success && stickerDataResponse.success) {
                    const data = labelDataResponse.data;
                    const stickers = stickerDataResponse.data;
                    const totalStickers = stickers.length;

                    if (totalStickers === 0) {
                        throw new Error("No sticker barcodes found for this inventory item.");
                    }

                    const manu_dot_raw = data.dot_code || "0000";
                    const manu_dot_display = `${manu_dot_raw.substring(0, 2)}/${manu_dot_raw.substring(2, 4)}`;
                    
                    const manu_year = parseInt(manu_dot_raw.substring(2, 4), 10);
                    const expiry_years = parseInt(data.expiry_years, 10) || 0;
                    const expiry_year = manu_year + expiry_years;
                    const expiry_dot_display = `${manu_dot_raw.substring(0, 2)}/${String(expiry_year).padStart(2, '0')}`;
                    
                    const mainBarcodeValue = data.product_article_no;

                    stickers.forEach((sticker, index) => {
                        const clone = template.firstElementChild.cloneNode(true);
                        
                        const uniqueIdText = sticker.unique_barcode;
                        const stickerCountText = `${index + 1} / ${totalStickers}`;

                        clone.querySelector('.product-name').textContent = data.product_name;
                        clone.querySelector('.sku').textContent = data.sku;
                        clone.querySelector('.batchNumber').textContent = data.batch_number;
                        clone.querySelector('.dotCode').textContent = manu_dot_display;
                        clone.querySelector('.expiryDot').textContent = expiry_dot_display;
                        clone.querySelector('.location').textContent = data.location_code;
                        clone.querySelector('.uniqueId').textContent = uniqueIdText;
                        clone.querySelector('.sticker-count').textContent = stickerCountText;

                        document.body.appendChild(clone);

                        if (mainBarcodeValue) {
                            JsBarcode(clone.querySelector('.barcode-svg'), mainBarcodeValue, {
                                format: "CODE128",
                                lineColor: "#000",
                                width: 3,
                                height: 60,
                                displayValue: true,
                                fontSize: 18
                            });
                        }
                    });

                    loadingEl.style.display = 'none';
                    
                    // MODIFIED: Use a short timeout to allow the browser to render the new labels before showing the print dialog.
                    // This can make the UI feel more responsive, especially with many labels.
                    setTimeout(() => {
                        const printFrame = window.parent.document.getElementById('print-frame');
                        if (printFrame) {
                            printFrame.contentWindow.print();
                            // Give the user more time to interact with the print dialog before removing the iframe.
                            setTimeout(() => {
                                const finalFrame = window.parent.document.getElementById('print-frame');
                                if (finalFrame) {
                                    finalFrame.remove();
                                }
                            }, 3000); // Increased to 3 seconds
                        }
                    }, 100); // 100ms delay should be sufficient for rendering.
                    
                } else {
                    loadingEl.style.display = 'none';
                    errorEl.textContent = `Error: ${labelDataResponse.message || stickerDataResponse.message}`;
                    errorEl.style.display = 'block';
                }
            } catch (err) {
                loadingEl.style.display = 'none';
                errorEl.textContent = 'Failed to fetch label data. Error: ' + err.message;
                errorEl.style.display = 'block';
            }
        });
    </script>
</body>
</html>
