/* Geometry (extrusion / bevel) and materials (layer material + per-surface text materials). */

(function (T) {
  var G = {}, M = {};
  var BEVELS = ['none', 'angular', 'concave', 'convex'];
  var SURF_ANIM = 'TS3D Surfaces';

  function geoGroup(L) { return T.prop(L, T.GEO.group); }
  function matGroup(L) { return T.prop(L, T.MAT.group); }
  function tr(L, key) { return L.property('ADBE Transform Group').property(key); }

  /* ---------- geometry ---------- */
  G.get = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), g = geoGroup(L), r = {};
    if (!g) return { supported: false };
    var bs = T.getVal(T.prop(g, T.GEO.bevelStyle), c);
    r.depth = T.getVal(T.prop(g, T.GEO.depth), c);
    r.bevelStyle = bs ? BEVELS[bs - 1] || 'none' : 'none';
    r.bevelDepth = T.getVal(T.prop(g, T.GEO.bevelDepth), c);
    r.holeBevel = T.getVal(T.prop(g, T.GEO.holeBevel), c);
    var sc = T.toArr(T.getVal(tr(L, 'ADBE Scale'), c));
    r.depthScale = sc ? sc[2] : 100;
    var ap = T.toArr(T.getVal(tr(L, 'ADBE Anchor Point'), c));
    var d = r.depth || 0;
    r.origin = !ap || Math.abs(ap[2]) < 0.01 ? 'front' : (Math.abs(ap[2] - d) < 0.01 ? 'back' : 'center');
    if (T.isText(L)) r.faces = readFaces(L, c);
    r.supported = true;
    return r;
  };

  G.set = function (a) {
    var c = T.requireComp(), refs = a.refs || [a.ref], i, L, g, v = a.values || {};
    T.undo('Geometry', function () {
      for (i = 0; i < refs.length; i++) {
        L = T.requireLayer(c, refs[i]);
        if (!L.threeDLayer) L.threeDLayer = true;
        g = geoGroup(L);
        if (!g) T.fail('NO_GEOMETRY', 'Extrusion is not available for this layer');
        if (v.depth !== undefined) T.setVal(T.prop(g, T.GEO.depth), Math.max(0, T.num(v.depth, 0)), c);
        if (v.bevelStyle !== undefined) {
          var idx = 0; for (var b = 0; b < BEVELS.length; b++) if (BEVELS[b] === v.bevelStyle) idx = b;
          T.setVal(T.prop(g, T.GEO.bevelStyle), idx + 1, c);
        }
        if (v.bevelDepth !== undefined) T.setVal(T.prop(g, T.GEO.bevelDepth), Math.max(0, T.num(v.bevelDepth, 0)), c);
        if (v.holeBevel !== undefined) T.setVal(T.prop(g, T.GEO.holeBevel), T.clamp(T.num(v.holeBevel, 100), 0, 100), c);
        if (v.depthScale !== undefined) {
          var s = T.toArr(T.getVal(tr(L, 'ADBE Scale'), c));
          T.setVal(tr(L, 'ADBE Scale'), [s[0], s[1], Math.max(0, T.num(v.depthScale, 100))], c);
        }
        if (v.origin !== undefined || v.depth !== undefined) applyOrigin(L, c, v.origin);
        if (v.faces && T.isText(L)) writeFaces(L, c, v.faces);
      }
    });
    return true;
  };

  // "Extrusion direction": where the layer plane sits inside the extruded body.
  function applyOrigin(L, c, origin) {
    var g = geoGroup(L), d = T.getVal(T.prop(g, T.GEO.depth), c) || 0;
    var ap = T.toArr(T.getVal(tr(L, 'ADBE Anchor Point'), c));
    if (!origin) {
      origin = Math.abs(ap[2]) < 0.01 ? 'front' : 'center';
      if (L.comment.indexOf('origin=back') >= 0) origin = 'back';
    }
    var z = origin === 'front' ? 0 : (origin === 'back' ? d : d / 2);
    var dz = z - (ap[2] || 0);
    if (Math.abs(dz) < 0.001) return;
    T.setVal(tr(L, 'ADBE Anchor Point'), [ap[0], ap[1], z], c);
    var pos = tr(L, 'ADBE Position');
    if (!pos.dimensionsSeparated) {
      var p = T.toArr(T.getVal(pos, c)), sc = T.toArr(T.getVal(tr(L, 'ADBE Scale'), c));
      T.setVal(pos, [p[0], p[1], (p[2] || 0) + dz * (sc[2] || 100) / 100], c);
    }
  }

  /* ---------- per-surface animator ---------- */
  function animatorsGroup(L) { return L.property('ADBE Text Properties').property('ADBE Text Animators'); }
  function surfAnim(L, create) {
    var ag = animatorsGroup(L), i, an;
    for (i = 1; i <= ag.numProperties; i++) if (ag.property(i).name === SURF_ANIM) return ag.property(i);
    if (!create) return null;
    an = ag.addProperty('ADBE Text Animator');
    an.name = SURF_ANIM;
    return animatorsGroup(L).property(SURF_ANIM);
  }
  function surfProp(L, surface, key, create) {
    var an = surfAnim(L, create), props, mn = T.surfMatch(surface, key), p;
    if (!an) return null;
    props = an.property('ADBE Text Animator Properties');
    p = props.property(mn);
    if (!p && create) {
      if (!props.canAddProperty(mn)) return null;
      props.addProperty(mn);
      p = surfAnim(L, false).property('ADBE Text Animator Properties').property(mn);
    }
    return p;
  }

  function readFaces(L, c) {
    var f = {}, s, p;
    for (s = 0; s < T.SURFACES.length; s++) {
      p = surfProp(L, T.SURFACES[s], 'opacity', false);
      f[T.SURFACES[s]] = p ? T.getVal(p, c) > 0 : true;
    }
    return f;
  }
  function writeFaces(L, c, faces) {
    var k, p;
    for (k in faces) {
      if (!faces.hasOwnProperty(k)) continue;
      p = surfProp(L, k, 'opacity', !faces[k]);
      if (p) T.setVal(p, faces[k] ? 100 : 0, c);
    }
  }

  /* ---------- materials ---------- */
  function readMat(L, c) {
    var g = matGroup(L), r = {}, k;
    if (!g) return r;
    for (k in T.MAT) {
      if (k === 'group' || !T.MAT.hasOwnProperty(k)) continue;
      r[k] = T.toArr(T.getVal(T.prop(g, T.MAT[k]), c));
    }
    return r;
  }

  M.get = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), r = { layer: readMat(L, c), surfaces: {} }, s, k, p, td;
    if (T.isText(L)) {
      td = L.property('ADBE Text Properties').property('ADBE Text Document').value;
      try { r.fill = T.toArr(td.fillColor); } catch (e) {}
      for (s = 0; s < T.SURFACES.length; s++) {
        r.surfaces[T.SURFACES[s]] = {};
        for (k in T.SURF_PROPS) {
          if (!T.SURF_PROPS.hasOwnProperty(k)) continue;
          p = surfProp(L, T.SURFACES[s], k, false);
          if (p) r.surfaces[T.SURFACES[s]][k] = T.toArr(T.getVal(p, c));
        }
      }
    } else if (T.isShape(L)) {
      r.fill = shapeFill(L, null);
    }
    r.kind = T.isText(L) ? 'text' : (T.isShape(L) ? 'shape' : 'other');
    return r;
  };

  // values: { layer:{metal:..}, surfaces:{Front:{color:[..], metal:..}}, fill:[r,g,b] }
  M.set = function (a) {
    var c = T.requireComp(), refs = a.refs || [a.ref], i, L, v = a.values || {}, k, s, g, p, skipped = [];
    T.undo('Material', function () {
      for (i = 0; i < refs.length; i++) {
        L = T.requireLayer(c, refs[i]);
        g = matGroup(L);
        if (v.layer && g) {
          for (k in v.layer) {
            if (!v.layer.hasOwnProperty(k) || !T.MAT[k]) continue;
            p = T.prop(g, T.MAT[k]);
            if (!p) { skipped.push(k); continue; }
            try { T.setVal(p, v.layer[k], c); } catch (e) { skipped.push(k); }
          }
        }
        if (v.fill) {
          if (T.isText(L)) {
            var tp = L.property('ADBE Text Properties').property('ADBE Text Document'), td = tp.value;
            td.applyFill = true; td.fillColor = [v.fill[0], v.fill[1], v.fill[2]];
            if (tp.numKeys > 0) tp.setValueAtTime(c.time, td); else tp.setValue(td);
          } else if (T.isShape(L)) shapeFill(L, v.fill);
        }
        if (v.surfaces && T.isText(L)) {
          for (s in v.surfaces) {
            if (!v.surfaces.hasOwnProperty(s)) continue;
            for (k in v.surfaces[s]) {
              if (!v.surfaces[s].hasOwnProperty(k) || !T.SURF_PROPS[k]) continue;
              p = surfProp(L, s, k, true);
              if (!p) { skipped.push(s + '.' + k); continue; }
              try {
                if (k === 'color') T.setColor(p, v.surfaces[s][k], c); else T.setVal(p, v.surfaces[s][k], c);
              } catch (e2) { skipped.push(s + '.' + k); }
            }
          }
        }
        if (v.clearSurface && T.isText(L)) clearSurface(L, v.clearSurface);
      }
    });
    return { skipped: skipped };
  };

  // Removes the per-surface overrides of one surface so it falls back to the layer material.
  function clearSurface(L, surface) {
    var an = surfAnim(L, false), props, i;
    if (!an) return;
    props = an.property('ADBE Text Animator Properties');
    for (i = props.numProperties; i >= 1; i--) {
      if (props.property(i).matchName.indexOf('ADBE 3DText ' + surface + ' ') === 0 && props.property(i).matchName.indexOf('Opacity') < 0) props.property(i).remove();
    }
  }

  function shapeFill(L, rgb) {
    var found = null;
    function walk(g) {
      var i, p;
      for (i = 1; i <= g.numProperties; i++) {
        p = g.property(i);
        if (p.matchName === 'ADBE Vector Graphic - Fill') {
          var col = p.property('ADBE Vector Fill Color');
          if (rgb) T.setColor(col, rgb); else if (!found) found = T.toArr(col.value);
        } else if (p.propertyType !== PropertyType.PROPERTY) walk(p);
      }
    }
    walk(L.property('ADBE Root Vectors Group'));
    return found;
  }

  T.modules.geometry = G;
  T.modules.materials = M;
})($.global.TS3D);
