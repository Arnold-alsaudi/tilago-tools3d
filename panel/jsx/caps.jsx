/* Capability detection: what this After Effects build and its renderers really support.
   Nothing is shown in the panel as "supported" unless this probe proved it on a real layer. */

(function (T) {
  var M = {};

  T.RENDERER_NAMES = {
    'ADBE Advanced 3d': 'Classic 3D',
    'ADBE Picasso': 'Ray-traced 3D',
    'ADBE Calder': 'Cinema 4D',
    'ADBE Ernst': 'Advanced 3D'
  };

  // Geometry options (layer > Geometry Options)
  T.GEO = {
    group: ['ADBE Extrsn Options Group', 'Geometry Options'],
    bevelStyle: ['ADBE Bevel Styles', 'Bevel Style'],
    bevelDepth: ['ADBE Bevel Depth', 'Bevel Depth'],
    holeBevel: ['ADBE Hole Bevel Depth', 'Hole Bevel Depth'],
    depth: ['ADBE Extrsn Depth', 'Extrusion Depth']
  };

  // Material options (layer > Material Options)
  T.MAT = {
    group: ['ADBE Material Options Group', 'Material Options'],
    castsShadows: ['ADBE Casts Shadows', 'Casts Shadows'],
    lightTrans: ['ADBE Light Transmission', 'Light Transmission'],
    acceptsShadows: ['ADBE Accepts Shadows', 'Accepts Shadows'],
    acceptsLights: ['ADBE Accepts Lights', 'Accepts Lights'],
    appearsInRefl: ['ADBE Appears in Reflections', 'Appears in Reflections'],
    ambient: ['ADBE Ambient Coefficient', 'Ambient'],
    diffuse: ['ADBE Diffuse Coefficient', 'Diffuse'],
    specular: ['ADBE Specular Coefficient', 'Specular Intensity'],
    shininess: ['ADBE Shininess Coefficient', 'Specular Shininess'],
    metal: ['ADBE Metal Coefficient', 'Metal'],
    reflection: ['ADBE Reflection Coefficient', 'Reflection Intensity'],
    gloss: ['ADBE Glossiness Coefficient', 'Reflection Sharpness'],
    fresnel: ['ADBE Fresnel Coefficient', 'Reflection Rolloff'],
    transparency: ['ADBE Transparency Coefficient', 'Transparency'],
    transRolloff: ['ADBE Transp Rolloff', 'Transparency Rolloff'],
    ior: ['ADBE Index of Refraction', 'Index of Refraction']
  };

  // Per-surface text animator properties (extruded text only)
  T.SURFACES = ['Front', 'Bevel', 'Side', 'Back'];
  T.SURF_PROPS = {
    color: 'RGB', opacity: 'Opacity', ambient: 'Ambient', diffuse: 'Diffuse', specular: 'Specular',
    shininess: 'Shininess', metal: 'Metal', reflection: 'Reflection', gloss: 'Gloss', fresnel: 'Fresnel',
    transparency: 'Xparency', transRolloff: 'XparRoll', ior: 'IOR'
  };
  T.surfMatch = function (surface, key) { return 'ADBE 3DText ' + surface + ' ' + T.SURF_PROPS[key]; };

  function hasGlobal(name) { try { return typeof eval(name) !== 'undefined'; } catch (e) { return false; } }

  M.info = function () {
    var e3d = null, i, ef;
    try {
      for (i = 0; i < app.effects.length; i++) {
        ef = app.effects[i];
        if (ef.matchName === 'VIDEOCOPILOT 3DArray' || (/element/i.test(ef.displayName) && /video ?copilot/i.test(ef.category))) {
          e3d = { matchName: ef.matchName, name: ef.displayName };
          break;
        }
      }
    } catch (x) {}
    var proj = null;
    try { proj = { bits: app.project.bitsPerChannel, file: app.project.file ? app.project.file.name : null }; } catch (x2) {}
    return {
      version: app.version,
      build: app.buildName,
      lang: app.isoLanguage,
      fontsApi: !!(app.fonts && app.fonts.allFonts),
      envLight: hasGlobal('LightType') && LightType.ENVIRONMENT !== undefined,
      paragraphDirection: hasGlobal('ParagraphDirection'),
      composerEngine: hasGlobal('ComposerEngine'),
      e3d: e3d,
      project: proj,
      comp: compInfo(T.activeComp())
    };
  };

  function compInfo(c) {
    if (!c) return null;
    return { name: c.name, w: c.width, h: c.height, fps: c.frameRate, dur: c.duration, renderer: c.renderer,
             rendererName: T.RENDERER_NAMES[c.renderer] || c.renderer, renderers: T.toArr(c.renderers) };
  }
  M.comp = function () { return compInfo(T.activeComp()); };

  function trySet(p, v) {
    if (!p) return false;
    try { p.setValue(v); return true; } catch (e) { return false; }
  }

  // Real probe: build a temp comp, try every property with every renderer, then delete it.
  M.probe = function () {
    var out = { renderers: {} }, comp, L, r, i, rr, k, geo, mat, res, surf, s, anim, props, mn, p;
    T.undo('Capability check', function () {
      comp = app.project.items.addComp('__TS3D_probe__', 400, 400, 1, 1, 30);
      try {
        L = comp.layers.addText('Ab');
        L.threeDLayer = true;
        rr = T.toArr(comp.renderers);
        for (i = 0; i < rr.length; i++) {
          r = rr[i];
          try { comp.renderer = r; } catch (e0) { continue; }
          res = { name: T.RENDERER_NAMES[r] || r, geo: {}, mat: {}, surf: {} };
          geo = T.prop(L, T.GEO.group);
          res.geo.depth = trySet(T.prop(geo, T.GEO.depth), 20);
          res.geo.bevelStyle = trySet(T.prop(geo, T.GEO.bevelStyle), 2);
          res.geo.bevelDepth = trySet(T.prop(geo, T.GEO.bevelDepth), 2);
          res.geo.holeBevel = trySet(T.prop(geo, T.GEO.holeBevel), 50);
          if (r === 'ADBE Advanced 3d') { res.geo = { depth: false, bevelStyle: false, bevelDepth: false, holeBevel: false }; }
          mat = T.prop(L, T.MAT.group);
          for (k in T.MAT) {
            if (k === 'group' || !T.MAT.hasOwnProperty(k)) continue;
            p = T.prop(mat, T.MAT[k]);
            res.mat[k] = p ? trySet(p, p.value) : false;
          }
          // per-surface animator props (only meaningful when extrusion works)
          if (res.geo.depth) {
            anim = L.property('ADBE Text Properties').property('ADBE Text Animators').addProperty('ADBE Text Animator');
            for (s = 0; s < T.SURFACES.length; s++) {
              surf = T.SURFACES[s];
              res.surf[surf] = {};
              for (k in T.SURF_PROPS) {
                if (!T.SURF_PROPS.hasOwnProperty(k)) continue;
                mn = T.surfMatch(surf, k);
                props = L.property('ADBE Text Properties').property('ADBE Text Animators').property(1).property('ADBE Text Animator Properties');
                res.surf[surf][k] = false;
                try { if (props.canAddProperty(mn)) { props.addProperty(mn); res.surf[surf][k] = true; } } catch (e1) {}
              }
            }
            try { L.property('ADBE Text Properties').property('ADBE Text Animators').property(1).remove(); } catch (e2) {}
          }
          out.renderers[r] = res;
        }
      } finally {
        try { comp.remove(); } catch (e3) {}
      }
    });
    out.version = app.version;
    out.best = M.bestRenderer(out);
    return out;
  };

  // Prefer the renderer that really extrudes; Advanced 3D first (GPU), then Cinema 4D, then Ray-traced.
  M.bestRenderer = function (probe) {
    var order = ['ADBE Ernst', 'ADBE Calder', 'ADBE Picasso'], i, k;
    for (i = 0; i < order.length; i++) {
      if (probe.renderers[order[i]] && probe.renderers[order[i]].geo.depth) return order[i];
    }
    for (k in probe.renderers) if (probe.renderers.hasOwnProperty(k) && probe.renderers[k].geo.depth) return k;
    return null;
  };

  M.setRenderer = function (a) {
    var c = T.requireComp();
    T.undo('Renderer', function () { c.renderer = a.renderer; });
    return compInfo(c);
  };

  // Dumps any layer's property tree (for support / diagnostics).
  M.dump = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), lines = [];
    function walk(g, depth) {
      var i, p, v;
      for (i = 1; i <= g.numProperties; i++) {
        p = g.property(i);
        v = '';
        if (p.propertyType === PropertyType.PROPERTY) { try { v = ' = ' + T.stringify(T.toArr(p.value)); } catch (e) { v = ''; } }
        lines.push(new Array(depth + 1).join('  ') + p.name + '  [' + p.matchName + ']' + v);
        if (p.propertyType !== PropertyType.PROPERTY && depth < 6) walk(p, depth + 1);
      }
    }
    walk(L, 0);
    return lines.join('\n');
  };

  T.modules.caps = M;
})($.global.TS3D);
