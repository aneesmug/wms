<?php
// public/third_party_pickup.php
// This is a new, public-facing page for third-party drivers to scan items.
// It does not require a login but relies on the order number for access.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Third-Party Order Pickup</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        body {
            background-color: #f8f9fa;
        }
        .public-page-container {
            max-width: 800px;
        }
        .logo {
            max-width: 220px;
        }
        #scanner-video {
            width: 100%;
            max-width: 500px;
            border: 1px solid #dee2e6;
            border-radius: .375rem;
        }
        #scanHistoryTableBody {
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container my-5">
        <div class="public-page-container mx-auto">
            <div class="text-center mb-4">
                <img src="img/logo.png" alt="Company Logo" class="logo">
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <!-- Step 1: Enter Order Number -->
                    <div id="step1">
                        <h2 class="card-title text-center">Third-Party Pickup Verification</h2>
                        <p class="card-text text-center text-muted mb-4">Enter your order number to find assigned drivers.</p>
                        <div class="mb-3">
                            <label for="orderNumberInput" class="form-label">Order Number or Tracking Number</label>
                            <div class="input-group">
                                <input type="text" id="orderNumberInput" class="form-control form-control-lg" placeholder="e.g., ORD-...">
                                <button id="findOrderBtn" class="btn btn-primary">Find</button>
                            </div>
                        </div>
                        <div id="driverSelectionArea" class="mb-3 d-none">
                            <label for="driverSelect" class="form-label">Select Your Name</label>
                            <select id="driverSelect" class="form-select form-select-lg"></select>
                        </div>
                        <div class="d-grid">
                            <button id="loadOrderBtn" class="btn btn-success btn-lg d-none">Load Order for Scanning</button>
                        </div>
                    </div>

                    <!-- Step 2: Scan Items -->
                    <div id="step2" class="d-none">
                         <div class="row g-4">
                            <div class="col-lg-7">
                                <div class="card h-100 border-0">
                                    <div class="card-header bg-light d-flex justify-content-between">
                                        <h5 class="card-title mb-0">Order <span id="orderNumberDisplay" class="text-primary"></span></h5>
                                        <span class="text-muted">Driver: <strong id="driverNameDisplay"></strong></span>
                                    </div>
                                    <div class="card-body">
                                        <p>Please scan one sticker from each item to verify pickup.</p>
                                        <ul id="itemList" class="list-group">
                                            <!-- Item list will be populated by JS -->
                                        </ul>
                                    </div>
                                </div>
                                <div class="card mt-4 border-0">
                                    <div class="card-header bg-light">
                                        <h5 class="card-title mb-0"><i class="bi bi-clock-history me-2"></i>Scan History</h5>
                                    </div>
                                    <div class="card-body p-0">
                                        <div class="table-responsive" style="max-height: 300px;">
                                            <table class="table table-striped table-sm mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Time</th>
                                                        <th>Product</th>
                                                        <th>Sticker Code</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="scanHistoryTableBody"></tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-lg-5">
                                <div class="card h-100 border-0">
                                    <div class="card-header bg-light">
                                        <h5 class="card-title mb-0">Scanner</h5>
                                    </div>
                                    <div class="card-body text-center">
                                        <div id="scanner-container">
                                            <video id="scanner-video"></video>
                                        </div>
                                        <div class="mt-3 d-flex justify-content-between">
                                            <div class="flex-grow-1 me-2">
                                                <label for="sourceSelect" class="form-label">Select Camera:</label>
                                                <select id="sourceSelect" class="form-select"></select>
                                            </div>
                                            <div>
                                                <label class="form-label">&nbsp;</label>
                                                <button id="torchButton" class="btn btn-outline-secondary w-100" style="display: none;"><i class="bi bi-flashlight"></i></button>
                                            </div>
                                        </div>
                                        <input type="text" id="barcodeInput" class="form-control mt-3" placeholder="Or enter barcode manually">
                                        <div id="scanFeedback" class="mt-2"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script type="text/javascript" src="https://unpkg.com/@zxing/library@latest/umd/index.min.js"></script>
    <script src="js/third_party_pickup.js"></script>
</body>
</html>
