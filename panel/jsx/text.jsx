/* Text objects: create / convert / update, font list, and real glyph outlines for the viewport. */

(function (T) {
  var M = {};

  function textProp(L) { return L.property('ADBE Text Properties').property('ADBE Text Document'); }

  function justOf(name) {
    if (name === 'left') return ParagraphJustification.LEFT_JUSTIFY;
    if (name === 'right') return ParagraphJustification.RIGHT_JUSTIFY;
    return ParagraphJustification.CENTER_JUSTIFY;
  }
  function justName(j) {
    if (j === ParagraphJustification.LEFT_JUSTIFY) return 'left';
    if (j === ParagraphJustification.RIGHT_JUSTIFY) return 'right';
    return 'center';
  }

  // Applies the panel's text settings to a TextDocument. Returns notes about what the AE build refused.
  function applyDoc(td, a, notes) {
    if (a.text !== undefined) td.text = String(a.text).replace(/\r\n|\n/g, '\r');
    if (a.font) { try { td.font = a.font; } catch (e) { notes.push('font'); } }
    if (a.size !== undefined) td.fontSize = T.clamp(T.num(a.size, 100), 1, 1296);
    if (a.tracking !== undefined) td.tracking = Math.round(T.num(a.tracking, 0));
    if (a.leading !== undefined) {
      try {
        if (a.leading <= 0) td.autoLeading = true;
        else { td.autoLeading = false; td.leading = T.num(a.leading, 120); }
      } catch (e2) { notes.push('leading'); }
    }
    if (a.align) td.justification = justOf(a.align);
    if (a.rtl !== undefined) {
      var done = false;
      try {
        if (typeof ParagraphDirection !== 'undefined') {
          td.direction = a.rtl ? ParagraphDirection.DIRECTION_RIGHT_TO_LEFT : ParagraphDirection.DIRECTION_LEFT_TO_RIGHT;
          done = true;
        }
      } catch (e3) {}
      try {
        if (a.rtl && typeof ComposerEngine !== 'undefined') td.composerEngine = ComposerEngine.UNIVERSAL_TYPE_ENGINE;
      } catch (e4) {}
      if (a.rtl && !done) notes.push('rtl');
    }
    td.applyFill = true;
    if (a.fill) td.fillColor = [a.fill[0], a.fill[1], a.fill[2]];
    td.applyStroke = false;
    return td;
  }

  function readDoc(L) {
    var td = textProp(L).value, r = {};
    r.text = String(td.text).replace(/\r/g, '\n');
    try { r.font = td.font; } catch (e) {}
    try { r.fontFamily = td.fontFamily; r.fontStyle = td.fontStyle; } catch (e1) {}
    r.size = td.fontSize;
    r.tracking = td.tracking;
    try { r.leading = td.autoLeading ? 0 : td.leading; } catch (e2) { r.leading = 0; }
    try { r.align = justName(td.justification); } catch (e3) { r.align = 'center'; }
    try { r.rtl = (typeof ParagraphDirection !== 'undefined') && td.direction === ParagraphDirection.DIRECTION_RIGHT_TO_LEFT; } catch (e4) { r.rtl = false; }
    try { r.fill = T.toArr(td.fillColor); } catch (e5) {}
    return r;
  }

  // Centers the anchor on the visible text so rotations pivot around the middle of the object.
  T.centerAnchor = function (L, comp, zOffset) {
    var r = L.sourceRectAtTime(T.compTime(comp), false);
    var ap = L.property('ADBE Transform Group').property('ADBE Anchor Point');
    var old = T.toArr(T.getVal(ap, comp));
    var na = [r.left + r.width / 2, r.top + r.height / 2, zOffset || 0];
    T.setVal(ap, na, comp);
    // keep the object where it was on screen (exact when unrotated and at 100% scale)
    var pos = L.property('ADBE Transform Group').property('ADBE Position');
    if (!pos.dimensionsSeparated) {
      var pv = T.toArr(T.getVal(pos, comp)), sc = T.toArr(T.getVal(L.property('ADBE Transform Group').property('ADBE Scale'), comp));
      var dx = (na[0] - old[0]) * sc[0] / 100, dy = (na[1] - old[1]) * sc[1] / 100, dz = ((na[2] || 0) - (old[2] || 0)) * (sc[2] || 100) / 100;
      T.setVal(pos, [pv[0] + dx, pv[1] + dy, (pv[2] || 0) + dz], comp);
    }
  };

  // Ensures there is a working comp. Uses the active comp; otherwise makes one scene comp.
  T.ensureScene = function (a) {
    var c = T.activeComp();
    if (c) return c;
    c = T.findComp('TS3D:scene');
    if (c) { c.openInViewer(); return c; }
    c = app.project.items.addComp(a && a.compName ? a.compName : 'Tilago 3D Scene', 1920, 1080, 1, 10, 30);
    c.comment = 'TS3D:scene';
    c.openInViewer();
    return c;
  };

  T.applyRenderer = function (comp, renderer) {
    if (!renderer) return;
    if (comp.renderer !== renderer && T.has(T.toArr(comp.renderers), renderer)) comp.renderer = renderer;
  };

  M.create = function (a) {
    var notes = [];
    return T.undo('Create 3D text', function () {
      var c = T.ensureScene(a), L, td;
      T.applyRenderer(c, a.renderer);
      L = c.layers.addText(String(a.text || 'Tilago').replace(/\r\n|\n/g, '\r'));
      td = applyDoc(textProp(L).value, a, notes);
      textProp(L).setValue(td);
      L.name = String(a.text || 'Text').replace(/[\r\n]+/g, ' ').substr(0, 40);
      L.threeDLayer = true;
      var id = T.setTag(L, 'text');
      L.property('ADBE Transform Group').property('ADBE Position').setValue(T.center(c));
      T.centerAnchor(L, c, 0);
      L.position.setValue(T.center(c));
      return { ref: id, comp: T.modules.caps.comp(), notes: notes };
    });
  };

  // Turns the selected text or shape layer into a studio object (no duplicate layers are made).
  M.convertSelected = function (a) {
    var c = T.requireComp(), sel = c.selectedLayers, out = [], i, L, t, role;
    if (!sel.length) T.fail('NO_SELECTION', 'Select a text or shape layer');
    T.undo('Convert to 3D', function () {
      T.applyRenderer(c, a.renderer);
      for (i = 0; i < sel.length; i++) {
        L = sel[i];
        if (!T.isText(L) && !T.isShape(L)) continue;
        role = T.isText(L) ? 'text' : 'shape';
        t = T.tagOf(L);
        L.threeDLayer = true;
        out.push(t ? t.id : T.setTag(L, role));
        if (a.centerAnchor !== false && !t) T.centerAnchor(L, c, 0);
      }
    });
    if (!out.length) T.fail('NO_SELECTION', 'Select a text or shape layer');
    return { refs: out, comp: T.modules.caps.comp() };
  };

  M.update = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), notes = [];
    if (!T.isText(L)) T.fail('NOT_TEXT', 'This object is not a text layer');
    T.undo('Update text', function () {
      var tp = textProp(L), td = applyDoc(tp.value, a, notes);
      if (tp.numKeys > 0) tp.setValueAtTime(c.time, td); else tp.setValue(td);
      if (a.text !== undefined) L.name = String(a.text).replace(/[\r\n]+/g, ' ').substr(0, 40);
      if (a.recenter) T.centerAnchor(L, c, T.toArr(L.property('ADBE Transform Group').property('ADBE Anchor Point').value)[2]);
    });
    return { notes: notes };
  };

  M.read = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    if (!T.isText(L)) return { isText: false };
    var r = readDoc(L);
    r.isText = true;
    return r;
  };

  // Installed fonts from AE itself (AE 2024+). Older builds fall back to the panel's own font scanner.
  M.fonts = function () {
    if (!(app.fonts && app.fonts.allFonts)) return null;
    var out = [], groups = app.fonts.allFonts, i, j, f;
    for (i = 0; i < groups.length; i++) {
      for (j = 0; j < groups[i].length; j++) {
        f = groups[i][j];
        out.push({ family: f.familyName, style: f.styleName, ps: f.postScriptName });
      }
    }
    return out;
  };

  /* ---------- outlines for the viewport ---------- */
  function readShapeContents(group, acc, offset) {
    var i, p, mn, sub, tr, pos, anc, off2, v, k, path;
    for (i = 1; i <= group.numProperties; i++) {
      p = group.property(i);
      mn = p.matchName;
      if (mn === 'ADBE Vector Group') {
        tr = p.property('ADBE Vector Transform Group');
        off2 = [offset[0], offset[1]];
        if (tr) {
          pos = T.toArr(tr.property('ADBE Vector Position').value);
          anc = T.toArr(tr.property('ADBE Vector Anchor').value);
          off2 = [offset[0] + pos[0] - anc[0], offset[1] + pos[1] - anc[1]];
        }
        sub = p.property('ADBE Vectors Group');
        if (sub) readShapeContents(sub, acc, off2);
      } else if (mn === 'ADBE Vector Shape - Group') {
        path = p.property('ADBE Vector Shape').value;
        v = [];
        for (k = 0; k < path.vertices.length; k++) v.push([path.vertices[k][0] + offset[0], path.vertices[k][1] + offset[1]]);
        acc.push({ v: v, i: T.toArr2(path.inTangents), o: T.toArr2(path.outTangents), c: path.closed });
      } else if (p.propertyType !== PropertyType.PROPERTY && mn !== 'ADBE Vector Transform Group') {
        try { readShapeContents(p, acc, offset); } catch (e) {}
      }
    }
  }
  T.toArr2 = function (a) { var o = [], i; for (i = 0; i < a.length; i++) o.push([a[i][0], a[i][1]]); return o; };

  function shapeContours(L) {
    var acc = [];
    readShapeContents(L.property('ADBE Root Vectors Group'), acc, [0, 0]);
    return acc;
  }

  // Uses AE's own "Create Shapes from Text", so the preview has exactly the same glyphs AE renders
  // (including Arabic shaping), then removes the temporary layer.
  M.outlines = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), contours, i;
    if (T.isShape(L)) {
      contours = shapeContours(L);
      var sa = T.toArr(L.property('ADBE Transform Group').property('ADBE Anchor Point').value);
      for (i = 0; i < contours.length; i++) for (var q = 0; q < contours[i].v.length; q++) { contours[i].v[q][0] -= sa[0]; contours[i].v[q][1] -= sa[1]; }
      return { contours: contours };
    }
    if (!T.isText(L)) return { contours: [] };
    var wasEnabled = L.enabled, sel = c.selectedLayers, before = c.numLayers, tmp = null;
    app.beginUndoGroup('Tilago 3D: preview outlines');
    try {
      for (i = 0; i < sel.length; i++) sel[i].selected = false;
      L.selected = true;
      var cmd = app.findMenuCommandId('Create Shapes from Text');
      app.executeCommand(cmd > 0 ? cmd : 3781);
      if (c.numLayers > before) {
        for (i = 1; i <= c.numLayers; i++) {
          if (c.layer(i) instanceof ShapeLayer && c.layer(i).selected) { tmp = c.layer(i); break; }
        }
      }
      if (!tmp) T.fail('OUTLINE_FAIL', 'Could not read glyph outlines');
      contours = shapeContours(tmp);
      // shape layer and text layer share the same transform; convert into text layer space
      var ta = T.toArr(tmp.property('ADBE Transform Group').property('ADBE Anchor Point').value);
      var la = T.toArr(L.property('ADBE Transform Group').property('ADBE Anchor Point').value);
      var dx = ta[0] - la[0], dy = ta[1] - la[1];
      if (dx || dy) {
        for (i = 0; i < contours.length; i++) {
          for (var k = 0; k < contours[i].v.length; k++) { contours[i].v[k][0] -= dx; contours[i].v[k][1] -= dy; }
        }
      }
      // anchor offset so the viewport pivots like AE does
      for (i = 0; i < contours.length; i++) {
        for (var k2 = 0; k2 < contours[i].v.length; k2++) { contours[i].v[k2][0] -= la[0]; contours[i].v[k2][1] -= la[1]; }
      }
      tmp.remove();
      L.enabled = wasEnabled;
      L.selected = true;
    } finally {
      app.endUndoGroup();
    }
    return { contours: contours };
  };

  T.modules.text = M;
})($.global.TS3D);
