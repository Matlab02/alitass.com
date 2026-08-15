<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function value(string $key): string
{
    return trim((string) ($_POST[$key] ?? ''));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'message' => 'Yalnız POST sorğusu qəbul edilir.']);
}

// Botlar üçün gizli sahə. Doldurularsa, istifadəçiyə uğurlu cavab qaytarılır.
if (value('website') !== '') {
    respond(200, ['ok' => true]);
}

$fullName = value('full_name');
$phone = value('phone');
$company = value('company');
$message = value('message');
$errors = [];

if ($fullName === '' || mb_strlen($fullName) > 120) {
    $errors['full_name'] = 'Ad və soyad mütləqdir.';
}
if ($phone === '' || mb_strlen($phone) > 32) {
    $errors['phone'] = 'Telefon nömrəsi mütləqdir.';
}
if (mb_strlen($company) > 160) {
    $errors['company'] = 'Şirkət adı çox uzundur.';
}
if ($message === '' || mb_strlen($message) > 4000) {
    $errors['message'] = 'Mesaj mütləqdir və 4000 simvoldan qısa olmalıdır.';
}
if ($errors) {
    respond(422, ['ok' => false, 'message' => 'Zəhmət olmasa məcburi sahələri yoxlayın.', 'errors' => $errors]);
}

$storageRoot = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'contact-data';
$uploadDirectory = $storageRoot . DIRECTORY_SEPARATOR . 'uploads';
$messagesFile = $storageRoot . DIRECTORY_SEPARATOR . 'messages.json';
if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0750, true) && !is_dir($uploadDirectory)) {
    respond(500, ['ok' => false, 'message' => 'Fayl yaddaşı hazır deyil.']);
}

$attachment = null;
$storedFile = null;
if (isset($_FILES['attachment']) && (int) $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE) {
    $file = $_FILES['attachment'];
    if ((int) $file['error'] !== UPLOAD_ERR_OK) {
        respond(422, ['ok' => false, 'message' => 'Fayl yüklənə bilmədi.']);
    }
    if ((int) $file['size'] > 10 * 1024 * 1024) {
        respond(422, ['ok' => false, 'message' => 'Faylın həcmi 10 MB-dan çox olmamalıdır.']);
    }

    $originalName = basename((string) $file['name']);
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp', 'dwg'];
    if ($originalName === '' || !in_array($extension, $allowedExtensions, true)) {
        respond(422, ['ok' => false, 'message' => 'Yalnız PDF, Word, Excel, şəkil və ya DWG faylı əlavə edilə bilər.']);
    }

    try {
        $fileId = bin2hex(random_bytes(16));
    } catch (Throwable $exception) {
        respond(500, ['ok' => false, 'message' => 'Fayl üçün təhlükəsiz identifikator yaradıla bilmədi.']);
    }
    $storedFile = $uploadDirectory . DIRECTORY_SEPARATOR . $fileId . '.' . $extension;
    if (!move_uploaded_file((string) $file['tmp_name'], $storedFile)) {
        respond(500, ['ok' => false, 'message' => 'Faylı saxlamaq mümkün olmadı.']);
    }
    $attachment = [
        'id' => $fileId,
        'name' => $originalName,
        'extension' => $extension,
        'size' => (int) $file['size'],
    ];
}

$record = [
    'id' => bin2hex(random_bytes(12)),
    'created_at' => gmdate('c'),
    'full_name' => $fullName,
    'phone' => $phone,
    'company' => $company,
    'message' => $message,
    'attachment' => $attachment,
];

$handle = fopen($messagesFile, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    if ($storedFile && is_file($storedFile)) {
        unlink($storedFile);
    }
    respond(500, ['ok' => false, 'message' => 'Mesajı yadda saxlamaq mümkün olmadı.']);
}

rewind($handle);
$rawMessages = stream_get_contents($handle);
$messages = json_decode($rawMessages ?: '[]', true);
if (!is_array($messages)) {
    $messages = [];
}
array_unshift($messages, $record);
$encodedMessages = json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if ($encodedMessages === false) {
    flock($handle, LOCK_UN);
    fclose($handle);
    if ($storedFile && is_file($storedFile)) {
        unlink($storedFile);
    }
    respond(500, ['ok' => false, 'message' => 'Mesajı emal etmək mümkün olmadı.']);
}

rewind($handle);
ftruncate($handle, 0);
fwrite($handle, $encodedMessages);
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

respond(201, ['ok' => true, 'message' => 'Mesajınız qəbul edildi.', 'attachment' => $attachment ? ['name' => $attachment['name'], 'size' => $attachment['size']] : null]);
