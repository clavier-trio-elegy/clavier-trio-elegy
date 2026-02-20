(() => {
  'use strict';

  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));

  const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(n))) + ' ₽';

  const state = {
    type: 'Все',
    q: '',
    sort: 'popular', // popular | cheap | fast
    cart: loadCart(),
    promo: loadPromo(), // {code, discount, note}
    activeProductId: null
  };

  // Elements
  const grid = qs('#productGrid');
  const typeChips = qs('#typeChips');
  const resultsCount = qs('#resultsCount');

  const searchInput = qs('#searchInput');

  const sortPopular = qs('#sortPopular');
  const sortCheap = qs('#sortCheap');
  const sortFast = qs('#sortFast');

  const barCount = qs('#barCount');
  const barTotal = qs('#barTotal');
  const barBubble = qs('#barBubble');

  const checkoutBtn = qs('#checkoutBtn');
  const openCartBtn = qs('#openCartBtn');

  const productOverlay = qs('#productOverlay');
  const cartOverlay = qs('#cartOverlay');
  const closeProductBtn = qs('#closeProductBtn');
  const closeCartBtn = qs('#closeCartBtn');

  const pmName = qs('#pmName');
  const pmSub = qs('#pmSub');
  const pmPrice = qs('#pmPrice');
  const pmOld = qs('#pmOld');
  const pmDesc = qs('#pmDesc');
  const pmBadges = qs('#pmBadges');
  const pmSpecs = qs('#pmSpecs');
  const pmThumb = qs('#pmThumb');
  const pmAddBtn = qs('#pmAddBtn');
  const pmMoreBtn = qs('#pmMoreBtn');

  const cartSub = qs('#cartSub');
  const cartList = qs('#cartList');
  const promoInput = qs('#promoInput');
  const applyPromoBtn = qs('#applyPromoBtn');
  const cartItemsSum = qs('#cartItemsSum');
  const cartDiscount = qs('#cartDiscount');
  const cartShipping = qs('#cartShipping');
  const cartTotal = qs('#cartTotal');

  const orderForm = qs('#orderForm');
  const placeOrderBtn = qs('#placeOrderBtn');
  const clearCartBtn = qs('#clearCartBtn');

  const successBox = qs('#successBox');
  const successText = qs('#successText');
  const backToShopBtn = qs('#backToShopBtn');

  const openFilterBtn = qs('#openFilterBtn');

  const toast = qs('#toast');

  // Simple filter sheet (reuses product overlay to keep files small)
  let filterOverlay = null;

  // Init
  renderChips();
  renderProducts();
  syncBar();
  bind();

  // Register service worker (optional)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    });
  }

  // ---------- Rendering ----------
  function renderChips(){
    typeChips.innerHTML = '';
    window.PRODUCT_TYPES.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = t;
      b.dataset.active = (t === state.type) ? 'true' : 'false';
      b.addEventListener('click', () => {
        state.type = t;
        qsa('.chip', typeChips).forEach(x => x.dataset.active = (x.textContent === t) ? 'true' : 'false');
        renderProducts();
        haptic();
      });
      typeChips.appendChild(b);
    });
  }

  function getFiltered(){
    const q = (state.q || '').trim().toLowerCase();
    let items = window.PRODUCTS.slice();

    if (state.type !== 'Все') items = items.filter(p => p.type === state.type);

    if (q){
      items = items.filter(p => {
        const hay = (p.name + ' ' + p.type + ' ' + (p.features||[]).join(' ') + ' ' + (p.desc||'')).toLowerCase();
        return hay.includes(q);
      });
    }

    if (state.sort === 'cheap'){
      items.sort((a,b) => a.price - b.price);
    } else if (state.sort === 'fast'){
      items.sort((a,b) => b.speed - a.speed);
    } else {
      // popular: rating desc then slight discount
      items.sort((a,b) => (b.rating - a.rating) || (discountPct(b) - discountPct(a)));
    }

    return items;
  }

  function renderProducts(){
    const items = getFiltered();
    resultsCount.textContent = `${items.length} шт`;

    grid.innerHTML = '';
    items.forEach(p => grid.appendChild(productCard(p)));
  }

  function productCard(p){
    const el = document.createElement('article');
    el.className = 'card';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Открыть ${p.name}`);

    const old = p.oldPrice && p.oldPrice > p.price ? `<span class="old">${fmt(p.oldPrice)}</span>` : '';
    const tags = [
      p.type,
      `⭐ ${p.rating.toFixed(1)}`,
      `${p.speed} км/ч`,
      `масштаб ${p.scale}`
    ].map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

    el.innerHTML = `
      <div class="thumb" aria-hidden="true">${carSvg()}</div>
      <div class="cardBody">
        <h4 class="name">${escapeHtml(p.name)}</h4>
        <div class="meta">${tags}</div>
        <div class="priceRow">
          <div class="price">${fmt(p.price)} ${old}</div>
          <button class="btn" type="button" data-add="${escapeHtml(p.id)}">+ В корзину</button>
        </div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      const addId = e.target && e.target.dataset ? e.target.dataset.add : null;
      if (addId){
        addToCart(addId, 1);
        e.stopPropagation();
        return;
      }
      openProduct(p.id);
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        openProduct(p.id);
      }
    });

    return el;
  }

  // ---------- Product modal ----------
  function openProduct(id){
    const p = window.PRODUCTS.find(x => x.id === id);
    if (!p) return;

    state.activeProductId = id;

    pmName.textContent = p.name;
    pmSub.textContent = `${p.type} · ⭐ ${p.rating.toFixed(1)} · ${p.speed} км/ч`;

    pmPrice.textContent = fmt(p.price);
    if (p.oldPrice && p.oldPrice > p.price){
      pmOld.textContent = fmt(p.oldPrice);
      pmOld.style.display = 'inline';
    } else {
      pmOld.textContent = '';
      pmOld.style.display = 'none';
    }

    pmDesc.textContent = p.desc || '';

    pmBadges.innerHTML = '';
    const badges = [
      {t: `масштаб ${p.scale}`},
      {t: `радиус ${p.range}`},
      {t: `аккум. ${p.battery}`}
    ];
    if (discountPct(p) > 0) badges.push({t: `−${discountPct(p)}%`});

    badges.forEach(b => {
      const s = document.createElement('span');
      s.className = 'tag';
      s.textContent = b.t;
      pmBadges.appendChild(s);
    });

    pmThumb.innerHTML = '';
    pmThumb.appendChild(svgNode(carSvg()));

    // specs
    pmSpecs.hidden = true;
    pmSpecs.innerHTML = '';
    const rows = [
      ['Тип', p.type],
      ['Скорость', `${p.speed} км/ч`],
      ['Масштаб', p.scale],
      ['Аккумулятор', p.battery],
      ['Дальность', p.range],
      ['Особенности', (p.features||[]).join(', ') || '—']
    ];
    rows.forEach(([k,v]) => {
      const r = document.createElement('div');
      r.className = 'specRow';
      r.innerHTML = `<span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span>`;
      pmSpecs.appendChild(r);
    });

    pmAddBtn.textContent = inCartQty(id) ? `В корзине: ${inCartQty(id)} шт` : 'В корзину';

    openOverlay(productOverlay);
    haptic();
  }

  function toggleSpecs(){
    pmSpecs.hidden = !pmSpecs.hidden;
    pmMoreBtn.textContent = pmSpecs.hidden ? 'Характеристики' : 'Скрыть';
  }

  // ---------- Cart ----------
  function addToCart(id, qty){
    const current = state.cart[id] || 0;
    const next = Math.max(0, current + qty);
    if (next === 0) delete state.cart[id];
    else state.cart[id] = next;

    saveCart(state.cart);
    syncBar();
    if (state.activeProductId === id){
      pmAddBtn.textContent = inCartQty(id) ? `В корзине: ${inCartQty(id)} шт` : 'В корзину';
    }
    showToast(qty > 0 ? 'Добавлено в корзину' : 'Удалено');
    haptic();
  }

  function inCartQty(id){ return state.cart[id] || 0; }

  function cartItems(){
    return Object.entries(state.cart).map(([id, qty]) => {
      const p = window.PRODUCTS.find(x => x.id === id);
      return p ? { product: p, qty } : null;
    }).filter(Boolean);
  }

  function cartSubtotal(){
    return cartItems().reduce((sum, it) => sum + it.product.price * it.qty, 0);
  }

  function computeDiscount(subtotal){
    const promo = state.promo;
    if (!promo || !promo.code) return 0;
    if (promo.type === 'percent') return Math.round(subtotal * (promo.value / 100));
    if (promo.type === 'fixed') return Math.min(subtotal, promo.value);
    return 0;
  }

  function shippingCost(subtotalAfterDiscount){
    // демо-логика: бесплатно от 9000, иначе 390
    if (subtotalAfterDiscount <= 0) return 0;
    return subtotalAfterDiscount >= 9000 ? 0 : 390;
  }

  function syncBar(){
    const count = Object.values(state.cart).reduce((a,b)=>a+b, 0);
    const subtotal = cartSubtotal();
    const discount = computeDiscount(subtotal);
    const after = Math.max(0, subtotal - discount);
    const ship = shippingCost(after);
    const total = after + ship;

    barCount.textContent = String(count);
    barBubble.textContent = String(count);
    barTotal.textContent = fmt(total);

    // update cart sub if open
    if (cartOverlay.dataset.open === 'true') renderCart();
  }

  function renderCart(){
    const items = cartItems();
    const count = items.reduce((s,it)=>s+it.qty,0);
    cartSub.textContent = count ? `${count} шт · можно оформить ниже` : 'Пока пусто — добавь товары из каталога';

    cartList.innerHTML = '';
    if (!count){
      cartList.innerHTML = `<div class="footerNote" style="margin:0 0 10px;">Корзина пустая. Нажми “+ В корзину” на любой модели.</div>`;
    } else {
      items.forEach(({product:p, qty}) => {
        const row = document.createElement('div');
        row.className = 'cartItem';
        row.innerHTML = `
          <div class="cartThumb" aria-hidden="true"></div>
          <div class="cartBody">
            <div class="cartName">${escapeHtml(p.name)}</div>
            <div class="cartLine">
              <div class="cartPrice">${fmt(p.price)}</div>
              <div class="cartControls">
                <button class="stepBtn" type="button" data-step="-1" data-id="${escapeHtml(p.id)}">−</button>
                <div class="qty">${qty}</div>
                <button class="stepBtn" type="button" data-step="1" data-id="${escapeHtml(p.id)}">+</button>
                <button class="delBtn" type="button" data-del="${escapeHtml(p.id)}">✕</button>
              </div>
            </div>
          </div>
        `;
        // add tiny svg
        const thumb = qs('.cartThumb', row);
        thumb.appendChild(svgNode(carSvg()));

        cartList.appendChild(row);
      });
    }

    promoInput.value = state.promo?.code ? state.promo.code : '';

    const subtotal = cartSubtotal();
    const discount = computeDiscount(subtotal);
    const after = Math.max(0, subtotal - discount);
    const ship = shippingCost(after);
    const total = after + ship;

    cartItemsSum.textContent = fmt(subtotal);
    cartDiscount.textContent = discount ? '−' + fmt(discount) : fmt(0);
    cartShipping.textContent = ship ? fmt(ship) : '0 ₽';
    cartTotal.textContent = fmt(total);

    // toggle form / success
    orderForm.style.display = 'block';
    successBox.hidden = true;

    placeOrderBtn.disabled = count === 0;
    clearCartBtn.disabled = count === 0;
  }

  // ---------- Events ----------
  function bind(){
    // Search
    searchInput.addEventListener('input', () => {
      state.q = searchInput.value;
      renderProducts();
    });

    // Sort
    sortPopular.addEventListener('click', () => setSort('popular'));
    sortCheap.addEventListener('click', () => setSort('cheap'));
    sortFast.addEventListener('click', () => setSort('fast'));

    // Product modal
    closeProductBtn.addEventListener('click', () => closeOverlay(productOverlay));
    productOverlay.addEventListener('click', (e) => {
      if (e.target === productOverlay) closeOverlay(productOverlay);
    });
    pmAddBtn.addEventListener('click', () => {
      if (!state.activeProductId) return;
      addToCart(state.activeProductId, 1);
      pmAddBtn.textContent = `В корзине: ${inCartQty(state.activeProductId)} шт`;
    });
    pmMoreBtn.addEventListener('click', toggleSpecs);

    // Cart modal
    openCartBtn.addEventListener('click', () => openCart());
    checkoutBtn.addEventListener('click', () => openCart());
    closeCartBtn.addEventListener('click', () => closeOverlay(cartOverlay));
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) closeOverlay(cartOverlay);
    });

    cartList.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.dataset) return;

      if (t.dataset.step && t.dataset.id){
        addToCart(t.dataset.id, parseInt(t.dataset.step, 10));
      }
      if (t.dataset.del){
        addToCart(t.dataset.del, -999);
      }
    });

    applyPromoBtn.addEventListener('click', applyPromo);

    clearCartBtn.addEventListener('click', () => {
      state.cart = {};
      saveCart(state.cart);
      state.promo = null;
      savePromo(null);
      syncBar();
      renderCart();
      showToast('Корзина очищена');
      haptic();
    });

    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      placeOrder();
    });

    backToShopBtn.addEventListener('click', () => {
      closeOverlay(cartOverlay);
      showToast('Спасибо! Возвращаемся в каталог');
    });

    // Filter button
    openFilterBtn.addEventListener('click', openFilterSheet);

    // Esc close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape'){
        closeOverlay(productOverlay);
        closeOverlay(cartOverlay);
        if (filterOverlay) closeOverlay(filterOverlay);
      }
    });
  }

  function setSort(s){
    state.sort = s;
    sortPopular.dataset.active = (s === 'popular') ? 'true' : 'false';
    sortCheap.dataset.active = (s === 'cheap') ? 'true' : 'false';
    sortFast.dataset.active = (s === 'fast') ? 'true' : 'false';
    renderProducts();
    showToast(s === 'popular' ? 'Сортировка: популярные' : s === 'cheap' ? 'Сортировка: дешевле' : 'Сортировка: скорость');
    haptic();
  }

  function openCart(){
    renderCart();
    openOverlay(cartOverlay);
    haptic();
  }

  // ---------- Filter sheet ----------
  function openFilterSheet(){
    if (!filterOverlay){
      filterOverlay = document.createElement('div');
      filterOverlay.className = 'overlay';
      filterOverlay.id = 'filterOverlay';
      filterOverlay.innerHTML = `
        <div class="sheet">
          <div class="sheetHeader">
            <div class="sheetTitle">
              <div class="sheetName">Фильтры</div>
              <div class="sheetSub">Выбор типа и быстрые действия</div>
            </div>
            <button class="closeBtn" type="button" aria-label="Закрыть">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div style="padding:12px;">
            <div class="formTitle" style="margin:0 0 8px;">Тип</div>
            <div class="chips" id="filterChips"></div>

            <div class="formTitle" style="margin:12px 0 8px;">Действия</div>
            <button class="ghost wide" id="filterClear" type="button">Сбросить фильтры</button>
            <button class="btn wide" id="filterApply" type="button">Готово</button>

            <div class="hint">Фильтры применяются сразу. “Готово” — просто закрыть окно.</div>
          </div>
        </div>
      `;
      document.body.appendChild(filterOverlay);

      const closeBtn = qs('.closeBtn', filterOverlay);
      closeBtn.addEventListener('click', () => closeOverlay(filterOverlay));
      filterOverlay.addEventListener('click', (e) => { if (e.target === filterOverlay) closeOverlay(filterOverlay); });

      const fc = qs('#filterChips', filterOverlay);
      window.PRODUCT_TYPES.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = t;
        b.dataset.active = (t === state.type) ? 'true' : 'false';
        b.addEventListener('click', () => {
          state.type = t;
          // update both chip groups
          qsa('.chip', fc).forEach(x => x.dataset.active = (x.textContent === t) ? 'true' : 'false');
          qsa('.chip', typeChips).forEach(x => x.dataset.active = (x.textContent === t) ? 'true' : 'false');
          renderProducts();
          haptic();
        });
        fc.appendChild(b);
      });

      qs('#filterClear', filterOverlay).addEventListener('click', () => {
        state.type = 'Все';
        state.q = '';
        searchInput.value = '';
        setSort('popular');
        qsa('.chip', typeChips).forEach(x => x.dataset.active = (x.textContent === 'Все') ? 'true' : 'false');
        qsa('.chip', fc).forEach(x => x.dataset.active = (x.textContent === 'Все') ? 'true' : 'false');
        renderProducts();
        showToast('Фильтры сброшены');
        haptic();
      });

      qs('#filterApply', filterOverlay).addEventListener('click', () => closeOverlay(filterOverlay));
    } else {
      // sync chips active state
      const fc = qs('#filterChips', filterOverlay);
      qsa('.chip', fc).forEach(x => x.dataset.active = (x.textContent === state.type) ? 'true' : 'false');
    }

    openOverlay(filterOverlay);
    haptic();
  }

  // ---------- Promo / order ----------
  function applyPromo(){
    const code = (promoInput.value || '').trim().toUpperCase();
    if (!code){
      state.promo = null;
      savePromo(null);
      renderCart();
      showToast('Промокод удалён');
      return;
    }

    const p = window.PROMOS[code];
    if (!p){
      showToast('Промокод не найден');
      haptic();
      return;
    }

    state.promo = { code, ...p };
    savePromo(state.promo);
    renderCart();
    showToast(`Применено: ${p.note}`);
    haptic();
  }

  function placeOrder(){
    const items = cartItems();
    if (!items.length){
      showToast('Корзина пустая');
      return;
    }

    const fd = new FormData(orderForm);
    const name = String(fd.get('name')||'').trim();
    const phone = String(fd.get('phone')||'').trim();
    const address = String(fd.get('address')||'').trim();
    if (!name || !phone || !address){
      showToast('Заполни имя, телефон и адрес');
      return;
    }

    const subtotal = cartSubtotal();
    const discount = computeDiscount(subtotal);
    const after = Math.max(0, subtotal - discount);
    const ship = shippingCost(after);
    const total = after + ship;

    // pseudo order id
    const id = 'RC-' + Math.random().toString(16).slice(2, 6).toUpperCase() + '-' + Date.now().toString().slice(-4);

    successText.innerHTML = `
      Номер: <b>${escapeHtml(id)}</b><br>
      Получатель: <b>${escapeHtml(name)}</b><br>
      Телефон: <b>${escapeHtml(phone)}</b><br>
      Доставка: <b>${escapeHtml(address)}</b><br><br>
      Сумма: <b>${escapeHtml(fmt(total))}</b>
    `;

    // show success, clear cart
    orderForm.style.display = 'none';
    successBox.hidden = false;

    state.cart = {};
    saveCart(state.cart);
    syncBar();
    showToast('Заказ оформлен ✅');
    haptic();
  }

  // ---------- Overlay helpers ----------
  function openOverlay(el){
    el.dataset.open = 'true';
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay(el){
    if (!el || el.dataset.open !== 'true') return;
    el.dataset.open = 'false';
    el.setAttribute('aria-hidden', 'true');

    // If no overlays open, restore scroll
    const anyOpen = qsa('.overlay').some(o => o.dataset.open === 'true');
    if (!anyOpen) document.body.style.overflow = '';
  }

  // ---------- Utilities ----------
  function discountPct(p){
    if (p.oldPrice && p.oldPrice > p.price){
      return Math.round((1 - p.price/p.oldPrice) * 100);
    }
    return 0;
  }

  function showToast(text){
    toast.textContent = text;
    toast.dataset.show = 'true';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.dataset.show = 'false'; }, 1400);
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function svgNode(svgString){
    const tpl = document.createElement('template');
    tpl.innerHTML = svgString.trim();
    return tpl.content.firstChild;
  }

  function carSvg(){
    return `
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M18 38h32c3 0 6 2 6 6v4H8v-4c0-4 3-6 6-6Z" fill="rgba(255,255,255,.10)"/>
        <path d="M22 24h20l6 10H16l6-10Z" fill="rgba(255,255,255,.14)"/>
        <path d="M24 26h16l3 6H21l3-6Z" fill="rgba(255,255,255,.18)"/>
        <circle cx="18" cy="50" r="6" fill="rgba(255,255,255,.20)"/>
        <circle cx="46" cy="50" r="6" fill="rgba(255,255,255,.20)"/>
        <circle cx="18" cy="50" r="3" fill="rgba(255,255,255,.35)"/>
        <circle cx="46" cy="50" r="3" fill="rgba(255,255,255,.35)"/>
      </svg>
    `;
  }

  function haptic(){
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function loadCart(){
    try{
      const raw = localStorage.getItem('rc_cart');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveCart(cart){
    try{ localStorage.setItem('rc_cart', JSON.stringify(cart)); } catch {}
  }
  function loadPromo(){
    try{
      const raw = localStorage.getItem('rc_promo');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function savePromo(p){
    try{
      if (!p) localStorage.removeItem('rc_promo');
      else localStorage.setItem('rc_promo', JSON.stringify(p));
    } catch {}
  }
})();
