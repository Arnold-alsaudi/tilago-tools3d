/* Tilago Rebrand - host entry (own namespace $.global.TSRB, independent from Tilago 3D Studio). */
$.global.TSRB_LOAD_ERR = '';
$.global.TSRB_ROOT = File($.fileName).parent.fsName;
$.global.TSRB_load = function () {
  var files = ['core', 'brand'], i, f;
  $.global.TSRB_LOAD_ERR = '';
  for (i = 0; i < files.length; i++) {
    f = new File($.global.TSRB_ROOT + '/' + files[i] + '.jsx');
    if (!f.exists) { $.global.TSRB_LOAD_ERR += files[i] + '.jsx missing; '; continue; }
    try { $.evalFile(f); } catch (e) { $.global.TSRB_LOAD_ERR += files[i] + '.jsx line ' + (e.line || '?') + ': ' + e.message + '; '; }
  }
};
$.global.TSRB_load();
$.global.TSRB_call = function (name, args) { return $.global.TSRB.call(name, args); };
$.global.TSRB_status = function () {
  if ($.global.TSRB_LOAD_ERR) return 'ERR:' + $.global.TSRB_LOAD_ERR;
  var T = $.global.TSRB;
  return (T && T.modules && T.modules.brand) ? 'TSRB_READY' : 'ERR:modules not loaded';
};
