<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/helpers/language_helper.php';
$lang = isset($_GET['lang']) && $_GET['lang'] === 'ar' ? 'ar' : 'en';
load_language($lang);
?>
<!DOCTYPE html>
<html lang="<?php echo $lang; ?>" dir="<?php echo $lang === 'ar' ? 'rtl' : 'ltr'; ?>">
<head>
    <meta charset="UTF-8">
    <title><?php echo __('print_transfer_note'); ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <?php if ($lang === 'ar'): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css">
    <?php endif; ?>
    <style>
        body { background-color: #fff; color: #000; }
        .container { max-width: 800px; }
        .header-logo { max-width: 160px; }
        .table th, .table td { vertical-align: middle; font-size: 0.8rem; padding: 0.4rem; }
        .footer { position: fixed; bottom: 20px; width: 100%; max-width: 800px; font-size: 0.8rem; }
        .header-article_no { font-family: 'Libre Barcode 39', cursive; font-size: 32pt; line-height: 1; }
        .item-article_no { font-family: 'Libre Barcode 39', cursive; font-size: 24pt; line-height: 1; }
        @media print {
            .no-print { display: none; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap');
    </style>
</head>
<body>
    <div class="container mt-4">
        <div id="print-content">
            <div class="text-center p-5">
                <div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>
                <p>Loading transfer details...</p>
            </div>
        </div>
        <div class="text-center mt-4 no-print">
            <button class="btn btn-primary" onclick="window.print();"><i class="bi bi-printer"></i> <?php echo __('print'); ?></button>
            <button class="btn btn-secondary" onclick="window.close();"><?php echo __('close'); ?></button>
        </div>
    </div>

    <script>
        const translations = {
            transferOrder: "<?php echo __('transfer_order'); ?>",
            consignee: "<?php echo __('consignee'); ?>",
            orderNumber: "<?php echo __('order_no'); ?>",
            date: "<?php echo __('date'); ?>",
            references: "<?php echo __('reference_no'); ?>",
            itemNo: "<?php echo __('#'); ?>",
            articleDescription: "<?php echo __('article_description'); ?>",
            sku: "<?php echo __('sku'); ?>",
            articleNo: "<?php echo __('article_no'); ?>",
            qty: "<?php echo __('qty'); ?>",
            fromLoc: "<?php echo __('from_location'); ?>",
            toLoc: "<?php echo __('to_location'); ?>",
            batch: "<?php echo __('batch'); ?>",
            dot: "<?php echo __('dot'); ?>",
            picker: "<?php echo __('picker'); ?>",
            receiver: "<?php echo __('receiver'); ?>"
        };

        document.addEventListener('DOMContentLoaded', function() {
            const urlParams = new URLSearchParams(window.location.search);
            const transferId = urlParams.get('id');
            const printContent = document.getElementById('print-content');

            if (!transferId) {
                printContent.innerHTML = '<div class="alert alert-danger">Error: No Transfer ID provided.</div>';
                return;
            }

            fetch(`api/transfer_orders_api.php?action=get_transfer_details_for_print&id=${transferId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        renderPrintView(data);
                    } else {
                        printContent.innerHTML = `<div class="alert alert-danger">Error: ${data.message || 'An unknown error occurred.'}</div>`;
                    }
                })
                .catch(err => {
                    printContent.innerHTML = `<div class="alert alert-danger">API Error: Could not fetch data.</div>`;
                    console.error(err);
                });
        });

        function renderPrintView(data) {
            const header = data.header;
            const items = data.items;
            const createdDate = new Date(header.created_at).toLocaleDateString('en-CA');

            const html = `
                <header class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
                    <img src="img/logo.png" alt="Continental Logo" class="header-logo" onerror="this.style.display='none'">
                    <h2 class="mb-0">${translations.transferOrder}</h2>
                </header>

                <div class="row mb-4">
                    <div class="col-6">
                        <strong>${translations.consignee}:</strong><br>
                        ${header.dest_warehouse}<br>
                        ${header.dest_address || ''}<br>
                        ${header.dest_city || ''}
                    </div>
                    <div class="col-6 text-end">
                        <strong>${translations.orderNumber}:</strong> ${header.transfer_order_number}<br>
                        <strong>${translations.date}:</strong> ${createdDate}<br>
                        <strong>${translations.references}:</strong> N/A<br>
                    </div>
                </div>

                <table class="table table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th>${translations.itemNo}</th>
                            <th>${translations.articleDescription}</th>
                            <th>${translations.sku}</th>
                            <th>${translations.articleNo}</th>
                            <th>${translations.qty}</th>
                            <th>${translations.fromLoc}</th>
                            <th>${translations.toLoc}</th>
                            <th>${translations.batch}</th>
                            <th>${translations.dot}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.product_name}</td>
                                <td>${item.sku}</td>
                                <td>${item.article_no || ''}</td>
                                <td>${item.quantity}</td>
                                <td>${item.source_location}</td>
                                <td>${item.destination_location}</td>
                                <td>${item.batch_number || 'N/A'}</td>
                                <td>${item.dot_code || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <footer class="footer">
                    <div class="d-flex justify-content-between border-top pt-2">
                        <span><strong>${translations.picker}:</strong> _________________________</span>
                        <span>Page 1 of 1</span>
                        <span><strong>${translations.receiver}:</strong> _________________________</span>
                    </div>
                </footer>
            `;
            document.getElementById('print-content').innerHTML = html;
        }
    </script>
</body>
</html>
