/* Volkssport frontend — vanilla JS, no dependencies.
   Data comes from /data/*.json through VS.data. In PrestaShop these values come from Smarty;
   every render function documents its PrestaShop source. */
(function () {
  'use strict';
  const VS = (window.VS = window.VS || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = new URLSearchParams(location.search);
  // Safe values for URLs/attributes: category ids are URL-encoded; image URLs must be https: or a relative path (no javascript:/data:).
  const cid = v => encodeURIComponent(String(v ?? ''));
  const safeUrl = u => { const s = String(u ?? '').trim(); return /^(https:\/\/|assets\/|\.\/|[a-z0-9_-]+\/)/i.test(s) && !/^(javascript|data|vbscript):/i.test(s) ? s : ''; };
  VS.$ = $; VS.$$ = $$; VS.esc = esc; VS.qs = qs; VS.cid = cid; VS.safeUrl = safeUrl;
  // One shared handler for broken images (replaces inline onerror attributes; CSP-friendly).
  document.addEventListener('error', e => { const t = e.target; if (!t || t.tagName !== 'IMG' || !t.dataset.err) return;
    if (t.dataset.err === 'card' && t.parentNode) t.parentNode.classList.add('is-error');
    if (t.dataset.err === 'post' && t.parentNode) t.parentNode.classList.add('is-empty');
    t.remove(); }, true);

  /* ---------- Icons ---------- */
  const P = { search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', heart: '<path d="M12 20s-7-4.4-9-9.2C1.8 7.6 4 4.5 7.2 4.5c2 0 3.6 1.2 4.8 2.9 1.2-1.7 2.8-2.9 4.8-2.9 3.2 0 5.4 3.1 4.2 6.3C19 15.6 12 20 12 20z"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', close: '<path d="M5 5l14 14M19 5L5 19"/>', chev: '<path d="M9 5l7 7-7 7"/>', back: '<path d="M15 5l-7 7 7 7"/>', home: '<path d="M3 11l9-7 9 7v9H3z"/>', grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>', expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/>', pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', filter: '<path d="M4 6h16M7 12h10M10 18h4"/>', ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>', fb: '<path d="M14 8h3V4h-3a4 4 0 00-4 4v2H7v4h3v7h4v-7h3l1-4h-4V8z"/>' };
  VS.icon = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[n] || ''}</svg>`;

  /* ---------- Stock state (one helper for every page) ----------
     quantity > 0 -> 'in' ("Stokda var") · quantity 0 -> 'out' ("Stokda yoxdur") · no quantity -> 'unknown' (no label).
     'unknown' is NOT treated as in stock: those products stay out of in-stock-only lists.
     STOCK_OVERRIDE = PROTOTYPE ONLY. Client confirmed these are in stock but the real quantity is unknown, so
     products.json is left unchanged. Do NOT carry this list into PrestaShop: fix the quantity in Admin instead. */
  const STOCK_OVERRIDE = { 3373: 'in' }; // H-1-12 Universal Skamya — client-confirmed in stock (2026-10-28)
  VS.stock = p => {
    if (!p) return 'unknown';
    if (STOCK_OVERRIDE[p.id_product]) return STOCK_OVERRIDE[p.id_product];
    const q = p.quantity;
    if (q === null || q === undefined || q === '' || Number.isNaN(Number(q))) return 'unknown';
    return Number(q) > 0 ? 'in' : 'out';
  };
  VS.inStock = p => VS.stock(p) === 'in';

  /* ---------- Data adapter (replace with PrestaShop Smarty / AJAX) ---------- */
  const cache = {};
  const load = url => (cache[url] = cache[url] || fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.json(); }));
  VS.data = {
    async products() { return load('data/products.json'); },
    async categories() { return load('data/categories.json'); },
    // Brand list + logos (PrestaShop: manufacturers with their Admin-uploaded image). Missing file → falls back to BRAND_LOGOS.
    async brands() { const d = await load('data/brands.json').catch(() => null); const list = d && d.brands ? d.brands : null; if (list) this._brandMap = new Map(list.map(b => [b.name.toLowerCase(), b])); return list; },
    money: n => (Number.isInteger(n) ? n.toLocaleString('az-AZ').replace(/,/g, ' ') : n.toFixed(2)) + ' AZN',
    flat(tree) { const out = []; const walk = (n, parents) => { out.push({ ...n, parents }); (n.children || []).forEach(c => walk(c, [...parents, n])); }; tree.forEach(n => walk(n, [])); return out; },
    find(tree, id) { return this.flat(tree).find(n => n.id === id) || null; },
    leafIds(node) { const ids = []; const walk = n => { ids.push(n.id); (n.children || []).forEach(walk); }; walk(node); return new Set(ids); },
    brandSlug(name) {
      const n = String(name || '').replace(/İ/g, 'I').toLowerCase().trim();
      const alias = { bh: 'bh-fitness', liveup: 'live-up', 'live up': 'live-up', 'ta sports': 'ta-sport', 'ta sport': 'ta-sport', 'nordic track': 'nordic-track', nordictrack: 'nordic-track', proform: 'pro-form', 'pro form': 'pro-form', 'body solid': 'body-solid', 'body-solid': 'body-solid', 'york': 'york-fitness', 'pro-action': 'pro-action', 'proaction': 'pro-action', 'body sculpture': 'body-sculpture' };
      return alias[n] || n.replace(/\s+/g, '-');
    },
    BRAND_LOGOS: new Set(['adidas', 'babolat', 'benlee', 'bh-fitness', 'body-sculpture', 'body-solid', 'butterfly', 'charly', 'constant', 'donic', 'dunlop', 'eleiko', 'everlast', 'fashy', 'greenhill', 'head', 'impetus', 'irest', 'joerex', 'joma', 'kettler', 'lion', 'live-up', 'livepro', 'marcy', 'molten', 'nakto', 'nike', 'nordic-track', 'pro-action', 'pro-form', 'reebok', 'sartor', 'skechers', 'slazenger', 'spalding', 'speedo', 'stiga', 'ta-sport', 'teeter', 'twins', 'venum', 'volksgym', 'wilson', 'wish', 'york-fitness']),
    brandLogo(name) {
      if (this._brandMap) { const b = this._brandMap.get(String(name || '').toLowerCase()); return b && b.logo ? b.logo : null; }
      const s = this.brandSlug(name); return this.BRAND_LOGOS.has(s) ? `assets/img/brands/${s}.png` : null;
    }
  };

  /* ---------- Wishlist (frontend only; PrestaShop: blockwishlist module) ---------- */
  const WKEY = 'vs_wishlist';
  VS.wish = {
    get() { try { return JSON.parse(localStorage.getItem(WKEY) || '[]'); } catch (e) { return []; } },
    has(id) { return this.get().includes(id); },
    toggle(id) { const l = this.get(); const i = l.indexOf(id); i < 0 ? l.push(id) : l.splice(i, 1); localStorage.setItem(WKEY, JSON.stringify(l)); this.sync(); return i < 0; },
    sync() { const n = this.get().length; $$('[data-wish-count]').forEach(el => { el.textContent = n; el.hidden = !n; }); }
  };

  /* ---------- Toast ---------- */
  VS.toast = (msg, type = '') => {
    let r = $('.vs-toast-region'); if (!r) { r = document.createElement('div'); r.className = 'vs-toast-region'; r.setAttribute('role', 'status'); r.setAttribute('aria-live', 'polite'); document.body.appendChild(r); }
    const t = document.createElement('div'); t.className = 'vs-toast' + (type ? ' vs-toast--' + type : ''); t.textContent = msg; r.appendChild(t);
    setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 300); }, 2600);
  };

  /* ---------- Product card (PrestaShop: catalog/_partials/miniatures/product.tpl) ---------- */
  VS.card = p => {
    const sale = p.regular_price && p.regular_price > p.price;
    const out = VS.stock(p) === 'out';
    const pct = sale ? Math.round((1 - p.price / p.regular_price) * 100) : 0;
    const url = 'product.html?id=' + p.id_product;
    // Hover image swap: second photo = first entry of optional `images` that differs from cover. None → no swap.
    const alt = (p.images || []).find(u => u && u !== p.cover);
    const priceHtml = p.price > 0
      ? `<div class="vs-price${sale ? ' vs-price--sale' : ''}"><span class="vs-price__current">${VS.data.money(p.price)}</span>${sale ? `<span class="vs-price__old">${VS.data.money(p.regular_price)}</span>` : ''}</div>`
      : `<div class="vs-price vs-price--call"><span class="vs-price__current">Qiymət üçün zəng edin</span></div>`;
    return `<article class="vs-card${out ? ' vs-card--out' : ''}" data-id="${p.id_product}">
  <div class="vs-card__media">
    <img src="${esc(p.cover)}" alt="${esc(p.name)}" loading="lazy" decoding="async" data-err="card">
    ${alt ? `<img class="vs-card__alt" src="${esc(alt)}" alt="" aria-hidden="true" loading="lazy" decoding="async" data-err="remove">` : ''}
    <div class="vs-card__badges">${p.is_new ? '<span class="vs-badge vs-badge--new">Yeni</span>' : ''}${sale ? `<span class="vs-badge vs-badge--sale">−${pct}%</span>` : ''}${out ? '<span class="vs-badge vs-badge--out">Stokda yoxdur</span>' : ''}</div>
    <button class="vs-iconbtn vs-iconbtn--round vs-card__wish" data-wish="${p.id_product}" aria-pressed="${VS.wish.has(p.id_product)}" aria-label="Seçilmişlərə əlavə et">${VS.icon('heart')}</button>
    <button class="vs-btn vs-btn--sm vs-btn--block vs-card__quick" data-quick="${p.id_product}">Sürətli baxış</button>
  </div>
  <div class="vs-card__body">
    ${p.manufacturer_name ? `<span class="vs-card__brand">${esc(p.manufacturer_name)}</span>` : ''}
    <h3 class="vs-card__name"><a href="${url}">${esc(p.name)}</a></h3>
    ${p.reference ? `<span class="vs-card__code">${esc(p.reference)}</span>` : ''}
    <div class="vs-card__price">${priceHtml}</div>
  </div>
</article>`;
  };
  VS.skeletons = n => Array.from({ length: n }, () => '<div class="vs-card vs-card--skeleton" aria-hidden="true"><div class="vs-card__media"></div><div class="vs-card__body"><span class="vs-skel" style="width:40%"></span><span class="vs-skel" style="width:90%"></span><span class="vs-skel" style="width:60%"></span></div></div>').join('');

  /* ---------- Includes (partials/*.html → Smarty {include}) ---------- */
  async function includes() {
    await Promise.all($$('[data-include]').map(async el => { const r = await fetch(el.dataset.include); el.outerHTML = await r.text(); }));
  }

  /* ---------- Header: mega menu, mobile nav, search, language ---------- */
  async function header() {
    const [rawTree, prods] = await Promise.all([VS.data.categories(), VS.data.products()]);
    // Hide menu entries that have no products (PrestaShop: only active categories with products)
    const used = new Set(prods.map(p => p.id_category_default));
    const prune = n => { const children = (n.children || []).map(prune).filter(Boolean); if (n.link || used.has(n.id) || children.length) return { ...n, children }; return null; };
    const tree = rawTree.map(prune).filter(Boolean);
    const nav = $('[data-nav]');
    if (nav) {
      nav.innerHTML = tree.map(n => {
        const href = n.link === 'blog' ? 'blog.html' : 'category.html?c=' + cid(n.id);
        const hasMega = n.children && n.children.length;
        return `<li class="vs-nav__item" data-id="${esc(n.id)}"><a class="vs-nav__link${n.id === 'sale' ? ' vs-nav__link--sale' : ''}" href="${href}" ${hasMega ? 'aria-haspopup="true" aria-expanded="false"' : ''}>${esc(n.name)}</a></li>`;
      }).join('');
      nav.parentElement.style.position = 'relative';
      const mega = document.createElement('div'); mega.className = 'vs-mega'; mega.setAttribute('role', 'region'); nav.parentElement.appendChild(mega);
      let timer;
      const open = li => {
        const n = tree.find(x => x.id === li.dataset.id); $$('.vs-nav__item').forEach(x => { x.classList.toggle('is-open', x === li); const a = x.firstElementChild; if (a.hasAttribute('aria-expanded')) a.setAttribute('aria-expanded', x === li); });
        if (!n || !n.children.length) { mega.classList.remove('is-open'); return; }
        const groups = n.children.length === 1 && n.children[0].children.length ? n.children[0].children.map(c => ({ ...c, children: [] })) : n.children;
        mega.innerHTML = `<div class="vs-container vs-mega__inner">${groups.map(g => `<div><a class="vs-mega__title" href="category.html?c=${cid(g.id)}">${esc(g.name)}</a>${g.children.length ? `<ul class="vs-mega__list">${g.children.map(c => `<li><a href="category.html?c=${cid(c.id)}">${esc(c.name)}</a></li>`).join('')}</ul>` : ''}</div>`).join('')}<div><a class="vs-mega__all" href="category.html?c=${cid(n.id)}">Hamısına bax →</a></div></div>`;
        mega.classList.add('is-open');
      };
      const close = () => { mega.classList.remove('is-open'); $$('.vs-nav__item').forEach(x => x.classList.remove('is-open')); };
      nav.addEventListener('mouseover', e => { const li = e.target.closest('.vs-nav__item'); if (li) { clearTimeout(timer); timer = setTimeout(() => open(li), 80); } });
      nav.addEventListener('focusin', e => { const li = e.target.closest('.vs-nav__item'); if (li) open(li); });
      nav.parentElement.addEventListener('mouseleave', () => { clearTimeout(timer); timer = setTimeout(close, 150); });
      mega.addEventListener('mouseenter', () => clearTimeout(timer));
      document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    }

    /* Mobile nav (drill-down) */
    const mnav = $('.vs-mnav');
    if (mnav) {
      const body = $('.vs-mnav__body', mnav);
      const render = (nodes, parent) => {
        body.innerHTML = (parent ? `<button class="vs-mnav__row vs-mnav__back" data-back>${VS.icon('back', 'width="18" height="18"')} Geri</button><a class="vs-mnav__row" href="category.html?c=${cid(parent.id)}">${esc(parent.name)} — hamısı</a>` : '') +
          nodes.map(n => n.children && n.children.length
            ? `<button class="vs-mnav__row${parent ? ' vs-mnav__row--sub' : ''}" data-drill="${esc(n.id)}">${esc(n.name)} ${VS.icon('chev', 'width="18" height="18"')}</button>`
            : `<a class="vs-mnav__row${parent ? ' vs-mnav__row--sub' : ''}" href="${n.link === 'blog' ? 'blog.html' : 'category.html?c=' + cid(n.id)}">${esc(n.name)}</a>`).join('');
        body.dataset.parent = parent ? parent.id : '';
      };
      render(tree, null);
      body.addEventListener('click', e => {
        const d = e.target.closest('[data-drill]'); if (d) { const n = VS.data.find(tree, d.dataset.drill); render(n.children, n); body.scrollTop = 0; }
        if (e.target.closest('[data-back]')) { const n = VS.data.flat(tree).find(x => x.id === body.dataset.parent); const up = n.parents[n.parents.length - 1]; render(up ? up.children : tree, up || null); }
      });
      const setOpen = v => { mnav.classList.toggle('is-open', v); document.body.classList.toggle('vs-no-scroll', v); };
      $$('[data-mnav-open]').forEach(b => b.addEventListener('click', () => setOpen(true)));
      $$('[data-mnav-close]', mnav).forEach(b => b.addEventListener('click', () => setOpen(false)));
    }

    /* Search overlay (PrestaShop: ps_searchbar AJAX) */
    const sp = $('.vs-searchpanel');
    if (sp) {
      const input = $('.vs-searchpanel__input', sp), res = $('[data-search-results]', sp), side = $('[data-search-side]', sp);
      const RKEY = 'vs_recent';
      const recent = () => { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch (e) { return []; } };
      const flat = VS.data.flat(tree);
      const mark = (t, q) => { const i = t.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
      const draw = async () => {
        const q = input.value.trim();
        if (!q) {
          const r = recent();
          side.innerHTML = (r.length ? `<div class="vs-searchpanel__group"><span class="vs-eyebrow">Son axtarışlar</span><ul class="vs-searchpanel__list">${r.map(x => `<li><a href="category.html?q=${encodeURIComponent(x)}">${esc(x)}</a></li>`).join('')}</ul></div>` : '') +
            `<div class="vs-searchpanel__group"><span class="vs-eyebrow">Populyar kateqoriyalar</span><ul class="vs-searchpanel__list">${['qacis', 'w-qantel', 'velo', 'idman-boks', 'm-kreslo'].map(id => flat.find(n => n.id === id)).filter(Boolean).map(n => `<li><a href="category.html?c=${cid(n.id)}">${esc(n.name)}</a></li>`).join('')}</ul></div>`;
          res.innerHTML = '<p class="vs-muted">Məhsul adı, kodu və ya brend yazın.</p>'; return;
        }
        res.innerHTML = `<div class="vs-grid">${VS.skeletons(4)}</div>`;
        const all = await VS.data.products(); const ql = q.toLowerCase();
        const hits = all.filter(p => (p.name + ' ' + p.reference + ' ' + p.manufacturer_name).toLowerCase().includes(ql));
        const cats = flat.filter(n => n.name.toLowerCase().includes(ql)).slice(0, 6);
        const brands = [...new Set(hits.map(p => p.manufacturer_name).filter(Boolean))].slice(0, 6);
        side.innerHTML = (cats.length ? `<div class="vs-searchpanel__group"><span class="vs-eyebrow">Kateqoriyalar</span><ul class="vs-searchpanel__list">${cats.map(n => `<li><a href="category.html?c=${cid(n.id)}">${mark(n.name, q)}</a></li>`).join('')}</ul></div>` : '') +
          (brands.length ? `<div class="vs-searchpanel__group"><span class="vs-eyebrow">Brendlər</span><ul class="vs-searchpanel__list">${brands.map(b => `<li><a href="category.html?brand=${encodeURIComponent(b)}">${esc(b)}</a></li>`).join('')}</ul></div>` : '');
        res.innerHTML = hits.length
          ? `<div class="vs-sechead"><span class="vs-eyebrow">${hits.length} məhsul</span><a class="vs-sechead__link" href="category.html?q=${encodeURIComponent(q)}">Bütün nəticələr →</a></div><div class="vs-grid">${hits.slice(0, 8).map(VS.card).join('')}</div>`
          : `<div class="vs-empty"><span class="vs-empty__title">“${esc(q)}” üzrə heç nə tapılmadı</span><span class="vs-empty__text">Yazılışı yoxlayın və ya daha qısa söz yazın, məsələn “qantel”.</span></div>`;
      };
      let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 160); });
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()) { const q = input.value.trim(); localStorage.setItem(RKEY, JSON.stringify([q, ...recent().filter(x => x !== q)].slice(0, 5))); location.href = 'category.html?q=' + encodeURIComponent(q); } });
      const setOpen = v => { sp.classList.toggle('is-open', v); document.body.classList.toggle('vs-no-scroll', v); if (v) { draw(); setTimeout(() => input.focus(), 50); } };
      $$('[data-search-open]').forEach(b => b.addEventListener('click', () => setOpen(true)));
      $$('[data-search-close]', sp).forEach(b => b.addEventListener('click', () => setOpen(false)));
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && sp.classList.contains('is-open')) setOpen(false); if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); } });
    }

    /* Account link state (demo; PrestaShop: $customer.is_logged) */
    try { const em = sessionStorage.getItem('vs_demo_session') || localStorage.getItem('vs_demo_session'); const u = em && JSON.parse(localStorage.getItem('vs_demo_users') || '{}')[em];
      if (u) $$('a[href="login.html"]').forEach(x => { x.href = 'account.html'; const lbl = x.querySelector('.vs-iconbtn__label'); if (lbl) lbl.textContent = u.first || 'Hesab'; else if (!x.querySelector('svg')) x.textContent = (u.first + ' ' + u.last).trim(); }); } catch (e) {}

    /* Language (PrestaShop: ps_languageselector — real URLs /az /ru /en) */
    const L = localStorage.getItem('vs_lang') || 'AZ';
    const setLang = code => { localStorage.setItem('vs_lang', code); $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === code)); if (window.VSI18N) window.VSI18N.set(code, document.body); };
    /* Keep all open tabs on one language: a switch in another tab used to leave this tab on the old language,
       and pages opened from it then mixed languages. Also re-sync when a page is restored from the back/forward cache. */
    window.addEventListener('storage', e => { if (e.key === 'vs_lang' && e.newValue) setLang(e.newValue); });
    window.addEventListener('pageshow', e => { if (e.persisted) setLang(localStorage.getItem('vs_lang') || 'AZ'); });
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => {
      setLang(b.dataset.lang);
      // Chosen from the mobile menu: close it so the translated page is visible
      const m = b.closest('.vs-mnav'); if (m) { m.classList.remove('is-open'); document.body.classList.remove('vs-no-scroll'); }
    }));
    setLang(L);
  }

  /* ---------- Global delegated actions ---------- */
  function globalActions() {
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let cur = null;
      const set = m => { if (cur === m) return; if (cur) cur.classList.remove('is-alt'); cur = m; if (m) m.classList.add('is-alt'); };
      document.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const card = e.target.closest && e.target.closest('.vs-card');
        const m = card && card.querySelector('.vs-card__media');
        if (!m || !m.querySelector('.vs-card__alt')) return set(null);
        const r = m.getBoundingClientRect();
        set(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? m : null);
      }, { passive: true });
      document.addEventListener('mouseleave', () => set(null));
    }
    /* Touch devices: no image swap; a tap on the photo opens the product page like any other link. */
    document.addEventListener('click', async e => {
      const w = e.target.closest('[data-wish]');
      if (w) { e.preventDefault(); const on = VS.wish.toggle(+w.dataset.wish); $$(`[data-wish="${w.dataset.wish}"]`).forEach(b => b.setAttribute('aria-pressed', on)); VS.toast(on ? 'Seçilmişlərə əlavə olundu' : 'Seçilmişlərdən silindi'); return; }
      const q = e.target.closest('[data-quick]');
      if (q) { e.preventDefault(); const all = await VS.data.products(); VS.quickView(all.find(p => p.id_product === +q.dataset.quick)); }
      const acc = e.target.closest('.vs-acc__head');
      if (acc) acc.setAttribute('aria-expanded', acc.getAttribute('aria-expanded') !== 'true');
    });
    VS.wish.sync();
  }

  /* ---------- Quick view modal ---------- */
  VS.modal = html => {
    const o = document.createElement('div'); o.className = 'vs-overlay';
    o.innerHTML = `<div class="vs-modal vs-modal--wide" role="dialog" aria-modal="true"><button class="vs-iconbtn vs-modal__close" data-close aria-label="Bağla">${VS.icon('close')}</button>${html}</div>`;
    document.body.appendChild(o); document.body.classList.add('vs-no-scroll');
    const prev = document.activeElement;
    requestAnimationFrame(() => { o.classList.add('is-open'); $('[data-close]', o).focus(); });
    const close = () => { o.classList.remove('is-open'); document.body.classList.remove('vs-no-scroll'); setTimeout(() => o.remove(), 250); prev && prev.focus(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const f = $$('a,button,input,select', o); if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } } };
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', key);
    return { el: o, close };
  };
  VS.quickView = p => {
    if (!p) return;
    const sale = p.regular_price > p.price;
    VS.modal(`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;align-items:center">
      <div class="vs-gallery__main" style="cursor:default"><img src="${esc(p.cover)}" alt="${esc(p.name)}"></div>
      <div class="vs-buybox">${p.manufacturer_name ? `<span class="vs-buybox__brandtext">${esc(p.manufacturer_name)}</span>` : ''}
        <h2 class="vs-buybox__name" style="font-size:26px">${esc(p.name)}</h2>
        ${p.reference ? `<span class="vs-card__code">Kod: ${esc(p.reference)}</span>` : ''}
        <div class="vs-price${sale ? ' vs-price--sale' : ''}"><span class="vs-price__current">${p.price > 0 ? VS.data.money(p.price) : 'Qiymət üçün zəng edin'}</span>${sale ? `<span class="vs-price__old">${VS.data.money(p.regular_price)}</span>` : ''}</div>
        <a class="vs-btn vs-btn--block" href="product.html?id=${p.id_product}">Məhsula bax</a></div></div>`);
  };

  /* ---------- Scroll performance ----------
     Hover effects (image scale, logo filter) on large product photos were re-triggered for every card the
     cursor passed during wheel scrolling. While the page scrolls, html.vs-is-scrolling disables pointer
     events on image cards; they come back 150 ms after scrolling stops. Passive listener — never blocks scroll. */
  (function scrollHoverGuard() {
    let t; const root = document.documentElement;
    window.addEventListener('scroll', () => { if (!root.classList.contains('vs-is-scrolling')) root.classList.add('vs-is-scrolling'); clearTimeout(t); t = setTimeout(() => root.classList.remove('vs-is-scrolling'), 150); }, { passive: true });
  })();

  /* ---------- Boot ---------- */
  VS.ready = (async () => {
    await Promise.all([includes(), VS.data.brands()]);
    globalActions();
    await header();
    const page = document.body.dataset.page;
    if (VS.pages && VS.pages[page]) await VS.pages[page]();
  })().catch(err => { console.error(err); VS.toast('Məlumat yüklənmədi', 'error'); });
})();
