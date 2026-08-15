<?php
declare(strict_types=1);

/**
 * Shared helpers for Alitass' small JSON-backed API.
 *
 * The data directory intentionally lives one level above public_html on the
 * hosting account: /home/alitass/contact-data.  It therefore cannot be
 * requested directly from the web.
 */

const ALITASS_ADMIN_USERNAME = 'admin';
// password_hash('123456', PASSWORD_BCRYPT, ['cost' => 12])
const ALITASS_ADMIN_PASSWORD_HASH = '$2y$12$qAAfcHmgWYP81a3zOWTD8OYefwJBea59IGJCLjUhwZXyQ7c4SThni';
const ALITASS_SESSION_NAME = 'alitass_admin';
const ALITASS_SESSION_IDLE_SECONDS = 60 * 60 * 8;
const ALITASS_CATALOG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const ALITASS_CATALOG_IMAGE_MAX_DIMENSION = 6000;
const ALITASS_CATALOG_IMAGE_MAX_PIXELS = 36000000;

final class ApiError extends RuntimeException
{
    public int $status;
    public array $details;

    public function __construct(int $status, string $message, array $details = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->details = $details;
    }
}

function apiFail(int $status, string $message, array $details = []): never
{
    throw new ApiError($status, $message, $details);
}

function respondJson(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function runApi(callable $handler): never
{
    ini_set('display_errors', '0');

    try {
        $handler();
        apiFail(500, 'API cavabı yaradılmadı.');
    } catch (ApiError $error) {
        $payload = ['ok' => false, 'message' => $error->getMessage()];
        if ($error->details !== []) {
            $payload['errors'] = $error->details;
        }
        respondJson($error->status, $payload);
    } catch (Throwable $error) {
        error_log('Alitass API error: ' . $error->getMessage());
        respondJson(500, ['ok' => false, 'message' => 'Server xətası baş verdi.']);
    }
}

function requestMethod(): string
{
    return strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function requireMethod(string ...$methods): void
{
    if (!in_array(requestMethod(), $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        apiFail(405, 'Bu əməliyyat üçün sorğu metodu uyğun deyil.');
    }
}

/** @return array<string, mixed> */
function jsonBody(): array
{
    static $payload;
    if (is_array($payload)) {
        return $payload;
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return $payload = [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
        apiFail(400, 'JSON məlumatı oxunaqlı deyil.');
    }

    return $payload = $decoded;
}

function stringValue(mixed $value): string
{
    return is_string($value) ? trim($value) : '';
}

function isHttps(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function startAdminSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name(ALITASS_SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => isHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    if (!session_start()) {
        apiFail(500, 'Təhlükəsiz sessiya başladılmadı.');
    }
}

function endAdminSession(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }

    $_SESSION = [];
    $cookie = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $cookie['path'] ?? '/',
        'domain' => $cookie['domain'] ?? '',
        'secure' => (bool) ($cookie['secure'] ?? false),
        'httponly' => (bool) ($cookie['httponly'] ?? true),
        'samesite' => $cookie['samesite'] ?? 'Lax',
    ]);
    session_destroy();
}

function isAdminAuthenticated(): bool
{
    startAdminSession();

    if (($_SESSION['admin_user'] ?? null) !== ALITASS_ADMIN_USERNAME) {
        return false;
    }

    $lastActivity = (int) ($_SESSION['last_activity'] ?? 0);
    if ($lastActivity <= 0 || time() - $lastActivity > ALITASS_SESSION_IDLE_SECONDS) {
        endAdminSession();
        return false;
    }

    $_SESSION['last_activity'] = time();
    return true;
}

function requireAdmin(): void
{
    if (!isAdminAuthenticated()) {
        apiFail(401, 'Admin girişiniz tələb olunur.');
    }
}

function createCsrfToken(): string
{
    try {
        return bin2hex(random_bytes(32));
    } catch (Throwable $error) {
        apiFail(500, 'Təhlükəsizlik açarı yaradıla bilmədi.');
    }
}

function csrfToken(): string
{
    requireAdmin();
    $token = $_SESSION['csrf_token'] ?? '';
    if (!is_string($token) || $token === '') {
        $token = createCsrfToken();
        $_SESSION['csrf_token'] = $token;
    }
    return $token;
}

/** @param array<string, mixed> $payload */
function requireCsrf(array $payload): void
{
    requireAdmin();
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $payload['csrf_token'] ?? '');
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        apiFail(403, 'Təhlükəsizlik açarı düzgün deyil.');
    }
}

function storageRoot(): string
{
    return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'contact-data';
}

function ensureStorageRoot(): string
{
    $root = storageRoot();
    if (!is_dir($root) && !mkdir($root, 0750, true) && !is_dir($root)) {
        apiFail(500, 'Məlumat qovluğu hazırlana bilmədi.');
    }
    return $root;
}

function productsFile(): string
{
    return ensureStorageRoot() . DIRECTORY_SEPARATOR . 'products.json';
}

function messagesFile(): string
{
    return ensureStorageRoot() . DIRECTORY_SEPARATOR . 'messages.json';
}

function categoriesFile(): string
{
    return ensureStorageRoot() . DIRECTORY_SEPARATOR . 'categories.json';
}

function catalogImagesFile(): string
{
    return ensureStorageRoot() . DIRECTORY_SEPARATOR . 'catalog-images.json';
}

function catalogImagesDirectory(): string
{
    $directory = ensureStorageRoot() . DIRECTORY_SEPARATOR . 'catalog-images';
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        apiFail(500, 'Kataloq şəkilləri üçün qovluq hazırlana bilmədi.');
    }
    return $directory;
}

function uploadsDirectory(): string
{
    return ensureStorageRoot() . DIRECTORY_SEPARATOR . 'uploads';
}

/**
 * Mutate a JSON array under an exclusive lock.  It uses the same file-level
 * locking pattern as contact.php so a contact submission cannot race with an
 * admin message action.
 *
 * @param array<int, mixed> $initial
 * @param callable(array<int, mixed>, bool): array{data: array<int, mixed>, changed: bool, result: mixed} $mutation
 */
function mutateJsonArray(string $file, array $initial, callable $mutation): mixed
{
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        apiFail(500, 'Məlumat faylı açıla bilmədi.');
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        apiFail(503, 'Məlumat faylı hazırda məşğuldur.');
    }

    try {
        rewind($handle);
        $raw = stream_get_contents($handle);
        if ($raw === false) {
            apiFail(500, 'Məlumat faylı oxuna bilmədi.');
        }

        $empty = trim($raw) === '';
        if ($empty) {
            $data = $initial;
        } else {
            $data = json_decode($raw, true);
            if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
                apiFail(500, 'Məlumat faylının formatı düzgün deyil.');
            }
        }

        $change = $mutation($data, $empty);
        if (!isset($change['data'], $change['changed']) || !is_array($change['data']) || !is_bool($change['changed'])) {
            apiFail(500, 'Məlumat əməliyyatı düzgün qurulmayıb.');
        }

        if ($change['changed']) {
            $encoded = json_encode($change['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            if ($encoded === false) {
                apiFail(500, 'Məlumat JSON formatına çevrilə bilmədi.');
            }

            rewind($handle);
            if (!ftruncate($handle, 0)) {
                apiFail(500, 'Məlumat faylı yenilənə bilmədi.');
            }

            $length = strlen($encoded);
            $written = 0;
            while ($written < $length) {
                $part = fwrite($handle, substr($encoded, $written));
                if ($part === false || $part === 0) {
                    apiFail(500, 'Məlumat faylı yadda saxlanıla bilmədi.');
                }
                $written += $part;
            }
            fflush($handle);
        }

        return $change['result'] ?? null;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/**
 * Catalog artwork is intentionally kept outside public_html.  The opaque ID
 * is the only value exposed to a browser, and media.php additionally checks
 * that the image is referenced by a public product or category before serving
 * it.
 */
function catalogImageUrl(string $id): string
{
    return 'api/media.php?id=' . rawurlencode($id);
}

function isCatalogImageId(string $id): bool
{
    return (bool) preg_match('/^[a-f0-9]{32}$/', $id);
}

/** @return array<string, string> */
function catalogImageMimeTypes(): array
{
    return [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
}

function cleanCatalogImageName(string $name): string
{
    $name = basename($name);
    $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '';
    $name = trim($name);
    if ($name === '') {
        return 'sekil';
    }
    return mb_substr($name, 0, 180);
}

/** @param array<string, mixed> $image */
function validStoredCatalogImage(array $image): bool
{
    return isset($image['id'], $image['name'], $image['extension'], $image['mime'], $image['size'], $image['width'], $image['height'], $image['scope'], $image['created_at'])
        && is_string($image['id'])
        && isCatalogImageId($image['id'])
        && is_string($image['name'])
        && $image['name'] !== ''
        && is_string($image['extension'])
        && in_array($image['extension'], ['jpg', 'png', 'webp'], true)
        && is_string($image['mime'])
        && isset(catalogImageMimeTypes()[$image['mime']])
        && catalogImageMimeTypes()[$image['mime']] === $image['extension']
        && is_int($image['size'])
        && $image['size'] > 0
        && $image['size'] <= ALITASS_CATALOG_IMAGE_MAX_BYTES
        && is_int($image['width'])
        && is_int($image['height'])
        && $image['width'] > 0
        && $image['height'] > 0
        && $image['width'] <= ALITASS_CATALOG_IMAGE_MAX_DIMENSION
        && $image['height'] <= ALITASS_CATALOG_IMAGE_MAX_DIMENSION
        && $image['width'] * $image['height'] <= ALITASS_CATALOG_IMAGE_MAX_PIXELS
        && is_string($image['scope'])
        && in_array($image['scope'], ['product', 'category'], true)
        && is_string($image['created_at']);
}

/** @param array<int, mixed> $images */
function validateStoredCatalogImages(array $images): void
{
    $ids = [];
    foreach ($images as $image) {
        if (!is_array($image) || !validStoredCatalogImage($image) || isset($ids[$image['id']])) {
            apiFail(500, 'Kataloq şəkillərinin məlumat formatı düzgün deyil.');
        }
        $ids[$image['id']] = true;
    }
}

/** @return array<int, array<string, mixed>> */
function allStoredCatalogImages(): array
{
    /** @var array<int, array<string, mixed>> $images */
    $images = mutateJsonArray(catalogImagesFile(), [], static function (array $images, bool $wasEmpty): array {
        validateStoredCatalogImages($images);
        return ['data' => $images, 'changed' => false, 'result' => $images];
    });
    return $images;
}

/** @param array<string, mixed> $image
 * @return array<string, mixed>
 */
function catalogImageForResponse(array $image): array
{
    return [
        'id' => $image['id'],
        'name' => $image['name'],
        'extension' => $image['extension'],
        'mime' => $image['mime'],
        'size' => $image['size'],
        'width' => $image['width'],
        'height' => $image['height'],
        'url' => catalogImageUrl($image['id']),
    ];
}

/** @return array<string, mixed> */
function findCatalogImage(string $id): array
{
    if (!isCatalogImageId($id)) {
        apiFail(422, 'Şəkil identifikatoru düzgün deyil.', ['image' => 'Düzgün yüklənmiş şəkil seçin.']);
    }

    /** @var array<string, mixed> $found */
    $found = mutateJsonArray(catalogImagesFile(), [], static function (array $images, bool $wasEmpty) use ($id): array {
        validateStoredCatalogImages($images);
        foreach ($images as $image) {
            if ($image['id'] === $id) {
                return ['data' => $images, 'changed' => false, 'result' => $image];
            }
        }
        apiFail(404, 'Şəkil tapılmadı və ya artıq silinib.');
    });

    catalogImagePath($found);
    return $found;
}

/** @param array<string, mixed> $image */
function catalogImagePath(array $image): string
{
    if (!validStoredCatalogImage($image)) {
        apiFail(404, 'Şəkil tapılmadı.');
    }

    $directory = catalogImagesDirectory();
    $directoryReal = realpath($directory);
    $path = $directory . DIRECTORY_SEPARATOR . $image['id'] . '.' . $image['extension'];
    $pathReal = realpath($path);
    if ($directoryReal === false || $pathReal === false || !is_file($pathReal)) {
        apiFail(404, 'Şəkil tapılmadı.');
    }

    $prefix = rtrim($directoryReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if (strncmp($pathReal, $prefix, strlen($prefix)) !== 0) {
        apiFail(404, 'Şəkil tapılmadı.');
    }
    return $pathReal;
}

/**
 * @param array<string, mixed> $input
 * @param array<string, mixed>|null $existing
 * @return array<string, mixed>|null
 */
function catalogImageFromInput(array $input, ?array $existing = null): ?array
{
    $imageWasProvided = array_key_exists('image', $input) || array_key_exists('image_id', $input);
    if (!$imageWasProvided) {
        return $existing;
    }

    $raw = $input['image'] ?? $input['image_id'] ?? null;
    if ($raw === null || $raw === '' || $raw === false) {
        return null;
    }

    $id = '';
    if (is_string($raw)) {
        $id = trim($raw);
    } elseif (is_array($raw)) {
        $id = stringValue($raw['id'] ?? $raw['image_id'] ?? null);
    }
    if (!isCatalogImageId($id)) {
        apiFail(422, 'Şəkil məlumatını yoxlayın.', ['image' => 'Yüklənmiş şəkli seçin.']);
    }

    return findCatalogImage($id);
}

/** @return array<string, mixed> */
function storeUploadedCatalogImage(string $scope): array
{
    if (!in_array($scope, ['product', 'category'], true)) {
        apiFail(422, 'Şəkil növünü düzgün seçin.', ['scope' => 'Məhsul və ya kateqoriya seçin.']);
    }

    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || !isset($file['error'])) {
        apiFail(422, 'Şəkil faylı seçilməyib.', ['file' => 'JPG, PNG və ya WEBP faylı seçin.']);
    }
    $errorValue = $file['error'];
    if (!is_int($errorValue) && !(is_string($errorValue) && ctype_digit($errorValue))) {
        apiFail(422, 'Şəkil faylını yoxlayın.', ['file' => 'Fayl düzgün deyil.']);
    }
    $error = (int) $errorValue;
    if ($error !== UPLOAD_ERR_OK) {
        $message = match ($error) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Şəkil 8 MB-dan böyük ola bilməz.',
            UPLOAD_ERR_NO_FILE => 'Şəkil faylı seçilməyib.',
            default => 'Şəkil yüklənərkən xəta baş verdi.',
        };
        apiFail(422, $message, ['file' => $message]);
    }

    $tmpName = is_string($file['tmp_name'] ?? null) ? $file['tmp_name'] : '';
    $sizeValue = $file['size'] ?? 0;
    $size = is_int($sizeValue) ? $sizeValue : (is_string($sizeValue) && ctype_digit($sizeValue) ? (int) $sizeValue : 0);
    if ($tmpName === '' || !is_uploaded_file($tmpName) || $size < 1 || $size > ALITASS_CATALOG_IMAGE_MAX_BYTES) {
        apiFail(422, 'Şəkil faylını yoxlayın. Maksimum ölçü 8 MB-dır.', ['file' => 'Fayl düzgün deyil.']);
    }

    try {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($tmpName);
    } catch (Throwable) {
        apiFail(500, 'Şəkil tipi yoxlana bilmədi.');
    }
    $types = catalogImageMimeTypes();
    if (!isset($types[$mime])) {
        apiFail(422, 'Yalnız JPG, PNG və WEBP şəkilləri qəbul edilir.', ['file' => 'Fayl formatı uyğun deyil.']);
    }

    $dimensions = @getimagesize($tmpName);
    if (!is_array($dimensions)) {
        apiFail(422, 'Yüklənmiş fayl oxunaqlı şəkil deyil.', ['file' => 'Şəkil faylını yoxlayın.']);
    }
    $width = (int) ($dimensions[0] ?? 0);
    $height = (int) ($dimensions[1] ?? 0);
    if ($width < 1 || $height < 1 || $width > ALITASS_CATALOG_IMAGE_MAX_DIMENSION || $height > ALITASS_CATALOG_IMAGE_MAX_DIMENSION || $width * $height > ALITASS_CATALOG_IMAGE_MAX_PIXELS) {
        apiFail(422, 'Şəkil ölçüsü çox böyükdür.', ['file' => 'Maksimum 6000 × 6000 piksel şəkil yükləyin.']);
    }

    $extension = $types[$mime];
    $directory = catalogImagesDirectory();
    do {
        try {
            $id = bin2hex(random_bytes(16));
        } catch (Throwable) {
            apiFail(500, 'Şəkil identifikatoru yaradıla bilmədi.');
        }
        $destination = $directory . DIRECTORY_SEPARATOR . $id . '.' . $extension;
    } while (is_file($destination));

    if (!move_uploaded_file($tmpName, $destination)) {
        apiFail(500, 'Şəkil yadda saxlanıla bilmədi.');
    }
    @chmod($destination, 0640);

    $image = [
        'id' => $id,
        'name' => cleanCatalogImageName((string) ($file['name'] ?? 'sekil.' . $extension)),
        'extension' => $extension,
        'mime' => $mime,
        'size' => $size,
        'width' => $width,
        'height' => $height,
        'scope' => $scope,
        'created_at' => gmdate('c'),
    ];

    try {
        mutateJsonArray(catalogImagesFile(), [], static function (array $images, bool $wasEmpty) use ($image): array {
            validateStoredCatalogImages($images);
            $images[] = $image;
            return ['data' => $images, 'changed' => true, 'result' => null];
        });
    } catch (Throwable $error) {
        if (is_file($destination)) {
            @unlink($destination);
        }
        throw $error;
    }

    return $image;
}

/** @param array<string, mixed> $record */
function storedRecordHasCatalogImage(array $record, string $id): bool
{
    return isset($record['image'])
        && is_array($record['image'])
        && isCatalogImageId(stringValue($record['image']['id'] ?? null))
        && hash_equals((string) $record['image']['id'], $id);
}

function catalogImageIsPubliclyReferenced(string $id): bool
{
    foreach (storedProducts() as $product) {
        if (storedRecordHasCatalogImage($product, $id)) {
            return true;
        }
    }
    foreach (storedCategories() as $category) {
        if (storedRecordHasCatalogImage($category, $id)) {
            return true;
        }
    }
    return false;
}

/** @return array<string, mixed> */
function publicCatalogImage(string $id): array
{
    $image = findCatalogImage($id);
    if (!catalogImageIsPubliclyReferenced($id)) {
        apiFail(404, 'Şəkil tapılmadı.');
    }
    return $image;
}

function removeCatalogImageIfUnused(string $id): bool
{
    if (!isCatalogImageId($id) || catalogImageIsPubliclyReferenced($id)) {
        return false;
    }

    /** @var array<string, mixed>|null $removed */
    $removed = mutateJsonArray(catalogImagesFile(), [], static function (array $images, bool $wasEmpty) use ($id): array {
        validateStoredCatalogImages($images);
        foreach ($images as $index => $image) {
            if ($image['id'] === $id) {
                array_splice($images, $index, 1);
                return ['data' => $images, 'changed' => true, 'result' => $image];
            }
        }
        return ['data' => $images, 'changed' => false, 'result' => null];
    });

    if (!is_array($removed)) {
        return false;
    }
    $path = catalogImagesDirectory() . DIRECTORY_SEPARATOR . $removed['id'] . '.' . $removed['extension'];
    if (is_file($path) && !@unlink($path)) {
        error_log('Alitass API: catalog image could not be deleted: ' . $path);
    }
    return true;
}

function deleteUnreferencedCatalogImage(string $id): void
{
    findCatalogImage($id);
    if (catalogImageIsPubliclyReferenced($id)) {
        apiFail(409, 'Bu şəkil hələ məhsul və ya kateqoriya tərəfindən istifadə olunur.', ['image' => 'Əvvəlcə şəkli məhsuldan və ya kateqoriyadan silin.']);
    }
    if (!removeCatalogImageIfUnused($id)) {
        apiFail(404, 'Şəkil tapılmadı.');
    }
}

/** @return array<int, array<string, mixed>> */
function defaultProducts(): array
{
    return [
        ['id' => 1, 'icon' => 'toolbox', 'name' => 'Peşəkar alət çantası', 'price' => 29.9, 'category' => 'Əl alətləri', 'bg' => '#dcecff'],
        ['id' => 2, 'icon' => 'bolt', 'name' => 'Vint və bolt dəsti', 'price' => 5.5, 'category' => 'Xırdavat', 'bg' => '#ffe5b1'],
        ['id' => 3, 'icon' => 'saw', 'name' => 'Əl mişarı', 'price' => 14.9, 'category' => 'Əl alətləri', 'bg' => '#f8d8d8'],
        ['id' => 4, 'icon' => 'paint', 'name' => 'Akril boya dəsti', 'price' => 18.7, 'category' => 'Boya və kimya', 'bg' => '#d7efc7'],
        ['id' => 5, 'icon' => 'wrench', 'name' => 'Tənzimlənən açar', 'price' => 11.8, 'category' => 'Əl alətləri', 'bg' => '#ffe8bc'],
        ['id' => 6, 'icon' => 'lamp', 'name' => 'LED işıqlandırma', 'price' => 6.9, 'category' => 'İşıqlandırma', 'bg' => '#e8ddff'],
        ['id' => 7, 'icon' => 'brick', 'name' => 'Tikinti kərpici', 'price' => 0.8, 'category' => 'İnşaat materialları', 'bg' => '#d8efd4'],
        ['id' => 8, 'icon' => 'drill', 'name' => 'Elektrikli drel', 'price' => 69.9, 'category' => 'Elektrik alətləri', 'bg' => '#d9ecfb'],
    ];
}

/** @return array<int, array<string, mixed>> */
function defaultCategories(): array
{
    return [
        ['id' => 1, 'name' => 'Əl alətləri', 'bg' => '#ffd2c0', 'color' => '#ff6b2c', 'description' => 'Peşəkar və gündəlik əl alətləri.'],
        ['id' => 2, 'name' => 'Xırdavat', 'bg' => '#cfe8fa', 'color' => '#3986b5', 'description' => 'Vint, bolt və montaj üçün xırda ləvazimatlar.'],
        ['id' => 3, 'name' => 'Boya və kimya', 'bg' => '#ffe7a1', 'color' => '#c99400', 'description' => 'Boya, lak və köməkçi kimyəvi vasitələr.'],
        ['id' => 4, 'name' => 'İşıqlandırma', 'bg' => '#f5d2e5', 'color' => '#b45386', 'description' => 'İşıqlandırma və elektrik aksesuarları.'],
        ['id' => 5, 'name' => 'İnşaat materialları', 'bg' => '#d5edc7', 'color' => '#5d9b50', 'description' => 'Tikinti və təmir üçün əsas materiallar.'],
        ['id' => 6, 'name' => 'Elektrik alətləri', 'bg' => '#d9ecfb', 'color' => '#397ca6', 'description' => 'Elektriklə işləyən alətlər və avadanlıqlar.'],
    ];
}

function categoryNameKey(string $name): string
{
    return mb_strtolower(trim($name), 'UTF-8');
}

/** @param array<string, mixed> $product */
function validStoredProduct(array $product): bool
{
    return isset($product['id'], $product['icon'], $product['name'], $product['price'], $product['category'], $product['bg'])
        && is_int($product['id'])
        && $product['id'] > 0
        && is_string($product['icon'])
        && is_string($product['name'])
        && (is_int($product['price']) || is_float($product['price']))
        && is_string($product['category'])
        && is_string($product['bg'])
        && (!isset($product['description']) || is_string($product['description']))
        && (!isset($product['image']) || $product['image'] === null || (is_array($product['image']) && validStoredCatalogImage($product['image'])));
}

/** @param array<string, mixed> $category */
function validStoredCategory(array $category): bool
{
    return isset($category['id'], $category['name'], $category['bg'], $category['color'])
        && is_int($category['id'])
        && $category['id'] > 0
        && is_string($category['name'])
        && $category['name'] !== ''
        && is_string($category['bg'])
        && (bool) preg_match('/^#[a-f0-9]{6}$/', strtolower($category['bg']))
        && is_string($category['color'])
        && (bool) preg_match('/^#[a-f0-9]{6}$/', strtolower($category['color']))
        && (!isset($category['description']) || is_string($category['description']))
        && (!isset($category['image']) || $category['image'] === null || (is_array($category['image']) && validStoredCatalogImage($category['image'])));
}

/** @param array<int, mixed> $products */
function validateStoredProducts(array $products): void
{
    $ids = [];
    foreach ($products as $product) {
        if (!is_array($product) || !validStoredProduct($product) || isset($ids[$product['id']])) {
            apiFail(500, 'Məhsul məlumatlarının formatı düzgün deyil.');
        }
        $ids[$product['id']] = true;
    }
}

/** @param array<int, mixed> $categories */
function validateStoredCategories(array $categories): void
{
    $ids = [];
    $names = [];
    foreach ($categories as $category) {
        if (!is_array($category) || !validStoredCategory($category) || isset($ids[$category['id']])) {
            apiFail(500, 'Kateqoriya məlumatlarının formatı düzgün deyil.');
        }
        $nameKey = categoryNameKey($category['name']);
        if ($nameKey === '' || isset($names[$nameKey])) {
            apiFail(500, 'Kateqoriya adları təkrarlanmamalıdır.');
        }
        $ids[$category['id']] = true;
        $names[$nameKey] = true;
    }
}

/** @return array<int, array<string, mixed>> */
function storedProducts(): array
{
    /** @var array<int, array<string, mixed>> $products */
    $products = mutateJsonArray(productsFile(), defaultProducts(), static function (array $products, bool $wasEmpty): array {
        validateStoredProducts($products);
        return ['data' => $products, 'changed' => $wasEmpty, 'result' => $products];
    });
    return $products;
}

/** @return array<int, array<string, mixed>> */
function storedCategories(): array
{
    /** @var array<int, array<string, mixed>> $categories */
    $categories = mutateJsonArray(categoriesFile(), defaultCategories(), static function (array $categories, bool $wasEmpty): array {
        validateStoredCategories($categories);
        return ['data' => $categories, 'changed' => $wasEmpty, 'result' => $categories];
    });
    return $categories;
}

/** @param array<string, mixed> $record */
function storedCatalogImageId(array $record): string
{
    if (!isset($record['image']) || !is_array($record['image']) || !validStoredCatalogImage($record['image'])) {
        return '';
    }
    return $record['image']['id'];
}

/** @param array<string, mixed> $product
 * @return array<string, mixed>
 */
function productForResponse(array $product): array
{
    $image = isset($product['image']) && is_array($product['image']) && validStoredCatalogImage($product['image'])
        ? catalogImageForResponse($product['image'])
        : null;
    return [
        'id' => $product['id'],
        'icon' => $product['icon'],
        'name' => $product['name'],
        'price' => (float) $product['price'],
        'category' => $product['category'],
        'bg' => $product['bg'],
        'description' => stringValue($product['description'] ?? null),
        'image' => $image,
        'image_url' => $image['url'] ?? null,
    ];
}

/** @param array<string, mixed> $category
 * @return array<string, mixed>
 */
function categoryForResponse(array $category, int $productCount = 0): array
{
    $image = isset($category['image']) && is_array($category['image']) && validStoredCatalogImage($category['image'])
        ? catalogImageForResponse($category['image'])
        : null;
    return [
        'id' => $category['id'],
        'name' => $category['name'],
        'bg' => $category['bg'],
        'color' => $category['color'],
        'description' => stringValue($category['description'] ?? null),
        'image' => $image,
        'image_url' => $image['url'] ?? null,
        'product_count' => $productCount,
    ];
}

/** @return array<int, array<string, mixed>> */
function allProducts(): array
{
    return array_map(static fn (array $product): array => productForResponse($product), storedProducts());
}

/** @param array<int, array<string, mixed>> $products
 * @return array<string, int>
 */
function productCountsByCategory(array $products): array
{
    $counts = [];
    foreach ($products as $product) {
        $name = stringValue($product['category'] ?? null);
        if ($name === '') {
            continue;
        }
        $key = categoryNameKey($name);
        $counts[$key] = ($counts[$key] ?? 0) + 1;
    }
    return $counts;
}

/** @return array<string, mixed> */
function generatedCategory(int $id, string $name): array
{
    $palette = [
        ['#ffd2c0', '#ff6b2c'], ['#cfe8fa', '#3986b5'], ['#ffe7a1', '#c99400'],
        ['#d5edc7', '#5d9b50'], ['#f5d2e5', '#b45386'], ['#d9ecfb', '#397ca6'],
    ];
    $pair = $palette[($id - 1) % count($palette)];
    return ['id' => $id, 'name' => $name, 'bg' => $pair[0], 'color' => $pair[1], 'description' => ''];
}

/** @return array<int, array<string, mixed>> */
function allCategories(): array
{
    $products = storedProducts();
    $productNames = [];
    foreach ($products as $product) {
        $name = stringValue($product['category'] ?? null);
        if ($name !== '') {
            $productNames[categoryNameKey($name)] = $name;
        }
    }

    /** @var array<int, array<string, mixed>> $categories */
    $categories = mutateJsonArray(categoriesFile(), defaultCategories(), static function (array $categories, bool $wasEmpty) use ($productNames): array {
        validateStoredCategories($categories);
        $known = [];
        $largestId = 0;
        foreach ($categories as $category) {
            $known[categoryNameKey($category['name'])] = true;
            $largestId = max($largestId, $category['id']);
        }
        $changed = $wasEmpty;
        foreach ($productNames as $key => $name) {
            if (!isset($known[$key])) {
                if ($largestId >= PHP_INT_MAX) {
                    apiFail(500, 'Kateqoriya identifikatoru yaradıla bilmədi.');
                }
                $largestId++;
                $categories[] = generatedCategory($largestId, $name);
                $known[$key] = true;
                $changed = true;
            }
        }
        return ['data' => $categories, 'changed' => $changed, 'result' => $categories];
    });

    $counts = productCountsByCategory($products);
    return array_map(static fn (array $category): array => categoryForResponse($category, $counts[categoryNameKey($category['name'])] ?? 0), $categories);
}

function categoryExistsByName(string $name): bool
{
    return canonicalCategoryName($name) !== null;
}

function canonicalCategoryName(string $name): ?string
{
    $key = categoryNameKey($name);
    foreach (allCategories() as $category) {
        if (categoryNameKey((string) $category['name']) === $key) {
            return (string) $category['name'];
        }
    }
    return null;
}

/** @return array<string, mixed> */
function findStoredProduct(int $id): array
{
    foreach (storedProducts() as $product) {
        if ($product['id'] === $id) {
            return $product;
        }
    }
    apiFail(404, 'Məhsul tapılmadı.');
}

/** @return array<string, mixed> */
function findStoredCategory(int $id): array
{
    foreach (storedCategories() as $category) {
        if ($category['id'] === $id) {
            return $category;
        }
    }
    apiFail(404, 'Kateqoriya tapılmadı.');
}

function positiveId(mixed $value, string $field = 'id'): int
{
    if (is_int($value)) {
        $id = $value;
    } elseif (is_string($value) && preg_match('/^[1-9][0-9]*$/', $value)) {
        $id = (int) $value;
    } else {
        apiFail(422, ucfirst($field) . ' düzgün deyil.', [$field => 'Müsbət tam rəqəm olmalıdır.']);
    }

    if ($id < 1) {
        apiFail(422, ucfirst($field) . ' düzgün deyil.', [$field => 'Müsbət tam rəqəm olmalıdır.']);
    }
    return $id;
}

/** @param array<string, mixed> $input
 *  @param array<string, mixed>|null $existing
 *  @return array<string, mixed>
 */
function productFromInput(array $input, ?array $existing = null): array
{
    $name = stringValue($input['name'] ?? null);
    $category = stringValue($input['category'] ?? null);
    $icon = strtolower(stringValue($input['icon'] ?? null));
    $background = strtolower(stringValue($input['bg'] ?? '#e8f0ff'));
    $description = array_key_exists('description', $input)
        ? stringValue($input['description'])
        : stringValue($existing['description'] ?? null);
    $priceInput = $input['price'] ?? null;
    $errors = [];

    if ($name === '' || mb_strlen($name) > 150) {
        $errors['name'] = 'Məhsul adı 1–150 simvol olmalıdır.';
    }
    if ($category === '' || mb_strlen($category) > 100) {
        $errors['category'] = 'Kateqoriya 1–100 simvol olmalıdır.';
    }
    if ($icon === '' || !preg_match('/^[a-z][a-z0-9_-]{0,31}$/', $icon)) {
        $errors['icon'] = 'İkon yalnız kiçik hərf, rəqəm, tire və alt xətdən ibarət olmalıdır.';
    }
    if (!is_int($priceInput) && !is_float($priceInput) && !is_string($priceInput)) {
        $errors['price'] = 'Qiymət rəqəm olmalıdır.';
    } elseif (!is_numeric($priceInput) || !is_finite((float) $priceInput) || (float) $priceInput < 0 || (float) $priceInput > 99999999) {
        $errors['price'] = 'Qiymət 0 ilə 99.999.999 arasında olmalıdır.';
    }
    if (!preg_match('/^#[a-f0-9]{6}$/', $background)) {
        $errors['bg'] = 'Fon rəngi #RRGGBB formatında olmalıdır.';
    }
    if (mb_strlen($description) > 500) {
        $errors['description'] = 'Qısa açıqlama 500 simvoldan uzun olmamalıdır.';
    }
    if ($errors === []) {
        $canonicalCategory = canonicalCategoryName($category);
        if ($canonicalCategory === null) {
            $errors['category'] = 'Əvvəlcə bu adda kateqoriya yaradın və ya siyahıdan seçin.';
        } else {
            $category = $canonicalCategory;
        }
    }
    if ($errors !== []) {
        apiFail(422, 'Məhsul məlumatlarını yoxlayın.', $errors);
    }

    $existingImage = isset($existing['image']) && is_array($existing['image']) && validStoredCatalogImage($existing['image'])
        ? $existing['image']
        : null;
    $image = catalogImageFromInput($input, $existingImage);

    return [
        'icon' => $icon,
        'name' => $name,
        'price' => round((float) $priceInput, 2),
        'category' => $category,
        'bg' => $background,
        'description' => $description,
        'image' => $image,
    ];
}

/** @param array<string, mixed> $input
 *  @param array<string, mixed>|null $existing
 *  @return array<string, mixed>
 */
function categoryFromInput(array $input, ?array $existing = null): array
{
    $name = stringValue($input['name'] ?? null);
    $background = strtolower(stringValue($input['bg'] ?? $input['background'] ?? ($existing['bg'] ?? '#e8f0ff')));
    $color = strtolower(stringValue($input['color'] ?? $input['accent_color'] ?? ($existing['color'] ?? '#ff6b2c')));
    $description = array_key_exists('description', $input)
        ? stringValue($input['description'])
        : stringValue($existing['description'] ?? null);
    $errors = [];
    if ($name === '' || mb_strlen($name) > 100) {
        $errors['name'] = 'Kateqoriya adı 1–100 simvol olmalıdır.';
    }
    if (!preg_match('/^#[a-f0-9]{6}$/', $background)) {
        $errors['bg'] = 'Fon rəngi #RRGGBB formatında olmalıdır.';
    }
    if (!preg_match('/^#[a-f0-9]{6}$/', $color)) {
        $errors['color'] = 'Vurğu rəngi #RRGGBB formatında olmalıdır.';
    }
    if (mb_strlen($description) > 500) {
        $errors['description'] = 'Açıqlama 500 simvoldan uzun olmamalıdır.';
    }
    if ($errors !== []) {
        apiFail(422, 'Kateqoriya məlumatlarını yoxlayın.', $errors);
    }

    $existingImage = isset($existing['image']) && is_array($existing['image']) && validStoredCatalogImage($existing['image'])
        ? $existing['image']
        : null;
    $image = catalogImageFromInput($input, $existingImage);
    return [
        'name' => $name,
        'bg' => $background,
        'color' => $color,
        'description' => $description,
        'image' => $image,
    ];
}

/** @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function createProduct(array $input): array
{
    $newProduct = productFromInput($input);
    /** @var array<string, mixed> $created */
    $created = mutateJsonArray(productsFile(), defaultProducts(), static function (array $products, bool $wasEmpty) use ($newProduct): array {
        validateStoredProducts($products);
        $largestId = 0;
        foreach ($products as $product) {
            $largestId = max($largestId, $product['id']);
        }
        if ($largestId >= PHP_INT_MAX) {
            apiFail(500, 'Yeni məhsul üçün identifikator yaradıla bilmədi.');
        }
        $created = ['id' => $largestId + 1] + $newProduct;
        $products[] = $created;
        return ['data' => $products, 'changed' => true, 'result' => $created];
    });
    return productForResponse($created);
}

/** @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function updateProduct(int $id, array $input): array
{
    $existing = findStoredProduct($id);
    $replacement = productFromInput($input, $existing);
    /** @var array<string, mixed> $updated */
    $updated = mutateJsonArray(productsFile(), defaultProducts(), static function (array $products, bool $wasEmpty) use ($id, $replacement): array {
        validateStoredProducts($products);
        foreach ($products as $index => $product) {
            if ($product['id'] === $id) {
                $updated = ['id' => $id] + $replacement;
                $products[$index] = $updated;
                return ['data' => $products, 'changed' => true, 'result' => $updated];
            }
        }
        apiFail(404, 'Məhsul tapılmadı.');
    });
    $oldImageId = storedCatalogImageId($existing);
    if ($oldImageId !== '' && $oldImageId !== storedCatalogImageId($updated)) {
        removeCatalogImageIfUnused($oldImageId);
    }
    return productForResponse($updated);
}

function deleteProduct(int $id): void
{
    /** @var array<string, mixed> $deleted */
    $deleted = mutateJsonArray(productsFile(), defaultProducts(), static function (array $products, bool $wasEmpty) use ($id): array {
        validateStoredProducts($products);
        foreach ($products as $index => $product) {
            if ($product['id'] === $id) {
                array_splice($products, $index, 1);
                return ['data' => $products, 'changed' => true, 'result' => $product];
            }
        }
        apiFail(404, 'Məhsul tapılmadı.');
    });
    $imageId = storedCatalogImageId($deleted);
    if ($imageId !== '') {
        removeCatalogImageIfUnused($imageId);
    }
}

/** @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function createCategory(array $input): array
{
    allCategories();
    $newCategory = categoryFromInput($input);
    /** @var array<string, mixed> $created */
    $created = mutateJsonArray(categoriesFile(), defaultCategories(), static function (array $categories, bool $wasEmpty) use ($newCategory): array {
        validateStoredCategories($categories);
        $largestId = 0;
        $newKey = categoryNameKey($newCategory['name']);
        foreach ($categories as $category) {
            if (categoryNameKey($category['name']) === $newKey) {
                apiFail(409, 'Bu adda kateqoriya artıq mövcuddur.', ['name' => 'Fərqli kateqoriya adı yazın.']);
            }
            $largestId = max($largestId, $category['id']);
        }
        if ($largestId >= PHP_INT_MAX) {
            apiFail(500, 'Yeni kateqoriya üçün identifikator yaradıla bilmədi.');
        }
        $created = ['id' => $largestId + 1] + $newCategory;
        $categories[] = $created;
        return ['data' => $categories, 'changed' => true, 'result' => $created];
    });
    return categoryForResponse($created, 0);
}

function renameProductsCategory(string $oldName, string $newName): void
{
    if ($oldName === $newName) {
        return;
    }
    mutateJsonArray(productsFile(), defaultProducts(), static function (array $products, bool $wasEmpty) use ($oldName, $newName): array {
        validateStoredProducts($products);
        $changed = false;
        foreach ($products as $index => $product) {
            if ($product['category'] === $oldName) {
                $products[$index]['category'] = $newName;
                $changed = true;
            }
        }
        return ['data' => $products, 'changed' => $changed || $wasEmpty, 'result' => null];
    });
}

/** @param array<string, mixed> $input
 * @return array<string, mixed>
 */
function updateCategory(int $id, array $input): array
{
    allCategories();
    $existing = findStoredCategory($id);
    $replacement = categoryFromInput($input, $existing);
    /** @var array<string, mixed> $updated */
    $updated = mutateJsonArray(categoriesFile(), defaultCategories(), static function (array $categories, bool $wasEmpty) use ($id, $replacement): array {
        validateStoredCategories($categories);
        $replacementKey = categoryNameKey($replacement['name']);
        foreach ($categories as $index => $category) {
            if ($category['id'] !== $id && categoryNameKey($category['name']) === $replacementKey) {
                apiFail(409, 'Bu adda kateqoriya artıq mövcuddur.', ['name' => 'Fərqli kateqoriya adı yazın.']);
            }
            if ($category['id'] === $id) {
                $updated = ['id' => $id] + $replacement;
                $categories[$index] = $updated;
                return ['data' => $categories, 'changed' => true, 'result' => $updated];
            }
        }
        apiFail(404, 'Kateqoriya tapılmadı.');
    });
    renameProductsCategory($existing['name'], $updated['name']);
    $oldImageId = storedCatalogImageId($existing);
    if ($oldImageId !== '' && $oldImageId !== storedCatalogImageId($updated)) {
        removeCatalogImageIfUnused($oldImageId);
    }
    $count = 0;
    foreach (storedProducts() as $product) {
        if ($product['category'] === $updated['name']) {
            $count++;
        }
    }
    return categoryForResponse($updated, $count);
}

function deleteCategory(int $id): void
{
    allCategories();
    $category = findStoredCategory($id);
    $inUse = 0;
    foreach (storedProducts() as $product) {
        if ($product['category'] === $category['name']) {
            $inUse++;
        }
    }
    if ($inUse > 0) {
        apiFail(409, 'Bu kateqoriyada məhsullar var; əvvəlcə onları başqa kateqoriyaya köçürün.', ['products' => (string) $inUse]);
    }

    mutateJsonArray(categoriesFile(), defaultCategories(), static function (array $categories, bool $wasEmpty) use ($id): array {
        validateStoredCategories($categories);
        foreach ($categories as $index => $storedCategory) {
            if ($storedCategory['id'] === $id) {
                array_splice($categories, $index, 1);
                return ['data' => $categories, 'changed' => true, 'result' => null];
            }
        }
        apiFail(404, 'Kateqoriya tapılmadı.');
    });
    $imageId = storedCatalogImageId($category);
    if ($imageId !== '') {
        removeCatalogImageIfUnused($imageId);
    }
}

/** @param array<string, mixed> $attachment */
function validAttachment(array $attachment): bool
{
    return isset($attachment['id'], $attachment['name'], $attachment['extension'], $attachment['size'])
        && is_string($attachment['id'])
        && preg_match('/^[a-f0-9]{32}$/', $attachment['id'])
        && is_string($attachment['name'])
        && is_string($attachment['extension'])
        && in_array(strtolower($attachment['extension']), ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp', 'dwg'], true)
        && is_int($attachment['size']);
}

/** @param array<string, mixed> $message
 * @return array<string, mixed>
 */
function messageForAdmin(array $message): array
{
    $attachment = null;
    if (isset($message['attachment']) && is_array($message['attachment']) && validAttachment($message['attachment'])) {
        $attachment = [
            'name' => $message['attachment']['name'],
            'extension' => strtolower($message['attachment']['extension']),
            'size' => $message['attachment']['size'],
            'download_url' => 'api/admin.php?action=attachment&id=' . rawurlencode((string) ($message['id'] ?? '')),
        ];
    }

    return [
        'id' => stringValue($message['id'] ?? null),
        'created_at' => stringValue($message['created_at'] ?? null),
        'full_name' => stringValue($message['full_name'] ?? null),
        'phone' => stringValue($message['phone'] ?? null),
        'company' => stringValue($message['company'] ?? null),
        'message' => stringValue($message['message'] ?? null),
        'attachment' => $attachment,
    ];
}

/** @return array<int, array<string, mixed>> */
function allMessagesForAdmin(): array
{
    /** @var array<int, array<string, mixed>> $messages */
    $messages = mutateJsonArray(messagesFile(), [], static function (array $messages, bool $wasEmpty): array {
        $publicMessages = [];
        foreach ($messages as $message) {
            if (!is_array($message)) {
                apiFail(500, 'Mesaj məlumatlarının formatı düzgün deyil.');
            }
            $publicMessages[] = messageForAdmin($message);
        }
        return ['data' => $messages, 'changed' => false, 'result' => $publicMessages];
    });
    return $messages;
}

/** @return array<string, mixed> */
function deleteMessage(string $id): array
{
    if (!preg_match('/^[a-f0-9]{24}$/', $id)) {
        apiFail(422, 'Mesaj identifikatoru düzgün deyil.', ['id' => 'Düzgün mesaj identifikatoru göndərin.']);
    }

    /** @var array<string, mixed> $deleted */
    $deleted = mutateJsonArray(messagesFile(), [], static function (array $messages, bool $wasEmpty) use ($id): array {
        foreach ($messages as $index => $message) {
            if (is_array($message) && ($message['id'] ?? null) === $id) {
                array_splice($messages, $index, 1);
                return ['data' => $messages, 'changed' => true, 'result' => $message];
            }
        }
        apiFail(404, 'Mesaj tapılmadı.');
    });

    if (isset($deleted['attachment']) && is_array($deleted['attachment']) && validAttachment($deleted['attachment'])) {
        deleteAttachmentFile($deleted['attachment']);
    }
    return $deleted;
}

/** @return array<string, mixed> */
function findMessage(string $id): array
{
    if (!preg_match('/^[a-f0-9]{24}$/', $id)) {
        apiFail(422, 'Mesaj identifikatoru düzgün deyil.', ['id' => 'Düzgün mesaj identifikatoru göndərin.']);
    }

    /** @var array<string, mixed> $found */
    $found = mutateJsonArray(messagesFile(), [], static function (array $messages, bool $wasEmpty) use ($id): array {
        foreach ($messages as $message) {
            if (is_array($message) && ($message['id'] ?? null) === $id) {
                return ['data' => $messages, 'changed' => false, 'result' => $message];
            }
        }
        apiFail(404, 'Mesaj tapılmadı.');
    });
    return $found;
}

/** @param array<string, mixed> $attachment */
function attachmentPath(array $attachment): string
{
    if (!validAttachment($attachment)) {
        apiFail(404, 'Fayl tapılmadı.');
    }

    $directory = uploadsDirectory();
    $path = $directory . DIRECTORY_SEPARATOR . $attachment['id'] . '.' . strtolower($attachment['extension']);
    $directoryReal = realpath($directory);
    $pathReal = realpath($path);
    if ($directoryReal === false || $pathReal === false || !is_file($pathReal)) {
        apiFail(404, 'Fayl tapılmadı.');
    }

    $prefix = rtrim($directoryReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if (strncmp($pathReal, $prefix, strlen($prefix)) !== 0) {
        apiFail(404, 'Fayl tapılmadı.');
    }
    return $pathReal;
}

/** @param array<string, mixed> $attachment */
function deleteAttachmentFile(array $attachment): void
{
    if (!validAttachment($attachment)) {
        return;
    }

    // The ID and extension have already been strictly validated, so the
    // candidate stays inside uploads even if the original name is malicious.
    $directory = realpath(uploadsDirectory());
    if ($directory === false) {
        return;
    }
    $path = $directory . DIRECTORY_SEPARATOR . $attachment['id'] . '.' . strtolower($attachment['extension']);
    if (is_file($path) && !unlink($path)) {
        error_log('Alitass API: attachment could not be deleted: ' . $path);
    }
}

/** @param array<string, mixed> $message */
function downloadAttachment(array $message): never
{
    if (!isset($message['attachment']) || !is_array($message['attachment'])) {
        apiFail(404, 'Bu mesaj üçün fayl yoxdur.');
    }

    $attachment = $message['attachment'];
    $path = attachmentPath($attachment);
    $extension = strtolower((string) $attachment['extension']);
    $types = [
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'dwg' => 'application/acad',
    ];
    $filename = (string) $attachment['name'];
    $fallbackName = preg_replace('/[^A-Za-z0-9._-]/', '_', $filename) ?: 'attachment.' . $extension;

    header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
    header('Content-Length: ' . (string) filesize($path));
    header('Content-Disposition: attachment; filename="' . $fallbackName . '"; filename*=UTF-8\'\'' . rawurlencode($filename));
    header('Cache-Control: private, no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}
