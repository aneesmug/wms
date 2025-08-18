<?php
// helpers/language_helper.php

// MODIFICATION SUMMARY:
// 1. Rewrote the `load_language` function to be more robust and self-contained.
// 2. Used a static variable `$is_loaded` to ensure translations are fetched from the database only once per request.
// 3. CRITICAL FIX: The function now ensures a global `$conn` variable is available. It checks if `$conn` exists and creates it if it doesn't. This resolves fatal errors in other scripts (like API files) that were depending on this helper to establish the database connection.
// 4. Maintained the critical `$conn->set_charset("utf8mb4");` line to ensure correct character encoding for all languages.

// Global variable to hold the translations for the current language
$translations = [];

/**
 * Loads all translation strings for a given language code from the database.
 * This function is now idempotent and will only run the database query once per request.
 * It also ensures a global database connection is available.
 *
 * @param string $lang_code The language code (e.g., 'en', 'ar').
 */
function load_language(string $lang_code = 'en') {
    global $translations, $conn; // Ensure we are interacting with the global $conn
    static $is_loaded = false;

    // Only load from the database once per page request.
    if ($is_loaded) {
        return;
    }

    // If the global connection variable doesn't exist, create it.
    if (!$conn) {
        $conn = getDbConnection();
        if (!$conn) {
            error_log("Language Helper: Database connection failed.");
            $translations = []; // Reset to empty on failure
            $is_loaded = true; // Mark as "attempted" to prevent retries
            return;
        }
    }
    
    // CRITICAL: Ensure UTF-8 communication with the database.
    $conn->set_charset("utf8mb4");

    $translations = []; // Start with a clean slate for the new load.

    try {
        $stmt = $conn->prepare("SELECT lang_key, translation FROM translations WHERE lang_code = ?");
        $stmt->bind_param("s", $lang_code);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $translations[$row['lang_key']] = $row['translation'];
        }
        $stmt->close();
        
        // Add the lang_code to the array AFTER loading.
        $translations['lang_code'] = $lang_code;

    } catch (Exception $e) {
        // Log error if something goes wrong, but don't crash the application.
        error_log("Could not load language '{$lang_code}': " . $e->getMessage());
        $translations = []; // Ensure it's empty on error
    }
    
    $is_loaded = true; // Mark as loaded for this request.
}

/**
 * Translates a given key into the currently loaded language.
 *
 * @param string $key The language key to translate (e.g., 'user_management').
 * @param string $default An optional default value to return if the key is not found.
 * @return string The translated string, or the key itself if not found.
 */
function __(string $key, string $default = ''): string {
    global $translations;

    if (isset($translations[$key])) {
        return $translations[$key];
    }
    
    // If a default is provided, use it. Otherwise, return the key itself.
    return $default !== '' ? $default : $key;
}
