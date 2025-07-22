document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const batchNumberHeaderEl = document.getElementById('batchNumberHeader');
    const productNameEl = document.getElementById('productName');
    const productSkuEl = document.getElementById('productSku');
    const locationCodeEl = document.getElementById('locationCode');
    const quantityEl = document.getElementById('quantity');
    const sourceReceiptEl = document.getElementById('sourceReceipt');
    const expiryDateEl = document.getElementById('expiryDate');
    const barcodeEl = document.getElementById('barcode');
    const printBtn = document.getElementById('printBtn');
    const labelContainer = document.getElementById('labelContainer');

    /**
     * Fetches data from the API and populates the label fields.
     */
    async function loadLabelData() {
        const params = new URLSearchParams(window.location.search);
        const batchNumber = params.get('batch');

        if (!batchNumber) {
            labelContainer.innerHTML = '<div class="alert alert-danger">No batch number provided.</div>';
            if(printBtn) printBtn.style.display = 'none';
            return;
        }

        // Populate the header immediately for better UX
        if(batchNumberHeaderEl) batchNumberHeaderEl.textContent = batchNumber;

        // Fetch the full details
        const response = await fetchData(`api/inbound_api.php?action=getInventoryDetailsByBatch&batch_number=${batchNumber}`);

        if (response?.success && response.data) {
            const data = response.data;
            productNameEl.textContent = data.product_name || 'N/A';
            productSkuEl.textContent = data.sku || 'N/A';
            locationCodeEl.textContent = data.location_code || 'N/A';
            quantityEl.textContent = data.quantity || 'N/A';
            sourceReceiptEl.textContent = data.source_receipt_number || 'N/A';
            expiryDateEl.textContent = data.expiry_date || 'N/A';

            // Generate the barcode with optimized settings for the landscape label size
            JsBarcode(barcodeEl, batchNumber, {
                format: "CODE128",
                displayValue: true,
                fontSize: 16,
                width: 1.5,      // Thinner bars for landscape
                height: 40,     // Shorter height for landscape
                margin: 5       
            });
            
            // Automatically trigger the print dialog after a short delay to ensure rendering
            setTimeout(() => {
                window.print();
            }, 500);


        } else {
            labelContainer.innerHTML = `<div class="alert alert-danger">${response.message || 'Could not load batch details.'}</div>`;
            if(printBtn) printBtn.style.display = 'none';
        }
    }

    // Event listener for the manual print button as a fallback
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
    // Load the data when the page is ready
    loadLabelData();
});
