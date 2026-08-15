(() => {
  const getJson = endpoint => fetch(endpoint, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  }).then(response => response.ok ? response.json() : null).catch(() => null);

  getJson('api/products.php').then(payload => {
    const products = Array.isArray(payload) ? payload : payload?.products ?? payload?.data;
    if (Array.isArray(products) && typeof window.setProductsFromServer === 'function') {
      window.setProductsFromServer(products);
    }

    const categories = Array.isArray(payload) ? null : payload?.categories ?? payload?.category_list;
    if (Array.isArray(categories) && typeof window.setCategoriesFromServer === 'function') {
      window.setCategoriesFromServer(categories);
    }
  });

  // Kateqoriyalar ayrıca endpoint ilə verilirsə, şəkil və açıqlamalar da avtomatik gəlir.
  getJson('api/categories.php').then(payload => {
    const categories = Array.isArray(payload) ? payload : payload?.categories ?? payload?.data;
    if (Array.isArray(categories) && typeof window.setCategoriesFromServer === 'function') {
      window.setCategoriesFromServer(categories);
    }
  });
})();
