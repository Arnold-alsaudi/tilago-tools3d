/* Built-in presets. Values are real After Effects property values (percent, pixels, degrees).
   Material presets only touch properties AE has; unsupported ones are skipped and reported. */
(function () {
  function hex(h) {
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
  }
  function surf(front, bevel, side, back) {
    return { Front: { color: hex(front) }, Bevel: { color: hex(bevel) }, Side: { color: hex(side) }, Back: { color: hex(back || side) } };
  }
  function L(o) {
    var base = { ambient: 30, diffuse: 60, specular: 50, shininess: 40, metal: 0, reflection: 0, gloss: 70, fresnel: 0, transparency: 0, castsShadows: true, acceptsShadows: true, acceptsLights: true };
    for (var k in o) base[k] = o[k];
    return base;
  }

  var material = [
    { id: 'gold', ar: 'ذهب', en: 'Gold', swatch: ['#FFE29A', '#C7902F', '#6E4A12'], layer: L({ metal: 100, specular: 85, shininess: 70, reflection: 55, gloss: 85, diffuse: 55 }), surfaces: surf('#F2C25B', '#FFE08A', '#B47E22', '#7A5413') },
    { id: 'silver', ar: 'فضة', en: 'Silver', swatch: ['#FFFFFF', '#B9BEC6', '#5D636C'], layer: L({ metal: 100, specular: 80, shininess: 65, reflection: 50, gloss: 80, diffuse: 55 }), surfaces: surf('#D7DBE0', '#F4F6F8', '#9AA1AA', '#6C727B') },
    { id: 'chrome', ar: 'كروم', en: 'Chrome', swatch: ['#FFFFFF', '#8E949C', '#1E2228'], layer: L({ metal: 100, specular: 100, shininess: 95, reflection: 100, gloss: 100, diffuse: 20, fresnel: 20 }), surfaces: surf('#C8CDD3', '#FFFFFF', '#8A9098', '#5A6068') },
    { id: 'rosegold', ar: 'روز جولد', en: 'Rose gold', swatch: ['#FFD9CF', '#C9877A', '#6E3A33'], layer: L({ metal: 100, specular: 80, shininess: 70, reflection: 45, gloss: 85 }), surfaces: surf('#E8A898', '#FFD2C5', '#A86656', '#7A453A') },
    { id: 'copper', ar: 'نحاس', en: 'Copper', swatch: ['#FFC49A', '#B8642E', '#5A2A0E'], layer: L({ metal: 100, specular: 80, shininess: 60, reflection: 40, gloss: 75 }), surfaces: surf('#D6844A', '#F7AE78', '#9A4E20', '#6A3414') },
    { id: 'glass', ar: 'زجاج', en: 'Glass', swatch: ['#F4FBFF', '#A9D3EA', '#2D5A75'], layer: L({ transparency: 85, transRolloff: 60, ior: 1.5, reflection: 35, fresnel: 60, specular: 100, shininess: 90, diffuse: 20, castsShadows: false, lightTrans: 80 }), surfaces: surf('#DDEFF8', '#FFFFFF', '#BFE0EF', '#BFE0EF'), needs: ['transparency'] },
    { id: 'plastic', ar: 'بلاستيك', en: 'Plastic', swatch: ['#FF9DA8', '#E2384D', '#7A1020'], layer: L({ specular: 55, shininess: 45, diffuse: 75, reflection: 8 }), surfaces: surf('#E2384D', '#FF6B7D', '#B3172B', '#8A0F1F') },
    { id: 'rubber', ar: 'مطاط', en: 'Rubber', swatch: ['#5A5A60', '#2A2A2E', '#121214'], layer: L({ specular: 6, shininess: 5, diffuse: 85, reflection: 0, ambient: 25 }), surfaces: surf('#2C2C31', '#3A3A40', '#1E1E22', '#18181B') },
    { id: 'holo', ar: 'هولوجرافيك (تقريبي)', en: 'Holographic (approx.)', swatch: ['#B5F2FF', '#E5B3FF', '#9CFFD3'], layer: L({ metal: 100, specular: 90, shininess: 85, reflection: 60, gloss: 90, fresnel: 50 }), surfaces: surf('#BFEFFF', '#F0B8FF', '#A8FFD8', '#FFD7A8') },
    { id: 'glossy', ar: 'لامع', en: 'Glossy', swatch: ['#C8B5FF', '#5416B5', '#22084D'], layer: L({ specular: 90, shininess: 85, diffuse: 70, reflection: 25, gloss: 90, fresnel: 30 }), surfaces: surf('#5416B5', '#8A5BE6', '#3A0E82', '#2A0A5E') },
    { id: 'matte', ar: 'مطفي', en: 'Matte', swatch: ['#E8E4DC', '#B9B2A5', '#6E685D'], layer: L({ specular: 0, shininess: 5, diffuse: 95, reflection: 0, ambient: 30 }), surfaces: surf('#E6E1D6', '#F2EEE6', '#B8B0A2', '#8E877A') },
    { id: 'neon', ar: 'مضيء (Neon)', en: 'Emissive (Neon)', swatch: ['#FFFFFF', '#B57BFF', '#5416B5'], layer: L({ ambient: 100, diffuse: 100, specular: 20, shininess: 30, castsShadows: false, acceptsShadows: false }), surfaces: surf('#C69BFF', '#FFFFFF', '#8A4DFF', '#5416B5') },
    { id: 'tilago', ar: 'بنفسجي Tilago', en: 'Tilago purple', swatch: ['#B794FF', '#5416B5', '#1E0846'], layer: L({ metal: 60, specular: 80, shininess: 70, reflection: 30, gloss: 85 }), surfaces: surf('#5416B5', '#B794FF', '#2E0A6E', '#1E0846') },
    { id: 'marble', ar: 'أبيض سيراميك', en: 'White ceramic', swatch: ['#FFFFFF', '#E9ECEF', '#A7ADB3'], layer: L({ specular: 70, shininess: 75, diffuse: 85, reflection: 15, gloss: 85, fresnel: 40 }), surfaces: surf('#F4F5F7', '#FFFFFF', '#D5D9DE', '#C3C8CE') }
  ];

  var geometry = [
    { id: 'flat', ar: 'رفيع جداً', en: 'Thin', values: { depth: 8, bevelStyle: 'angular', bevelDepth: 1, holeBevel: 100 } },
    { id: 'classic', ar: 'كلاسيك', en: 'Classic', values: { depth: 50, bevelStyle: 'angular', bevelDepth: 3, holeBevel: 100 } },
    { id: 'title', ar: 'عنوان سميك', en: 'Bold title', values: { depth: 120, bevelStyle: 'convex', bevelDepth: 6, holeBevel: 100 } },
    { id: 'logo', ar: 'لوجو عميق', en: 'Deep logo', values: { depth: 220, bevelStyle: 'angular', bevelDepth: 8, holeBevel: 80 } },
    { id: 'soft', ar: 'حواف ناعمة', en: 'Soft edges', values: { depth: 80, bevelStyle: 'convex', bevelDepth: 12, holeBevel: 100 } },
    { id: 'carved', ar: 'محفور', en: 'Carved', values: { depth: 90, bevelStyle: 'concave', bevelDepth: 10, holeBevel: 100 } },
    { id: 'block', ar: 'بلوك', en: 'Block', values: { depth: 300, bevelStyle: 'none', bevelDepth: 0, holeBevel: 100 } }
  ];

  // Light offsets are pixels from the comp center (negative Z = toward the camera).
  var lighting = [
    { id: 'studio', key: 'lp.studio', lights: [
      { name: 'Key', type: 'spot', offset: [-700, -600, -1100], intensity: 110, color: [1, 0.97, 0.92], cone: 70, feather: 60, shadows: true, shadowDark: 60, shadowDiff: 40 },
      { name: 'Fill', type: 'point', offset: [800, -200, -900], intensity: 45, color: [0.85, 0.9, 1] },
      { name: 'Ambient', type: 'ambient', intensity: 18, color: [1, 1, 1] }] },
    { id: 'cinematic', key: 'lp.cinematic', lights: [
      { name: 'Key warm', type: 'spot', offset: [-900, -300, -800], intensity: 130, color: [1, 0.78, 0.55], cone: 60, feather: 80, shadows: true, shadowDark: 75, shadowDiff: 60 },
      { name: 'Rim cool', type: 'spot', offset: [700, -500, 900], intensity: 160, color: [0.45, 0.65, 1], cone: 50, feather: 70 },
      { name: 'Ambient', type: 'ambient', intensity: 8, color: [0.6, 0.7, 1] }] },
    { id: 'softbox', key: 'lp.softbox', lights: [
      { name: 'Softbox', type: 'point', offset: [0, -900, -900], intensity: 100, color: [1, 1, 1], shadows: true, shadowDark: 40, shadowDiff: 120 },
      { name: 'Bounce', type: 'point', offset: [0, 700, -600], intensity: 30, color: [1, 0.98, 0.95] },
      { name: 'Ambient', type: 'ambient', intensity: 25, color: [1, 1, 1] }] },
    { id: 'dramatic', key: 'lp.dramatic', lights: [
      { name: 'Top', type: 'spot', offset: [0, -1200, -300], intensity: 170, color: [1, 0.95, 0.9], cone: 45, feather: 50, shadows: true, shadowDark: 90, shadowDiff: 20 },
      { name: 'Ambient', type: 'ambient', intensity: 4, color: [1, 1, 1] }] },
    { id: 'product', key: 'lp.product', lights: [
      { name: 'Key', type: 'spot', offset: [-600, -700, -1000], intensity: 100, color: [1, 1, 1], cone: 80, feather: 90, shadows: true, shadowDark: 45, shadowDiff: 80 },
      { name: 'Fill', type: 'point', offset: [700, -100, -1000], intensity: 55, color: [1, 1, 1] },
      { name: 'Back', type: 'spot', offset: [0, -600, 1000], intensity: 90, color: [1, 1, 1], cone: 70, feather: 80 },
      { name: 'Ambient', type: 'ambient', intensity: 20, color: [1, 1, 1] }] },
    { id: 'threePoint', key: 'lp.threePoint', lights: [
      { name: 'Key', type: 'spot', offset: [-800, -500, -900], intensity: 120, color: [1, 0.96, 0.9], cone: 65, feather: 60, shadows: true, shadowDark: 65, shadowDiff: 50 },
      { name: 'Fill', type: 'point', offset: [800, -150, -800], intensity: 40, color: [0.9, 0.94, 1] },
      { name: 'Back', type: 'spot', offset: [300, -700, 900], intensity: 110, color: [1, 1, 1], cone: 55, feather: 70 }] },
    { id: 'rim', key: 'lp.rim', lights: [
      { name: 'Rim left', type: 'spot', offset: [-900, -200, 700], intensity: 150, color: [0.66, 0.42, 1], cone: 55, feather: 70 },
      { name: 'Rim right', type: 'spot', offset: [900, -200, 700], intensity: 150, color: [0.42, 0.8, 1], cone: 55, feather: 70 },
      { name: 'Front soft', type: 'point', offset: [0, 0, -1200], intensity: 25, color: [1, 1, 1] }] },
    { id: 'flat', key: 'lp.flat', lights: [{ name: 'Ambient', type: 'ambient', intensity: 100, color: [1, 1, 1] }] }
  ];

  // Camera framings: camera offset from object center, plus lens.
  var camera = [
    { id: 'front', key: 'fr.front', offset: [0, 0, -1800], focal: 50 },
    { id: 'hero', key: 'fr.hero', offset: [0, 450, -1500], focal: 35 },
    { id: 'top', key: 'fr.top', offset: [0, -1300, -1300], focal: 50 },
    { id: 'threeQ', key: 'fr.threeQ', offset: [-1100, -250, -1400], focal: 50 },
    { id: 'close', key: 'fr.close', offset: [0, 0, -900], focal: 85 },
    { id: 'wide', key: 'fr.wide', offset: [0, -100, -1400], focal: 24 },
    { id: 'dutch', key: 'fr.dutch', offset: [-500, -200, -1600], focal: 50, rz: -12 }
  ];
  var lenses = [15, 20, 24, 28, 35, 50, 80, 135, 200];

  var animation = ['reveal3d', 'entrance', 'popUp', 'scaleReveal', 'spin3d', 'smoothRotation', 'floating', 'cinematic', 'extrudeGrow', 'bevelGrow', 'colorShift'];

  var environment = [
    { id: 'neutral', ar: 'محايد', en: 'Neutral', values: { exposure: 0, brightness: 0, contrast: 0, saturation: 0 } },
    { id: 'bright', ar: 'ساطع', en: 'Bright', values: { exposure: 1, brightness: 10, contrast: 5, saturation: 0 } },
    { id: 'moody', ar: 'غامق', en: 'Moody', values: { exposure: -1.2, brightness: -10, contrast: 25, saturation: -20 } },
    { id: 'vivid', ar: 'ألوان قوية', en: 'Vivid', values: { exposure: 0.3, brightness: 0, contrast: 15, saturation: 35 } },
    { id: 'mono', ar: 'أبيض وأسود', en: 'Monochrome', values: { exposure: 0, brightness: 0, contrast: 10, saturation: -100 } }
  ];

  window.Presets = { hex: hex, material: material, geometry: geometry, lighting: lighting, camera: camera, lenses: lenses, animation: animation, environment: environment };
})();
