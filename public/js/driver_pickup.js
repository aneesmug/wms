// public/js/driver_pickup.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const orderNumberDisplay = document.getElementById('orderNumberDisplay');
    const itemList = document.getElementById('itemList');
    const barcodeInput = document.getElementById('barcodeInput');
    const scanFeedback = document.getElementById('scanFeedback');
    const videoElement = document.getElementById('video');
    const sourceSelect = document.getElementById('sourceSelect');
    // MODIFICATION: Get the new torch button
    const torchButton = document.getElementById('torchButton');

    // --- State ---
    let orderId = null;
    let itemsToScan = [];
    const hints = new Map();
    const formats = [ZXing.BarcodeFormat.CODE_128];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    const codeReader = new ZXing.BrowserMultiFormatReader(hints);
    
    let selectedDeviceId = null;
    let lastScannedBarcode = null;
    let lastScanTime = 0;
    // MODIFICATION: State for torch control
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
     * Fetches the order details and items to be scanned from the server.
     */
    async function loadOrderDetails() {
        const result = await fetchData(`api/driver_api.php?action=getOrderDetailsForScan&order_id=${orderId}`);
        if (result && result.success) {
            const order = result.data;
            orderNumberDisplay.textContent = order.order_number;
            itemsToScan = order.items;
            renderItemList();
        } else {
            itemList.innerHTML = '<li class="list-group-item">Could not load order details.</li>';
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
     * Initializes the ZXing barcode scanner.
     */
    function initializeBarcodeScanner() {
        codeReader.listVideoInputDevices()
            .then((videoInputDevices) => {
                if (videoInputDevices.length > 0) {
                    selectedDeviceId = videoInputDevices[0].deviceId;
                    if (videoInputDevices.length > 1) {
                        const rearCamera = videoInputDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
                        if (rearCamera) {
                            selectedDeviceId = rearCamera.deviceId;
                        }
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
                    }
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
                if (scannedBarcode === lastScannedBarcode && (now - lastScanTime < 3000)) {
                    return;
                }
                lastScannedBarcode = scannedBarcode;
                lastScanTime = now;
                playBeep();
                verifyScannedItem(scannedBarcode);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err);
            }
        });

        // MODIFICATION: Check for and set up torch control
        setupTorchControl(controls);
    }
    
    /**
     * Checks if the camera track supports torch and sets up the button.
     */
    function setupTorchControl(controls) {
        const track = controls.stream.getVideoTracks()[0];
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
        scanFeedback.innerHTML = `<div class="alert alert-info">Verifying sticker: ${barcode}...</div>`;
        
        const result = await fetchData('api/driver_api.php?action=scanOrderItem', 'POST', {
            order_id: orderId,
            barcode: barcode
        });

        if (result && result.success) {
            scanFeedback.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
            const item = itemsToScan.find(i => i.product_id == result.data.product_id);
            if (item) {
                item.scanned_quantity = result.data.new_scanned_quantity;
            }
            renderItemList();
        } else {
            if (result) {
                scanFeedback.innerHTML = `<div class="alert alert-danger">${result.message || 'Invalid sticker or item not on order.'}</div>`;
            } else {
                scanFeedback.innerHTML = `<div class="alert alert-danger">A network error occurred. Please check your connection and try again.</div>`;
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
