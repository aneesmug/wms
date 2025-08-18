// public/js/barcodeScanner.js

// This file contains the barcode scanner setup utility.
// For robust webcam scanning, integrate a library like QuaggaJS here.
// The current implementation simulates a USB scanner by listening for keyboard input ending with Enter.

function setupBarcodeScanner(inputFieldId, callback) {
    const inputField = document.getElementById(inputFieldId);
    if (!inputField) {
        console.warn(`Barcode input field with ID '${inputFieldId}' not found. Cannot set up scanner.`);
        return;
    }

    let barcodeBuffer = '';
    let lastScanTime = 0;
    const SCAN_TIMEOUT_MS = 100; // Max time between characters to consider it one scan (adjust as needed)

    // Event listener for keydown events on the input field
    inputField.addEventListener('keydown', (event) => {
        const currentTime = new Date().getTime();

        // If the time between key presses exceeds the timeout, reset the buffer.
        // This handles pauses between scanning different barcodes or manual typing.
        if (currentTime - lastScanTime > SCAN_TIMEOUT_MS) {
            barcodeBuffer = '';
        }
        lastScanTime = currentTime;

        // Check if the pressed key is 'Enter' (key code 13)
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission or newline in text area
            if (barcodeBuffer.length > 0) {
                callback(barcodeBuffer); // Execute the callback with the scanned barcode
                barcodeBuffer = ''; // Clear the buffer for the next scan
            }
        } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            // Append single character keys (avoiding control keys like Shift, Ctrl, Alt, Cmd)
            barcodeBuffer += event.key;
        }
        // For more advanced barcode readers (like USB HID emulation),
        // they might rapidly send characters and then an Enter.
        // This logic helps capture the full string.
    });

    console.log(`Barcode scanner listener initialized for input field: #${inputFieldId}`);

    // --- For actual Webcam/Image-based Barcode Scanning (e.g., using QuaggaJS) ---
    // This section would be activated if you're using a library like QuaggaJS.
    // Example (conceptual, requires QuaggaJS library setup):
    /*
    function startLiveScanner(videoElementId, resultHandler) {
        Quagga.init({
            inputStream : {
                name : "Live",
                type : "LiveStream",
                target: document.querySelector('#' + videoElementId)
            },
            decoder : {
                readers : ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader"]
            }
        }, function(err) {
            if (err) {
                console.error(err);
                showMessageBox('Failed to start webcam scanner. Check camera permissions.', 'error');
                return;
            }
            console.log("Initialization finished. Ready to start.");
            Quagga.start();
        });

        Quagga.onDetected(function(data) {
            if (data && data.codeResult && data.codeResult.code) {
                resultHandler(data.codeResult.code);
                // Optional: Quagga.stop(); // Stop scanning after first successful read
            }
        });
    }

    // To use with QuaggaJS:
    // Call `startLiveScanner('videoElementId', handleProductBarcodeScan)` from your page's JS
    // You'd need a <video> element on your HTML page for the camera feed.
    */
}

// Attach the barcodeScanner.js functions to the global window object if needed
// or ensure they are imported/defined before main.js uses them.
// For this project structure, main.js directly calls setupBarcodeScanner,
// so as long as barcodeScanner.js is loaded first (or via 'defer' and main.js has 'defer'), it's fine.

