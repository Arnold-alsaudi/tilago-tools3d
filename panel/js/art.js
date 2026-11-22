/* Small data-driven illustrations for preset cards: each card shows what it will actually do. */
(function () {
  var P = '#c98bff', P2 = '#7a3dff', DIM = '#4a3470';
  function svg(inner, w, h) { return '<svg class="art" viewBox="0 0 ' + (w || 56) + ' ' + (h || 36) + '" aria-hidden="true">' + inner + '</svg>'; }
  function hex(c) { return c ? '#' + c.slice(0, 3).map(function (v) { var x = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return x.length < 2 ? '0' + x : x; }).join('') : P; }

  // Side profile of the extruded letter: thickness = depth, edge shape = bevel style.
  function geo(v) {
    var d = Math.max(3, Math.min(40, 3 + Math.sqrt(v.depth || 0) * 2.3)), b = Math.min(v.bevelDepth || 0, 12) * 0.55, st = v.bevelStyle || 'none';
    if (st === 'none') b = 0;
    var x0 = 28 - d / 2, x1 = 28 + d / 2, y0 = 5, y1 = 31, p;
    if (!b) p = 'M' + x0 + ' ' + y0 + 'H' + x1 + 'V' + y1 + 'H' + x0 + 'Z';
    else if (st === 'angular') p = 'M' + (x0 + b) + ' ' + y0 + 'H' + (x1 - b) + 'L' + x1 + ' ' + (y0 + b) + 'V' + (y1 - b) + 'L' + (x1 - b) + ' ' + y1 + 'H' + (x0 + b) + 'L' + x0 + ' ' + (y1 - b) + 'V' + (y0 + b) + 'Z';
    else if (st === 'convex') p = 'M' + (x0 + b) + ' ' + y0 + 'H' + (x1 - b) + 'Q' + x1 + ' ' + y0 + ' ' + x1 + ' ' + (y0 + b) + 'V' + (y1 - b) + 'Q' + x1 + ' ' + y1 + ' ' + (x1 - b) + ' ' + y1 + 'H' + (x0 + b) + 'Q' + x0 + ' ' + y1 + ' ' + x0 + ' ' + (y1 - b) + 'V' + (y0 + b) + 'Q' + x0 + ' ' + y0 + ' ' + (x0 + b) + ' ' + y0 + 'Z';
    else p = 'M' + (x0 + b) + ' ' + y0 + 'H' + (x1 - b) + 'Q' + (x1 - b) + ' ' + (y0 + b) + ' ' + x1 + ' ' + (y0 + b) + 'V' + (y1 - b) + 'Q' + (x1 - b) + ' ' + (y1 - b) + ' ' + (x1 - b) + ' ' + y1 + 'H' + (x0 + b) + 'Q' + (x0 + b) + ' ' + (y1 - b) + ' ' + x0 + ' ' + (y1 - b) + 'V' + (y0 + b) + 'Q' + (x0 + b) + ' ' + (y0 + b) + ' ' + (x0 + b) + ' ' + y0 + 'Z';
    return svg('<defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="' + P + '"/><stop offset="1" stop-color="' + P2 + '"/></linearGradient></defs>' +
      '<path d="' + p + '" fill="url(#gg)" opacity=".9"/><line x1="' + x0 + '" y1="2" x2="' + x0 + '" y2="34" stroke="#fff" stroke-opacity=".5" stroke-dasharray="2 2"/>');
  }

  // Top view: object in the middle, every light where the preset puts it, in its own color.
  function lights(list) {
    var out = '<rect x="24" y="15" width="8" height="5" rx="1" fill="' + DIM + '" stroke="' + P + '" stroke-width=".8"/>', amb = false;
    list.forEach(function (l) {
      if (l.type === 'ambient') { amb = true; return; }
      var o = l.offset || [0, 0, -800], x = 28 + Math.max(-1, Math.min(1, o[0] / 1100)) * 22, y = 17.5 + Math.max(-1, Math.min(1, o[2] / 1200)) * 14;
      var c = hex(l.color), r = 1.6 + Math.min(1.6, (l.intensity || 100) / 100);
      out += '<line x1="' + x + '" y1="' + y + '" x2="28" y2="17.5" stroke="' + c + '" stroke-opacity=".35" stroke-width="1"/>' +
             '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 2.5) + '" fill="' + c + '" opacity=".18"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/>';
    });
    if (amb) out = '<rect x="2" y="2" width="52" height="32" rx="3" fill="none" stroke="' + P + '" stroke-opacity=".35" stroke-dasharray="2 3"/>' + out;
    return svg(out);
  }

  // Side view: object at center, camera where the framing puts it, aiming at the object.
  function camera(p) {
    var o = p.offset || [0, 0, -1800];
    var cx = 30 + Math.max(-1, Math.min(1, o[2] / 1900)) * 24, cy = 18 + Math.max(-1, Math.min(1, o[1] / 1400)) * 14;
    var ang = Math.atan2(18 - cy, 30 - cx), fov = Math.max(0.18, Math.min(0.75, 18 / (p.focal || 50)));
    var len = 34;
    var a1 = [cx + Math.cos(ang - fov) * len, cy + Math.sin(ang - fov) * len], a2 = [cx + Math.cos(ang + fov) * len, cy + Math.sin(ang + fov) * len];
    return svg('<path d="M' + cx + ' ' + cy + 'L' + a1[0] + ' ' + a1[1] + 'L' + a2[0] + ' ' + a2[1] + 'Z" fill="' + P + '" opacity=".14"/>' +
      '<rect x="27" y="11" width="6" height="14" rx="1" fill="' + DIM + '" stroke="' + P + '" stroke-width=".8"' + (p.rz ? ' transform="rotate(' + p.rz + ' 30 18)"' : '') + '/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + P + '"/><circle cx="' + cx + '" cy="' + cy + '" r="5.5" fill="none" stroke="' + P + '" stroke-opacity=".4"/>');
  }

  // Motion diagrams for animation presets.
  var A = {
    reveal3d: '<path d="M14 26l12-4v-12l-12 4z" fill="' + DIM + '" stroke="' + P + '" stroke-opacity=".5"/><path d="M30 26l12-4v-12l-12 4z" fill="url(#ga)"/><path d="M20 30q10 6 18-2" stroke="' + P + '" fill="none" marker-end="url(#ma)"/>',
    entrance: '<rect x="20" y="8" width="16" height="10" rx="1.5" fill="url(#ga)"/><rect x="20" y="22" width="16" height="10" rx="1.5" fill="' + DIM + '" opacity=".6"/><path d="M28 30v-9" stroke="' + P + '" marker-end="url(#ma)"/>',
    popUp: '<circle cx="28" cy="18" r="11" fill="none" stroke="' + P + '" stroke-opacity=".35" stroke-dasharray="2 2"/><circle cx="28" cy="18" r="8" fill="url(#ga)"/><circle cx="28" cy="18" r="3" fill="' + DIM + '"/>',
    scaleReveal: '<rect x="23" y="13" width="10" height="10" fill="' + DIM + '"/><rect x="16" y="6" width="24" height="24" fill="none" stroke="url(#ga)" stroke-width="2"/><path d="M33 13l5-5M23 23l-5 5" stroke="' + P + '"/>',
    spin3d: '<ellipse cx="28" cy="18" rx="18" ry="6" fill="none" stroke="' + P + '" stroke-opacity=".5"/><rect x="24" y="8" width="8" height="20" rx="1.5" fill="url(#ga)"/><path d="M44 20q2-4-2-6" stroke="' + P + '" fill="none" marker-end="url(#ma)"/>',
    smoothRotation: '<circle cx="28" cy="18" r="11" fill="none" stroke="url(#ga)" stroke-width="2" stroke-dasharray="40 30"/><path d="M38 12l1.5 4.5-4.5-.5" stroke="' + P + '" fill="none"/>',
    floating: '<path d="M6 22q7-8 14 0t14 0 14 0" stroke="' + P + '" fill="none" stroke-opacity=".6"/><rect x="22" y="8" width="12" height="9" rx="1.5" fill="url(#ga)"/>',
    cinematic: '<path d="M6 30L22 14M6 30h44" stroke="' + P + '" stroke-opacity=".4"/><circle cx="8" cy="28" r="3" fill="' + P + '"/><rect x="34" y="10" width="14" height="12" rx="1.5" fill="url(#ga)"/><path d="M13 25l14-8" stroke="' + P + '" marker-end="url(#ma)"/>',
    extrudeGrow: '<path d="M14 12h14v14H14z" fill="url(#ga)"/><path d="M28 12l10-6v14l-10 6M14 12l10-6h14" fill="' + DIM + '" stroke="' + P + '" stroke-opacity=".6"/><path d="M40 28l6-4" stroke="' + P + '" marker-end="url(#ma)"/>',
    bevelGrow: '<path d="M18 8h20l4 4v12l-4 4H18l-4-4V12z" fill="url(#ga)"/><path d="M18 8l-4 4M38 8l4 4M38 28l4-4M18 28l-4-4" stroke="#fff" stroke-opacity=".7"/>',
    colorShift: '<rect x="8" y="10" width="14" height="16" rx="2" fill="#4fd1ff"/><path d="M24 18h8" stroke="' + P + '" marker-end="url(#ma)"/><rect x="34" y="10" width="14" height="16" rx="2" fill="url(#ga)"/>'
  };
  function anim(id) {
    return svg('<defs><linearGradient id="ga" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="' + P + '"/><stop offset="1" stop-color="' + P2 + '"/></linearGradient>' +
      '<marker id="ma" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6z" fill="' + P + '"/></marker></defs>' + (A[id] || ''));
  }

  window.Art = { geo: geo, lights: lights, camera: camera, anim: anim };
})();
