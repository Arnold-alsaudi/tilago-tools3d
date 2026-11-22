/* UI kit: sections, sliders with scrubbable labels, vectors, color picker with HEX, selects,
   segmented controls, toggles, tooltips, toasts and in-panel dialogs. No external libraries. */
(function () {
  // Hand-drawn 24px outline set, one stroke weight, same corner language everywhere.
  var ICON = {
    text: 'M5 6V4.5h14V6M12 4.5v15M9 19.5h6',
    scene: 'M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2zM4.3 7.4L12 11.8l7.7-4.4M12 11.8v9.2',
    materials: 'M12 3.5a8.5 8.5 0 108.5 8.5M12 3.5c-2.6 2.2-4 5.1-4 8.5M20.5 12H12M15.5 4.3a8.6 8.6 0 014.2 4.2',
    environment: 'M3 17l5-6 4 4 3-3 6 5M3 20.5h18M16 7.5a1.8 1.8 0 100-.1',
    lighting: 'M9.5 17.5h5M10.5 20.5h3M12 3.5a5.8 5.8 0 00-3.4 10.5c.6.5.9 1.1.9 1.9v.1h5v-.1c0-.8.3-1.4.9-1.9A5.8 5.8 0 0012 3.5z',
    camera: 'M3.5 8h3.2l1.8-2.5h7l1.8 2.5h3.2v11h-17zM12 10.5a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6z',
    animation: 'M4 12h3l2.5-6 5 12 2.5-6h3',
    presets: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13v7M13 16.5h7',
    settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
    chevron: 'M7 10l5 5 5-5',
    eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.3a2.7 2.7 0 100 5.4 2.7 2.7 0 000-5.4z',
    eyeOff: 'M3.5 3.5l17 17M9.9 5.8c.7-.2 1.4-.3 2.1-.3 6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.6 3.4M6.4 6.9C4 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.8-.4 4-1',
    lock: 'M6 10.5h12v9.5H6zM8.5 10.5V8a3.5 3.5 0 017 0v2.5M12 14v2.5',
    unlock: 'M6 10.5h12v9.5H6zM8.5 10.5V8a3.5 3.5 0 016.8-1.2',
    copy: 'M8.5 8.5h11v11h-11zM15.5 8.5V4.5h-11v11h4',
    trash: 'M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6',
    group: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h3.5v5.5',
    ungroup: 'M4 4h7v7H4zM13 13h7v7h-7z',
    target: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
    reset: 'M4.5 12a7.5 7.5 0 107.5-7.5 7.6 7.6 0 00-6 3M4.5 4v4h4',
    plus: 'M12 5v14M5 12h14',
    refresh: 'M19.5 12a7.5 7.5 0 01-13.4 4.6M4.5 12a7.5 7.5 0 0113.4-4.6M18 3.5v4h-4M6 20.5v-4h4',
    edit: 'M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14',
    upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14',
    play: 'M8 5.5v13l10.5-6.5z',
    move: 'M12 3v18M3 12h18M12 3L9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
    frame: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    image: 'M4 5h16v14H4zM4 15.5l4.5-4.5 3.5 3.5 2.5-2.5 5.5 5.5M15.5 8.6a1.4 1.4 0 100 .1',
    folder: 'M3.5 6.5h6l2 2h9v10.5h-17z',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
    info: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 11v5M12 7.6v.1',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4',
    spot: 'M9 3.5h6l1.5 5h-9zM8 8.5L5 20M16 8.5l3 11.5M12 8.5V20',
    bulb: 'M12 3.5a5.8 5.8 0 015.8 5.8c0 2.6-2.3 3.8-2.6 6.2H8.8c-.3-2.4-2.6-3.6-2.6-6.2A5.8 5.8 0 0112 3.5zM9.5 18.5h5',
    cube: 'M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2zM4.3 7.4L12 11.8l7.7-4.4M12 11.8v9.2',
    logo: 'M12 3l2.4 5.6 6.1.5-4.6 4 1.4 6-5.3-3.2-5.3 3.2 1.4-6-4.6-4 6.1-.5z',
    trace: 'M4 20l3.5-1 10-10-2.5-2.5-10 10zM14 6.5L16.5 4 20 7.5 17.5 10M3.5 13c2-4 5-6 8-6',
    e3d: 'M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2zM9 10.5h3.2a1.6 1.6 0 010 3.2H9.8h2.6a1.7 1.7 0 010 3.3H9',
    sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2'
  };
  function icon(name, size) {
    return '<svg class="ic" viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" aria-hidden="true"><path d="' + (ICON[name] || '') + '"/></svg>';
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function round(v, step) {
    var d = step >= 1 ? 0 : (String(step).split('.')[1] || '').length;
    return Number((Math.round(v / step) * step).toFixed(d));
  }
  function fmt(v, step) {
    if (v === null || v === undefined || isNaN(v)) return '';
    var d = step >= 1 ? 0 : (String(step).split('.')[1] || '').length;
    return Number(v).toFixed(d);
  }
  function tipAttr(e, key) {
    var tip = I18N.tip(key);
    if (tip) e.setAttribute('data-tip', tip);
  }

  /* ---------- tooltips ---------- */
  var tipEl = null, tipTimer = 0;
  document.addEventListener('mouseover', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-tip]') : null;
    clearTimeout(tipTimer);
    if (!t) { if (tipEl) tipEl.classList.remove('on'); return; }
    tipTimer = setTimeout(function () {
      if (!tipEl) { tipEl = el('div', 'tooltip'); document.body.appendChild(tipEl); }
      tipEl.textContent = t.getAttribute('data-tip');
      var r = t.getBoundingClientRect();
      tipEl.classList.add('on');
      var w = tipEl.offsetWidth, x = Math.min(window.innerWidth - w - 6, Math.max(6, r.left + r.width / 2 - w / 2));
      var y = r.bottom + 6;
      if (y + tipEl.offsetHeight > window.innerHeight - 4) y = r.top - tipEl.offsetHeight - 6;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    }, 450);
  });

  /* ---------- section ---------- */
  function section(id, titleKey, opts) {
    opts = opts || {};
    var open = true;
    try { var s = localStorage.getItem('ts3d.sec.' + id); if (s !== null) open = s === '1'; else if (opts.closed) open = false; } catch (e) {}
    var root = el('section', 'sec' + (open ? ' open' : ''));
    var head = el('button', 'sec-h', '<span class="sec-t">' + t(titleKey) + '</span>' + (opts.badge ? '<span class="badge">' + opts.badge + '</span>' : '') + icon('chevron', 14));
    head.type = 'button';
    var body = el('div', 'sec-b');
    head.addEventListener('click', function () {
      open = !open;
      root.classList.toggle('open', open);
      try { localStorage.setItem('ts3d.sec.' + id, open ? '1' : '0'); } catch (e) {}
    });
    root.appendChild(head); root.appendChild(body);
    root.body = body; root.head = head;
    return root;
  }

  // Inline "Advanced options" fold: keeps every tab short, remembers its state.
  function more(id) {
    var open = false;
    try { open = localStorage.getItem('ts3d.more.' + id) === '1'; } catch (e) {}
    var wrap = el('div', 'more' + (open ? ' open' : ''));
    var b = el('button', 'more-h', '<span>' + t('ui.more') + '</span>' + icon('chevron', 12));
    b.type = 'button';
    var body = el('div', 'more-b');
    b.addEventListener('click', function () {
      open = !open; wrap.classList.toggle('open', open);
      try { localStorage.setItem('ts3d.more.' + id, open ? '1' : '0'); } catch (e) {}
    });
    wrap.appendChild(b); wrap.appendChild(body);
    wrap.body = body;
    wrap.add = function () { for (var i = 0; i < arguments.length; i++) body.appendChild(arguments[i]); return wrap; };
    return wrap;
  }

  function row(labelKey, control, opts) {
    var r = el('div', 'row' + (opts && opts.wide ? ' wide' : ''));
    var l = el('label', 'lbl', t(labelKey));
    tipAttr(l, labelKey);
    r.appendChild(l);
    r.appendChild(control);
    r.label = l;
    return r;
  }

  /* ---------- number field with scrub ---------- */
  function scrub(handle, get, set, step, done) {
    var sx = 0, sv = 0, moved = false;
    handle.classList.add('scrub');
    handle.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      sx = ev.clientX; sv = get(); moved = false;
      handle.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    handle.addEventListener('pointermove', function (ev) {
      if (!handle.hasPointerCapture(ev.pointerId)) return;
      var dx = ev.clientX - sx;
      if (Math.abs(dx) > 2) moved = true;
      if (!moved) return;
      var mul = ev.shiftKey ? 10 : (ev.ctrlKey ? 0.1 : 1);
      set(sv + dx * step * mul, false);
    });
    handle.addEventListener('pointerup', function (ev) {
      if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId);
      if (moved) done();
    });
  }

  function numInput(value, step, onCommit) {
    var i = el('input', 'num');
    i.type = 'text'; i.inputMode = 'decimal'; i.spellcheck = false;
    i.value = fmt(value, step);
    function commit() {
      var expr = i.value.replace(/,/g, '.').replace(/[^0-9+\-*/(). ]/g, ''), v;
      try { v = Function('return (' + expr + ')')(); } catch (e) { v = NaN; }
      if (typeof v === 'number' && isFinite(v)) onCommit(v); else i.classList.add('bad');
    }
    i.addEventListener('keydown', function (ev) {
      i.classList.remove('bad');
      if (ev.key === 'Enter') { commit(); i.blur(); }
      if (ev.key === 'Escape') { i.blur(); }
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        var cur = parseFloat(i.value) || 0, d = (ev.key === 'ArrowUp' ? 1 : -1) * step * (ev.shiftKey ? 10 : 1);
        onCommit(cur + d);
      }
    });
    i.addEventListener('change', commit);
    i.addEventListener('focus', function () { setTimeout(function () { i.select(); }, 0); });
    return i;
  }

  // o: key, min, max, step, value, unit, hard (clamp typed values), onInput(v), onChange(v)
  function slider(o) {
    var step = o.step || 1, min = o.min, max = o.max, val = o.value === undefined ? min : o.value;
    var wrap = el('div', 'slider');
    var track = el('div', 'track'), fill = el('div', 'fill'), thumb = el('div', 'thumb');
    track.appendChild(fill); track.appendChild(thumb);
    var num = numInput(val, step, function (v) { setV(v, true, true); });
    wrap.appendChild(track); wrap.appendChild(num);
    if (o.unit) { var u = el('span', 'unit', o.unit); wrap.appendChild(u); }
    function clampTyped(v) { return o.hard ? Math.min(max, Math.max(min, v)) : Math.max(o.floor !== undefined ? o.floor : -1e9, v); }
    function paint() {
      var p = (Math.min(max, Math.max(min, val)) - min) / (max - min || 1);
      fill.style.width = (p * 100) + '%';
      thumb.style.left = (p * 100) + '%';
      thumb.style.setProperty('--p', (p * 100) + '%');
      if (document.activeElement !== num) num.value = fmt(val, step);
    }
    function setV(v, final, typed) {
      v = typed ? clampTyped(v) : Math.min(max, Math.max(min, v));
      v = round(v, step);
      var changed = v !== val;
      val = v; paint();
      if (changed && o.onInput) o.onInput(v);
      if (final && o.onChange) o.onChange(v);
    }
    var dragging = false;
    function fromX(x) { var r = track.getBoundingClientRect(); var p = (x - r.left) / r.width; if (getComputedStyle(track).direction === 'rtl') p = 1 - p; return min + Math.min(1, Math.max(0, p)) * (max - min); }
    track.addEventListener('pointerdown', function (ev) { dragging = true; track.setPointerCapture(ev.pointerId); setV(fromX(ev.clientX), false); });
    track.addEventListener('pointermove', function (ev) { if (dragging) setV(fromX(ev.clientX), false); });
    track.addEventListener('pointerup', function () { if (dragging) { dragging = false; if (o.onChange) o.onChange(val); } });
    track.addEventListener('dblclick', function () { if (o.def !== undefined) setV(o.def, true); });
    var r = row(o.key, wrap);
    scrub(r.label, function () { return val; }, function (v) { setV(v, false, true); }, step * (o.scrub || 1), function () { if (o.onChange) o.onChange(val); });
    r.set = function (v) { if (v === null || v === undefined) return; val = typeof v === 'number' ? v : parseFloat(v); paint(); };
    r.get = function () { return val; };
    paint();
    return r;
  }

  // o: key, value [x,y,z], step, axes (2|3), onInput(arr), onChange(arr), link (bool)
  function vec(o) {
    var n = o.axes || 3, val = (o.value || [0, 0, 0]).slice(0, n), step = o.step || 1, linked = !!o.link;
    var wrap = el('div', 'vec vec' + n), inputs = [], names = ['X', 'Y', 'Z'];
    names.slice(0, n).forEach(function (ax, i) {
      var cell = el('div', 'ax ax-' + ax.toLowerCase());
      var tag = el('span', 'axn', ax);
      var inp = numInput(val[i], step, function (v) { setAxis(i, v, true); });
      cell.appendChild(tag); cell.appendChild(inp);
      scrub(tag, function () { return val[i]; }, function (v) { setAxis(i, v, false); }, step * (o.scrub || 1), function () { if (o.onChange) o.onChange(val.slice()); });
      inputs.push(inp); wrap.appendChild(cell);
    });
    if (o.link !== undefined) {
      var lb = el('button', 'icon-btn link' + (linked ? ' on' : ''), icon('link', 14));
      lb.type = 'button';
      lb.setAttribute('data-tip', t('tf.link'));
      lb.addEventListener('click', function () { linked = !linked; lb.classList.toggle('on', linked); });
      wrap.appendChild(lb);
    }
    function setAxis(i, v, final) {
      v = round(v, step);
      if (linked) {
        var ratio = val[i] ? v / val[i] : 1;
        for (var k = 0; k < n; k++) val[k] = k === i ? v : (val[i] ? round(val[k] * ratio, step) : v);
      } else val[i] = v;
      paint();
      if (o.onInput) o.onInput(val.slice());
      if (final && o.onChange) o.onChange(val.slice());
    }
    function paint() { inputs.forEach(function (inp, i) { if (document.activeElement !== inp) inp.value = fmt(val[i], step); }); }
    var r = row(o.key, wrap, { wide: true });
    r.set = function (v) { if (!v) return; val = v.slice(0, n); while (val.length < n) val.push(0); paint(); };
    r.get = function () { return val.slice(); };
    return r;
  }

  /* ---------- color ---------- */
  function toHex(rgb) {
    if (!rgb) return '#000000';
    return '#' + rgb.slice(0, 3).map(function (c) { var h = Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16); return h.length < 2 ? '0' + h : h; }).join('').toUpperCase();
  }
  function fromHex(h) {
    h = String(h).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
  }
  function rgb2hsv(c) {
    var r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r, g, b;
    if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; } else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; } else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
  }

  var recent = [];
  try { recent = JSON.parse(localStorage.getItem('ts3d.recent') || '[]'); } catch (e) {}
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener('pointerdown', function (ev) { if (pop && !pop.contains(ev.target) && !ev.target.closest('.swatch-btn')) closePop(); });

  function openPicker(anchor, rgb, onInput, onChange) {
    closePop();
    var hsv = rgb2hsv(rgb || [1, 1, 1]);
    pop = el('div', 'picker');
    pop.innerHTML = '<div class="sv"><div class="sv-w"></div><div class="sv-b"></div><div class="sv-dot"></div></div>' +
      '<div class="hue"><div class="hue-dot"></div></div><div class="pk-row"><span class="pk-prev"></span><input class="hex" maxlength="7" spellcheck="false"></div><div class="pk-recent"></div>';
    document.body.appendChild(pop);
    var sv = pop.querySelector('.sv'), hue = pop.querySelector('.hue'), dot = pop.querySelector('.sv-dot'), hd = pop.querySelector('.hue-dot'),
        hex = pop.querySelector('.hex'), prev = pop.querySelector('.pk-prev'), rec = pop.querySelector('.pk-recent');
    function cur() { return hsv2rgb(hsv[0], hsv[1], hsv[2]); }
    function paint() {
      sv.style.background = 'hsl(' + hsv[0] + ',100%,50%)';
      dot.style.left = (hsv[1] * 100) + '%'; dot.style.top = ((1 - hsv[2]) * 100) + '%';
      hd.style.left = (hsv[0] / 360 * 100) + '%';
      var h = toHex(cur());
      prev.style.background = h;
      if (document.activeElement !== hex) hex.value = h;
    }
    function emit(final) { var c = cur(); onInput(c); if (final) { onChange(c); pushRecent(toHex(c)); } }
    function drag(target, fn) {
      target.addEventListener('pointerdown', function (ev) { target.setPointerCapture(ev.pointerId); fn(ev); });
      target.addEventListener('pointermove', function (ev) { if (target.hasPointerCapture(ev.pointerId)) fn(ev); });
      target.addEventListener('pointerup', function () { emit(true); });
    }
    drag(sv, function (ev) {
      var r = sv.getBoundingClientRect();
      hsv[1] = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      hsv[2] = 1 - Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      paint(); emit(false);
    });
    drag(hue, function (ev) {
      var r = hue.getBoundingClientRect();
      hsv[0] = Math.min(359.9, Math.max(0, (ev.clientX - r.left) / r.width * 360));
      paint(); emit(false);
    });
    hex.addEventListener('input', function () { var c = fromHex(hex.value); hex.classList.toggle('bad', !c); if (c) { hsv = rgb2hsv(c); paint(); emit(false); } });
    hex.addEventListener('change', function () { var c = fromHex(hex.value); if (c) emit(true); });
    hex.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { var c = fromHex(hex.value); if (c) { emit(true); closePop(); } } if (ev.key === 'Escape') closePop(); });
    recent.forEach(function (h) {
      var b = el('button', 'pk-sw'); b.type = 'button'; b.style.background = h; b.title = h;
      b.addEventListener('click', function () { hsv = rgb2hsv(fromHex(h)); paint(); emit(true); });
      rec.appendChild(b);
    });
    paint();
    var r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.min(window.innerWidth - pw - 6, Math.max(6, r.left)), y = r.bottom + 4;
    if (y + ph > window.innerHeight - 4) y = Math.max(4, r.top - ph - 4);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    setTimeout(function () { hex.focus(); }, 0);
  }
  function pushRecent(h) {
    recent = [h].concat(recent.filter(function (x) { return x !== h; })).slice(0, 12);
    try { localStorage.setItem('ts3d.recent', JSON.stringify(recent)); } catch (e) {}
  }

  // o: key, value [r,g,b], onInput(rgb), onChange(rgb)
  function color(o) {
    var val = o.value || [1, 1, 1];
    var wrap = el('div', 'color');
    var sw = el('button', 'swatch-btn'); sw.type = 'button';
    var hex = el('input', 'hex-in'); hex.maxLength = 7; hex.spellcheck = false;
    wrap.appendChild(sw); wrap.appendChild(hex);
    function paint() { sw.style.background = toHex(val); if (document.activeElement !== hex) hex.value = toHex(val); }
    sw.addEventListener('click', function () {
      openPicker(sw, val, function (c) { val = c; paint(); if (o.onInput) o.onInput(c); }, function (c) { val = c; paint(); if (o.onChange) o.onChange(c); });
    });
    hex.addEventListener('change', function () { var c = fromHex(hex.value); if (c) { val = c; paint(); pushRecent(toHex(c)); if (o.onInput) o.onInput(c); if (o.onChange) o.onChange(c); } else { hex.classList.add('bad'); } });
    hex.addEventListener('input', function () { hex.classList.toggle('bad', !fromHex(hex.value)); });
    hex.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') hex.blur(); });
    var r = row(o.key, wrap);
    r.set = function (c) { if (c && c.length >= 3) { val = c.slice(0, 3); paint(); } };
    r.get = function () { return val.slice(); };
    paint();
    return r;
  }

  /* ---------- select / segmented / toggle ---------- */
  function select(o) {
    var s = el('select', 'sel');
    function fill(opts, value) {
      s.innerHTML = '';
      opts.forEach(function (op) { var e = el('option', '', op.label); e.value = op.v; if (op.v === value) e.selected = true; s.appendChild(e); });
    }
    fill(o.options || [], o.value);
    s.addEventListener('change', function () { if (o.onChange) o.onChange(s.value); });
    var r = o.key ? row(o.key, s) : s;
    r.sel = s;
    r.set = function (v) { s.value = v; };
    r.get = function () { return s.value; };
    r.fill = fill;
    return r;
  }

  function seg(o) {
    var wrap = el('div', 'seg'), val = o.value, btns = {};
    (o.options || []).forEach(function (op) {
      var b = el('button', 'seg-b', (op.icon ? icon(op.icon, 14) : '') + (op.label ? '<span>' + op.label + '</span>' : ''));
      b.type = 'button';
      if (op.tip) b.setAttribute('data-tip', op.tip);
      b.addEventListener('click', function () { set(op.v); if (o.onChange) o.onChange(op.v); });
      btns[op.v] = b; wrap.appendChild(b);
    });
    function set(v) { val = v; Object.keys(btns).forEach(function (k) { btns[k].classList.toggle('on', k === String(v)); }); }
    set(val);
    var r = o.key ? row(o.key, wrap, { wide: o.wide }) : wrap;
    r.set = set; r.get = function () { return val; }; r.btns = btns;
    return r;
  }

  function toggle(o) {
    var b = el('button', 'tgl'), val = !!o.value;
    b.type = 'button';
    b.setAttribute('role', 'switch');
    function paint() { b.classList.toggle('on', val); b.setAttribute('aria-checked', val ? 'true' : 'false'); }
    b.addEventListener('click', function () { val = !val; paint(); if (o.onChange) o.onChange(val); });
    paint();
    var r = row(o.key, b);
    r.set = function (v) { val = !!v; paint(); };
    r.get = function () { return val; };
    return r;
  }

  function button(labelKey, o) {
    o = o || {};
    var b = el('button', 'btn' + (o.primary ? ' primary' : '') + (o.danger ? ' danger' : '') + (o.small ? ' small' : '') + (o.cls ? ' ' + o.cls : ''),
      (o.icon ? icon(o.icon, 15) : '') + (labelKey ? '<span>' + t(labelKey) + '</span>' : ''));
    b.type = 'button';
    tipAttr(b, labelKey);
    if (o.tip) b.setAttribute('data-tip', o.tip);
    if (o.onClick) b.addEventListener('click', function () {
      if (b.classList.contains('busy')) return;
      var r = o.onClick();
      if (r && r.then) { b.classList.add('busy'); r.then(done, done); }
      function done() { b.classList.remove('busy'); }
    });
    return b;
  }

  function iconBtn(name, tip, onClick) {
    var b = el('button', 'icon-btn', icon(name, 15));
    b.type = 'button';
    if (tip) { b.setAttribute('data-tip', tip); b.setAttribute('aria-label', tip); }
    if (onClick) b.addEventListener('click', function (ev) { ev.stopPropagation(); onClick(ev); });
    return b;
  }

  // Icon + short label; the label hides only when the panel is very narrow (tooltip keeps it readable).
  function toolBtn(name, label, tip, onClick) {
    var b = el('button', 'tool-btn', icon(name, 15) + '<span>' + label + '</span>');
    b.type = 'button';
    b.setAttribute('data-tip', tip || label);
    if (onClick) b.addEventListener('click', function (ev) { ev.stopPropagation(); onClick(ev); });
    return b;
  }

  function note(text, kind) { return el('p', 'note' + (kind ? ' ' + kind : ''), (kind === 'warn' ? icon('info', 14) : '') + '<span>' + text + '</span>'); }

  /* ---------- toast & dialogs ---------- */
  var toastEl = null, toastTimer = 0;
  function toast(msg, kind) {
    if (!toastEl) { toastEl = el('div', 'toast'); document.body.appendChild(toastEl); }
    toastEl.className = 'toast on ' + (kind || 'ok');
    toastEl.innerHTML = icon(kind === 'err' ? 'x' : (kind === 'warn' ? 'info' : 'check'), 14) + '<span>' + msg + '</span>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, kind === 'err' ? 6000 : 3200);
  }

  function dialog(o) {
    return new Promise(function (res) {
      var back = el('div', 'modal-back'), box = el('div', 'modal');
      box.innerHTML = '<p class="modal-t"></p>';
      box.querySelector('.modal-t').textContent = o.text;
      var inp = null;
      if (o.input !== undefined) { inp = el('input', 'txt'); inp.value = o.input; box.appendChild(inp); }
      var acts = el('div', 'modal-a');
      var cancel = button('btn.cancel', { onClick: function () { close(null); } });
      var ok = button(o.okKey || 'btn.ok', { primary: !o.danger, danger: o.danger, onClick: function () { close(inp ? inp.value : true); } });
      acts.appendChild(cancel); acts.appendChild(ok); box.appendChild(acts);
      back.appendChild(box); document.body.appendChild(back);
      function close(v) { back.remove(); res(v); }
      back.addEventListener('pointerdown', function (ev) { if (ev.target === back) close(null); });
      box.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') close(inp ? inp.value : true); if (ev.key === 'Escape') close(null); });
      setTimeout(function () { (inp || ok).focus(); if (inp) inp.select(); }, 0);
    });
  }

  window.UI = {
    icon: icon, el: el, section: section, more: more, row: row, slider: slider, vec: vec, color: color, select: select, seg: seg, toggle: toggle,
    button: button, iconBtn: iconBtn, toolBtn: toolBtn, note: note, toast: toast, confirm: function (text, danger) { return dialog({ text: text, danger: danger, okKey: danger ? 'btn.yes' : 'btn.ok' }); },
    prompt: function (text, value) { return dialog({ text: text, input: value || '' }); }, toHex: toHex, fromHex: fromHex, fmt: fmt
  };
})();
