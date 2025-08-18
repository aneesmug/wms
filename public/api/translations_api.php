<?php
// api/translations_api.php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$conn = getDbConnection();
require_global_admin();


$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        handleGetTranslations($conn);
        break;
    case 'POST':
        if ($action === 'create') {
            handleCreateTranslation($conn);
        } else {
            sendJsonResponse(['success' => false, 'message' => 'Invalid POST action'], 400);
        }
        break;
    case 'PUT':
        handleUpdateTranslation($conn);
        break;
    case 'DELETE':
        handleDeleteTranslation($conn);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Method Not Allowed'], 405);
        break;
}

function handleGetTranslations($conn) {
    $stmt = $conn->prepare("
        SELECT 
            lang_key,
            MAX(CASE WHEN lang_code = 'en' THEN translation ELSE NULL END) as en,
            MAX(CASE WHEN lang_code = 'ar' THEN translation ELSE NULL END) as ar
        FROM translations
        GROUP BY lang_key
        ORDER BY lang_key ASC
    ");
    $stmt->execute();
    $result = $stmt->get_result();
    $data = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJsonResponse(['success' => true, 'data' => $data]);
}

function handleCreateTranslation($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $lang_key = sanitize_input($input['lang_key'] ?? '');
    $translation_en = $input['translation_en'] ?? '';
    $translation_ar = $input['translation_ar'] ?? '';

    if (empty($lang_key) || empty($translation_en) || empty($translation_ar)) {
        sendJsonResponse(['success' => false, 'message' => 'All fields are required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        // Check if key already exists
        $stmt_check = $conn->prepare("SELECT lang_key FROM translations WHERE lang_key = ?");
        $stmt_check->bind_param("s", $lang_key);
        $stmt_check->execute();
        if ($stmt_check->get_result()->num_rows > 0) {
            throw new Exception("Language key '{$lang_key}' already exists.");
        }
        $stmt_check->close();

        // Insert English version
        $stmt_en = $conn->prepare("INSERT INTO translations (lang_key, lang_code, translation) VALUES (?, 'en', ?)");
        $stmt_en->bind_param("ss", $lang_key, $translation_en);
        if (!$stmt_en->execute()) {
            throw new Exception("Failed to insert English translation.");
        }
        $stmt_en->close();

        // Insert Arabic version
        $stmt_ar = $conn->prepare("INSERT INTO translations (lang_key, lang_code, translation) VALUES (?, 'ar', ?)");
        $stmt_ar->bind_param("ss", $lang_key, $translation_ar);
        if (!$stmt_ar->execute()) {
            throw new Exception("Failed to insert Arabic translation.");
        }
        $stmt_ar->close();

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Translation added successfully.'], 201);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => $e->getMessage()], 409); // 409 Conflict for duplicate
    }
}

function handleUpdateTranslation($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $lang_key = sanitize_input($input['lang_key'] ?? '');
    $translation_en = $input['en'] ?? '';
    $translation_ar = $input['ar'] ?? '';

    if (empty($lang_key)) {
        sendJsonResponse(['success' => false, 'message' => 'Language key is required.'], 400);
        return;
    }

    $conn->begin_transaction();
    try {
        // Update English
        $stmt_en = $conn->prepare("UPDATE translations SET translation = ? WHERE lang_key = ? AND lang_code = 'en'");
        $stmt_en->bind_param("ss", $translation_en, $lang_key);
        $stmt_en->execute();
        $stmt_en->close();

        // Update Arabic
        $stmt_ar = $conn->prepare("UPDATE translations SET translation = ? WHERE lang_key = ? AND lang_code = 'ar'");
        $stmt_ar->bind_param("ss", $translation_ar, $lang_key);
        $stmt_ar->execute();
        $stmt_ar->close();

        $conn->commit();
        sendJsonResponse(['success' => true, 'message' => 'Translation updated successfully.']);
    } catch (Exception $e) {
        $conn->rollback();
        sendJsonResponse(['success' => false, 'message' => 'Failed to update translation: ' . $e->getMessage()], 500);
    }
}

function handleDeleteTranslation($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $lang_key = sanitize_input($input['lang_key'] ?? '');

    if (empty($lang_key)) {
        sendJsonResponse(['success' => false, 'message' => 'Language key is required.'], 400);
        return;
    }

    $stmt = $conn->prepare("DELETE FROM translations WHERE lang_key = ?");
    $stmt->bind_param("s", $lang_key);
    if ($stmt->execute()) {
        sendJsonResponse(['success' => true, 'message' => 'Translation deleted successfully.']);
    } else {
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete translation.'], 500);
    }
    $stmt->close();
}
