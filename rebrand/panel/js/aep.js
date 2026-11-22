/* .aep reader / writer + Element 3D scene editor (runs in the panel's Node, outside After Effects).

   .aep  = one big-endian RIFX chunk tree, followed by an XMP packet (kept as-is). LIST payloads that are
           not clean chunk sequences (e.g. 'btdk') are kept as raw bytes. Round trip is byte-exact.
   E3D   = every Element 3D scene is a chunk 'aRbp' whose payload is "EMS" + version byte, then flat
           records: u16 LE id, u16 LE length, value. Field map (found from real projects):
             0x0032 environment map path       0x0085 bevel scale (f32)
             0x01f5 material name (starts a material block)
             0x028c material diffuse color, RGBA8
             0x02bc texture slot index (0 diffuse, 1 glossiness, 2 reflectivity, 3 illumination,
                    4 normal bump, 5 occlusion, 6 environment), 0x02bd its file path, 0x02be on/off */
(function () {
  var node = typeof require === 'function' ? require : null;
  var fs = node ? node('fs') : null;

  function u32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
  function w32(n) { var b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b; }
  function tag(b, o) { return b.toString('latin1', o, o + 4); }

  function parse(d, off, end) {
    var out = [];
    while (off + 8 <= end) {
      var t = tag(d, off), size = u32(d, off + 4), body = off + 8;
      if (body + size > end) return null;
      if (t === 'LIST') {
        var kids = parse(d, body + 4, body + size);
        out.push(kids ? { tag: t, type: tag(d, body), kids: kids } : { tag: t, data: d.slice(body, body + size) });
      } else out.push({ tag: t, data: d.slice(body, body + size) });
      off = body + size + (size & 1);
    }
    return off === end ? out : null;
  }
  function build(nodes) {
    var parts = [];
    nodes.forEach(function (n) {
      var body = n.kids ? Buffer.concat([Buffer.from(n.type, 'latin1'), build(n.kids)]) : n.data;
      parts.push(Buffer.from(n.tag, 'latin1'), w32(body.length), body);
      if (body.length & 1) parts.push(Buffer.alloc(1));
    });
    return Buffer.concat(parts);
  }
  function load(file) {
    var d = fs.readFileSync(file);
    if (tag(d, 0) !== 'RIFX' || tag(d, 8) !== 'Egg!') throw new Error('Not an After Effects project');
    var size = u32(d, 4), end = 8 + size + (size & 1);
    var kids = parse(d, 12, 8 + size);
    if (!kids) throw new Error('Project structure not recognised');
    var tree = { root: { tag: 'RIFX', type: 'Egg!', kids: kids }, tail: d.slice(end), original: d };
    if (!save(tree).equals(d)) throw new Error('Project would not round-trip exactly; not touching it');
    return tree;
  }
  function save(tree) { return Buffer.concat([build([tree.root]), tree.tail]); }
  function walk(nodes, fn) { nodes.forEach(function (n) { if (n.kids) walk(n.kids, fn); else fn(n); }); }

  /* ---------- Element 3D scene records ---------- */
  function readTLV(b) {
    if (b.toString('latin1', 0, 3) !== 'EMS') return null;
    var i = 4, r = [];
    while (i + 4 <= b.length) {
      var id = b.readUInt16LE(i), len = b.readUInt16LE(i + 2);
      if (i + 4 + len > b.length) return null;
      r.push({ id: id, v: b.slice(i + 4, i + 4 + len) });
      i += 4 + len;
    }
    return i === b.length ? { head: b.slice(0, 4), recs: r } : null;
  }
  function writeTLV(s) {
    var parts = [s.head];
    s.recs.forEach(function (r) { var h = Buffer.alloc(4); h.writeUInt16LE(r.id, 0); h.writeUInt16LE(r.v.length, 2); parts.push(h, r.v); });
    return Buffer.concat(parts);
  }
  function str(v) { var z = v.indexOf(0); return v.toString('utf8', 0, z < 0 ? v.length : z); }
  function cstr(s) { return Buffer.concat([Buffer.from(s, 'utf8'), Buffer.alloc(1)]); }
  var SLOTS = ['Diffuse', 'Glossiness', 'Reflectivity', 'Illumination', 'Normal Bump', 'Occlusion', 'Environment'];

  // Summary of one scene: materials (name, color, textures) + environment.
  function describe(s) {
    var out = { env: null, materials: [] }, mat = null, slot = null;
    s.recs.forEach(function (r) {
      if (r.id === 0x0032) out.env = str(r.v);
      if (r.id === 0x01f5) { mat = { name: str(r.v), color: null, textures: [] }; out.materials.push(mat); }
      if (!mat) return;
      if (r.id === 0x028c && r.v.length === 4) mat.color = [r.v[0] / 255, r.v[1] / 255, r.v[2] / 255];
      if (r.id === 0x02bc && r.v.length === 4) slot = r.v.readUInt32LE(0);
      if (r.id === 0x02bd && slot !== null && slot < SLOTS.length) {
        var p = str(r.v);
        if (p) mat.textures.push({ slot: slot, name: SLOTS[slot], path: p });
      }
    });
    return out;
  }

  // Scans a project file: every full Element 3D scene, grouped by identical content.
  function scan(file) {
    var tree = load(file), scenes = [], byKey = {};
    walk(tree.root.kids, function (n) {
      if (n.tag !== 'aRbp') return;
      var s = readTLV(n.data);
      if (!s) return;
      var d = describe(s);
      if (!d.materials.length) return; // small helper blocks carry no materials
      var key = n.data.toString('base64');
      if (byKey[key]) { byKey[key].copies++; return; }
      d.copies = 1; d.index = scenes.length; byKey[key] = d; scenes.push(d);
    });
    return { scenes: scenes };
  }

  // edits: { materials: { [name]: { color:[r,g,b] , textures:{ [slot]: path } } }, env: path|null }
  function apply(src, dst, edits) {
    var tree = load(src), count = { colors: 0, textures: 0, env: 0, scenes: 0 };
    walk(tree.root.kids, function (n) {
      if (n.tag !== 'aRbp') return;
      var s = readTLV(n.data);
      if (!s) return;
      var mat = null, slot = null, touched = false;
      s.recs.forEach(function (r) {
        if (r.id === 0x0032 && edits.env) { r.v = cstr(edits.env); count.env++; touched = true; }
        if (r.id === 0x01f5) { mat = edits.materials ? edits.materials[str(r.v)] : null; slot = null; }
        if (!mat) return;
        if (r.id === 0x028c && mat.color && r.v.length === 4) {
          r.v = Buffer.from([Math.round(mat.color[0] * 255), Math.round(mat.color[1] * 255), Math.round(mat.color[2] * 255), r.v[3]]);
          count.colors++; touched = true;
        }
        if (r.id === 0x02bc && r.v.length === 4) slot = r.v.readUInt32LE(0);
        if (r.id === 0x02bd && mat.textures && slot !== null && mat.textures[slot]) { r.v = cstr(mat.textures[slot]); count.textures++; touched = true; }
        if (r.id === 0x02be && mat.textures && slot !== null && mat.textures[slot] && r.v.length === 1) r.v = Buffer.from([1]);
      });
      if (touched) { n.data = writeTLV(s); count.scenes++; }
    });
    var out = save(tree);
    var tmp = dst + '.tmp';
    fs.writeFileSync(tmp, out);
    // verify what we wrote reads back cleanly before it replaces anything
    load(tmp);
    fs.renameSync(tmp, dst);
    return count;
  }

  var Aep = { available: !!fs, scan: scan, apply: apply, SLOTS: SLOTS };
  if (typeof window !== 'undefined') window.Aep = Aep;
  if (typeof module !== 'undefined' && module.exports && typeof window === 'undefined') module.exports = Aep;
})();
