<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

runApi(static function (): never {
    requireMethod('GET');
    respondJson(200, [
        'ok' => true,
        'products' => allProducts(),
        'categories' => allCategories(),
    ]);
});
