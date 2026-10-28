/* About / Store / FAQ / Blog controllers. Content is data-driven (data/faq.json, data/blog.json). */
(function () {
  'use strict';
  const VS = window.VS; const { $, $$, esc } = VS;
  VS.pages = VS.pages || {};

  VS.pages.about = async () => {
    const all = await VS.data.products();
    VS.renderBrands(all);
  };

  VS.pages.store = async () => {};

  VS.pages.faq = async () => {
    const data = await fetch('data/faq.json').then(r => r.json()).catch(() => ({ items: [] }));
    const items = data.items || [];
    $('[data-faq]').innerHTML = items.map((x, i) => `<div class="vs-acc__item"><button class="vs-acc__head" aria-expanded="false" aria-controls="faq-${i}">${esc(x.q)}</button><div class="vs-acc__body" id="faq-${i}"><div class="vs-acc__inner"><p>${esc(x.a)}</p></div></div></div>`).join('');
  };

  // Minimal Markdown → HTML for original article text (headings, lists, bold, links, hr, paragraphs)
  // Old volkssport.az category ids used inside articles → theme category ids
  const CAT_URL = { 14: 'qacis', 35: 'w-qantel', 27: 'a-3', 9: 'fitness-guc-trenajoru', 43: 'f-pres' };
  const md = src => { const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((blog-post\.html[^)]*)\)/g, '<a href="$2">$1</a>').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, t, u) => { const m = u.match(/^https:\/\/volkssport\.az\/[^)]*?\/(\d+)-[^/]*\.html$/); if (m && VS._pids && VS._pids.has(+m[1])) return '<a href="product.html?id=' + m[1] + '">' + t + '</a>';
      const c = u.match(/^https:\/\/volkssport\.az\/az\/(\d+)-[^/.]+\/?$/); if (c && CAT_URL[c[1]]) return '<a href="category.html?c=' + CAT_URL[c[1]] + '">' + t + '</a>';
      const ref = VS._refs && VS._refs.get(String(t).trim().split(/\s+/).pop().toLowerCase()); if (m && ref) return '<a href="product.html?id=' + ref + '">' + t + '</a>';
      if (/^https?:\/\/(www\.)?volkssport\.az/.test(u)) return t;
      return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>'; });
    return src.split(/\n{2,}/).map(b => { b = b.trim(); if (!b) return ''; if (b === '---') return '<hr>'; let m;
      if ((m = b.match(/^(#{1,3}) (.+)$/))) return '<h' + (m[1].length + 1) + '>' + inl(m[2]) + '</h' + (m[1].length + 1) + '>';
      if (/^- /.test(b)) return '<ul>' + b.split('\n').filter(l => l.trim()).map(l => '<li' + (/^\s+- /.test(l) ? ' style="margin-left:20px;list-style:circle"' : '') + '>' + inl(l.replace(/^\s*- /, '')) + '</li>').join('') + '</ul>';
      if (/^\d+\. /.test(b)) return '<ol>' + b.split('\n').filter(l => l.trim()).map(l => '<li>' + inl(l.replace(/^\d+\. /, '')) + '</li>').join('') + '</ol>';
      return '<p>' + inl(b).replace(/\n/g, '<br>') + '</p>'; }).join(''); };
  const AZ_M = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
  const fmtDate = d => { if (!d) return ''; const [y, m, day] = d.split('-').map(Number); return AZ_M[m - 1] + ' ' + day + ', ' + y; };
  const card = p => `<a class="vs-post" href="${esc(p.url)}"><div class="vs-post__media${p.image ? '' : ' is-empty'}">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" data-err="post">` : ''}</div><span class="vs-post__meta">${esc(fmtDate(p.date))}</span><span class="vs-post__title">${esc(p.title)}</span></a>`;
  VS.postCard = card; VS.fmtDate = fmtDate; // shared with components.html

  // Login / registration — FRONTEND DEMO. In production PrestaShop AuthController handles accounts.
  // Demo stores only a salted PBKDF2 hash in localStorage (never the password). Remove VS.demoAuth when integrating.
  const enc = new TextEncoder();
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const hashPw = async (pw, salt) => { const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']); return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256)); };
  const UKEY = 'vs_demo_users', SKEY = 'vs_demo_session';
  VS.demoAuth = {
    users() { try { return JSON.parse(localStorage.getItem(UKEY) || '{}'); } catch (e) { return {}; } },
    save(u) { localStorage.setItem(UKEY, JSON.stringify(u)); },
    current() { const em = sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY); const u = this.users()[em]; return u ? { email: em, ...u } : null; },
    login(em, keep) { (keep ? localStorage : sessionStorage).setItem(SKEY, em); },
    logout() { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY); }
  };
  const validate = form => { let ok = true;
    $$('.vs-input', form).forEach(el => { if (el.closest('[hidden]')) return; const f = el.closest('.vs-field'); const v = el.validity; let m = '';
      if (v.valueMissing) m = 'Bu xananı doldurun'; else if (v.typeMismatch) m = 'E-poçt ünvanı düzgün deyil'; else if (v.tooShort) m = 'Ən azı ' + el.minLength + ' simvol olmalıdır'; else if (v.patternMismatch) m = 'Nömrəni düzgün yazın, məs. 050 123 45 67';
      f.classList.toggle('is-error', !!m); $('[data-msg]', f).textContent = m; if (m && ok) { el.focus(); ok = false; } });
    return ok; };
  const say = (form, text, type) => { const b = $('[data-auth-msg]', form); b.hidden = false; b.className = 'vs-alert vs-alert--' + type; b.textContent = text; };
  const busy = (btn, on) => { btn.classList.toggle('is-loading', on); btn.disabled = on; };
  VS.pages.auth = async () => {
    if (VS.demoAuth.current()) { location.replace('account.html'); return; }
    const L = $('[data-auth="login"]'), R = $('[data-auth="register"]'), F = $('[data-auth="forgot"]');
    L.addEventListener('submit', async e => { e.preventDefault(); if (!validate(L)) return; const btn = $('[type=submit]', L); busy(btn, true);
      const em = L.elements['login-email'].value.trim().toLowerCase(), u = VS.demoAuth.users()[em];
      const ok = u && await hashPw(L.elements['login-pass'].value, u.salt) === u.hash; busy(btn, false);
      if (!ok) { L.elements['login-pass'].value = ''; say(L, 'E-poçt və ya şifrə yanlışdır.', 'error'); return; }
      VS.demoAuth.login(em, L.elements.keep.checked); location.href = 'account.html'; });
    R.addEventListener('submit', async e => { e.preventDefault(); if (!validate(R)) return; const btn = $('[type=submit]', R);
      const em = R.elements['reg-email'].value.trim().toLowerCase(), users = VS.demoAuth.users();
      if (users[em]) { say(R, 'Bu e-poçt ilə artıq qeydiyyat var. Soldan daxil olun.', 'error'); return; }
      busy(btn, true); const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      users[em] = { first: R.elements['reg-first'].value.trim(), last: R.elements['reg-last'].value.trim(), phone: R.elements['reg-phone'].value.trim(), newsletter: R.elements.newsletter.checked, salt, hash: await hashPw(R.elements['reg-pass'].value, salt), created: new Date().toISOString().slice(0, 10) };
      VS.demoAuth.save(users); VS.demoAuth.login(em, false); location.href = 'account.html'; });
    $('[data-forgot]').addEventListener('click', e => { e.preventDefault(); L.hidden = true; F.hidden = false; F.elements['fg-email'].value = L.elements['login-email'].value; F.elements['fg-email'].focus(); });
    $('[data-forgot-back]').addEventListener('click', () => { F.hidden = true; L.hidden = false; });
    F.addEventListener('submit', async e => { e.preventDefault(); if (!validate(F)) return;
      const em = F.elements['fg-email'].value.trim().toLowerCase(), users = VS.demoAuth.users();
      if (!users[em]) { say(F, 'Bu e-poçt ilə qeydiyyat tapılmadı.', 'error'); return; }
      const btn = $('[type=submit]', F); busy(btn, true); users[em].salt = hex(crypto.getRandomValues(new Uint8Array(16))); users[em].hash = await hashPw(F.elements['fg-pass'].value, users[em].salt); VS.demoAuth.save(users); busy(btn, false);
      F.reset(); F.hidden = true; L.hidden = false; L.elements['login-email'].value = em; say(L, 'Şifrə yeniləndi. İndi yeni şifrə ilə daxil olun.', 'success'); });
  };
  VS.pages.account = async () => {
    const u = VS.demoAuth.current(); if (!u) { location.replace('login.html'); return; }
    $('[data-acc-name]').textContent = (u.first + ' ' + u.last).trim();
    $('[data-acc-rows]').innerHTML = [['E-poçt', u.email], ['Telefon', u.phone], ['Qeydiyyat tarixi', u.created], ['Bülleten', u.newsletter ? 'Abunəsiniz' : 'Abunə deyilsiniz']].map(([k, v]) => '<tr><th scope="row">' + esc(k) + '</th><td>' + esc(v || '—') + '</td></tr>').join('');
    $('[data-wish-total]').textContent = VS.wish.get().length;
    $('[data-logout]').addEventListener('click', () => { VS.demoAuth.logout(); location.href = 'index.html'; });
  };

  VS.pages.post = async () => {
    const data = await fetch('data/blog.json').then(r => r.json()).catch(() => ({ posts: [] }));
    const posts = data.posts || []; const p = posts.find(x => x.id === VS.qs.get('id'));
    const allP = await VS.data.products(); VS._pids = new Set(allP.map(x => x.id_product)); VS._refs = new Map(allP.filter(x => x.reference).map(x => [x.reference.toLowerCase(), x.id_product]));
    const root = $('[data-post]');
    if (!p) { $('.vs-article', root).innerHTML = '<div class="vs-empty"><span class="vs-empty__title">Məqalə tapılmadı</span><a class="vs-btn vs-btn--outline" href="blog.html">← Bloqa qayıt</a></div>'; $('[data-post-related]').hidden = true; return; }
    document.title = (p.seo_title || p.title) + ' — VOLKS SPORT';
    $('[data-post-crumb]').textContent = p.title; $('[data-post-title]').textContent = p.title;
    $('[data-post-meta]').textContent = [p.category, fmtDate(p.date)].filter(Boolean).join(' · ');
    $('[data-post-cover]').innerHTML = p.image ? `<img src="${esc(p.image_large || p.image)}" alt="" data-err="remove">` : '';
    $('[data-post-body]').innerHTML = p.content_md ? md(p.content_md) : `${p.excerpt ? '<p>' + esc(p.excerpt) + '</p>' : ''}`;
    const rel = posts.filter(x => x !== p).slice(0, 3);
    $('[data-post-related-grid]').innerHTML = rel.map(card).join(''); $('[data-post-related]').hidden = !rel.length;
  };

  VS.pages.blog = async () => {
    const data = await fetch('data/blog.json').then(r => r.json()).catch(() => ({ posts: [] }));
    const posts = data.posts || [];
    const cat = VS.qs.get('cat') || '';
    const cats = [...new Set(posts.map(p => p.category).filter(Boolean))];
    $('[data-blog-cats]').innerHTML = '';
    const list = posts.filter(p => !cat || p.category === cat).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const meta = p => esc(fmtDate(p.date));
    const feat = list.find(p => p.featured) || list.find(p => p.image) || list[0];
    $('[data-blog-featured]').innerHTML = feat ? `<a class="vs-blog-feature" href="${esc(feat.url)}"><div class="vs-blog-feature__media${feat.image ? '' : ' is-empty'}">${feat.image ? `<img src="${esc(feat.image)}" alt="">` : ''}</div><div class="vs-blog-feature__body"><span class="vs-eyebrow">Əsas məqalə · ${meta(feat)}</span><h2 class="vs-h2">${esc(feat.title)}</h2>${feat.excerpt ? `<p class="vs-muted">${esc(feat.excerpt)}</p>` : ''}<span class="vs-catcard__cta">Oxu →</span></div></a>` : '';
    $('[data-blog-grid]').innerHTML = list.filter(p => p !== feat).map(card).join('');
    $('[data-blog-empty]').hidden = !!list.length;
  };
})();
