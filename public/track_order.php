<?php
// No authentication required for this public page.
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Track Your Shipment - Continental</title>
    <!-- External CSS libraries -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <!-- Custom Stylesheet -->
    <link rel="stylesheet" href="css/style.css">
    <!-- Favicon -->
    <link rel="icon" href="favicon.ico" type="image/x-icon">
</head>

<body>
    <div class="container my-5">
        <div class="tracking-container-redesigned mx-auto">
            <div class="text-center mb-4">
                <img src="img/logo.png" alt="Company Logo" class="logo">
            </div>
            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <h2 class="card-title text-center">Track Your Shipment</h2>
                    <p class="card-text text-center text-muted mb-4">Enter your tracking number below to see your order's journey.</p>

                    <!-- Tracking form -->
                    <form id="trackingForm" class="mb-4">
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-truck"></i></span>
                            <input type="text" id="trackingNumber" class="form-control form-control-lg" placeholder="e.g., TRK-12345" required>
                            <button class="btn btn-primary" type="submit" id="trackBtn">
                                <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                                Track
                            </button>
                        </div>
                    </form>

                    <!-- Container for tracking results -->
                    <div id="trackingResult" class="mt-4 d-none">
                        <div class="card bg-light border-0 mb-4">
                            <div class="card-body">
                                <div class="row align-items-center">
                                    <div class="col-md-6">
                                        <h5 class="mb-1">Order Status</h5>
                                        <p id="orderStatus" class="h4 fw-bold text-primary mb-0"></p>
                                    </div>
                                    <div class="col-md-6 text-md-end mt-3 mt-md-0">
                                        <h6 class="mb-1 text-muted">Required Ship Date</h6>
                                        <p id="expectedDelivery" class="fw-bold mb-0"></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h5 class="mt-4 mb-3">Shipment History</h5>
                        <div id="trackingTimeline" class="timeline">
                            <!-- Timeline items will be injected here by JavaScript -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- External JavaScript libraries -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <!-- Unified Notification System -->
    <script src="js/notifications.js"></script>
    <!-- Page-specific JavaScript -->
    <script src="js/track_order.js"></script>
</body>

</html>
