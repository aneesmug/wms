<?php
// public/delivery_confirmation.php
// A public-facing page for any driver (in-house or third-party)
// to confirm final delivery using a tracking number and confirmation code.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Delivery</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        body {
            background-color: #f8f9fa;
        }
        .public-page-container {
            max-width: 600px;
        }
        .logo {
            max-width: 220px;
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
                    <h2 class="card-title text-center">Proof of Delivery</h2>
                    <p class="card-text text-center text-muted mb-4">Enter the order details and upload a photo to confirm delivery.</p>
                    
                    <form id="deliveryConfirmationForm" enctype="multipart/form-data">
                        <div class="mb-3">
                            <label for="trackingNumberInput" class="form-label">Tracking Number or Order Number</label>
                            <input type="text" id="trackingNumberInput" class="form-control form-control-lg" required>
                        </div>
                        <div class="mb-3">
                            <label for="confirmationCodeInput" class="form-label">Delivery Confirmation Code (Optional)</label>
                            <input type="text" id="confirmationCodeInput" class="form-control form-control-lg" placeholder="Enter 6-digit code if provided">
                        </div>
                        <hr>
                        <div class="mb-3">
                            <label for="receiverNameInput" class="form-label">Receiver's Full Name</label>
                            <input type="text" id="receiverNameInput" class="form-control" required>
                        </div>
                         <div class="mb-3">
                            <label for="receiverPhoneInput" class="form-label">Receiver's Phone (Optional)</label>
                            <input type="tel" id="receiverPhoneInput" class="form-control">
                        </div>
                        <div class="mb-3">
                            <label for="deliveryPhotoInput" class="form-label">Proof of Delivery Photo</label>
                            <input type="file" id="deliveryPhotoInput" class="form-control" accept="image/*" required>
                            <div class="form-text">A clear photo of the delivered items at the location is required.</div>
                        </div>
                        <div class="d-grid mt-4">
                            <button type="submit" id="submitDeliveryBtn" class="btn btn-success btn-lg">Confirm Delivery</button>
                        </div>
                    </form>
                    <div class="text-center mt-3">
                        <button type="button" id="reportFailureBtn" class="btn btn-link text-danger">Report Failed Delivery Attempt</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="js/delivery_confirmation.js"></script>
</body>
</html>
