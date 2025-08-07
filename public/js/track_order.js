/**
 * js/track_order.js
 * Handles the public order tracking functionality with a redesigned timeline view.
 */
document.addEventListener('DOMContentLoaded', function() {
    const trackingForm = document.getElementById('trackingForm');

    if (trackingForm) {
        trackingForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const trackBtn = document.getElementById('trackBtn');
            const btnSpinner = trackBtn.querySelector('.spinner-border');
            const trackingNumberInput = document.getElementById('trackingNumber');
            const trackingResultDiv = document.getElementById('trackingResult');
            const trackingTimelineDiv = document.getElementById('trackingTimeline');

            const trackingNumber = trackingNumberInput.value.trim();
            if (!trackingNumber) {
                showError('Invalid Input', 'Please enter a tracking number.');
                return;
            }

            // Show loading state
            trackBtn.disabled = true;
            btnSpinner.classList.remove('d-none');
            trackingResultDiv.classList.add('d-none');
            trackingTimelineDiv.innerHTML = '';

            fetch(`api/public_tracking_api.php?tracking_number=${trackingNumber}`)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success' && data.order) {
                        displayTrackingInfo(data.order);
                        trackingResultDiv.classList.remove('d-none');
                    } else {
                        showError('Not Found', data.message || 'The requested tracking number was not found.');
                        trackingResultDiv.classList.add('d-none');
                    }
                })
                .catch(error => {
                    console.error('Tracking Error:', error);
                    showError('Oops...', 'An error occurred while fetching tracking data.');
                    trackingResultDiv.classList.add('d-none');
                })
                .finally(() => {
                    // Hide loading state
                    trackBtn.disabled = false;
                    btnSpinner.classList.add('d-none');
                });
        });
    }
});

/**
 * Populates the DOM with the tracking information.
 * @param {object} order - The order object received from the API.
 */
function displayTrackingInfo(order) {
    const orderStatusEl = document.getElementById('orderStatus');
    const expectedDeliveryEl = document.getElementById('expectedDelivery');
    const trackingTimelineDiv = document.getElementById('trackingTimeline');

    orderStatusEl.textContent = order.status || 'N/A';
    // MODIFICATION: Changed to display the required_ship_date from the API response
    expectedDeliveryEl.textContent = order.required_ship_date ? new Date(order.required_ship_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not available';

    let timelineHtml = '';
    if (order.history && order.history.length > 0) {
        order.history.forEach((item, index) => {
            timelineHtml += createTimelineItem(item, index === 0);
        });
    } else {
        timelineHtml = '<p>No tracking history available for this order.</p>';
    }
    trackingTimelineDiv.innerHTML = timelineHtml;
}

/**
 * Creates the HTML for a single timeline item.
 * @param {object} item - A single history item.
 * @param {boolean} isLatest - True if this is the most recent history item.
 * @returns {string} The HTML string for the timeline item.
 */
function createTimelineItem(item, isLatest) {
    const d = new Date(item.timestamp);
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const iconClass = getIconForStatus(item.status_update);
    const activeClass = isLatest ? 'active' : '';

    return `
        <div class="timeline-item ${activeClass}">
            <div class="timeline-icon">
                <i class="bi ${iconClass}"></i>
            </div>
            <div class="timeline-content">
                <h6 class="mb-0">${item.status_update}</h6>
                <p class="text-muted mb-0">${item.notes || `${formattedDate} at ${formattedTime}`}</p>
            </div>
        </div>
    `;
}

/**
 * Returns a Bootstrap icon class based on the order status text.
 * @param {string} status - The status text from the order history.
 * @returns {string} A Bootstrap icon class name.
 */
function getIconForStatus(status) {
    const s = status.toLowerCase();
    if (s.includes('delivered')) return 'bi-check-circle-fill';
    if (s.includes('out for delivery')) return 'bi-truck';
    if (s.includes('shipped') || s.includes('assigned')) return 'bi-box-arrow-up';
    if (s.includes('picked') || s.includes('staged')) return 'bi-person-walking';
    if (s.includes('new') || s.includes('created') || s.includes('pending')) return 'bi-file-earmark-text';
    return 'bi-record-circle'; // Default icon
}


function showError(title, message) {
    Swal.fire({
        icon: 'error',
        title: title,
        text: message
    });
}
