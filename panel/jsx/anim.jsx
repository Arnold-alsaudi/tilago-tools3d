/* Animation studio: writes real keyframes that stay editable in the timeline. */

(function (T) {
  var M = {};

  function tr(L, k) { return L.property('ADBE Transform Group').property(k); }

  function resolve(L, target) {
    var g;
    switch (target) {
      case 'position': return tr(L, 'ADBE Position');
      case 'rx': return tr(L, 'ADBE Rotate X');
      case 'ry': return tr(L, 'ADBE Rotate Y');
      case 'rz': return tr(L, 'ADBE Rotate Z');
      case 'scale': return tr(L, 'ADBE Scale');
      case 'opacity': return tr(L, 'ADBE Opacity');
      case 'depth': g = T.prop(L, T.GEO.group); return T.prop(g, T.GEO.depth);
      case 'bevel': g = T.prop(L, T.GEO.group); return T.prop(g, T.GEO.bevelDepth);
      case 'metal': g = T.prop(L, T.MAT.group); return T.prop(g, T.MAT.metal);
      case 'reflection': g = T.prop(L, T.MAT.group); return T.prop(g, T.MAT.reflection);
      case 'zoom': return L.property('ADBE Camera Options Group').property('ADBE Camera Zoom');
      case 'intensity': return T.prop(L.property('ADBE Light Options Group'), ['ADBE Light Intensity', 'Intensity']);
      case 'lightColor': return T.prop(L.property('ADBE Light Options Group'), ['ADBE Light Color', 'Color']);
    }
    if (/^(Front|Bevel|Side|Back)Color$/.test(target)) {
      if (!T.isText(L)) return null;
      var s = target.replace('Color', ''), an = surfAnimator(L), mn = T.surfMatch(s, 'color'), props = an.property('ADBE Text Animator Properties');
      if (!props.property(mn)) { if (!props.canAddProperty(mn)) return null; props.addProperty(mn); }
      return surfAnimator(L).property('ADBE Text Animator Properties').property(mn);
    }
    return null;
  }
  function surfAnimator(L) {
    var ag = L.property('ADBE Text Properties').property('ADBE Text Animators'), i;
    for (i = 1; i <= ag.numProperties; i++) if (ag.property(i).name === 'TS3D Surfaces') return ag.property(i);
    ag.addProperty('ADBE Text Animator').name = 'TS3D Surfaces';
    return L.property('ADBE Text Properties').property('ADBE Text Animators').property('TS3D Surfaces');
  }

  function dims(p) {
    var t = p.propertyValueType;
    if (t === PropertyValueType.OneD) return 1;
    if (t === PropertyValueType.TwoD || t === PropertyValueType.TwoD_SPATIAL) return 2;
    if (t === PropertyValueType.COLOR) return 4;
    return 3;
  }

  // ease: linear | ease | easeIn | easeOut | strong | overshoot | bounce
  function applyEase(p, k, ease, isFirst, isLast) {
    var n = dims(p), inf, i, eIn = [], eOut = [];
    if (ease === 'linear') {
      p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
      return;
    }
    p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    var infIn = 33.33, infOut = 33.33;
    if (ease === 'ease') { infIn = 66; infOut = 66; }
    if (ease === 'strong') { infIn = 90; infOut = 90; }
    if (ease === 'easeIn') { infIn = isLast ? 80 : 33.33; infOut = isFirst ? 0.1 : 33.33; }
    if (ease === 'easeOut') { infIn = isLast ? 0.1 : 33.33; infOut = isFirst ? 80 : 33.33; }
    if (ease === 'easeIn' && isFirst) infOut = 80;
    if (ease === 'easeOut' && isLast) infIn = 80;
    if (ease === 'overshoot' || ease === 'bounce') { infIn = 50; infOut = 50; }
    var count = (p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL) ? 1 : (n === 4 ? 1 : n);
    for (i = 0; i < count; i++) { eIn.push(new KeyframeEase(0, Math.max(0.1, infIn))); eOut.push(new KeyframeEase(0, Math.max(0.1, infOut))); }
    try { p.setTemporalEaseAtKey(k, eIn, eOut); } catch (e) {}
  }

  function lerp(a, b, t) {
    if (typeof a === 'number') return a + (b - a) * t;
    var o = [], i;
    for (i = 0; i < a.length; i++) o.push(a[i] + (b[i] - a[i]) * t);
    return o;
  }

  // Writes keys [{t, v}] with easing; extra keys for overshoot / bounce are generated here.
  function writeKeys(p, keys, ease, replace) {
    if (!p) return 0;
    var i, k, v, t0 = keys[0].t, t1 = keys[keys.length - 1].t;
    if (replace) {
      for (i = p.numKeys; i >= 1; i--) {
        k = p.keyTime(i);
        if (k >= t0 - 0.0001 && k <= t1 + 0.0001) p.removeKey(i);
      }
    }
    var list = keys.slice(0);
    if ((ease === 'overshoot' || ease === 'bounce') && list.length === 2 && typeof list[0].v !== 'boolean') {
      var a = list[0], b = list[1], d = b.t - a.t;
      if (ease === 'overshoot') {
        list = [a, { t: a.t + d * 0.7, v: lerp(a.v, b.v, 1.12) }, { t: a.t + d * 0.87, v: lerp(a.v, b.v, 0.97) }, b];
      } else {
        list = [a, { t: a.t + d * 0.55, v: b.v }, { t: a.t + d * 0.72, v: lerp(a.v, b.v, 0.88) }, { t: a.t + d * 0.86, v: b.v },
                { t: a.t + d * 0.94, v: lerp(a.v, b.v, 0.97) }, b];
      }
    }
    var idx = [];
    for (i = 0; i < list.length; i++) idx.push(p.addKey(list[i].t));
    var isCol = p.propertyValueType === PropertyValueType.COLOR;
    for (i = 0; i < list.length; i++) {
      k = p.nearestKeyIndex(list[i].t);
      v = list[i].v;
      if (isCol && v.length === 3) v = [v[0], v[1], v[2], 1];
      p.setValueAtKey(k, v);
    }
    for (i = 0; i < list.length; i++) {
      k = p.nearestKeyIndex(list[i].t);
      applyEase(p, k, ease === 'bounce' ? 'easeIn' : ease, i === 0, i === list.length - 1);
    }
    return list.length;
  }

  function cur(p, c, t) { return T.toArr(p.numKeys ? p.valueAtTime(t, false) : p.value); }
  function add(a, b) { if (typeof a === 'number') return a + b; var o = [], i; for (i = 0; i < a.length; i++) o.push(a[i] + (b[i] || 0)); return o; }
  function mul(a, s) { if (typeof a === 'number') return a * s; var o = [], i; for (i = 0; i < a.length; i++) o.push(a[i] * s); return o; }

  // Builds the keyframe plan of a preset; the end state is always the object's current look.
  function plan(name, L, c, t0, t1, opt) {
    var P = [], d = t1 - t0, pos, p, v, i, n;
    function track(target, keys) { var pr = resolve(L, target); if (pr) P.push({ prop: pr, keys: keys, target: target }); }
    function from(target, startV) { var pr = resolve(L, target); if (!pr) return; var e = cur(pr, c, t1); track(target, [{ t: t0, v: typeof startV === 'function' ? startV(e) : startV }, { t: t1, v: e }]); }
    var amt = T.num(opt.amount, 1);
    switch (name) {
      case 'reveal3d':
        from('ry', function (e) { return e - 90 * amt; });
        from('opacity', 0);
        from('position', function (e) { return add(e, [0, 0, 600 * amt]); });
        break;
      case 'smoothRotation':
        p = resolve(L, 'ry'); v = cur(p, c, t0);
        track('ry', [{ t: t0, v: v }, { t: t1, v: v + 360 * amt }]);
        break;
      case 'entrance':
        from('position', function (e) { return add(e, [0, 220 * amt, 0]); });
        from('opacity', 0);
        from('rx', function (e) { return e + 35 * amt; });
        break;
      case 'floating':
        p = resolve(L, 'position'); v = cur(p, c, t0); n = 4;
        var keys = [];
        for (i = 0; i <= n; i++) keys.push({ t: t0 + d * i / n, v: add(v, [0, (i % 2 ? (i === 1 ? -1 : 1) : 0) * 24 * amt, 0]) });
        track('position', keys);
        p = resolve(L, 'ry'); v = cur(p, c, t0);
        track('ry', [{ t: t0, v: v - 6 * amt }, { t: t0 + d / 2, v: v + 6 * amt }, { t: t1, v: v - 6 * amt }]);
        break;
      case 'cinematic':
        from('rx', function (e) { return e - 25 * amt; });
        from('ry', function (e) { return e + 40 * amt; });
        from('opacity', 0);
        from('depth', 0);
        var cam = findCam(c);
        if (cam) {
          var cp = cam.property('ADBE Transform Group').property('ADBE Position'), ce = cur(cp, c, t1);
          P.push({ prop: cp, keys: [{ t: t0, v: add(ce, [0, 0, -900 * amt]) }, { t: t1, v: ce }], target: 'camera' });
        }
        break;
      case 'popUp':
        from('scale', function (e) { return mul(e, 0); });
        from('opacity', 0);
        opt.ease = 'overshoot';
        break;
      case 'scaleReveal':
        from('scale', function (e) { return mul(e, 0.2); });
        from('opacity', 0);
        break;
      case 'spin3d':
        p = resolve(L, 'ry'); v = cur(p, c, t1);
        track('ry', [{ t: t0, v: v - 360 * amt }, { t: t1, v: v }]);
        from('scale', function (e) { return mul(e, 0.6); });
        break;
      case 'extrudeGrow': from('depth', 0); break;
      case 'bevelGrow': from('bevel', 0); break;
      case 'colorShift':
        if (opt.color) track('FrontColor', [{ t: t0, v: [opt.color[0], opt.color[1], opt.color[2]] }, { t: t1, v: cur(resolve(L, 'FrontColor'), c, t1) }]);
        break;
    }
    return P;
  }
  function findCam(c) { var i; for (i = 1; i <= c.numLayers; i++) if (T.isCamera(c.layer(i)) && c.layer(i).enabled) return c.layer(i); return null; }

  // a: { refs, preset, start, duration, ease, speed, amount, replace, color }
  M.applyPreset = function (a) {
    var c = T.requireComp(), refs = a.refs || [a.ref], i, j, L, P, total = 0;
    var speed = Math.max(0.1, T.num(a.speed, 1));
    var t0 = T.num(a.start, c.time), dur = Math.max(1 / c.frameRate, T.num(a.duration, 1.5) / speed);
    var stagger = T.num(a.stagger, 0);
    T.undo('Animation: ' + a.preset, function () {
      for (i = 0; i < refs.length; i++) {
        L = T.requireLayer(c, refs[i]);
        var s = t0 + stagger * i;
        var opt = { amount: a.amount, color: a.color, ease: a.ease || 'ease' };
        P = plan(a.preset, L, c, s, s + dur, opt);
        if (!P.length) T.fail('PRESET_NA', 'This preset does not apply to this object');
        for (j = 0; j < P.length; j++) total += writeKeys(P[j].prop, P[j].keys, opt.ease, a.replace !== false);
      }
    });
    return { keys: total, end: t0 + dur + stagger * (refs.length - 1) };
  };

  // Custom track: any supported property from -> to.
  M.applyCustom = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), p = resolve(L, a.target), n;
    if (!p) T.fail('PROP_NA', 'This property is not available on this object');
    var speed = Math.max(0.1, T.num(a.speed, 1));
    var t0 = T.num(a.start, c.time), t1 = t0 + Math.max(1 / c.frameRate, T.num(a.duration, 1) / speed);
    T.undo('Animation: ' + a.target, function () {
      var curV = T.toArr(p.value);
      var fromV = a.from === null || a.from === undefined ? curV : a.from;
      var toV = a.to === null || a.to === undefined ? curV : a.to;
      if (p.propertyValueType === PropertyValueType.COLOR) { fromV = [fromV[0], fromV[1], fromV[2], 1]; toV = [toV[0], toV[1], toV[2], 1]; }
      n = writeKeys(p, [{ t: t0, v: fromV }, { t: t1, v: toV }], a.ease || 'ease', a.replace !== false);
    });
    return { keys: n };
  };

  M.current = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), p;
    T._undoDepth++;
    try { p = resolve(L, a.target); } finally { T._undoDepth--; }
    if (!p) T.fail('PROP_NA', 'This property is not available on this object');
    return T.toArr(p.numKeys ? p.valueAtTime(c.time, false) : p.value);
  };

  M.clear = function (a) {
    var c = T.requireComp(), L = T.requireLayer(c, a.ref), targets = a.targets || ['position', 'rx', 'ry', 'rz', 'scale', 'opacity', 'depth', 'bevel'], i, p, n = 0;
    T.undo('Clear animation', function () {
      for (i = 0; i < targets.length; i++) {
        try { p = resolve(L, targets[i]); } catch (e) { p = null; }
        if (!p || !p.numKeys) continue;
        var v = p.valueAtTime(c.time, false);
        while (p.numKeys) { p.removeKey(1); n++; }
        p.setValue(v);
      }
    });
    return { removed: n };
  };

  T.modules.anim = M;
})($.global.TS3D);
