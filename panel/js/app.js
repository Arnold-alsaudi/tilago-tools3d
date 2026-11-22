/* Tilago 3D Studio - panel controller. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = UI.el, icon = UI.icon;

  var S = {
    info: null, caps: null, comp: null, items: [], active: null, sel: [], fonts: null,
    mode: 'native', tab: 'main', snapshot: null, listHash: '', busy: 0,
    settings: Object.assign({ live: true, sync: true, quality: 'mid', vpH: 240, vpOpen: true, shading: 'material', mode: 'native' }, Store.read('settings.json', {})),
    draft: { text: 'TILAGO', family: null, ps: null, size: 200, tracking: 0, leading: 0, align: 'center', rtl: false, fill: [0.33, 0.09, 0.71] },
    surface: 'all', light: null, anim: { target: 'active', start: null, duration: 1.5, ease: 'ease', speed: 1, amount: 1, stagger: 0.08, replace: true, color: [1, 1, 1] },
    presetCat: 'material'
  };
  S.mode = S.settings.mode || 'native';
  // Brand identity: Tilago logo + name + font by default, all changeable in Settings.
  S.brand = Object.assign({ logo: null, name: 'TILAGO', font: null }, Store.read('brand.json', {}));
  S.draft.text = S.brand.name;
  function brandLogo() { return S.brand.logo || (Host.connected ? Host.extPath() + '/img/emblem.png' : 'img/emblem.png'); }
  function saveBrand() { try { Store.write('brand.json', S.brand); } catch (e) {} }
  function fontFamilyOf(ps) {
    if (!S.fonts || !ps) return null;
    for (var fam in S.fonts.families) if (S.fonts.families[fam].some(function (s) { return s.ps === ps; })) return fam;
    return null;
  }
  var R = {}; // UI references per pane

  function saveSettings() { S.settings.mode = S.mode; try { Store.write('settings.json', S.settings); } catch (e) {} }

  /* ---------- status / errors ---------- */
  function status(msg) { $('#status .msg').textContent = msg || t('st.ready'); }
  function busy(on) { S.busy += on ? 1 : -1; $('#status').classList.toggle('busy', S.busy > 0); }
  function errText(e) {
    var code = e && e.code;
    if (code === 'EVAL' && e.message && /^ERR:|line|missing/.test(e.message)) return t('err.EVAL') + ' — ' + e.message.replace(/^ERR:/, '');
    if (code && I18N.has('err.' + code)) return t('err.' + code);
    return t('err.HOST', { e: (e && e.message) || String(e) });
  }
  var App = window.App = {
    error: function (e) { console.error(e); UI.toast(errText(e), 'err'); status(errText(e)); }
  };
  function run(name, args, okMsg) {
    busy(true);
    return Host.call(name, args).then(function (r) { if (okMsg) { UI.toast(okMsg); status(okMsg); } return r; })
      .catch(function (e) { App.error(e); throw e; })
      .then(function (r) { busy(false); return r; }, function (e) { busy(false); throw e; });
  }
  function quiet(name, args) { return Host.call(name, args).catch(function (e) { App.error(e); return null; }); }
  // While dragging, values stream to AE only when "live update" is on; the final value is always sent.
  function live(channel, name, args, final) {
    if (final || S.settings.live) Host.live(channel, name, args);
  }

  /* ---------- capabilities ---------- */
  function capsR() {
    if (!S.caps || !S.comp) return null;
    return S.caps.renderers[S.comp.renderer] || null;
  }
  function canGeo(k) { var r = capsR(); return !!(r && r.geo && r.geo[k]); }
  function canMat(k) { var r = capsR(); return !!(r && r.mat && r.mat[k]); }
  function canSurf(s, k) { var r = capsR(); return !!(r && r.surf && r.surf[s] && r.surf[s][k]); }
  function bestRenderer() { return S.caps ? S.caps.best : null; }

  function activeItem() { for (var i = 0; i < S.items.length; i++) if (S.items[i].ref === S.active) return S.items[i]; return null; }
  function isObj(it) { return it && (it.role === 'text' || it.role === 'shape') && it.is3D; }
  function needObj() { var it = activeItem(); if (!isObj(it)) { UI.toast(t('err.NO_OBJECT'), 'warn'); return null; } return it; }
  function selRefs() {
    var objs = S.sel.filter(function (r) { var it = S.items.filter(function (x) { return x.ref === r; })[0]; return isObj(it); });
    if (!objs.length && S.active) objs = [S.active];
    return objs;
  }

  /* ---------- boot ---------- */
  function boot() {
    document.documentElement.lang = I18N.lang;
    document.documentElement.dir = I18N.lang === 'ar' ? 'rtl' : 'ltr';
    $('#langBtn').textContent = I18N.lang === 'ar' ? 'EN' : 'ع';
    $('#langBtn').onclick = function () { I18N.set(I18N.lang === 'ar' ? 'en' : 'ar'); rebuild(); };
    buildTabs();
    buildViewport();
    buildPanes();
    status(Host.connected ? t('st.ready') : t('st.noHost'));
    narrow();
    try {
      var up = JSON.parse(sessionStorage.getItem('ts3d.updated') || 'null');
      if (up) { sessionStorage.removeItem('ts3d.updated'); UI.toast(t(up.restart ? 'upd.restart' : 'upd.done', { v: up.v }), up.restart ? 'warn' : 'ok'); }
    } catch (e) {}
    window.addEventListener('resize', narrow);
  }
  function rebuild() {
    document.documentElement.lang = I18N.lang;
    document.documentElement.dir = I18N.lang === 'ar' ? 'rtl' : 'ltr';
    $('#langBtn').textContent = I18N.lang === 'ar' ? 'EN' : 'ع';
    buildTabs(); buildVpBar(); buildPanes(); updateChips(); renderObjbar(); refreshActive();
    status(Host.connected ? t('st.ready') : t('st.noHost'));
    $('#vpToggle').setAttribute('data-tip', t(S.settings.vpOpen ? 'vp.collapse' : 'vp.expand'));
    if (S.snapshot) $('#vpMsg').textContent = S.snapshot.objects && S.snapshot.objects.length ? '' : t('scene.empty');
  }
  function narrow() { document.body.classList.toggle('narrow', window.innerWidth < 400); }

  function start() {
    boot();
    busy(true);
    status(t('caps.probing'));
    Host.call('caps.info', {}).then(function (info) {
      S.info = info; S.comp = info.comp;
      var cached = Store.read('cache/caps.json', null);
      if (cached && cached.version === info.version && cached.renderers) return cached;
      return Host.call('caps.probe', {}).then(function (p) { Store.write('cache/caps.json', p); return p; });
    }).then(function (caps) {
      S.caps = caps;
      if (S.mode === 'e3d' && !(S.info && S.info.e3d)) S.mode = 'native';
      busy(false);
      status(Host.connected ? t('st.ready') : t('st.noHost'));
      buildPanes(); updateChips();
      if (!S.fonts) loadFonts();
      poll(true);
      setInterval(function () { poll(false); }, 1500);
    }).catch(function (e) { busy(false); App.error(e); buildPanes(); if (!S.fonts) loadFonts(); });
  }

  function loadFonts() {
    Fonts.load().then(function (f) {
      S.fonts = f;
      var bf = fontFamilyOf(S.brand.font);
      if (bf && !S.draft.family) { S.draft.family = bf; S.draft.ps = S.brand.font; }
      if (!S.draft.family) {
        var pref = ['Segoe UI', 'Arial', 'Tahoma'];
        for (var i = 0; i < pref.length; i++) if (f.families[pref[i]]) { S.draft.family = pref[i]; break; }
        if (!S.draft.family) S.draft.family = f.names[0];
        var st = f.families[S.draft.family];
        S.draft.ps = st ? (st.filter(function (s) { return /bold/i.test(s.style); })[0] || st[0]).ps : null;
      }
      if (R.main) R.main.fontsReady();
      if (R.brand && R.brand.fontsReady) R.brand.fontsReady();
      if (R.settings && R.settings.fontsReady) R.settings.fontsReady();
    }).catch(App.error);
  }

  /* ---------- polling ---------- */
  var pollN = 0, polling = false;
  function poll(force) {
    if (polling || document.hidden) return;
    polling = true;
    Host.call('scene.list', {}).then(function (r) {
      polling = false;
      if (!r) return;
      var compChanged = JSON.stringify(r.comp) !== JSON.stringify(S.comp);
      S.comp = r.comp;
      S.items = r.items || [];
      var h = JSON.stringify(S.items.map(function (i) { return [i.ref, i.name, i.enabled, i.locked, i.parent, i.role]; }));
      var listChanged = h !== S.listHash;
      S.listHash = h;
      if (S.settings.sync) {
        var sel = S.items.filter(function (i) { return i.selected; });
        if (sel.length === 1 && sel[0].ref !== S.active && (isObj(sel[0]) || sel[0].role === 'light' || sel[0].role === 'e3d' || sel[0].role === 'e3dtpl')) {
          if (sel[0].role === 'light') { S.light = sel[0].ref; if (R.lights) R.lights.refresh(); }
          else setActive(sel[0].ref, true);
        }
      }
      if (S.active && !activeItem()) setActive(null, true);
      if (!S.active) {
        var first = S.items.filter(isObj)[0];
        if (first) setActive(first.ref, true);
      }
      if (compChanged) { updateChips(); if (R.settings) R.settings.refresh(); }
      if (listChanged || compChanged || force) { renderObjbar(); if (R.scene) R.scene.renderList(); refreshSnapshot(); if (compChanged) refreshActive(); }
      else if (++pollN % 2 === 0 && !dragging()) refreshSnapshot();
    }).catch(function () { polling = false; });
  }
  var dragT = 0;
  function markDrag() { dragT = Date.now(); }
  function dragging() { return Date.now() - dragT < 1500; }

  function refreshSnapshot() {
    if (!Viewport.ready) return Promise.resolve();
    return Host.call('scene.snapshot', {}).then(function (snap) {
      if (!snap || !snap.comp) { $('#vpMsg').textContent = t('scene.nocomp'); return; }
      $('#vpMsg').textContent = snap.objects && snap.objects.length ? '' : t('scene.empty');
      var key = JSON.stringify(snap);
      if (key === S.snapKey) return;
      S.snapKey = key;
      S.snapshot = snap;
      Viewport.load(snap, function (ref) { return Host.call('text.outlines', { ref: ref }); });
      Viewport.select(S.active);
    }).catch(function () {});
  }

  function updateChips() {
    var m = $('#chipMode'), r = $('#chipRenderer');
    m.className = 'chip ' + (S.mode === 'e3d' ? 'warn' : 'ok');
    m.lastChild.textContent = t(S.mode === 'e3d' ? 'mode.e3d' : 'mode.native');
    var rn = S.comp ? S.comp.rendererName : '—';
    r.className = 'chip ' + (S.comp && canGeo('depth') ? 'ok' : 'warn');
    r.lastChild.textContent = rn;
    r.setAttribute('data-tip', S.comp ? S.comp.name + ' · ' + S.comp.w + '×' + S.comp.h : t('scene.nocomp'));
    $('#stComp').textContent = S.comp ? S.comp.name : '';
  }

  function setActive(ref, fromPoll) {
    if (ref === S.active) return;
    S.active = ref;
    if (S.sel.indexOf(ref) < 0) S.sel = ref ? [ref] : [];
    renderObjbar();
    if (R.scene) R.scene.renderList();
    Viewport.select(ref);
    refreshActive();
    if (ref && !fromPoll && S.settings.sync) quiet('scene.select', { ref: ref });
  }

  function refreshActive() {
    ['main', 'scene', 'materials', 'camera', 'anim', 'e3d'].forEach(function (k) { if (R[k] && R[k].refresh) R[k].refresh(); });
  }

  /* ---------- tabs ---------- */
  // Five tabs; library + settings live behind the gear in the header.
  var TABS = [['main', 'text'], ['brand', 'logo'], ['materials', 'materials'], ['scene', 'scene'], ['lighting', 'lighting'], ['animation', 'animation']];
  function buildTabs() {
    var gear = $('#setBtn');
    gear.innerHTML = icon('settings', 15) + '<span>' + t('tab.settings') + '</span>';
    gear.setAttribute('data-tip', t('tab.settings') + ' · ' + t('tab.presets'));
    gear.classList.toggle('on', S.tab === 'settings');
    gear.onclick = function () { S.tab = S.tab === 'settings' ? 'main' : 'settings'; buildTabs(); showPane(); };
    var nav = $('#tabs');
    nav.innerHTML = '';
    TABS.forEach(function (tb) {
      var b = el('button', 'tab' + (S.tab === tb[0] ? ' on' : ''), icon(tb[1], 17) + '<span>' + t('tab.' + tb[0]) + '</span>');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-tip', t('tab.' + tb[0]));
      b.onclick = function () { S.tab = tb[0]; buildTabs(); showPane(); };
      nav.appendChild(b);
    });
  }
  function showPane() {
    Array.prototype.forEach.call(document.querySelectorAll('.pane'), function (p) { p.classList.toggle('on', p.id === 'pane-' + S.tab); });
    $('#main').scrollTop = 0;
    if (S.tab === 'lighting') { if (R.lights) R.lights.refresh(); if (R.env) R.env.refresh(); }
    if (S.tab === 'scene' && R.camera) R.camera.refresh();
    if (S.tab === 'settings' && R.presets) R.presets.refresh();
  }

  /* ---------- object bar ---------- */
  function renderObjbar() {
    var bar = $('#objbar');
    bar.innerHTML = '';
    bar.appendChild(el('span', 'lbl2', t('obj.pick')));
    var objs = S.items.filter(function (i) { return isObj(i) || i.role === 'e3d' || i.role === 'e3dtpl'; });
    var s = UI.select({
      options: objs.length ? objs.map(function (o) { return { v: o.ref, label: o.name + '  ·  ' + t('role.' + o.role) }; }) : [{ v: '', label: S.comp ? t('obj.none') : t('scene.nocomp') }],
      value: S.active || '', onChange: function (v) { setActive(v || null); }
    });
    bar.appendChild(s.sel);
    bar.appendChild(UI.toolBtn('refresh', t('obj.refreshS'), t('obj.refresh'), function () { S.listHash = ''; poll(true); }));
  }

  /* ---------- viewport ---------- */
  function buildViewport() {
    var wrap = $('#vpWrap');
    wrap.style.setProperty('--vp-h', S.settings.vpH + 'px');
    wrap.classList.toggle('collapsed', !S.settings.vpOpen);
    $('#vpToggle').innerHTML = icon('chevron', 12);
    $('#vpToggle').onclick = function () {
      S.settings.vpOpen = !S.settings.vpOpen; wrap.classList.toggle('collapsed', !S.settings.vpOpen); saveSettings();
      $('#vpToggle').setAttribute('data-tip', t(S.settings.vpOpen ? 'vp.collapse' : 'vp.expand'));
      setTimeout(Viewport.resize, 0);
    };
    $('#vpToggle').setAttribute('data-tip', t(S.settings.vpOpen ? 'vp.collapse' : 'vp.expand'));
    var rz = $('#vpResize'), sy = 0, sh = 0;
    rz.addEventListener('pointerdown', function (ev) { sy = ev.clientY; sh = wrap.offsetHeight; rz.setPointerCapture(ev.pointerId); });
    rz.addEventListener('pointermove', function (ev) {
      if (!rz.hasPointerCapture(ev.pointerId)) return;
      S.settings.vpH = Math.max(120, Math.min(window.innerHeight - 160, sh + ev.clientY - sy));
      wrap.style.setProperty('--vp-h', S.settings.vpH + 'px');
    });
    rz.addEventListener('pointerup', function () { saveSettings(); });

    var ok = !!(window.THREE && THREE.OrbitControls) && Viewport.init($('#vp'), {
      onSelect: function (ref) { if (ref) setActive(ref); },
      onMove: function (ref, pos, final) {
        markDrag();
        Host.live('move', 'scene.setTransform', { ref: ref, values: { position: pos } });
        if (final && R.scene) R.scene.refresh();
      },
      onViewChange: function (v, end) {
        if (R.vp) R.vp.view.set(v);
        if (end && R.vp && R.vp.camSync && S.snapshot && S.snapshot.camera) applyViewToCamera(true);
      }
    });
    if (!ok) { $('#vpMsg').textContent = t('vp.nogl'); return; }
    Viewport.setQuality(S.settings.quality);
    Viewport.setShading(S.settings.shading);
    Viewport.setView('persp');
    buildVpBar();
  }

  function buildVpBar() {
    var bar = $('#vpBar');
    bar.innerHTML = '';
    if (!Viewport.ready) return;
    R.vp = {};
    var views = ['persp', 'camera', 'front', 'back', 'left', 'right', 'top', 'bottom'];
    R.vp.view = UI.select({ options: views.map(function (v) { return { v: v, label: t('vp.' + v) }; }), value: Viewport.currentView(), onChange: function (v) { Viewport.setView(v); } });
    bar.appendChild(R.vp.view.sel);
    var shades = ['wire', 'shaded', 'material', 'hq'];
    var sh = UI.select({ options: shades.map(function (v) { return { v: v, label: t('vp.' + v) }; }), value: S.settings.shading,
      onChange: function (v) { S.settings.shading = v; saveSettings(); Viewport.setShading(v); if (v === 'hq') Viewport.setQuality('high'); else Viewport.setQuality(S.settings.quality); } });
    bar.appendChild(sh.sel);
    bar.appendChild(el('span', 'sp'));
    var mv = UI.toolBtn('move', t('vp.moveS'), t('vp.move'), function () { mv.classList.toggle('on'); Viewport.setMoveMode(mv.classList.contains('on')); });
    bar.appendChild(mv);
    bar.appendChild(UI.toolBtn('frame', t('vp.fitS'), t('vp.fit'), function () { Viewport.fit(); }));
    bar.appendChild(UI.toolBtn('camera', t('vp.toCamS'), t('vp.toCam'), function () { applyViewToCamera(false); }));
    bar.appendChild(UI.toolBtn('image', t('vp.frameS'), t('vp.frame'), grabFrame));
    $('#vpBadge').textContent = t('vp.approx');
  }

  function applyViewToCamera(silent) {
    var v = Viewport.viewAsAECamera();
    var p = (S.snapshot && S.snapshot.camera) ? Promise.resolve() : Host.call('camera.ensure', {});
    return p.then(function () { return Host.call('camera.set', { values: v }); }).then(function (c) {
      if (!silent) UI.toast(t('ok.updated'));
      if (S.snapshot) S.snapshot.camera = c;
      if (R.camera) R.camera.refresh();
    }).catch(App.error);
  }

  function grabFrame() {
    var f = $('#vpFrame');
    if (f.classList.contains('on')) { f.classList.remove('on'); return; }
    var p = Store.tmpFile('frame_' + Date.now() + '.png');
    run('scene.saveFrame', { path: p }).then(function () {
      var tries = 0;
      (function wait() {
        if (Store.exists(p)) {
          f.style.backgroundImage = 'url("file:///' + p.replace(/\\/g, '/') + '")';
          f.classList.add('on');
          f.onclick = function () { f.classList.remove('on'); };
        } else if (tries++ < 40) setTimeout(wait, 250);
        else App.error({ code: 'FRAME_WRITE' });
      })();
    }).catch(function () {});
  }

  /* ---------- panes ---------- */
  function buildPanes() {
    var main = $('#main');
    main.innerHTML = '';
    Array.prototype.forEach.call(document.querySelectorAll('body > .font-list'), function (n) { n.remove(); });
    R = { vp: R.vp };
    if (['main', 'brand', 'materials', 'scene', 'lighting', 'animation', 'settings'].indexOf(S.tab) < 0) S.tab = 'main';
    [['main', [buildMain]], ['brand', [buildBrand]], ['materials', [buildMaterials]], ['scene', [buildScene, buildCamera]], ['lighting', [buildLights, buildEnv]],
     ['animation', [buildAnim]], ['settings', [buildSettings, buildPresets]]].forEach(function (p) {
      var pane = el('div', 'pane' + (S.tab === p[0] ? ' on' : ''));
      pane.id = 'pane-' + p[0];
      main.appendChild(pane);
      p[1].forEach(function (fn) {
        try { fn(pane); } catch (e) { console.error(e); pane.appendChild(UI.note(String(e.message), 'err')); }
      });
    });
    refreshActive();
  }

  /* ====================== MAIN (text + geometry) ====================== */
  function buildMain(pane) {
    var M = R.main = {};
    // ---- what to make + which engine, always visible ----
    var top = el('div', 'start-bar');
    var hasE3D = !!(S.info && S.info.e3d);
    M.modeSeg = UI.seg({ key: 'start.engine', value: S.mode, wide: true, options: [
      { v: 'native', icon: 'cube', label: t('mode.native') },
      { v: 'e3d', icon: 'e3d', label: t('mode.e3d'), tip: hasE3D ? '' : t('e3d.missing') }],
      onChange: function (v) {
        if (v === 'e3d' && !hasE3D) { M.modeSeg.set('native'); UI.toast(t('e3d.missing'), 'warn'); return; }
        S.mode = v; saveSettings(); updateChips(); refreshActive(); srcVis();
      } });
    S.source = S.source || 'text';
    M.srcSeg = UI.seg({ key: 'start.source', value: S.source, wide: true, options: [
      { v: 'text', icon: 'text', label: t('src.text') }, { v: 'logo', icon: 'logo', label: t('src.logo') }],
      onChange: function (v) { S.source = v; srcVis(); } });
    top.appendChild(M.modeSeg); top.appendChild(M.srcSeg);
    pane.appendChild(top);
    var sec = UI.section('text', 'sec.text');
    pane.appendChild(sec);
    var logoSec = UI.section('logo', 'sec.logo');
    pane.appendChild(logoSec);
    buildLogo(logoSec.body, M);
    function srcVis() {
      sec.style.display = S.source === 'text' ? '' : 'none';
      logoSec.style.display = S.source === 'logo' ? '' : 'none';
      if (M.logoRefresh) M.logoRefresh();
      if (M.gsec) M.gsec.style.display = S.mode === 'e3d' ? 'none' : '';
    }
    M.srcVis = srcVis;
    var b = sec.body;

    var ta = el('textarea', 'txt');
    ta.placeholder = t('text.ph');
    ta.value = S.draft.text;
    ta.dir = 'auto';
    var typeT = 0;
    ta.addEventListener('input', function () {
      S.draft.text = ta.value;
      // the active text object follows what you type
      clearTimeout(typeT);
      typeT = setTimeout(function () {
        var it = activeItem();
        if (it && it.role === 'text' && S.draft.text.trim()) {
          Host.live('text', 'text.update', { ref: it.ref, text: S.draft.text, rtl: S.draft.rtl, recenter: true });
          setTimeout(refreshSnapshot, 700);
        }
      }, 450);
      var ar = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(ta.value);
      if (ar !== S.draft.rtl) { S.draft.rtl = ar; M.rtl.set(ar); rtlNote(); if (ar && S.draft.align === 'center') {} }
    });
    ta.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.ctrlKey) { ev.preventDefault(); doUpdate(); } });
    var tl = el('label', 'lbl', t('text.input')); tl.setAttribute('data-tip', I18N.tip('text.input'));
    M.editing = el('span', 'editing'); tl.appendChild(M.editing);
    b.appendChild(tl); b.appendChild(ta);

    // font family picker with search
    var fp = el('div', 'font-pick');
    var fin = el('input', 'txt'); fin.placeholder = t('font.loading'); fin.spellcheck = false;
    var flist = el('div', 'font-list');
    fp.appendChild(fin);
    // the list lives on <body> so the cut-corner sections never clip it
    document.body.appendChild(flist);
    function placeList() {
      var r = fin.getBoundingClientRect();
      flist.style.left = r.left + 'px'; flist.style.width = r.width + 'px';
      var below = window.innerHeight - r.bottom;
      if (below < 200 && r.top > below) { flist.style.top = ''; flist.style.bottom = (window.innerHeight - r.top + 3) + 'px'; }
      else { flist.style.bottom = ''; flist.style.top = (r.bottom + 3) + 'px'; }
    }
    var hl = -1;
    function renderFonts(q) {
      flist.innerHTML = '';
      if (!S.fonts) return;
      q = (q || '').toLowerCase();
      var names = S.fonts.names.filter(function (n) { return !q || n.toLowerCase().indexOf(q) >= 0; }).slice(0, 250);
      names.forEach(function (n, i) {
        var o = el('div', 'font-opt');
        o.textContent = n;
        o.style.fontFamily = '"' + n + '", ' + 'var(--font)';
        var sm = el('small', '', S.fonts.families[n].length + '');
        o.appendChild(sm);
        o.onmousedown = function (ev) { ev.preventDefault(); pickFamily(n); };
        flist.appendChild(o);
      });
      hl = -1;
    }
    function pickFamily(n) {
      S.draft.family = n;
      fin.value = n;
      flist.classList.remove('on');
      fillStyles(true);
      textLive();
    }
    fin.addEventListener('focus', function () { renderFonts(''); placeList(); flist.classList.add('on'); fin.select(); });
    fin.addEventListener('blur', function () { setTimeout(function () { flist.classList.remove('on'); fin.value = S.draft.family || ''; }, 120); });
    fin.addEventListener('input', function () { renderFonts(fin.value); placeList(); flist.classList.add('on'); });
    fin.addEventListener('keydown', function (ev) {
      var opts = flist.children;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        hl = Math.max(0, Math.min(opts.length - 1, hl + (ev.key === 'ArrowDown' ? 1 : -1)));
        Array.prototype.forEach.call(opts, function (o, i) { o.classList.toggle('hl', i === hl); });
        if (opts[hl]) opts[hl].scrollIntoView({ block: 'nearest' });
      }
      if (ev.key === 'Enter' && opts.length) { pickFamily((opts[hl >= 0 ? hl : 0]).firstChild.textContent); fin.blur(); }
      if (ev.key === 'Escape') fin.blur();
    });
    b.appendChild(UI.row('font.family', fp));

    M.style = UI.select({ key: 'font.style', options: [], onChange: function (v) { S.draft.ps = v; textLive(); } });
    b.appendChild(M.style);
    function fillStyles(pickDefault) {
      var st = S.fonts && S.draft.family ? S.fonts.families[S.draft.family] || [] : [];
      if (pickDefault || !st.some(function (s) { return s.ps === S.draft.ps; })) S.draft.ps = st.length ? (st.filter(function (s) { return /^(regular|book|normal|roman)$/i.test(s.style); })[0] || st[0]).ps : S.draft.ps;
      M.style.fill(st.map(function (s) { return { v: s.ps, label: s.style }; }), S.draft.ps);
      ta.style.fontFamily = S.draft.family ? '"' + S.draft.family + '", var(--font)' : '';
    }
    M.fontsReady = function () { fin.placeholder = t('font.search'); fin.value = S.draft.family || ''; fillStyles(false); };

    M.size = UI.slider({ key: 'font.size', min: 4, max: 800, step: 1, value: S.draft.size, unit: 'px', floor: 1, def: 200, onInput: function (v) { S.draft.size = v; textLive(); }, onChange: function () { textLive(true); } });
    M.tracking = UI.slider({ key: 'font.tracking', min: -200, max: 800, step: 1, value: S.draft.tracking, def: 0, onInput: function (v) { S.draft.tracking = v; textLive(); }, onChange: function () { textLive(true); } });
    M.leading = UI.slider({ key: 'font.leading', min: 0, max: 800, step: 1, value: S.draft.leading, def: 0, onInput: function (v) { S.draft.leading = v; textLive(); }, onChange: function () { textLive(true); } });
    M.align = UI.seg({ key: 'font.align', value: S.draft.align, options: ['left', 'center', 'right'].map(function (a) { return { v: a, label: t('align.' + a) }; }), onChange: function (v) { S.draft.align = v; textLive(true); } });
    M.rtl = UI.toggle({ key: 'font.rtl', value: S.draft.rtl, onChange: function (v) { S.draft.rtl = v; rtlNote(); textLive(true); } });
    M.fill = UI.color({ key: 'font.fill', value: S.draft.fill, onInput: function (c) { S.draft.fill = c; var it = activeItem(); if (isObj(it)) { Viewport.patch(it.ref, 'mat', { fill: c }); live('fill', 'materials.set', { ref: it.ref, values: { fill: c } }); } } });
    [M.size, M.align, M.fill].forEach(function (x) { b.appendChild(x); });
    b.appendChild(UI.more('text').add(M.tracking, M.leading, M.rtl));
    var rn = el('div'); b.appendChild(rn);
    function rtlNote() { rn.innerHTML = ''; if (S.draft.rtl && !(S.info && S.info.paragraphDirection)) rn.appendChild(UI.note(t('rtl.note'), 'warn')); }
    rtlNote();

    var bt = el('div', 'btns full');
    bt.appendChild(UI.button('btn.create', { primary: true, icon: 'cube', onClick: doCreate }));
    M.updBtn = UI.button('btn.update', { icon: 'refresh', onClick: doUpdate });
    b.appendChild(bt);
    var bt2 = el('div', 'btns full');
    bt2.appendChild(UI.button('btn.convert', { icon: 'target', small: true, onClick: doConvert }));
    b.appendChild(bt2);

    function textArgs() {
      return { text: S.draft.text, font: S.draft.ps, size: S.draft.size, tracking: S.draft.tracking, leading: S.draft.leading, align: S.draft.align, rtl: S.draft.rtl, fill: S.draft.fill };
    }
    function textLive(final) {
      var it = activeItem();
      if (!it || it.role !== 'text') return;
      var a = textArgs(); delete a.text; a.ref = it.ref;
      live('text', 'text.update', a, final);
      if (final) setTimeout(refreshSnapshot, 400);
    }
    function doCreate() {
      if (!S.draft.text.trim()) { UI.toast(t('err.EMPTY_TEXT'), 'warn'); return; }
      var a = textArgs();
      a.renderer = canGeo('depth') ? null : bestRenderer();
      return run('text.create', a, t('ok.created')).then(function (r) {
        if (r.comp) S.comp = r.comp;
        notesToast(r.notes);
        // default look so the first result is already a finished 3D title
        var g = Presets.geometry[2].values;
        var geo = Object.assign({ origin: 'center' }, g);
        var jobs = [], e3d = S.mode === 'e3d' && S.info && S.info.e3d;
        if (canGeo('depth') && !e3d) jobs.push(Host.call('geometry.set', { ref: r.ref, values: geo }));
        var hasLights = S.items.some(function (i) { return i.role === 'light'; });
        if (!hasLights && !e3d) jobs.push(Host.call('lights.applyPreset', { lights: Presets.lighting[0].lights, replace: false }));
        return Promise.all(jobs).then(function () {
          if (e3d) return Host.call('e3d.create', { textRef: r.ref, templateRef: R.e3d && R.e3d.template ? R.e3d.template() : null });
        }).then(function () {
          S.active = r.ref; S.sel = [r.ref]; S.listHash = '';
          updateChips(); poll(true); refreshActive();
        });
      }).catch(function () {});
    }
    function doUpdate() {
      var it = activeItem();
      if (!it || it.role !== 'text') { UI.toast(t('err.NOT_TEXT'), 'warn'); return; }
      if (!S.draft.text.trim()) { UI.toast(t('err.EMPTY_TEXT'), 'warn'); return; }
      var a = textArgs(); a.ref = it.ref; a.recenter = true;
      return run('text.update', a, t('ok.updated')).then(function (r) { notesToast(r.notes); S.listHash = ''; poll(true); }).catch(function () {});
    }
    function doConvert() {
      return run('text.convertSelected', { renderer: canGeo('depth') ? null : bestRenderer() }).then(function (r) {
        UI.toast(t('ok.converted', { n: r.refs.length }));
        if (r.comp) S.comp = r.comp;
        S.active = r.refs[0]; S.sel = r.refs.slice(); S.listHash = '';
        updateChips(); poll(true); refreshActive();
      }).catch(function () {});
    }
    function notesToast(notes) {
      if (!notes || !notes.length) return;
      if (notes.indexOf('rtl') >= 0) UI.toast(t('rtl.note'), 'warn');
      else if (notes.indexOf('font') >= 0) UI.toast(t('err.HOST', { e: 'font' }), 'warn');
    }

    // ---- Element 3D section (Mode A) ----
    var e3dSec = el('div');
    pane.appendChild(e3dSec);
    R.e3d = { refresh: function () { renderE3D(e3dSec); }, template: function () { return R.e3d.tpl ? R.e3d.tpl.get() || null : null; } };

    // ---- geometry ----
    var gsec = M.gsec = UI.section('geometry', 'sec.geometry');
    pane.appendChild(gsec);
    var G = M.geo = {};
    function gset(values, final) {
      var it = activeItem();
      if (!isObj(it)) return;
      if (values.depth !== undefined && values.origin === undefined) values.origin = G.origin.get();
      Viewport.patch(it.ref, 'geo', values);
      markDrag();
      live('geo', 'geometry.set', { refs: selRefs(), values: values }, final);
    }
    G.depth = UI.slider({ key: 'geo.depth', min: 0, max: 1000, step: 1, unit: 'px', floor: 0, def: 50, onInput: function (v) { gset({ depth: v }); }, onChange: function (v) { gset({ depth: v }, true); } });
    G.origin = UI.seg({ key: 'geo.origin', value: 'front', options: ['front', 'center', 'back'].map(function (o) { return { v: o, label: t('origin.' + o) }; }), onChange: function (v) { gset({ origin: v }, true); } });
    G.scale = UI.slider({ key: 'geo.scale', min: 0, max: 400, step: 1, unit: '%', floor: 0, def: 100, onInput: function (v) { gset({ depthScale: v }); }, onChange: function (v) { gset({ depthScale: v }, true); } });
    G.bevel = UI.seg({ key: 'geo.bevelStyle', value: 'none', wide: true, options: ['none', 'angular', 'concave', 'convex'].map(function (o) { return { v: o, label: t('bevel.' + o) }; }), onChange: function (v) { gset({ bevelStyle: v }, true); } });
    G.bdepth = UI.slider({ key: 'geo.bevelDepth', min: 0, max: 60, step: 0.5, unit: 'px', floor: 0, def: 4, onInput: function (v) { gset({ bevelDepth: v }); }, onChange: function (v) { gset({ bevelDepth: v }, true); } });
    G.hole = UI.slider({ key: 'geo.holeBevel', min: 0, max: 100, step: 1, unit: '%', hard: true, def: 100, onInput: function (v) { gset({ holeBevel: v }); }, onChange: function (v) { gset({ holeBevel: v }, true); } });
    G.faceBox = el('div');
    var fh = el('div', 'sub-h', t('sec.faces'));
    G.faces = {};
    G.faceBox.appendChild(fh);
    ['Front', 'Back', 'Side', 'Bevel'].forEach(function (f) {
      G.faces[f] = UI.toggle({ key: 'face.' + f, value: true, onChange: function (v) { var o = {}; o[f] = v; gset({ faces: o }, true); } });
      G.faceBox.appendChild(G.faces[f]);
    });
    G.na = el('div');
    var gpre = el('div', 'grid');
    gpre.style.marginTop = '10px';
    Presets.geometry.forEach(function (p) {
      var c = el('button', 'card', Art.geo(p.values) + '<span>' + (I18N.lang === 'ar' ? p.ar : p.en) + '</span>');
      c.type = 'button';
      c.onclick = function () { applyGeometry(p.values); };
      gpre.appendChild(c);
    });
    gpre.style.margin = '0 0 8px';
    [gpre, G.na, G.depth, G.bevel, G.bdepth].forEach(function (x) { gsec.body.appendChild(x); });
    gsec.body.appendChild(UI.more('geo').add(G.origin, G.scale, G.hole, G.faceBox));

    M.refresh = function () {
      var it = activeItem();
      M.editing.textContent = it && it.role === 'text' ? '· ' + t('text.editing', { n: it.name }) : '';
      var ok = canGeo('depth');
      G.na.innerHTML = '';
      if (!ok) G.na.appendChild(UI.note(t('geo.na'), 'warn'));
      [G.depth, G.origin, G.scale].forEach(function (x) { x.style.display = ok ? '' : 'none'; });
      G.bevel.style.display = canGeo('bevelStyle') ? '' : 'none';
      G.bdepth.style.display = canGeo('bevelDepth') ? '' : 'none';
      G.hole.style.display = canGeo('holeBevel') ? '' : 'none';
      gpre.style.display = ok ? '' : 'none';
      G.faceBox.style.display = ok && it && it.role === 'text' && canSurf('Front', 'opacity') ? '' : 'none';
      M.srcVis();
      if (R.e3d) R.e3d.refresh();
      if (!isObj(it)) return;
      Host.call('geometry.get', { ref: it.ref }).then(function (g) {
        if (!g || !g.supported) return;
        G.depth.set(g.depth); G.origin.set(g.origin); G.scale.set(g.depthScale); G.bevel.set(g.bevelStyle); G.bdepth.set(g.bevelDepth); G.hole.set(g.holeBevel);
        if (g.faces) Object.keys(g.faces).forEach(function (f) { if (G.faces[f]) G.faces[f].set(g.faces[f]); });
      }).catch(function () {});
      if (it.role === 'text') {
        Host.call('text.read', { ref: it.ref }).then(function (d) {
          if (!d || !d.isText) return;
          S.draft.text = d.text; ta.value = d.text;
          S.draft.size = d.size; M.size.set(d.size);
          S.draft.tracking = d.tracking; M.tracking.set(d.tracking);
          S.draft.leading = d.leading; M.leading.set(d.leading);
          S.draft.align = d.align; M.align.set(d.align);
          S.draft.rtl = !!d.rtl || /[؀-ۿ]/.test(d.text); M.rtl.set(S.draft.rtl); rtlNote();
          if (d.fill) { S.draft.fill = d.fill; M.fill.set(d.fill); }
          if (d.font && S.fonts) {
            for (var fam in S.fonts.families) {
              if (S.fonts.families[fam].some(function (s) { return s.ps === d.font; })) { S.draft.family = fam; S.draft.ps = d.font; fin.value = fam; fillStyles(false); break; }
            }
          }
        }).catch(function () {});
      }
    };
  }

  function applyGeometry(values, refs) {
    var it = activeItem();
    if (!isObj(it)) { UI.toast(t('err.NO_OBJECT'), 'warn'); return Promise.resolve(); }
    var v = Object.assign({}, values);
    if (v.origin === undefined && R.main) v.origin = R.main.geo.origin.get();
    Viewport.patch(it.ref, 'geo', v);
    return run('geometry.set', { refs: refs || selRefs(), values: v }, t('ok.updated')).then(function () { if (R.main) R.main.refresh(); }).catch(function () {});
  }

  /* ---------- Logo: import, one-click auto trace, link to Element 3D or native extrusion ---------- */
  function buildLogo(b, M) {
    var L = { info: null, S: null, polys: null, key: '', file: brandLogo() };
    var pick = el('div', 'btns full');
    pick.appendChild(UI.button('logo.file', { icon: 'upload', onClick: function () {
      var f = Dialog.open(['png', 'jpg', 'jpeg', 'psd', 'tif', 'tiff', 'webp', 'ai', 'eps', 'pdf', 'svg'], t('logo.file'));
      if (!f) return;
      return run('logo.importFile', { file: f }).then(setLogo).catch(function () {});
    } }));
    pick.appendChild(UI.button('logo.useSel', { icon: 'target', onClick: function () { return run('logo.selected', {}).then(setLogo).catch(function () {}); } }));
    b.appendChild(pick);
    var infoEl = el('div', 'logo-info'); b.appendChild(infoEl);
    var cv = el('canvas', 'trace-cv'); b.appendChild(cv);
    var opts = el('div'); b.appendChild(opts);
    var O = { channel: 'auto', threshold: 0.5, smooth: 1, minArea: 40, corner: 55, invert: false };
    var chan = UI.seg({ key: 'trace.channel', value: 'auto', wide: true, options: ['auto', 'alpha', 'dark', 'light'].map(function (v) { return { v: v, label: t('ch.' + v) }; }), onChange: function (v) { O.channel = v; L.S = null; retrace(); } });
    var th = UI.slider({ key: 'trace.threshold', min: 1, max: 99, step: 1, unit: '%', hard: true, value: 50, def: 50, onInput: function (v) { O.threshold = v / 100; retrace(); } });
    var sm = UI.slider({ key: 'trace.smooth', min: 0, max: 6, step: 0.1, unit: 'px', hard: true, value: 1, def: 1, onInput: function (v) { O.smooth = v; retrace(); } });
    var mina = UI.slider({ key: 'trace.minArea', min: 0, max: 2000, step: 5, unit: 'px²', floor: 0, value: 40, def: 40, onInput: function (v) { O.minArea = v; retrace(); } });
    var inv = UI.toggle({ key: 'trace.invert', value: false, onChange: function (v) { O.invert = v; L.S = null; retrace(); } });
    var corner = UI.slider({ key: 'trace.corner', min: 10, max: 120, step: 1, unit: '°', hard: true, value: 55, def: 55, onInput: function (v) { O.corner = v; retrace(); } });
    [chan, th, sm, mina].forEach(function (x) { opts.appendChild(x); });
    opts.appendChild(UI.more('trace').add(inv, corner));
    var go = el('div', 'btns full');
    M.logoGo = UI.button('logo.go', { primary: true, icon: 'trace', onClick: doLogo });
    go.appendChild(M.logoGo);
    b.appendChild(go);

    function setLogo(inf) {
      L.info = inf; L.file = inf ? inf.file : brandLogo(); L.S = null; L.polys = null;
      M.logoRefresh();
      if (inf && inf.kind === 'raster') retrace(true);
    }
    var rt = 0;
    function retrace(now) {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var file = L.info ? L.info.file : L.file;
        if (!file || (L.info && L.info.kind !== 'raster') || /\.(ai|eps|pdf)$/i.test(file)) return;
        var p = L.S ? Promise.resolve(L.S) : Tracer.load(file).then(function (img) { return (L.S = Tracer.sample(img, O)); });
        p.then(function (S2) {
          L.polys = Tracer.run(S2, O);
          Tracer.draw(cv, S2, L.polys);
          var holes = L.polys.filter(function (o) { return o.hole; }).length;
          infoEl.lastChild.textContent = t('trace.count', { n: L.polys.length - holes, h: holes });
        }).catch(function () { App.error({ code: 'TRACE_LOAD' }); });
      }, now ? 0 : 120);
    }
    M.logoRefresh = function () {
      var inf = L.info;
      infoEl.innerHTML = '';
      var e3d = S.mode === 'e3d';
      M.logoGo.querySelector('span').textContent = t(inf && inf.kind !== 'raster' ? (e3d ? 'logo.goVecE3D' : 'logo.goVec') : (e3d ? 'logo.goE3D' : 'logo.go'));
      if (!inf) {
        // no logo picked: the brand logo (Tilago by default) is ready to go
        var bl = el('div', 'logo-line', icon('logo', 14) + '<b></b><span class="tag"></span>');
        bl.querySelector('b').textContent = t(S.brand.logo ? 'brand.yourLogo' : 'brand.tilagoLogo');
        bl.querySelector('.tag').textContent = t('brand.default');
        infoEl.appendChild(bl); infoEl.appendChild(el('div', 'note'));
        var vec = /\.(ai|eps|pdf)$/i.test(L.file);
        cv.style.display = vec ? 'none' : ''; opts.style.display = vec ? 'none' : '';
        if (!vec) retrace(true);
        return;
      }
      var line = el('div', 'logo-line', icon(inf.kind === 'raster' ? 'image' : 'logo', 14) + '<b></b><span class="tag"></span>');
      line.querySelector('b').textContent = inf.name;
      line.querySelector('.tag').textContent = t('kind.' + inf.kind);
      infoEl.appendChild(line);
      infoEl.appendChild(el('div', 'note'));
      var raster = inf.kind === 'raster';
      cv.style.display = raster ? '' : 'none';
      opts.style.display = raster ? '' : 'none';
      if (!raster) infoEl.lastChild.textContent = t('logo.vecHint'); else retrace(true);
    };

    function doLogo() {
      if (!L.info) {
        // bring the brand logo into the comp first, then continue with the same trace
        var keep = { S: L.S, polys: L.polys };
        return run('logo.importFile', { file: L.file }).then(function (inf) {
          L.info = inf; L.S = keep.S; L.polys = keep.polys; M.logoRefresh();
          if (inf.kind === 'raster' && !L.polys) throw { code: 'TRACE_EMPTY' };
          return doLogo();
        }).catch(App.error);
      }
      var e3d = S.mode === 'e3d' && S.info && S.info.e3d;
      var as = e3d ? 'masks' : 'shape';
      var contoursP;
      if (L.info.kind === 'raster') {
        if (!L.polys || !L.polys.length) { UI.toast(t('err.TRACE_EMPTY'), 'warn'); return; }
        contoursP = Host.call('logo.rasterPlacement', { ref: L.info.ref }).then(function (place) { return Tracer.toComp(L.polys, L.S, place); });
      } else {
        contoursP = Host.call('logo.vectorContours', { ref: L.info.ref }).then(function (r) { return markHoles(r.contours); });
      }
      busy(true);
      return contoursP.then(function (contours) {
        return Host.call('logo.build', { as: as, contours: contours, name: L.info.name.replace(/^Logo - /, '') + ' 3D', hideRef: L.info.ref, color: S.draft.fill });
      }).then(function (built) {
        if (e3d) return Host.call('e3d.create', { textRef: built.ref, templateRef: R.e3d && R.e3d.template ? R.e3d.template() : null });
        var jobs = [];
        if (canGeo('depth')) jobs.push(Host.call('geometry.set', { ref: built.ref, values: Object.assign({ origin: 'center' }, Presets.geometry[3].values) }));
        if (!S.items.some(function (i) { return i.role === 'light'; })) jobs.push(Host.call('lights.applyPreset', { lights: Presets.lighting[0].lights, replace: false }));
        return Promise.all(jobs).then(function () { return built; });
      }).then(function (r) {
        busy(false);
        UI.toast(t(e3d ? 'logo.doneE3D' : 'logo.done'));
        S.active = r.ref; S.sel = [r.ref]; S.listHash = ''; poll(true); refreshActive();
      }).catch(function (e) { busy(false); App.error(e); });
    }
    // vector outlines: decide holes by even-odd nesting (vertex polygons are precise enough for nesting)
    function markHoles(cs) {
      function area(p) { var s2 = 0, i, j; for (i = 0, j = p.length - 1; i < p.length; j = i++) s2 += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return Math.abs(s2 / 2); }
      function inside(q, poly) { var c = false, i, j; for (i = 0, j = poly.length - 1; i < poly.length; j = i++) { if (((poly[i][1] > q[1]) !== (poly[j][1] > q[1])) && (q[0] < (poly[j][0] - poly[i][0]) * (q[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c; } return c; }
      var list = cs.map(function (c) { return { c: c, a: area(c.v) }; }).sort(function (a, b) { return b.a - a.a; });
      list.forEach(function (o, i) { o.d = 0; for (var k = i - 1; k >= 0; k--) if (inside(o.c.v[0], list[k].c.v)) { o.d = list[k].d + 1; break; } o.c.hole = o.d % 2 === 1; });
      return list.map(function (o) { return o.c; });
    }
    M.logoRefresh();
  }

  /* ---------- Element 3D (Mode A) ---------- */
  function renderE3D(box) {
    box.innerHTML = '';
    if (S.mode !== 'e3d') return;
    var sec = UI.section('e3d', 'sec.e3d', { badge: 'Mode A' });
    box.appendChild(sec);
    var b = sec.body;
    if (!(S.info && S.info.e3d)) { b.appendChild(UI.note(t('e3d.missing'), 'warn')); return; }
    b.appendChild(UI.note(t('e3d.step')));
    Host.call('e3d.list', {}).then(function (list) {
      var tpls = list.filter(function (l) { return l.template; });
      R.e3d.tpl = UI.select({ key: 'e3d.template', options: [{ v: '', label: t('e3d.noTemplate') }].concat(tpls.map(function (l) { return { v: l.ref, label: l.name }; })), value: '' });
      b.appendChild(R.e3d.tpl);
      var it = activeItem();
      var bt = el('div', 'btns');
      if (it && (it.role === 'text' || it.role === 'shape')) {
        bt.appendChild(UI.button('btn.e3dCreate', { primary: true, icon: 'link', onClick: function () {
          return run('e3d.create', { textRef: it.ref, templateRef: R.e3d.tpl.get() || null }, t('ok.created')).then(function (r) { S.listHash = ''; S.active = r.ref; poll(true); }).catch(function () {});
        } }));
      }
      if (it && (it.role === 'e3d' || it.role === 'e3dtpl')) {
        bt.appendChild(UI.button('e3d.open', { icon: 'settings', onClick: function () { return quiet('e3d.select', { ref: it.ref }); } }));
        if (it.role === 'e3d') bt.appendChild(UI.button('e3d.markTpl', { icon: 'download', onClick: function () {
          return UI.prompt(t('pre.name'), it.name).then(function (n) { if (n) return run('e3d.markTemplate', { ref: it.ref, name: n }, t('pre.saved')).then(function () { S.listHash = ''; poll(true); renderE3D(box); }); });
        } }));
      }
      b.appendChild(bt);
      if (it && (it.role === 'e3d' || it.role === 'e3dtpl')) paramsInspector(b, it.ref);
    }).catch(App.error);
  }

  // Generic inspector: shows the real parameters an effect exposes, with its own names.
  function paramsInspector(parent, ref) {
    var holder = el('div');
    holder.appendChild(el('div', 'sub-h', t('e3d.params')));
    parent.appendChild(holder);
    Host.call('e3d.params', { ref: ref }).then(function (params) {
      var groups = {};
      params.forEach(function (p) { (groups[p.group || '—'] = groups[p.group || '—'] || []).push(p); });
      Object.keys(groups).forEach(function (g, gi) {
        var s = UI.section('e3dp_' + gi, 'x', { closed: gi > 0 });
        s.head.querySelector('.sec-t').textContent = g;
        holder.appendChild(s);
        groups[g].forEach(function (p) {
          var send = function (v, final) { live('e3d' + p.path.join('_'), 'e3d.setParam', { ref: ref, path: p.path, type: p.type, value: v }, final); };
          var ctl;
          if (p.type === 'num' || p.type === 'menu') {
            var mn = p.min !== undefined ? p.min : 0, mx = p.max !== undefined ? p.max : Math.max(100, Math.abs(p.value) * 4);
            if (mx - mn > 100000) { mn = Math.min(p.value, 0); mx = Math.max(p.value * 4, 1000); }
            ctl = UI.slider({ key: 'x', min: mn, max: mx, step: p.type === 'menu' ? 1 : (mx - mn > 50 ? 1 : 0.01), value: p.value, hard: p.min !== undefined && p.max !== undefined, onInput: function (v) { send(v); }, onChange: function (v) { send(v, true); } });
          } else if (p.type === 'color') {
            ctl = UI.color({ key: 'x', value: p.value, onInput: function (c) { send(c); }, onChange: function (c) { send(c, true); } });
          } else if (p.type === 'vec2' || p.type === 'vec3') {
            ctl = UI.vec({ key: 'x', axes: p.type === 'vec2' ? 2 : 3, value: p.value, step: 1, onInput: function (v) { send(v); }, onChange: function (v) { send(v, true); } });
          } else return;
          ctl.label.textContent = p.name;
          ctl.label.removeAttribute('data-tip');
          s.body.appendChild(ctl);
        });
      });
    }).catch(App.error);
  }

  /* ====================== REBRAND (templates, Element 3D aware) ====================== */
  function buildBrand(pane) {
    var B = R.brand = { scan: null, logo: null, S: null, polys: null, vec: null };
    var BR = S.brand;
    var O = { channel: 'auto', threshold: 0.5, smooth: 1, minArea: 40, corner: 55, invert: false };
    pane.appendChild(UI.note(t('br.intro')));

    // 1. scan
    var s1 = UI.section('br_scan', 'br.s1'); pane.appendChild(s1);
    var sum = el('div', 'br-sum');
    var scanBtn = UI.button('br.scan', { primary: true, icon: 'refresh', onClick: doScan });
    s1.body.appendChild(scanBtn); s1.body.appendChild(sum);

    // 2. new logo
    var s2 = UI.section('br_logo', 'br.s2'); pane.appendChild(s2);
    var lb = el('div', 'btns full');
    lb.appendChild(UI.button('logo.file', { icon: 'upload', onClick: pickLogo }));
    s2.body.appendChild(lb);
    var linfo = el('div', 'logo-info'); s2.body.appendChild(linfo);
    var cv = el('canvas', 'trace-cv'); cv.style.display = 'none'; s2.body.appendChild(cv);
    var topt = el('div'); topt.style.display = 'none'; s2.body.appendChild(topt);
    topt.appendChild(UI.note(t('br.traceWhy')));
    topt.appendChild(UI.slider({ key: 'trace.threshold', min: 1, max: 99, step: 1, unit: '%', hard: true, value: 50, def: 50, onInput: function (v) { O.threshold = v / 100; retrace(); } }));
    topt.appendChild(UI.slider({ key: 'trace.smooth', min: 0, max: 6, step: 0.1, unit: 'px', hard: true, value: 1, def: 1, onInput: function (v) { O.smooth = v; retrace(); } }));
    topt.appendChild(UI.more('br_trace').add(
      UI.seg({ key: 'trace.channel', value: 'auto', wide: true, options: ['auto', 'alpha', 'dark', 'light'].map(function (v) { return { v: v, label: t('ch.' + v) }; }), onChange: function (v) { O.channel = v; B.S = null; retrace(); } }),
      UI.slider({ key: 'trace.minArea', min: 0, max: 2000, step: 5, unit: 'px²', floor: 0, value: 40, onInput: function (v) { O.minArea = v; retrace(); } }),
      UI.toggle({ key: 'trace.invert', value: false, onChange: function (v) { O.invert = v; B.S = null; retrace(); } })));

    // 3. logo slots
    var s3 = UI.section('br_slots', 'br.s3'); pane.appendChild(s3);
    var slots = el('div', 'olist br-list'); s3.body.appendChild(slots);
    // 4. texts + font
    var s4 = UI.section('br_texts', 'br.s4'); pane.appendChild(s4);
    var allRow = el('div', 'color');
    var allIn = el('input', 'txt'); allIn.placeholder = t('br.allPh'); allIn.dir = 'auto'; allIn.value = BR.name;
    allRow.appendChild(allIn);
    allRow.appendChild(UI.button('br.fill', { small: true, onClick: function () {
      if (!B.scan) return;
      B.scan.texts.forEach(function (x) { if (x.on) { x.newText = allIn.value; } });
      renderTexts();
    } }));
    s4.body.appendChild(UI.row('br.all', allRow, { wide: true }));
    var fontSel = UI.select({ key: 'br.font', options: [], value: '' });
    s4.body.appendChild(fontSel);
    var texts = el('div', 'olist br-list'); s4.body.appendChild(texts);

    var go = el('div', 'btns full'); go.style.marginTop = '4px';
    go.appendChild(UI.button('br.apply', { primary: true, icon: 'sparkle', onClick: doApply }));
    pane.appendChild(go);

    function fillFonts() {
      var opts = [{ v: '', label: t('br.keepFont') }];
      if (S.fonts) S.fonts.names.forEach(function (n) { S.fonts.families[n].forEach(function (st) { opts.push({ v: st.ps, label: n + ' — ' + st.style }); }); });
      fontSel.fill(opts, fontSel.get() || BR.font || '');
    }
    B.fontsReady = fillFonts;
    fillFonts();

    function doScan() {
      return run('brand.scan', {}).then(function (r) {
        r.logos.forEach(function (x) { x.on = x.likely && !x.shared; });
        r.texts.forEach(function (x) { x.on = false; x.newText = x.text; });
        B.scan = r;
        sum.innerHTML = '';
        [['logo', r.logos.length, 'br.nLogos'], ['text', r.texts.length, 'br.nTexts'], ['e3d', r.links.length, 'br.nLinks']].forEach(function (x) {
          var c = el('span', 'br-chip', icon(x[0], 14) + '<b>' + x[1] + '</b><span>' + t(x[2]) + '</span>'); sum.appendChild(c);
        });
        renderSlots(); renderTexts();
      }).catch(function () {});
    }

    function tags(x) {
      var h = '';
      (x.e3d || []).forEach(function (k) { h += '<span class="tag e3d">' + k + '</span>'; });
      if (x.kind) h += '<span class="tag">' + t('slot.' + x.kind) + '</span>';
      return h;
    }
    function thumb(x) {
      if (x.kind === 'image' && x.file && !/\.(ai|eps|pdf|psd|exr|tga)$/i.test(x.file)) return '<img class="th" src="file:///' + encodeURI(x.file.replace(/\\/g, '/')) + '">';
      if (x.kind === 'masks' && x.preview && x.box) {
        var bx = x.box, k = 30 / Math.max(bx[2], bx[3], 1), d = '';
        x.preview.forEach(function (p) { d += 'M' + p.map(function (q) { return ((q[0] - bx[0]) * k + 1).toFixed(1) + ' ' + ((q[1] - bx[1]) * k + 1).toFixed(1); }).join('L') + 'Z'; });
        return '<svg class="th" viewBox="0 0 32 32"><path d="' + d + '" fill="#8f3dff" fill-rule="evenodd" opacity=".85"/></svg>';
      }
      return '<span class="th">' + icon(x.kind === 'shape' ? 'logo' : 'image', 16) + '</span>';
    }
    function rowFor(x, onToggle) {
      var r = el('div', 'oitem br-item' + (x.on ? ' sel' : ''));
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!x.on;
      cb.onclick = function (ev) { ev.stopPropagation(); x.on = cb.checked; r.classList.toggle('sel', x.on); if (onToggle) onToggle(); };
      r.appendChild(cb);
      return r;
    }
    function renderSlots() {
      slots.innerHTML = '';
      if (!B.scan) { slots.appendChild(el('div', 'empty', t('br.noScan'))); return; }
      if (!B.scan.logos.length) { slots.appendChild(el('div', 'empty', t('br.noLogos'))); return; }
      B.scan.logos.forEach(function (x) {
        var r = rowFor(x);
        r.insertAdjacentHTML('beforeend', thumb(x));
        var nm = el('div', 'br-name'); nm.innerHTML = '<b></b><small></small><div class="tags">' + tags(x) + '</div>';
        nm.querySelector('b').textContent = x.layer; nm.querySelector('small').textContent = x.comp + (x.shared ? ' · ' + t('br.shared') : '');
        r.appendChild(nm);
        r.appendChild(UI.iconBtn('target', t('br.reveal'), function () { quiet('brand.reveal', { key: x.key }); }));
        slots.appendChild(r);
      });
    }
    function renderTexts() {
      texts.innerHTML = '';
      if (!B.scan) { texts.appendChild(el('div', 'empty', t('br.noScan'))); return; }
      if (!B.scan.texts.length) { texts.appendChild(el('div', 'empty', t('br.noTexts'))); return; }
      B.scan.texts.forEach(function (x) {
        var r = rowFor(x);
        var box = el('div', 'br-name');
        var inp = el('input', 'txt'); inp.value = x.newText; inp.dir = 'auto';
        inp.oninput = function () { x.newText = inp.value; if (!x.on) { x.on = true; r.classList.add('sel'); r.firstChild.checked = true; } };
        inp.onclick = function (ev) { ev.stopPropagation(); };
        var meta = el('small'); meta.textContent = x.comp + ' · ' + x.layer;
        box.appendChild(inp); box.appendChild(meta);
        var tg = el('div', 'tags'); tg.innerHTML = tags(x); box.appendChild(tg);
        r.appendChild(box);
        r.appendChild(UI.iconBtn('target', t('br.reveal'), function () { quiet('brand.reveal', { key: x.key }); }));
        texts.appendChild(r);
      });
    }

    function pickLogo() {
      var f = Dialog.open(['png', 'jpg', 'jpeg', 'psd', 'tif', 'tiff', 'webp', 'ai', 'eps', 'pdf', 'svg'], t('logo.file'));
      if (!f) return;
      return useLogo(f, false);
    }
    function useLogo(f, isDefault) {
      B.logo = f; B.S = null; B.polys = null; B.vec = null;
      var vector = /\.(ai|eps|pdf)$/i.test(f);
      linfo.innerHTML = '';
      var line = el('div', 'logo-line', icon(vector ? 'logo' : 'image', 14) + '<b></b><span class="tag"></span>');
      line.querySelector('b').textContent = isDefault ? t(BR.logo ? 'brand.yourLogo' : 'brand.tilagoLogo') : f.split(/[\\/]/).pop();
      line.querySelector('.tag').textContent = t(vector ? 'kind.vector' : 'kind.raster');
      linfo.appendChild(line);
      linfo.appendChild(el('div', 'note'));
      cv.style.display = vector ? 'none' : '';
      topt.style.display = vector ? 'none' : '';
      if (vector) {
        linfo.lastChild.textContent = t('logo.vecHint');
        return run('brand.vectorFromFile', { file: f }).then(function (r) { B.vec = r; }).catch(function () {});
      }
      retrace(true);
    }
    var rt = 0;
    function retrace(now) {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (!B.logo || /\.(ai|eps|pdf)$/i.test(B.logo)) return;
        var p = B.S ? Promise.resolve(B.S) : Tracer.load(B.logo).then(function (img) { return (B.S = Tracer.sample(img, O)); });
        p.then(function (S2) {
          B.polys = Tracer.run(S2, O);
          Tracer.draw(cv, S2, B.polys);
          var holes = B.polys.filter(function (o) { return o.hole; }).length;
          linfo.lastChild.textContent = t('trace.count', { n: B.polys.length - holes, h: holes });
        }).catch(function () { App.error({ code: 'TRACE_LOAD' }); });
      }, now ? 0 : 120);
    }

    // new logo outlines in their own pixel space: [{v,i,o,hole}]
    function logoContours() {
      if (B.vec) return markHolesGlobal(B.vec.contours);
      if (!B.polys || !B.S) return null;
      var k = B.S.scale;
      return B.polys.map(function (o) { return { v: o.p.map(function (q) { return [q[0] * k, q[1] * k]; }), i: o.bz.i.map(function (q) { return [q[0] * k, q[1] * k]; }), o: o.bz.o.map(function (q) { return [q[0] * k, q[1] * k]; }), hole: o.hole }; });
    }
    // fit outlines inside a slot box (contain + centered), like the old logo's size and place
    function fitTo(cs, box) {
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      cs.forEach(function (c) { if (c.hole) return; c.v.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }); });
      var w = x1 - x0 || 1, h = y1 - y0 || 1, k = Math.min(box[2] / w, box[3] / h);
      var ox = box[0] + (box[2] - w * k) / 2 - x0 * k, oy = box[1] + (box[3] - h * k) / 2 - y0 * k;
      return cs.map(function (c) {
        return { v: c.v.map(function (q) { return [q[0] * k + ox, q[1] * k + oy]; }), i: c.i.map(function (q) { return [q[0] * k, q[1] * k]; }), o: c.o.map(function (q) { return [q[0] * k, q[1] * k]; }), hole: !!c.hole };
      });
    }

    function doApply() {
      if (!B.scan) { UI.toast(t('br.noScan'), 'warn'); return; }
      var logos = B.scan.logos.filter(function (x) { return x.on; }), txs = B.scan.texts.filter(function (x) { return x.on; });
      var font = fontSel.get() || null;
      if (!logos.length && !txs.length) { UI.toast(t('br.nothing'), 'warn'); return; }
      if (logos.length && !B.logo) { UI.toast(t('br.needLogo'), 'warn'); return; }
      var needsOutline = logos.some(function (x) { return x.kind !== 'image'; }), cs = null;
      if (needsOutline) {
        cs = logoContours();
        if (!cs || !cs.length) { UI.toast(t('err.TRACE_EMPTY'), 'warn'); return; }
      }
      var plan = {
        logoFile: B.logo, font: font,
        logos: logos.map(function (x) { var o = { key: x.key, kind: x.kind }; if (x.kind !== 'image') o.contours = fitTo(cs, x.box); return o; }),
        texts: txs.map(function (x) { return { key: x.key, text: x.newText }; })
      };
      if (font && !txs.length) plan.texts = B.scan.texts.map(function (x) { return { key: x.key, text: null }; });
      return run('brand.apply', plan).then(function (r) {
        UI.toast(t('br.done', { l: r.logos, t: r.texts }) + (r.skipped.length ? ' · ' + t('br.skipped', { n: r.skipped.length }) : ''), r.skipped.length ? 'warn' : 'ok');
        if (r.skipped.length) console.warn(r.skipped);
        S.listHash = ''; poll(true);
        return doScan();
      }).catch(function () {});
    }
    renderSlots(); renderTexts();
    useLogo(brandLogo(), true);
  }

  function markHolesGlobal(cs) {
    function area(p) { var s2 = 0, i, j; for (i = 0, j = p.length - 1; i < p.length; j = i++) s2 += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return Math.abs(s2 / 2); }
    function inside(q, poly) { var c = false, i, j; for (i = 0, j = poly.length - 1; i < poly.length; j = i++) { if (((poly[i][1] > q[1]) !== (poly[j][1] > q[1])) && (q[0] < (poly[j][0] - poly[i][0]) * (q[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c; } return c; }
    var list = cs.map(function (c) { return { c: c, a: area(c.v) }; }).sort(function (a, b) { return b.a - a.a; });
    list.forEach(function (o, i) { o.d = 0; for (var k = i - 1; k >= 0; k--) if (inside(o.c.v[0], list[k].c.v)) { o.d = list[k].d + 1; break; } o.c.hole = o.d % 2 === 1; });
    return list.map(function (o) { return o.c; });
  }

  /* ====================== SCENE ====================== */
  function buildScene(pane) {
    var M = R.scene = {};
    var sec = UI.section('objects', 'sec.objects');
    pane.appendChild(sec);
    var list = el('div', 'olist');
    sec.body.appendChild(list);
    var acts = el('div', 'btns');
    acts.appendChild(UI.button('act.duplicate', { small: true, icon: 'copy', onClick: function () {
      var it = activeItem(); if (!it) return;
      return run('scene.duplicate', { ref: it.ref, offset: [60, 60, 0] }).then(function (r) { S.active = r.ref; S.sel = [r.ref]; S.listHash = ''; poll(true); });
    } }));
    acts.appendChild(UI.button('act.group', { small: true, icon: 'group', onClick: function () {
      var refs = S.sel.length ? S.sel : (S.active ? [S.active] : []);
      if (!refs.length) return;
      return run('scene.group', { refs: refs, name: 'Group' }).then(function () { S.listHash = ''; poll(true); });
    } }));
    acts.appendChild(UI.button('act.ungroup', { small: true, icon: 'ungroup', onClick: function () {
      var g = S.items.filter(function (i) { return i.role === 'group' && (S.sel.indexOf(i.ref) >= 0 || i.ref === S.active); })[0];
      var it = activeItem();
      if (!g && it && it.parent) g = { ref: it.parent };
      if (!g) return;
      return run('scene.ungroup', { ref: g.ref }).then(function () { S.listHash = ''; poll(true); });
    } }));
    acts.appendChild(UI.button('act.delete', { small: true, icon: 'trash', danger: true, onClick: function () {
      var refs = S.sel.length ? S.sel : (S.active ? [S.active] : []);
      if (!refs.length) return;
      return UI.confirm(t('confirm.delete', { n: refs.length }), true).then(function (ok) {
        if (!ok) return;
        return run('scene.remove', { refs: refs }).then(function () { S.sel = []; S.active = null; S.listHash = ''; poll(true); });
      });
    } }));
    sec.body.appendChild(acts);

    M.renderList = function () {
      list.innerHTML = '';
      if (!S.comp) { list.appendChild(el('div', 'empty', t('scene.nocomp'))); return; }
      var shown = S.items.filter(function (i) { return i.is3D || i.tagged || i.role === 'bg' || i.role === 'env'; });
      if (!shown.length) { list.appendChild(el('div', 'empty', t('scene.empty'))); return; }
      var roleIcon = { text: 'text', shape: 'cube', light: 'bulb', camera: 'camera', group: 'group', bg: 'image', env: 'environment', e3d: 'cube', e3dtpl: 'presets', envlight: 'sun', layer: 'cube' };
      shown.forEach(function (it) {
        var row = el('div', 'oitem' + (S.sel.indexOf(it.ref) >= 0 ? ' sel' : '') + (it.ref === S.active ? ' active' : '') + (it.enabled ? '' : ' off') + (it.parent ? ' child' : ''));
        row.innerHTML = '<span class="ic-role">' + icon(roleIcon[it.role] || 'cube', 14) + '</span>';
        var nm = el('span', 'oname'); nm.textContent = it.name; row.appendChild(nm);
        row.appendChild(el('span', 'orole', t('role.' + it.role)));
        row.appendChild(UI.iconBtn(it.enabled ? 'eye' : 'eyeOff', t('act.hide'), function () { quiet('scene.setFlags', { ref: it.ref, enabled: !it.enabled }).then(function () { S.listHash = ''; poll(true); }); }));
        var lk = UI.iconBtn(it.locked ? 'lock' : 'unlock', t('act.lock'), function () { quiet('scene.setFlags', { ref: it.ref, locked: !it.locked }).then(function () { S.listHash = ''; poll(true); }); });
        if (it.locked) lk.classList.add('on');
        row.appendChild(lk);
        row.onclick = function (ev) {
          if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
            var i = S.sel.indexOf(it.ref);
            if (i >= 0) S.sel.splice(i, 1); else S.sel.push(it.ref);
            M.renderList();
            return;
          }
          S.sel = [it.ref];
          if (it.role === 'light') { S.light = it.ref; S.tab = 'lighting'; buildTabs(); showPane(); return; }
          if (it.role === 'camera') { S.tab = 'camera'; buildTabs(); showPane(); return; }
          if (it.role === 'bg' || it.role === 'env') { S.tab = 'environment'; buildTabs(); showPane(); return; }
          setActive(it.ref);
        };
        nm.ondblclick = function (ev) {
          ev.stopPropagation();
          var inp = el('input', 'txt'); inp.value = it.name;
          nm.replaceWith(inp); inp.focus(); inp.select();
          var done = false;
          function commit(save) {
            if (done) return; done = true;
            if (save && inp.value.trim() && inp.value !== it.name) quiet('scene.rename', { ref: it.ref, name: inp.value.trim() }).then(function () { S.listHash = ''; poll(true); });
            else M.renderList();
          }
          inp.onkeydown = function (e2) { if (e2.key === 'Enter') commit(true); if (e2.key === 'Escape') commit(false); };
          inp.onblur = function () { commit(true); };
          inp.onclick = function (e3) { e3.stopPropagation(); };
        };
        nm.setAttribute('data-tip', t('act.rename'));
        list.appendChild(row);
      });
    };

    // transform
    var ts = UI.section('transform', 'sec.transform');
    pane.appendChild(ts);
    function tset(values, final) {
      var it = activeItem(); if (!it) return;
      markDrag();
      Viewport.patch(it.ref, 'transform', values);
      live('tf', 'scene.setTransform', { ref: it.ref, values: values }, final);
    }
    M.pos = UI.vec({ key: 'tf.position', step: 1, onInput: function (v) { tset({ position: v }); }, onChange: function (v) { tset({ position: v }, true); } });
    M.ori = UI.vec({ key: 'tf.orientation', step: 0.1, onInput: function (v) { tset({ orientation: v }); }, onChange: function (v) { tset({ orientation: v }, true); } });
    M.rx = UI.slider({ key: 'tf.rx', min: -180, max: 180, step: 0.1, unit: '°', def: 0, onInput: function (v) { tset({ rx: v }); }, onChange: function (v) { tset({ rx: v }, true); } });
    M.ry = UI.slider({ key: 'tf.ry', min: -180, max: 180, step: 0.1, unit: '°', def: 0, onInput: function (v) { tset({ ry: v }); }, onChange: function (v) { tset({ ry: v }, true); } });
    M.rz = UI.slider({ key: 'tf.rz', min: -180, max: 180, step: 0.1, unit: '°', def: 0, onInput: function (v) { tset({ rz: v }); }, onChange: function (v) { tset({ rz: v }, true); } });
    M.scale = UI.vec({ key: 'tf.scale', step: 0.1, link: true, onInput: function (v) { tset({ scale: v }); }, onChange: function (v) { tset({ scale: v }, true); } });
    M.anchor = UI.vec({ key: 'tf.anchor', step: 0.1, onInput: function (v) { tset({ anchor: v }); }, onChange: function (v) { tset({ anchor: v }, true); } });
    M.opacity = UI.slider({ key: 'tf.opacity', min: 0, max: 100, step: 1, unit: '%', hard: true, def: 100, onInput: function (v) { tset({ opacity: v }); }, onChange: function (v) { tset({ opacity: v }, true); } });
    [M.pos, M.rx, M.ry, M.rz, M.scale].forEach(function (x) { ts.body.appendChild(x); });
    var tfMore = UI.more('tf').add(M.ori, M.anchor, M.opacity);
    ts.body.appendChild(tfMore);
    var tb = el('div', 'btns');
    tb.appendChild(UI.button('act.center', { small: true, icon: 'target', onClick: function () { var it = activeItem(); if (it) return run('scene.centerAnchor', { ref: it.ref }).then(function (r) { fillT(r); refreshSnapshot(); }); } }));
    tb.appendChild(UI.button('act.reset', { small: true, icon: 'reset', onClick: function () { var it = activeItem(); if (it) return run('scene.resetTransform', { ref: it.ref }).then(function (r) { fillT(r); refreshSnapshot(); }); } }));
    tfMore.body.appendChild(tb);
    function fillT(tf) {
      if (!tf) return;
      M.pos.set(tf.position); M.ori.set(tf.orientation); M.rx.set(tf.rx); M.ry.set(tf.ry); M.rz.set(tf.rz);
      if (tf.scale) M.scale.set(tf.scale); if (tf.anchor) M.anchor.set(tf.anchor); if (tf.opacity !== undefined) M.opacity.set(tf.opacity);
    }
    M.refresh = function () {
      M.renderList();
      var it = activeItem();
      ts.style.display = it ? '' : 'none';
      if (it && !dragging()) Host.call('scene.getTransform', { ref: it.ref }).then(fillT).catch(function () {});
    };
  }

  /* ====================== MATERIALS ====================== */
  var MAT_SLIDERS = [['ambient', 0, 100], ['diffuse', 0, 100], ['specular', 0, 100], ['shininess', 0, 100], ['metal', 0, 100], ['reflection', 0, 100],
                     ['gloss', 0, 100], ['fresnel', 0, 100], ['transparency', 0, 100], ['transRolloff', 0, 100], ['ior', 1, 5, 0.01], ['lightTrans', 0, 100]];
  var MAT_TOGGLES = ['castsShadows', 'acceptsShadows', 'acceptsLights', 'appearsInRefl'];

  function buildMaterials(pane) {
    var M = R.materials = {};
    var e3dBox = el('div');
    pane.appendChild(e3dBox);
    var pr = UI.section('matPresets', 'sec.matPresets');
    pane.appendChild(pr);
    M.grid = el('div', 'grid');
    pr.body.appendChild(M.grid);
    var sec = UI.section('surface', 'sec.surface');
    pane.appendChild(sec);
    M.surf = UI.seg({ value: S.surface, options: ['all', 'Front', 'Bevel', 'Side', 'Back'].map(function (s) { return { v: s, label: t('surf.' + s) }; }), onChange: function (v) { S.surface = v; M.refresh(); } });
    sec.body.appendChild(M.surf);
    M.surfNote = el('div');
    sec.body.appendChild(M.surfNote);

    var ps = UI.section('matProps', 'sec.matProps');
    pane.appendChild(ps);
    M.color = UI.color({ key: 'mat.color', onInput: function (c) { mset('color', c); }, onChange: function (c) { mset('color', c, true); } });
    M.opacity = UI.slider({ key: 'mat.opacity', min: 0, max: 100, step: 1, unit: '%', hard: true, def: 100, onInput: function (v) { mset('opacity', v); }, onChange: function (v) { mset('opacity', v, true); } });
    ps.body.appendChild(M.color); ps.body.appendChild(M.opacity);
    M.sl = {}; M.tg = {};
    var matMore = UI.more('mat'), MAIN_MAT = ['metal', 'reflection', 'shininess', 'specular'];
    MAT_SLIDERS.forEach(function (d) {
      M.sl[d[0]] = UI.slider({ key: 'mat.' + d[0], min: d[1], max: d[2], step: d[3] || 1, unit: d[0] === 'ior' ? '' : '%', hard: true,
        onInput: function (v) { mset(d[0], v); }, onChange: function (v) { mset(d[0], v, true); } });
      (MAIN_MAT.indexOf(d[0]) >= 0 ? ps.body : matMore.body).appendChild(M.sl[d[0]]);
    });
    MAT_TOGGLES.forEach(function (k) {
      M.tg[k] = UI.toggle({ key: 'mat.' + k, onChange: function (v) { mset(k, v ? 1 : 0, true); } });
      matMore.body.appendChild(M.tg[k]);
    });
    ps.body.appendChild(matMore);
    M.hidden = el('div'); ps.body.appendChild(M.hidden);
    var pb = el('div', 'btns');
    M.resetBtn = UI.button('mat.reset', { small: true, icon: 'reset', onClick: function () {
      var it = activeItem(); if (!it || S.surface === 'all') return;
      return run('materials.set', { refs: selRefs(), values: { clearSurface: S.surface } }, t('ok.updated')).then(function () { M.refresh(); refreshSnapshot(); });
    } });
    pb.appendChild(M.resetBtn);
    pb.appendChild(UI.button('mat.save', { small: true, icon: 'download', onClick: function () { return savePreset('material'); } }));
    ps.body.appendChild(pb);


    function mset(k, v, final) {
      var it = activeItem(); if (!isObj(it)) return;
      var values = {};
      if (S.surface === 'all') {
        if (k === 'color') values.fill = v;
        else if (k !== 'opacity') { values.layer = {}; values.layer[k] = v; }
      } else {
        values.surfaces = {}; values.surfaces[S.surface] = {}; values.surfaces[S.surface][k] = v;
      }
      markDrag();
      Viewport.patch(it.ref, 'mat', values);
      live('mat_' + S.surface + k, 'materials.set', { refs: selRefs(), values: values }, final);
    }

    M.refresh = function () {
      e3dBox.innerHTML = '';
      var it = activeItem();
      if (S.mode === 'e3d') {
        e3dBox.appendChild(UI.note(t('mat.e3d')));
        if (it && (it.role === 'e3d' || it.role === 'e3dtpl')) paramsInspector(e3dBox, it.ref);
      }
      M.surfNote.innerHTML = '';
      var isText = it && it.role === 'text';
      if (!isText && it && S.surface !== 'all') { S.surface = 'all'; M.surf.set('all'); }
      Object.keys(M.surf.btns).forEach(function (k) { M.surf.btns[k].style.display = (k === 'all' || (isText && canSurf(k, 'color'))) ? '' : 'none'; });
      if (it && !isText) M.surfNote.appendChild(UI.note(t('mat.surfNA')));
      var all = S.surface === 'all', hidden = 0;
      M.opacity.style.display = !all && canSurf(S.surface, 'opacity') ? '' : 'none';
      MAT_SLIDERS.forEach(function (d) {
        var ok = all ? canMat(d[0]) : canSurf(S.surface, d[0]);
        M.sl[d[0]].style.display = ok ? '' : 'none';
        if (!ok) hidden++;
      });
      MAT_TOGGLES.forEach(function (k) { var ok = all && canMat(k); M.tg[k].style.display = ok ? '' : 'none'; if (!ok && all) hidden++; });
      M.hidden.innerHTML = '';
      if (hidden) M.hidden.appendChild(UI.note(t('mat.hidden', { n: hidden })));
      M.resetBtn.style.display = all ? 'none' : '';
      renderGrid();
      if (!isObj(it)) return;
      Host.call('materials.get', { ref: it.ref }).then(function (m) {
        if (!m) return;
        var src = all ? m.layer : (m.surfaces[S.surface] || {});
        M.color.set(all ? m.fill : (src.color || m.fill));
        if (!all) M.opacity.set(src.opacity !== undefined ? src.opacity : 100);
        MAT_SLIDERS.forEach(function (d) { var v = src[d[0]]; if (v === undefined) v = m.layer[d[0]]; if (typeof v === 'number') M.sl[d[0]].set(v); });
        MAT_TOGGLES.forEach(function (k) { if (m.layer[k] !== undefined && m.layer[k] !== null) M.tg[k].set(!!m.layer[k]); });
      }).catch(function () {});
    };

    function renderGrid() {
      M.grid.innerHTML = '';
      Presets.material.concat(userPresets('material')).forEach(function (p) {
        var sw = p.swatch || [UI.toHex((p.surfaces && p.surfaces.Bevel && p.surfaces.Bevel.color) || p.fill || [1, 1, 1]), UI.toHex((p.surfaces && p.surfaces.Front && p.surfaces.Front.color) || p.fill || [0.6, 0.6, 0.6]), UI.toHex((p.surfaces && p.surfaces.Side && p.surfaces.Side.color) || [0.2, 0.2, 0.2])];
        var na = p.needs && p.needs.some(function (k) { return !canMat(k); });
        var c = el('button', 'card' + (na ? ' na' : ''), '<span class="ball" style="background: radial-gradient(circle at 34% 30%, ' + sw[0] + ' 0%, ' + sw[1] + ' 45%, ' + sw[2] + ' 100%)"></span><span></span>');
        c.lastChild.textContent = p.name || (I18N.lang === 'ar' ? p.ar : p.en);
        c.type = 'button';
        c.onclick = function () { applyMaterial(p); };
        M.grid.appendChild(c);
      });
    }
  }

  function applyMaterial(p) {
    var it = activeItem();
    if (!isObj(it)) { UI.toast(t('err.NO_OBJECT'), 'warn'); return Promise.resolve(); }
    var layer = {}, k, values = {};
    for (k in (p.layer || {})) {
      if (!canMat(k)) continue;
      layer[k] = typeof p.layer[k] === 'boolean' ? (p.layer[k] ? 1 : 0) : p.layer[k];
    }
    values.layer = layer;
    var front = p.surfaces && p.surfaces.Front && p.surfaces.Front.color;
    if (p.fill || front) values.fill = p.fill || front;
    if (it.role === 'text' && p.surfaces) {
      values.surfaces = {};
      Object.keys(p.surfaces).forEach(function (s) {
        var o = {};
        Object.keys(p.surfaces[s]).forEach(function (kk) { if (canSurf(s, kk)) o[kk] = p.surfaces[s][kk]; });
        if (Object.keys(o).length) values.surfaces[s] = o;
      });
    }
    Viewport.patch(it.ref, 'mat', values);
    return run('materials.set', { refs: selRefs(), values: values }).then(function (r) {
      var sk = r && r.skipped ? r.skipped.length : 0;
      UI.toast(sk ? t('mat.skipped', { n: sk }) : t('ok.updated'), sk ? 'warn' : 'ok');
      if (R.materials) R.materials.refresh();
      refreshSnapshot();
    }).catch(function () {});
  }

  /* ====================== ENVIRONMENT (background + env) ====================== */
  function buildEnv(pane) {
    var M = R.env = {};
    var bs = UI.section('bg', 'sec.bg');
    pane.appendChild(bs);
    var cur = { type: 'solid' };
    function bset(values, final) {
      Object.assign(cur, values);
      Viewport.patchBg(Object.assign({ enabled: cur.type !== 'transparent' }, cur));
      live('bg', 'background.set', { values: values }, final);
      if (final) setTimeout(function () { S.listHash = ''; poll(true); }, 300);
    }
    M.type = UI.seg({ key: 'bg.type', wide: true, value: 'solid', options: ['solid', 'gradient', 'image', 'video', 'transparent'].map(function (v) { return { v: v, label: t('bg.' + v) }; }),
      onChange: function (v) {
        if ((v === 'image' || v === 'video') && !(cur.file && cur.type === v)) { pickBgFile(v); return; }
        bset({ type: v }, true); vis();
      } });
    M.color = UI.color({ key: 'bg.color', value: [0.05, 0.04, 0.08], onInput: function (c) { bset({ color: c }); }, onChange: function (c) { bset({ color: c }, true); } });
    M.g1 = UI.color({ key: 'bg.g1', value: [0.2, 0.08, 0.45], onInput: function (c) { bset({ g1: c }); }, onChange: function (c) { bset({ g1: c }, true); } });
    M.g2 = UI.color({ key: 'bg.g2', value: [0.03, 0.02, 0.06], onInput: function (c) { bset({ g2: c }); }, onChange: function (c) { bset({ g2: c }, true); } });
    M.angle = UI.slider({ key: 'bg.angle', min: 0, max: 360, step: 1, unit: '°', def: 90, onInput: function (v) { bset({ angle: v }); }, onChange: function (v) { bset({ angle: v }, true); } });
    M.radial = UI.toggle({ key: 'bg.radial', onChange: function (v) { bset({ radial: v }, true); } });
    M.file = el('div', 'btns');
    M.file.appendChild(UI.button('bg.file', { small: true, icon: 'folder', onClick: function () { pickBgFile(cur.type === 'video' ? 'video' : 'image'); } }));
    M.file.appendChild(UI.button('bg.fit', { small: true, icon: 'frame', onClick: function () { bset({ fit: true }, true); } }));
    M.opacity = UI.slider({ key: 'bg.opacity', min: 0, max: 100, step: 1, unit: '%', hard: true, def: 100, onInput: function (v) { bset({ opacity: v }); }, onChange: function (v) { bset({ opacity: v }, true); } });
    M.blur = UI.slider({ key: 'bg.blur', min: 0, max: 200, step: 0.5, floor: 0, def: 0, onInput: function (v) { bset({ blur: v }); }, onChange: function (v) { bset({ blur: v }, true); } });
    M.scale = UI.slider({ key: 'bg.scale', min: 10, max: 400, step: 1, unit: '%', floor: 1, def: 100, onInput: function (v) { bset({ scale: v }); }, onChange: function (v) { bset({ scale: v }, true); } });
    M.pos = UI.vec({ key: 'bg.position', axes: 2, step: 1, onInput: function (v) { bset({ position: v }); }, onChange: function (v) { bset({ position: v }, true); } });
    M.rot = UI.slider({ key: 'bg.rotation', min: -180, max: 180, step: 0.1, unit: '°', def: 0, onInput: function (v) { bset({ rotation: v }); }, onChange: function (v) { bset({ rotation: v }, true); } });
    [M.type, M.color, M.g1, M.g2, M.angle, M.file, M.blur].forEach(function (x) { bs.body.appendChild(x); });
    bs.body.appendChild(UI.more('bg').add(M.radial, M.opacity, M.scale, M.pos, M.rot));
    bs.body.appendChild(UI.note(t('bg.note')));
    function vis() {
      var ty = cur.type, tr = ty === 'transparent', file = ty === 'image' || ty === 'video';
      M.color.style.display = ty === 'solid' ? '' : 'none';
      [M.g1, M.g2, M.angle, M.radial].forEach(function (x) { x.style.display = ty === 'gradient' ? '' : 'none'; });
      M.file.style.display = file ? '' : 'none';
      [M.opacity, M.blur, M.scale, M.pos, M.rot].forEach(function (x) { x.style.display = tr ? 'none' : ''; });
    }
    function pickBgFile(kind) {
      var types = kind === 'video' ? ['mp4', 'mov', 'avi', 'webm', 'mxf'] : ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'psd', 'exr', 'hdr', 'webp'];
      var f = Dialog.open(types, t('bg.file'));
      if (!f) { M.type.set(cur.type); return; }
      cur.file = f;
      return run('background.set', { values: { type: kind, file: f, fit: true } }, t('ok.updated')).then(function (r) { fill(r); S.listHash = ''; poll(true); }).catch(function () { M.type.set(cur.type); });
    }
    function fill(b) {
      if (!b) { vis(); return; }
      cur = Object.assign(cur, b);
      M.type.set(b.type);
      if (b.color) M.color.set(b.color);
      if (b.g1) M.g1.set(b.g1); if (b.g2) M.g2.set(b.g2);
      if (b.angle !== undefined) M.angle.set((b.angle + 360) % 360);
      M.radial.set(!!b.radial);
      M.opacity.set(b.opacity); M.blur.set(b.blur); M.scale.set(b.scale); if (b.position) M.pos.set(b.position); M.rot.set(b.rotation);
      vis();
    }

    // environment
    var es = UI.section('env', 'sec.env', { closed: true });
    pane.appendChild(es);
    var eb = es.body;
    var ebtn = el('div', 'btns');
    ebtn.appendChild(UI.button('env.import', { icon: 'upload', onClick: function () {
      var f = Dialog.open(['hdr', 'exr', 'jpg', 'jpeg', 'png', 'tif', 'tiff'], t('env.import'));
      if (!f) return;
      return run('environment.set', { values: { file: f } }, t('ok.updated')).then(function (r) { envFill(r); S.listHash = ''; poll(true); }).catch(function () {});
    } }));
    eb.appendChild(ebtn);
    M.envInfo = el('div'); eb.appendChild(M.envInfo);
    M.envCtl = el('div'); eb.appendChild(M.envCtl);
    function eset(values, final) { live('env', 'environment.set', { values: values }, final); }
    M.exp = UI.slider({ key: 'env.exposure', min: -5, max: 5, step: 0.05, def: 0, onInput: function (v) { eset({ exposure: v }); }, onChange: function (v) { eset({ exposure: v }, true); } });
    M.bri = UI.slider({ key: 'env.brightness', min: -150, max: 150, step: 1, def: 0, hard: true, onInput: function (v) { eset({ brightness: v }); }, onChange: function (v) { eset({ brightness: v }, true); } });
    M.con = UI.slider({ key: 'env.contrast', min: -100, max: 100, step: 1, def: 0, hard: true, onInput: function (v) { eset({ contrast: v }); }, onChange: function (v) { eset({ contrast: v }, true); } });
    M.sat = UI.slider({ key: 'env.saturation', min: -100, max: 100, step: 1, def: 0, hard: true, onInput: function (v) { eset({ saturation: v }); }, onChange: function (v) { eset({ saturation: v }, true); } });
    M.erot = UI.slider({ key: 'env.rotation', min: 0, max: 360, step: 1, unit: '°', def: 0, onInput: function (v) { eset({ rotation: v }); }, onChange: function (v) { eset({ rotation: v }, true); } });
    M.eon = UI.toggle({ key: 'env.enabled', value: true, onChange: function (v) { eset({ enabled: v }, true); } });
    var epre = el('div', 'grid'); epre.style.margin = '6px 0';
    Presets.environment.concat(userPresets('environment')).forEach(function (p) {
      var c = el('button', 'card', icon('sun', 16) + '<span></span>'); c.type = 'button';
      c.lastChild.textContent = p.name || (I18N.lang === 'ar' ? p.ar : p.en);
      c.onclick = function () { run('environment.set', { values: p.values || p.data }, t('ok.updated')).then(envFill).catch(function () {}); };
      epre.appendChild(c);
    });
    M.lightProps = el('div');
    var eacts = el('div', 'btns');
    M.bits = UI.button('env.bits', { small: true, icon: 'settings', onClick: function () { return run('environment.setProjectBits', { bits: 32 }, t('ok.updated')).then(function () { M.bits.style.display = 'none'; }); } });
    eacts.appendChild(M.bits);
    eacts.appendChild(UI.button('env.remove', { small: true, danger: true, icon: 'trash', onClick: function () { return run('environment.remove', {}, t('ok.updated')).then(function (r) { envFill(r); S.listHash = ''; poll(true); }); } }));
    [epre, M.exp, M.bri, M.con, M.sat, M.erot, M.eon, M.lightProps, eacts].forEach(function (x) { M.envCtl.appendChild(x); });

    function envFill(e) {
      M.envInfo.innerHTML = '';
      if (!e) return;
      M.envInfo.appendChild(UI.note(t(e.mode === 'light' ? 'env.modeLight' : 'env.modeLayer')));
      (e.notes || []).forEach(function (n) { M.envInfo.appendChild(UI.note(t(n === 'envSourceManual' ? 'env.manualSource' : 'env.manualLayer'), 'warn')); });
      M.envCtl.style.display = e.active ? '' : 'none';
      if (!e.active) { M.envInfo.appendChild(UI.note(t('env.none'))); return; }
      if (e.file) { var fn = el('p', 'note'); fn.textContent = e.file.split(/[\\/]/).pop(); M.envInfo.appendChild(fn); }
      if (e.exposure !== undefined) M.exp.set(e.exposure);
      if (e.brightness !== undefined) M.bri.set(e.brightness);
      if (e.contrast !== undefined) M.con.set(e.contrast);
      if (e.saturation !== undefined) M.sat.set(e.saturation);
      if (e.rotation !== undefined) M.erot.set((e.rotation + 360) % 360);
      if (e.enabled !== undefined) M.eon.set(e.enabled);
      var hdr = e.file && /\.(hdr|exr)$/i.test(e.file);
      M.bits.style.display = hdr && S.info && S.info.project && S.info.project.bits !== 32 ? '' : 'none';
      M.lightProps.innerHTML = '';
      if (e.lightProps && e.lightProps.length) {
        M.lightProps.appendChild(el('div', 'sub-h', t('env.lightProps')));
        e.lightProps.forEach(function (p) {
          var send = function (v, final) { live('envl' + p.index, 'environment.set', { values: { lightProps: [{ index: p.index, type: p.type, value: v }] } }, final); };
          var ctl = p.type === 'color' ? UI.color({ key: 'x', value: p.value, onInput: function (c) { send(c); }, onChange: function (c) { send(c, true); } })
            : UI.slider({ key: 'x', min: p.min !== null ? p.min : 0, max: p.max !== null ? Math.min(p.max, 1000) : Math.max(200, p.value * 3), step: 0.1, value: p.value, onInput: function (v) { send(v); }, onChange: function (v) { send(v, true); } });
          ctl.label.textContent = p.name;
          M.lightProps.appendChild(ctl);
        });
      }
    }
    M.refresh = function () {
      if (!S.comp) return;
      Host.call('background.get', {}).then(fill).catch(function () {});
      Host.call('environment.get', {}).then(envFill).catch(function () {});
    };
    vis();
  }

  /* ====================== LIGHTING ====================== */
  function buildLights(pane) {
    var M = R.lights = {};
    var ps = UI.section('lightPresets', 'sec.lightPresets');
    pane.appendChild(ps);
    var replace = UI.toggle({ key: 'light.replace', value: true });
    var grid = el('div', 'grid');
    Presets.lighting.concat(userPresets('lighting')).forEach(function (p) {
      var c = el('button', 'card', Art.lights(p.lights || (p.data && p.data.lights) || []) + '<span></span>'); c.type = 'button';
      c.lastChild.textContent = p.name || t(p.key);
      c.onclick = function () {
        if (!S.comp) { UI.toast(t('err.NO_COMP'), 'warn'); return; }
        var lights = (p.lights || (p.data && p.data.lights) || []);
        run('lights.applyPreset', { lights: lights, replace: replace.get() }, t('ok.updated')).then(function (l) { M.data = l; S.light = l.length ? l[0].ref : null; M.render(); S.listHash = ''; poll(true); }).catch(function () {});
      };
      grid.appendChild(c);
    });
    ps.body.appendChild(grid); ps.body.appendChild(replace);

    var ls = UI.section('lights', 'sec.lights');
    pane.appendChild(ls);
    var list = el('div', 'olist'); ls.body.appendChild(list);
    var add = el('div', 'btns');
    [['point', 'bulb'], ['spot', 'spot'], ['parallel', 'sun'], ['ambient', 'environment']].forEach(function (x) {
      add.appendChild(UI.button('light.' + x[0], { small: true, icon: 'plus', onClick: function () {
        if (!S.comp) { UI.toast(t('err.NO_COMP'), 'warn'); return; }
        var c = S.comp, v = { type: x[0], name: t('light.' + x[0]) + ' Light', intensity: 100, color: [1, 1, 1] };
        if (x[0] !== 'ambient') { v.position = [c.w / 2 - 500, c.h / 2 - 500, -900]; v.poi = [c.w / 2, c.h / 2, 0]; }
        return run('lights.add', { values: v }).then(function (l) { S.light = l.ref; M.refresh(); S.listHash = ''; poll(true); });
      } }));
    });
    ls.body.appendChild(add);

    var props = UI.section('lightProps', 'sec.lightProps');
    pane.appendChild(props);
    function lset(values, final) {
      if (!S.light) return;
      var d = (M.data || []).filter(function (l) { return l.ref === S.light; })[0];
      if (d) { Object.assign(d, values); Viewport.patchLights(M.data.filter(function (l) { return l.enabled; })); }
      markDrag();
      live('light' + S.light, 'lights.set', { ref: S.light, values: values }, final);
    }
    M.type = UI.select({ key: 'bg.type', options: ['point', 'spot', 'parallel', 'ambient'].map(function (v) { return { v: v, label: t('light.' + v) }; }), onChange: function (v) { lset({ type: v }, true); setTimeout(M.refresh, 300); } });
    M.on = UI.toggle({ key: 'light.enabled', onChange: function (v) { lset({ enabled: v }, true); } });
    M.color = UI.color({ key: 'light.color', onInput: function (c) { lset({ color: c }); }, onChange: function (c) { lset({ color: c }, true); } });
    M.int = UI.slider({ key: 'light.intensity', min: 0, max: 400, step: 1, unit: '%', floor: 0, def: 100, onInput: function (v) { lset({ intensity: v }); }, onChange: function (v) { lset({ intensity: v }, true); } });
    M.cone = UI.slider({ key: 'light.cone', min: 1, max: 180, step: 0.5, unit: '°', hard: true, def: 90, onInput: function (v) { lset({ cone: v }); }, onChange: function (v) { lset({ cone: v }, true); } });
    M.feather = UI.slider({ key: 'light.feather', min: 0, max: 100, step: 1, unit: '%', hard: true, def: 50, onInput: function (v) { lset({ feather: v }); }, onChange: function (v) { lset({ feather: v }, true); } });
    M.falloff = UI.select({ key: 'light.falloff', options: ['none', 'smooth', 'inverse'].map(function (v) { return { v: v, label: t('falloff.' + v) }; }), onChange: function (v) { lset({ falloff: v }, true); vis(); } });
    M.radius = UI.slider({ key: 'light.radius', min: 0, max: 3000, step: 1, unit: 'px', floor: 0, onInput: function (v) { lset({ radius: v }); }, onChange: function (v) { lset({ radius: v }, true); } });
    M.fdist = UI.slider({ key: 'light.falloffDist', min: 0, max: 5000, step: 1, unit: 'px', floor: 0, onInput: function (v) { lset({ falloffDist: v }); }, onChange: function (v) { lset({ falloffDist: v }, true); } });
    M.shadows = UI.toggle({ key: 'light.shadows', onChange: function (v) { lset({ shadows: v }, true); vis(); } });
    M.sdark = UI.slider({ key: 'light.shadowDark', min: 0, max: 100, step: 1, unit: '%', hard: true, onInput: function (v) { lset({ shadowDark: v }); }, onChange: function (v) { lset({ shadowDark: v }, true); } });
    M.sdiff = UI.slider({ key: 'light.shadowDiff', min: 0, max: 300, step: 1, unit: 'px', floor: 0, onInput: function (v) { lset({ shadowDiff: v }); }, onChange: function (v) { lset({ shadowDiff: v }, true); } });
    M.aim = UI.seg({ key: 'light.aim', value: 'target', options: ['target', 'free'].map(function (v) { return { v: v, label: t('aim.' + v) }; }), onChange: function (v) { lset({ autoOrient: v }, true); vis(); } });
    M.pos = UI.vec({ key: 'tf.position', step: 1, onInput: function (v) { lset({ position: v }); }, onChange: function (v) { lset({ position: v }, true); } });
    M.poi = UI.vec({ key: 'light.poi', step: 1, onInput: function (v) { lset({ poi: v }); }, onChange: function (v) { lset({ poi: v }, true); } });
    M.ori = UI.vec({ key: 'tf.orientation', step: 0.1, onInput: function (v) { lset({ orientation: v }); }, onChange: function (v) { lset({ orientation: v }, true); } });
    M.type.label.textContent = t('bg.type');
    [M.type, M.on, M.color, M.int, M.cone, M.shadows].forEach(function (x) { props.body.appendChild(x); });
    props.body.appendChild(UI.more('light').add(M.feather, M.falloff, M.radius, M.fdist, M.sdark, M.sdiff, M.aim, M.pos, M.poi, M.ori));
    var del = el('div', 'btns');
    del.appendChild(UI.button('act.delete', { small: true, danger: true, icon: 'trash', onClick: function () {
      if (!S.light) return;
      return UI.confirm(t('confirm.delete', { n: 1 }), true).then(function (ok) { if (ok) return run('scene.remove', { refs: [S.light] }).then(function () { S.light = null; M.refresh(); S.listHash = ''; poll(true); }); });
    } }));
    props.body.appendChild(del);

    function cur() { return (M.data || []).filter(function (l) { return l.ref === S.light; })[0]; }
    function vis() {
      var l = cur();
      props.style.display = l ? '' : 'none';
      if (!l) return;
      var ty = M.type.get(), amb = ty === 'ambient', spot = ty === 'spot';
      [M.cone, M.feather].forEach(function (x) { x.style.display = spot ? '' : 'none'; });
      [M.falloff].forEach(function (x) { x.style.display = (ty === 'point' || spot) && l.falloff !== undefined ? '' : 'none'; });
      var fo = M.falloff.get() !== 'none' && (ty === 'point' || spot);
      M.radius.style.display = fo && l.radius !== undefined ? '' : 'none';
      M.fdist.style.display = fo && l.falloffDist !== undefined ? '' : 'none';
      M.shadows.style.display = amb ? 'none' : '';
      [M.sdark, M.sdiff].forEach(function (x) { x.style.display = !amb && M.shadows.get() ? '' : 'none'; });
      M.pos.style.display = amb ? 'none' : '';
      M.aim.style.display = amb || ty === 'point' ? 'none' : '';
      M.poi.style.display = !amb && ty !== 'point' && M.aim.get() === 'target' ? '' : 'none';
      M.ori.style.display = !amb && ty !== 'point' && M.aim.get() === 'free' ? '' : 'none';
    }
    M.render = function () {
      list.innerHTML = '';
      var data = M.data || [];
      if (!data.length) { list.appendChild(el('div', 'empty', t('light.none'))); }
      var ic = { point: 'bulb', spot: 'spot', parallel: 'sun', ambient: 'environment', environment: 'environment' };
      data.forEach(function (l) {
        var row = el('div', 'oitem' + (l.ref === S.light ? ' sel active' : '') + (l.enabled ? '' : ' off'));
        row.innerHTML = '<span class="ic-role">' + icon(ic[l.type] || 'bulb', 14) + '</span>';
        var nm = el('span', 'oname'); nm.textContent = l.name; row.appendChild(nm);
        row.appendChild(el('span', 'orole', t('light.' + l.type)));
        row.appendChild(UI.iconBtn(l.enabled ? 'eye' : 'eyeOff', t('act.hide'), function () { quiet('lights.set', { ref: l.ref, values: { enabled: !l.enabled } }).then(M.refresh); }));
        row.onclick = function () { S.light = l.ref; M.render(); fillProps(); };
        list.appendChild(row);
      });
      if (!cur() && data.length && data[0].type !== 'environment') { S.light = data[0].ref; }
      fillProps();
    };
    function fillProps() {
      var l = cur();
      if (l && l.type === 'environment') { props.style.display = 'none'; return; }
      if (!l) { vis(); return; }
      M.type.set(l.type); M.on.set(l.enabled); if (l.color) M.color.set(l.color); M.int.set(l.intensity);
      if (l.cone !== undefined) M.cone.set(l.cone); if (l.feather !== undefined) M.feather.set(l.feather);
      if (l.falloff) M.falloff.set(l.falloff); if (l.radius !== undefined) M.radius.set(l.radius); if (l.falloffDist !== undefined) M.fdist.set(l.falloffDist);
      M.shadows.set(!!l.shadows); if (l.shadowDark !== undefined) M.sdark.set(l.shadowDark); if (l.shadowDiff !== undefined) M.sdiff.set(l.shadowDiff);
      M.aim.set(l.autoOrient || 'target'); if (l.position) M.pos.set(l.position); if (l.poi) M.poi.set(l.poi); if (l.orientation) M.ori.set(l.orientation);
      vis();
    }
    M.refresh = function () {
      if (!S.comp) { M.data = []; M.render(); return; }
      if (dragging()) return;
      Host.call('lights.list', {}).then(function (l) { M.data = l || []; M.render(); }).catch(function () {});
    };
  }

  /* ====================== CAMERA ====================== */
  function buildCamera(pane) {
    var M = R.camera = {};
    var box = el('div'); pane.appendChild(box);
    var fs = UI.section('framing', 'sec.framing'); pane.appendChild(fs);
    var ls = UI.section('lens', 'sec.lens'); pane.appendChild(ls);
    var cs = UI.section('camera', 'sec.camera', { closed: true }); pane.appendChild(cs);
    var ds = UI.section('dof', 'sec.dof', { closed: true }); pane.appendChild(ds);
    function cset(values, final) {
      markDrag();
      live('cam', 'camera.set', { values: values }, final);
      if (S.snapshot && S.snapshot.camera) { Object.assign(S.snapshot.camera, values); if (values.focal && S.comp) S.snapshot.camera.zoom = values.focal * S.comp.w / 36; Viewport.patchCamera(S.snapshot.camera); }
    }
    M.mode = UI.seg({ key: 'cam.mode', value: 'target', options: ['target', 'free'].map(function (v) { return { v: v, label: t('aim.' + v) }; }), onChange: function (v) { cset({ autoOrient: v }, true); vis(); } });
    M.pos = UI.vec({ key: 'tf.position', step: 1, onInput: function (v) { cset({ position: v }); }, onChange: function (v) { cset({ position: v }, true); } });
    M.poi = UI.vec({ key: 'light.poi', step: 1, onInput: function (v) { cset({ poi: v }); }, onChange: function (v) { cset({ poi: v }, true); } });
    M.ori = UI.vec({ key: 'tf.orientation', step: 0.1, onInput: function (v) { cset({ orientation: v }); }, onChange: function (v) { cset({ orientation: v }, true); } });
    M.rz = UI.slider({ key: 'tf.rz', min: -180, max: 180, step: 0.1, unit: '°', def: 0, onInput: function (v) { cset({ rz: v }); }, onChange: function (v) { cset({ rz: v }, true); } });
    [M.mode, M.pos, M.poi, M.ori, M.rz].forEach(function (x) { cs.body.appendChild(x); });
    var cb = el('div', 'btns');
    cb.appendChild(UI.button('vp.toCam', { small: true, icon: 'camera', onClick: function () { return applyViewToCamera(false); } }));
    cs.body.appendChild(cb);

    var chips = el('div', 'seg');
    Presets.lenses.forEach(function (mm) {
      var b = el('button', 'seg-b', mm + ''); b.type = 'button';
      b.onclick = function () { M.focal.set(mm); cset({ focal: mm }, true); setTimeout(M.refresh, 250); };
      chips.appendChild(b);
    });
    ls.body.appendChild(chips);
    M.focal = UI.slider({ key: 'cam.focal', min: 8, max: 300, step: 0.5, unit: 'mm', floor: 1, def: 50, onInput: function (v) { cset({ focal: v }); }, onChange: function (v) { cset({ focal: v }, true); setTimeout(M.refresh, 250); } });
    M.fov = UI.slider({ key: 'cam.fov', min: 5, max: 150, step: 0.1, unit: '°', hard: true, onInput: function (v) { cset({ fov: v }); }, onChange: function (v) { cset({ fov: v }, true); setTimeout(M.refresh, 250); } });
    M.zoom = UI.slider({ key: 'cam.zoom', min: 100, max: 10000, step: 1, unit: 'px', floor: 1, onInput: function (v) { cset({ zoom: v }); }, onChange: function (v) { cset({ zoom: v }, true); setTimeout(M.refresh, 250); } });
    [M.focal, M.fov, M.zoom].forEach(function (x) { ls.body.appendChild(x); });

    M.dof = UI.toggle({ key: 'cam.dof', onChange: function (v) { cset({ dof: v }, true); vis(); } });
    M.focus = UI.slider({ key: 'cam.focus', min: 0, max: 10000, step: 1, unit: 'px', floor: 0, onInput: function (v) { cset({ focus: v }); }, onChange: function (v) { cset({ focus: v }, true); } });
    M.ap = UI.slider({ key: 'cam.aperture', min: 0, max: 500, step: 0.5, unit: 'px', floor: 0, onInput: function (v) { cset({ aperture: v }); }, onChange: function (v) { cset({ aperture: v }, true); } });
    M.blur = UI.slider({ key: 'cam.blur', min: 0, max: 500, step: 1, unit: '%', floor: 0, def: 100, onInput: function (v) { cset({ blur: v }); }, onChange: function (v) { cset({ blur: v }, true); } });
    [M.dof, M.focus, M.ap, M.blur].forEach(function (x) { ds.body.appendChild(x); });
    var fb = el('div', 'btns');
    fb.appendChild(UI.button('cam.focusOn', { small: true, icon: 'target', onClick: function () { var it = needObj(); if (it) return run('camera.focusOn', { ref: it.ref }, t('ok.updated')).then(fill); } }));
    ds.body.appendChild(fb);

    var grid = el('div', 'grid');
    Presets.camera.concat(userPresets('camera')).forEach(function (p) {
      var c = el('button', 'card', Art.camera(p.data || p) + '<span></span>'); c.type = 'button';
      c.lastChild.textContent = p.name || t(p.key);
      c.onclick = function () { applyFraming(p.data || p); };
      grid.appendChild(c);
    });
    fs.body.appendChild(grid);

    function vis() {
      var free = M.mode.get() === 'free';
      M.poi.style.display = free ? 'none' : '';
      M.ori.style.display = free ? '' : 'none';
      [M.focus, M.ap, M.blur].forEach(function (x) { x.style.display = M.dof.get() ? '' : 'none'; });
    }
    function fill(c) {
      box.innerHTML = '';
      var has = !!c;
      [cs, ls, ds].forEach(function (s) { s.style.display = has ? '' : 'none'; });
      if (!has) {
        if (!S.comp) { box.appendChild(UI.note(t('scene.nocomp'), 'warn')); fs.style.display = 'none'; return; }
        box.appendChild(UI.note(t('cam.none')));
        var b = el('div', 'btns'); b.style.marginBottom = '8px';
        b.appendChild(UI.button('cam.create', { primary: true, icon: 'camera', onClick: function () { return run('camera.ensure', {}, t('ok.created')).then(function (r) { fill(r); S.listHash = ''; poll(true); }); } }));
        box.appendChild(b);
        fs.style.display = '';
        return;
      }
      fs.style.display = '';
      M.mode.set(c.autoOrient || 'target'); M.pos.set(c.position); if (c.poi) M.poi.set(c.poi); if (c.orientation) M.ori.set(c.orientation); M.rz.set(c.rz || 0);
      M.focal.set(c.focal); M.fov.set(c.fov); M.zoom.set(c.zoom);
      M.dof.set(c.dof); M.focus.set(c.focus); M.ap.set(c.aperture); M.blur.set(c.blur);
      vis();
    }
    M.refresh = function () { if (dragging()) return; Host.call('camera.get', {}).then(fill).catch(function () {}); };
  }

  function applyFraming(p) {
    if (!S.comp) { UI.toast(t('err.NO_COMP'), 'warn'); return; }
    var it = activeItem();
    var center = Promise.resolve([S.comp.w / 2, S.comp.h / 2, 0]);
    if (isObj(it)) center = Host.call('scene.getTransform', { ref: it.ref }).then(function (tf) { return tf.position; });
    return center.then(function (c) {
      return Host.call('camera.ensure', {}).then(function () {
        var off = p.offset || [0, 0, -1800];
        var v = { autoOrient: 'target', position: [c[0] + off[0], c[1] + off[1], c[2] + off[2]], poi: c, focal: p.focal || 50, rz: p.rz || 0 };
        if (p.dof !== undefined) v.dof = p.dof;
        return run('camera.set', { values: v }, t('ok.updated'));
      });
    }).then(function () { if (R.camera) R.camera.refresh(); refreshSnapshot(); if (Viewport.ready) { Viewport.setView('camera'); if (R.vp) R.vp.view.set('camera'); } }).catch(function () {});
  }

  /* ====================== ANIMATION ====================== */
  var CUSTOM_PROPS = ['position', 'rx', 'ry', 'rz', 'scale', 'opacity', 'depth', 'bevel', 'metal', 'reflection', 'FrontColor', 'SideColor', 'BevelColor'];
  function buildAnim(pane) {
    var M = R.anim = {}, A = S.anim;
    var ps = UI.section('animPresets', 'sec.animPresets'); pane.appendChild(ps);
    var ts = UI.section('animTiming', 'sec.animTiming'); pane.appendChild(ts);
    M.target = UI.seg({ key: 'anim.targets', value: A.target, options: [{ v: 'active', label: t('anim.active') }, { v: 'selected', label: t('anim.selected') }], onChange: function (v) { A.target = v; } });
    var startRow = el('div', 'slider');
    var startIn = el('input', 'num'); startIn.style.width = '70px'; startIn.value = '0';
    startRow.appendChild(startIn);
    var nowB = UI.button('anim.now', { small: true, onClick: function () { return Host.call('caps.comp', {}).then(function () { return Host.call('scene.snapshot', {}); }).then(function (s) { startIn.value = (s && s.time !== undefined ? s.time : 0).toFixed(2); }).catch(function () {}); } });
    startRow.appendChild(nowB);
    M.start = UI.row('anim.start', startRow);
    M.dur = UI.slider({ key: 'anim.duration', min: 0.1, max: 10, step: 0.05, unit: 's', floor: 0.04, value: A.duration, def: 1.5, onChange: function (v) { A.duration = v; } });
    M.ease = UI.select({ key: 'anim.ease', value: A.ease, options: ['linear', 'ease', 'easeIn', 'easeOut', 'strong', 'overshoot', 'bounce'].map(function (v) { return { v: v, label: t('ease.' + v) }; }), onChange: function (v) { A.ease = v; } });
    M.speed = UI.slider({ key: 'anim.speed', min: 0.25, max: 4, step: 0.05, unit: '×', hard: true, value: A.speed, def: 1, onChange: function (v) { A.speed = v; } });
    M.amount = UI.slider({ key: 'anim.amount', min: 0.1, max: 3, step: 0.05, unit: '×', hard: true, value: A.amount, def: 1, onChange: function (v) { A.amount = v; } });
    M.stagger = UI.slider({ key: 'anim.stagger', min: 0, max: 1, step: 0.01, unit: 's', hard: true, value: A.stagger, def: 0.08, onChange: function (v) { A.stagger = v; } });
    M.replace = UI.toggle({ key: 'anim.replace', value: A.replace, onChange: function (v) { A.replace = v; } });
    M.color = UI.color({ key: 'anim.colorFrom', value: A.color, onChange: function (c) { A.color = c; } });
    [M.dur, M.ease].forEach(function (x) { ts.body.appendChild(x); });
    ts.body.appendChild(UI.more('anim').add(M.target, M.start, M.speed, M.amount, M.stagger, M.replace, M.color));

    var grid = el('div', 'grid');
    var apIcon = { reveal3d: 'cube', entrance: 'move', popUp: 'plus', scaleReveal: 'frame', spin3d: 'refresh', smoothRotation: 'reset', floating: 'environment', cinematic: 'camera', extrudeGrow: 'scene', bevelGrow: 'target', colorShift: 'materials' };
    Presets.animation.forEach(function (id) {
      var c = el('button', 'card', Art.anim(id) + '<span>' + t('ap.' + id) + '</span>'); c.type = 'button';
      c.onclick = function () { applyAnimPreset(id, readTiming()); };
      grid.appendChild(c);
    });
    userPresets('animation').forEach(function (p) {
      var c = el('button', 'card', Art.anim(p.data.preset) + '<span></span>'); c.type = 'button';
      c.lastChild.textContent = p.name;
      c.onclick = function () { applyAnimPreset(p.data.preset, Object.assign(readTiming(), p.data)); };
      grid.appendChild(c);
    });
    ps.body.appendChild(grid);
    var cl = el('div', 'btns');
    cl.appendChild(UI.button('anim.clear', { small: true, danger: true, icon: 'trash', onClick: function () { var it = needObj(); if (it) return run('anim.clear', { ref: it.ref }, t('ok.updated')).then(refreshSnapshot); } }));
    ps.body.appendChild(cl);

    function readTiming() {
      var st = parseFloat(startIn.value);
      return { start: isNaN(st) ? null : st, duration: M.dur.get(), ease: M.ease.get(), speed: M.speed.get(), amount: M.amount.get(), stagger: M.stagger.get(), replace: M.replace.get(), color: M.color.get(), target: M.target.get() };
    }
    M.readTiming = readTiming;

    // custom
    var cs = UI.section('animCustom', 'sec.animCustom', { closed: true }); pane.appendChild(cs);
    var fromIn = el('input', 'txt'), toIn = el('input', 'txt');
    fromIn.dir = toIn.dir = 'ltr';
    M.prop = UI.select({ key: 'anim.prop', options: CUSTOM_PROPS.map(function (p) { return { v: p, label: t('prop.' + p) }; }), value: 'ry', onChange: function () { fromIn.value = ''; toIn.value = ''; fillCur(toIn); } });
    function curBtn(inp) { return UI.iconBtn('target', t('anim.useCur'), function () { fillCur(inp); }); }
    function fillCur(inp) {
      var it = needObj(); if (!it) return;
      Host.call('anim.current', { ref: it.ref, target: M.prop.get() }).then(function (v) {
        if (/Color$/.test(M.prop.get()) && v) inp.value = UI.toHex(v);
        else inp.value = Array.isArray(v) ? v.map(function (x) { return Math.round(x * 100) / 100; }).join(', ') : Math.round(v * 100) / 100;
      }).catch(App.error);
    }
    var fr = el('div', 'color'); fr.appendChild(fromIn); fr.appendChild(curBtn(fromIn));
    var tr = el('div', 'color'); tr.appendChild(toIn); tr.appendChild(curBtn(toIn));
    cs.body.appendChild(M.prop); cs.body.appendChild(UI.row('anim.from', fr)); cs.body.appendChild(UI.row('anim.to', tr));
    function parseVal(s) {
      s = String(s || '').trim();
      if (!s) return null;
      if (/^#?[0-9a-f]{6}$/i.test(s)) return UI.fromHex(s);
      var parts = s.split(/[,\s]+/).filter(Boolean).map(Number);
      if (parts.some(isNaN)) return undefined;
      return parts.length === 1 ? parts[0] : parts;
    }
    var cb = el('div', 'btns');
    cb.appendChild(UI.button('anim.apply', { primary: true, icon: 'play', onClick: function () {
      var it = needObj(); if (!it) return;
      var f = parseVal(fromIn.value), to = parseVal(toIn.value);
      if (f === undefined) { fromIn.classList.add('bad'); return; }
      if (to === undefined) { toIn.classList.add('bad'); return; }
      fromIn.classList.remove('bad'); toIn.classList.remove('bad');
      var tm = readTiming();
      return run('anim.applyCustom', { ref: it.ref, target: M.prop.get(), from: f, to: to, start: tm.start, duration: tm.duration, ease: tm.ease, speed: tm.speed, replace: tm.replace })
        .then(function (r) { UI.toast(t('anim.done', { n: r.keys })); refreshSnapshot(); });
    } }));
    cs.body.appendChild(cb);
    M.refresh = function () {};
  }

  function applyAnimPreset(id, tm) {
    var it = activeItem();
    if (!isObj(it)) { UI.toast(t('err.NO_OBJECT'), 'warn'); return; }
    var refs = tm.target === 'selected' ? selRefs() : [it.ref];
    S.lastAnim = id;
    var go = function (start) {
      return run('anim.applyPreset', { refs: refs, preset: id, start: start, duration: tm.duration, ease: tm.ease, speed: tm.speed, amount: tm.amount, stagger: tm.stagger, replace: tm.replace, color: tm.color })
        .then(function (r) { UI.toast(t('anim.done', { n: r.keys })); refreshSnapshot(); }).catch(function () {});
    };
    if (tm.start === null || tm.start === undefined) return Host.call('scene.snapshot', {}).then(function (s) { return go(s && s.time !== undefined ? s.time : 0); });
    return go(tm.start);
  }

  /* ====================== PRESETS LIBRARY ====================== */
  var CATS = ['geometry', 'material', 'lighting', 'camera', 'environment', 'animation', 'scene'];
  function userPresets(cat) { return Store.read('presets/' + cat + '.json', []); }
  function writePresets(cat, list) { Store.write('presets/' + cat + '.json', list); }

  function captureCurrent(cat) {
    var it = activeItem();
    switch (cat) {
      case 'geometry':
        if (!isObj(it)) return Promise.reject({ code: 'NO_OBJECT' });
        return Host.call('geometry.get', { ref: it.ref }).then(function (g) { return { values: { depth: g.depth, bevelStyle: g.bevelStyle, bevelDepth: g.bevelDepth, holeBevel: g.holeBevel, origin: g.origin, depthScale: g.depthScale } }; });
      case 'material':
        if (!isObj(it)) return Promise.reject({ code: 'NO_OBJECT' });
        return Host.call('materials.get', { ref: it.ref }).then(function (m) {
          var layer = {};
          Object.keys(m.layer || {}).forEach(function (k) { if (m.layer[k] !== null && m.layer[k] !== undefined) layer[k] = m.layer[k]; });
          return { layer: layer, surfaces: m.surfaces, fill: m.fill };
        });
      case 'lighting':
        return Host.call('lights.list', {}).then(function (ls) {
          var c = [S.comp.w / 2, S.comp.h / 2, 0];
          return { lights: ls.filter(function (l) { return l.type !== 'environment'; }).map(function (l) {
            var o = { name: l.name, type: l.type, intensity: l.intensity, color: l.color, cone: l.cone, feather: l.feather, falloff: l.falloff, radius: l.radius, falloffDist: l.falloffDist, shadows: l.shadows, shadowDark: l.shadowDark, shadowDiff: l.shadowDiff, enabled: l.enabled };
            if (l.position) o.offset = [l.position[0] - c[0], l.position[1] - c[1], l.position[2] - c[2]];
            if (l.poi) o.poi = l.poi;
            return o;
          }) };
        });
      case 'camera':
        return Host.call('camera.get', {}).then(function (cam) {
          if (!cam) throw { code: 'NO_CAMERA' };
          var c = cam.poi || [S.comp.w / 2, S.comp.h / 2, 0];
          return { offset: [cam.position[0] - c[0], cam.position[1] - c[1], cam.position[2] - c[2]], focal: Math.round(cam.focal * 10) / 10, rz: cam.rz, dof: cam.dof };
        });
      case 'environment':
        return Host.call('environment.get', {}).then(function (e) { if (!e || !e.active) throw { code: 'NO_ENV' }; return { values: { exposure: e.exposure, brightness: e.brightness, contrast: e.contrast, saturation: e.saturation, rotation: e.rotation, file: e.file } }; });
      case 'animation':
        // saves the last applied animation preset together with the current timing settings
        var tm = R.anim.readTiming();
        if (!S.lastAnim) return Promise.reject({ code: 'PRESET_NA' });
        return Promise.resolve({ preset: S.lastAnim, duration: tm.duration, ease: tm.ease, speed: tm.speed, amount: tm.amount, stagger: tm.stagger });
      case 'scene':
        return Host.call('state.exportScene', {});
    }
    return Promise.reject({ code: 'HOST' });
  }

  function savePreset(cat) {
    return captureCurrent(cat).then(function (data) {
      return UI.prompt(t('pre.name'), '').then(function (name) {
        if (!name || !name.trim()) return;
        var list = userPresets(cat);
        var p = { id: 'u' + Date.now().toString(36), name: name.trim(), created: new Date().toISOString(), data: data };
        if (cat === 'material') { p.layer = data.layer; p.surfaces = data.surfaces; p.fill = data.fill; }
        if (cat === 'lighting') p.lights = data.lights;
        list.push(p);
        writePresets(cat, list);
        UI.toast(t('pre.saved'));
        buildPanes();
      });
    }).catch(App.error);
  }

  function applyUserPreset(cat, p) {
    switch (cat) {
      case 'geometry': return applyGeometry(p.data.values || p.values);
      case 'material': return applyMaterial(p);
      case 'lighting': return run('lights.applyPreset', { lights: p.lights || p.data.lights, replace: true }, t('ok.updated')).then(function () { S.listHash = ''; poll(true); });
      case 'camera': return applyFraming(p.data || p);
      case 'environment': return run('environment.set', { values: p.data.values || p.values }, t('ok.updated'));
      case 'animation': return applyAnimPreset(p.data.preset, Object.assign(R.anim.readTiming(), p.data));
      case 'scene': return run('state.importScene', { scene: p.data, renderer: canGeo('depth') ? null : bestRenderer() }, t('ok.created')).then(function () { S.listHash = ''; poll(true); refreshActive(); });
    }
  }

  function builtinList(cat) {
    switch (cat) {
      case 'geometry': return Presets.geometry.map(function (p) { return { name: I18N.lang === 'ar' ? p.ar : p.en, apply: function () { return applyGeometry(p.values); } }; });
      case 'material': return Presets.material.map(function (p) { return { name: I18N.lang === 'ar' ? p.ar : p.en, apply: function () { return applyMaterial(p); } }; });
      case 'lighting': return Presets.lighting.map(function (p) { return { name: t(p.key), apply: function () { return run('lights.applyPreset', { lights: p.lights, replace: true }, t('ok.updated')).then(function () { S.listHash = ''; poll(true); }); } }; });
      case 'camera': return Presets.camera.map(function (p) { return { name: t(p.key), apply: function () { return applyFraming(p); } }; });
      case 'environment': return Presets.environment.map(function (p) { return { name: I18N.lang === 'ar' ? p.ar : p.en, apply: function () { return run('environment.set', { values: p.values }, t('ok.updated')); } }; });
      case 'animation': return Presets.animation.map(function (id) { return { name: t('ap.' + id), apply: function () { return applyAnimPreset(id, R.anim.readTiming()); } }; });
    }
    return [];
  }

  function buildPresets(pane) {
    var M = R.presets = {};
    var catSel = UI.select({ options: CATS.map(function (c) { return { v: c, label: t('pre.' + c) }; }), value: S.presetCat, onChange: function (v) { S.presetCat = v; M.refresh(); } });
    var top = el('div', 'objbar'); top.style.cssText = 'margin:0 0 10px;';
    top.appendChild(catSel.sel);
    pane.appendChild(top);
    var acts = el('div', 'btns'); acts.style.margin = '0 0 10px';
    pane.appendChild(acts);
    var mine = UI.section('pre_mine', 'pre.mine'); pane.appendChild(mine);
    var built = UI.section('pre_builtin', 'pre.builtin'); pane.appendChild(built);

    M.refresh = function () {
      var cat = S.presetCat;
      acts.innerHTML = '';
      acts.appendChild(UI.button(cat === 'scene' ? 'pre.sceneSave' : 'pre.save', { primary: true, small: true, icon: 'plus', onClick: function () { return savePreset(cat); } }));
      acts.appendChild(UI.button('pre.import', { small: true, icon: 'upload', onClick: function () {
        var f = Dialog.open(['json'], t('pre.import'));
        if (!f) return;
        try {
          var d = Store.readAbs(f), items = d.items || (d.objects ? [{ id: 'u' + Date.now().toString(36), name: f.split(/[\\/]/).pop().replace(/\.json$/i, ''), data: d }] : []);
          var targetCat = d.cat || cat;
          var list = userPresets(targetCat), ids = list.map(function (p) { return p.id; });
          items.forEach(function (p) { if (ids.indexOf(p.id) < 0) list.push(p); });
          writePresets(targetCat, list);
          UI.toast(t('pre.imported', { n: items.length }));
          buildPanes();
        } catch (e) { App.error({ code: 'BAD_SCENE' }); }
      } }));
      acts.appendChild(UI.button('pre.export', { small: true, icon: 'download', onClick: function () {
        var f = Dialog.save(['json'], t('pre.export'), 'tilago3d-' + cat + '.json');
        if (!f) return;
        if (!/\.json$/i.test(f)) f += '.json';
        Store.writeAbs(f, { type: 'tilago3d-presets', version: 1, cat: cat, items: userPresets(cat) });
        UI.toast(t('pre.exported'));
      } }));

      mine.body.innerHTML = '';
      var list = userPresets(cat);
      var pl = el('div', 'plist');
      if (!list.length) pl.appendChild(el('div', 'empty', t('pre.empty')));
      list.forEach(function (p, i) {
        var row = el('div', 'pitem');
        var nm = el('span', 'pname'); nm.textContent = p.name; row.appendChild(nm);
        row.appendChild(UI.button('pre.load', { small: true, icon: 'play', onClick: function () { return applyUserPreset(cat, p); } }));
        row.appendChild(UI.iconBtn('edit', t('pre.rename'), function () {
          UI.prompt(t('pre.name'), p.name).then(function (n) { if (n && n.trim()) { list[i].name = n.trim(); writePresets(cat, list); M.refresh(); } });
        }));
        row.appendChild(UI.iconBtn('download', t('pre.export'), function () {
          var f = Dialog.save(['json'], t('pre.export'), p.name + '.json');
          if (!f) return;
          if (!/\.json$/i.test(f)) f += '.json';
          Store.writeAbs(f, { type: 'tilago3d-presets', version: 1, cat: cat, items: [p] });
          UI.toast(t('pre.exported'));
        }));
        row.appendChild(UI.iconBtn('trash', t('pre.delete'), function () {
          UI.confirm(t('pre.confirmDelete', { n: p.name }), true).then(function (ok) { if (ok) { list.splice(i, 1); writePresets(cat, list); buildPanes(); } });
        }));
        pl.appendChild(row);
      });
      mine.body.appendChild(pl);

      built.body.innerHTML = '';
      var bl = builtinList(cat);
      built.style.display = bl.length ? '' : 'none';
      var bp = el('div', 'plist');
      bl.forEach(function (p) {
        var row = el('div', 'pitem');
        var nm = el('span', 'pname'); nm.textContent = p.name; row.appendChild(nm);
        row.appendChild(el('span', 'ptag', t('pre.builtin')));
        row.appendChild(UI.button('pre.load', { small: true, icon: 'play', onClick: p.apply }));
        bp.appendChild(row);
      });
      built.body.appendChild(bp);
    };
    M.refresh();
  }

  /* ====================== SETTINGS ====================== */
  function buildSettings(pane) {
    var M = R.settings = {};
    var bs = UI.section('brandId', 'brand.sec'); pane.appendChild(bs);
    var lrow = el('div', 'brand-logo');
    var limg = el('img'); limg.alt = '';
    function paintLogo() {
      var f = brandLogo();
      limg.src = /^([a-z]:|[\\/])/i.test(f) ? 'file:///' + encodeURI(f.replace(/\\/g, '/')) : f;
    }
    paintLogo();
    lrow.appendChild(limg);
    var lbtns = el('div', 'btns');
    lbtns.appendChild(UI.button('brand.change', { small: true, icon: 'upload', onClick: function () {
      var f = Dialog.open(['png', 'jpg', 'jpeg', 'psd', 'tif', 'tiff', 'webp', 'ai', 'eps', 'pdf'], t('brand.change'));
      if (!f) return;
      S.brand.logo = f; saveBrand(); paintLogo(); UI.toast(t('pre.saved')); buildPanes();
    } }));
    lbtns.appendChild(UI.button('brand.reset', { small: true, icon: 'reset', onClick: function () { S.brand.logo = null; saveBrand(); paintLogo(); buildPanes(); } }));
    lrow.appendChild(lbtns);
    bs.body.appendChild(UI.row('brand.logo', lrow, { wide: true }));
    var nameIn = el('input', 'txt'); nameIn.value = S.brand.name; nameIn.dir = 'auto';
    nameIn.onchange = function () { S.brand.name = nameIn.value.trim() || 'TILAGO'; saveBrand(); S.draft.text = S.brand.name; UI.toast(t('pre.saved')); };
    bs.body.appendChild(UI.row('brand.name', nameIn));
    var bfont = UI.select({ key: 'brand.font', options: [], onChange: function (v) {
      S.brand.font = v || null; saveBrand();
      var fam = fontFamilyOf(v); if (fam) { S.draft.family = fam; S.draft.ps = v; if (R.main) R.main.fontsReady(); }
      UI.toast(t('pre.saved'));
    } });
    bs.body.appendChild(bfont);
    var bnote = el('div'); bs.body.appendChild(bnote);
    M.fontsReady = function () {
      var opts = [{ v: '', label: t('brand.noFont') }];
      if (S.fonts) S.fonts.names.forEach(function (n) { S.fonts.families[n].forEach(function (st) { opts.push({ v: st.ps, label: n + ' — ' + st.style }); }); });
      bfont.fill(opts, S.brand.font || '');
      bnote.innerHTML = '';
      if (!S.brand.font) bnote.appendChild(UI.note(t('brand.pickFont'), 'warn'));
      else if (S.fonts && !fontFamilyOf(S.brand.font)) bnote.appendChild(UI.note(t('brand.fontMissing', { f: S.brand.font }), 'warn'));
    };
    M.fontsReady();

    var gs = UI.section('general', 'sec.general'); pane.appendChild(gs);
    gs.body.appendChild(UI.seg({ key: 'set.lang', value: I18N.lang, options: [{ v: 'ar', label: 'العربية' }, { v: 'en', label: 'English' }], onChange: function (v) { I18N.set(v); rebuild(); } }));
    gs.body.appendChild(UI.toggle({ key: 'set.live', value: S.settings.live, onChange: function (v) { S.settings.live = v; saveSettings(); } }));
    gs.body.appendChild(UI.toggle({ key: 'set.sync', value: S.settings.sync, onChange: function (v) { S.settings.sync = v; saveSettings(); } }));
    gs.body.appendChild(UI.seg({ key: 'set.quality', value: S.settings.quality, options: ['low', 'mid', 'high'].map(function (q) { return { v: q, label: t('q.' + q) }; }),
      onChange: function (v) { S.settings.quality = v; saveSettings(); Viewport.setQuality(v); refreshSnapshot(); } }));

    var en = UI.section('engine', 'sec.engine'); pane.appendChild(en);
    var hasE3D = !!(S.info && S.info.e3d);
    var modeSeg = UI.seg({ key: 'set.mode', value: S.mode, options: [{ v: 'native', label: t('mode.native') }, { v: 'e3d', label: t('mode.e3d') + (hasE3D ? '' : ' ✕') }],
      onChange: function (v) {
        if (v === 'e3d' && !hasE3D) { modeSeg.set('native'); UI.toast(t('e3d.missing'), 'warn'); return; }
        S.mode = v; saveSettings(); updateChips(); refreshActive();
      } });
    en.body.appendChild(modeSeg);
    M.rend = UI.select({ key: 'set.renderer', options: [], onChange: function (v) {
      run('caps.setRenderer', { renderer: v }, t('ok.updated')).then(function (c) { S.comp = c; updateChips(); refreshActive(); refreshSnapshot(); }).catch(function () {});
    } });
    en.body.appendChild(M.rend);

    var cs = UI.section('caps', 'sec.caps'); pane.appendChild(cs);
    M.capsBox = el('div'); cs.body.appendChild(M.capsBox);
    var cb = el('div', 'btns');
    cb.appendChild(UI.button('set.reprobe', { small: true, icon: 'refresh', onClick: function () {
      status(t('caps.probing'));
      return run('caps.probe', {}).then(function (p) { Store.write('cache/caps.json', p); S.caps = p; buildPanes(); updateChips(); status(); });
    } }));
    cs.body.appendChild(cb);

    var ds = UI.section('diag', 'sec.diag', { closed: true }); pane.appendChild(ds);
    var db = el('div', 'btns');
    db.appendChild(UI.button('set.dump', { small: true, icon: 'copy', onClick: function () {
      var it = activeItem(); if (!it) { UI.toast(t('err.NO_OBJECT'), 'warn'); return; }
      return run('caps.dump', { ref: it.ref }).then(function (txt) {
        var ta = el('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); UI.toast(t('ok.copied')); } catch (e) {}
        ta.remove();
      });
    } }));
    db.appendChild(UI.button('upd.check', { small: true, icon: 'refresh', onClick: function () {
      if (!window.Updater || !Updater.check) return;
      return Updater.check(true).then(function (r) { if (r && !r.updated) UI.toast(t('upd.latest', { v: r.version || '' })); }).catch(function (e) { UI.toast(t('upd.fail', { e: e.message }), 'err'); });
    } }));
    db.appendChild(UI.button('set.openData', { small: true, icon: 'folder', onClick: function () { Store.openDir(); } }));
    ds.body.appendChild(db);
    var ver = el('p', 'note'); ver.textContent = 'Tilago 3D Studio ' + ((window.Updater && Updater.version) || '1.0.0') + (S.info ? ' · After Effects ' + S.info.version : '');
    ds.body.appendChild(ver);

    M.refresh = function () {
      var rs = (S.comp && S.comp.renderers) || [];
      M.rend.fill(rs.map(function (r) {
        var c = S.caps && S.caps.renderers[r];
        return { v: r, label: (c ? c.name : r) + (c && c.geo.depth ? '  ·  Extrude' : '') };
      }), S.comp ? S.comp.renderer : '');
      M.rend.style.display = S.comp ? '' : 'none';
      M.capsBox.innerHTML = '';
      var tb = el('table', 'caps');
      function line(label, ok, txt) {
        var tr = el('tr');
        var a = el('td'); a.textContent = label;
        var b = el('td', ok ? 'yes' : 'no'); b.textContent = txt || t(ok ? 'caps.yes' : 'caps.no');
        tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
      }
      if (S.info) {
        line(t('caps.ae'), true, S.info.version);
        line(t('caps.e3d'), !!S.info.e3d, t(S.info.e3d ? 'caps.installed' : 'caps.missing'));
        line(t('caps.fonts'), true, t(S.info.fontsApi ? 'caps.fromAE' : 'caps.fromPanel'));
        line(t('caps.envLight'), !!S.info.envLight);
        line(t('caps.rtl'), !!S.info.paragraphDirection);
      }
      var r = capsR();
      if (r) {
        ['depth', 'bevelStyle', 'bevelDepth', 'holeBevel'].forEach(function (k) { line(r.name + ' · ' + t(k === 'depth' ? 'geo.depth' : (k === 'bevelStyle' ? 'geo.bevelStyle' : (k === 'bevelDepth' ? 'geo.bevelDepth' : 'geo.holeBevel'))), !!r.geo[k]); });
        MAT_SLIDERS.forEach(function (d) { line(r.name + ' · ' + t('mat.' + d[0]), !!r.mat[d[0]]); });
        line(r.name + ' · ' + t('surf.Front') + ' / ' + t('surf.Side') + ' / ' + t('surf.Bevel'), canSurf('Front', 'color') && canSurf('Side', 'color'));
      }
      M.capsBox.appendChild(tb);
      M.capsBox.appendChild(UI.note(t('caps.never')));
      M.capsBox.appendChild(UI.note(t('caps.e3dManual')));
    };
    M.refresh();
  }

  document.addEventListener('DOMContentLoaded', start);
})();
