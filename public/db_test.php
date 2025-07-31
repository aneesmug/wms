<?php
/**
 * db_test.php
 * A standalone script to diagnose the database connection.
 * Place this file in your project's root 'public' directory and access it via your browser.
 */

// --- Database Configuration ---
// These details should match your config/config.php file.
$db_server = '127.0.0.1';
$db_username = 'root';
$db_password = 'admin123';
$db_name = 'almutlak_wms_final_db';

// --- HTML Header ---
echo "<!DOCTYPE html><html lang='en'><head><title>Database Connection Test</title>";
echo "<style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        h1 { color: #1a237e; }
        .status { padding: 15px; border-radius: 5px; font-weight: bold; }
        .success { background-color: #e8f5e9; color: #2e7d32; border-left: 5px solid #4caf50; }
        .error { background-color: #ffebee; color: #c62828; border-left: 5px solid #f44336; }
        code { background-color: #f1f1f1; padding: 2px 5px; border-radius: 3px; }
      </style>";
echo "</head><body>";
echo "<h1>Database Connection Test</h1>";

// --- Connection Test ---
echo "<p>Attempting to connect to MySQL server at <code>" . htmlspecialchars($db_server) . "</code> with username <code>" . htmlspecialchars($db_username) . "</code>...</p>";

// Use error suppression with @ to handle connection errors gracefully
$conn = @new mysqli($db_server, $db_username, $db_password);

// Check for connection errors
if ($conn->connect_error) {
    echo "<div class='status error'>";
    echo "<strong>Connection Failed.</strong><br>";
    echo "Error (" . $conn->connect_errno . "): " . htmlspecialchars($conn->connect_error);
    echo "</div>";
    echo "<h2>Troubleshooting Steps:</h2>";
    echo "<ul>";
    echo "<li>Is your MySQL server running in the XAMPP Control Panel?</li>";
    echo "<li>Are the credentials (server, username, password) in this script correct for your XAMPP setup?</li>";
    echo "</ul>";
} else {
    echo "<div class='status success'>Successfully connected to the MySQL server!</div>";

    // --- Database Selection Test ---
    echo "<p>Now, trying to select the database: <code>" . htmlspecialchars($db_name) . "</code>...</p>";
    if ($conn->select_db($db_name)) {
        echo "<div class='status success'>Successfully selected the database '<code>" . htmlspecialchars($db_name) . "</code>'.</div>";
        echo "<h2>Next Steps:</h2>";
        echo "<p>Your database connection is working correctly! The issue might be a path problem in the specific PHP file that's failing. Double-check that the `require_once` path to `config/config.php` is correct from the file's location.</p>";
    } else {
        echo "<div class='status error'>";
        echo "<strong>Database Selection Failed.</strong><br>";
        echo "Error: " . htmlspecialchars($conn->error);
        echo "</div>";
        echo "<h2>Troubleshooting Steps:</h2>";
        echo "<ul>";
        echo "<li>Have you created the database named '<code>" . htmlspecialchars($db_name) . "</code>' in phpMyAdmin?</li>";
        echo "<li>Have you imported the <code>almutlak_wms_final_db.sql</code> file into that database?</li>";
        echo "</ul>";
    }
    // Close the connection
    $conn->close();
}

echo "</body></html>";
