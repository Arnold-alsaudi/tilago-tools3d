/* Tilago 3D Studio - core helpers (ExtendScript / ES3)
   Everything lives under the TS3D namespace so it never clashes with other panels. */

$.global.TSRB = $.global.TSRB || {};

(function (T) {
  T.VERSION = '1.0.0';
  T.TAG = 'TS3D';
  T.modules = T.modules || {};

  /* ---------- JSON (ExtendScript has none) ---------- */
  function esc(s) {
    var out = '', i, c, h;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c === 34) out += '\\"';
      else if (c === 92) out += '\\\\';
      else if (c === 10) out += '\\n';
      else if (c === 13) out += '\\r';
      else if (c === 9) out += '\\t';
      else if (c < 32 || c > 126) { h = c.toString(16); while (h.length < 4) h = '0' + h; out += '\\u' + h; }
      else out += s.charAt(i);
    }
    return '"' + out + '"';
  }
  T.stringify = function (v) {
    var t = typeof v, i, parts, k;
    if (v === null || v === undefined || t === 'function') return 'null';
    if (t === 'number') return isFinite(v) ? String(Math.round(v * 100000) / 100000) : 'null';
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') return esc(v);
    if (v instanceof Array) {
      parts = [];
      for (i = 0; i < v.length; i++) parts.push(T.stringify(v[i]));
      return '[' + parts.join(',') + ']';
    }
    parts = [];
    for (k in v) { if (v.hasOwnProperty(k) && typeof v[k] !== 'function' && v[k] !== undefined) parts.push(esc(k) + ':' + T.stringify(v[k])); }
    return '{' + parts.join(',') + '}';
  };
  T.parse = function (s) {
    if (!s) return {};
    return eval('(' + s + ')');
  };

  /* ---------- errors ---------- */
  T.fail = function (code, msg) {
    var e = new Error(msg || code);
    e.tsCode = code;
    throw e;
  };

  /* ---------- small utils ---------- */
  T.has = function (arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i] === v) return true; return false; };
  T.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  T.num = function (v, d) { v = parseFloat(v); return isNaN(v) ? d : v; };
  T.uid = function () { return (new Date().getTime()).toString(36) + Math.floor(Math.random() * 1e6).toString(36); };

  /* ---------- undo ---------- */
  // Re-entrant: nested calls join the outer group so one click = one undo step.
  T._undoDepth = 0;
  T.undo = function (name, fn) {
    if (T._undoDepth > 0) { T._undoDepth++; try { return fn(); } finally { T._undoDepth--; } }
    T._undoDepth = 1;
    app.beginUndoGroup('Tilago 3D: ' + name);
    try { return fn(); }
    finally { app.endUndoGroup(); T._undoDepth = 0; }
  };

  /* ---------- property helpers ---------- */
  // keys: list of matchNames or display names. Returns the first property found.
  T.prop = function (group, keys) {
    if (!group) return null;
    if (!(keys instanceof Array)) keys = [keys];
    var i, p, j, n, kl;
    for (i = 0; i < keys.length; i++) {
      try { p = group.property(keys[i]); } catch (e) { p = null; }
      if (p) return p;
    }
    // case-insensitive name scan as last resort
    try { n = group.numProperties; } catch (e2) { return null; }
    for (j = 1; j <= n; j++) {
      p = group.property(j);
      for (i = 0; i < keys.length; i++) {
        kl = String(keys[i]).toLowerCase();
        if (p.matchName.toLowerCase() === kl || p.name.toLowerCase() === kl) return p;
      }
    }
    return null;
  };

  T.isDim = function (p) {
    try {
      var t = p.propertyValueType;
      return t === PropertyValueType.OneD || t === PropertyValueType.TwoD || t === PropertyValueType.ThreeD ||
             t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL || t === PropertyValueType.COLOR;
    } catch (e) { return false; }
  };

  T.compTime = function (comp) { try { return comp.time; } catch (e) { return 0; } };

  // Sets a value; if the property is keyframed the key at the current time is set instead,
  // so the slider never silently fails on animated properties.
  T.setVal = function (p, v, comp) {
    if (!p) return false;
    if (p.numKeys > 0) p.setValueAtTime(T.compTime(comp || T.activeComp()), v);
    else p.setValue(v);
    return true;
  };

  T.getVal = function (p, comp) {
    if (!p) return null;
    try { return p.numKeys > 0 ? p.valueAtTime(T.compTime(comp || T.activeComp()), false) : p.value; }
    catch (e) { return null; }
  };

  T.setColor = function (p, rgb, comp) {
    if (!p) return false;
    var c3 = [rgb[0], rgb[1], rgb[2]];
    try { return T.setVal(p, c3, comp); }
    catch (e) { return T.setVal(p, [rgb[0], rgb[1], rgb[2], 1], comp); }
  };

  T.toArr = function (v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    var out = [], i;
    for (i = 0; i < v.length; i++) out.push(v[i]);
    return out;
  };

  /* ---------- layer tags (stored in layer.comment) ---------- */
  var TAG_RE = /TS3D:([a-z0-9]+):([A-Za-z0-9]+)/;
  T.tagOf = function (layer) {
    var m;
    try { m = TAG_RE.exec(layer.comment || ''); } catch (e) { m = null; }
    return m ? { role: m[1], id: m[2] } : null;
  };
  T.setTag = function (layer, role, id) {
    var c = layer.comment || '';
    c = c.replace(/\n?TS3D:[a-z0-9]+:[A-Za-z0-9]+/g, '');
    id = id || T.uid();
    layer.comment = (c ? c + '\n' : '') + 'TSRB:' + role + ':' + id;
    return id;
  };

  T.refOf = function (layer) {
    var t = T.tagOf(layer);
    return t ? t.id : ('i' + layer.index);
  };

  /* ---------- comp / scene ---------- */
  T.activeComp = function () {
    var it = app.project ? app.project.activeItem : null;
    return (it && it instanceof CompItem) ? it : null;
  };
  T.requireComp = function () {
    var c = T.activeComp();
    if (!c) T.fail('NO_COMP', 'Open a composition first');
    return c;
  };
  T.findComp = function (tag) {
    var i, it;
    for (i = 1; i <= app.project.numItems; i++) {
      it = app.project.item(i);
      if (it instanceof CompItem && it.comment && it.comment.indexOf(tag) >= 0) return it;
    }
    return null;
  };
  T.findFolder = function (name, create) {
    var i, it;
    for (i = 1; i <= app.project.numItems; i++) {
      it = app.project.item(i);
      if (it instanceof FolderItem && it.name === name) return it;
    }
    return create ? app.project.items.addFolder(name) : null;
  };

  T.layerByRef = function (comp, ref) {
    var i, L, t;
    if (!comp || !ref) return null;
    if (ref.charAt(0) === 'i' && /^i\d+$/.test(ref)) {
      i = parseInt(ref.substr(1), 10);
      return (i >= 1 && i <= comp.numLayers) ? comp.layer(i) : null;
    }
    for (i = 1; i <= comp.numLayers; i++) {
      L = comp.layer(i);
      t = T.tagOf(L);
      if (t && t.id === ref) return L;
    }
    return null;
  };
  T.requireLayer = function (comp, ref) {
    var L = T.layerByRef(comp, ref);
    if (!L) T.fail('NO_LAYER', 'Layer not found');
    return L;
  };
  T.layersByRole = function (comp, role) {
    var out = [], i, t;
    for (i = 1; i <= comp.numLayers; i++) {
      t = T.tagOf(comp.layer(i));
      if (t && t.role === role) out.push(comp.layer(i));
    }
    return out;
  };

  T.isText = function (L) { return L instanceof TextLayer; };
  T.isShape = function (L) { return L instanceof ShapeLayer; };
  T.isCamera = function (L) { return L instanceof CameraLayer; };
  T.isLight = function (L) { return L instanceof LightLayer; };

  T.center = function (comp) { return [comp.width / 2, comp.height / 2, 0]; };

  /* ---------- dispatcher ---------- */
  T.call = function (name, argsJson) {
    var res;
    try {
      var parts = name.split('.'), mod = T.modules[parts[0]], fn = mod ? mod[parts[1]] : null;
      if (!fn) T.fail('NO_FN', 'Unknown action: ' + name);
      res = fn(T.parse(argsJson));
      return T.stringify({ ok: true, data: res === undefined ? null : res });
    } catch (e) {
      return T.stringify({ ok: false, code: e.tsCode || 'AE_ERROR', error: String(e.message || e), line: e.line || null });
    }
  };
})($.global.TSRB);
