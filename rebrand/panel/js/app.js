/* Tilago Rebrand - one page, six steps. Nothing runs in the background: every action is a button. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = UI.el, icon = UI.icon;
  var path = typeof require === 'function' ? require('path') : null, fs = typeof require === 'function' ? require('fs') : null;

  var S = {
    proj: null, scan: null, scenes: [], logoS: null, polys: null, vec: null,
    brand: Object.assign({ logo: null, name: 'TILAGO', font: null, c1: [0.329, 0.086, 0.71], c2: [0.718, 0.58, 1] }, Store.read('brand.json', {})),
    trace: { channel: 'auto', threshold: 0.5, smooth: 1, minArea: 40, corner: 55, invert: false },
    mats: {}, env: null, fonts: null
  };
  function saveBrand() { try { Store.write('brand.json', S.brand); } catch (e) {} }
  function brandLogo() { return S.brand.logo || (Host.connected ? Host.extPath() + '/img/emblem.png' : 'img/emblem.png'); }
  function fileUrl(f) { return /^([a-z]:|[\\/])/i.test(f) ? 'file:///' + encodeURI(f.replace(/\\/g, '/')) : f; }
  function hex(c) { return UI.toHex(c || [1, 1, 1]); }

  /* ---------- status / errors ---------- */
  var busyN = 0;
  function status(m) { $('#status .msg').textContent = m || t(Host.connected ? 'st.ready' : 'st.noHost'); }
  function busy(on) { busyN += on ? 1 : -1; $('#status').classList.toggle('busy', busyN > 0); }
  function errText(e) {
    if (e && e.code === 'EVAL' && e.message && /^ERR:|line|missing/.test(e.message)) return t('err.EVAL') + ' — ' + e.message.replace(/^ERR:/, '');
    if (e && e.code === 'AEP') return t('err.AEP', { e: e.message });
    if (e && e.code && I18N.has('err.' + e.code)) return t('err.' + e.code);
    return t('err.HOST', { e: (e && e.message) || String(e) });
  }
  window.App = { error: function (e) { console.error(e); UI.toast(errText(e), 'err'); status(errText(e)); } };
  function run(name, args) {
    busy(true);
    return Host.call(name, args).then(function (r) { busy(false); return r; }, function (e) { busy(false); App.error(e); throw e; });
  }

  /* ---------- page ---------- */
  function stepSection(id, n, key, closed) {
    var s = UI.section('rb_' + id, key, { closed: closed });
    var title = s.head.querySelector('.sec-t');
    title.insertAdjacentHTML('afterbegin', '<span class="step-n"><span>' + n + '</span></span>');
    return s;
  }

  function build() {
    document.documentElement.lang = I18N.lang;
    document.documentElement.dir = I18N.lang === 'ar' ? 'rtl' : 'ltr';
    $('#langBtn').textContent = t('lang');
    $('#langBtn').onclick = function () { I18N.set(I18N.lang === 'ar' ? 'en' : 'ar'); build(); };
    $('#ver').textContent = window.Updater && Updater.version ? 'v' + Updater.version : '';
    var main = $('#main');
    main.innerHTML = '';
    Array.prototype.forEach.call(document.querySelectorAll('body > .font-list'), function (n) { n.remove(); });
    buildProject(main); buildBrand(main); buildLogos(main); buildTexts(main); buildE3D(main); buildApply(main);
    status();
  }

  /* 1. project */
  var P = {};
  function buildProject(main) {
    var s = stepSection('proj', 1, 's1');
    main.appendChild(s);
    P.line = el('div', 'proj-line'); s.body.appendChild(P.line);
    P.note = el('div'); s.body.appendChild(P.note);
    var b = el('div', 'btns full');
    P.btn = UI.button(S.scan ? 'rescan' : 'scan', { primary: true, icon: 'refresh', onClick: doScan });
    b.appendChild(P.btn); s.body.appendChild(b);
    P.sum = el('div', 'br-sum'); s.body.appendChild(P.sum);
    paintProject();
  }
  function paintProject() {
    P.line.innerHTML = icon('folder', 15) + '<b></b>';
    P.line.querySelector('b').textContent = S.proj && S.proj.name ? S.proj.name : t('proj.none');
    P.note.innerHTML = '';
    if (S.proj && S.proj.dirty) P.note.appendChild(UI.note(t('proj.dirty'), 'warn'));
    P.sum.innerHTML = '';
    if (!S.scan) return;
    var mats = 0; S.scenes.forEach(function (sc) { mats += sc.materials.length; });
    [['logo', S.scan.logos.length, 'n.logos'], ['text', S.scan.texts.length, 'n.texts'], ['e3d', S.scenes.length, 'n.scenes'], ['materials', mats, 'n.mats']].forEach(function (x) {
      P.sum.appendChild(el('span', 'br-chip', icon(x[0], 14) + '<b>' + x[1] + '</b><span>' + t(x[2]) + '</span>'));
    });
  }

  function doScan() {
    return run('brand.project', {}).then(function (p) {
      S.proj = p;
      if (!p || !p.path) { paintProject(); throw { code: 'UNSAVED' }; }
      return run('brand.scan', {});
    }).then(function (r) {
      r.logos.forEach(function (x) { x.on = x.likely && !x.shared; });
      r.texts.forEach(function (x) { x.on = false; x.newText = x.text; });
      S.scan = r;
      S.scenes = [];
      if (Aep.available && S.proj.path) {
        try { S.scenes = Aep.scan(S.proj.path).scenes; } catch (e) { UI.toast(t('err.AEP', { e: e.message }), 'err'); }
      } else S.scenes = mockScenes();
      S.mats = {};
      build();
    }).catch(function (e) { if (e && e.code === 'UNSAVED') App.error(e); });
  }

  /* 2. brand */
  function buildBrand(main) {
    var s = stepSection('brand', 2, 's2');
    main.appendChild(s);
    var b = s.body;
    var row = el('div', 'brand-logo');
    var img = el('img'); img.alt = ''; img.src = fileUrl(brandLogo());
    row.appendChild(img);
    var bb = el('div', 'btns');
    bb.appendChild(UI.button('brand.change', { small: true, icon: 'upload', onClick: function () {
      var f = Dialog.open(['png', 'jpg', 'jpeg', 'psd', 'tif', 'tiff', 'webp', 'ai', 'eps', 'pdf'], t('brand.change'));
      if (!f) return;
      S.brand.logo = f; saveBrand(); resetLogo(); build();
    } }));
    bb.appendChild(UI.button('brand.reset', { small: true, icon: 'reset', onClick: function () { S.brand.logo = null; saveBrand(); resetLogo(); build(); } }));
    row.appendChild(bb);
    b.appendChild(UI.row('brand.logo', row, { wide: true }));
    var name = el('input', 'txt'); name.value = S.brand.name; name.dir = 'auto';
    name.onchange = function () { S.brand.name = name.value.trim() || 'TILAGO'; saveBrand(); };
    b.appendChild(UI.row('brand.name', name));
    var font = UI.select({ key: 'brand.font', options: [], onChange: function (v) { S.brand.font = v || null; saveBrand(); } });
    b.appendChild(font);
    function fillFonts() {
      var o = [{ v: '', label: t('brand.keepFont') }];
      if (S.fonts) S.fonts.names.forEach(function (n) { S.fonts.families[n].forEach(function (st) { o.push({ v: st.ps, label: n + ' — ' + st.style }); }); });
      font.fill(o, S.brand.font || '');
    }
    fillFonts();
    if (!S.fonts) Fonts.load().then(function (f) { S.fonts = f; fillFonts(); }).catch(function () {});
    b.appendChild(UI.color({ key: 'brand.c1', value: S.brand.c1, onChange: function (c) { S.brand.c1 = c; saveBrand(); paintMats(); } }));
    b.appendChild(UI.color({ key: 'brand.c2', value: S.brand.c2, onChange: function (c) { S.brand.c2 = c; saveBrand(); paintMats(); } }));
  }
  function resetLogo() { S.logoS = null; S.polys = null; S.vec = null; }

  /* 3. logo places (+ trace for mask / shape places) */
  var L = {};
  function buildLogos(main) {
    var s = stepSection('logos', 3, 's3');
    main.appendChild(s);
    L.list = el('div', 'olist br-list'); s.body.appendChild(L.list);
    var tr = UI.more('rb_trace');
    L.cv = el('canvas', 'trace-cv'); tr.body.appendChild(UI.note(t('trace.why')));
    tr.body.appendChild(L.cv);
    L.count = el('div', 'note'); tr.body.appendChild(L.count);
    var O = S.trace;
    tr.add(
      UI.slider({ key: 'trace.threshold', min: 1, max: 99, step: 1, unit: '%', hard: true, value: Math.round(O.threshold * 100), def: 50, onInput: function (v) { O.threshold = v / 100; retrace(); } }),
      UI.slider({ key: 'trace.smooth', min: 0, max: 6, step: 0.1, unit: 'px', hard: true, value: O.smooth, def: 1, onInput: function (v) { O.smooth = v; retrace(); } }),
      UI.seg({ key: 'trace.channel', value: O.channel, wide: true, options: ['auto', 'alpha', 'dark', 'light'].map(function (v) { return { v: v, label: t('ch.' + v) }; }), onChange: function (v) { O.channel = v; S.logoS = null; retrace(); } }),
      UI.slider({ key: 'trace.minArea', min: 0, max: 2000, step: 5, unit: 'px²', floor: 0, value: O.minArea, onInput: function (v) { O.minArea = v; retrace(); } }),
      UI.toggle({ key: 'trace.invert', value: O.invert, onChange: function (v) { O.invert = v; S.logoS = null; retrace(); } }));
    s.body.appendChild(tr);
    paintLogos();
    retrace(true);
  }
  function tags(x) {
    var h = '';
    (x.e3d || []).forEach(function (k) { h += '<span class="tag e3d">' + k + '</span>'; });
    if (x.kind) h += '<span class="tag">' + t('slot.' + x.kind) + '</span>';
    return h;
  }
  function thumb(x) {
    if (x.kind === 'image' && x.file && !/\.(ai|eps|pdf|psd|exr|tga)$/i.test(x.file)) return '<img class="th" src="' + fileUrl(x.file) + '">';
    if (x.kind === 'masks' && x.preview && x.box) {
      var bx = x.box, k = 30 / Math.max(bx[2], bx[3], 1), d = '';
      x.preview.forEach(function (p) { d += 'M' + p.map(function (q) { return ((q[0] - bx[0]) * k + 1).toFixed(1) + ' ' + ((q[1] - bx[1]) * k + 1).toFixed(1); }).join('L') + 'Z'; });
      return '<svg class="th" viewBox="0 0 32 32"><path d="' + d + '" fill="#8f3dff" fill-rule="evenodd" opacity=".85"/></svg>';
    }
    return '<span class="th">' + icon(x.kind === 'shape' ? 'logo' : 'image', 16) + '</span>';
  }
  function checkRow(x) {
    var r = el('div', 'oitem br-item' + (x.on ? ' sel' : ''));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!x.on;
    cb.onclick = function (ev) { ev.stopPropagation(); x.on = cb.checked; r.classList.toggle('sel', x.on); };
    r.appendChild(cb);
    return r;
  }
  function paintLogos() {
    L.list.innerHTML = '';
    if (!S.scan) { L.list.appendChild(el('div', 'empty', t('none.scan'))); return; }
    if (!S.scan.logos.length) { L.list.appendChild(el('div', 'empty', t('none.logos'))); return; }
    S.scan.logos.forEach(function (x) {
      var r = checkRow(x);
      r.insertAdjacentHTML('beforeend', thumb(x));
      var nm = el('div', 'br-name'); nm.innerHTML = '<b></b><small></small><div class="tags">' + tags(x) + '</div>';
      nm.querySelector('b').textContent = x.layer; nm.querySelector('small').textContent = x.comp + (x.shared ? ' · ' + t('shared') : '');
      r.appendChild(nm);
      r.appendChild(UI.iconBtn('target', t('reveal'), function () { Host.call('brand.reveal', { key: x.key }).catch(App.error); }));
      L.list.appendChild(r);
    });
  }
  var rt = 0;
  function retrace(now) {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var f = brandLogo();
      if (/\.(ai|eps|pdf)$/i.test(f)) { if (L.cv) L.cv.style.display = 'none'; return; }
      var p = S.logoS ? Promise.resolve(S.logoS) : Tracer.load(f).then(function (img) { return (S.logoS = Tracer.sample(img, S.trace)); });
      p.then(function (s2) {
        S.polys = Tracer.run(s2, S.trace);
        if (L.cv && L.cv.offsetParent) Tracer.draw(L.cv, s2, S.polys);
        var h = S.polys.filter(function (o) { return o.hole; }).length;
        if (L.count) L.count.textContent = t('trace.count', { n: S.polys.length - h, h: h });
      }).catch(function () { App.error({ code: 'TRACE_LOAD' }); });
    }, now ? 0 : 120);
  }
  // redraw when the fold opens (canvas has no size while hidden)
  document.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('.more-h')) setTimeout(function () { retrace(true); }, 30); });

  /* 4. texts */
  var X = {};
  function buildTexts(main) {
    var s = stepSection('texts', 4, 's4');
    main.appendChild(s);
    var row = el('div', 'color');
    var all = el('input', 'txt'); all.value = S.brand.name; all.dir = 'auto';
    row.appendChild(all);
    row.appendChild(UI.button('texts.fill', { small: true, onClick: function () { if (!S.scan) return; S.scan.texts.forEach(function (x) { if (x.on) x.newText = all.value; }); paintTexts(); } }));
    s.body.appendChild(UI.row('texts.all', row, { wide: true }));
    X.list = el('div', 'olist br-list'); s.body.appendChild(X.list);
    paintTexts();
  }
  function paintTexts() {
    X.list.innerHTML = '';
    if (!S.scan) { X.list.appendChild(el('div', 'empty', t('none.scan'))); return; }
    if (!S.scan.texts.length) { X.list.appendChild(el('div', 'empty', t('none.texts'))); return; }
    S.scan.texts.forEach(function (x) {
      var r = checkRow(x), box = el('div', 'br-name');
      var inp = el('input', 'txt'); inp.value = x.newText; inp.dir = 'auto';
      inp.oninput = function () { x.newText = inp.value; if (!x.on) { x.on = true; r.classList.add('sel'); r.firstChild.checked = true; } };
      inp.onclick = function (ev) { ev.stopPropagation(); };
      var meta = el('small'); meta.textContent = x.comp + ' · ' + x.layer;
      var tg = el('div', 'tags'); tg.innerHTML = tags(x);
      box.appendChild(inp); box.appendChild(meta); box.appendChild(tg);
      r.appendChild(box);
      r.appendChild(UI.iconBtn('target', t('reveal'), function () { Host.call('brand.reveal', { key: x.key }).catch(App.error); }));
      X.list.appendChild(r);
    });
  }

  /* 5. inside Element 3D: material colors, logo as texture, environment */
  var E = {};
  function matState(name) { return S.mats[name] || (S.mats[name] = { mode: 'keep', color: null, logoSlots: {} }); }
  function buildE3D(main) {
    var s = stepSection('e3d', 5, 's5');
    main.appendChild(s);
    E.body = s.body;
    paintMats();
  }
  function paintMats() {
    if (!E.body) return;
    var b = E.body;
    b.innerHTML = '';
    if (!S.scan) { b.appendChild(el('div', 'empty', t('none.scan'))); return; }
    if (!S.scenes.length) { b.appendChild(el('div', 'empty', t('none.e3d'))); return; }
    var top = el('div', 'btns');
    top.appendChild(UI.button('mat.auto', { small: true, icon: 'materials', tip: I18N.tip('mat.autoTip'), onClick: autoColor }));
    b.appendChild(top);
    var seen = {};
    S.scenes.forEach(function (sc, i) {
      var box = el('div', 'olist'); box.style.marginTop = '8px';
      box.appendChild(el('div', 'scene-h', t('scene', { n: i + 1 }) + (sc.copies > 1 ? ' · ' + t('copies', { n: sc.copies }) : '')));
      sc.materials.forEach(function (m) {
        if (seen[m.name]) return;
        seen[m.name] = 1;
        var st = matState(m.name);
        var now = st.mode === 'c1' ? S.brand.c1 : st.mode === 'c2' ? S.brand.c2 : st.mode === 'custom' ? st.color : m.color;
        var row = el('div', 'mat-row');
        row.innerHTML = '<span class="mat-ball" style="background: radial-gradient(circle at 35% 30%, #fff 0%, ' + hex(now) + ' 35%, #000 140%)"></span>';
        var nm = el('div', 'mat-name'); nm.innerHTML = '<b></b><small></small>';
        nm.querySelector('b').textContent = m.name;
        nm.querySelector('small').textContent = m.color ? hex(m.color) + (st.mode !== 'keep' ? ' → ' + hex(now) : '') : '';
        row.appendChild(nm);
        var ctl = el('div', 'mat-ctl');
        var sel = UI.select({ options: [{ v: 'keep', label: t('mat.keep') }, { v: 'c1', label: t('mat.c1') }, { v: 'c2', label: t('mat.c2') }, { v: 'custom', label: t('mat.custom') }], value: st.mode,
          onChange: function (v) { st.mode = v; if (v === 'custom' && !st.color) st.color = m.color || [1, 1, 1]; paintMats(); } });
        ctl.appendChild(sel.sel);
        if (st.mode === 'custom') {
          var c = UI.color({ key: 'x', value: st.color, onChange: function (cc) { st.color = cc; paintMats(); } });
          ctl.appendChild(c.querySelector('.swatch-btn'));
        }
        row.appendChild(ctl);
        box.appendChild(row);
        m.textures.forEach(function (tx) {
          var tr = el('div', 'tex-row');
          tr.innerHTML = icon('image', 12) + '<span class="tex-name"></span>';
          tr.querySelector('.tex-name').textContent = tx.name + ': ' + tx.path.split(/[\\/]/).pop();
          var lab = el('label'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!st.logoSlots[tx.slot];
          cb.onchange = function () { st.logoSlots[tx.slot] = cb.checked; };
          lab.appendChild(cb); lab.appendChild(document.createTextNode(t('mat.logo')));
          tr.appendChild(lab);
          box.appendChild(tr);
        });
      });
      b.appendChild(box);
    });
    // environment
    var envName = S.env ? S.env.split(/[\\/]/).pop() : t('env.keep');
    var er = el('div', 'color');
    var en = el('span', 'tex-name'); en.textContent = envName; en.style.flex = '1';
    er.appendChild(en);
    er.appendChild(UI.button('env.pick', { small: true, icon: 'upload', onClick: function () { var f = Dialog.open(['jpg', 'jpeg', 'png', 'hdr', 'exr'], t('env.pick')); if (f) { S.env = f; paintMats(); } } }));
    if (S.env) er.appendChild(UI.iconBtn('x', t('env.keep'), function () { S.env = null; paintMats(); }));
    var envRow = UI.row('env.title', er, { wide: true }); envRow.style.marginTop = '8px';
    b.appendChild(envRow);
    b.appendChild(UI.note(t('e3d.note')));
  }
  function autoColor() {
    var body = /bevel|edge|side|chrome|gold|silver|metal|outline|rim|frame/i;
    S.scenes.forEach(function (sc) { sc.materials.forEach(function (m) { matState(m.name).mode = body.test(m.name) ? 'c2' : 'c1'; }); });
    paintMats();
  }

  /* 6. apply */
  var A = {};
  function buildApply(main) {
    var s = stepSection('apply', 6, 's6');
    main.appendChild(s);
    s.body.appendChild(UI.note(t('apply.note')));
    var b = el('div', 'btns full big-go');
    b.appendChild(UI.button('apply', { primary: true, icon: 'sparkle', onClick: doApply }));
    s.body.appendChild(b);
    A.prog = el('div', 'progress'); s.body.appendChild(A.prog);
  }
  function progress(steps, cur, err) {
    A.prog.innerHTML = '';
    steps.forEach(function (k, i) {
      var cls = i < cur ? 'done' : i === cur ? (err ? 'err' : 'on') : '';
      A.prog.appendChild(el('div', 'p ' + cls, icon(i < cur ? 'check' : i === cur ? (err ? 'x' : 'refresh') : 'chevron', 13) + '<span>' + t(k) + '</span>'));
    });
  }

  function logoContours() {
    if (S.vec) return markHoles(S.vec.contours);
    if (!S.polys || !S.logoS) return null;
    var k = S.logoS.scale;
    return S.polys.map(function (o) {
      return { v: o.p.map(function (q) { return [q[0] * k, q[1] * k]; }), i: o.bz.i.map(function (q) { return [q[0] * k, q[1] * k]; }), o: o.bz.o.map(function (q) { return [q[0] * k, q[1] * k]; }), hole: o.hole };
    });
  }
  function markHoles(cs) {
    function area(p) { var s2 = 0, i, j; for (i = 0, j = p.length - 1; i < p.length; j = i++) s2 += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return Math.abs(s2 / 2); }
    function inside(q, poly) { var c = false, i, j; for (i = 0, j = poly.length - 1; i < poly.length; j = i++) { if (((poly[i][1] > q[1]) !== (poly[j][1] > q[1])) && (q[0] < (poly[j][0] - poly[i][0]) * (q[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c; } return c; }
    var list = cs.map(function (c) { return { c: c, a: area(c.v) }; }).sort(function (a, b) { return b.a - a.a; });
    list.forEach(function (o, i) { o.d = 0; for (var k = i - 1; k >= 0; k--) if (inside(o.c.v[0], list[k].c.v)) { o.d = list[k].d + 1; break; } o.c.hole = o.d % 2 === 1; });
    return list.map(function (o) { return o.c; });
  }
  // fit outlines inside the old logo's box: same size and place, no stretching
  function fitTo(cs, box) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    cs.forEach(function (c) { if (c.hole) return; c.v.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }); });
    var w = x1 - x0 || 1, h = y1 - y0 || 1, k = Math.min(box[2] / w, box[3] / h);
    var ox = box[0] + (box[2] - w * k) / 2 - x0 * k, oy = box[1] + (box[3] - h * k) / 2 - y0 * k;
    return cs.map(function (c) {
      return { v: c.v.map(function (q) { return [q[0] * k + ox, q[1] * k + oy]; }), i: c.i.map(function (q) { return [q[0] * k, q[1] * k]; }), o: c.o.map(function (q) { return [q[0] * k, q[1] * k]; }), hole: !!c.hole };
    });
  }

  // Copies the logo next to the new project so the Element 3D texture path never depends on the panel's folder.
  function projectLogo(projPath) {
    var src = brandLogo();
    if (!fs || !path) return src;
    var dir = path.join(path.dirname(projPath), 'Tilago Assets');
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir); var dst = path.join(dir, path.basename(src)); fs.copyFileSync(src, dst); return dst.replace(/\\/g, '/'); }
    catch (e) { return src.replace(/\\/g, '/'); }
  }

  function doApply() {
    if (!S.scan) { UI.toast(t('none.scan'), 'warn'); return; }
    var logos = S.scan.logos.filter(function (x) { return x.on; }), texts = S.scan.texts.filter(function (x) { return x.on; });
    var matEdits = {}, anyMat = false;
    Object.keys(S.mats).forEach(function (n) {
      var st = S.mats[n], e = {};
      if (st.mode === 'c1') e.color = S.brand.c1; else if (st.mode === 'c2') e.color = S.brand.c2; else if (st.mode === 'custom' && st.color) e.color = st.color;
      var slots = Object.keys(st.logoSlots).filter(function (k) { return st.logoSlots[k]; });
      if (slots.length) e.slots = slots;
      if (e.color || e.slots) { matEdits[n] = e; anyMat = true; }
    });
    var e3d = anyMat || !!S.env, layers = logos.length || texts.length || S.brand.font;
    if (!e3d && !logos.length && !texts.length) { UI.toast(t('nothing'), 'warn'); return; }
    var cs = null;
    if (logos.some(function (x) { return x.kind !== 'image'; })) {
      cs = logoContours();
      if (!cs || !cs.length) { UI.toast(t('err.TRACE_EMPTY'), 'warn'); return; }
    }
    var steps = ['p.save'].concat(layers ? ['p.layers'] : []).concat(e3d ? ['p.e3d', 'p.open'] : []), cur = 0, newPath = null;
    function next() { cur++; progress(steps, cur); }
    var pre = S.proj && S.proj.dirty ? UI.confirm(t('needSave')) : Promise.resolve(true);
    return pre.then(function (ok) {
      if (!ok) return;
      progress(steps, 0);
      return run('brand.saveCopy', {}).then(function (r) {
        newPath = r.path; next();
        if (!layers) return;
        var plan = {
          logoFile: brandLogo(), font: S.brand.font || null,
          logos: logos.map(function (x) { var o = { key: x.key, kind: x.kind }; if (x.kind !== 'image') o.contours = fitTo(cs, x.box); return o; }),
          texts: texts.map(function (x) { return { key: x.key, text: x.newText }; })
        };
        if (S.brand.font && !texts.length) plan.texts = S.scan.texts.map(function (x) { return { key: x.key, text: null }; });
        return run('brand.apply', plan).then(function () { return run('brand.save', {}); }).then(next);
      }).then(function () {
        if (!e3d) return;
        var logoTex = projectLogo(newPath), edits = { materials: {}, env: S.env ? S.env.replace(/\\/g, '/') : null };
        Object.keys(matEdits).forEach(function (n) {
          var m = matEdits[n], o = {};
          if (m.color) o.color = m.color;
          if (m.slots) { o.textures = {}; m.slots.forEach(function (sl) { o.textures[sl] = logoTex; }); }
          edits.materials[n] = o;
        });
        return run('brand.closeProject', {}).then(function () {
          try { if (Aep.available) Aep.apply(newPath, newPath, edits); }
          catch (e) { progress(steps, cur, true); throw { code: 'AEP', message: e.message }; }
          next();
          return run('brand.open', { path: newPath });
        }).then(next);
      }).then(function () {
        progress(steps, steps.length);
        UI.toast(t('done', { f: newPath.split(/[\\/]/).pop() }));
        S.scan = null; S.proj = null;
        return doScan();
      });
    }).catch(function (e) { if (e && e.code === 'AEP') App.error(e); });
  }

  /* browser preview data (no After Effects / no files) */
  function mockScenes() {
    return [{ env: 'Materials/Environment/Basic_2K/Basic_2K_03.jpg', copies: 2, materials: [
      { name: 'Bevel 1', color: [1, 1, 1], textures: [] }, { name: 'Outline_Illumination', color: [0, 0, 0], textures: [] },
      { name: 'Paint_Red', color: [1, 0, 0], textures: [{ slot: 0, name: 'Diffuse', path: 'Materials/Material_Thumbnail_Env.jpg' }] }] }];
  }

  function start() {
    try {
      var up = JSON.parse(sessionStorage.getItem('ts3d.updated') || 'null');
      if (up) { sessionStorage.removeItem('ts3d.updated'); UI.toast(t(up.restart ? 'upd.restart' : 'upd.done', { v: up.v }), up.restart ? 'warn' : 'ok'); }
    } catch (e) {}
    build();
    Host.call('brand.project', {}).then(function (p) { S.proj = p; paintProject(); }).catch(function () {});
  }
  document.addEventListener('DOMContentLoaded', start);
})();
