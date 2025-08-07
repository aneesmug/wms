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
        #scanner-video {
            width: 100%;
            max-width: 500px;
            border: 1px solid #dee2e6;
            border-radius: .375rem;
        }
        /* MODIFICATION: Style for the scan history table */
        #scanHistoryTableBody {
            font-size: 0.9rem;
        }
    </style>
</head>
<body class="bg-light">
    <div id="content">
        <header class="bg-white shadow-sm border-bottom">
            <div class="container-fluid px-4">
                <div class="d-flex align-items-center py-3">
                    <img src="img/logo.png" alt="Company Logo" style="height: 40px;" class="me-3">
                    <h1 class="h4 mb-0 text-dark">Third-Party Pickup Verification</h1>
                </div>
            </div>
        </header>

        <main class="container p-4">
            <!-- Step 1: Enter Order Number -->
            <div id="step1" class="card shadow-sm mx-auto" style="max-width: 500px;">
                <div class="card-body p-4">
                    <h5 class="card-title text-center mb-4">Enter Order Details</h5>
                    <div class="mb-3">
                        <label for="orderNumberInput" class="form-label">Order Number</label>
                        <input type="text" id="orderNumberInput" class="form-control form-control-lg" placeholder="e.g., ORD-20250804-0001">
                    </div>
                    <div class="mb-3">
                        <label for="driverNameInput" class="form-label">Your Name (Driver)</label>
                        <input type="text" id="driverNameInput" class="form-control form-control-lg" placeholder="Enter your full name">
                    </div>
                    <div class="d-grid">
                        <button id="loadOrderBtn" class="btn btn-primary btn-lg">Load Order for Scanning</button>
                    </div>
                </div>
            </div>

            <!-- Step 2: Scan Items -->
            <div id="step2" class="d-none">
                 <div class="row g-4">
                    <div class="col-lg-7">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Order <span id="orderNumberDisplay" class="text-primary"></span></h5>
                            </div>
                            <div class="card-body">
                                <p>Please scan one sticker from each item to verify pickup.</p>
                                <ul id="itemList" class="list-group">
                                    <!-- Item list will be populated by JS -->
                                </ul>
                            </div>
                        </div>
                        <!-- MODIFICATION: New card for scan history -->
                        <div class="card mt-4">
                            <div class="card-header">
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
                                        <tbody id="scanHistoryTableBody">
                                            <!-- History will be populated by JS -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-5">
                        <div class="card h-100">
                            <div class="card-header">
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
        </main>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    
    <script type="text/javascript" src="https://unpkg.com/@zxing/library@latest/umd/index.min.js"></script>

    <script src="js/third_party_pickup.js"></script>
</body>
</html>
