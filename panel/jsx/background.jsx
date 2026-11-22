/* Background studio (2D layer behind the scene, never reflected) and
   Environment studio (HDRI / image used for reflections and image based light). */

(function (T) {
  var B = {}, E = {};
  var RAMP = 'ADBE Ramp', BLUR = 'ADBE Gaussian Blur 2';

  function tr(L, k) { return L.property('ADBE Transform Group').property(k); }
  function fx(L) { return L.property('ADBE Effect Parade'); }
  function effect(L, mn, create) {
    var p = fx(L), i;
    for (i = 1; i <= p.numProperties; i++) if (p.property(i).matchName === mn) return p.property(i);
    if (!create) return null;
    if (!p.canAddProperty(mn)) return null;
    return p.addProperty(mn);
  }
  function eprop(e, idx, names) {
    var p = null;
    try { p = e.property(idx); } catch (x) {}
    return p || T.prop(e, names);
  }

  function findBg(c) { var l = T.layersByRole(c, 'bg'); return l.length ? l[0] : null; }

  function importFile(path) {
    var f = new File(path);
    if (!f.exists) T.fail('NO_FILE', 'File not found');
    var io = new ImportOptions(f);
    if (!io.canImportAs(ImportAsType.FOOTAGE)) T.fail('BAD_FILE', 'This file type cannot be imported');
    var item = app.project.importFile(io);
    var folder = T.findFolder('Tilago 3D Assets', true);
    item.parentFolder = folder;
    return item;
  }

  B.readBg = function (L, c) {
    if (!L) return null;
    var r = { ref: T.refOf(L), enabled: L.enabled, type: 'solid' }, ramp = effect(L, RAMP, false), blur = effect(L, BLUR, false);
    var m = /bgtype=(\w+)/.exec(L.comment || '');
    if (m) r.type = m[1];
    if (!L.enabled) r.type = 'transparent';
    try { if (L.source && L.source.mainSource instanceof SolidSource) r.color = T.toArr(L.source.mainSource.color); } catch (e) {}
    if (ramp) {
      r.g1 = T.toArr(eprop(ramp, 2, ['Start Color']).value);
      r.g2 = T.toArr(eprop(ramp, 4, ['End Color']).value);
      r.radial = eprop(ramp, 5, ['Ramp Shape']).value === 2;
      var s = eprop(ramp, 1, ['Start of Ramp']).value, e2 = eprop(ramp, 3, ['End of Ramp']).value;
      r.angle = Math.round(Math.atan2(e2[1] - s[1], e2[0] - s[0]) * 180 / Math.PI);
    }
    r.blur = blur ? eprop(blur, 1, ['Blurriness']).value : 0;
    r.opacity = T.getVal(tr(L, 'ADBE Opacity'), c);
    var sc = T.toArr(T.getVal(tr(L, 'ADBE Scale'), c));
    r.scale = sc[0];
    r.position = T.toArr(T.getVal(tr(L, 'ADBE Position'), c));
    r.rotation = T.getVal(tr(L, 'ADBE Rotate Z'), c);
    try { r.file = L.source && L.source.file ? L.source.file.fsName : null; } catch (e3) {}
    return r;
  };

  B.get = function () {
    var c = T.activeComp();
    if (!c) return null;
    return B.readBg(findBg(c), c);
  };

  function makeSolid(c, rgb) {
    var L = c.layers.addSolid(rgb || [0.05, 0.04, 0.08], 'Tilago Background', c.width, c.height, c.pixelAspect, c.duration);
    return L;
  }

  // values: type (solid|gradient|image|video|transparent), color, g1, g2, angle, radial, opacity, blur, scale, position, rotation, file
  B.set = function (a) {
    var c = T.requireComp(), v = a.values || {}, L;
    T.undo('Background', function () {
      L = findBg(c);
      var type = v.type || (L ? B.readBg(L, c).type : 'solid');
      var needsFile = type === 'image' || type === 'video';
      var cur = L ? (/bgtype=(\w+)/.exec(L.comment || '') || [0, 'solid'])[1] : null;

      // switching between solid-based and file-based backgrounds rebuilds the single bg layer
      if (L && ((needsFile && v.file) || (!needsFile && (cur === 'image' || cur === 'video') && type !== 'transparent'))) {
        L.locked = false; L.remove(); L = null;
      }
      if (!L) {
        if (needsFile) {
          if (!v.file) T.fail('NO_FILE', 'Choose a file first');
          L = c.layers.add(importFile(v.file));
          fitCover(L, c);
        } else {
          L = makeSolid(c, v.color);
        }
        L.name = 'Tilago Background';
        T.setTag(L, 'bg');
        L.moveToEnd();
      }
      L.threeDLayer = false;
      L.comment = L.comment.replace(/\n?bgtype=\w+/g, '') + '\nbgtype=' + (type === 'transparent' ? (cur || 'solid') : type);
      L.enabled = type !== 'transparent';
      if (type === 'transparent') return;

      if ((type === 'solid' || type === 'gradient') && v.color && L.source && L.source.mainSource instanceof SolidSource) {
        L.source.mainSource.color = [v.color[0], v.color[1], v.color[2]];
      }
      var ramp = effect(L, RAMP, type === 'gradient');
      if (type !== 'gradient' && ramp) { ramp.remove(); ramp = null; }
      if (ramp) {
        if (v.g1) T.setColor(eprop(ramp, 2, ['Start Color']), v.g1, c);
        if (v.g2) T.setColor(eprop(ramp, 4, ['End Color']), v.g2, c);
        if (v.radial !== undefined) T.setVal(eprop(ramp, 5, ['Ramp Shape']), v.radial ? 2 : 1, c);
        if (v.angle !== undefined || v.radial !== undefined) {
          var ang = (v.angle !== undefined ? v.angle : B.readBg(L, c).angle || 90) * Math.PI / 180;
          var cx = c.width / 2, cy = c.height / 2, rad = Math.sqrt(cx * cx + cy * cy);
          var radial = eprop(ramp, 5, ['Ramp Shape']).value === 2;
          if (radial) {
            T.setVal(eprop(ramp, 1, ['Start of Ramp']), [cx, cy], c);
            T.setVal(eprop(ramp, 3, ['End of Ramp']), [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad], c);
          } else {
            T.setVal(eprop(ramp, 1, ['Start of Ramp']), [cx - Math.cos(ang) * rad, cy - Math.sin(ang) * rad], c);
            T.setVal(eprop(ramp, 3, ['End of Ramp']), [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad], c);
          }
        }
      }
      if (v.blur !== undefined) {
        var bl = effect(L, BLUR, v.blur > 0);
        if (bl) {
          T.setVal(eprop(bl, 1, ['Blurriness']), Math.max(0, v.blur), c);
          try { T.setVal(eprop(bl, 3, ['Repeat Edge Pixels']), 1, c); } catch (e) {}
        }
      }
      if (v.opacity !== undefined) T.setVal(tr(L, 'ADBE Opacity'), T.clamp(v.opacity, 0, 100), c);
      if (v.scale !== undefined) T.setVal(tr(L, 'ADBE Scale'), [v.scale, v.scale], c);
      if (v.position) T.setVal(tr(L, 'ADBE Position'), [v.position[0], v.position[1]], c);
      if (v.rotation !== undefined) T.setVal(tr(L, 'ADBE Rotate Z'), v.rotation, c);
      if (v.fit) fitCover(L, c);
    });
    return B.readBg(findBg(c), c);
  };

  function fitCover(L, c) {
    try {
      var s = Math.max(c.width / L.source.width, c.height / L.source.height) * 100;
      tr(L, 'ADBE Scale').setValue([s, s]);
      tr(L, 'ADBE Position').setValue([c.width / 2, c.height / 2]);
    } catch (e) {}
  }

  /* ---------- environment ---------- */
  // The environment image lives in its own precomp, so exposure / contrast / saturation / rotation
  // are real effects that both the reflections and the environment light see.
  function envComp() { return T.findComp('TS3D:envcomp'); }
  function envLayer(c) { var l = T.layersByRole(c, 'env'); return l.length ? l[0] : null; }
  function envLight(c) {
    var i, L;
    for (i = 1; i <= c.numLayers; i++) {
      L = c.layer(i);
      try { if (T.isLight(L) && L.lightType === LightType.ENVIRONMENT) return L; } catch (e) {}
    }
    return null;
  }
  function hasEnvLight() { try { return typeof LightType !== 'undefined' && LightType.ENVIRONMENT !== undefined; } catch (e) { return false; } }

  function envFx(ec) {
    var L = ec.layer(1);
    return {
      exposure: effect(L, 'ADBE Exposure2', true),
      bc: effect(L, 'ADBE Brightness & Contrast 2', true),
      hs: effect(L, 'ADBE HUE SATURATION', true),
      offset: effect(L, 'ADBE Offset', true),
      layer: L
    };
  }

  function readEnv(c) {
    var ec = envComp(), EL = envLayer(c), LL = envLight(c), r = { mode: hasEnvLight() ? 'light' : 'layer', active: !!(EL || LL) };
    if (!ec) return r;
    var f = envFx(ec);
    try { r.file = f.layer.source.file.fsName; } catch (e) {}
    try { r.exposure = T.prop(f.exposure, ['Exposure']).value; } catch (e1) {}
    try { r.brightness = T.prop(f.bc, ['Brightness']).value; r.contrast = T.prop(f.bc, ['Contrast']).value; } catch (e2) {}
    try { r.saturation = T.prop(f.hs, ['Master Saturation']).value; } catch (e3) {}
    try { var sh = T.prop(f.offset, ['Shift Center To']).value; r.rotation = Math.round(((sh[0] - ec.width / 2) / ec.width) * 360); } catch (e4) {}
    if (LL) {
      r.lightRef = T.refOf(LL);
      r.lightProps = genericProps(LL.property('ADBE Light Options Group'), c);
      r.enabled = LL.enabled;
    }
    if (EL) { r.layerRef = T.refOf(EL); r.enabled = EL.enabled; }
    return r;
  }

  // Exposes whatever the environment light really has, with AE's own names (no invented controls).
  function genericProps(g, c) {
    var out = [], i, p, t, v;
    for (i = 1; i <= g.numProperties; i++) {
      p = g.property(i);
      if (p.propertyType !== PropertyType.PROPERTY) continue;
      t = p.propertyValueType;
      try { v = T.toArr(T.getVal(p, c)); } catch (e) { continue; }
      if (t === PropertyValueType.OneD || t === PropertyValueType.COLOR) {
        out.push({ index: i, name: p.name, match: p.matchName, type: t === PropertyValueType.COLOR ? 'color' : 'num', value: v,
                   min: p.hasMin ? p.minValue : null, max: p.hasMax ? p.maxValue : null, menu: p.isDropdownEffect ? true : false });
      }
    }
    return out;
  }

  E.get = function () { var c = T.activeComp(); return c ? readEnv(c) : null; };

  E.set = function (a) {
    var c = T.requireComp(), v = a.values || {}, ec = envComp(), f, notes = [];
    T.undo('Environment', function () {
      if (v.file) {
        var item = importFile(v.file);
        if (!ec) {
          ec = app.project.items.addComp('Tilago Environment', item.width, item.height, 1, c.duration, c.frameRate);
          ec.comment = 'TS3D:envcomp';
          ec.parentFolder = T.findFolder('Tilago 3D Assets', true);
          ec.layers.add(item);
        } else {
          ec.width = item.width; ec.height = item.height;
          ec.layer(1).replaceSource(item, false);
        }
        var s = Math.max(ec.width / item.width, ec.height / item.height) * 100;
        ec.layer(1).property('ADBE Transform Group').property('ADBE Scale').setValue([s, s]);
        ec.layer(1).property('ADBE Transform Group').property('ADBE Position').setValue([ec.width / 2, ec.height / 2]);
        try { T.prop(envFx(ec).offset, ['Blend With Original']).setValue(0); } catch (eB) {}
      }
      if (!ec) T.fail('NO_ENV', 'Import an HDRI or environment image first');
      f = envFx(ec);
      if (v.exposure !== undefined) T.prop(f.exposure, ['Exposure']).setValue(v.exposure);
      if (v.brightness !== undefined) T.prop(f.bc, ['Brightness']).setValue(v.brightness);
      if (v.contrast !== undefined) T.prop(f.bc, ['Contrast']).setValue(v.contrast);
      if (v.saturation !== undefined) T.prop(f.hs, ['Master Saturation']).setValue(v.saturation);
      if (v.rotation !== undefined) {
        var x = ec.width / 2 + (((v.rotation % 360) + 360) % 360) / 360 * ec.width;
        T.prop(f.offset, ['Shift Center To']).setValue([x, ec.height / 2]);
      }

      var EL = envLayer(c), LL = envLight(c);
      if (!EL) {
        EL = c.layers.add(ec);
        EL.name = 'Tilago Environment';
        T.setTag(EL, 'env');
      }
      if (hasEnvLight()) {
        // Advanced 3D: environment light uses the precomp as its source; the source layer itself stays hidden
        EL.enabled = false;
        if (!LL) {
          LL = c.layers.addLight('Tilago Environment Light', [c.width / 2, c.height / 2]);
          LL.lightType = LightType.ENVIRONMENT;
          T.setTag(LL, 'envlight');
        }
        var g = LL.property('ADBE Light Options Group'), i, p, linked = false;
        for (i = 1; i <= g.numProperties; i++) {
          p = g.property(i);
          try { if (p.propertyValueType === PropertyValueType.LAYER_INDEX) { p.setValue(EL.index); linked = true; break; } } catch (e) {}
        }
        if (!linked) notes.push('envSourceManual');
        if (v.enabled !== undefined) LL.enabled = !!v.enabled;
        if (v.lightProps) {
          for (i = 0; i < v.lightProps.length; i++) {
            p = g.property(v.lightProps[i].index);
            if (!p) continue;
            try { if (v.lightProps[i].type === 'color') T.setColor(p, v.lightProps[i].value, c); else T.setVal(p, v.lightProps[i].value, c); } catch (e5) {}
          }
        }
      } else {
        // Ray-traced / Cinema 4D: AE "Environment Layer" switch
        EL.threeDLayer = true;
        var ok = false;
        try { EL.environmentLayer = true; ok = EL.environmentLayer === true; } catch (e6) {}
        if (!ok) notes.push('envLayerManual');
        if (v.enabled !== undefined) EL.enabled = !!v.enabled;
      }
      EL.moveToEnd();
      var bg = findBg(c);
      if (bg) bg.moveToEnd();
    });
    var r = readEnv(c);
    r.notes = notes;
    return r;
  };

  E.remove = function () {
    var c = T.requireComp();
    T.undo('Remove environment', function () {
      var EL = envLayer(c), LL = envLight(c);
      if (EL) EL.remove();
      if (LL) LL.remove();
    });
    return readEnv(c);
  };

  E.setProjectBits = function (a) {
    T.undo('Project bit depth', function () { app.project.bitsPerChannel = a.bits; });
    return app.project.bitsPerChannel;
  };

  T.modules.background = B;
  T.modules.environment = E;
})($.global.TS3D);
