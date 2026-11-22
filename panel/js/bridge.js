/* Host bridge (CEP <-> ExtendScript), local storage on disk, Windows font scanner, file dialogs. */
(function () {
  var cep = window.__adobe_cep__ || null;
  var node = (typeof require === 'function') ? require : null;
  var fs = node ? node('fs') : null, path = node ? node('path') : null, os = node ? node('os') : null;

  /* ---------- host calls ---------- */
  function asciiJson(v) {
    return JSON.stringify(v).replace(/[\u007f-\uffff]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); });
  }
  function rawEval(script) {
    return new Promise(function (res) {
      if (!cep) { res(null); return; }
      cep.evalScript(script, function (r) { res(r); });
    });
  }

  var queue = Promise.resolve(), loaded = false;
  function extPath() {
    if (!cep) return '';
    var p = decodeURI(cep.getSystemPath('extension'));
    return p.replace(/^file:\/{2,3}/, '');
  }

  // The manifest's ScriptPath loads host.jsx when the panel opens; if it is not there yet
  // (or AE reset the engine), load it explicitly. Never relies on try-statement return values,
  // which ExtendScript does not return.
  var loadErr = '';
  function hostStatus() { return rawEval('typeof TS3D_status=="function"?TS3D_status():"MISSING"'); }
  function ensureHost() {
    if (loaded || !cep) return Promise.resolve(!!cep);
    return hostStatus().then(function (r) {
      if (r === 'TS3D_READY') return r;
      var f = extPath() + '/jsx/host.jsx';
      return rawEval('var __ts3dErr="";try{$.evalFile(' + JSON.stringify(f) + ');}catch(e){__ts3dErr="ERR:"+e.message+" line "+e.line;} __ts3dErr').then(function (r2) {
        if (r2 && String(r2).indexOf('ERR:') === 0) return r2;
        return hostStatus();
      });
    }).then(function (r) {
      loaded = r === 'TS3D_READY';
      loadErr = loaded ? '' : String(r || 'empty result');
      if (!loaded) console.error('host load failed', r);
      return loaded;
    });
  }

  function call(name, args) {
    if (!cep) return Mock.call(name, args || {});
    var job = queue.then(function () { return ensureHost(); }).then(function (ok) {
      if (!ok) throw mkErr('EVAL', loadErr || 'host not loaded');
      var s = 'TS3D_call(' + JSON.stringify(name) + ',' + asciiJson(asciiJson(args || {})) + ')';
      return rawEval(s);
    }).then(function (r) {
      if (r === 'EvalScript error.' || r === null || r === undefined || r === '') {
        loaded = false;
        throw mkErr('EVAL', String(r));
      }
      var o;
      try { o = JSON.parse(r); } catch (e) { throw mkErr('EVAL', r); }
      if (!o.ok) throw mkErr(o.code || 'HOST', o.error);
      return o.data;
    });
    queue = job.catch(function () {});
    return job;
  }
  function mkErr(code, msg) { var e = new Error(msg); e.code = code; return e; }

  // Latest-wins channels for live sliders: only the newest value of a channel is sent.
  var pending = {}, running = {};
  function live(channel, name, args) {
    pending[channel] = { name: name, args: args };
    if (running[channel]) return;
    running[channel] = true;
    (function pump() {
      var job = pending[channel];
      if (!job) { running[channel] = false; return; }
      pending[channel] = null;
      call(job.name, job.args).catch(function (e) { if (window.App) App.error(e); }).then(function () { setTimeout(pump, 30); });
    })();
  }

  /* ---------- disk store ---------- */
  var dataDir = null;
  function dir() {
    if (dataDir || !fs) return dataDir;
    var base = process.env.APPDATA || (os && os.homedir()) || '.';
    dataDir = path.join(base, 'TilagoStudio3D');
    ['', 'presets', 'scenes', 'cache'].forEach(function (d) {
      var p = path.join(dataDir, d);
      if (!fs.existsSync(p)) fs.mkdirSync(p);
    });
    return dataDir;
  }
  var Store = {
    available: !!fs,
    dir: function () { return dir(); },
    read: function (rel, fallback) {
      if (!fs) { try { var v = localStorage.getItem('ts3d.f.' + rel); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
      try { return JSON.parse(fs.readFileSync(path.join(dir(), rel), 'utf8')); } catch (e2) { return fallback; }
    },
    write: function (rel, obj) {
      var s = JSON.stringify(obj, null, 2);
      if (!fs) { try { localStorage.setItem('ts3d.f.' + rel, s); } catch (e) {} return; }
      var p = path.join(dir(), rel), tmp = p + '.tmp';
      fs.writeFileSync(tmp, s, 'utf8');
      fs.renameSync(tmp, p);
    },
    list: function (sub) {
      if (!fs) return [];
      try { return fs.readdirSync(path.join(dir(), sub)).filter(function (f) { return /\.json$/i.test(f); }); } catch (e) { return []; }
    },
    remove: function (rel) { if (fs) try { fs.unlinkSync(path.join(dir(), rel)); } catch (e) {} },
    readAbs: function (p) { return JSON.parse(fs.readFileSync(p, 'utf8')); },
    writeAbs: function (p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); },
    tmpFile: function (name) { return fs ? path.join(dir(), 'cache', name) : name; },
    exists: function (p) { return fs ? fs.existsSync(p) : false; },
    openDir: function () { if (node) try { node('child_process').exec('explorer "' + dir() + '"'); } catch (e) {} }
  };

  /* ---------- dialogs ---------- */
  var Dialog = {
    open: function (types, title) {
      if (!window.cep || !window.cep.fs) return null;
      var r = window.cep.fs.showOpenDialogEx(false, false, title || '', '', types || []);
      return r && !r.err && r.data && r.data.length ? r.data[0] : null;
    },
    save: function (types, title, name) {
      if (!window.cep || !window.cep.fs) return null;
      var r = window.cep.fs.showSaveDialogEx(title || '', '', types || [], name || '');
      return r && !r.err && r.data ? r.data : null;
    }
  };

  /* ---------- Windows font scanner (used when AE has no font API, before AE 2024) ---------- */
  function readNameTable(fd, offset) {
    var b = Buffer.alloc(12);
    fs.readSync(fd, b, 0, 12, offset);
    var num = b.readUInt16BE(4), dirB = Buffer.alloc(num * 16), i, tag, nameOff = 0, nameLen = 0;
    fs.readSync(fd, dirB, 0, num * 16, offset + 12);
    for (i = 0; i < num; i++) {
      tag = dirB.toString('ascii', i * 16, i * 16 + 4);
      if (tag === 'name') { nameOff = dirB.readUInt32BE(i * 16 + 8); nameLen = dirB.readUInt32BE(i * 16 + 12); }
    }
    if (!nameOff) return null;
    var nb = Buffer.alloc(nameLen);
    fs.readSync(fd, nb, 0, nameLen, nameOff);
    var count = nb.readUInt16BE(2), strOff = nb.readUInt16BE(4), rec, names = {}, best = {};
    for (i = 0; i < count; i++) {
      rec = 6 + i * 12;
      var plat = nb.readUInt16BE(rec), enc = nb.readUInt16BE(rec + 2), langId = nb.readUInt16BE(rec + 4), id = nb.readUInt16BE(rec + 6);
      var len = nb.readUInt16BE(rec + 8), off = nb.readUInt16BE(rec + 10);
      if ([1, 2, 4, 6, 16, 17].indexOf(id) < 0) continue;
      var score = plat === 3 ? (langId === 0x409 ? 3 : 2) : (plat === 1 && langId === 0 ? 1 : 0);
      if (!score || (best[id] || 0) >= score) continue;
      var raw = nb.slice(strOff + off, strOff + off + len), s;
      if (plat === 3) { s = ''; for (var k = 0; k + 1 < raw.length; k += 2) s += String.fromCharCode(raw.readUInt16BE(k)); }
      else s = raw.toString('latin1');
      names[id] = s; best[id] = score;
    }
    return names;
  }
  function scanFile(p) {
    var out = [], fd;
    try {
      fd = fs.openSync(p, 'r');
      var h = Buffer.alloc(12);
      fs.readSync(fd, h, 0, 12, 0);
      var offs = [0];
      if (h.toString('ascii', 0, 4) === 'ttcf') {
        var n = h.readUInt32BE(8), ob = Buffer.alloc(n * 4);
        fs.readSync(fd, ob, 0, n * 4, 12);
        offs = [];
        for (var i = 0; i < n; i++) offs.push(ob.readUInt32BE(i * 4));
      }
      offs.forEach(function (o) {
        var nm = readNameTable(fd, o);
        if (nm && nm[6]) out.push({ family: nm[16] || nm[1], style: nm[17] || nm[2] || 'Regular', ps: nm[6] });
      });
    } catch (e) {} finally { if (fd !== undefined) try { fs.closeSync(fd); } catch (e2) {} }
    return out;
  }
  function scanFonts() {
    if (!fs) return Mock.fonts();
    var dirs = [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')];
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
    var cache = Store.read('cache/fonts.json', { files: {} }), files = {}, list = [], seen = {};
    dirs.forEach(function (d) {
      var names = [];
      try { names = fs.readdirSync(d); } catch (e) {}
      names.forEach(function (n) {
        if (!/\.(ttf|otf|ttc)$/i.test(n)) return;
        var p = path.join(d, n), st;
        try { st = fs.statSync(p); } catch (e) { return; }
        var key = p + '|' + st.size + '|' + st.mtimeMs;
        files[key] = cache.files[key] || scanFile(p);
      });
    });
    Store.write('cache/fonts.json', { files: files });
    Object.keys(files).forEach(function (k) {
      files[k].forEach(function (f) { if (!seen[f.ps]) { seen[f.ps] = 1; list.push(f); } });
    });
    return list;
  }

  var Fonts = {
    load: function () {
      return call('text.fonts', {}).catch(function () { return null; }).then(function (fromAE) {
        var list = fromAE && fromAE.length ? fromAE : scanFonts(), fam = {};
        list.forEach(function (f) {
          if (!f.family || !f.ps) return;
          (fam[f.family] = fam[f.family] || []).push({ style: f.style, ps: f.ps });
        });
        var order = ['Regular', 'Book', 'Normal', 'Roman', 'Medium', 'Light', 'Bold'];
        Object.keys(fam).forEach(function (k) {
          fam[k].sort(function (a, b) {
            var ia = order.indexOf(a.style), ib = order.indexOf(b.style);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.style.localeCompare(b.style);
          });
        });
        return { source: fromAE && fromAE.length ? 'ae' : 'panel', families: fam, names: Object.keys(fam).sort(function (a, b) { return a.localeCompare(b); }) };
      });
    }
  };

  /* ---------- browser preview mock (no After Effects) ---------- */
  var Mock = {
    state: null,
    fonts: function () {
      return [{ family: 'Arial', style: 'Regular', ps: 'ArialMT' }, { family: 'Arial', style: 'Bold', ps: 'Arial-BoldMT' },
              { family: 'Segoe UI', style: 'Regular', ps: 'SegoeUI' }, { family: 'Segoe UI', style: 'Bold', ps: 'SegoeUI-Bold' },
              { family: 'Tahoma', style: 'Regular', ps: 'Tahoma' }, { family: 'Bahnschrift', style: 'Regular', ps: 'Bahnschrift' }];
    },
    glyphs: function (text, size) {
      var c = [], x = -text.length * size * 0.3, i, w = size * 0.5, h = size * 0.7;
      for (i = 0; i < text.length; i++) {
        if (text[i] === ' ') { x += w * 1.2; continue; }
        var x0 = x, y0 = -h / 2, x1 = x + w, y1 = h / 2, z = [[0, 0], [0, 0], [0, 0], [0, 0]];
        c.push({ v: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], i: z, o: z, c: true });
        c.push({ v: [[x0 + w * 0.3, y0 + h * 0.25], [x0 + w * 0.3, y1 - h * 0.25], [x1 - w * 0.3, y1 - h * 0.25], [x1 - w * 0.3, y0 + h * 0.25]], i: z, o: z, c: true });
        x += w * 1.2;
      }
      return c;
    },
    call: function (name, a) {
      var S = Mock.state || (Mock.state = { objects: [], n: 0 });
      var comp = { name: 'Preview Comp', w: 1920, h: 1080, fps: 30, dur: 10, renderer: 'ADBE Calder', rendererName: 'Cinema 4D', renderers: ['ADBE Advanced 3d', 'ADBE Calder'] };
      var allMat = { castsShadows: true, acceptsShadows: true, acceptsLights: true, appearsInRefl: true, ambient: true, diffuse: true, specular: true, shininess: true, metal: true, reflection: true, gloss: true, fresnel: true, transparency: false, transRolloff: false, ior: false, lightTrans: true };
      var surf = {}; ['Front', 'Bevel', 'Side', 'Back'].forEach(function (s) { surf[s] = { color: true, opacity: true, metal: true, reflection: true, specular: true, shininess: true }; });
      var r = (function () {
        switch (name) {
          case 'caps.info': return { version: 'preview', fontsApi: false, envLight: false, e3d: null, comp: comp };
          case 'caps.probe': return { version: 'preview', best: 'ADBE Calder', renderers: { 'ADBE Calder': { name: 'Cinema 4D', geo: { depth: true, bevelStyle: true, bevelDepth: true, holeBevel: true }, mat: allMat, surf: surf }, 'ADBE Advanced 3d': { name: 'Classic 3D', geo: { depth: false, bevelStyle: false, bevelDepth: false, holeBevel: false }, mat: allMat, surf: {} } } };
          case 'caps.comp': return comp;
          case 'text.fonts': return null;
          case 'text.create':
            var o = { ref: 'm' + (++S.n), name: a.text, text: a, geo: { supported: true, depth: 60, bevelStyle: 'angular', bevelDepth: 4, holeBevel: 100, depthScale: 100, origin: 'front', faces: { Front: true, Back: true, Side: true, Bevel: true } },
                      mat: { kind: 'text', layer: {}, surfaces: {}, fill: a.fill || [0.33, 0.09, 0.71] }, tf: { position: [960, 540, 0], orientation: [0, 0, 0], rx: 0, ry: 0, rz: 0, scale: [100, 100, 100], anchor: [0, 0, 0], opacity: 100 }, enabled: true, locked: false };
            S.objects.push(o);
            return { ref: o.ref, comp: comp, notes: [] };
          case 'text.read': var t0 = find(a.ref); return t0 ? Object.assign({ isText: true }, t0.text) : { isText: false };
          case 'text.update': var t1 = find(a.ref); if (t1) Object.assign(t1.text, a); return { notes: [] };
          case 'text.outlines': var t2 = find(a.ref); return { contours: Mock.glyphs(t2 ? String(t2.text.text || '') : 'A', t2 ? t2.text.size || 200 : 200) };
          case 'scene.list': return { comp: comp, items: S.objects.map(function (o) { return { ref: o.ref, name: o.name, role: 'text', tagged: true, enabled: o.enabled, locked: o.locked, is3D: true, parent: null }; }) };
          case 'scene.snapshot': return { comp: comp, camera: null, lights: [], bg: null, objects: S.objects.map(function (o) { return Object.assign({ ref: o.ref, name: o.name, role: 'text', enabled: o.enabled, geo: o.geo, mat: o.mat, hash: o.text.text + o.text.size }, o.tf); }), parents: {} };
          case 'scene.getTransform': return find(a.ref).tf;
          case 'scene.setTransform': Object.assign(find(a.ref || a.refs[0]).tf, a.values); return true;
          case 'scene.setFlags': var f = find(a.ref); if (a.enabled !== undefined) f.enabled = a.enabled; if (a.locked !== undefined) f.locked = a.locked; return f;
          case 'scene.rename': find(a.ref).name = a.name; return true;
          case 'scene.remove': S.objects = S.objects.filter(function (o) { return (a.refs || [a.ref]).indexOf(o.ref) < 0; }); return true;
          case 'geometry.get': return find(a.ref).geo;
          case 'geometry.set': Object.assign(find(a.ref || a.refs[0]).geo, a.values); return true;
          case 'materials.get': return find(a.ref).mat;
          case 'materials.set': var m = find(a.ref || a.refs[0]).mat; if (a.values.layer) Object.assign(m.layer, a.values.layer); if (a.values.fill) m.fill = a.values.fill;
            if (a.values.surfaces) Object.keys(a.values.surfaces).forEach(function (s) { m.surfaces[s] = Object.assign(m.surfaces[s] || {}, a.values.surfaces[s]); }); return { skipped: [] };
          case 'lights.list': return [];
          case 'camera.get': return null;
          case 'background.get': return null;
          case 'environment.get': return { mode: 'layer', active: false };
          case 'e3d.list': return [];
          case 'brand.scan': return { comps: 6, links: [{ e3d: '5:1', kind: 'extrude' }, { e3d: '5:1', kind: 'extrude' }],
            logos: [{ key: '5:3', comp: 'Element 3D Logo', layer: 'Logo Masks', kind: 'masks', e3d: ['E3D extrude'], likely: true, box: [700, 380, 520, 320],
                      preview: [[[700, 380], [1220, 380], [1220, 700], [700, 700]], [[860, 470], [1060, 470], [960, 620]]] },
                    { key: '7:2', comp: 'Place Your Logo', layer: 'logo.png', kind: 'image', e3d: [], likely: true, file: 'img/emblem.png', w: 296, h: 160 }],
            texts: [{ key: '5:2', comp: 'Element 3D Logo', layer: 'Title', text: 'YOUR TITLE', e3d: ['E3D extrude'], likely: true },
                    { key: '9:1', comp: 'Final', layer: 'Slogan', text: 'Your slogan here', e3d: [], likely: true }] };
          case 'brand.apply': return { logos: (a.logos || []).length, texts: (a.texts || []).length, skipped: [] };
        }
        return null;
      })();
      return new Promise(function (res) { setTimeout(function () { res(r); }, 40); });
      function find(ref) { for (var i = 0; i < S.objects.length; i++) if (S.objects[i].ref === ref) return S.objects[i]; return null; }
    }
  };

  /* ---------- auto update from GitHub ----------
     panel/files.json lists every file with its sha256. On open (and every 10 minutes) the panel reads
     the newest files.json from the repo; if the version is newer it downloads only the changed files,
     checks each hash, swaps them in, reloads the ExtendScript modules and then itself. */
  var UPDATE_BASE = 'https://raw.githubusercontent.com/Arnold-alsaudi/tilago-tools3d/main/panel/';
  var Updater = { version: null, checking: false, last: null };
  function get(url, cb, hops) {
    var https = node('https');
    https.get(url, { headers: { 'User-Agent': 'tilago-3d-studio', 'Cache-Control': 'no-cache' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (hops || 0) < 4) { res.resume(); return get(res.headers.location, cb, (hops || 0) + 1); }
      if (res.statusCode !== 200) { res.resume(); return cb(new Error('HTTP ' + res.statusCode)); }
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { cb(null, Buffer.concat(chunks)); });
    }).on('error', cb).setTimeout(20000, function () { this.abort(); });
  }
  function getP(url) { return new Promise(function (ok, no) { get(url, function (e, b) { if (e) no(e); else ok(b); }); }); }
  function mkdirp(d) { if (fs.existsSync(d)) return; mkdirp(path.dirname(d)); fs.mkdirSync(d); }
  function sha(buf) { return node('crypto').createHash('sha256').update(buf).digest('hex'); }
  function newer(a, b) {
    var x = String(a).split('.').map(Number), y = String(b || '0').split('.').map(Number), i;
    for (i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
    return false;
  }
  function checkUpdates(manual) {
    if (!cep || !fs || Updater.checking) return Promise.resolve(null);
    var root = extPath(), local = {};
    try { local = JSON.parse(fs.readFileSync(path.join(root, 'files.json'), 'utf8')); } catch (e) {}
    Updater.version = local.version || null;
    Updater.checking = true;
    return getP(UPDATE_BASE + 'files.json?t=' + Date.now()).then(function (buf) {
      var remote = JSON.parse(buf.toString('utf8'));
      if (!newer(remote.version, local.version)) return { updated: false, version: local.version };
      var changed = Object.keys(remote.files).filter(function (rel) {
        try { return sha(fs.readFileSync(path.join(root, rel))) !== remote.files[rel]; } catch (e) { return true; }
      });
      // download everything first, verify, and only then write: a half update never lands
      return Promise.all(changed.map(function (rel) {
        return getP(UPDATE_BASE + rel.split('/').map(encodeURIComponent).join('/') + '?v=' + remote.version).then(function (b) {
          if (sha(b) !== remote.files[rel]) throw new Error('hash mismatch: ' + rel);
          return { rel: rel, buf: b };
        });
      })).then(function (items) {
        items.forEach(function (it) {
          var p = path.join(root, it.rel), dir = path.dirname(p);
          mkdirp(dir);
          fs.writeFileSync(p + '.new', it.buf);
          fs.renameSync(p + '.new', p);
        });
        fs.writeFileSync(path.join(root, 'files.json'), buf);
        var needsRestart = changed.some(function (r) { return /manifest\.xml$/i.test(r); });
        try { sessionStorage.setItem('ts3d.updated', JSON.stringify({ v: remote.version, restart: needsRestart })); } catch (e) {}
        return rawEval('try{TS3D_load()}catch(e){}').then(function () { location.reload(); return { updated: true, version: remote.version }; });
      });
    }).catch(function (e) {
      console.warn('update check failed', e);
      if (manual) throw e;
      return null;
    }).then(function (r) { Updater.checking = false; Updater.last = Date.now(); return r; }, function (e) { Updater.checking = false; throw e; });
  }
  Updater.check = checkUpdates;
  if (cep && fs) {
    try { Updater.version = JSON.parse(fs.readFileSync(path.join(extPath(), 'files.json'), 'utf8')).version; } catch (e) {}
    setTimeout(function () { checkUpdates(false); }, 3000);
    setInterval(function () { checkUpdates(false); }, 10 * 60 * 1000);
  }
  window.Updater = Updater;

  window.Host = { call: call, live: live, connected: !!cep, ensure: ensureHost, extPath: extPath };
  window.Store = Store;
  window.Dialog = Dialog;
  window.Fonts = Fonts;
})();
