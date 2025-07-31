<?php
// This page is designed to be opened in a new tab for printing.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Print Transfer Note</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <style>
        body { background-color: #fff; color: #000; }
        .container { max-width: 800px; }
        .header-logo { max-width: 160px; }
        .table th, .table td { vertical-align: middle; font-size: 0.8rem; padding: 0.4rem; }
        .footer { position: fixed; bottom: 20px; width: 100%; max-width: 800px; font-size: 0.8rem; }
        
        /* CORRECTED: Significantly reduced barcode font sizes for a professional look */
        .header-barcode { 
            font-family: 'Libre Barcode 39', cursive; 
            font-size: 32pt; /* Using points for better print control */
            line-height: 1; 
        }
        .item-barcode { 
            font-family: 'Libre Barcode 39', cursive; 
            font-size: 24pt; /* Using points for better print control */
            line-height: 1; 
        }

        @media print {
            .no-print { display: none; }
            body {
                -webkit-print-color-adjust: exact; /* Chrome, Safari, Edge */
                -moz-print-color-adjust: exact;    /* Firefox */
                print-color-adjust: exact;         /* Standard */
            }
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
            <button class="btn btn-primary" onclick="window.print();"><i class="bi bi-printer"></i> Print</button>
            <button class="btn btn-secondary" onclick="window.close();">Close</button>
        </div>
    </div>

    <script>
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
                    if (data.status === 'success') {
                        renderPrintView(data);
                    } else {
                        printContent.innerHTML = `<div class="alert alert-danger">Error: ${data.message}</div>`;
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
                    <img src="img/logo.png" alt="Continental Logo" class="header-logo">
                    <h2 class="mb-0">Transfer Order</h2>
                </header>

                <div class="row mb-4">
                    <div class="col-6">
                        <strong>Consignee:</strong><br>
                        ${header.dest_warehouse}<br>
                        ${header.dest_address || ''}<br>
                        ${header.dest_city || ''}
                    </div>
                    <div class="col-6 text-end">
                        <strong>Order Number:</strong> ${header.transfer_order_number}<br>
                        <strong>Date:</strong> ${createdDate}<br>
                        <strong>References:</strong> N/A<br>
                    </div>
                </div>

                <table class="table table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th>#</th>
                            <th>Article Description</th>
                            <th>Article No</th>
                            <th>Barcode</th>
                            <th>Qty</th>
                            <th>From Loc</th>
                            <th>To Loc</th>
                            <th>Batch</th>
                            <th>DOT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.product_name}</td>
                                <td>${item.sku}</td>
                                <td>${item.barcode || ''}</td>
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
                        <span><strong>Picker:</strong> _________________________</span>
                        <span>Page 1 of 1</span>
                        <span><strong>Receiver:</strong> _________________________</span>
                    </div>
                </footer>
            `;
            document.getElementById('print-content').innerHTML = html;
        }
    </script>
</body>
</html>
