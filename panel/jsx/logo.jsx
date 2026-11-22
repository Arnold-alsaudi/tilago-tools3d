/* Logos: import, read vector outlines exactly, and build mask / shape layers from traced outlines.
   Raster tracing runs in the panel (one click, no After Effects dialog); this module builds the layers. */

(function (T) {
  var M = {};
  function tr(L, k) { return L.property('ADBE Transform Group').property(k); }

  function isVectorFile(f) { return /\.(ai|eps|pdf|svg)$/i.test(f || ''); }

  // Maps a point in a 2D layer's own space to comp space (position / anchor / scale / Z rotation).
  function toComp(L, c, p) {
    var pos = T.toArr(T.getVal(tr(L, 'ADBE Position'), c)), an = T.toArr(T.getVal(tr(L, 'ADBE Anchor Point'), c));
    var sc = T.toArr(T.getVal(tr(L, 'ADBE Scale'), c)), rz = (T.getVal(tr(L, 'ADBE Rotate Z'), c) || 0) * Math.PI / 180;
    var x = (p[0] - an[0]) * sc[0] / 100, y = (p[1] - an[1]) * sc[1] / 100;
    return [pos[0] + x * Math.cos(rz) - y * Math.sin(rz), pos[1] + x * Math.sin(rz) + y * Math.cos(rz)];
  }
  function scaleOf(L, c) { var sc = T.toArr(T.getVal(tr(L, 'ADBE Scale'), c)); return [sc[0] / 100, sc[1] / 100]; }

  function info(L, c) {
    var file = null, kind = 'other';
    try { if (L.source && L.source.file) file = L.source.file.fsName; } catch (e) {}
    if (T.isShape(L)) kind = 'shape';
    else if (T.isText(L)) kind = 'text';
    else if (file) kind = isVectorFile(file) ? 'vector' : 'raster';
    var r = { ref: T.refOf(L), name: L.name, kind: kind, file: file };
    try { r.w = L.source.width; r.h = L.source.height; } catch (e2) {}
    return r;
  }

  // Imports a logo file into the active comp (centered). Returns what the panel needs to trace it.
  M.importFile = function (a) {
    var c = T.requireComp(), L;
    var f = new File(a.file);
    if (!f.exists) T.fail('NO_FILE', 'File not found');
    T.undo('Import logo', function () {
      var io = new ImportOptions(f);
      if (io.canImportAs(ImportAsType.FOOTAGE)) io.importAs = ImportAsType.FOOTAGE;
      var item = app.project.importFile(io);
      item.parentFolder = T.findFolder('Tilago 3D Assets', true);
      L = c.layers.add(item);
      L.name = 'Logo - ' + f.name.replace(/\.[^.]+$/, '');
      // fit inside 60% of the frame
      var s = Math.min(c.width * 0.6 / item.width, c.height * 0.6 / item.height) * 100;
      tr(L, 'ADBE Scale').setValue([s, s]);
      tr(L, 'ADBE Position').setValue([c.width / 2, c.height / 2]);
    });
    return info(L, c);
  };

  M.selected = function () {
    var c = T.requireComp(), sel = c.selectedLayers;
    if (!sel.length) T.fail('NO_SELECTION', 'Select the logo layer');
    return info(sel[0], c);
  };

  // Raster logo: where the image pixels land in the comp (for the panel's tracer).
  M.rasterPlacement = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    var o = toComp(L, c, [0, 0]), sc = scaleOf(L, c);
    var rz = T.getVal(tr(L, 'ADBE Rotate Z'), c) || 0;
    var r = info(L, c);
    r.origin = o; r.scale = sc; r.rotation = rz;
    return r;
  };

  // Vector logo / shape layer: exact outlines in comp space, using AE's own "Create Shapes from Vector Layer".
  M.vectorContours = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), S = L, made = false, contours, i, k;
    app.beginUndoGroup('Tilago 3D: read logo');
    try {
      if (!T.isShape(L)) {
        var sel = c.selectedLayers, before = c.numLayers;
        for (i = 0; i < sel.length; i++) sel[i].selected = false;
        L.selected = true;
        var cmd = app.findMenuCommandId('Create Shapes from Vector Layer');
        app.executeCommand(cmd > 0 ? cmd : 3973);
        S = null;
        if (c.numLayers > before) for (i = 1; i <= c.numLayers; i++) if (c.layer(i) instanceof ShapeLayer && c.layer(i).selected) { S = c.layer(i); break; }
        if (!S) T.fail('VECTOR_FAIL', 'This layer has no vector outlines; use Auto trace instead');
        made = true;
      }
      contours = T.shapeContours(S);
      var sc = scaleOf(S, c);
      for (i = 0; i < contours.length; i++) {
        for (k = 0; k < contours[i].v.length; k++) {
          contours[i].v[k] = toComp(S, c, contours[i].v[k]);
          contours[i].i[k] = [contours[i].i[k][0] * sc[0], contours[i].i[k][1] * sc[1]];
          contours[i].o[k] = [contours[i].o[k][0] * sc[0], contours[i].o[k][1] * sc[1]];
        }
      }
      if (made) { S.remove(); L.enabled = true; }
    } finally { app.endUndoGroup(); }
    return { contours: contours, w: c.width, h: c.height };
  };

  // a: { contours:[{v,i,o,c,hole}], name, hideRef, as:'masks'|'shape' } - all points in comp space.
  M.build = function (a) {
    var c = T.requireComp(), L;
    if (!a.contours || !a.contours.length) T.fail('TRACE_EMPTY', 'Nothing was traced');
    T.undo(a.as === 'shape' ? 'Logo shape' : 'Logo masks', function () {
      var i, k, sh;
      if (a.as === 'shape') {
        L = c.layers.addShape();
        L.name = a.name || 'Logo 3D';
        var grp = L.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
        grp.name = 'Logo';
        var vecs = grp.property('ADBE Vectors Group');
        for (i = 0; i < a.contours.length; i++) {
          sh = new Shape();
          sh.vertices = rel(a.contours[i].v, c); sh.inTangents = a.contours[i].i; sh.outTangents = a.contours[i].o; sh.closed = true;
          vecs.addProperty('ADBE Vector Shape - Group').property('ADBE Vector Shape').setValue(sh);
        }
        var fill = vecs.addProperty('ADBE Vector Graphic - Fill');
        try { fill.property('ADBE Vector Fill Rule').setValue(2); } catch (e) {}
        fill.property('ADBE Vector Fill Color').setValue(a.color || [1, 1, 1]);
        tr(L, 'ADBE Anchor Point').setValue([0, 0]);
        tr(L, 'ADBE Position').setValue([c.width / 2, c.height / 2]);
        L.threeDLayer = true;
        T.setTag(L, 'shape');
      } else {
        L = c.layers.addSolid([1, 1, 1], a.name || 'Logo Masks', c.width, c.height, c.pixelAspect, c.duration);
        var masks = L.property('ADBE Mask Parade');
        // outer shapes first, holes after them (Subtract applies to the masks above it)
        var order = [];
        for (i = 0; i < a.contours.length; i++) if (!a.contours[i].hole) order.push(a.contours[i]);
        for (i = 0; i < a.contours.length; i++) if (a.contours[i].hole) order.push(a.contours[i]);
        for (i = 0; i < order.length; i++) {
          sh = new Shape();
          sh.vertices = order[i].v; sh.inTangents = order[i].i; sh.outTangents = order[i].o; sh.closed = true;
          var m = masks.addProperty('ADBE Mask Atom');
          m.property('ADBE Mask Shape').setValue(sh);
          m.maskMode = order[i].hole ? MaskMode.SUBTRACT : MaskMode.ADD;
        }
        T.setTag(L, 'logo');
      }
      if (a.hideRef) { var H = T.layerByRef(c, a.hideRef); if (H) { H.enabled = false; if (H.hasAudio) H.audioEnabled = false; } }
    });
    return { ref: T.refOf(L), name: L.name };
  };
  function rel(v, c) { var o = [], i; for (i = 0; i < v.length; i++) o.push([v[i][0] - c.width / 2, v[i][1] - c.height / 2]); return o; }

  T.modules.logo = M;
})($.global.TS3D);
