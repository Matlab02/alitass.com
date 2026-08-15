<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

/** @return array<string, mixed> */
function adminPayload(): array
{
    return jsonBody();
}

function adminAction(): string
{
    return strtolower(trim((string) ($_GET['action'] ?? 'status')));
}

runApi(static function (): never {
    $action = adminAction();

    if ($action === 'status') {
        requireMethod('GET');
        $authenticated = isAdminAuthenticated();
        respondJson(200, [
            'ok' => true,
            'authenticated' => $authenticated,
            'user' => $authenticated ? ALITASS_ADMIN_USERNAME : null,
            'csrf_token' => $authenticated ? csrfToken() : null,
        ]);
    }

    if ($action === 'login') {
        requireMethod('POST');
        startAdminSession();
        $payload = adminPayload();
        $username = stringValue($payload['username'] ?? null);
        $password = is_string($payload['password'] ?? null) ? (string) $payload['password'] : '';

        // Keep a short delay and generic error to avoid an inexpensive credential oracle.
        $valid = hash_equals(ALITASS_ADMIN_USERNAME, $username)
            && password_verify($password, ALITASS_ADMIN_PASSWORD_HASH);
        if (!$valid) {
            usleep(250000);
            apiFail(401, 'Giriş adı və ya parol düzgün deyil.');
        }

        session_regenerate_id(true);
        $_SESSION['admin_user'] = ALITASS_ADMIN_USERNAME;
        $_SESSION['last_activity'] = time();
        $_SESSION['csrf_token'] = createCsrfToken();
        respondJson(200, [
            'ok' => true,
            'authenticated' => true,
            'user' => ALITASS_ADMIN_USERNAME,
            'csrf_token' => $_SESSION['csrf_token'],
        ]);
    }

    if ($action === 'logout') {
        requireMethod('POST');
        $payload = adminPayload();
        requireCsrf($payload);
        endAdminSession();
        respondJson(200, ['ok' => true, 'authenticated' => false]);
    }

    if ($action === 'upload') {
        requireMethod('POST');
        // Multipart requests do not have a JSON body; the CSRF helper also
        // reads the X-CSRF-Token header used by the admin interface.
        requireCsrf([]);
        $image = storeUploadedCatalogImage(stringValue($_POST['scope'] ?? null));
        $publicImage = catalogImageForResponse($image);
        respondJson(201, [
            'ok' => true,
            'image' => $publicImage,
            'image_url' => $publicImage['url'],
        ]);
    }

    if ($action === 'delete-upload') {
        requireMethod('POST');
        $payload = adminPayload();
        requireCsrf($payload);
        $id = stringValue($payload['image_id'] ?? $payload['id'] ?? null);
        deleteUnreferencedCatalogImage($id);
        respondJson(200, ['ok' => true, 'deleted_id' => $id]);
    }

    if ($action === 'products') {
        if (requestMethod() === 'GET') {
            requireAdmin();
            respondJson(200, ['ok' => true, 'products' => allProducts()]);
        }

        $payload = adminPayload();
        requireCsrf($payload);
        if (requestMethod() === 'POST') {
            respondJson(201, ['ok' => true, 'product' => createProduct($payload)]);
        }
        if (requestMethod() === 'PUT') {
            $id = positiveId($_GET['id'] ?? $payload['id'] ?? null);
            respondJson(200, ['ok' => true, 'product' => updateProduct($id, $payload)]);
        }
        if (requestMethod() === 'DELETE') {
            $id = positiveId($_GET['id'] ?? $payload['id'] ?? null);
            deleteProduct($id);
            respondJson(200, ['ok' => true, 'deleted_id' => $id]);
        }
        requireMethod('POST', 'PUT', 'DELETE');
    }

    if ($action === 'categories') {
        if (requestMethod() === 'GET') {
            requireAdmin();
            $categories = allCategories();
            respondJson(200, ['ok' => true, 'categories' => $categories, 'count' => count($categories)]);
        }

        $payload = adminPayload();
        requireCsrf($payload);
        if (requestMethod() === 'POST') {
            respondJson(201, ['ok' => true, 'category' => createCategory($payload)]);
        }
        if (requestMethod() === 'PUT') {
            $id = positiveId($_GET['id'] ?? $payload['id'] ?? null, 'category');
            respondJson(200, ['ok' => true, 'category' => updateCategory($id, $payload)]);
        }
        if (requestMethod() === 'DELETE') {
            $id = positiveId($_GET['id'] ?? $payload['id'] ?? null, 'category');
            deleteCategory($id);
            respondJson(200, ['ok' => true, 'deleted_id' => $id]);
        }
        requireMethod('POST', 'PUT', 'DELETE');
    }

    if ($action === 'messages') {
        if (requestMethod() === 'GET') {
            requireAdmin();
            $messages = allMessagesForAdmin();
            respondJson(200, ['ok' => true, 'messages' => $messages, 'count' => count($messages)]);
        }

        $payload = adminPayload();
        requireCsrf($payload);
        if (requestMethod() === 'DELETE') {
            $id = stringValue($_GET['id'] ?? $payload['id'] ?? null);
            deleteMessage($id);
            respondJson(200, ['ok' => true, 'deleted_id' => $id]);
        }
        requireMethod('DELETE');
    }

    if ($action === 'attachment') {
        requireMethod('GET');
        requireAdmin();
        $id = stringValue($_GET['id'] ?? null);
        downloadAttachment(findMessage($id));
    }

    apiFail(404, 'API əməliyyatı tapılmadı.');
});
