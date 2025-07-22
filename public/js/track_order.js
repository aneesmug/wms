// public/js/track_order.js

document.addEventListener('DOMContentLoaded', () => {
    const trackingForm = document.getElementById('trackingForm');
    const orderNumberInput = document.getElementById('orderNumberInput');
    const customerEmailInput = document.getElementById('customerEmailInput');
    const trackingResult = document.getElementById('trackingResult');
    const resultHeader = document.getElementById('resultHeader');
    const resultStatus = document.getElementById('resultStatus');
    const trackingHistoryList = document.getElementById('trackingHistoryList');

    if (trackingForm) {
        trackingForm.addEventListener('submit', handleTrackOrder);
    }

    async function handleTrackOrder(event) {
        event.preventDefault();
        trackingResult.classList.add('d-none');
        trackingHistoryList.innerHTML = '';

        const data = {
            order_number: orderNumberInput.value.trim(),
            customer_email: customerEmailInput.value.trim()
        };

        if (!data.order_number || !data.customer_email) {
            showMessageBox('Please enter both Order Number and Email.', 'error');
            return;
        }

        const submitButton = trackingForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Tracking...';

        try {
            const response = await fetch('public_tracking_api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                showMessageBox(result.message || 'An error occurred.', 'error');
                return;
            }
            displayTrackingInfo(result.data);
        } catch (error) {
            showMessageBox('Could not connect to the tracking service.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Track Order';
        }
    }

    function displayTrackingInfo(data) {
        resultHeader.textContent = `Tracking Order #${data.order_number}`;
        
        let statusHtml = `<p class="lead">Current Status: <span class="fw-bold text-primary">${data.current_status}</span></p>`;
        if (['Shipped', 'Out for Delivery'].includes(data.current_status)) {
            statusHtml += `<p class="mt-2 text-muted small"><i class="bi bi-info-circle-fill me-1"></i> A <strong>6-digit confirmation code</strong> is required upon delivery. This code has been sent to the email address associated with your account.</p>`;
        }
        resultStatus.innerHTML = statusHtml;

        if (data.history && data.history.length > 0) {
            trackingHistoryList.innerHTML = ''; 
            data.history.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-start';
                const date = new Date(item.created_at);
                
                let icon = 'bi-card-list';
                let color = 'bg-secondary';
                if (item.status === 'Shipped') { icon = 'bi-box-seam'; color = 'bg-info'; }
                if (item.status === 'Out for Delivery') { icon = 'bi-truck'; color = 'bg-primary'; }
                if (item.status === 'Delivered') { icon = 'bi-check2-circle'; color = 'bg-success'; }
                if (item.status === 'Delivery Attempted') { icon = 'bi-exclamation-triangle-fill'; color = 'bg-danger'; }

                li.innerHTML = `
                  <div class="d-flex align-items-center">
                      <span class="badge ${color} p-2 me-3" style="font-size: 1.2rem;"><i class="bi ${icon}"></i></span>
                      <div class="ms-2 me-auto">
                          <div class="fw-bold">${item.status}</div>
                          <small class="text-muted">${item.notes || 'Status updated.'}</small>
                      </div>
                  </div>
                  <span class="text-muted small">${date.toLocaleString()}</span>`;
                trackingHistoryList.appendChild(li);
            });
        } else {
            trackingHistoryList.innerHTML = '<li class="list-group-item">No detailed history available.</li>';
        }
        trackingResult.classList.remove('d-none');
    }
});
