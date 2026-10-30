/* Page controllers. Each maps to a PrestaShop controller/template:
   home → index.tpl · category → catalog/listing/category.tpl · product → catalog/product.tpl */
(function () {
  'use strict';
  const VS = window.VS; const { $, $$, esc } = VS;
  VS.pages = VS.pages || {};
  // Brand grid: only brands that have a logo, sorted by product count.
  VS.renderBrands = all => {
    const el = $('[data-brands]'); if (!el) return;
    const brandCard = b => { const logo = VS.data.brandLogo(b); return `<a class="vs-brandcard" href="category.html?brand=${encodeURIComponent(b)}" aria-label="${esc(b)}">${logo ? `<img src="${esc(VS.safeUrl(logo))}" alt="${esc(b)}" loading="lazy" decoding="async">` : `<span class="vs-brandcard__name">${esc(b)}</span>`}</a>`; };
    const bc = {}; all.forEach(p => { if (p.manufacturer_name) bc[p.manufacturer_name] = (bc[p.manufacturer_name] || 0) + 1; });
    // Only brands listed in data/brands.json (PrestaShop: active manufacturers) and that have products.
    const listed = VS.data._brandMap ? [...VS.data._brandMap.values()].map(b => b.name) : Object.keys(bc);
    // Only brands with a logo are shown (no text fallback in the grid).
    el.innerHTML = listed.filter(b => bc[b] && VS.data.brandLogo(b)).map(b => [b, bc[b]]).sort((a, b) => (!!VS.data.brandLogo(b[0]) - !!VS.data.brandLogo(a[0])) || b[1] - a[1]).map(([b]) => brandCard(b)).join('');
  };
  // Drop a crumb when it repeats the next one's name (e.g. Masajorlar › Masajorlar)
  const dedupe = list => list.filter((c, i) => !list[i + 1] || list[i + 1][0] !== c[0]);

  /* ================= HOME ================= */
  VS.pages.home = async () => {
    $$('[data-rail]').forEach(el => { el.innerHTML = VS.skeletons(4); });
    const hero = VS.qs.get('hero') === 'b' ? 'b' : 'a';
    $$('[data-hero]').forEach(el => { el.hidden = el.dataset.hero !== hero; });
    const all = await VS.data.products();
    const rail = (sel, list) => { const el = $(sel); if (el) el.innerHTML = list.length ? list.map(VS.card).join('') : ''; };
    const uniqBy = (list, key, n) => { const seen = new Set(); return list.filter(p => { const k = key(p); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, n); };
    // Yeni gələnlər — PROTOTYPE selection: in stock, price > 0, sorted by id_product descending (rail 12, listing 48).
    // id_product order is a stand-in; it does not prove when a product was added. Production: PrestaShop new-products data (see PRESTASHOP-INTEGRATION.md §5.5).
    rail('[data-rail="new"]', all.filter(p => VS.inStock(p) && p.price > 0).sort((a, b) => b.id_product - a.id_product).slice(0, 12));
    // Məşqə başlamaq üçün — PROTOTYPE curated rail: 30–300 AZN, in stock, with image; one product per category,
    // categories in this order (accessories and small equipment first). Production: Admin-managed selection (PRESTASHOP-INTEGRATION.md §5.11).
    const START_CATS = ['w-qantel', 'a-3', 'a-top', 'a-mat', 'oturacaq', 'a-10', 'w-kb', 'f-pres', 'a-2', 'turnik', 'a-5', 'f-esp', 'w-qrif', 'step'];
    const inBand = (p, lo, hi) => VS.inStock(p) && p.price >= lo && p.price <= hi && p.cover;
    const start = START_CATS.map(c => all.filter(p => p.id_category_default === c && inBand(p, 30, 300)).sort((a, b) => a.price - b.price)[0]).filter(Boolean).slice(0, 12);
    // Client request: two cards swapped in place (outside the 30–300 band by design): 50729 → H-23-4 (8.50 AZN mat), 800-040 → LP8076-1.
    const START_SWAP = { '50729': 'H-23-4', '800-040': 'LP8076-1' };
    const startList = start.map(p => START_SWAP[p.reference] ? (all.find(q => q.reference === START_SWAP[p.reference] && VS.inStock(q) && q.price > 0 && q.cover) || p) : p);
    rail('[data-rail="start"]', startList);
    const sale = all.filter(p => p.regular_price > p.price && VS.inStock(p)).sort((a, b) => (b.regular_price - b.price) - (a.regular_price - a.price));
    rail('[data-rail="sale"]', uniqBy(sale, p => p.name.split(' ')[0], 8));
    const tree = await VS.data.categories();
    const kardio = VS.data.leafIds(VS.data.find(tree, 'fitness-kardio-trenajorlar'));
    // Client request: only affordable rowing machines (< 1 000 AZN) on the home cardio rail; the rest stay in their category.
    rail('[data-rail="kardio"]', uniqBy(all.filter(p => kardio.has(p.id_category_default) && VS.inStock(p) && p.price > 0 && !(p.id_category_default === 'avar' && p.price >= 1000)).sort((a, b) => (b.id_category_default === 'qacis') - (a.id_category_default === 'qacis')), p => p.id_category_default + p.manufacturer_name, 8));
    const strength = VS.data.leafIds(VS.data.find(tree, 'fitness-guc-trenajoru'));
    VS.renderBrands(all);
    // Professional fitness — PROTOTYPE tiered order: up to 3 per price band, one per subcategory within each band, bands 300–700 → 700–1 500 → over 1 500.
    // Expensive machines stay in the rail, after the mid-range ones. Production: Admin-managed order (§5.11).
    // Client request: these references are not shown in this rail (still listed in their categories).
    // US2012 and VG-68WB: client reported out of stock (live) — hidden here; their quantity in prototype data is unchanged.
    const PRO_EXCLUDE = new Set(['1713', 'VG-98B', 'VGPH-33', 'VG-2HG', 'US2012', 'VG-68WB']);
    // Client request: in-stock strength machines pinned into the slots of the two hidden products (positions 1 and 4).
    const PRO_PIN = [['VG-87HG', 0], ['S6-026A', 3]];
    const strengthOk = all.filter(p => strength.has(p.id_category_default) && VS.inStock(p) && p.price > 0 && p.cover && !PRO_EXCLUDE.has(p.reference));
    const proBands = [[300, 700], [700, 1500], [1500, Infinity]];
    const pro = proBands.flatMap(([lo, hi]) => { const used = new Set(); return strengthOk.filter(p => p.price >= lo && p.price < hi).sort((a, b) => a.price - b.price).filter(p => { if (used.has(p.id_category_default)) return false; used.add(p.id_category_default); return true; }).slice(0, 3); });
    const pinned = PRO_PIN.map(([ref, i]) => [strengthOk.find(p => p.reference === ref), i]).filter(([p]) => p);
    const proList = pro.filter(p => !pinned.some(([q]) => q.id_product === p.id_product));
    pinned.forEach(([p, i]) => proList.splice(i, 0, p));
    rail('[data-rail="pro"]', proList.slice(0, 9));
  };

  /* ================= CATEGORY ================= */
  // Default sort on every listing = 'new' (newest first). The prototype has no date-added field, so 'new' orders by id_product
  // descending (higher id = created later in PrestaShop). Production: sort by date_add. "Best sellers" removed: no sales data.
  const DEFAULT_SORT = 'new';
  const SORTS = [['new', 'Yenilər'], ['az', 'Ad A-Z'], ['za', 'Ad Z-A'], ['asc', 'Ucuzdan bahaya'], ['desc', 'Bahadan ucuza']];
  const PER_PAGE = 24;
  VS.pages.category = async () => {
    const [all, tree] = await Promise.all([VS.data.products(), VS.data.categories()]);
    const flat = VS.data.flat(tree);
    const st = Object.fromEntries(VS.qs.entries());
    const root = $('[data-category]');

    const node = st.c && st.c !== 'sale' ? flat.find(n => n.id === st.c) : null;
    let base, title, crumbs = [['Ana səhifə', 'index.html']];
    if (st.wishlist) { const ids = VS.wish.get(); base = all.filter(p => ids.includes(p.id_product)); title = 'Seçilmişlər'; }
    else if (st.q) { const q = st.q.toLowerCase(); base = all.filter(p => (p.name + ' ' + p.reference + ' ' + p.manufacturer_name).toLowerCase().includes(q)); title = '“' + st.q + '” üzrə nəticələr'; }
    else if (st.new) { base = all.filter(p => VS.inStock(p) && p.price > 0).sort((a, b) => b.id_product - a.id_product).slice(0, 48); title = 'Yeni gələnlər'; }
    else if (st.c === 'sale') { base = all.filter(p => p.regular_price > p.price); title = 'Endirimli məhsullar'; }
    else if (st.brand) { base = all.filter(p => p.manufacturer_name.toLowerCase() === st.brand.toLowerCase()); title = st.brand; crumbs.push(['Brendlər', null]); }
    else if (node) { const ids = VS.data.leafIds(node); base = all.filter(p => ids.has(p.id_category_default)); title = node.name; node.parents.forEach(p => crumbs.push([p.name, 'category.html?c=' + VS.cid(p.id)])); }
    else { base = all; title = 'Bütün məhsullar'; }
    crumbs.push([title, null]);
    document.title = title + ' — VOLKS SPORT';

    // Subcategory chips: children of current node, or siblings when on a leaf. Empty ones are hidden.
    const countIn = n => { const ids = VS.data.leafIds(n); return all.filter(p => ids.has(p.id_category_default)).length; };
    let chipNodes = [], chipParent = null;
    if (node && (node.children || []).length) { chipParent = node; chipNodes = node.children; if (chipNodes.length === 1 && (chipNodes[0].children || []).length) { chipParent = chipNodes[0]; chipNodes = chipParent.children; } }
    else if (node && node.parents.length) { chipParent = node.parents[node.parents.length - 1]; chipNodes = chipParent.children; }
    const chips = chipNodes.map(n => ({ n, count: countIn(n) })).filter(x => x.count > 0);

    crumbs = dedupe(crumbs);
    $('[data-crumbs]', root).innerHTML = crumbs.map(([t, h]) => h ? `<li><a href="${h}">${esc(t)}</a></li>` : `<li><span aria-current="page">${esc(t)}</span></li>`).join('');
    $('[data-title]', root).textContent = title;
    $('[data-chips]', root).innerHTML = chips.length ? (chipParent && node !== chipParent ? `<a class="vs-chip" href="category.html?c=${VS.cid(chipParent.id)}">Hamısı</a>` : '') + chips.map(({ n, count }) => `<a class="vs-chip${n.id === st.c ? ' is-active' : ''}" href="category.html?c=${VS.cid(n.id)}" ${n.id === st.c ? 'aria-current="true"' : ''}>${esc(n.name)} <span class="vs-chip__count">${count}</span></a>`).join('') : '';

    // Filters (PrestaShop: ps_facetedsearch). Options only show values that exist in the current set.
    const f = { brands: (st.f_brand || '').split(',').filter(Boolean), min: st.pmin || '', max: st.pmax || '', stock: st.stock === '1', sort: SORTS.some(([k]) => k === st.sort) ? st.sort : DEFAULT_SORT, page: +st.p || 1 };
    const brandCounts = {}; base.forEach(p => { if (p.manufacturer_name) brandCounts[p.manufacturer_name] = (brandCounts[p.manufacturer_name] || 0) + 1; });
    const brands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);
    const hasOut = base.some(p => VS.stock(p) === 'out');
    const prices = base.map(p => p.price).filter(n => n > 0);
    const pMin = prices.length ? Math.floor(Math.min(...prices)) : 0, pMax = prices.length ? Math.ceil(Math.max(...prices)) : 0;

    const filtersHtml = () => `
      ${brands.length > 1 ? `<div class="vs-acc__item vs-filters__group"><button class="vs-acc__head" aria-expanded="true">Brend</button><div class="vs-acc__body"><div class="vs-acc__inner"><div class="vs-filters__list">${brands.map(([b, c]) => `<label class="vs-check"><input type="checkbox" data-f="brand" value="${esc(b)}" ${f.brands.includes(b) ? 'checked' : ''}>${esc(b)}<span class="vs-check__count">${c}</span></label>`).join('')}</div></div></div></div>` : ''}
      ${prices.length > 1 && pMin !== pMax ? `<div class="vs-acc__item vs-filters__group"><button class="vs-acc__head" aria-expanded="true">Qiymət, AZN</button><div class="vs-acc__body"><div class="vs-acc__inner"><div class="vs-filters__range"><input class="vs-input" type="number" inputmode="numeric" data-f="min" placeholder="${pMin}" value="${esc(f.min)}" aria-label="Minimum qiymət"><input class="vs-input" type="number" inputmode="numeric" data-f="max" placeholder="${pMax}" value="${esc(f.max)}" aria-label="Maksimum qiymət"></div></div></div></div>` : ''}
      ${hasOut ? `<div class="vs-acc__item vs-filters__group"><button class="vs-acc__head" aria-expanded="true">Mövcudluq</button><div class="vs-acc__body"><div class="vs-acc__inner"><label class="vs-check"><input type="checkbox" data-f="stock" ${f.stock ? 'checked' : ''}>Stokda var</label></div></div></div>` : ''}`;

    const sortSel = $('[data-sort]', root);
    sortSel.innerHTML = SORTS.map(([k, t]) => `<option value="${k}" ${k === f.sort ? 'selected' : ''}>${t}</option>`).join('');

    const apply = () => {
      let list = base.filter(p => (!f.brands.length || f.brands.includes(p.manufacturer_name)) && (!f.min || p.price >= +f.min) && (!f.max || p.price <= +f.max) && (!f.stock || VS.inStock(p)));
      const cmp = { az: (a, b) => a.name.localeCompare(b.name, 'az'), za: (a, b) => b.name.localeCompare(a.name, 'az'), asc: (a, b) => (a.price || 1e9) - (b.price || 1e9), desc: (a, b) => b.price - a.price, new: (a, b) => b.id_product - a.id_product, dflt: (a, b) => VS.inStock(b) - VS.inStock(a) };
      list = [...list].sort(cmp[f.sort] || cmp.dflt);
      const pages = Math.max(1, Math.ceil(list.length / PER_PAGE)); f.page = Math.min(f.page, pages);
      const slice = list.slice((f.page - 1) * PER_PAGE, f.page * PER_PAGE);

      $('[data-count]', root).textContent = list.length + ' məhsul';
      const active = [...f.brands.map(b => ['brand', b, b]), ...(f.min ? [['min', f.min, f.min + ' AZN-dən']] : []), ...(f.max ? [['max', f.max, f.max + ' AZN-dək']] : []), ...(f.stock ? [['stock', '1', 'Stokda var']] : [])];
      $('[data-active]', root).innerHTML = active.length ? active.map(([k, v, t]) => `<button class="vs-chip vs-chip--removable" data-remove="${k}" data-value="${esc(v)}">${esc(t)}</button>`).join('') + '<button class="vs-btn vs-btn--ghost vs-btn--sm" data-clear>Təmizlə</button>' : '';
      $('[data-grid]', root).innerHTML = slice.length ? slice.map(VS.card).join('') : '';
      $('[data-empty]', root).hidden = !!slice.length;
      $('[data-pager]', root).innerHTML = pages > 1 ? pager(f.page, pages) : '';
      $$('[data-filter-count]').forEach(el => { el.textContent = active.length ? '(' + active.length + ')' : ''; });
      $$('[data-sheet-apply]').forEach(b => { b.textContent = list.length + ' məhsulu göstər'; });

      const u = new URLSearchParams(); ['c', 'q', 'brand', 'wishlist', 'new'].forEach(k => st[k] && u.set(k, st[k]));
      if (f.brands.length) u.set('f_brand', f.brands.join(',')); if (f.min) u.set('pmin', f.min); if (f.max) u.set('pmax', f.max); if (f.stock) u.set('stock', '1'); if (f.sort !== DEFAULT_SORT) u.set('sort', f.sort); if (f.page > 1) u.set('p', f.page);
      history.replaceState(null, '', '?' + u.toString());
    };
    const pager = (cur, total) => {
      const nums = [...new Set([1, cur - 1, cur, cur + 1, total])].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
      let h = `<button class="vs-pagination__item" data-page="${cur - 1}" ${cur === 1 ? 'disabled' : ''} aria-label="Əvvəlki">‹</button>`;
      nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) h += '<span class="vs-pagination__gap">…</span>'; h += `<button class="vs-pagination__item" data-page="${n}" ${n === cur ? 'aria-current="page"' : ''}>${n}</button>`; });
      return h + `<button class="vs-pagination__item" data-page="${cur + 1}" ${cur === total ? 'disabled' : ''} aria-label="Növbəti">›</button>`;
    };

    const renderFilters = () => { $$('[data-filters]').forEach(el => { el.innerHTML = filtersHtml(); }); };
    renderFilters(); apply();

    const onChange = e => {
      const t = e.target; if (!t.dataset.f) return;
      if (t.dataset.f === 'brand') { f.brands = $$('[data-f="brand"]:checked', t.closest('[data-filters]')).map(x => x.value); }
      if (t.dataset.f === 'min') f.min = t.value; if (t.dataset.f === 'max') f.max = t.value;
      if (t.dataset.f === 'stock') f.stock = t.checked;
      f.page = 1; apply();
      if (!t.closest('.vs-sheet')) renderFilters();
    };
    document.addEventListener('change', onChange);
    sortSel.addEventListener('change', () => { f.sort = sortSel.value; f.page = 1; apply(); });
    root.addEventListener('click', e => {
      const pg = e.target.closest('.vs-pagination__item[data-page]'); if (pg && !pg.disabled) { f.page = +pg.dataset.page; apply(); window.scrollTo({ top: root.offsetTop - 40, behavior: 'smooth' }); }
      const rm = e.target.closest('[data-remove]'); if (rm) { const k = rm.dataset.remove; if (k === 'brand') f.brands = f.brands.filter(b => b !== rm.dataset.value); else if (k === 'stock') f.stock = false; else f[k] = ''; f.page = 1; renderFilters(); apply(); }
      if (e.target.closest('[data-clear]')) { f.brands = []; f.min = f.max = ''; f.stock = false; f.page = 1; renderFilters(); apply(); }
    });

    // Mobile filter sheet
    const sheet = $('.vs-sheet'), scrim = $('.vs-scrim');
    const setSheet = v => { sheet.classList.toggle('is-open', v); scrim.classList.toggle('is-open', v); document.body.classList.toggle('vs-no-scroll', v); };
    $$('[data-sheet-open]').forEach(b => b.addEventListener('click', () => setSheet(true)));
    $$('[data-sheet-close], [data-sheet-apply]').forEach(b => b.addEventListener('click', () => { setSheet(false); renderFilters(); }));
    scrim.addEventListener('click', () => setSheet(false));
  };

  /* ================= PRODUCT ================= */
  VS.pages.product = async () => {
    const [all, tree] = await Promise.all([VS.data.products(), VS.data.categories()]);
    const id = +VS.qs.get('id');
    const p = all.find(x => x.id_product === id);
    const root = $('[data-product]');
    if (!p) { root.innerHTML = `<div class="vs-container vs-empty"><span class="vs-empty__title">Məhsul tapılmadı</span><span class="vs-empty__text">Bu məhsul silinib və ya link səhvdir.</span><a class="vs-btn" href="category.html">Kataloqa keç</a></div>`; return; }
    document.title = p.name + ' — VOLKS SPORT';
    const flat = VS.data.flat(tree);
    const cat = flat.find(n => n.id === p.id_category_default);
    let crumbs = [['Ana səhifə', 'index.html'], ...(cat ? [...cat.parents, cat].map(n => [n.name, 'category.html?c=' + VS.cid(n.id)]) : []), [p.reference || p.name, null]];
    const sale = p.regular_price > p.price;
    const st0 = VS.stock(p); const stock = st0 === 'in' ? ['in', 'Stokda var'] : st0 === 'out' ? ['out', 'Stokda yoxdur'] : ['unknown', ''];
    const logo = VS.data.brandLogo(p.manufacturer_name);
    // Cover stays first (default main image); optional `images` holds extra gallery photos only.
    const images = [...new Set([p.cover, ...(p.images || [])].filter(Boolean))];
    const noImage = !images.length; if (noImage) images.push('');

    crumbs = dedupe(crumbs);
    $('[data-crumbs]', root).innerHTML = crumbs.map(([t, h]) => h ? `<li><a href="${h}">${esc(t)}</a></li>` : `<li><span aria-current="page">${esc(t)}</span></li>`).join('');
    $('[data-thumbs]', root).innerHTML = noImage ? '' : images.map((src, i) => `<button class="vs-gallery__thumb" data-thumb="${i}" ${i ? '' : 'aria-current="true"'} aria-label="Şəkil ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('');
    const mainImg = $('[data-main]', root); mainImg.alt = p.name;
    // No image in the data: show the same empty state as product cards instead of a broken image.
    if (noImage) { mainImg.removeAttribute('src'); mainImg.hidden = true; $('.vs-gallery__main', root).classList.add('is-empty'); } else mainImg.src = images[0];
    $('[data-brand]', root).innerHTML = p.manufacturer_name ? (logo ? `<a href="category.html?brand=${encodeURIComponent(p.manufacturer_name)}"><img src="${esc(VS.safeUrl(logo))}" alt="${esc(p.manufacturer_name)}"></a>` : `<a class="vs-buybox__brandtext" href="category.html?brand=${encodeURIComponent(p.manufacturer_name)}">${esc(p.manufacturer_name)}</a>`) : '';
    $('[data-name]', root).textContent = p.name;
    // Short description (PrestaShop: description_short). Plain text, one line per row. Hidden when empty or same as full text.
    const shortEl = $('[data-short]', root);
    // Not shown when the product has a spec table — the short text repeats the same values (client request).
    const shortLines = String(p.description_short || '').split('\n').map(l => l.trim()).filter(Boolean);
    const inTable = l => (p.features || []).some(f => l.replace(/\s+/g, '').toLowerCase().includes(String(f.value).replace(/\s+/g, '').toLowerCase()));
    // Specs taken from the description text: hide the short text only if all its lines repeat table values.
    // Other products with a spec table: hide it when any line repeats a table value (prose-only short text stays visible).
    const hideShort = p.features_from_text ? shortLines.every(inTable) : !!(p.features && p.features.length) && shortLines.some(inTable);
    if (shortLines.length && !hideShort && p.description_short.trim() !== String(p.description_plain || '').trim()) { shortEl.innerHTML = p.description_short.split('\n').map(l => l.trim()).filter(Boolean).map(l => `<p>${esc(l)}</p>`).join(''); shortEl.hidden = false; }
    const stockText = stock[1];
    const priceText = p.price > 0 ? VS.data.money(p.price) : 'Zəng edin';
    $('[data-code]', root).textContent = p.reference ? 'Kod: ' + p.reference : '';
    $('[data-meta]', root).hidden = true; // no review/rating data — reviews removed from the product page
    $('[data-stock]', root).innerHTML = stockText ? `<span class="vs-stock vs-stock--${stock[0]}">${stockText}</span>` : '';
    $('[data-facts]', root).innerHTML = [['Brend', p.manufacturer_name || '—'], ['Kod', p.reference || '—'], ['Stok', stockText || '—']].map(([k, v]) => `<div class="vs-facts__cell"><span class="vs-facts__k">${k}</span><span class="vs-facts__v">${esc(v)}</span></div>`).join('');
    $('[data-price]', root).innerHTML = p.price > 0
      ? `<div class="vs-price vs-price--lg${sale ? ' vs-price--sale' : ''}"><span class="vs-price__current">${VS.data.money(p.price)}</span>${sale ? `<span class="vs-price__old">${VS.data.money(p.regular_price)}</span><span class="vs-price__save">−${Math.round((1 - p.price / p.regular_price) * 100)}% · −${VS.data.money(p.regular_price - p.price)}</span>` : ''}</div>`
      : `<div class="vs-price vs-price--call vs-price--lg"><span class="vs-price__current" style="font-size:22px">Qiymət üçün zəng edin</span></div>`;

    // Tabs — only those with real data are rendered
    const feats = p.features || [];
    const rows = [...feats.map(x => [x.name, x.value]), ['Brend', p.manufacturer_name || '—'], ['Kod (reference)', p.reference || '—'], ['Mövcudluq', stockText]];
    const peers = [p, ...all.filter(x => x.id_category_default === p.id_category_default && x.id_product !== p.id_product && VS.inStock(x)).slice(0, 2)];
    const cmpRows = [['Kod', x => x.reference || '—'], ['Brend', x => x.manufacturer_name || '—'], ['Qiymət', x => x.price > 0 ? VS.data.money(x.price) : '—'], ['Stok', x => ({ in: 'Var', out: 'Yoxdur' })[VS.stock(x)] || '—']];
    const specHtml = `<div class="vs-specgrid">
      <div>
        <table class="vs-spec vs-spec--plain"><tbody>${rows.map(([k, v], i) => `<tr><th scope="row"${i < feats.length ? ' data-i18n-ctx="spec"' : ''}>${esc(k)}</th><td${i < feats.length ? ' data-no-i18n' : ''}>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
      ${peers.length > 1 ? `<div><div class="vs-specgrid__head"><h3 class="vs-eyebrow vs-specgrid__title">Müqayisə et</h3>${cat ? `<a href="category.html?c=${VS.cid(cat.id)}">${esc(cat.name)}</a>` : ''}</div>
        <div class="vs-compare-wrap"><table class="vs-compare"><thead><tr><td></td>${peers.map((x, i) => `<th scope="col" class="${i ? '' : 'is-current'}">${i ? `<a href="product.html?id=${x.id_product}">${esc(x.name)}</a>` : esc(x.name)}</th>`).join('')}</tr></thead>
        <tbody>${cmpRows.map(([k, fn]) => `<tr><th scope="row">${k}</th>${peers.map((x, i) => `<td class="${i ? '' : 'is-current'}">${esc(fn(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}
    </div>`;
    const tabs = [
      ['spec', '<span class="vs-tabs__full">Texniki xüsusiyyətlər</span><span class="vs-tabs__short" aria-hidden="true">Xarakteristikalar</span>', specHtml],
      ['desc', 'Təsvir', p.description ? `<div class="vs-desc">${p.description}</div>` : '<p class="vs-muted">Bu məhsul üçün təsvir əlavə olunmayıb.</p>']
    ];
    const tabsEl = $('[data-tabs]', root);
    if (!tabs.length) tabsEl.hidden = true;
    else {
      tabsEl.innerHTML = `<div class="vs-tabs__list" role="tablist">${tabs.map(([k, t], i) => `<button class="vs-tabs__tab" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${!i}" tabindex="${i ? -1 : 0}">${t}</button>`).join('')}</div>${tabs.map(([k, , h], i) => `<div class="vs-tabs__panel" role="tabpanel" id="panel-${k}" aria-labelledby="tab-${k}" ${i ? 'hidden' : ''}>${h}</div>`).join('')}`;
      const select = btn => { $$('[role="tab"]', tabsEl).forEach(b => { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).hidden = !on; }); btn.focus(); };
      tabsEl.addEventListener('click', e => { const b = e.target.closest('[role="tab"]'); if (b) select(b); });
      tabsEl.addEventListener('keydown', e => { const list = $$('[role="tab"]', tabsEl); const i = list.indexOf(document.activeElement); if (i < 0) return; if (e.key === 'ArrowRight') select(list[(i + 1) % list.length]); if (e.key === 'ArrowLeft') select(list[(i - 1 + list.length) % list.length]); });
    }

    // Related: same category, in stock first
    const rel = all.filter(x => x.id_category_default === p.id_category_default && x.id_product !== p.id_product).sort((a, b) => VS.inStock(b) - VS.inStock(a)).slice(0, 8);
    const relEl = $('[data-related]');
    if (rel.length) $('[data-rail]', relEl).innerHTML = rel.map(VS.card).join(''); else relEl.hidden = true;

    // Gallery: hover zoom, thumbs, fullscreen with click-to-zoom
    const main = $('.vs-gallery__main', root);
    main.addEventListener('mousemove', e => { const r = main.getBoundingClientRect(); main.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); main.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%'); });
    main.addEventListener('mouseenter', () => { if (!noImage && matchMedia('(hover:hover)').matches && !document.documentElement.classList.contains('vs-is-scrolling')) main.classList.add('is-zoom'); });
    window.addEventListener('scroll', () => main.classList.remove('is-zoom'), { passive: true });
    main.addEventListener('mouseleave', () => main.classList.remove('is-zoom'));
    let cur = 0;
    const show = i => { if (noImage) return; cur = (i + images.length) % images.length; mainImg.src = images[cur]; $$('[data-thumb]', root).forEach(t => t.setAttribute('aria-current', +t.dataset.thumb === cur)); if (viewImg.getAttribute('src') !== images[cur]) viewer.classList.remove('is-error'); viewImg.src = images[cur]; viewCount.textContent = (cur + 1) + ' / ' + images.length; syncViewThumbs(); };
    const viewer = $('.vs-viewer'), viewImg = $('[data-view-img]', viewer), viewCount = $('[data-view-count]', viewer);
    viewImg.alt = p.name;
    // Fullscreen gallery: arrows, thumbnail strip, keyboard, swipe. Uses the same images array as the page gallery (cover + images[]).
    const viewThumbs = $('[data-view-thumbs]', viewer), multi = !noImage && images.length > 1;
    viewer.classList.toggle('is-single', !multi);
    if (multi) viewThumbs.innerHTML = images.map((src, i) => `<button class="vs-viewer__thumb" type="button" data-vthumb="${i}" aria-label="Şəkil ${i + 1} / ${images.length}"><img src="${VS.esc(src)}" alt="" loading="lazy" decoding="async"></button>`).join('');
    function syncViewThumbs() {
      if (!multi) return;
      const btns = [...viewThumbs.querySelectorAll('[data-vthumb]')];
      btns.forEach(b => b.setAttribute('aria-current', +b.dataset.vthumb === cur));
      const b = btns[cur]; if (b && viewer.classList.contains('is-open')) { const br = b.getBoundingClientRect(), sr = viewThumbs.getBoundingClientRect(), l = viewThumbs.scrollLeft + (br.left - sr.left) - (sr.width - br.width) / 2; viewThumbs.scrollLeft = Math.max(0, l); }
    }
    let zoomOut = () => {};
    const step = n => { if (multi) { zoomOut(); show(cur + n); } };
    $('[data-view-prev]', viewer).addEventListener('click', e => { e.stopPropagation(); step(-1); });
    $('[data-view-next]', viewer).addEventListener('click', e => { e.stopPropagation(); step(1); });
    viewThumbs.addEventListener('click', e => { const t = e.target.closest('[data-vthumb]'); if (t) { zoomOut(); show(+t.dataset.vthumb); } });
    let sx = null, sy = 0, swiped = false;
    const stageEl = $('.vs-viewer__stage', viewer);
    stageEl.addEventListener('touchstart', e => { swiped = false; if (e.touches.length !== 1 || viewer.classList.contains('is-zoom')) { sx = null; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    stageEl.addEventListener('touchend', e => { if (sx === null) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; step(dx < 0 ? 1 : -1); } }, { passive: true });
    const setView = v => { viewer.classList.toggle('is-open', v); zoomOut(); document.body.classList.toggle('vs-no-scroll', v); if (v) requestAnimationFrame(syncViewThumbs); };
    $('[data-thumbs]', root).addEventListener('click', e => { const t = e.target.closest('[data-thumb]'); if (t) show(+t.dataset.thumb); });
    main.addEventListener('click', () => { if (noImage) return; show(cur); setView(true); });
    $('[data-fullscreen]', root).addEventListener('click', e => { e.stopPropagation(); show(cur); setView(true); });
    $('[data-view-close]', viewer).addEventListener('click', () => setView(false));
    // Click-to-zoom: zoom on the clicked point, capped by the photo's real pixel size (1.5x-2.5x of the fitted size),
    // then scroll the stage so that point is centred. Mouse move pans (desktop); finger drag pans natively (overflow:auto).
    zoomOut = () => { viewer.classList.remove('is-zoom'); viewImg.style.width = ''; viewImg.style.height = ''; stageEl.scrollLeft = 0; stageEl.scrollTop = 0; };
    const zoomAt = (cx, cy) => {
      const r = viewImg.getBoundingClientRect(); if (!r.width || !viewImg.naturalWidth) return;
      const fx = Math.min(1, Math.max(0, (cx - r.left) / r.width)), fy = Math.min(1, Math.max(0, (cy - r.top) / r.height));
      const scale = Math.max(1.5, Math.min(2.5, viewImg.naturalWidth / r.width));
      const w = Math.round(r.width * scale), h = Math.round(r.height * scale);
      viewer.classList.add('is-zoom'); viewImg.style.width = w + 'px'; viewImg.style.height = h + 'px';
      stageEl.scrollLeft = fx * w - stageEl.clientWidth / 2; stageEl.scrollTop = fy * h - stageEl.clientHeight / 2;
    };
    let dragMoved = false, tx0 = 0, ty0 = 0;
    stageEl.addEventListener('touchstart', e => { dragMoved = false; if (e.touches.length === 1) { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; } }, { passive: true });
    stageEl.addEventListener('touchmove', e => { if (e.touches.length === 1 && Math.hypot(e.touches[0].clientX - tx0, e.touches[0].clientY - ty0) > 8) dragMoved = true; }, { passive: true });
    stageEl.addEventListener('click', e => {
      if (swiped) { swiped = false; return; }
      if (viewer.classList.contains('is-error')) return;
      if (viewer.classList.contains('is-zoom')) { if (!dragMoved) zoomOut(); dragMoved = false; return; }
      if (e.target === viewImg) zoomAt(e.clientX, e.clientY);
    });
    stageEl.addEventListener('mousemove', e => {
      if (!viewer.classList.contains('is-zoom') || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
      const s = stageEl.getBoundingClientRect(), fx = (e.clientX - s.left) / s.width, fy = (e.clientY - s.top) / s.height;
      stageEl.scrollLeft = fx * (stageEl.scrollWidth - stageEl.clientWidth); stageEl.scrollTop = fy * (stageEl.scrollHeight - stageEl.clientHeight);
    });
    // Failed photo: message instead of a blank white stage
    const viewErr = document.createElement('p'); viewErr.className = 'vs-viewer__error'; viewErr.setAttribute('role', 'status'); viewErr.textContent = 'Şəkil yüklənmədi'; stageEl.appendChild(viewErr);
    viewImg.addEventListener('error', () => { zoomOut(); viewer.classList.add('is-error'); });
    viewImg.addEventListener('load', () => viewer.classList.remove('is-error'));
    document.addEventListener('keydown', e => { if (!viewer.classList.contains('is-open')) return; if (e.key === 'Escape') setView(false); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
    show(0);
  };
})();
