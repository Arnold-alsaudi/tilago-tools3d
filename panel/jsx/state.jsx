/* Whole-scene save / load. The panel stores the JSON on disk; this module reads and rebuilds scenes. */

(function (T) {
  var M = {};

  M.exportScene = function () {
    var c = T.requireComp(), out = { version: T.VERSION, comp: T.modules.caps.comp(), objects: [], lights: [], camera: null, bg: null, env: null }, i, L, ref;
    for (i = 1; i <= c.numLayers; i++) {
      L = c.layer(i);
      if (!(T.isText(L) && L.threeDLayer)) continue;
      ref = T.refOf(L);
      out.objects.push({
        name: L.name,
        text: T.modules.text.read({ ref: ref }),
        geo: T.modules.geometry.get({ ref: ref }),
        mat: T.modules.materials.get({ ref: ref }),
        transform: T.modules.scene.transformOf(L, c)
      });
    }
    out.lights = T.modules.lights.list();
    out.camera = T.modules.camera.get();
    out.bg = T.modules.background.get();
    out.env = T.modules.environment.get();
    return out;
  };

  // Rebuilds a saved scene in the active comp (or a new one). Text objects are created fresh.
  M.importScene = function (a) {
    var s = a.scene, i, o, r, made = [];
    if (!s || !s.objects) T.fail('BAD_SCENE', 'This scene file is not valid');
    T.undo('Load scene', function () {
      var c = T.ensureScene({ compName: s.comp ? s.comp.name : null });
      if (a.renderer) T.applyRenderer(c, a.renderer);
      else if (s.comp && s.comp.renderer) T.applyRenderer(c, s.comp.renderer);
      for (i = 0; i < s.objects.length; i++) {
        o = s.objects[i];
        var t = o.text || {};
        r = T.modules.text.create({ text: t.text, font: t.font, size: t.size, tracking: t.tracking, leading: t.leading, align: t.align, rtl: t.rtl, fill: t.fill });
        made.push(r.ref);
        if (o.geo && o.geo.supported) T.modules.geometry.set({ ref: r.ref, values: o.geo });
        if (o.mat) {
          var surf = {}, k;
          for (k in o.mat.surfaces) if (o.mat.surfaces.hasOwnProperty(k)) surf[k] = o.mat.surfaces[k];
          T.modules.materials.set({ ref: r.ref, values: { layer: o.mat.layer, surfaces: surf } });
        }
        if (o.transform) {
          var tv = {}, tk = ['position', 'orientation', 'rx', 'ry', 'rz', 'scale', 'anchor', 'opacity'];
          for (k = 0; k < tk.length; k++) if (o.transform[tk[k]] !== undefined) tv[tk[k]] = o.transform[tk[k]];
          T.modules.scene.setTransform({ ref: r.ref, values: tv });
        }
      }
      if (s.lights && s.lights.length) {
        var ls = [];
        for (i = 0; i < s.lights.length; i++) {
          var l = s.lights[i], v = {};
          for (var lk in l) if (l.hasOwnProperty(lk) && lk !== 'ref') v[lk] = l[lk];
          ls.push(v);
        }
        T.modules.lights.applyPreset({ lights: ls, replace: true });
      }
      if (s.camera) {
        T.modules.camera.ensure();
        var cv = {}, ck = ['position', 'poi', 'orientation', 'rx', 'ry', 'rz', 'autoOrient', 'zoom', 'dof', 'focus', 'aperture', 'blur'];
        for (i = 0; i < ck.length; i++) if (s.camera[ck[i]] !== undefined) cv[ck[i]] = s.camera[ck[i]];
        T.modules.camera.set({ values: cv });
      }
      if (s.bg && s.bg.type !== 'image' && s.bg.type !== 'video') T.modules.background.set({ values: s.bg });
      else if (s.bg && s.bg.file && new File(s.bg.file).exists) {
        var bv = {}; for (var bk in s.bg) if (s.bg.hasOwnProperty(bk)) bv[bk] = s.bg[bk];
        T.modules.background.set({ values: bv });
      }
      if (s.env && s.env.file && new File(s.env.file).exists) {
        T.modules.environment.set({ values: { file: s.env.file, exposure: s.env.exposure, brightness: s.env.brightness, contrast: s.env.contrast, saturation: s.env.saturation, rotation: s.env.rotation } });
      }
    });
    return { refs: made };
  };

  T.modules.state = M;
})($.global.TS3D);
