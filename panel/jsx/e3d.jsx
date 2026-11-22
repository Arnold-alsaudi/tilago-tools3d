/* Mode A - Element 3D integration.
   What is automated: adding the effect, linking the text as Custom Text layer, every parameter the
   effect exposes to scripting (shown with Element's own names), cameras, lights, keyframes, templates.
   What is NOT automated: anything inside Scene Setup (extrude, materials, bevels). Element 3D stores it
   in private data with no public API, so the panel asks the user to do that step once and then reuses it
   through templates (duplicating a configured layer keeps its whole scene). */

(function (T) {
  var M = {};

  function e3dMatch() {
    var i;
    try {
      for (i = 0; i < app.effects.length; i++) {
        if (app.effects[i].matchName === 'VIDEOCOPILOT 3DArray') return app.effects[i].matchName;
      }
      for (i = 0; i < app.effects.length; i++) {
        if (/element/i.test(app.effects[i].displayName) && /video ?copilot/i.test(app.effects[i].category)) return app.effects[i].matchName;
      }
    } catch (e) {}
    return null;
  }
  M.available = function () { return !!e3dMatch(); };

  function e3dEffect(L) {
    var mn = e3dMatch(), p = L.property('ADBE Effect Parade'), i;
    if (!mn || !p) return null;
    for (i = 1; i <= p.numProperties; i++) if (p.property(i).matchName === mn) return p.property(i);
    return null;
  }

  // Finds the "Custom Text and Masks > Path Layer N" layer parameters.
  function pathLayerParams(ef) {
    var out = [];
    function walk(g, depth) {
      var i, p;
      for (i = 1; i <= g.numProperties; i++) {
        p = g.property(i);
        if (p.propertyType === PropertyType.PROPERTY) {
          try { if (p.propertyValueType === PropertyValueType.LAYER_INDEX && /path\s*layer/i.test(p.name)) out.push(p); } catch (e) {}
        } else if (depth < 4) walk(p, depth + 1);
      }
    }
    walk(ef, 0);
    if (!out.length) {
      // fall back to any layer parameter (first one is Path Layer 1 in every Element 3D version seen)
      (function any(g, depth) {
        var i, p;
        for (i = 1; i <= g.numProperties; i++) {
          p = g.property(i);
          if (p.propertyType === PropertyType.PROPERTY) { try { if (p.propertyValueType === PropertyValueType.LAYER_INDEX) out.push(p); } catch (e) {} }
          else if (depth < 4) any(p, depth + 1);
        }
      })(ef, 0);
    }
    return out;
  }

  function link(ef, textLayer, slot) {
    var params = pathLayerParams(ef);
    if (!params.length) T.fail('E3D_NO_PATH', 'Element 3D custom layer parameter not found');
    params[Math.min(slot || 0, params.length - 1)].setValue(textLayer.index);
  }

  M.list = function () {
    var c = T.activeComp(), out = [], i, L, t;
    if (!c) return [];
    for (i = 1; i <= c.numLayers; i++) {
      L = c.layer(i);
      if (e3dEffect(L)) {
        t = T.tagOf(L);
        out.push({ ref: T.refOf(L), name: L.name, template: !!(t && t.role === 'e3dtpl'), enabled: L.enabled });
      }
    }
    return out;
  };

  M.create = function (a) {
    var c = T.requireComp(), mn = e3dMatch(), TL = T.requireLayer(c, a.textRef), S;
    if (!mn) T.fail('E3D_MISSING', 'Element 3D is not installed');
    if (!T.isText(TL) && !T.isShape(TL)) T.fail('NOT_TEXT', 'Select a text or shape layer');
    T.undo('Element 3D layer', function () {
      if (a.templateRef) {
        S = T.requireLayer(c, a.templateRef).duplicate();
        S.enabled = true;
      } else {
        S = c.layers.addSolid([0, 0, 0], 'Element 3D - ' + TL.name, c.width, c.height, c.pixelAspect, c.duration);
        S.property('ADBE Effect Parade').addProperty(mn);
      }
      S.name = 'Element 3D - ' + TL.name;
      T.setTag(S, 'e3d');
      // Element 3D reads the custom layer even when it is hidden; hiding it avoids a double render.
      TL.threeDLayer = false;
      TL.enabled = false;
      S.moveBefore(TL);
      link(e3dEffect(S), TL, a.slot || 0);
    });
    return { ref: T.refOf(S), fromTemplate: !!a.templateRef };
  };

  M.markTemplate = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref);
    if (!e3dEffect(L)) T.fail('E3D_NOT_LAYER', 'This layer has no Element 3D effect');
    T.undo('Element 3D template', function () {
      T.setTag(L, a.on === false ? 'e3d' : 'e3dtpl');
      if (a.on !== false) { L.enabled = false; if (a.name) L.name = 'E3D Template - ' + a.name; }
    });
    return M.list();
  };

  // Every parameter Element 3D exposes to scripting, with its own names, so nothing is invented.
  M.params = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), ef = e3dEffect(L), out = [];
    if (!ef) T.fail('E3D_NOT_LAYER', 'This layer has no Element 3D effect');
    function walk(g, path, groupName, depth) {
      var i, p, t, v, item;
      for (i = 1; i <= g.numProperties; i++) {
        p = g.property(i);
        if (p.propertyType !== PropertyType.PROPERTY) {
          if (depth < 4) walk(p, path.concat([i]), (groupName ? groupName + ' / ' : '') + p.name, depth + 1);
          continue;
        }
        try { t = p.propertyValueType; v = T.toArr(p.value); } catch (e) { continue; }
        if (t === PropertyValueType.NO_VALUE || t === PropertyValueType.CUSTOM_VALUE || t === PropertyValueType.MARKER || t === PropertyValueType.SHAPE || t === PropertyValueType.TEXT_DOCUMENT) continue;
        item = { path: path.concat([i]), name: p.name, group: groupName || '', value: v, keys: p.numKeys };
        if (t === PropertyValueType.OneD) item.type = p.isDropdownEffect ? 'menu' : 'num';
        else if (t === PropertyValueType.COLOR) item.type = 'color';
        else if (t === PropertyValueType.LAYER_INDEX) item.type = 'layer';
        else if (t === PropertyValueType.TwoD || t === PropertyValueType.TwoD_SPATIAL) item.type = 'vec2';
        else if (t === PropertyValueType.ThreeD || t === PropertyValueType.ThreeD_SPATIAL) item.type = 'vec3';
        else continue;
        try { if (p.hasMin) item.min = p.minValue; if (p.hasMax) item.max = p.maxValue; } catch (e2) {}
        out.push(item);
      }
    }
    walk(ef, [], '', 0);
    return out;
  };

  M.setParam = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), p = e3dEffect(L), i;
    if (!p) T.fail('E3D_NOT_LAYER', 'This layer has no Element 3D effect');
    for (i = 0; i < a.path.length; i++) p = p.property(a.path[i]);
    T.undo('Element 3D: ' + p.name, function () {
      if (a.type === 'color') T.setColor(p, a.value, c); else T.setVal(p, a.value, c);
    });
    return T.toArr(p.value);
  };

  M.keyParam = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), p = e3dEffect(L), i;
    for (i = 0; i < a.path.length; i++) p = p.property(a.path[i]);
    T.undo('Element 3D key', function () { p.setValueAtTime(c.time, p.valueAtTime(c.time, false)); });
    return p.numKeys;
  };

  M.select = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), sel = c.selectedLayers, i;
    for (i = 0; i < sel.length; i++) sel[i].selected = false;
    L.selected = true;
    try { var ef = e3dEffect(L); if (ef) ef.selected = true; } catch (e) {}
    try { app.executeCommand(app.findMenuCommandId('Effect Controls')); } catch (e2) {}
    return true;
  };

  T.modules.e3d = M;
})($.global.TS3D);
