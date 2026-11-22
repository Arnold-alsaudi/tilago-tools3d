/* Interactive 3D viewport (Three.js). Built from the real scene: glyph outlines come from After Effects'
   own "Create Shapes from Text", and transforms / camera / lights / colors from the comp. */
(function () {
  var THREE = window.THREE;
  var V = { ready: false };
  var renderer, scene, persp, ortho, cam, controls, root, grid, envTex, pmrem, defaultLights, frameReq = 0;
  var objects = {}, outlineCache = {}, lightsGroup, compInfo = { w: 1920, h: 1080 }, snapshot = null;
  var shading = 'material', view = 'persp', quality = 'mid', selected = null, moveMode = false;
  var host, onSelect, onMove, onViewChange;

  /* ---------- AE <-> three coordinates ----------
     AE: x right, y down, z away from viewer, origin top-left of comp.
     three: x right, y up, z toward viewer, origin comp center. */
  function aeToThree(p) { return new THREE.Vector3(p[0] - compInfo.w / 2, -(p[1] - compInfo.h / 2), -(p[2] || 0)); }
  function threeToAe(v) { return [v.x + compInfo.w / 2, -v.y + compInfo.h / 2, -v.z]; }
  var D2R = Math.PI / 180;

  V.init = function (el, opts) {
    host = el; onSelect = opts.onSelect; onMove = opts.onMove; onViewChange = opts.onViewChange;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
    } catch (e) { return false; }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15131b);

    persp = new THREE.PerspectiveCamera(39.6, 1, 5, 200000);
    ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100000, 100000);
    cam = persp;
    persp.position.set(0, 0, 2666);

    root = new THREE.Group(); scene.add(root);
    lightsGroup = new THREE.Group(); scene.add(lightsGroup);

    grid = new THREE.GridHelper(4000, 40, 0x3a3450, 0x24212f);
    grid.position.y = -compInfo.h / 2;
    grid.material.transparent = true; grid.material.opacity = 0.55;
    scene.add(grid);

    defaultLights = new THREE.Group();
    var hemi = new THREE.HemisphereLight(0xffffff, 0x2a2440, 0.65);
    var head = new THREE.DirectionalLight(0xffffff, 0.9); head.position.set(-0.4, 0.6, 1);
    defaultLights.add(hemi); defaultLights.add(head); scene.add(defaultLights);

    pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(studioEnv(), 0.04).texture;
    scene.environment = envTex;

    makeControls();
    bindPointer();
    window.addEventListener('resize', V.resize);
    if (window.ResizeObserver) new ResizeObserver(V.resize).observe(el);
    V.resize();
    V.ready = true;
    request();
    return true;
  };

  // Small procedural studio so metals have something to reflect in the preview.
  function studioEnv() {
    var s = new THREE.Scene(), geo = new THREE.BoxGeometry(1, 1, 1);
    var room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: 0x24202e, side: THREE.BackSide }));
    s.add(room);
    function panel(x, y, z, sx, sy, sz, c) { var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); s.add(m); }
    panel(0, 5.8, 0, 10, 0.1, 6, 0xffffff);
    panel(-9.8, 1, 0, 0.1, 5, 8, 0xd8d4ff);
    panel(9.8, 2, -2, 0.1, 4, 6, 0xfff1dc);
    panel(0, 1, -9.8, 8, 3, 0.1, 0x8f6cff);
    return s;
  }

  function makeControls() {
    var target = controls ? controls.target.clone() : new THREE.Vector3();
    if (controls) controls.dispose();
    controls = new THREE.OrbitControls(cam, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 1.1;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.addEventListener('change', function () {
      request();
      if (view === 'camera') { view = 'persp'; if (onViewChange) onViewChange(view); }
    });
    controls.addEventListener('end', function () { if (onViewChange) onViewChange(view, true); });
    controls.enableRotate = !(cam === ortho);
    controls.update();
  }

  V.resize = function () {
    if (!renderer || !host) return;
    var w = Math.max(10, host.clientWidth), h = Math.max(10, host.clientHeight);
    var pr = quality === 'high' ? Math.min(2, window.devicePixelRatio * 1.5) : (quality === 'low' ? 0.75 : Math.min(1.5, window.devicePixelRatio));
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    persp.aspect = w / h; persp.updateProjectionMatrix();
    var oh = ortho.top - ortho.bottom || 2000;
    ortho.left = -oh * w / h / 2; ortho.right = oh * w / h / 2; ortho.updateProjectionMatrix();
    request();
  };

  function request() { if (!frameReq) frameReq = requestAnimationFrame(render); }
  function render() {
    frameReq = 0;
    if (!renderer) return;
    if (controls && controls.update()) request();
    renderer.render(scene, cam);
  }

  /* ---------- geometry from AE outlines ---------- */
  function sample(c) {
    // returns a polyline of the bezier contour (AE tangents are relative to the vertex)
    var pts = [], n = c.v.length, i, seg = quality === 'high' ? 10 : (quality === 'low' ? 4 : 7);
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      if (!c.c && j === 0) break;
      var p0 = c.v[i], p3 = c.v[j], p1 = [p0[0] + c.o[i][0], p0[1] + c.o[i][1]], p2 = [p3[0] + c.i[j][0], p3[1] + c.i[j][1]];
      var straight = !c.o[i][0] && !c.o[i][1] && !c.i[j][0] && !c.i[j][1];
      var steps = straight ? 1 : seg;
      for (var s = 0; s < steps; s++) {
        var t = s / steps, u = 1 - t;
        pts.push(new THREE.Vector2(
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          -(u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1])));
      }
    }
    return pts;
  }
  function area(p) { var a = 0, i, j; for (i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x - p[i].x) * (p[j].y + p[i].y); return a / 2; }
  function inside(pt, poly) {
    var c = false, i, j;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if (((poly[i].y > pt.y) !== (poly[j].y > pt.y)) && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) c = !c;
    }
    return c;
  }
  // Even-odd nesting: robust for any font winding, Arabic dots and nested holes.
  function buildShapes(contours) {
    var polys = contours.filter(function (c) { return c.v.length > 2; }).map(function (c) { var p = sample(c); return { p: p, a: Math.abs(area(p)) }; })
      .filter(function (o) { return o.a > 0.5; }).sort(function (a, b) { return b.a - a.a; });
    polys.forEach(function (o, i) {
      o.depth = 0; o.parent = null;
      for (var k = i - 1; k >= 0; k--) {
        if (inside(o.p[0], polys[k].p)) { o.depth = polys[k].depth + 1; o.parent = polys[k]; break; }
      }
    });
    var shapes = [];
    polys.forEach(function (o) {
      if (o.depth % 2 === 0) {
        var pts = area(o.p) < 0 ? o.p.slice().reverse() : o.p;
        o.shape = new THREE.Shape(pts); shapes.push(o.shape);
      }
    });
    polys.forEach(function (o) {
      if (o.depth % 2 === 1 && o.parent && o.parent.shape) {
        var pts = area(o.p) > 0 ? o.p.slice().reverse() : o.p;
        o.parent.shape.holes.push(new THREE.Path(pts));
      }
    });
    return shapes;
  }

  // Material groups: 0 front, 1 back, 2 side, 3 bevel (same split as AE's surfaces).
  function extrude(shapes, geo) {
    var depth = Math.max(0.5, geo.depth || 0), bevel = geo.bevelStyle && geo.bevelStyle !== 'none' ? Math.min(geo.bevelDepth || 0, depth / 2 - 0.01) : 0;
    var segs = geo.bevelStyle === 'angular' ? 1 : (quality === 'high' ? 8 : 4);
    var g = new THREE.ExtrudeGeometry(shapes, {
      depth: Math.max(0.01, depth - 2 * bevel), bevelEnabled: bevel > 0.01, bevelThickness: bevel,
      bevelSize: geo.bevelStyle === 'concave' ? bevel * 0.55 : bevel, bevelOffset: -bevel, bevelSegments: segs, curveSegments: 4
    });
    // body spans z in [0, depth] in AE terms; three: front at z=0, back at -depth
    g.translate(0, 0, bevel);
    g.scale(1, 1, -1);
    g = g.toNonIndexed();
    var pos = g.attributes.position, tri = pos.count / 3, i, k, groups = [], cur = -1, start = 0;
    var front = 0, back = -depth, eps = 0.02;
    function cls(t) {
      var za = pos.getZ(t * 3), zb = pos.getZ(t * 3 + 1), zc = pos.getZ(t * 3 + 2);
      if (Math.abs(za - front) < eps && Math.abs(zb - front) < eps && Math.abs(zc - front) < eps) return 0;
      if (Math.abs(za - back) < eps && Math.abs(zb - back) < eps && Math.abs(zc - back) < eps) return 1;
      var zmax = Math.max(za, zb, zc), zmin = Math.min(za, zb, zc);
      if (bevel > 0.01 && (zmax > front - bevel - eps || zmin < back + bevel + eps)) return 3;
      return 2;
    }
    // sort triangles by class so each surface is one draw group
    var buckets = [[], [], [], []];
    for (i = 0; i < tri; i++) buckets[cls(i)].push(i);
    var src = pos.array, nrm = g.attributes.normal.array, np = new Float32Array(src.length), nn = new Float32Array(nrm.length), w = 0;
    for (k = 0; k < 4; k++) {
      start = w;
      // z was mirrored, so each triangle's winding is reversed back (vertex order 0, 2, 1)
      buckets[k].forEach(function (t) {
        var order = [0, 2, 1];
        for (var vtx = 0; vtx < 3; vtx++) for (var ax = 0; ax < 3; ax++) {
          np[w * 9 + vtx * 3 + ax] = src[t * 9 + order[vtx] * 3 + ax];
          nn[w * 9 + vtx * 3 + ax] = nrm[t * 9 + order[vtx] * 3 + ax];
        }
        w++;
      });
      if (w > start) groups.push({ start: start * 3, count: (w - start) * 3, materialIndex: k });
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(np, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    groups.forEach(function (gr) { out.addGroup(gr.start, gr.count, gr.materialIndex); });
    out.computeBoundingBox(); out.computeBoundingSphere();
    g.dispose();
    return out;
  }

  var SURF = ['Front', 'Back', 'Side', 'Bevel'];
  function surfColor(mat, s) {
    var sc = mat && mat.surfaces && mat.surfaces[s] && mat.surfaces[s].color;
    if (sc && sc.length >= 3) return sc;
    return (mat && mat.fill) || [0.85, 0.85, 0.9];
  }
  function surfVal(mat, s, k, def) {
    var v = mat && mat.surfaces && mat.surfaces[s] && mat.surfaces[s][k];
    if (typeof v === 'number') return v;
    v = mat && mat.layer && mat.layer[k];
    return typeof v === 'number' ? v : def;
  }
  function makeMaterials(o) {
    var mat = o.mat || {}, faces = (o.geo && o.geo.faces) || {};
    return SURF.map(function (s) {
      var c = surfColor(mat, s), m;
      var visible = faces[s] !== false && surfVal(mat, s, 'opacity', 100) > 0;
      if (shading === 'wire') m = new THREE.MeshBasicMaterial({ color: 0xb79cff, wireframe: true });
      else if (shading === 'shaded') m = new THREE.MeshLambertMaterial({ color: 0xbdb8c8 });
      else {
        var metal = surfVal(mat, s, 'metal', 0) / 100, shin = surfVal(mat, s, 'shininess', 40) / 100, refl = surfVal(mat, s, 'reflection', 0) / 100;
        var amb = surfVal(mat, s, 'ambient', 30) / 100, trans = surfVal(mat, s, 'transparency', 0) / 100;
        m = new THREE.MeshStandardMaterial({
          color: new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear(),
          metalness: Math.min(1, metal * 0.85 + refl * 0.15), roughness: Math.max(0.04, 1 - (shin * 0.75 + refl * 0.25)),
          envMapIntensity: 0.4 + refl * 1.4 + metal * 0.6,
          emissive: new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear().multiplyScalar(Math.max(0, amb - 0.5) * 1.2),
          transparent: trans > 0, opacity: 1 - trans * 0.85
        });
      }
      m.visible = visible;
      m.side = THREE.FrontSide;
      return m;
    });
  }

  function composeTransform(node, t) {
    // AE applies orientation, then X, Y, Z rotation; Y and Z flip sign in three's right-handed, y-up space.
    var or = t.orientation || [0, 0, 0];
    var qo = new THREE.Quaternion().setFromEuler(new THREE.Euler(or[0] * D2R, -or[1] * D2R, -or[2] * D2R, 'ZYX'));
    var qr = new THREE.Quaternion().setFromEuler(new THREE.Euler((t.rx || 0) * D2R, -(t.ry || 0) * D2R, -(t.rz || 0) * D2R, 'ZYX'));
    node.quaternion.copy(qo.multiply(qr));
    node.position.copy(aeToThree(t.position || [compInfo.w / 2, compInfo.h / 2, 0]));
    var sc = t.scale || [100, 100, 100];
    node.scale.set(sc[0] / 100, sc[1] / 100, (sc[2] === undefined ? 100 : sc[2]) / 100);
  }

  function nodeFor(ref, t, parents) {
    // parent chain -> nested groups
    var outer = new THREE.Group(), cur = outer, chain = [], p = t.parent;
    while (p && parents[p]) { chain.unshift(parents[p]); p = parents[p].parent; }
    chain.forEach(function (pt) {
      var g = new THREE.Group();
      composeTransform(g, pt);
      cur.add(g); cur = g;
      // children live in the parent's layer space: undo the comp-center offset that composeTransform adds
      var a = pt.anchor || [0, 0, 0], ag = new THREE.Group();
      ag.position.set(-a[0] + compInfo.w / 2, a[1] - compInfo.h / 2, a[2] || 0);
      cur.add(ag); cur = ag;
    });
    return { outer: outer, inner: cur };
  }

  V.setComp = function (c) {
    if (!c) return;
    compInfo = { w: c.w, h: c.h };
    if (grid) grid.position.y = -c.h / 2;
  };

  // Rebuild everything from a snapshot. Outlines are fetched lazily and cached by text hash.
  V.load = function (snap, fetchOutlines) {
    if (!V.ready || !snap || !snap.comp) return;
    snapshot = snap;
    V._fetch = fetchOutlines;
    V.setComp(snap.comp);
    var keep = {};
    (snap.objects || []).forEach(function (o) {
      keep[o.ref] = 1;
      var entry = objects[o.ref];
      var key = o.ref + '|' + o.hash;
      if (!outlineCache[key]) {
        outlineCache[key] = 'loading';
        fetchOutlines(o.ref).then(function (r) { outlineCache[key] = (r && r.contours) || []; V.load(snapshot, fetchOutlines); })
          .catch(function () { outlineCache[key] = []; });
      }
      var contours = outlineCache[key];
      if (contours === 'loading') { if (entry) applyTransform(entry, o, snap.parents || {}); return; }
      var geoKey = key + '|' + JSON.stringify(o.geo || {}) + '|' + quality;
      if (!entry || entry.geoKey !== geoKey) {
        if (entry) disposeEntry(entry);
        entry = objects[o.ref] = { ref: o.ref, geoKey: geoKey };
        var shapes = buildShapes(contours || []);
        entry.geometry = shapes.length ? extrude(shapes, o.geo && o.geo.supported ? o.geo : { depth: 1 }) : new THREE.BufferGeometry();
        entry.mesh = new THREE.Mesh(entry.geometry, makeMaterials(o));
        entry.mesh.userData.ref = o.ref;
        entry.mesh.castShadow = entry.mesh.receiveShadow = true;
        entry.edges = null;
      } else {
        entry.mesh.material.forEach(function (m) { m.dispose(); });
        entry.mesh.material = makeMaterials(o);
      }
      entry.data = o;
      applyTransform(entry, o, snap.parents || {});
      highlight(entry, o.ref === selected);
    });
    Object.keys(objects).forEach(function (ref) { if (!keep[ref]) { disposeEntry(objects[ref]); delete objects[ref]; } });
    applyLights(snap.lights || []);
    applyBg(snap.bg);
    if (view === 'camera') V.setView('camera');
    request();
  };

  function applyTransform(entry, o, parents) {
    if (entry.node) root.remove(entry.node.outer);
    entry.node = nodeFor(o.ref, o, parents);
    var self = new THREE.Group();
    composeTransform(self, o);
    var a = o.anchor || [0, 0, 0], ag = new THREE.Group();
    // contours already have the anchor's x/y removed; z anchor shifts the body
    ag.position.set(0, 0, a[2] || 0);
    ag.add(entry.mesh);
    self.add(ag);
    entry.node.inner.add(self);
    entry.self = self;
    entry.node.outer.visible = o.enabled !== false;
    root.add(entry.node.outer);
  }

  function disposeEntry(e) {
    if (e.node) root.remove(e.node.outer);
    if (e.geometry) e.geometry.dispose();
    if (e.mesh) e.mesh.material.forEach(function (m) { m.dispose(); });
    if (e.edges) { e.edges.geometry.dispose(); e.edges.material.dispose(); }
  }

  function highlight(entry, on) {
    if (!entry || !entry.mesh) return;
    if (on && !entry.edges && entry.geometry.attributes.position) {
      entry.edges = new THREE.BoxHelper(entry.mesh, 0x9a7bff);
      entry.edges.material.transparent = true; entry.edges.material.opacity = 0.7;
      scene.add(entry.edges);
    }
    if (!on && entry.edges) { scene.remove(entry.edges); entry.edges.geometry.dispose(); entry.edges.material.dispose(); entry.edges = null; }
    if (entry.edges) entry.edges.update();
  }

  function applyLights(lights) {
    while (lightsGroup.children.length) {
      var c = lightsGroup.children.pop();
      if (c.dispose) c.dispose();
    }
    var hq = quality === 'high' || shading === 'hq';
    renderer.shadowMap.enabled = hq;
    var any = false;
    lights.forEach(function (l) {
      var col = new THREE.Color(l.color ? l.color[0] : 1, l.color ? l.color[1] : 1, l.color ? l.color[2] : 1), I = (l.intensity || 100) / 100, L;
      if (l.type === 'ambient') L = new THREE.AmbientLight(col, I * 0.9);
      else if (l.type === 'parallel') { L = new THREE.DirectionalLight(col, I * 1.4); L.target.position.copy(aeToThree(l.poi || [compInfo.w / 2, compInfo.h / 2, 0])); lightsGroup.add(L.target); }
      else if (l.type === 'spot') {
        L = new THREE.SpotLight(col, I * 2.2, 0, (l.cone || 90) / 2 * D2R, 0.5, 0);
        L.target.position.copy(aeToThree(l.poi || [compInfo.w / 2, compInfo.h / 2, 0])); lightsGroup.add(L.target);
      } else if (l.type === 'point') L = new THREE.PointLight(col, I * 1.8, 0, 0);
      else return;
      if (l.position && l.type !== 'ambient') L.position.copy(aeToThree(l.position));
      if (hq && L.shadow && (l.type === 'spot' || l.type === 'parallel')) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); }
      lightsGroup.add(L); any = true;
    });
    defaultLights.visible = !any;
    scene.environment = shading === 'material' || shading === 'hq' ? envTex : null;
  }

  function applyBg(bg) {
    if (!bg || !bg.enabled || bg.type === 'transparent') { scene.background = new THREE.Color(0x15131b); return; }
    var c = bg.type === 'gradient' ? (bg.g1 || bg.color) : bg.color;
    if (c) scene.background = new THREE.Color(c[0], c[1], c[2]).convertSRGBToLinear();
  }

  /* ---------- views ---------- */
  function sceneBox() {
    var box = new THREE.Box3();
    Object.keys(objects).forEach(function (r) { if (objects[r].mesh && objects[r].node && objects[r].node.outer.visible) box.expandByObject(objects[r].mesh); });
    if (box.isEmpty()) box.set(new THREE.Vector3(-400, -200, -100), new THREE.Vector3(400, 200, 100));
    return box;
  }

  V.setView = function (name) {
    view = name;
    var box = sceneBox(), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), r = Math.max(size.x, size.y, size.z, 200);
    if (name === 'camera') {
      var ac = snapshot && snapshot.camera;
      cam = persp; makeControls();
      persp.fov = 2 * Math.atan((compInfo.h / 2) / (ac ? ac.zoom : compInfo.w * 50 / 36)) / D2R;
      persp.updateProjectionMatrix();
      if (ac) {
        persp.position.copy(aeToThree(ac.position));
        var tgt = ac.autoOrient === 'target' && ac.poi ? aeToThree(ac.poi) : persp.position.clone().add(new THREE.Vector3(0, 0, -1000));
        controls.target.copy(tgt);
      } else {
        persp.position.set(0, 0, compInfo.w * 50 / 36);
        controls.target.set(0, 0, 0);
      }
      persp.lookAt(controls.target);
      controls.update();
      view = 'camera';
      request();
      return;
    }
    var dirs = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], persp: [-0.55, 0.35, 1] };
    var d = new THREE.Vector3().fromArray(dirs[name] || dirs.persp).normalize();
    if (name === 'persp') {
      cam = persp; persp.fov = 39.6; persp.updateProjectionMatrix();
    } else {
      cam = ortho;
      var w = host.clientWidth || 1, h = host.clientHeight || 1, half = r * 0.75;
      ortho.top = half; ortho.bottom = -half; ortho.left = -half * w / h; ortho.right = half * w / h; ortho.zoom = 1; ortho.updateProjectionMatrix();
    }
    cam.position.copy(c.clone().add(d.multiplyScalar(r * 2.4)));
    cam.up.set(0, 1, 0);
    makeControls();
    controls.target.copy(c);
    cam.lookAt(c);
    controls.update();
    request();
  };

  V.fit = function () { V.setView(view === 'camera' ? 'persp' : view); };

  // AE camera values for the current view (position + point of interest + zoom).
  V.viewAsAECamera = function () {
    var p = threeToAe(persp.position), poi = threeToAe(controls.target);
    var zoom = (compInfo.h / 2) / Math.tan(persp.fov / 2 * D2R);
    return { position: p, poi: poi, zoom: zoom, autoOrient: 'target' };
  };

  V.setShading = function (s) { shading = s; if (snapshot) { Object.keys(objects).forEach(function (r) { var e = objects[r]; e.mesh.material.forEach(function (m) { m.dispose(); }); e.mesh.material = makeMaterials(e.data); }); applyLights(snapshot.lights || []); } request(); };
  V.setQuality = function (q) { quality = q; V.resize(); if (snapshot) { Object.keys(objects).forEach(function (r) { objects[r].geoKey = ''; }); } };
  V.select = function (ref) {
    if (selected && objects[selected]) highlight(objects[selected], false);
    selected = ref;
    if (ref && objects[ref]) highlight(objects[ref], true);
    request();
  };
  V.setMoveMode = function (on) { moveMode = !!on; renderer.domElement.style.cursor = on ? 'move' : ''; };

  // Local, instant updates while a slider moves (the real AE value follows through the host).
  V.patch = function (ref, part, values) {
    if (!snapshot) return;
    var o = (snapshot.objects || []).filter(function (x) { return x.ref === ref; })[0];
    if (!o) return;
    if (part === 'transform') { Object.keys(values).forEach(function (k) { o[k] = values[k]; }); var e = objects[ref]; if (e) applyTransform(e, o, snapshot.parents || {}); highlight(e, ref === selected); }
    if (part === 'geo') { o.geo = Object.assign({}, o.geo, values); }
    if (part === 'mat') {
      o.mat = o.mat || {}; o.mat.surfaces = o.mat.surfaces || {}; o.mat.layer = o.mat.layer || {};
      if (values.layer) Object.assign(o.mat.layer, values.layer);
      if (values.fill) o.mat.fill = values.fill;
      if (values.surfaces) Object.keys(values.surfaces).forEach(function (s) { o.mat.surfaces[s] = Object.assign({}, o.mat.surfaces[s], values.surfaces[s]); });
    }
    if (part === 'geo' || part === 'mat') {
      if (!V._pendingLoad) V._pendingLoad = requestAnimationFrame(function () { V._pendingLoad = 0; V.load(snapshot, V._fetch); });
    }
    request();
  };
  V.patchLights = function (lights) { if (snapshot) { snapshot.lights = lights; applyLights(lights); request(); } };
  V.patchBg = function (bg) { if (snapshot) { snapshot.bg = bg; applyBg(bg); request(); } };
  V.patchCamera = function (c) { if (snapshot) { snapshot.camera = c; if (view === 'camera') V.setView('camera'); } };

  /* ---------- picking and drag-move ---------- */
  function bindPointer() {
    var ray = new THREE.Raycaster(), down = null, dragging = null, plane = new THREE.Plane(), hit = new THREE.Vector3(), startPos = null, startHit = null;
    function ndc(ev) { var r = renderer.domElement.getBoundingClientRect(); return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); }
    function pick(ev) {
      ray.setFromCamera(ndc(ev), cam);
      var meshes = Object.keys(objects).map(function (r) { return objects[r].mesh; }).filter(function (m) { return m && m.parent && objects[m.userData.ref].node.outer.visible; });
      var h = ray.intersectObjects(meshes, false);
      return h.length ? h[0] : null;
    }
    renderer.domElement.addEventListener('pointerdown', function (ev) {
      down = { x: ev.clientX, y: ev.clientY };
      if (moveMode && ev.button === 0) {
        var h = pick(ev);
        if (h && h.object.userData.ref === selected) {
          dragging = objects[selected];
          controls.enabled = false;
          plane.setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()).negate(), h.point);
          startHit = h.point.clone();
          startPos = dragging.data.position.slice();
          renderer.domElement.setPointerCapture(ev.pointerId);
        }
      }
    });
    renderer.domElement.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      ray.setFromCamera(ndc(ev), cam);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      var d = hit.clone().sub(startHit);
      var np = [startPos[0] + d.x, startPos[1] - d.y, startPos[2] - d.z];
      V.patch(dragging.ref, 'transform', { position: np });
      if (onMove) onMove(dragging.ref, np, false);
    });
    renderer.domElement.addEventListener('pointerup', function (ev) {
      if (dragging) {
        controls.enabled = true;
        if (onMove) onMove(dragging.ref, dragging.data.position.slice(), true);
        dragging = null;
        return;
      }
      if (down && Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) < 4 && ev.button === 0) {
        var h = pick(ev);
        if (onSelect) onSelect(h ? h.object.userData.ref : null);
      }
      down = null;
    });
  }

  V.currentView = function () { return view; };
  window.Viewport = V;
})();
