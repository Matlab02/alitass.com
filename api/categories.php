<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// Public category data used by the storefront's category cards.
runApi(static function (): never {
    requireMethod('GET');
    $categories = allCategories();
    respondJson(200, [
        'ok' => true,
        'categories' => $categories,
        'count' => count($categories),
    ]);
});
