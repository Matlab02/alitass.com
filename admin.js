(() => {
  'use strict';

  const API_URL = 'api/admin.php';
  const state = {
    csrf: '',
    products: [],
    categories: [],
    messages: [],
    activeView: 'dashboard',
    activeMessageId: null,
    loading: false,
  };

  const mediaState = {
    product: { existing: null, uploaded: null, file: null, previewUrl: '', removed: false },
    category: { existing: null, uploaded: null, file: null, previewUrl: '', removed: false },
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const dom = {
    bootLoader: $('#bootLoader'),
    loginView: $('#loginView'),
    loginForm: $('#loginForm'),
    loginUsername: $('#loginUsername'),
    loginPassword: $('#loginPassword'),
    passwordToggle: $('#passwordToggle'),
    loginError: $('#loginError'),
    loginSubmit: $('#loginSubmit'),
    adminApp: $('#adminApp'),
    sidebar: $('#sidebar'),
    sidebarBackdrop: $('#sidebarBackdrop'),
    menuToggle: $('#menuToggle'),
    sidebarClose: $('#sidebarClose'),
    breadcrumb: $('#breadcrumbCurrent'),
    refreshButton: $('#refreshButton'),
    syncStatus: $('#syncStatus'),
    logoutButton: $('#logoutButton'),
    dashboardDate: $('#dashboardDate'),
    statProducts: $('#statProducts'),
    statMessages: $('#statMessages'),
    statToday: $('#statToday'),
    statProductsHint: $('#statProductsHint'),
    statMessagesHint: $('#statMessagesHint'),
    statTodayHint: $('#statTodayHint'),
    navProductsCount: $('#navProductsCount'),
    navCategoriesCount: $('#navCategoriesCount'),
    navMessagesCount: $('#navMessagesCount'),
    recentMessages: $('#recentMessages'),
    productSearch: $('#productSearch'),
    productCategoryFilter: $('#productCategoryFilter'),
    productTableCount: $('#productTableCount'),
    productsTable: $('#productsTable'),
    productsEmpty: $('#productsEmpty'),
    clearProductFilters: $('#clearProductFilters'),
    categorySearch: $('#categorySearch'),
    categoryGrid: $('#categoryGrid'),
    categoryCount: $('#categoryCount'),
    categoriesEmpty: $('#categoriesEmpty'),
    newCategoryButton: $('#newCategoryButton'),
    newCategoryEmptyButton: $('#newCategoryEmptyButton'),
    messageSearch: $('#messageSearch'),
    messageList: $('#messageList'),
    messagesEmpty: $('#messagesEmpty'),
    messagesTotal: $('#messagesTotal'),
    messageDetail: $('#messageDetail'),
    productModal: $('#productModal'),
    productForm: $('#productForm'),
    productId: $('#productId'),
    productName: $('#productName'),
    productCategory: $('#productCategory'),
    productPrice: $('#productPrice'),
    productIcon: $('#productIcon'),
    productBg: $('#productBg'),
    productBgValue: $('#productBgValue'),
    productDescription: $('#productDescription'),
    productImageInput: $('#productImageInput'),
    productImagePreview: $('#productImagePreview'),
    productImageName: $('#productImageName'),
    productImageHint: $('#productImageHint'),
    productImageRemove: $('#productImageRemove'),
    productModalEyebrow: $('#productModalEyebrow'),
    productModalTitle: $('#productModalTitle'),
    productFormError: $('#productFormError'),
    productModalClose: $('#productModalClose'),
    productCancel: $('#productCancel'),
    categoryModal: $('#categoryModal'),
    categoryForm: $('#categoryForm'),
    categoryId: $('#categoryId'),
    categoryName: $('#categoryName'),
    categoryBg: $('#categoryBg'),
    categoryBgValue: $('#categoryBgValue'),
    categoryDescription: $('#categoryDescription'),
    categoryImageInput: $('#categoryImageInput'),
    categoryImagePreview: $('#categoryImagePreview'),
    categoryImageName: $('#categoryImageName'),
    categoryImageHint: $('#categoryImageHint'),
    categoryImageRemove: $('#categoryImageRemove'),
    categoryModalEyebrow: $('#categoryModalEyebrow'),
    categoryModalTitle: $('#categoryModalTitle'),
    categoryFormError: $('#categoryFormError'),
    categoryModalClose: $('#categoryModalClose'),
    categoryCancel: $('#categoryCancel'),
    confirmModal: $('#confirmModal'),
    confirmForm: $('#confirmForm'),
    confirmIcon: $('#confirmIcon'),
    confirmTitle: $('#confirmTitle'),
    confirmText: $('#confirmText'),
    confirmAccept: $('#confirmAccept'),
    toastStack: $('#toastStack'),
  };

  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const asArray = value => Array.isArray(value) ? value : [];
  const nestedObject = result => {
    if (!result || typeof result !== 'object') return {};
    return (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) ? result.data : result;
  };
  const findCollection = (result, name) => {
    const candidates = [
      result?.[name], result?.data?.[name], result?.result?.[name],
      result?.data, result?.result,
    ];
    return candidates.find(Array.isArray) || [];
  };
  const validColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#e8f0ff';
  const safeUrl = value => {
    if (!value || typeof value !== 'string') return '';
    try {
      const url = new URL(value, window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  };
  const initials = value => String(value || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
  const compactText = (value, max = 94) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };
  const money = value => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0,00 ₼';
    return `${number.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`;
  };
  const formatDate = (value, includeTime = false) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const options = includeTime
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat('az-AZ', options).format(date);
  };
  const timeLabel = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatDate(value);
    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'İndi';
    if (minutes < 60) return `${minutes} dəq`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat`;
    if (hours < 48) return 'Dünən';
    return formatDate(value);
  };
  const isToday = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  };

  class ApiError extends Error {
    constructor(message, status = 0, payload = null) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.payload = payload;
    }
  }

  async function request(action, { method = 'GET', body = null, formData = null, csrf = true, params = {} } = {}) {
    const headers = { Accept: 'application/json' };
    if (csrf && state.csrf) headers['X-CSRF-Token'] = state.csrf;
    const options = { method, headers, credentials: 'same-origin' };
    if (body !== null && formData !== null) {
      throw new ApiError('Sorğu məlumatı düzgün hazırlanmayıb.');
    }
    if (formData !== null) {
      options.body = formData;
    } else if (body !== null) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      const query = new URLSearchParams({ action, ...params });
      response = await fetch(`${API_URL}?${query.toString()}`, options);
    } catch (_) {
      throw new ApiError('Serverlə əlaqə yaratmaq alınmadı. İnternet bağlantısını yoxlayın.');
    }

    const raw = await response.text();
    let result = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch (_) {
      throw new ApiError('Server gözlənilən cavabı qaytarmadı.', response.status);
    }
    const payload = nestedObject(result);
    const nextCsrf = result.csrf_token || payload.csrf_token || result.csrf || payload.csrf;
    if (nextCsrf) state.csrf = nextCsrf;
    if (!response.ok || result.ok === false || payload.ok === false) {
      throw new ApiError(result.message || payload.message || 'Əməliyyatı tamamlamaq mümkün olmadı.', response.status, result);
    }
    return result;
  }

  const normalizeImage = (raw, urlFallback = '') => {
    const metadata = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    const stringUrl = typeof raw === 'string' ? raw : '';
    const url = safeUrl(urlFallback || metadata?.url || metadata?.image_url || stringUrl || '');
    const id = String(metadata?.id ?? metadata?.image_id ?? '');
    return { metadata, url, id };
  };

  const normalizeProduct = raw => {
    const product = raw && typeof raw === 'object' ? raw : {};
    const image = normalizeImage(product.image ?? product.image_data, product.image_url ?? product.imageUrl ?? '');
    return {
      id: String(product.id ?? product.product_id ?? ''),
      name: String(product.name ?? product.title ?? 'Adsız məhsul'),
      category: String(product.category ?? product.category_name ?? 'Digər'),
      price: Number(product.price ?? product.amount ?? 0) || 0,
      icon: String(product.icon ?? product.emoji ?? product.symbol ?? 'toolbox').toLowerCase(),
      bg: validColor(product.bg ?? product.background ?? product.background_color),
      description: String(product.description ?? product.details ?? ''),
      image: image.url,
      imageData: image.metadata,
      imageId: String(product.image_id ?? image.id ?? ''),
      updatedAt: product.updated_at ?? product.updatedAt ?? product.created_at ?? product.createdAt ?? '',
    };
  };

  const normalizeCategory = raw => {
    const category = raw && typeof raw === 'object' ? raw : {};
    const image = normalizeImage(category.image ?? category.image_data, category.image_url ?? category.imageUrl ?? '');
    return {
      id: String(category.id ?? category.category_id ?? ''),
      name: String(category.name ?? category.title ?? 'Adsız kateqoriya'),
      bg: validColor(category.bg ?? category.color ?? category.background ?? category.background_color),
      description: String(category.description ?? category.details ?? ''),
      image: image.url,
      imageData: image.metadata,
      imageId: String(category.image_id ?? image.id ?? ''),
      updatedAt: category.updated_at ?? category.updatedAt ?? category.created_at ?? category.createdAt ?? '',
    };
  };

  const normalizeAttachment = (raw, message) => {
    if (!raw && !message?.attachment_url) return null;
    if (typeof raw === 'string') return { name: raw.split('/').pop() || 'Əlavə olunmuş fayl', url: safeUrl(raw) };
    const attachment = raw && typeof raw === 'object' ? raw : {};
    return {
      name: String(attachment.name ?? attachment.original_name ?? attachment.filename ?? 'Əlavə olunmuş fayl'),
      size: attachment.size ?? attachment.file_size ?? '',
      url: safeUrl(attachment.url ?? attachment.download_url ?? attachment.href ?? attachment.path ?? message?.attachment_url ?? ''),
    };
  };

  const normalizeMessage = raw => {
    const message = raw && typeof raw === 'object' ? raw : {};
    return {
      id: String(message.id ?? message.message_id ?? ''),
      name: String(message.full_name ?? message.name ?? message.sender_name ?? 'Adsız müraciət'),
      phone: String(message.phone ?? message.phone_number ?? ''),
      company: String(message.company ?? message.company_name ?? ''),
      message: String(message.message ?? message.text ?? message.body ?? ''),
      createdAt: message.created_at ?? message.createdAt ?? message.date ?? '',
      attachment: normalizeAttachment(message.attachment ?? message.file, message),
    };
  };

  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<span class="toast-symbol">${type === 'error' ? '!' : '✓'}</span><span>${escapeHTML(message)}</span>`;
    dom.toastStack.append(node);
    window.setTimeout(() => {
      node.classList.add('leaving');
      window.setTimeout(() => node.remove(), 220);
    }, 3800);
  }

  function setButtonBusy(button, busy, busyText = 'Gözləyin...') {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.textContent = busyText;
    } else {
      button.disabled = false;
      if (button.dataset.label) button.innerHTML = button.dataset.label;
      delete button.dataset.label;
    }
  }

  function setSyncStatus(status = 'ready') {
    dom.syncStatus.classList.toggle('loading', status === 'loading');
    dom.syncStatus.lastChild.textContent = status === 'loading' ? ' Yenilənir...' : ' Yeniləndi';
  }

  function showLogin() {
    state.csrf = '';
    state.products = [];
    state.categories = [];
    state.messages = [];
    state.activeMessageId = null;
    dom.adminApp.hidden = true;
    dom.loginView.hidden = false;
    dom.bootLoader.hidden = true;
    window.setTimeout(() => dom.loginUsername.focus(), 60);
  }

  function showApp() {
    dom.loginView.hidden = true;
    dom.adminApp.hidden = false;
    dom.bootLoader.hidden = true;
  }

  function setView(view) {
    const viewTitle = { dashboard: 'Xülasə', products: 'Məhsullar', categories: 'Kateqoriyalar', messages: 'Mesajlar' };
    state.activeView = viewTitle[view] ? view : 'dashboard';
    $$('.view').forEach(section => {
      const active = section.dataset.view === state.activeView;
      section.hidden = !active;
      section.classList.toggle('active', active);
    });
    $$('.side-link[data-view-target]').forEach(button => button.classList.toggle('active', button.dataset.viewTarget === state.activeView));
    dom.breadcrumb.textContent = viewTitle[state.activeView];
    closeSidebar();
  }

  function closeSidebar() {
    dom.sidebar.classList.remove('open');
    dom.sidebarBackdrop.classList.remove('show');
  }

  function updateDateCaption() {
    const formatted = new Intl.DateTimeFormat('az-AZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    dom.dashboardDate.textContent = `${formatted[0].toUpperCase()}${formatted.slice(1)} — işlərinizi burada izləyə bilərsiniz.`;
  }

  const iconGlyph = icon => ({ toolbox: '🧰', drill: '🔩', bolt: '⚙️', saw: '🪚', paint: '🎨', wrench: '🔧', lamp: '💡', brick: '🧱' }[String(icon).toLowerCase()] || '🧰');

  function productVisual(product) {
    const style = `--product-bg:${escapeHTML(validColor(product.bg))}`;
    const visual = product.image
      ? `<img src="${escapeHTML(product.image)}" alt="">`
      : escapeHTML(iconGlyph(product.icon));
    return `<span class="product-icon" style="${style}" aria-hidden="true">${visual}</span>`;
  }

  function renderDashboard() {
    const messageCount = state.messages.length;
    const todayCount = state.messages.filter(message => isToday(message.createdAt)).length;
    dom.statProducts.textContent = String(state.products.length);
    dom.statMessages.textContent = String(messageCount);
    dom.statToday.textContent = String(todayCount);
    dom.navProductsCount.textContent = String(state.products.length);
    dom.navCategoriesCount.textContent = String(state.categories.length);
    dom.navMessagesCount.textContent = String(messageCount);
    dom.statProductsHint.textContent = state.products.length === 1 ? 'Kataloqdakı məhsul' : 'Kataloqdakı məhsullar';
    dom.statMessagesHint.textContent = messageCount === 1 ? 'Bütün sorğu' : 'Bütün sorğular';
    dom.statTodayHint.textContent = todayCount === 1 ? 'Bu gün qəbul edilən' : 'Bu gün qəbul edilənlər';
    updateDateCaption();

    const newest = state.messages.slice(0, 4);
    dom.recentMessages.innerHTML = newest.length ? newest.map(message => `
      <button class="mini-message" type="button" data-open-message="${escapeHTML(message.id)}">
        <span class="message-avatar">${escapeHTML(initials(message.name))}</span>
        <span><b>${escapeHTML(message.name)}</b><small>${escapeHTML(compactText(message.message, 52) || message.phone || 'Yeni müraciət')}</small></span>
        <time datetime="${escapeHTML(String(message.createdAt))}">${escapeHTML(timeLabel(message.createdAt))}</time>
      </button>`).join('') : '<p class="mini-message-empty">Hələ yeni müraciət yoxdur.</p>';
  }

  function productsForFilter() {
    const query = (dom.productSearch.value || '').trim().toLocaleLowerCase('az');
    const category = dom.productCategoryFilter.value;
    return state.products.filter(product => {
      const haystack = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('az');
      return (!query || haystack.includes(query)) && (!category || product.category === category);
    });
  }

  function renderCategoryOptions() {
    const current = dom.productCategoryFilter.value;
    const formCurrent = dom.productCategory.value;
    const categories = [...new Set([
      ...state.categories.map(category => category.name),
      ...state.products.map(product => product.category),
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'az'));
    dom.productCategoryFilter.innerHTML = '<option value="">Bütün kateqoriyalar</option>' + categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
    dom.productCategoryFilter.value = categories.includes(current) ? current : '';
    dom.productCategory.innerHTML = '<option value="" disabled>Kateqoriya seçin</option>' + categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
    dom.productCategory.value = categories.includes(formCurrent) ? formCurrent : '';
  }

  function renderProducts({ refreshOptions = false } = {}) {
    if (refreshOptions) renderCategoryOptions();
    const products = productsForFilter();
    dom.productTableCount.textContent = `${products.length} məhsul`;
    dom.productsTable.innerHTML = products.map(product => `
      <tr>
        <td><div class="product-cell">${productVisual(product)}<span><b title="${escapeHTML(product.name)}">${escapeHTML(product.name)}</b>${product.description ? `<small>${escapeHTML(compactText(product.description, 40))}</small>` : ''}</span></div></td>
        <td><span class="category-badge">${escapeHTML(product.category)}</span></td>
        <td><span class="price-value">${escapeHTML(money(product.price))}</span></td>
        <td><span class="date-value">${escapeHTML(formatDate(product.updatedAt))}</span></td>
        <td><div class="row-actions">
          <button class="row-action" type="button" data-product-edit="${escapeHTML(product.id)}" aria-label="${escapeHTML(product.name)} məhsulunu redaktə et" title="Redaktə et"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m12.5 7.5 4 4"/></svg></button>
          <button class="row-action delete" type="button" data-product-delete="${escapeHTML(product.id)}" aria-label="${escapeHTML(product.name)} məhsulunu sil" title="Sil"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v5M14 11v5M8 7l1-3h6l1 3M7 7l1 13h8l1-13"/></svg></button>
        </div></td>
      </tr>`).join('');
    dom.productsEmpty.hidden = products.length > 0;
  }

  function categoriesForFilter() {
    const query = (dom.categorySearch.value || '').trim().toLocaleLowerCase('az');
    if (!query) return state.categories;
    return state.categories.filter(category => `${category.name} ${category.description}`.toLocaleLowerCase('az').includes(query));
  }

  function categoryVisual(category) {
    const style = `--category-bg:${escapeHTML(validColor(category.bg))}`;
    const visual = category.image
      ? `<img src="${escapeHTML(category.image)}" alt="">`
      : '<span aria-hidden="true">🗂️</span>';
    return `<div class="category-card-media" style="${style}" aria-hidden="true">${visual}</div>`;
  }

  function renderCategories() {
    const categories = categoriesForFilter();
    dom.categoryCount.textContent = `${categories.length} kateqoriya`;
    dom.categoryGrid.innerHTML = categories.map(category => {
      const productCount = state.products.filter(product => product.category === category.name).length;
      const countText = productCount === 1 ? '1 məhsul' : `${productCount} məhsul`;
      return `
        <article class="category-card">
          ${categoryVisual(category)}
          <div class="category-card-body">
            <div class="category-card-heading"><div><h2 title="${escapeHTML(category.name)}">${escapeHTML(category.name)}</h2><span>${escapeHTML(countText)}</span></div><div class="row-actions">
              <button class="row-action" type="button" data-category-edit="${escapeHTML(category.id)}" aria-label="${escapeHTML(category.name)} kateqoriyasını redaktə et" title="Redaktə et"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m12.5 7.5 4 4"/></svg></button>
              <button class="row-action delete" type="button" data-category-delete="${escapeHTML(category.id)}" aria-label="${escapeHTML(category.name)} kateqoriyasını sil" title="Sil"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v5M14 11v5M8 7l1-3h6l1 3M7 7l1 13h8l1-13"/></svg></button>
            </div></div>
            <p>${escapeHTML(compactText(category.description || 'Bu kateqoriya üçün açıqlama qeyd edilməyib.', 115))}</p>
          </div>
        </article>`;
    }).join('');
    dom.categoriesEmpty.hidden = categories.length > 0;
  }

  function messagesForFilter() {
    const query = (dom.messageSearch.value || '').trim().toLocaleLowerCase('az');
    if (!query) return state.messages;
    return state.messages.filter(message => `${message.name} ${message.phone} ${message.company} ${message.message}`.toLocaleLowerCase('az').includes(query));
  }

  function renderMessages() {
    const messages = messagesForFilter();
    dom.messagesTotal.textContent = `${state.messages.length} mesaj`;
    if (!messages.some(message => message.id === state.activeMessageId)) state.activeMessageId = messages[0]?.id || null;
    dom.messageList.innerHTML = messages.map(message => `
      <button class="message-row ${message.id === state.activeMessageId ? 'active' : ''}" type="button" data-message-id="${escapeHTML(message.id)}">
        <span class="message-row-avatar">${escapeHTML(initials(message.name))}</span>
        <span class="message-row-main"><span class="message-row-top"><b>${escapeHTML(message.name)}</b><time datetime="${escapeHTML(String(message.createdAt))}">${escapeHTML(timeLabel(message.createdAt))}</time></span><p>${escapeHTML(compactText(message.message || message.phone || 'Yeni müraciət'))}</p></span>
        ${message.attachment ? '<span class="attachment-pin" aria-label="Fayl əlavə edilib">⌇</span>' : ''}
      </button>`).join('');
    dom.messagesEmpty.hidden = messages.length > 0;
    renderMessageDetail();
  }

  function attachmentDisplay(attachment) {
    if (!attachment) return '';
    const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>';
    const suffix = attachment.size ? ` (${formatFileSize(attachment.size)})` : '';
    if (attachment.url) return `<div class="attachment-block"><small>ƏLAVƏ EDİLMİŞ FAYL</small><a class="attachment-link" href="${escapeHTML(attachment.url)}" target="_blank" rel="noopener noreferrer">${icon}<span>${escapeHTML(attachment.name)}${escapeHTML(suffix)}</span></a></div>`;
    return `<div class="attachment-block"><small>ƏLAVƏ EDİLMİŞ FAYL</small><span class="attachment-link">${icon}<span>${escapeHTML(attachment.name)}${escapeHTML(suffix)}</span></span></div>`;
  }

  function formatFileSize(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return String(value || '');
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString('az-AZ', { maximumFractionDigits: 1 })} MB`;
  }

  function renderMessageDetail() {
    const message = state.messages.find(item => item.id === state.activeMessageId);
    if (!message) {
      dom.messageDetail.innerHTML = '<div class="detail-placeholder"><span>💌</span><h2>Mesaj seçin</h2><p>Ətraflı məlumatı görmək üçün siyahıdan bir mesaj seçin.</p></div>';
      return;
    }
    const phoneHref = message.phone ? `tel:${message.phone.replace(/[^+\d]/g, '')}` : '';
    dom.messageDetail.innerHTML = `
      <header class="message-detail-head">
        <div class="message-person"><span class="message-detail-avatar">${escapeHTML(initials(message.name))}</span><div><h2>${escapeHTML(message.name)}</h2><p>${escapeHTML(message.company || 'Fərdi müraciət')}</p></div></div>
        <button class="icon-button message-delete" type="button" data-message-delete="${escapeHTML(message.id)}" aria-label="Mesajı sil" title="Mesajı sil"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v5M14 11v5M8 7l1-3h6l1 3M7 7l1 13h8l1-13"/></svg></button>
      </header>
      <div class="message-detail-body">
        <div class="contact-meta">
          ${message.phone ? `<a href="${escapeHTML(phoneHref)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .8 2.9a2 2 0 0 1-.5 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.7 2.9.8a2 2 0 0 1 1.7 1.9Z"/></svg>${escapeHTML(message.phone)}</a>` : ''}
          ${message.company ? `<span>${escapeHTML(message.company)}</span>` : ''}
        </div>
        <div class="message-copy">${escapeHTML(message.message || 'Mesaj mətni qeyd edilməyib.')}</div>
        ${attachmentDisplay(message.attachment)}
      </div>
      <footer class="message-detail-foot">Qəbul edilib: ${escapeHTML(formatDate(message.createdAt, true))}</footer>`;
  }

  function renderAll(options = {}) {
    renderDashboard();
    renderProducts({ refreshOptions: options.refreshOptions === true });
    renderCategories();
    renderMessages();
  }

  async function loadData({ silent = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    setSyncStatus('loading');
    dom.refreshButton.classList.add('loading');
    try {
      const [productsResponse, messagesResponse, categoriesResponse] = await Promise.all([
        request('products'),
        request('messages'),
        request('categories').catch(error => {
          // Lets the existing product/message panel keep working if an older
          // server copy is briefly live during deployment.
          if (error instanceof ApiError && error.status === 404) return { ok: true, categories: [] };
          throw error;
        }),
      ]);
      state.products = findCollection(productsResponse, 'products').map(normalizeProduct).filter(product => product.id);
      const categoryItems = findCollection(categoriesResponse, 'categories').length
        ? findCollection(categoriesResponse, 'categories')
        : findCollection(productsResponse, 'categories');
      state.categories = categoryItems.map(normalizeCategory).filter(category => category.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'az'));
      state.messages = findCollection(messagesResponse, 'messages').map(normalizeMessage).filter(message => message.id)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      renderAll({ refreshOptions: true });
      if (!silent) toast('Məlumatlar yeniləndi.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showLogin();
        toast('Sessiyanız bitib. Yenidən daxil olun.', 'error');
      } else {
        toast(error.message || 'Məlumatları yeniləmək alınmadı.', 'error');
      }
    } finally {
      state.loading = false;
      setSyncStatus('ready');
      dom.refreshButton.classList.remove('loading');
    }
  }

  function clearLoginError() {
    dom.loginError.hidden = true;
    dom.loginError.textContent = '';
  }

  function showLoginError(message) {
    dom.loginError.textContent = message;
    dom.loginError.hidden = false;
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearLoginError();
    if (!dom.loginForm.reportValidity()) return;
    const username = dom.loginUsername.value.trim();
    const password = dom.loginPassword.value;
    setButtonBusy(dom.loginSubmit, true, 'Daxil olunur...');
    try {
      const response = await request('login', { method: 'POST', body: { username, password }, csrf: false });
      const session = nestedObject(response);
      const authenticated = Boolean(response.authenticated ?? session.authenticated ?? session.ok ?? response.ok);
      if (!authenticated) throw new ApiError('Giriş adı və ya parol yanlışdır.');
      state.csrf = response.csrf_token || session.csrf_token || response.csrf || session.csrf || state.csrf;
      dom.loginPassword.value = '';
      showApp();
      await loadData({ silent: true });
      toast('Xoş gəldiniz, Admin!');
    } catch (error) {
      showLoginError(error.message || 'Daxil olmaq alınmadı.');
      dom.loginPassword.focus();
    } finally {
      setButtonBusy(dom.loginSubmit, false);
    }
  }

  async function handleLogout() {
    if (!await askConfirm({ title: 'Paneldən çıxmaq istəyirsiniz?', text: 'Cari idarəetmə sessiyanız bağlanacaq.', accept: 'Çıxış', icon: '↗', danger: false })) return;
    setButtonBusy(dom.logoutButton, true, 'Çıxış...');
    try {
      await request('logout', { method: 'POST', body: {} });
      showLogin();
      toast('Paneldən çıxış edildi.');
    } catch (error) {
      toast(error.message || 'Çıxış etmək alınmadı.', 'error');
    } finally {
      setButtonBusy(dom.logoutButton, false);
    }
  }

  const mediaElements = scope => scope === 'product'
    ? { input: dom.productImageInput, preview: dom.productImagePreview, name: dom.productImageName, hint: dom.productImageHint, remove: dom.productImageRemove }
    : { input: dom.categoryImageInput, preview: dom.categoryImagePreview, name: dom.categoryImageName, hint: dom.categoryImageHint, remove: dom.categoryImageRemove };

  const mediaScopeName = scope => scope === 'product' ? 'Məhsul' : 'Kateqoriya';

  function existingMediaFor(entity) {
    if (!entity || (!entity.image && !entity.imageId && !entity.imageData)) return null;
    const image = entity.imageData && typeof entity.imageData === 'object' ? { ...entity.imageData } : {};
    if (!image.id && entity.imageId) image.id = entity.imageId;
    if (!image.url && entity.image) image.url = entity.image;
    return image;
  }

  function revokeMediaPreview(scope) {
    const previewUrl = mediaState[scope].previewUrl;
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    mediaState[scope].previewUrl = '';
  }

  function updateMediaPreview(scope) {
    const media = mediaState[scope];
    const elements = mediaElements(scope);
    const image = $('img', elements.preview);
    const placeholder = $('.media-placeholder', elements.preview);
    const selected = media.file || media.uploaded || (!media.removed && media.existing);
    const src = media.previewUrl || media.uploaded?.url || media.existing?.url || '';
    const defaultHint = scope === 'product'
      ? 'Kartda ikonun yerinə bu şəkil görünəcək.'
      : 'Saytdakı kateqoriya kartında bu şəkil görünəcək.';
    const shown = Boolean(selected && src);
    image.hidden = !shown;
    image.removeAttribute('src');
    if (shown) image.src = src;
    placeholder.hidden = shown;
    elements.remove.hidden = !selected;

    if (media.removed) {
      elements.name.textContent = 'Şəkil silinəcək';
      elements.hint.textContent = scope === 'product'
        ? 'Saxladıqda kartda yenidən ikon görünəcək.'
        : 'Saxladıqda kartda standart kateqoriya işarəsi görünəcək.';
    } else if (media.file) {
      elements.name.textContent = media.file.name;
      elements.hint.textContent = 'Şəkil saxladıqda təhlükəsiz şəkildə yüklənəcək.';
    } else if (media.uploaded || media.existing) {
      elements.name.textContent = media.uploaded?.name || media.existing?.name || 'Mövcud şəkil';
      elements.hint.textContent = defaultHint;
    } else {
      elements.name.textContent = 'Şəkil seçilməyib';
      elements.hint.textContent = defaultHint;
    }
  }

  async function deleteTemporaryUpload(image) {
    const id = String(image?.id ?? image?.image_id ?? '');
    if (!id || !state.csrf) return;
    try {
      await request('delete-upload', { method: 'POST', body: { image_id: id } });
    } catch (_) {
      // The upload is not referenced by the catalog yet; a failed cleanup is
      // intentionally non-blocking and can be handled by the server cleanup.
    }
  }

  function resetMedia(scope, { cleanupUpload = false } = {}) {
    const media = mediaState[scope];
    if (cleanupUpload && media.uploaded) void deleteTemporaryUpload(media.uploaded);
    revokeMediaPreview(scope);
    media.existing = null;
    media.uploaded = null;
    media.file = null;
    media.removed = false;
    mediaElements(scope).input.value = '';
    updateMediaPreview(scope);
  }

  function setExistingMedia(scope, entity) {
    resetMedia(scope, { cleanupUpload: true });
    mediaState[scope].existing = existingMediaFor(entity);
    updateMediaPreview(scope);
  }

  function selectImage(scope) {
    const elements = mediaElements(scope);
    const file = elements.input.files?.[0];
    if (!file) return;
    const accepted = ['image/jpeg', 'image/png', 'image/webp'];
    if (!accepted.includes(file.type) || file.size > 8 * 1024 * 1024) {
      elements.input.value = '';
      const error = scope === 'product' ? dom.productFormError : dom.categoryFormError;
      error.textContent = 'Yalnız JPG, PNG və ya WEBP formatında, maksimum 8 MB şəkil seçin.';
      error.hidden = false;
      return;
    }
    const media = mediaState[scope];
    const error = scope === 'product' ? dom.productFormError : dom.categoryFormError;
    error.hidden = true;
    error.textContent = '';
    if (media.uploaded) void deleteTemporaryUpload(media.uploaded);
    revokeMediaPreview(scope);
    media.uploaded = null;
    media.file = file;
    media.removed = false;
    media.previewUrl = URL.createObjectURL(file);
    updateMediaPreview(scope);
  }

  function removeImage(scope) {
    const media = mediaState[scope];
    if (media.uploaded) void deleteTemporaryUpload(media.uploaded);
    revokeMediaPreview(scope);
    media.uploaded = null;
    media.file = null;
    media.removed = Boolean(media.existing);
    mediaElements(scope).input.value = '';
    updateMediaPreview(scope);
  }

  async function uploadImage(file, scope) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('scope', scope);
    const response = await request('upload', { method: 'POST', formData });
    const payload = nestedObject(response);
    const rawImage = response.image ?? payload.image ?? null;
    const image = rawImage && typeof rawImage === 'object' ? { ...rawImage } : {};
    const url = safeUrl(response.image_url ?? payload.image_url ?? image.url ?? image.image_url ?? '');
    if (url && !image.url) image.url = url;
    if (!image.id && (response.image_id || payload.image_id)) image.id = response.image_id || payload.image_id;
    if (!image.id) throw new ApiError(`${mediaScopeName(scope)} şəkli serverdə yadda saxlanmadı.`);
    return image;
  }

  async function mediaPayload(scope) {
    const media = mediaState[scope];
    if (media.removed) return null;
    if (media.file) {
      const uploaded = await uploadImage(media.file, scope);
      media.uploaded = uploaded;
      media.file = null;
      // New media URLs intentionally become public only once the product or
      // category is saved. Keep the local blob preview while the form is open.
      updateMediaPreview(scope);
    }
    const imageReference = image => {
      const id = String(image?.id ?? image?.image_id ?? '');
      return id ? { id } : image;
    };
    if (media.uploaded) return imageReference(media.uploaded);
    if (media.existing) return imageReference(media.existing);
    return undefined;
  }

  function openProductModal(product = null) {
    dom.productForm.reset();
    resetMedia('product', { cleanupUpload: true });
    dom.productFormError.hidden = true;
    dom.productFormError.textContent = '';
    if (product) {
      dom.productModalEyebrow.textContent = 'MƏHSULU REDAKTƏ ET';
      dom.productModalTitle.textContent = 'Məhsulu yenilə';
      dom.productId.value = product.id;
      dom.productName.value = product.name;
      dom.productCategory.value = product.category;
      dom.productPrice.value = product.price;
      dom.productIcon.value = product.icon;
      dom.productBg.value = validColor(product.bg);
      dom.productDescription.value = product.description || '';
      setExistingMedia('product', product);
    } else {
      dom.productModalEyebrow.textContent = 'YENİ MƏHSUL';
      dom.productModalTitle.textContent = 'Məhsul əlavə et';
      dom.productId.value = '';
      dom.productIcon.value = 'toolbox';
      dom.productBg.value = '#e8f0ff';
      dom.productDescription.value = '';
    }
    updateColorOutput('product');
    dom.productModal.showModal();
    window.setTimeout(() => dom.productName.focus(), 60);
  }

  function closeProductModal({ discardMedia = true } = {}) {
    if (dom.productModal.open) dom.productModal.close();
    resetMedia('product', { cleanupUpload: discardMedia });
  }

  function updateColorOutput(scope = 'product') {
    const input = scope === 'product' ? dom.productBg : dom.categoryBg;
    const output = scope === 'product' ? dom.productBgValue : dom.categoryBgValue;
    output.value = input.value.toUpperCase();
    output.textContent = input.value.toUpperCase();
  }

  async function saveProduct(event) {
    event.preventDefault();
    dom.productFormError.hidden = true;
    if (!dom.productForm.reportValidity()) return;
    const price = Number(dom.productPrice.value);
    if (!Number.isFinite(price) || price < 0) {
      dom.productFormError.textContent = 'Qiyməti düzgün formatda yazın.';
      dom.productFormError.hidden = false;
      return;
    }
    const product = {
      id: dom.productId.value.trim() || undefined,
      name: dom.productName.value.trim(),
      category: dom.productCategory.value.trim(),
      price,
      icon: dom.productIcon.value.trim().toLowerCase() || 'toolbox',
      bg: validColor(dom.productBg.value),
      description: dom.productDescription.value.trim(),
    };
    if (!product.id) delete product.id;
    const editing = Boolean(dom.productId.value);
    const saveButton = $('#productSave');
    setButtonBusy(saveButton, true, 'Saxlanılır...');
    try {
      const image = await mediaPayload('product');
      if (image !== undefined) product.image = image;
      await request('products', { method: editing ? 'PUT' : 'POST', body: product, params: editing ? { id: product.id } : {} });
      closeProductModal({ discardMedia: false });
      await loadData({ silent: true });
      toast(editing ? 'Məhsul yeniləndi.' : 'Yeni məhsul əlavə edildi.');
    } catch (error) {
      dom.productFormError.textContent = error.message || 'Məhsulu saxlamaq alınmadı.';
      dom.productFormError.hidden = false;
    } finally {
      setButtonBusy(saveButton, false);
    }
  }

  async function deleteProduct(id) {
    const product = state.products.find(item => item.id === String(id));
    if (!product) return;
    const confirmed = await askConfirm({ title: 'Məhsulu silmək istəyirsiniz?', text: `“${product.name}” kataloqdan silinəcək. Bu əməliyyatı geri qaytarmaq olmur.`, accept: 'Məhsulu sil', icon: '!', danger: true });
    if (!confirmed) return;
    try {
      await request('products', { method: 'DELETE', body: { id: product.id }, params: { id: product.id } });
      state.products = state.products.filter(item => item.id !== product.id);
      renderAll({ refreshOptions: true });
      toast('Məhsul silindi.');
    } catch (error) {
      toast(error.message || 'Məhsulu silmək alınmadı.', 'error');
    }
  }

  function openCategoryModal(category = null) {
    dom.categoryForm.reset();
    resetMedia('category', { cleanupUpload: true });
    dom.categoryFormError.hidden = true;
    dom.categoryFormError.textContent = '';
    if (category) {
      dom.categoryModalEyebrow.textContent = 'KATEQORİYANI REDAKTƏ ET';
      dom.categoryModalTitle.textContent = 'Kateqoriyanı yenilə';
      dom.categoryId.value = category.id;
      dom.categoryName.value = category.name;
      dom.categoryBg.value = validColor(category.bg);
      dom.categoryDescription.value = category.description || '';
      setExistingMedia('category', category);
    } else {
      dom.categoryModalEyebrow.textContent = 'YENİ KATEQORİYA';
      dom.categoryModalTitle.textContent = 'Kateqoriya əlavə et';
      dom.categoryId.value = '';
      dom.categoryBg.value = '#e8f0ff';
      dom.categoryDescription.value = '';
    }
    updateColorOutput('category');
    dom.categoryModal.showModal();
    window.setTimeout(() => dom.categoryName.focus(), 60);
  }

  function closeCategoryModal({ discardMedia = true } = {}) {
    if (dom.categoryModal.open) dom.categoryModal.close();
    resetMedia('category', { cleanupUpload: discardMedia });
  }

  async function saveCategory(event) {
    event.preventDefault();
    dom.categoryFormError.hidden = true;
    if (!dom.categoryForm.reportValidity()) return;
    const category = {
      id: dom.categoryId.value.trim() || undefined,
      name: dom.categoryName.value.trim(),
      bg: validColor(dom.categoryBg.value),
      description: dom.categoryDescription.value.trim(),
    };
    if (!category.id) delete category.id;
    const editing = Boolean(dom.categoryId.value);
    const saveButton = $('#categorySave');
    setButtonBusy(saveButton, true, 'Saxlanılır...');
    try {
      const image = await mediaPayload('category');
      if (image !== undefined) category.image = image;
      await request('categories', { method: editing ? 'PUT' : 'POST', body: category, params: editing ? { id: category.id } : {} });
      closeCategoryModal({ discardMedia: false });
      await loadData({ silent: true });
      toast(editing ? 'Kateqoriya yeniləndi.' : 'Yeni kateqoriya əlavə edildi.');
    } catch (error) {
      dom.categoryFormError.textContent = error.message || 'Kateqoriyanı saxlamaq alınmadı.';
      dom.categoryFormError.hidden = false;
    } finally {
      setButtonBusy(saveButton, false);
    }
  }

  async function deleteCategory(id) {
    const category = state.categories.find(item => item.id === String(id));
    if (!category) return;
    const productCount = state.products.filter(product => product.category === category.name).length;
    const extra = productCount ? ` Bu kateqoriyada ${productCount} məhsul var; əvvəl onları başqa kateqoriyaya keçirin.` : '';
    const confirmed = await askConfirm({ title: 'Kateqoriyanı silmək istəyirsiniz?', text: `“${category.name}” kateqoriyası silinəcək.${extra}`, accept: 'Kateqoriyanı sil', icon: '!', danger: true });
    if (!confirmed) return;
    try {
      await request('categories', { method: 'DELETE', body: { id: category.id }, params: { id: category.id } });
      await loadData({ silent: true });
      toast('Kateqoriya silindi.');
    } catch (error) {
      toast(error.message || 'Kateqoriyanı silmək alınmadı.', 'error');
    }
  }

  async function deleteMessage(id) {
    const message = state.messages.find(item => item.id === String(id));
    if (!message) return;
    const confirmed = await askConfirm({ title: 'Mesajı silmək istəyirsiniz?', text: `${message.name} tərəfindən göndərilən müraciət silinəcək. Bu əməliyyatı geri qaytarmaq olmur.`, accept: 'Mesajı sil', icon: '!', danger: true });
    if (!confirmed) return;
    try {
      await request('messages', { method: 'DELETE', body: { id: message.id }, params: { id: message.id } });
      state.messages = state.messages.filter(item => item.id !== message.id);
      state.activeMessageId = state.messages[0]?.id || null;
      renderAll();
      toast('Mesaj silindi.');
    } catch (error) {
      toast(error.message || 'Mesajı silmək alınmadı.', 'error');
    }
  }

  function askConfirm({ title, text, accept = 'Təsdiq et', icon = '!', danger = true }) {
    dom.confirmTitle.textContent = title;
    dom.confirmText.textContent = text;
    dom.confirmIcon.textContent = icon;
    dom.confirmIcon.style.background = danger ? '#ffebeb' : '#e5f3fc';
    dom.confirmIcon.style.color = danger ? '#d94848' : '#397ca6';
    dom.confirmAccept.textContent = accept;
    dom.confirmAccept.className = `button ${danger ? 'button-danger' : 'button-primary'}`;
    dom.confirmModal.showModal();
    return new Promise(resolve => {
      const onClose = () => resolve(dom.confirmModal.returnValue === 'confirm');
      dom.confirmModal.addEventListener('close', onClose, { once: true });
    });
  }

  async function boot() {
    bindEvents();
    try {
      const response = await request('status', { csrf: false });
      const session = nestedObject(response);
      state.csrf = response.csrf_token || session.csrf_token || response.csrf || session.csrf || '';
      const authenticated = Boolean(response.authenticated ?? session.authenticated);
      if (authenticated) {
        showApp();
        await loadData({ silent: true });
      } else {
        showLogin();
      }
    } catch (_) {
      // A server unavailable at boot should still leave the login UI usable.
      showLogin();
      showLoginError('Panelə qoşulmaq alınmadı. Bir az sonra yenidən cəhd edin.');
    }
  }

  function bindEvents() {
    dom.loginForm.addEventListener('submit', handleLogin);
    dom.loginUsername.addEventListener('input', clearLoginError);
    dom.loginPassword.addEventListener('input', clearLoginError);
    dom.passwordToggle.addEventListener('click', () => {
      const visible = dom.loginPassword.type === 'text';
      dom.loginPassword.type = visible ? 'password' : 'text';
      dom.passwordToggle.setAttribute('aria-label', visible ? 'Parolu göstər' : 'Parolu gizlət');
      dom.passwordToggle.setAttribute('aria-pressed', String(!visible));
    });

    $$('.side-link[data-view-target]').forEach(button => button.addEventListener('click', () => setView(button.dataset.viewTarget)));
    $$('[data-open-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.openView)));
    dom.menuToggle.addEventListener('click', () => { dom.sidebar.classList.add('open'); dom.sidebarBackdrop.classList.add('show'); });
    dom.sidebarClose.addEventListener('click', closeSidebar);
    dom.sidebarBackdrop.addEventListener('click', closeSidebar);
    dom.refreshButton.addEventListener('click', () => loadData());
    dom.logoutButton.addEventListener('click', handleLogout);

    ['#newProductButton', '#dashboardNewProduct', '#quickNewProduct'].forEach(selector => $(selector)?.addEventListener('click', () => openProductModal()));
    dom.productSearch.addEventListener('input', () => renderProducts());
    dom.productCategoryFilter.addEventListener('change', () => renderProducts());
    dom.clearProductFilters.addEventListener('click', () => { dom.productSearch.value = ''; dom.productCategoryFilter.value = ''; renderProducts(); });
    dom.productsTable.addEventListener('click', event => {
      const edit = event.target.closest('[data-product-edit]');
      const remove = event.target.closest('[data-product-delete]');
      if (edit) openProductModal(state.products.find(product => product.id === edit.dataset.productEdit));
      if (remove) deleteProduct(remove.dataset.productDelete);
    });
    dom.productForm.addEventListener('submit', saveProduct);
    dom.productModalClose.addEventListener('click', closeProductModal);
    dom.productCancel.addEventListener('click', closeProductModal);
    dom.productBg.addEventListener('input', () => updateColorOutput('product'));
    dom.productImageInput.addEventListener('change', () => selectImage('product'));
    dom.productImageRemove.addEventListener('click', () => removeImage('product'));
    dom.productModal.addEventListener('cancel', () => window.setTimeout(() => resetMedia('product', { cleanupUpload: true }), 0));

    dom.newCategoryButton.addEventListener('click', () => openCategoryModal());
    dom.newCategoryEmptyButton.addEventListener('click', () => openCategoryModal());
    dom.categorySearch.addEventListener('input', renderCategories);
    dom.categoryGrid.addEventListener('click', event => {
      const edit = event.target.closest('[data-category-edit]');
      const remove = event.target.closest('[data-category-delete]');
      if (edit) openCategoryModal(state.categories.find(category => category.id === edit.dataset.categoryEdit));
      if (remove) deleteCategory(remove.dataset.categoryDelete);
    });
    dom.categoryForm.addEventListener('submit', saveCategory);
    dom.categoryModalClose.addEventListener('click', closeCategoryModal);
    dom.categoryCancel.addEventListener('click', closeCategoryModal);
    dom.categoryBg.addEventListener('input', () => updateColorOutput('category'));
    dom.categoryImageInput.addEventListener('change', () => selectImage('category'));
    dom.categoryImageRemove.addEventListener('click', () => removeImage('category'));
    dom.categoryModal.addEventListener('cancel', () => window.setTimeout(() => resetMedia('category', { cleanupUpload: true }), 0));

    dom.messageSearch.addEventListener('input', renderMessages);
    dom.messageList.addEventListener('click', event => {
      const row = event.target.closest('[data-message-id]');
      if (!row) return;
      state.activeMessageId = row.dataset.messageId;
      renderMessages();
    });
    dom.messageDetail.addEventListener('click', event => {
      const button = event.target.closest('[data-message-delete]');
      if (button) deleteMessage(button.dataset.messageDelete);
    });
    dom.recentMessages.addEventListener('click', event => {
      const button = event.target.closest('[data-open-message]');
      if (!button) return;
      state.activeMessageId = button.dataset.openMessage;
      setView('messages');
      renderMessages();
    });
  }

  boot();
})();
