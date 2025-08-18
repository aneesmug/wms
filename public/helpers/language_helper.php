<?php
// helpers/language_helper.php

// MODIFICATION SUMMARY:
// 1. This is a new file created to handle all language and translation logic.
// 2. A global variable `$translations` is used to store the language strings for the current session.
// 3. The `load_language` function fetches all translations for a given language code from the database.
// 4. The `__` function (short for "translate") is the main function you will use in your HTML/PHP files to get the correct translated string for a given key.

// Global variable to hold the translations for the current language
$translations = [];

/**
 * Loads all translation strings for a given language code from the database.
 *
 * @param string $lang_code The language code (e.g., 'en', 'ar').
 */
function load_language(string $lang_code = 'en') {
    global $translations, $conn;

    // If translations are already loaded for this language, do nothing.
    if (!empty($translations) && isset($translations['lang_code']) && $translations['lang_code'] === $lang_code) {
        return;
    }

    // Ensure there is a database connection.
    if (!$conn) {
        // Attempt to create a connection if it doesn't exist.
        // This might be necessary if the helper is included before the main db connection is established.
        $conn = getDbConnection();
        if (!$conn) {
            // If connection fails, we can't load translations.
            $translations = ['lang_code' => $lang_code]; // Set code to prevent re-trying
            return;
        }
    }

    $translations = ['lang_code' => $lang_code]; // Initialize with the language code.

    try {
        $stmt = $conn->prepare("SELECT lang_key, translation FROM translations WHERE lang_code = ?");
        $stmt->bind_param("s", $lang_code);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            $translations[$row['lang_key']] = $row['translation'];
        }
        $stmt->close();
    } catch (Exception $e) {
        // Log error if something goes wrong, but don't crash the application.
        error_log("Could not load language '{$lang_code}': " . $e->getMessage());
    }
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
