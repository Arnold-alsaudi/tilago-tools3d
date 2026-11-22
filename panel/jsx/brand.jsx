/* Rebrand any template (Envato or not), built for Element 3D projects.
   scan()   finds logo slots, texts and every Element 3D link in the whole project (nested comps too).
   apply()  swaps everything in one undo step and keeps Element 3D links intact:
            - masks used by Element 3D "Path Layer" are replaced inside the same layer (extrude + materials stay)
            - images (also Element 3D "Custom Texture Maps") get the new logo, fitted to the old logo's box
            - shape logos get new paths inside the same layer (animation on the layer stays)
            - texts keep their style and keyframes, only the words / font change */

(function (T) {
  var M = {};
  var E3D = 'VIDEOCOPILOT 3DArray';
  var IMG = /\.(png|jpe?g|psd|tiff?|tga|bmp|gif|webp|ai|eps|pdf|svg|exr)$/i;
  var LOGO_HINT = /logo|لوجو|لوغو|شعار|brand|emblem|mark|place ?your|your ?logo|replace/i;

  function keyOf(comp, L) { return comp.id + ':' + L.index; }
  function byKey(key) {
    var p = String(key).split(':'), comp = app.project.itemByID(parseInt(p[0], 10));
    if (!comp || !(comp instanceof CompItem)) T.fail('NO_LAYER', 'Layer not found');
    var i = parseInt(p[1], 10);
    if (i < 1 || i > comp.numLayers) T.fail('NO_LAYER', 'Layer not found');
    return { comp: comp, layer: comp.layer(i) };
  }
  function masks(L) { try { return L.property('ADBE Mask Parade'); } catch (e) { return null; } }
  function maskCount(L) { var m = masks(L); return m ? m.numProperties : 0; }
  function fileOf(L) { try { return L.source && L.source.mainSource && L.source.mainSource.file ? L.source.mainSource.file.fsName : null; } catch (e) { return null; } }

  function maskBox(L) {
    var m = masks(L), i, k, v, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, shapes = [];
    for (i = 1; i <= m.numProperties; i++) {
      var sh = m.property(i).property('ADBE Mask Shape').valueAtTime(0, false);
      var poly = [];
      for (k = 0; k < sh.vertices.length; k++) {
        v = sh.vertices[k]; poly.push([v[0], v[1]]);
        if (v[0] < x0) x0 = v[0]; if (v[1] < y0) y0 = v[1]; if (v[0] > x1) x1 = v[0]; if (v[1] > y1) y1 = v[1];
      }
      shapes.push(poly);
    }
    return { box: [x0, y0, x1 - x0, y1 - y0], preview: shapes };
  }

  function shapeBox(L) {
    var r = L.sourceRectAtTime(0, false);
    return [r.left, r.top, r.width, r.height];
  }

  /* ---------- scan ---------- */
  M.scan = function () {
    var out = { logos: [], texts: [], links: [], comps: 0 }, seen = {}, i, j, c, L, linkInfo = {};
    // 1) Element 3D links first, so every target can be labeled
    for (i = 1; i <= app.project.numItems; i++) {
      c = app.project.item(i);
      if (!(c instanceof CompItem)) continue;
      for (j = 1; j <= c.numLayers; j++) {
        L = c.layer(j);
        var fx = null;
        try { fx = L.property('ADBE Effect Parade'); } catch (e) {}
        if (!fx) continue;
        for (var f = 1; f <= fx.numProperties; f++) {
          if (fx.property(f).matchName !== E3D) continue;
          walkLinks(fx.property(f), function (p) {
            var idx = p.value;
            if (!idx || idx < 1 || idx > c.numLayers) return;
            var target = c.layer(idx), tk = keyOf(c, target);
            var kind = /path/i.test(p.name) ? 'extrude' : 'texture';
            out.links.push({ e3d: keyOf(c, L), e3dName: L.name, comp: c.name, param: p.name, target: tk, targetName: target.name, kind: kind });
            (linkInfo[tk] = linkInfo[tk] || []).push(kind === 'extrude' ? 'E3D extrude' : 'E3D texture');
          });
        }
      }
    }
    // 2) logo slots and texts
    for (i = 1; i <= app.project.numItems; i++) {
      c = app.project.item(i);
      if (!(c instanceof CompItem) || c.comment.indexOf('TS3D:envcomp') >= 0) continue;
      out.comps++;
      for (j = 1; j <= c.numLayers; j++) {
        L = c.layer(j);
        var k = keyOf(c, L), links = linkInfo[k] || [], base = { key: k, comp: c.name, layer: L.name, enabled: L.enabled, e3d: links };
        if (L instanceof TextLayer) {
          var td = L.property('ADBE Text Properties').property('ADBE Text Document').value;
          base.text = String(td.text).replace(/\r/g, '\n');
          try { base.font = td.font; } catch (e2) {}
          base.size = td.fontSize;
          base.likely = true;
          out.texts.push(base);
          continue;
        }
        var nm = L.name + ' ' + c.name, file = fileOf(L);
        if (L instanceof ShapeLayer) {
          if (!LOGO_HINT.test(nm) && !links.length) continue;
          base.kind = 'shape'; base.box = shapeBox(L); base.likely = true;
          out.logos.push(base);
        } else if (maskCount(L) > 0 && (links.length || LOGO_HINT.test(nm))) {
          var mb = maskBox(L);
          base.kind = 'masks'; base.box = mb.box; base.preview = mb.preview; base.likely = true;
          out.logos.push(base);
        } else if (file && IMG.test(file)) {
          var srcKey = 'f' + L.source.id;
          base.kind = 'image'; base.file = file; base.w = L.source.width; base.h = L.source.height;
          base.likely = !!(links.length || LOGO_HINT.test(nm + ' ' + L.source.name));
          base.shared = !!seen[srcKey]; seen[srcKey] = 1;
          out.logos.push(base);
        }
      }
    }
    return out;
  };

  function walkLinks(g, fn) {
    var i, p;
    for (i = 1; i <= g.numProperties; i++) {
      p = g.property(i);
      if (p.propertyType === PropertyType.PROPERTY) { try { if (p.propertyValueType === PropertyValueType.LAYER_INDEX) fn(p); } catch (e) {} }
      else walkLinks(p, fn);
    }
  }

  /* ---------- logo import / vector outlines ---------- */
  var cache = {};
  function footage(file) {
    if (cache[file]) { try { if (cache[file].name) return cache[file]; } catch (e) {} }
    var f = new File(file);
    if (!f.exists) T.fail('NO_FILE', 'File not found');
    var io = new ImportOptions(f);
    if (io.canImportAs(ImportAsType.FOOTAGE)) io.importAs = ImportAsType.FOOTAGE;
    var item = app.project.importFile(io);
    item.parentFolder = T.findFolder('Tilago 3D Assets', true);
    cache[file] = item;
    return item;
  }

  // Exact outlines of a vector logo (AI / EPS / PDF), in the file's own pixel space.
  M.vectorFromFile = function (a) {
    var keepActive = T.activeComp(), out;
    app.beginUndoGroup('Tilago 3D: read vector logo');
    var tmp = null;
    try {
      var item = footage(a.file);
      tmp = app.project.items.addComp('__TS3D_vector__', Math.max(4, item.width), Math.max(4, item.height), 1, 1, 30);
      var L = tmp.layers.add(item);
      L.property('ADBE Transform Group').property('ADBE Position').setValue([tmp.width / 2, tmp.height / 2]);
      tmp.openInViewer();
      L.selected = true;
      var cmd = app.findMenuCommandId('Create Shapes from Vector Layer');
      app.executeCommand(cmd > 0 ? cmd : 3973);
      var S = null, i, k;
      for (i = 1; i <= tmp.numLayers; i++) if (tmp.layer(i) instanceof ShapeLayer) { S = tmp.layer(i); break; }
      if (!S) T.fail('VECTOR_FAIL', 'This file has no vector outlines');
      var cs = T.shapeContours(S);
      var tr = S.property('ADBE Transform Group'), pos = T.toArr(tr.property('ADBE Position').value), an = T.toArr(tr.property('ADBE Anchor Point').value);
      for (i = 0; i < cs.length; i++) for (k = 0; k < cs[i].v.length; k++) { cs[i].v[k] = [cs[i].v[k][0] - an[0] + pos[0], cs[i].v[k][1] - an[1] + pos[1]]; }
      out = { contours: cs, w: item.width, h: item.height };
    } finally {
      try { if (tmp) tmp.remove(); } catch (e) {}
      app.endUndoGroup();
      try { if (keepActive) keepActive.openInViewer(); } catch (e2) {}
    }
    return out;
  };

  /* ---------- replacers ---------- */
  function mulKeys(p, f) {
    var i, v, j;
    if (p.numKeys === 0) { v = T.toArr(p.value); for (j = 0; j < v.length; j++) v[j] *= f[j % f.length]; p.setValue(v); return; }
    for (i = 1; i <= p.numKeys; i++) { v = T.toArr(p.keyValue(i)); for (j = 0; j < v.length; j++) v[j] *= f[j % f.length]; p.setValueAtKey(i, v); }
  }

  // Image slot: new logo on the same layer, fitted inside the old logo's box (no stretching).
  function replaceImage(L, file) {
    var oldW = L.source.width, oldH = L.source.height, item = footage(file);
    var r = Math.min(oldW / item.width, oldH / item.height);
    var ap = L.property('ADBE Transform Group').property('ADBE Anchor Point'), an = T.toArr(ap.value);
    var ax = an[0] / oldW, ay = an[1] / oldH;
    L.replaceSource(item, false);
    var sc = L.property('ADBE Transform Group').property('ADBE Scale');
    mulKeys(sc, [r, r, 1]);
    if (ap.numKeys === 0) { an[0] = ax * item.width; an[1] = ay * item.height; ap.setValue(an); }
  }

  // contours arrive already fitted to the slot box by the panel (layer space)
  function replaceMasks(L, contours) {
    var m = masks(L), feather = null, i, sh, mk;
    try { feather = T.toArr(m.property(1).property('ADBE Mask Feather').value); } catch (e) {}
    for (i = m.numProperties; i >= 1; i--) m.property(i).remove();
    var order = [];
    for (i = 0; i < contours.length; i++) if (!contours[i].hole) order.push(contours[i]);
    for (i = 0; i < contours.length; i++) if (contours[i].hole) order.push(contours[i]);
    for (i = 0; i < order.length; i++) {
      sh = new Shape(); sh.vertices = order[i].v; sh.inTangents = order[i].i; sh.outTangents = order[i].o; sh.closed = true;
      mk = masks(L).addProperty('ADBE Mask Atom');
      mk.property('ADBE Mask Shape').setValue(sh);
      mk.maskMode = order[i].hole ? MaskMode.SUBTRACT : MaskMode.ADD;
      if (feather) try { mk.property('ADBE Mask Feather').setValue(feather); } catch (e2) {}
    }
  }

  function replaceShape(L, contours) {
    var root = L.property('ADBE Root Vectors Group'), color = [1, 1, 1], i;
    (function find(g) {
      for (var k = 1; k <= g.numProperties; k++) {
        var p = g.property(k);
        if (p.matchName === 'ADBE Vector Graphic - Fill') { color = T.toArr(p.property('ADBE Vector Fill Color').value); return true; }
        if (p.propertyType !== PropertyType.PROPERTY && find(p)) return true;
      }
      return false;
    })(root);
    for (i = root.numProperties; i >= 1; i--) root.property(i).remove();
    var grp = L.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
    grp.name = 'Logo';
    var vecs = grp.property('ADBE Vectors Group'), sh;
    for (i = 0; i < contours.length; i++) {
      sh = new Shape(); sh.vertices = contours[i].v; sh.inTangents = contours[i].i; sh.outTangents = contours[i].o; sh.closed = true;
      vecs.addProperty('ADBE Vector Shape - Group').property('ADBE Vector Shape').setValue(sh);
    }
    var fill = vecs.addProperty('ADBE Vector Graphic - Fill');
    try { fill.property('ADBE Vector Fill Rule').setValue(2); } catch (e) {}
    fill.property('ADBE Vector Fill Color').setValue(color.slice(0, 3));
  }

  function replaceText(L, text, font) {
    var p = L.property('ADBE Text Properties').property('ADBE Text Document'), i, td, notes = [];
    function apply(doc) {
      if (text !== null && text !== undefined) doc.text = String(text).replace(/\r\n|\n/g, '\r');
      if (font) { try { doc.font = font; } catch (e) { notes.push('font'); } }
      return doc;
    }
    if (p.numKeys === 0) p.setValue(apply(p.value));
    else for (i = 1; i <= p.numKeys; i++) { td = p.keyValue(i); p.setValueAtKey(i, apply(td)); }
    return notes;
  }

  // a: { logoFile, logos:[{key, kind, contours?}], texts:[{key, text}], font, fontAll }
  M.apply = function (a) {
    var done = { logos: 0, texts: 0, skipped: [] }, i, it, ref;
    T.undo('Rebrand', function () {
      for (i = 0; i < (a.logos || []).length; i++) {
        it = a.logos[i];
        try {
          ref = byKey(it.key);
          if (it.kind === 'image') replaceImage(ref.layer, a.logoFile);
          else if (it.kind === 'masks') replaceMasks(ref.layer, it.contours);
          else if (it.kind === 'shape') replaceShape(ref.layer, it.contours);
          done.logos++;
        } catch (e) { done.skipped.push(it.key + ': ' + e.message); }
      }
      for (i = 0; i < (a.texts || []).length; i++) {
        it = a.texts[i];
        try {
          ref = byKey(it.key);
          replaceText(ref.layer, it.text, a.font || null);
          done.texts++;
        } catch (e2) { done.skipped.push(it.key + ': ' + e2.message); }
      }
    });
    return done;
  };

  // Show a slot: open its comp and select the layer.
  M.reveal = function (a) {
    var r = byKey(a.key), sel = r.comp.selectedLayers, i;
    r.comp.openInViewer();
    for (i = 0; i < sel.length; i++) sel[i].selected = false;
    r.layer.selected = true;
    return true;
  };

  T.modules.brand = M;
})($.global.TS3D);
