/* One-click auto trace for raster logos (PNG / JPG / PSD previews ...).
   Marching squares on alpha or brightness -> closed loops -> simplified -> smooth beziers with sharp
   corners kept -> even-odd nesting so holes (inside O, A, Arabic letters...) come out right. */
(function () {
  var MAX = 1400;

  function loadImage(file) {
    return new Promise(function (ok, no) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { no(new Error('image')); };
      img.src = /^(https?:|data:|blob:)/.test(file) ? file : 'file:///' + encodeURI(file.replace(/\\/g, '/')).replace(/#/g, '%23');
    });
  }

  // Returns { field: Float32Array (0..1 inside), w, h, scale, img, hasAlpha }
  function sample(img, opt) {
    var k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.max(2, Math.round(img.naturalWidth * k)), h = Math.max(2, Math.round(img.naturalHeight * k));
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0, w, h);
    var d = cx.getImageData(0, 0, w, h).data, n = w * h, i, a, lum, hasAlpha = false;
    for (i = 0; i < n; i += 7) if (d[i * 4 + 3] < 250) { hasAlpha = true; break; }
    var mode = opt.channel === 'auto' ? (hasAlpha ? 'alpha' : 'dark') : opt.channel;
    var f = new Float32Array(n);
    for (i = 0; i < n; i++) {
      a = d[i * 4 + 3] / 255;
      lum = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      var v = mode === 'alpha' ? a : (mode === 'light' ? lum * a : (1 - lum) * a);
      f[i] = opt.invert ? 1 - v : v;
    }
    return { field: f, w: w, h: h, scale: 1 / k, img: img, mode: mode };
  }

  // Marching squares on a 1px zero-padded grid; segments linked into closed loops by shared edges.
  function contours(S, th) {
    var w = S.w + 2, h = S.h + 2, f = S.field;
    function val(x, y) { x -= 1; y -= 1; return (x < 0 || y < 0 || x >= S.w || y >= S.h) ? 0 : f[y * S.w + x]; }
    var pts = {}, adj = {};
    function ek(t, x, y) { return t + x + ',' + y; }
    function pt(t, x, y, va, vb) {
      var key = ek(t, x, y);
      if (!pts[key]) {
        var u = (th - va) / ((vb - va) || 1e-6);
        u = Math.max(0, Math.min(1, u));
        pts[key] = t === 'h' ? [x + u - 1, y - 1] : [x - 1, y + u - 1];
      }
      return key;
    }
    function link(a, b) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); }
    var x, y;
    for (y = 0; y < h - 1; y++) {
      for (x = 0; x < w - 1; x++) {
        var a = val(x, y), b = val(x + 1, y), c = val(x + 1, y + 1), d = val(x, y + 1);
        var idx = (a >= th ? 8 : 0) | (b >= th ? 4 : 0) | (c >= th ? 2 : 0) | (d >= th ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        var T = function () { return pt('h', x, y, a, b); }, R = function () { return pt('v', x + 1, y, b, c); },
            B = function () { return pt('h', x, y + 1, d, c); }, L = function () { return pt('v', x, y, a, d); };
        switch (idx) {
          case 1: case 14: link(L(), B()); break;
          case 2: case 13: link(B(), R()); break;
          case 3: case 12: link(L(), R()); break;
          case 4: case 11: link(T(), R()); break;
          case 6: case 9: link(T(), B()); break;
          case 7: case 8: link(L(), T()); break;
          case 5: link(L(), T()); link(B(), R()); break;
          case 10: link(T(), R()); link(L(), B()); break;
        }
      }
    }
    var used = {}, loops = [];
    Object.keys(adj).forEach(function (start) {
      if (used[start]) return;
      var loop = [], prev = null, cur = start, guard = 0;
      while (cur && !used[cur] && guard++ < 2e6) {
        used[cur] = 1; loop.push(pts[cur]);
        var nb = adj[cur], next = null;
        for (var i = 0; i < nb.length; i++) if (nb[i] !== prev && !used[nb[i]]) { next = nb[i]; break; }
        prev = cur; cur = next;
      }
      if (loop.length > 2) loops.push(loop);
    });
    return loops;
  }

  function area(p) { var s = 0, i, j; for (i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return s / 2; }
  function inside(q, poly) {
    var c = false, i, j;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if (((poly[i][1] > q[1]) !== (poly[j][1] > q[1])) && (q[0] < (poly[j][0] - poly[i][0]) * (q[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c;
    }
    return c;
  }
  // Ramer-Douglas-Peucker on a closed loop
  function simplify(p, tol) {
    if (p.length < 8 || tol <= 0) return p;
    var far = 0, fi = 0, i;
    for (i = 1; i < p.length; i++) { var dd = Math.pow(p[i][0] - p[0][0], 2) + Math.pow(p[i][1] - p[0][1], 2); if (dd > far) { far = dd; fi = i; } }
    function rdp(pts) {
      if (pts.length < 3) return pts;
      var a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1e-6, md = 0, mi = 0;
      for (var k = 1; k < pts.length - 1; k++) {
        var dist = Math.abs(dy * pts[k][0] - dx * pts[k][1] + b[0] * a[1] - b[1] * a[0]) / len;
        if (dist > md) { md = dist; mi = k; }
      }
      if (md <= tol) return [a, b];
      var l = rdp(pts.slice(0, mi + 1)), r = rdp(pts.slice(mi));
      return l.slice(0, -1).concat(r);
    }
    var A = rdp(p.slice(0, fi + 1)), B = rdp(p.slice(fi).concat([p[0]]));
    return A.slice(0, -1).concat(B.slice(0, -1));
  }
  // Smooth tangents (Catmull-Rom) except at sharp corners, so logos keep their crisp angles.
  function bezier(p, corner) {
    var n = p.length, inT = [], outT = [], i, cos = Math.cos(corner * Math.PI / 180);
    for (i = 0; i < n; i++) {
      var a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
      var v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
      var l1 = Math.hypot(v1[0], v1[1]) || 1e-6, l2 = Math.hypot(v2[0], v2[1]) || 1e-6;
      var dot = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
      if (dot < cos) { inT.push([0, 0]); outT.push([0, 0]); continue; }
      var tx = (c[0] - a[0]) / 6, ty = (c[1] - a[1]) / 6, tl = Math.hypot(tx, ty) || 1e-6;
      inT.push([-tx * Math.min(1, l1 / 3 / tl), -ty * Math.min(1, l1 / 3 / tl)]);
      outT.push([tx * Math.min(1, l2 / 3 / tl), ty * Math.min(1, l2 / 3 / tl)]);
    }
    return { i: inT, o: outT };
  }

  // opt: channel auto|alpha|dark|light, threshold 0..1, smooth px, minArea px, corner deg, invert
  function run(S, opt) {
    var loops = contours(S, opt.threshold), minA = opt.minArea || 0;
    var polys = loops.map(function (l) { var s = simplify(l, opt.smooth); return { p: s, a: Math.abs(area(s)) }; })
      .filter(function (o) { return o.p.length > 2 && o.a >= minA; }).sort(function (a, b) { return b.a - a.a; });
    polys.forEach(function (o, i) {
      o.depth = 0;
      for (var k = i - 1; k >= 0; k--) if (inside(o.p[0], polys[k].p)) { o.depth = polys[k].depth + 1; break; }
      o.hole = o.depth % 2 === 1;
      o.bz = bezier(o.p, opt.corner || 55);
    });
    return polys;
  }

  // Image pixel -> comp coordinates (layer origin, scale, Z rotation from the host).
  function toComp(polys, S, place) {
    var rz = (place.rotation || 0) * Math.PI / 180, cs = Math.cos(rz), sn = Math.sin(rz);
    var sx = S.scale * place.scale[0], sy = S.scale * place.scale[1];
    function map(pt) { var x = pt[0] * sx, y = pt[1] * sy; return [place.origin[0] + x * cs - y * sn, place.origin[1] + x * sn + y * cs]; }
    function vec(t) { var x = t[0] * sx, y = t[1] * sy; return [x * cs - y * sn, x * sn + y * cs]; }
    return polys.map(function (o) {
      return { v: o.p.map(map), i: o.bz.i.map(vec), o: o.bz.o.map(vec), c: true, hole: o.hole };
    });
  }

  function draw(canvas, S, polys) {
    var W = canvas.clientWidth || 260, H = canvas.clientHeight || 150, dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var cx = canvas.getContext('2d'), k = Math.min(W / S.w, H / S.h) * 0.92, ox = (W - S.w * k) / 2, oy = (H - S.h * k) / 2;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    cx.globalAlpha = 0.25; cx.drawImage(S.img, ox, oy, S.w * k, S.h * k); cx.globalAlpha = 1;
    cx.beginPath();
    polys.forEach(function (o) {
      var p = o.p, n = p.length;
      cx.moveTo(ox + p[0][0] * k, oy + p[0][1] * k);
      for (var i = 0; i < n; i++) {
        var a = p[i], b = p[(i + 1) % n];
        cx.bezierCurveTo(ox + (a[0] + o.bz.o[i][0]) * k, oy + (a[1] + o.bz.o[i][1]) * k,
          ox + (b[0] + o.bz.i[(i + 1) % n][0]) * k, oy + (b[1] + o.bz.i[(i + 1) % n][1]) * k, ox + b[0] * k, oy + b[1] * k);
      }
      cx.closePath();
    });
    cx.fillStyle = 'rgba(143, 61, 255, .35)'; cx.fill('evenodd');
    cx.strokeStyle = '#c98bff'; cx.lineWidth = 1.2; cx.stroke();
  }

  window.Tracer = { load: loadImage, sample: sample, run: run, toComp: toComp, draw: draw };
})();
