// public/js/driver_pickup.js

document.addEventListener('DOMContentLoaded', () => {
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
            
            // Get the raw response text first to handle non-JSON responses gracefully
            const responseText = await response.text();

            // Try to parse the text as JSON
            let jsonResult;
            try {
                jsonResult = JSON.parse(responseText);
            } catch (e) {
                // If parsing fails, the response was not valid JSON. This is likely a server error.
                console.error("Failed to parse JSON:", e);
                console.error("Raw server response:", responseText); // Log the raw response for debugging
                // Throw an error with the raw response to be displayed to the user
                throw new Error("The server returned an invalid response. Check the developer console for more details.");
            }

            if (!response.ok) {
                // Use the parsed JSON for the error message if available, otherwise provide a generic error.
                throw new Error(jsonResult.message || `An error occurred. Status: ${response.status}`);
            }

            return jsonResult;
        } catch (error) {
            console.error('Fetch Error:', error);
            Swal.fire('Error', error.message, 'error');
            return null;
        }
    }

    // --- DOM Elements ---
    const orderNumberDisplay = document.getElementById('orderNumberDisplay');
    const itemList = document.getElementById('itemList');
    const barcodeInput = document.getElementById('barcodeInput');
    const scanFeedback = document.getElementById('scanFeedback');
    const videoElement = document.getElementById('video');
    const sourceSelect = document.getElementById('sourceSelect');
    const torchButton = document.getElementById('torchButton');
    const scannedItemList = document.getElementById('scannedItemList'); // MODIFICATION: Get the new list element

    // --- State ---
    let orderId = null;
    let itemsToScan = [];
    let scannedItemsLog = []; // MODIFICATION: State for the scanned items log

    // MODIFICATION: Add EAN_13 to the list of scannable formats
    const formats = [ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.EAN_13];
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    const codeReader = new ZXing.BrowserMultiFormatReader(hints);
    
    let selectedDeviceId = null;
    let lastScannedBarcode = null;
    let lastScanTime = 0;
    let torchSupported = false;
    let isTorchOn = false;

    /**
     * Initializes the page by getting the order ID from the URL and loading data.
     */
    async function initializePage() {
        const urlParams = new URLSearchParams(window.location.search);
        orderId = urlParams.get('order_id');

        if (!orderId) {
            Swal.fire('Error', 'No Order ID provided. Please go back to your deliveries list.', 'error');
            return;
        }

        await loadOrderDetails();
        initializeBarcodeScanner();
    }

    /**
     * Fetches the order details, items to scan, and scanned item log from the server.
     */
    async function loadOrderDetails() {
        scanFeedback.innerHTML = ''; // Clear feedback on reload
        const result = await fetchData(`api/driver_api.php?action=getOrderDetailsForScan&order_id=${orderId}`);
        if (result && result.success) {
            const order = result.data;
            orderNumberDisplay.textContent = order.order_number;
            itemsToScan = order.items;
            scannedItemsLog = order.scanned_items_log || []; // MODIFICATION: Store the log
            renderItemList();
            renderScannedList(); // MODIFICATION: Render the new list
        } else {
            itemList.innerHTML = '<li class="list-group-item text-danger">Could not load order details.</li>';
            scannedItemList.innerHTML = '<li class="list-group-item text-danger">Could not load scan history.</li>';
        }
    }

    /**
     * Renders the checklist of items for the driver to scan.
     */
    function renderItemList() {
        itemList.innerHTML = '';
        if (itemsToScan.length === 0) {
            itemList.innerHTML = '<li class="list-group-item">This order has no items.</li>';
            return;
        }

        itemsToScan.forEach(item => {
            const scannedCount = item.scanned_quantity || 0;
            const isComplete = scannedCount >= item.ordered_quantity;
            const icon = isComplete 
                ? '<i class="bi bi-check-circle-fill text-success"></i>' 
                : '<i class="bi bi-x-circle-fill text-danger"></i>';

            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.id = `item-${item.product_id}`;
            li.innerHTML = `
                <div>
                    <strong>${item.sku}</strong> - ${item.product_name}
                </div>
                <span class="badge bg-primary rounded-pill">${scannedCount} / ${item.ordered_quantity} ${icon}</span>
            `;
            itemList.appendChild(li);
        });
    }
    
    /**
     * MODIFICATION: Renders the list of individually scanned items.
     */
    function renderScannedList() {
        scannedItemList.innerHTML = '';
        if (scannedItemsLog.length === 0) {
            scannedItemList.innerHTML = '<li class="list-group-item text-muted">No items scanned yet.</li>';
            return;
        }

        scannedItemsLog.forEach(scan => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            // Use 'en-GB' for a 24-hour format that's widely understood
            const scannedTime = new Date(scan.scanned_at).toLocaleTimeString('en-GB');

            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-check-circle-fill text-success me-2"></i>
                        <span><strong>${scan.sku}</strong> - ${scan.product_name}</span>
                    </div>
                    <small class="text-muted">${scannedTime}</small>
                </div>
                ${scan.sticker_code ? `<small class="d-block text-muted" style="margin-left: 26px;">Sticker: ${scan.sticker_code}</small>` : ''}
            `;
            scannedItemList.appendChild(li);
        });
    }

    /**
     * Initializes the ZXing barcode scanner.
     */
    function initializeBarcodeScanner() {
        codeReader.listVideoInputDevices()
            .then((videoInputDevices) => {
                if (videoInputDevices.length > 0) {
                    // Prefer the rear camera if available
                    const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
                    selectedDeviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[0].deviceId;
                    
                    // Populate the camera select dropdown
                    videoInputDevices.forEach((element) => {
                        const sourceOption = document.createElement('option');
                        sourceOption.text = element.label;
                        sourceOption.value = element.deviceId;
                        if(element.deviceId === selectedDeviceId){
                            sourceOption.selected = true;
                        }
                        sourceSelect.appendChild(sourceOption);
                    });

                    sourceSelect.onchange = () => {
                        selectedDeviceId = sourceSelect.value;
                        startScanning();
                    };
                    
                    startScanning();
                } else {
                     scanFeedback.innerHTML = `<div class="alert alert-warning">No camera devices found.</div>`;
                }
            })
            .catch((err) => {
                console.error(err);
                scanFeedback.innerHTML = `<div class="alert alert-danger">Could not access camera devices: ${err}</div>`;
            });
    }

    /**
     * Starts or restarts the scanning process and sets up torch control.
     */
    async function startScanning() {
        codeReader.reset();
        console.log(`Starting scan with device: ${selectedDeviceId}`);

        const controls = await codeReader.decodeFromVideoDevice(selectedDeviceId, 'video', (result, err) => {
            if (result) {
                const scannedBarcode = result.getText();
                const now = Date.now();
                // Debounce to prevent multiple scans of the same barcode in quick succession
                if (scannedBarcode === lastScannedBarcode && (now - lastScanTime < 3000)) {
                    return;
                }
                lastScannedBarcode = scannedBarcode;
                lastScanTime = now;
                
                verifyScannedItem(scannedBarcode);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err);
            }
        });

        setupTorchControl(controls);
    }
    
    /**
     * Checks if the camera track supports torch and sets up the button.
     */
    function setupTorchControl(controls) {
        // Ensure stream and track exist before proceeding
        if (!controls || !controls.stream || typeof controls.stream.getVideoTracks !== 'function') return;
        
        const track = controls.stream.getVideoTracks()[0];
        if (!track || typeof track.getCapabilities !== 'function') return;

        const capabilities = track.getCapabilities();
        
        if (capabilities.torch) {
            torchSupported = true;
            torchButton.style.display = 'block';
            torchButton.onclick = () => {
                isTorchOn = !isTorchOn;
                track.applyConstraints({
                    advanced: [{ torch: isTorchOn }]
                });
                torchButton.classList.toggle('btn-warning', isTorchOn);
                torchButton.classList.toggle('btn-outline-secondary', !isTorchOn);
                torchButton.innerHTML = isTorchOn ? '<i class="bi bi-flashlight-fill"></i>' : '<i class="bi bi-flashlight"></i>';
            };
        } else {
            torchSupported = false;
            torchButton.style.display = 'none';
            console.log("Torch not supported on this device/camera.");
        }
    }

    barcodeInput.addEventListener('change', () => {
        const barcode = barcodeInput.value.trim();
        if (barcode) {
            verifyScannedItem(barcode);
        }
    });

    /**
     * Sends the scanned barcode to the server for verification.
     */
    async function verifyScannedItem(barcode) {
        scanFeedback.innerHTML = `<div class="alert alert-info">Verifying: ${barcode}...</div>`;
        
        const result = await fetchData('api/driver_api.php?action=scanOrderItem', 'POST', {
            order_id: orderId,
            barcode: barcode
        });

        if (result && result.success) {
            playBeep();
            scanFeedback.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
            // MODIFICATION: Reload all data to ensure both lists are in sync
            await loadOrderDetails(); 
        } else {
            // The global fetchData handles showing the Swal error alert
            // We can still show a message in the feedback div if we want
            if (result) {
                 scanFeedback.innerHTML = `<div class="alert alert-danger">${result.message || 'Invalid barcode or item not on order.'}</div>`;
            } else {
                 scanFeedback.innerHTML = `<div class="alert alert-danger">A network error occurred. Please try again.</div>`;
            }
        }
        barcodeInput.value = ''; 
    }

    /**
     * Plays a short beep sound.
     */
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

    // --- Page Unload ---
    window.addEventListener('beforeunload', () => {
        codeReader.reset();
    });

    // --- Run Initialization ---
    initializePage();
});
