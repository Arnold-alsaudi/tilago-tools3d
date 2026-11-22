/* Lighting studio + camera studio. Uses real After Effects lights and cameras. */

(function (T) {
  var L_ = {}, C_ = {};

  var LKEYS = {
    intensity: ['ADBE Light Intensity', 'Intensity'],
    color: ['ADBE Light Color', 'Color'],
    cone: ['ADBE Light Cone Angle', 'Cone Angle'],
    feather: ['ADBE Light Cone Feather 2', 'ADBE Light Cone Feather', 'Cone Feather'],
    falloff: ['ADBE Light Falloff Type', 'Falloff'],
    radius: ['ADBE Light Falloff Start', 'Radius'],
    falloffDist: ['ADBE Light Falloff Distance', 'Falloff Distance'],
    shadows: ['ADBE Light Casts Shadows', 'ADBE Casts Shadows', 'Casts Shadows'],
    shadowDark: ['ADBE Light Shadow Darkness', 'Shadow Darkness'],
    shadowDiff: ['ADBE Light Shadow Diffusion', 'Shadow Diffusion']
  };
  var FALLOFFS = ['none', 'smooth', 'inverse'];

  function typeOf(name) {
    if (name === 'parallel') return LightType.PARALLEL;
    if (name === 'spot') return LightType.SPOT;
    if (name === 'ambient') return LightType.AMBIENT;
    return LightType.POINT;
  }
  function opts(L) { return L.property('ADBE Light Options Group'); }

  function readLight(L, c) {
    var g = opts(L), r = { ref: T.refOf(L), name: L.name, enabled: L.enabled, type: T.lightTypeName(L.lightType) }, k, p, v;
    for (k in LKEYS) {
      if (!LKEYS.hasOwnProperty(k)) continue;
      p = T.prop(g, LKEYS[k]);
      if (!p) continue;
      v = T.toArr(T.getVal(p, c));
      if (k === 'falloff' && typeof v === 'number') v = FALLOFFS[v - 1] || 'none';
      if (k === 'shadows') v = !!v;
      r[k] = v;
    }
    var t = T.modules.scene.transformOf(L, c);
    r.position = t.position; r.poi = t.poi; r.orientation = t.orientation; r.rx = t.rx; r.ry = t.ry; r.rz = t.rz; r.autoOrient = t.autoOrient;
    return r;
  }

  L_.list = function () {
    var c = T.activeComp(), out = [], i;
    if (!c) return [];
    for (i = 1; i <= c.numLayers; i++) if (T.isLight(c.layer(i))) out.push(readLight(c.layer(i), c));
    return out;
  };

  L_.get = function (a) { var c = T.requireComp(); return readLight(T.requireLayer(c, a.ref), c); };

  function apply(L, c, v) {
    var g = opts(L), k, p, val;
    if (v.type && v.type !== T.lightTypeName(L.lightType)) L.lightType = typeOf(v.type);
    if (v.name) L.name = v.name;
    if (v.enabled !== undefined) L.enabled = !!v.enabled;
    g = opts(L);
    for (k in LKEYS) {
      if (!LKEYS.hasOwnProperty(k) || v[k] === undefined) continue;
      p = T.prop(g, LKEYS[k]);
      if (!p) continue;
      val = v[k];
      if (k === 'falloff') { val = 1; for (var f = 0; f < FALLOFFS.length; f++) if (FALLOFFS[f] === v[k]) val = f + 1; }
      if (k === 'shadows') val = v[k] ? 1 : 0;
      try { if (k === 'color') T.setColor(p, val, c); else T.setVal(p, val, c); } catch (e) {}
    }
    var t = {};
    if (v.position) t.position = v.position;
    if (v.poi) t.poi = v.poi;
    if (v.orientation) t.orientation = v.orientation;
    if (v.rx !== undefined) t.rx = v.rx;
    if (v.ry !== undefined) t.ry = v.ry;
    if (v.rz !== undefined) t.rz = v.rz;
    if (v.autoOrient) t.autoOrient = v.autoOrient;
    if (t.position || t.poi || t.orientation || t.rx !== undefined || t.ry !== undefined || t.rz !== undefined || t.autoOrient) {
      T.modules.scene.setTransform({ ref: T.refOf(L), values: t });
    }
  }

  function addLight(c, v) {
    var L = c.layers.addLight(v.name || 'Light', [c.width / 2, c.height / 2]);
    L.lightType = typeOf(v.type || 'point');
    T.setTag(L, 'light');
    apply(L, c, v);
    return L;
  }

  L_.add = function (a) {
    var c = T.requireComp(), L;
    T.undo('Add light', function () { L = addLight(c, a.values || { type: a.type || 'point' }); });
    return readLight(L, c);
  };

  L_.set = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    T.undo('Light', function () { apply(L, c, a.values || {}); });
    return readLight(L, c);
  };

  // Presets are defined in the panel as offsets from the comp center; replaces studio lights only.
  L_.applyPreset = function (a) {
    var c = T.requireComp(), lights = a.lights || [], i, ctr = T.center(c), v, made = [];
    T.undo('Lighting preset', function () {
      if (a.replace !== false) {
        var old = T.layersByRole(c, 'light');
        for (i = 0; i < old.length; i++) { old[i].locked = false; old[i].remove(); }
      }
      for (i = 0; i < lights.length; i++) {
        v = {};
        for (var k in lights[i]) if (lights[i].hasOwnProperty(k)) v[k] = lights[i][k];
        if (v.offset) v.position = [ctr[0] + v.offset[0], ctr[1] + v.offset[1], ctr[2] + v.offset[2]];
        if (!v.poi && v.type !== 'ambient') v.poi = ctr;
        delete v.offset;
        made.push(T.refOf(addLight(c, v)));
      }
      // light layers go to the top so they never hide behind a background
      for (i = 0; i < made.length; i++) T.layerByRef(c, made[i]).moveToBeginning();
    });
    return L_.list();
  };

  /* ---------- camera ---------- */
  function camOpts(L) { return L.property('ADBE Camera Options Group'); }
  var CKEYS = {
    zoom: ['ADBE Camera Zoom', 'Zoom'],
    dof: ['ADBE Camera Depth of Field', 'Depth of Field'],
    focus: ['ADBE Camera Focus Distance', 'Focus Distance'],
    aperture: ['ADBE Camera Aperture', 'Aperture'],
    blur: ['ADBE Camera Blur Level', 'Blur Level']
  };
  var FILM = 36; // mm, AE default horizontal film size

  function findCam(c, ref) {
    if (ref) return T.requireLayer(c, ref);
    var i, L;
    for (i = 1; i <= c.numLayers; i++) { L = c.layer(i); if (T.isCamera(L) && L.enabled) return L; }
    return null;
  }

  function readCam(L, c) {
    var g = camOpts(L), r = T.modules.scene.transformOf(L, c), k, p;
    r.ref = T.refOf(L); r.name = L.name; r.enabled = L.enabled;
    for (k in CKEYS) { if (!CKEYS.hasOwnProperty(k)) continue; p = T.prop(g, CKEYS[k]); if (p) r[k] = T.getVal(p, c); }
    r.dof = !!r.dof;
    r.focal = r.zoom * FILM / c.width;
    r.fov = 2 * Math.atan((c.width / 2) / r.zoom) * 180 / Math.PI;
    return r;
  }

  C_.get = function () {
    var c = T.activeComp();
    if (!c) return null;
    var L = findCam(c, null);
    return L ? readCam(L, c) : null;
  };

  C_.list = function () {
    var c = T.activeComp(), out = [], i;
    if (!c) return [];
    for (i = 1; i <= c.numLayers; i++) if (T.isCamera(c.layer(i))) out.push({ ref: T.refOf(c.layer(i)), name: c.layer(i).name, enabled: c.layer(i).enabled });
    return out;
  };

  C_.ensure = function () {
    var c = T.requireComp(), L = findCam(c, null);
    if (L) return readCam(L, c);
    T.undo('Create camera', function () {
      L = c.layers.addCamera('Tilago Camera', [c.width / 2, c.height / 2]);
      T.setTag(L, 'camera');
    });
    return readCam(L, c);
  };

  // values: position, poi, rx/ry/rz, orientation, autoOrient, zoom | focal | fov, dof, focus, aperture, blur
  C_.set = function (a) {
    var c = T.requireComp(), L = findCam(c, a.ref), v = a.values || {}, g, k, p, zoom;
    if (!L) T.fail('NO_CAMERA', 'Create a camera first');
    T.undo('Camera', function () {
      g = camOpts(L);
      if (v.focal !== undefined) zoom = T.num(v.focal, 50) * c.width / FILM;
      else if (v.fov !== undefined) zoom = (c.width / 2) / Math.tan(T.clamp(T.num(v.fov, 40), 1, 170) * Math.PI / 360);
      else if (v.zoom !== undefined) zoom = T.num(v.zoom, 1000);
      if (zoom !== undefined) T.setVal(T.prop(g, CKEYS.zoom), Math.max(1, zoom), c);
      for (k in CKEYS) {
        if (!CKEYS.hasOwnProperty(k) || k === 'zoom' || v[k] === undefined) continue;
        p = T.prop(g, CKEYS[k]);
        if (p) T.setVal(p, k === 'dof' ? (v[k] ? 1 : 0) : v[k], c);
      }
      var t = {}, any = false;
      var tk = ['position', 'poi', 'orientation', 'rx', 'ry', 'rz', 'autoOrient'];
      for (k = 0; k < tk.length; k++) if (v[tk[k]] !== undefined) { t[tk[k]] = v[tk[k]]; any = true; }
      if (any) T.modules.scene.setTransform({ ref: T.refOf(L), values: t });
    });
    return readCam(L, c);
  };

  // Focus distance = distance from camera to the selected object (real AE values).
  C_.focusOn = function (a) {
    var c = T.requireComp(), L = findCam(c, null), O = T.requireLayer(c, a.ref);
    if (!L) T.fail('NO_CAMERA', 'Create a camera first');
    var cp = T.posOf(L, c), op = T.posOf(O, c);
    var d = Math.sqrt(Math.pow(cp[0] - op[0], 2) + Math.pow(cp[1] - op[1], 2) + Math.pow(cp[2] - op[2], 2));
    T.undo('Camera focus', function () {
      T.setVal(T.prop(camOpts(L), CKEYS.focus), d, c);
      T.setVal(T.prop(camOpts(L), CKEYS.dof), 1, c);
    });
    return readCam(L, c);
  };

  T.modules.lights = L_;
  T.modules.camera = C_;
})($.global.TS3D);
