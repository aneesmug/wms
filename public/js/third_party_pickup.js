// public/js/third_party_pickup.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const loadOrderBtn = document.getElementById('loadOrderBtn');
    const orderNumberInput = document.getElementById('orderNumberInput');
    const driverNameInput = document.getElementById('driverNameInput');

    const orderNumberDisplay = document.getElementById('orderNumberDisplay');
    const itemList = document.getElementById('itemList');
    const barcodeInput = document.getElementById('barcodeInput');
    const scanFeedback = document.getElementById('scanFeedback');
    const video = document.getElementById('scanner-video');
    const sourceSelect = document.getElementById('sourceSelect');
    const torchButton = document.getElementById('torchButton');
    const scanHistoryTableBody = document.getElementById('scanHistoryTableBody');

    // --- State Variables ---
    let currentOrder = null;
    let codeReader = null;
    let selectedDeviceId = null;
    let torchCapability = false;
    // MODIFICATION: Added a timer for scanner input
    let barcodeScannerTimer;
    const SCAN_TIMEOUT = 200; // ms

    // --- Helper function for API calls ---
    async function fetchData(url, method = 'GET', data = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (data) {
                options.body = JSON.stringify(data);
            }
            const response = await fetch(url, options);
            const jsonResult = await response.json();
            if (!response.ok) {
                throw new Error(jsonResult.message || `An error occurred. Status: ${response.status}`);
            }
            return jsonResult;
        } catch (error) {
            console.error('Fetch Error:', error);
            Swal.fire('Error', error.message, 'error');
            return null;
        }
    }

    // --- Event Listeners ---
    loadOrderBtn.addEventListener('click', handleLoadOrder);
    
    // MODIFICATION: Replaced single 'keypress' event with more robust input handling
    // This handles manual entry with Enter/Tab and scanners that don't send a suffix key.
    barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault(); // Prevent default Tab behavior (moving to next field)
            clearTimeout(barcodeScannerTimer); // Prevent the timer from firing as well
            handleBarcode(barcodeInput.value);
        }
    });

    barcodeInput.addEventListener('input', () => {
        clearTimeout(barcodeScannerTimer);
        barcodeScannerTimer = setTimeout(() => {
            // This will trigger if a scanner inputs text without an Enter/Tab suffix,
            // or if a user pauses after typing manually.
            if (barcodeInput.value.length > 5) { // A reasonable minimum length for a barcode
                handleBarcode(barcodeInput.value);
            }
        }, SCAN_TIMEOUT);
    });

    sourceSelect.addEventListener('change', () => {
        selectedDeviceId = sourceSelect.value;
        startScanner();
    });
    torchButton.addEventListener('click', toggleTorch);


    // --- Step 1: Load Order ---
    async function handleLoadOrder() {
        const orderNumber = orderNumberInput.value.trim();
        const driverName = driverNameInput.value.trim();

        if (!orderNumber || !driverName) {
            Swal.fire('Input Required', 'Please enter both the Order Number and your name.', 'warning');
            return;
        }

        loadOrderBtn.disabled = true;
        loadOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';

        const result = await fetchData(`api/driver_api.php?action=getOrderForThirdParty&order_number=${orderNumber}`);

        if (result && result.success) {
            currentOrder = result.data;
            if (!currentOrder.third_party_driver_name) {
                currentOrder.third_party_driver_name = driverName;
            } else {
                driverNameInput.value = currentOrder.third_party_driver_name;
                driverNameInput.readOnly = true;
            }
            displayOrderForScanning();
            populateScanHistory(currentOrder.scan_history);
            step1.classList.add('d-none');
            step2.classList.remove('d-none');
            initializeScanner();
        }

        loadOrderBtn.disabled = false;
        loadOrderBtn.innerHTML = 'Load Order for Scanning';
    }

    // --- Step 2: Display and Scan ---
    function displayOrderForScanning() {
        orderNumberDisplay.textContent = currentOrder.order_number;
        itemList.innerHTML = '';
        currentOrder.items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.id = `product-${item.product_id}`;
            li.innerHTML = `
                <span>
                    <strong class="d-block">${item.product_name}</strong>
                    <small class="text-muted">SKU: ${item.sku}</small>
                </span>
                <span class="badge bg-secondary rounded-pill" style="font-size: 1rem;">
                    <span id="scanned-qty-${item.product_id}">${item.scanned_quantity}</span> / ${item.ordered_quantity}
                </span>
            `;
            itemList.appendChild(li);
            updateItemStatus(item.product_id);
        });
    }

    function populateScanHistory(history) {
        scanHistoryTableBody.innerHTML = '';
        if (history && history.length > 0) {
            history.forEach(scan => addScanToHistory(scan, false));
        } else {
            scanHistoryTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No items scanned yet.</td></tr>';
        }
    }

    function addScanToHistory(scan, prepend = true) {
        if (scanHistoryTableBody.querySelector('td[colspan="3"]')) {
            scanHistoryTableBody.innerHTML = ''; // Clear "No items" message
        }
        const row = document.createElement('tr');
        const scanTime = new Date(scan.scanned_at).toLocaleTimeString();
        row.innerHTML = `
            <td>${scanTime}</td>
            <td>${scan.product_name} <small class="text-muted d-block">${scan.sku}</small></td>
            <td><code>${scan.sticker_code}</code></td>
        `;
        if (prepend) {
            scanHistoryTableBody.prepend(row);
        } else {
            scanHistoryTableBody.appendChild(row);
        }
    }

    function updateItemStatus(productId) {
        const itemLi = document.getElementById(`product-${productId}`);
        const scannedQtyEl = document.getElementById(`scanned-qty-${productId}`);
        if (!itemLi || !scannedQtyEl) return;

        const scanned = parseInt(scannedQtyEl.textContent, 10);
        const ordered = parseInt(scannedQtyEl.parentElement.textContent.split('/')[1].trim(), 10);

        if (scanned >= ordered) {
            itemLi.classList.add('list-group-item-success');
            itemLi.querySelector('.badge').classList.remove('bg-secondary');
            itemLi.querySelector('.badge').classList.add('bg-success');
        }
    }

    // --- Scanner Logic ---
    function initializeScanner() {
        codeReader = new ZXing.BrowserMultiFormatReader();
        codeReader.listVideoInputDevices()
            .then(videoInputDevices => {
                if (videoInputDevices.length > 0) {
                    selectedDeviceId = videoInputDevices[0].deviceId;
                    if (videoInputDevices.length > 1) {
                        videoInputDevices.forEach(element => {
                            const sourceOption = document.createElement('option');
                            sourceOption.text = element.label;
                            sourceOption.value = element.deviceId;
                            sourceSelect.appendChild(sourceOption);
                        });
                    }
                    startScanner();
                } else {
                    Swal.fire('Scanner Error', 'No camera devices found.', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                Swal.fire('Scanner Error', 'Could not initialize camera. Please check permissions.', 'error');
            });
    }

    function startScanner() {
        codeReader.reset();
        codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner-video', (result, err) => {
            if (result) {
                handleBarcode(result.text);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err);
            }
        }).then(controls => {
            const stream = controls.stream;
            if (stream) {
                const track = stream.getVideoTracks()[0];
                if (track && typeof track.getCapabilities === 'function' && 'torch' in track.getCapabilities()) {
                    torchCapability = true;
                    torchButton.style.display = 'block';
                }
            }
        }).catch(err => {
            console.error("Error starting scanner:", err);
        });
    }

    function toggleTorch() {
        if (torchCapability && codeReader && codeReader.stream) {
            const videoTrack = codeReader.stream.getVideoTracks()[0];
            if (videoTrack) {
                const currentTorchState = videoTrack.getSettings().torch || false;
                videoTrack.applyConstraints({
                    advanced: [{ torch: !currentTorchState }]
                }).catch(err => console.error("Error toggling torch:", err));
            }
        }
    }

    async function handleBarcode(barcode) {
        if (!barcode) return;
        
        playBeep();
        barcodeInput.disabled = true;
        barcodeInput.value = barcode;
        scanFeedback.innerHTML = `<div class="alert alert-info">Processing: ${barcode}</div>`;

        const body = {
            barcode: barcode,
            order_id: currentOrder.order_id,
            scanner_name: driverNameInput.value.trim()
        };

        const result = await fetchData('api/driver_api.php?action=scanItemForThirdParty', 'POST', body);

        if (result && result.success) {
            scanFeedback.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
            const { product_id, scan_log } = result.data;
            
            addScanToHistory(scan_log);
            const scannedQtyEl = document.getElementById(`scanned-qty-${product_id}`);
            if (scannedQtyEl) {
                const newQty = parseInt(scannedQtyEl.textContent, 10) + 1;
                scannedQtyEl.textContent = newQty;
                updateItemStatus(product_id);
            }

            const allDone = Array.from(itemList.children).every(li => li.classList.contains('list-group-item-success'));

            if (allDone || result.data.order_status_updated) {
                if(codeReader) codeReader.reset();
                Swal.fire({
                    title: 'Pickup Complete!',
                    text: 'All items have been successfully scanned. The order status has been updated. You may now proceed with the delivery.',
                    icon: 'success',
                    confirmButtonText: 'Great!'
                }).then(() => {
                    step2.classList.add('d-none');
                    step1.classList.remove('d-none');
                    orderNumberInput.value = '';
                    driverNameInput.value = '';
                    driverNameInput.readOnly = false;
                });
            }

        } else {
            scanFeedback.innerHTML = `<div class="alert alert-danger">${result ? result.message : 'An unknown error occurred.'}</div>`;
        }

        setTimeout(() => {
            barcodeInput.value = '';
            barcodeInput.disabled = false;
            barcodeInput.focus();
        }, 2000);
    }

    function playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);
            oscillator.start(audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            console.log("Could not play beep sound.", e);
        }
    }
});
