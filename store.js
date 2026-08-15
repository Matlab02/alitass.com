const defaultProducts = [
  { id: 1, icon: 'toolbox', name: 'Peşəkar alət çantası', price: 29.9, category: 'Əl alətləri', bg: '#dcecff', description: '' },
  { id: 2, icon: 'bolt', name: 'Vint və bolt dəsti', price: 5.5, category: 'Xırdavat', bg: '#ffe5b1', description: '' },
  { id: 3, icon: 'saw', name: 'Əl mişarı', price: 14.9, category: 'Əl alətləri', bg: '#f8d8d8', description: '' },
  { id: 4, icon: 'paint', name: 'Akril boya dəsti', price: 18.7, category: 'Boya və kimya', bg: '#d7efc7', description: '' },
  { id: 5, icon: 'wrench', name: 'Tənzimlənən açar', price: 11.8, category: 'Əl alətləri', bg: '#ffe8bc', description: '' },
  { id: 6, icon: 'lamp', name: 'LED işıqlandırma', price: 6.9, category: 'İşıqlandırma', bg: '#e8ddff', description: '' },
  { id: 7, icon: 'brick', name: 'Tikinti kərpici', price: 0.8, category: 'İnşaat materialları', bg: '#d8efd4', description: '' },
  { id: 8, icon: 'drill', name: 'Elektrikli drel', price: 69.9, category: 'Elektrik alətləri', bg: '#d9ecfb', description: '' }
];

const iconPaths = {
  toolbox: '<path d="M4 9h16v10H4zM9 9V6h6v3M4 13h16M10 13h4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 10-14h-7z"/>',
  saw: '<path d="m3 17 13-13 5 5-13 13-5-5Zm4 0 2 2m1-5 2 2m1-5 2 2"/>',
  paint: '<path d="M6 4h12v5H6zM8 9v11h8V9M6 4l2-2h8l2 2"/>',
  wrench: '<path d="M14 5a5 5 0 0 0-6 6L3 16l5 5 5-5a5 5 0 0 0 6-6l-3 3-3-3 3-3Z"/>',
  lamp: '<path d="M9 18h6M10 21h4M8 14c-2-2-2-4-2-5a6 6 0 1 1 12 0c0 2-1 4-2 5v2H8z"/>',
  brick: '<path d="M3 5h18v14H3zM3 10h18M8 5v5m8 0v5M5 15h5m4 0h5"/>',
  drill: '<path d="M3 10h10l3-3 5 3-3 3v4h-5v-4H8v5H5v-5H3zM18 10l3-3"/>'
};

const localAssetByIcon = {
  drill: 'drill', toolbox: 'toolbox', bolt: 'bricks', saw: 'bricks',
  paint: 'helmet', wrench: 'toolbox', lamp: 'helmet', brick: 'bricks'
};

const categoryPalette = ['orange', 'blue', 'yellow', 'green', 'pink'];
let remoteProducts = null;
let remoteCategories = null;
let activeCategory = new URLSearchParams(window.location.search).get('category') || '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const toText = value => typeof value === 'string' ? value.trim() : '';
const get = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
};
const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const money = value => `${(Number(value) || 0).toFixed(2).replace('.', ',')} ₼`;

function safeMediaUrl(value) {
  const source = toText(value);
  if (!source) return '';
  try {
    const url = new URL(source, document.baseURI);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function validColor(value, fallback = '#e8f0ff') {
  const color = toText(value).toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : fallback;
}

function mediaValue(source) {
  if (!source || typeof source !== 'object') return '';
  return safeMediaUrl(source.image_url || source.imageUrl || source.image || source.photo_url || source.photoUrl || source.photo || source.thumbnail_url || source.thumbnailUrl || source.thumbnail || source.picture);
}

function nameValue(source, fallback = '') {
  if (!source || typeof source !== 'object') return fallback;
  return toText(source.name || source.title || source.label || source.category_name || source.category) || fallback;
}

function iconValue(source, fallback = 'toolbox') {
  if (!source || typeof source !== 'object') return fallback;
  const icon = toText(source.icon || source.emoji || source.symbol).toLowerCase();
  return iconPaths[icon] ? icon : fallback;
}

function categoryFromProduct(product) {
  return product && typeof product.category === 'object' ? product.category : null;
}

function normalizeProduct(raw, fallbackId = 0) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const categoryData = categoryFromProduct(source);
  const id = Number(source.id ?? source.product_id ?? fallbackId);
  const icon = iconValue(source);
  const category = typeof source.category === 'string'
    ? toText(source.category)
    : nameValue(categoryData, toText(source.category_name) || 'Digər');

  return {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    name: nameValue(source, 'Adsız məhsul'),
    category: category || 'Digər',
    price: Number(source.price ?? source.amount ?? source.sale_price ?? 0) || 0,
    icon,
    bg: validColor(source.bg || source.background || source.background_color),
    description: toText(source.description || source.details || source.short_description || source.excerpt),
    image: mediaValue(source),
    categoryImage: safeMediaUrl(source.category_image_url || source.categoryImageUrl || source.category_image || source.categoryImage) || mediaValue(categoryData),
    categoryIcon: iconValue(categoryData, icon),
    categoryDescription: toText(source.category_description || source.categoryDescription || categoryData?.description || categoryData?.details)
  };
}

function normalizeCategory(raw, index = 0) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const count = Number(source.product_count ?? source.products_count ?? source.productCount ?? source.count ?? source.items_count);
  return {
    name: nameValue(source, 'Digər'),
    description: toText(source.description || source.details || source.short_description),
    image: mediaValue(source),
    icon: iconValue(source, ''),
    bg: validColor(source.bg || source.background || source.background_color, ''),
    productCount: Number.isFinite(count) && count >= 0 ? count : null,
    palette: categoryPalette[index % categoryPalette.length]
  };
}

function localProductImage(icon) {
  const asset = localAssetByIcon[icon];
  return asset ? `assets/products/${asset}.webp` : '';
}

function localCategoryImage(icon) {
  const asset = localAssetByIcon[icon];
  return asset ? `assets/categories/${asset}.webp` : '';
}

function toolIcon(icon = 'toolbox') {
  const path = iconPaths[icon] || iconPaths.toolbox;
  return `<svg class="product-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function imageMarkup({ image, icon, name }, type) {
  const fallback = `<span class="image-fallback ${type}-fallback"${image ? ' hidden' : ''} aria-hidden="true">${toolIcon(icon)}</span>`;
  if (!image) return fallback;
  return `<img class="${type}-photo" src="${esc(image)}" alt="${esc(name)}" loading="lazy">${fallback}`;
}

function productVisual(product, type = 'product') {
  return imageMarkup({
    image: product.image || safeMediaUrl(localProductImage(product.icon)),
    icon: product.icon,
    name: product.name
  }, type);
}

function categoryVisual(category, type = 'category') {
  return imageMarkup({
    image: category.image || safeMediaUrl(localCategoryImage(category.icon)),
    icon: category.icon,
    name: category.name
  }, type);
}

function products() {
  const source = remoteProducts || get('alitass-products-v2', defaultProducts);
  return Array.isArray(source) ? source.map((product, index) => normalizeProduct(product, index + 1)) : defaultProducts.map(normalizeProduct);
}

function derivedCategories() {
  const grouped = new Map();
  products().forEach(product => {
    const key = product.category;
    const current = grouped.get(key) || {
      name: key,
      description: product.categoryDescription,
      image: product.categoryImage,
      icon: product.categoryIcon || product.icon,
      bg: '',
      productCount: 0,
      palette: categoryPalette[grouped.size % categoryPalette.length]
    };
    current.productCount += 1;
    if (!current.image && product.categoryImage) current.image = product.categoryImage;
    if (!current.description && product.categoryDescription) current.description = product.categoryDescription;
    if (!current.icon && product.icon) current.icon = product.icon;
    grouped.set(key, current);
  });
  return [...grouped.values()];
}

function categories() {
  const source = remoteCategories || derivedCategories();
  return source.map((category, index) => {
    const normalized = normalizeCategory(category, index);
    const matching = products().filter(product => product.category === normalized.name);
    const representative = matching[0];
    return {
      ...normalized,
      image: normalized.image || representative?.categoryImage || '',
      icon: normalized.icon || representative?.categoryIcon || representative?.icon || 'toolbox',
      description: normalized.description || representative?.categoryDescription || '',
      productCount: normalized.productCount === null ? matching.length : normalized.productCount,
      palette: normalized.palette || categoryPalette[index % categoryPalette.length]
    };
  });
}

function categoryUrl(name) {
  return `products.html?category=${encodeURIComponent(name)}`;
}

function productCards(target, items = products()) {
  if (!target) return;
  target.innerHTML = items.map(product => {
    const description = product.description ? `<p class="product-description">${esc(product.description)}</p>` : '';
    return `<article class="product">
      <a href="product.html?id=${product.id}" class="product-art" style="background:${esc(product.bg)}" aria-label="${esc(product.name)}">${productVisual(product)}</a>
      <div class="product-info"><small>${esc(product.category)}</small><h3>${esc(product.name)}</h3>${description}
        <div class="product-bottom"><span>${money(product.price)}</span><button type="button" onclick="window.addCart(${product.id})" aria-label="${esc(product.name)} məhsulunu səbətə əlavə et">+</button></div>
      </div>
    </article>`;
  }).join('') || '<p class="catalog-empty">Bu kateqoriyada hələ məhsul yoxdur.</p>';
}

function filteredProducts() {
  return activeCategory ? products().filter(product => product.category === activeCategory) : products();
}

function renderProducts() {
  productCards(document.querySelector('#allProducts'), filteredProducts());
  productCards(document.querySelector('#productsGrid'), products().slice(0, 4));
  const count = document.querySelector('#count');
  if (count) count.textContent = `${filteredProducts().length} məhsul`;
}

function renderHomeCategories() {
  const target = document.querySelector('#categoriesGrid');
  if (!target) return;
  target.innerHTML = categories().slice(0, 5).map(category => `
    <a class="category ${category.palette}" href="${categoryUrl(category.name)}"${category.bg ? ` style="background:${esc(category.bg)}"` : ''}>
      <span class="category-media">${categoryVisual(category)}</span>
      <b>${esc(category.name)}</b><small>${category.productCount} məhsul</small>
    </a>`).join('');
}

function renderCategoryList() {
  const target = document.querySelector('#categoryList');
  if (!target) return;
  target.innerHTML = categories().map(category => {
    const description = category.description || `${category.productCount} məhsul mövcuddur`;
    return `<a href="${categoryUrl(category.name)}" class="cat-row">
      <span class="category-row-media">${categoryVisual(category, 'category-row')}</span>
      <div><b>${esc(category.name)}</b><small>${esc(description)}</small></div><i aria-hidden="true">→</i>
    </a>`;
  }).join('') || '<p class="catalog-empty">Kateqoriya tapılmadı.</p>';
}

function renderCategoryFilters() {
  const target = document.querySelector('#productCategoryFilters');
  if (!target) return;
  target.innerHTML = categories().map(category => `<label><input type="checkbox" value="${esc(category.name)}"${activeCategory === category.name ? ' checked' : ''}> ${esc(category.name)}</label>`).join('');
  if (target.dataset.bound) return;
  target.dataset.bound = 'true';
  target.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    activeCategory = input.checked ? input.value : '';
    target.querySelectorAll('input[type="checkbox"]').forEach(box => { if (box !== input) box.checked = false; });
    renderProducts();
  });
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  window.setTimeout(() => element.classList.remove('show'), 2200);
}

function addCart(id) {
  const cart = get('alitass-cart', []);
  cart.push(Number(id));
  set('alitass-cart', cart);
  toast('Səbətə əlavə olundu! 🧡');
}

function renderCart() {
  const element = document.querySelector('#cartItems');
  if (!element) return;
  const cart = get('alitass-cart', []);
  const allProducts = products();
  const items = cart.map(id => allProducts.find(product => String(product.id) === String(id))).filter(Boolean);
  const total = items.reduce((sum, product) => sum + Number(product.price), 0);
  element.innerHTML = items.length ? items.map((product, index) => `<div class="cart-item">
    <span class="icon">${toolIcon(product.icon)}</span><div><h3>${esc(product.name)}</h3><small>${esc(product.category)}</small></div><b>${money(product.price)}</b>
    <button type="button" onclick="window.removeCart(${index})" aria-label="Məhsulu səbətdən sil">✕</button>
  </div>`).join('') : '<div class="cart-item"><div><h3>Səbətin hələ boşdur 🐰</h3><small>Məhsullara baxıb sevdiyini əlavə et.</small><p><a class="primary" href="products.html">Məhsullara bax</a></p></div></div>';
  const totalElement = document.querySelector('#total');
  const grandElement = document.querySelector('#grand');
  if (totalElement) totalElement.textContent = money(total);
  if (grandElement) grandElement.textContent = money(total);
}

function renderProductDetail(target) {
  if (!target) return;
  const requestedId = new URLSearchParams(window.location.search).get('id');
  const product = products().find(item => String(item.id) === String(requestedId)) || products()[0];
  if (!product) return;
  document.title = `${product.name} — Alitass`;
  const description = product.description || 'Keyfiyyətli, rahat və layihələriniz üçün ideal seçim.';
  target.innerHTML = `<div class="detail-art" style="background:${esc(product.bg)}">${productVisual(product, 'detail')}</div>
    <div><span class="eyebrow">${esc(product.category)}</span><h1 class="page-title">${esc(product.name)}</h1>
    <p class="intro product-detail-description">${esc(description)}</p><h2>${money(product.price)}</h2>
    <button type="button" class="primary" onclick="window.addCart(${product.id})">Səbətə əlavə et →</button>
    <div class="delivery">🚚 <b>Rahat çatdırılma</b><small> Bakı və ətrafına sürətli çatdırılma</small><br>🧡 <b>Qapıda ödəniş</b><small> Kartla ödəniş tələb olunmur</small></div></div>`;
}

function refreshCatalog() {
  renderProducts();
  renderHomeCategories();
  renderCategoryList();
  renderCategoryFilters();
  renderCart();
  document.dispatchEvent(new CustomEvent('alitass-products-ready'));
  document.dispatchEvent(new CustomEvent('alitass-categories-ready'));
}

window.setProductsFromServer = list => {
  if (!Array.isArray(list)) return;
  remoteProducts = list.map((product, index) => normalizeProduct(product, index + 1));
  refreshCatalog();
};

window.setCategoriesFromServer = list => {
  if (!Array.isArray(list)) return;
  remoteCategories = list.map(normalizeCategory).filter(category => category.name);
  refreshCatalog();
};

window.addCart = addCart;
window.removeCart = index => {
  const cart = get('alitass-cart', []);
  cart.splice(Number(index), 1);
  set('alitass-cart', cart);
  renderCart();
};
window.products = products;
window.categories = categories;
window.money = money;
window.toolIcon = toolIcon;
window.renderProductDetail = renderProductDetail;

document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches('.product-photo, .detail-photo, .category-photo, .category-row-photo')) return;
  image.hidden = true;
  const fallback = image.nextElementSibling;
  if (fallback instanceof HTMLElement && fallback.classList.contains('image-fallback')) fallback.hidden = false;
}, true);

renderProducts();
renderHomeCategories();
renderCategoryList();
renderCategoryFilters();
renderCart();
