// public/js/delivery_confirmation.js

document.addEventListener('DOMContentLoaded', () => {
    const deliveryForm = document.getElementById('deliveryConfirmationForm');
    const submitBtn = document.getElementById('submitDeliveryBtn');
    // MODIFICATION: Add new button element
    const reportFailureBtn = document.getElementById('reportFailureBtn');

    // Pre-fill tracking number if it's in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const trackingNumberFromUrl = urlParams.get('tracking_number');
    if (trackingNumberFromUrl) {
        document.getElementById('trackingNumberInput').value = trackingNumberFromUrl;
    }

    deliveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('tracking_number', document.getElementById('trackingNumberInput').value.trim());
        formData.append('delivery_code', document.getElementById('confirmationCodeInput').value.trim());
        formData.append('receiver_name', document.getElementById('receiverNameInput').value.trim());
        formData.append('receiver_phone', document.getElementById('receiverPhoneInput').value.trim());
        formData.append('delivery_photo', document.getElementById('deliveryPhotoInput').files[0]);

        if (!formData.get('tracking_number') || !formData.get('receiver_name') || !formData.get('delivery_photo')) {
            Swal.fire('Missing Information', 'Please provide the Tracking/Order Number, Receiver\'s Name, and a Proof of Delivery photo.', 'warning');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';

        try {
            const response = await fetch('api/driver_api.php?action=verifyThirdPartyDelivery', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire({
                    title: 'Delivery Confirmed!',
                    text: result.message,
                    icon: 'success',
                    confirmButtonText: 'Done'
                }).then(() => {
                    deliveryForm.reset();
                });
            } else {
                Swal.fire('Submission Failed', result.message, 'error');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            Swal.fire('Error', 'An unexpected error occurred. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Confirm Delivery';
        }
    });

    // MODIFICATION: Add event listener for the failure report button
    if (reportFailureBtn) {
        reportFailureBtn.addEventListener('click', handleReportFailure);
    }

    // MODIFICATION: New function to handle reporting a delivery failure
    async function handleReportFailure() {
        const trackingNumber = document.getElementById('trackingNumberInput').value.trim();
        if (!trackingNumber) {
            Swal.fire('Tracking Number Required', 'Please enter the Tracking or Order Number before reporting a failure.', 'warning');
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: 'Report Delivery Failure',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label for="swal-reason" class="form-label">Reason for Failure</label>
                        <select id="swal-reason" class="form-select">
                            <option value="">-- Select a Reason --</option>
                            <option value="Customer not available">Customer not available</option>
                            <option value="Incorrect address">Incorrect address</option>
                            <option value="Customer refused delivery">Customer refused delivery</option>
                            <option value="Could not access location">Could not access location</option>
                            <option value="Other">Other (specify in notes)</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="swal-notes" class="form-label">Additional Notes</label>
                        <textarea id="swal-notes" class="form-control" placeholder="Provide more details..."></textarea>
                    </div>
                </div>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Submit Report',
            preConfirm: () => {
                const reason = document.getElementById('swal-reason').value;
                if (!reason) {
                    Swal.showValidationMessage('Please select a reason for the failure.');
                    return false;
                }
                return {
                    reason: reason,
                    notes: document.getElementById('swal-notes').value
                };
            }
        });

        if (formValues) {
            Swal.fire({ title: 'Submitting Report...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const response = await fetch('api/driver_api.php?action=reportDeliveryFailure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tracking_number: trackingNumber,
                        reason: formValues.reason,
                        notes: formValues.notes
                    })
                });
                const result = await response.json();

                if (result.success) {
                    Swal.fire('Report Submitted', result.message, 'success');
                } else {
                    Swal.fire('Submission Failed', result.message, 'error');
                }
            } catch (error) {
                Swal.fire('Error', 'An unexpected error occurred.', 'error');
            }
        }
    }
});
