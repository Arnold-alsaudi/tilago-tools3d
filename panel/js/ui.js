/* UI kit: sections, sliders with scrubbable labels, vectors, color picker with HEX, selects,
   segmented controls, toggles, tooltips, toasts and in-panel dialogs. No external libraries. */
(function () {
  var ICON = {
    text: 'M5 5h14M12 5v14M8 19h8',
    scene: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v9m8-4.5L12 12 4 7.5',
    materials: 'M12 3a9 9 0 100 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.4-1-2.6 0-.9.7-1.6 1.6-1.6H16a5 5 0 005-5C21 6.3 17 3 12 3zM7.5 12a1.3 1.3 0 110-.1M9.5 7.5a1.3 1.3 0 110-.1M14.5 7.5a1.3 1.3 0 110-.1',
    environment: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
    lighting: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0012 3z',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4V8zm8 3a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
    animation: 'M7 4v16l13-8L7 4z',
    presets: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',
    settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zm7.4 4.5l1.6 1.2-2 3.5-1.9-.7a7 7 0 01-1.7 1l-.3 2H9.9l-.3-2a7 7 0 01-1.7-1l-1.9.7-2-3.5 1.6-1.2a7 7 0 010-2l-1.6-1.2 2-3.5 1.9.7a7 7 0 011.7-1l.3-2h4.2l.3 2a7 7 0 011.7 1l1.9-.7 2 3.5-1.6 1.2a7 7 0 010 2z',
    chevron: 'M8 10l4 4 4-4',
    eye: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zm10-3a3 3 0 100 6 3 3 0 000-6z',
    eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.1 3.6M6.6 6.6C3.8 8.3 2 12 2 12s3.6 6 10 6c1.6 0 3-.4 4.3-1',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3',
    unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 016.8-1.2',
    copy: 'M8 8h11v11H8zM5 16V5h11',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    group: 'M3 7h8v6H3zM13 11h8v6h-8zM7 13v4h6',
    ungroup: 'M3 5h8v6H3zM13 13h8v6h-8z',
    target: 'M12 4v4M12 16v4M4 12h4M16 12h4M12 9a3 3 0 100 6 3 3 0 000-6z',
    reset: 'M4 12a8 8 0 108-8 8 8 0 00-6.3 3M4 4v4h4',
    plus: 'M12 5v14M5 12h14',
    refresh: 'M20 12a8 8 0 01-14.3 5M4 12A8 8 0 0118.3 7M18 3v4h-4M6 21v-4h4',
    edit: 'M4 20h4L19 9l-4-4L4 16v4z',
    download: 'M12 4v11m-5-5l5 5 5-5M5 20h14',
    upload: 'M12 20V9m-5 5l5-5 5 5M5 4h14',
    play: 'M8 5v14l11-7z',
    move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    frame: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9a1.5 1.5 0 100-.1',
    folder: 'M3 6h6l2 2h10v11H3z',
    check: 'M5 12l5 5L20 7',
    x: 'M6 6l12 12M18 6L6 18',
    link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
    info: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 8v5m0-8.5v.1',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    spot: 'M9 3h6l2 6H7zM8 9l-4 12M16 9l4 12M12 9v12',
    bulb: 'M12 3a6 6 0 016 6c0 3-3 4-3 7H9c0-3-3-4-3-7a6 6 0 016-6zM9 19h6',
    cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z'
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
    icon: icon, el: el, section: section, row: row, slider: slider, vec: vec, color: color, select: select, seg: seg, toggle: toggle,
    button: button, iconBtn: iconBtn, note: note, toast: toast, confirm: function (text, danger) { return dialog({ text: text, danger: danger, okKey: danger ? 'btn.yes' : 'btn.ok' }); },
    prompt: function (text, value) { return dialog({ text: text, input: value || '' }); }, toHex: toHex, fromHex: fromHex, fmt: fmt
  };
})();
