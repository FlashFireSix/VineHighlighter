(() => {
  const STORAGE_KEY = 'vineHighlighter.encore.categoryCounts.v2';
  const ENABLED_KEY = 'vineHighlighter.encore.enabled.v1';
  const TOOLBAR_ID = 'vine-highlighter-toolbar';
  const STYLE_ID = 'vine-highlighter-style';
  const GREEN = 'rgb(0, 170, 0)';
  const RED = 'rgb(220, 0, 0)';

  function isExtensionEnabled() {
    try {
      const v = localStorage.getItem(ENABLED_KEY);
      if (v === null) return true;
      return v === '1' || v === 'true';
    } catch {
      return true;
    }
  }

  function setExtensionEnabled(on) {
    try {
      localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function ensureToolbarStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      #${TOOLBAR_ID} { display:inline-flex; align-items:center; gap:6px; margin-left:10px; vertical-align:middle; }
      #${TOOLBAR_ID} .vhl-sw { position:relative; width:40px; height:22px; flex:0 0 auto; }
      #${TOOLBAR_ID} .vhl-sw input { position:absolute; inset:0; opacity:0; width:100%; height:100%; margin:0; cursor:pointer; z-index:2; }
      #${TOOLBAR_ID} .vhl-sw::before {
        content:""; position:absolute; inset:0; border-radius:11px; background:#cbd5e1; pointer-events:none; z-index:0;
        transition:background .2s ease;
      }
      #${TOOLBAR_ID} .vhl-sw:has(input:checked)::before { background:#22c55e; }
      #${TOOLBAR_ID} .vhl-sw::after {
        content:""; position:absolute; width:18px; height:18px; top:2px; left:2px; border-radius:50%;
        background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:left .2s ease; pointer-events:none; z-index:1;
      }
      #${TOOLBAR_ID} .vhl-sw:has(input:checked)::after { left:20px; }
    `;
    document.head.appendChild(st);
  }

  function resolveLogoHost() {
    return (
      document.getElementById('vvp-logo-link')
      || document.querySelector('a#vvp-logo-link')
      || document.querySelector('a.vvp-logo-link')
      || document.querySelector('.vvp-logo-link')
    );
  }

  function mountToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return true;
    const logo = resolveLogoHost();
    if (!logo) return false;
    const img = logo.querySelector('img');
    if (!img) return false;

    ensureToolbarStyles();

    if (!logo.style.display || logo.style.display === '') {
      const cs = window.getComputedStyle(logo);
      if (cs.display === 'inline' || cs.display === 'block') {
        logo.style.display = 'inline-flex';
        logo.style.alignItems = 'center';
        logo.style.flexWrap = 'wrap';
        logo.style.gap = '4px';
      }
    }

    const wrap = document.createElement('span');
    wrap.id = TOOLBAR_ID;
    wrap.setAttribute('data-vine-highlighter', '');
    wrap.title = 'VineHighlighter';

    const eye = document.createElement('span');
    eye.textContent = '👀';
    eye.setAttribute('aria-hidden', 'true');

    const sw = document.createElement('span');
    sw.className = 'vhl-sw';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.checked = isExtensionEnabled();
    input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
    input.setAttribute('aria-label', 'Toggle VineHighlighter count highlights');

    input.addEventListener('change', () => {
      const on = input.checked;
      input.setAttribute('aria-checked', on ? 'true' : 'false');
      setExtensionEnabled(on);
      const browse = document.getElementById('vvp-browse-nodes-container');
      if (!browse) return;
      if (on) {
        runHighlightPipeline();
      } else {
        clearHighlights(browse);
      }
    });

    sw.appendChild(input);
    wrap.appendChild(eye);
    wrap.appendChild(sw);
    img.insertAdjacentElement('afterend', wrap);
    return true;
  }

  function buildDomPathKey(link, container) {
    const segments = [];
    let el = link;
    while (el && el !== container) {
      const parent = el.parentElement;
      if (!parent) break;
      const index = Array.prototype.indexOf.call(parent.children, el);
      const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
      segments.push(`${tag}[${index}]`);
      el = parent;
    }
    return segments.reverse().join('/');
  }

  function readBrowseDistinctId(link) {
    let n = link;
    for (let depth = 0; depth < 6 && n; depth += 1, n = n.parentElement) {
      if (!n || !n.getAttribute) continue;
      const attrs = ['data-browse-node', 'data-browsenode', 'data-node', 'data-nodeid', 'data-entityid'];
      for (const attr of attrs) {
        const v = n.getAttribute(attr);
        if (v) return `${attr}=${v}`;
      }
    }
    return null;
  }

  function getStableRowKey(link, container, linkIndex) {
    const entity = readBrowseDistinctId(link);
    if (entity) return `entity:${entity}`;

    const href = link.getAttribute('href');
    if (href && href !== '#' && !/^\s*javascript:/i.test(href)) {
      try {
        const u = new URL(href, location.href);
        u.hash = '';
        return `url:${u.pathname}${u.search}`;
      } catch {
        /* fall through */
      }
    }
    const path = buildDomPathKey(link, container);
    if (!path) return `idx:${linkIndex}`;
    return `path:${path}`;
  }

  function findBracketSpanForLink(link) {
    const trySpan = (span) => {
      const count = VineCategorySnapshotComparer.parseCountFromBracketSpan(span.textContent);
      return count !== null ? { span, count } : null;
    };

    const next = link.nextElementSibling;
    if (next && next.tagName === 'SPAN') {
      const r = trySpan(next);
      if (r) return r;
    }

    let parent = link.parentElement;
    for (let depth = 0; depth < 8 && parent; depth += 1, parent = parent.parentElement) {
      const spans = [...parent.querySelectorAll('span')];
      const exact = spans.find((sp) => /^\s*\(\s*\d+\s*\)\s*$/.test(sp.textContent.trim()));
      if (exact) {
        const r = trySpan(exact);
        if (r) return r;
      }
    }

    parent = link.parentElement;
    for (let depth = 0; depth < 8 && parent; depth += 1, parent = parent.parentElement) {
      for (const span of parent.querySelectorAll('span')) {
        const r = trySpan(span);
        if (r) return r;
      }
    }

    return null;
  }

  function scrapeRows(container) {
    const links = Array.from(container.querySelectorAll('a.a-link-normal'));
    const rows = [];
    const usedKeys = new Set();
    for (let i = 1; i < links.length; i += 1) {
      const link = links[i];
      const displayName = VineCategorySnapshotComparer.normalizeCategoryName(link.textContent);
      const found = findBracketSpanForLink(link);
      if (!displayName || !found) continue;
      let rowKey = getStableRowKey(link, container, i);
      if (usedKeys.has(rowKey)) {
        rowKey = `${rowKey}::${i}`;
      }
      usedKeys.add(rowKey);
      rows.push({ rowKey, displayName, count: found.count, span: found.span });
    }
    return rows;
  }

  function loadPrevious() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function clearHighlights(container) {
    const links = Array.from(container.querySelectorAll('a.a-link-normal'));
    for (let i = 1; i < links.length; i += 1) {
      const found = findBracketSpanForLink(links[i]);
      if (found) found.span.style.color = '';
    }
  }

  function runHighlightPipeline() {
    if (!isExtensionEnabled()) return;

    const container = document.getElementById('vvp-browse-nodes-container');
    if (!container) return;

    const rows = scrapeRows(container);
    const current = {};
    for (const row of rows) {
      current[row.rowKey] = row.count;
    }

    const previous = loadPrevious();
    const state = VineCategorySnapshotComparer.highlightStateFor(previous, current);

    for (const row of rows) {
      const tone = state[row.rowKey];
      if (tone === 'increase') row.span.style.color = GREEN;
      else if (tone === 'decrease') row.span.style.color = RED;
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function syncToolbarCheckbox() {
    const root = document.getElementById(TOOLBAR_ID);
    if (!root) return;
    const input = root.querySelector('input[type="checkbox"]');
    if (!input) return;
    const on = isExtensionEnabled();
    input.checked = on;
    input.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  function applyBrowseOnce() {
    const browse = document.getElementById('vvp-browse-nodes-container');
    if (!browse) return;
    if (isExtensionEnabled()) {
      runHighlightPipeline();
    } else {
      clearHighlights(browse);
    }
  }

  let toolbarAttempts = 0;
  function tryMountToolbar() {
    if (mountToolbar()) {
      syncToolbarCheckbox();
      return;
    }
    if (toolbarAttempts >= 48) return;
    toolbarAttempts += 1;
    setTimeout(() => {
      if (mountToolbar()) syncToolbarCheckbox();
      else tryMountToolbar();
    }, 250);
  }

  function boot() {
    applyBrowseOnce();
    tryMountToolbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
