/* Tilago 3D Studio - host entry. Loads the modules once per After Effects session.
   Modules attach to $.global.TS3D, because $.evalFile runs inside the caller's scope.
   Any module error is kept in TS3D_LOAD_ERR so the panel can show the real reason. */
$.global.TS3D_LOAD_ERR = '';
$.global.TS3D_ROOT = File($.fileName).parent.fsName;
$.global.TS3D_load = function () {
  var files = ['core', 'caps', 'text', 'materials', 'scene', 'lights', 'background', 'anim', 'e3d', 'state'];
  var i, f;
  $.global.TS3D_LOAD_ERR = '';
  for (i = 0; i < files.length; i++) {
    f = new File($.global.TS3D_ROOT + '/' + files[i] + '.jsx');
    if (!f.exists) { $.global.TS3D_LOAD_ERR += files[i] + '.jsx missing; '; continue; }
    try { $.evalFile(f); }
    catch (e) { $.global.TS3D_LOAD_ERR += files[i] + '.jsx line ' + (e.line || '?') + ': ' + e.message + '; '; }
  }
};
$.global.TS3D_load();

$.global.TS3D_call = function (name, args) { return $.global.TS3D.call(name, args); };
$.global.TS3D_status = function () {
  if ($.global.TS3D_LOAD_ERR) return 'ERR:' + $.global.TS3D_LOAD_ERR;
  var T = $.global.TS3D;
  return (T && T.modules && T.modules.caps) ? 'TS3D_READY' : 'ERR:modules not loaded';
};
