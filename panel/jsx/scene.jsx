/* Scene setup: object list, transforms, rename / duplicate / delete / hide / lock / group,
   and a full snapshot used by the panel's 3D viewport. */

(function (T) {
  var M = {};

  function tr(L, key) { try { return L.property('ADBE Transform Group').property(key); } catch (e) { return null; } }

  function roleOf(L) {
    var t = T.tagOf(L);
    if (t) return t.role;
    if (T.isCamera(L)) return 'camera';
    if (T.isLight(L)) return 'light';
    if (T.isText(L)) return 'text';
    if (T.isShape(L)) return 'shape';
    return 'layer';
  }

  function posOf(L, c) {
    var p = tr(L, 'ADBE Position');
    if (!p) return null;
    if (p.dimensionsSeparated) {
      return [T.getVal(tr(L, 'ADBE Position_0'), c), T.getVal(tr(L, 'ADBE Position_1'), c), T.getVal(tr(L, 'ADBE Position_2'), c) || 0];
    }
    var v = T.toArr(T.getVal(p, c));
    if (v.length < 3) v.push(0);
    return v;
  }
  function setPos(L, c, v) {
    var p = tr(L, 'ADBE Position');
    if (p.dimensionsSeparated) {
      T.setVal(tr(L, 'ADBE Position_0'), v[0], c); T.setVal(tr(L, 'ADBE Position_1'), v[1], c); T.setVal(tr(L, 'ADBE Position_2'), v[2], c);
    } else T.setVal(p, v, c);
  }
  T.posOf = posOf; T.setPos = setPos;

  function transformOf(L, c) {
    var r = { position: posOf(L, c) };
    var keys = { orientation: 'ADBE Orientation', rx: 'ADBE Rotate X', ry: 'ADBE Rotate Y', rz: 'ADBE Rotate Z', scale: 'ADBE Scale', anchor: 'ADBE Anchor Point', opacity: 'ADBE Opacity', poi: 'ADBE Anchor Point' };
    var k, p;
    for (k in keys) {
      if (!keys.hasOwnProperty(k)) continue;
      if (k === 'poi' && !(T.isCamera(L) || T.isLight(L))) continue;
      if ((k === 'anchor' || k === 'scale' || k === 'opacity') && (T.isCamera(L) || T.isLight(L))) continue;
      p = tr(L, keys[k]);
      if (p) r[k] = T.toArr(T.getVal(p, c));
    }
    if (r.anchor && r.anchor.length < 3) r.anchor.push(0);
    if (r.scale && r.scale.length < 3) r.scale.push(100);
    try { r.autoOrient = L.autoOrient === AutoOrientType.CAMERA_OR_POINT_OF_INTEREST ? 'target' : 'free'; } catch (e) {}
    return r;
  }
  M.transformOf = transformOf;

  function item(L, c) {
    var t = T.tagOf(L);
    return {
      ref: T.refOf(L), index: L.index, name: L.name, role: roleOf(L), tagged: !!t,
      enabled: L.enabled, locked: L.locked, is3D: !!(L.threeDLayer || T.isCamera(L) || T.isLight(L)),
      parent: L.parent ? T.refOf(L.parent) : null, selected: L.selected,
      lightType: T.isLight(L) ? lightTypeName(L.lightType) : null
    };
  }
  function lightTypeName(t) {
    if (t === LightType.PARALLEL) return 'parallel';
    if (t === LightType.SPOT) return 'spot';
    if (t === LightType.POINT) return 'point';
    if (t === LightType.AMBIENT) return 'ambient';
    try { if (t === LightType.ENVIRONMENT) return 'environment'; } catch (e) {}
    return 'other';
  }
  T.lightTypeName = lightTypeName;

  // Lists every 3D-relevant layer of the active comp: studio objects, any 3D layer, cameras, lights.
  M.list = function () {
    var c = T.activeComp(), out = [], i, L;
    if (!c) return { comp: null, items: [] };
    for (i = 1; i <= c.numLayers; i++) {
      L = c.layer(i);
      if (T.tagOf(L) || L.threeDLayer || T.isCamera(L) || T.isLight(L) || T.isText(L) || T.isShape(L)) out.push(item(L, c));
    }
    return { comp: T.modules.caps.comp(), items: out };
  };

  M.getTransform = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    return transformOf(L, c);
  };

  // values: any of position, orientation, rx, ry, rz, scale, anchor, opacity, poi (all arrays/numbers)
  M.setTransform = function (a) {
    var c = T.requireComp(), refs = a.refs || [a.ref], v = a.values || {}, i, L;
    T.undo('Transform', function () {
      for (i = 0; i < refs.length; i++) {
        L = T.requireLayer(c, refs[i]);
        if (L.locked) T.fail('LOCKED', 'Layer is locked');
        if (v.autoOrient) {
          L.autoOrient = v.autoOrient === 'target' ? AutoOrientType.CAMERA_OR_POINT_OF_INTEREST : AutoOrientType.NO_AUTO_ORIENT;
        }
        if (v.position) setPos(L, c, v.position);
        if (v.orientation) T.setVal(tr(L, 'ADBE Orientation'), v.orientation, c);
        if (v.rx !== undefined) T.setVal(tr(L, 'ADBE Rotate X'), v.rx, c);
        if (v.ry !== undefined) T.setVal(tr(L, 'ADBE Rotate Y'), v.ry, c);
        if (v.rz !== undefined) T.setVal(tr(L, 'ADBE Rotate Z'), v.rz, c);
        if (v.scale && tr(L, 'ADBE Scale')) T.setVal(tr(L, 'ADBE Scale'), v.scale, c);
        if (v.anchor && !(T.isCamera(L) || T.isLight(L))) T.setVal(tr(L, 'ADBE Anchor Point'), v.anchor, c);
        if (v.poi && (T.isCamera(L) || T.isLight(L))) T.setVal(tr(L, 'ADBE Anchor Point'), v.poi, c);
        if (v.opacity !== undefined && tr(L, 'ADBE Opacity')) T.setVal(tr(L, 'ADBE Opacity'), v.opacity, c);
      }
    });
    return true;
  };

  M.centerAnchor = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    T.undo('Center anchor', function () {
      var z = T.toArr(tr(L, 'ADBE Anchor Point').value)[2] || 0;
      T.centerAnchor(L, c, z);
    });
    return transformOf(L, c);
  };

  M.resetTransform = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    T.undo('Reset transform', function () {
      setPos(L, c, T.center(c));
      T.setVal(tr(L, 'ADBE Orientation'), [0, 0, 0], c);
      T.setVal(tr(L, 'ADBE Rotate X'), 0, c); T.setVal(tr(L, 'ADBE Rotate Y'), 0, c); T.setVal(tr(L, 'ADBE Rotate Z'), 0, c);
      if (tr(L, 'ADBE Scale')) T.setVal(tr(L, 'ADBE Scale'), [100, 100, 100], c);
    });
    return transformOf(L, c);
  };

  M.rename = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    var n = String(a.name || '').replace(/^\s+|\s+$/g, '');
    if (!n) T.fail('EMPTY_NAME', 'Enter a name');
    T.undo('Rename', function () { L.name = n.substr(0, 128); });
    return item(L, c);
  };

  M.duplicate = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), D;
    T.undo('Duplicate', function () {
      D = L.duplicate();
      var t = T.tagOf(L);
      if (t) T.setTag(D, t.role);
      D.name = L.name + ' copy';
      if (a.offset) {
        var p = posOf(D, c);
        setPos(D, c, [p[0] + a.offset[0], p[1] + a.offset[1], p[2] + a.offset[2]]);
      }
    });
    return item(D, c);
  };

  M.remove = function (a) {
    var c = T.requireComp(), refs = a.refs || [a.ref], Ls = [], i;
    for (i = 0; i < refs.length; i++) Ls.push(T.requireLayer(c, refs[i]));
    T.undo('Delete', function () {
      for (i = 0; i < Ls.length; i++) {
        if (Ls[i].locked) Ls[i].locked = false;
        Ls[i].remove();
      }
    });
    return true;
  };

  M.setFlags = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    T.undo(a.enabled !== undefined ? 'Visibility' : 'Lock', function () {
      if (a.locked !== undefined && !a.locked) L.locked = false;
      if (a.enabled !== undefined) L.enabled = !!a.enabled;
      if (a.locked !== undefined && a.locked) L.locked = true;
    });
    return item(L, c);
  };

  M.select = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), sel = c.selectedLayers, i;
    for (i = 0; i < sel.length; i++) sel[i].selected = false;
    L.selected = true;
    return true;
  };

  // Groups objects under a 3D null placed at their average position.
  M.group = function (a) {
    var c = T.requireComp(), refs = a.refs || [], Ls = [], i, N, sum = [0, 0, 0], p;
    if (refs.length < 1) T.fail('NO_SELECTION', 'Select objects to group');
    for (i = 0; i < refs.length; i++) Ls.push(T.requireLayer(c, refs[i]));
    T.undo('Group', function () {
      for (i = 0; i < Ls.length; i++) { p = posOf(Ls[i], c); sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
      N = c.layers.addNull();
      N.threeDLayer = true;
      N.name = a.name || 'Group';
      T.setTag(N, 'group');
      N.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([50, 50, 0]);
      setPos(N, c, [sum[0] / Ls.length, sum[1] / Ls.length, sum[2] / Ls.length]);
      for (i = 0; i < Ls.length; i++) Ls[i].parent = N;
    });
    return item(N, c);
  };

  M.ungroup = function (a) {
    var c = T.requireComp(), N = T.requireLayer(c, a.ref), i;
    T.undo('Ungroup', function () {
      for (i = 1; i <= c.numLayers; i++) if (c.layer(i).parent === N) c.layer(i).parent = null;
      if (T.tagOf(N) && T.tagOf(N).role === 'group') N.remove();
    });
    return true;
  };

  M.setParent = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), P = a.parent ? T.requireLayer(c, a.parent) : null;
    T.undo('Parent', function () { L.parent = P; });
    return item(L, c);
  };

  // Real frame from AE's own renderer (needs "Allow Scripts to Write Files" in AE preferences).
  M.saveFrame = function (a) {
    var c = T.requireComp();
    if (typeof c.saveFrameToPng !== 'function') T.fail('NO_FRAME_API', 'This After Effects build cannot export frames from scripts');
    var f = new File(a.path);
    try { c.saveFrameToPng(c.time, f); }
    catch (e) { T.fail('FRAME_WRITE', String(e.message || e)); }
    return { path: f.fsName, w: c.width, h: c.height };
  };

  /* ---------- snapshot for the viewport ---------- */
  M.snapshot = function () {
    var c = T.activeComp(), out, i, L, role, o, td, g, cam = null, lights = [], objs = [], bg = null;
    if (!c) return { comp: null };
    for (i = 1; i <= c.numLayers; i++) {
      L = c.layer(i);
      role = roleOf(L);
      if (T.isCamera(L)) {
        if (!cam && L.enabled) {
          cam = transformOf(L, c);
          cam.ref = T.refOf(L);
          cam.zoom = T.getVal(L.property('ADBE Camera Options Group').property('ADBE Camera Zoom'), c);
        }
        continue;
      }
      if (T.isLight(L)) {
        if (!L.enabled) continue;
        o = transformOf(L, c);
        o.ref = T.refOf(L);
        o.type = lightTypeName(L.lightType);
        g = L.property('ADBE Light Options Group');
        o.color = T.toArr(T.getVal(T.prop(g, ['ADBE Light Color', 'Color']), c));
        o.intensity = T.getVal(T.prop(g, ['ADBE Light Intensity', 'Intensity']), c);
        o.cone = T.getVal(T.prop(g, ['ADBE Light Cone Angle', 'Cone Angle']), c);
        lights.push(o);
        continue;
      }
      if (role === 'bg') { bg = T.modules.background.readBg(L, c); continue; }
      if (!(T.isText(L) || T.isShape(L)) || !L.threeDLayer) continue;
      o = transformOf(L, c);
      o.ref = T.refOf(L);
      o.name = L.name;
      o.enabled = L.enabled;
      o.role = role;
      o.parent = L.parent ? T.refOf(L.parent) : null;
      o.geo = T.modules.geometry.get({ ref: o.ref });
      o.mat = T.modules.materials.get({ ref: o.ref });
      if (T.isText(L)) {
        td = L.property('ADBE Text Properties').property('ADBE Text Document').value;
        o.hash = [td.text, td.font, td.fontSize, td.tracking, T.stringify(T.toArr(T.getVal(tr(L, 'ADBE Anchor Point'), c)))].join('|');
      } else {
        o.hash = 'shape|' + L.name + '|' + L.index;
      }
      objs.push(o);
    }
    // parents (groups) so the viewport can compose transforms
    var parents = {};
    for (i = 0; i < objs.length; i++) addParents(c, objs[i].parent, parents);
    out = { comp: T.modules.caps.comp(), time: c.time, camera: cam, lights: lights, objects: objs, parents: parents, bg: bg };
    return out;
  };
  function addParents(c, ref, acc) {
    var L;
    while (ref && !acc[ref]) {
      L = T.layerByRef(c, ref);
      if (!L) return;
      acc[ref] = transformOf(L, c);
      acc[ref].parent = L.parent ? T.refOf(L.parent) : null;
      ref = acc[ref].parent;
    }
  }

  T.modules.scene = M;
})($.global.TS3D);
