<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

/**
 * Public catalog artwork delivery.
 *
 * Files themselves are not kept under public_html.  The image registry and
 * current catalog records are checked before a file is streamed, so an unused
 * or guessed upload ID cannot be retrieved from the web.
 */
runApi(static function (): never {
    requireMethod('GET');
    $id = stringValue($_GET['id'] ?? null);
    $image = findCatalogImage($id);
    // A saved catalog image is public.  A just-uploaded but not-yet-saved
    // image remains available only to the authenticated admin, which also
    // makes the returned upload URL useful for the in-panel preview.
    if (!catalogImageIsPubliclyReferenced($id)) {
        requireAdmin();
    }
    $path = catalogImagePath($image);

    header('Content-Type: ' . $image['mime']);
    header('Content-Length: ' . (string) filesize($path));
    header('Content-Disposition: inline; filename="catalog-' . $image['id'] . '.' . $image['extension'] . '"');
    header('Cache-Control: public, max-age=86400, immutable');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
});
