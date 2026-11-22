/* Arabic / English strings for Tilago Rebrand. Each entry: [ar, en, tipAr?, tipEn?] */
(function () {
  var D = {
    'tagline': ['REBRAND', 'REBRAND'],
    's1': ['البروجكت', 'Project'], 's2': ['البراند بتاعك', 'Your brand'], 's3': ['أماكن اللوجو', 'Logo places'],
    's4': ['النصوص', 'Texts'], 's5': ['جوه Element 3D', 'Inside Element 3D'], 's6': ['التطبيق', 'Apply'],
    'proj.none': ['افتح التمبلت في After Effects واحفظه مرة.', 'Open the template in After Effects and save it once.'],
    'proj.dirty': ['فيه تعديلات مش محفوظة. الفحص بيقرأ آخر نسخة محفوظة من Element 3D.', 'Unsaved changes: Element 3D data is read from the last saved file.'],
    'scan': ['افحص البروجكت', 'Scan project'], 'rescan': ['افحص تاني', 'Scan again'],
    'n.logos': ['أماكن لوجو', 'logo places'], 'n.texts': ['نصوص', 'texts'], 'n.scenes': ['مشاهد Element 3D', 'Element 3D scenes'], 'n.mats': ['خامات', 'materials'],
    'brand.logo': ['اللوجو', 'Logo'], 'brand.name': ['الاسم', 'Name'], 'brand.font': ['الخط', 'Font', 'خط البراند لكل النصوص اللي هتتبدل', 'Brand font for every replaced text'],
    'brand.c1': ['اللون الأساسي', 'Main color'], 'brand.c2': ['اللون التاني', 'Second color'],
    'brand.change': ['غيّر', 'Change'], 'brand.reset': ['لوجو Tilago', 'Tilago logo'], 'brand.keepFont': ['سيب الخط زي ما هو', 'Keep current font'],
    'brand.tilago': ['لوجو Tilago', 'Tilago logo'], 'brand.custom': ['لوجو البراند', 'Brand logo'],
    'trace.title': ['شكل الـ Trace', 'Trace shape'],
    'trace.why': ['بيستخدم للأماكن المعمولة Masks أو Shape (زي Path Layer بتاع Element 3D). الصور بتتبدل بالصورة نفسها.', 'Used for places built from masks or shapes (like an Element 3D Path Layer). Images are swapped with the image itself.'],
    'trace.threshold': ['الحد', 'Threshold'], 'trace.smooth': ['النعومة', 'Smoothness'], 'trace.minArea': ['تجاهل النقط الصغيرة', 'Ignore small spots'],
    'trace.channel': ['يتتبع', 'Trace by'], 'ch.auto': ['تلقائي', 'Auto'], 'ch.alpha': ['الشفافية', 'Alpha'], 'ch.dark': ['الغامق', 'Dark'], 'ch.light': ['الفاتح', 'Light'],
    'trace.invert': ['اعكس', 'Invert'], 'trace.count': ['{n} شكل · {h} فتحة', '{n} shapes · {h} holes'],
    'slot.image': ['صورة', 'Image'], 'slot.masks': ['Masks', 'Masks'], 'slot.shape': ['Shape', 'Shape'],
    'reveal': ['وريني مكانه', 'Show me'], 'shared': ['نفس الصورة مستخدمة فوق', 'same image as above'],
    'texts.all': ['اكتب الاسم في المحدد', 'Put the name in checked'], 'texts.fill': ['املأ', 'Fill'],
    'none.scan': ['دوس "افحص البروجكت" الأول.', 'Press "Scan project" first.'],
    'none.logos': ['ملقتش أماكن لوجو. سمّي طبقة اللوجو Logo وافحص تاني.', 'No logo places found. Name the logo layer "Logo" and scan again.'],
    'none.texts': ['مفيش نصوص.', 'No texts.'], 'none.e3d': ['مفيش Element 3D في البروجكت ده.', 'No Element 3D in this project.'],
    'mat.keep': ['سيبه', 'Keep'], 'mat.c1': ['الأساسي', 'Main color'], 'mat.c2': ['التاني', 'Second color'], 'mat.custom': ['لون تاني…', 'Custom…'],
    'mat.logo': ['حط اللوجو', 'Use logo'], 'mat.auto': ['لوّن الخامات بالبراند', 'Color materials with brand'],
    'mat.autoTip': ['الأساسي للخامات الكبيرة، والتاني للحواف والمعادن', 'Main color for body materials, second color for bevels and metals'],
    'scene': ['مشهد {n}', 'Scene {n}'], 'copies': ['{n} نسخ', '{n} copies'],
    'env.title': ['البيئة (الانعكاسات)', 'Environment (reflections)'], 'env.keep': ['سيبها', 'Keep'], 'env.pick': ['اختار صورة', 'Choose image'],
    'apply': ['طبّق وافتح النسخة الجديدة', 'Apply and open the new copy'],
    'apply.note': ['التمبلت الأصلي مبيتلمسش: كل التعديلات بتتحفظ في نسخة جديدة باسم "... - Tilago.aep" وبتتفتح لوحدها.', 'The original template is never touched: everything goes into a new copy named "... - Tilago.aep", opened automatically.'],
    'p.save': ['حفظ نسخة جديدة', 'Saving a new copy'], 'p.layers': ['تبديل اللوجو والنصوص', 'Replacing logo and texts'],
    'p.e3d': ['التعديل جوه Element 3D', 'Editing inside Element 3D'], 'p.open': ['فتح النسخة الجديدة', 'Opening the new copy'],
    'done': ['خلصت. اتفتحت النسخة: {f}', 'Done. Opened: {f}'], 'nothing': ['مفيش حاجة متعلّم عليها للتطبيق', 'Nothing is checked to apply'],
    'needSave': ['هحفظ البروجكت الأول عشان أشتغل على آخر نسخة. أكمل؟', 'I will save the project first so I work on the latest version. Continue?'],
    'e3d.note': ['التعديل ده بيحصل في ملف البروجكت نفسه بعد الحفظ، فالأفتر هيقفل البروجكت ويفتحه تاني لوحده.', 'This edits the saved project file, so After Effects closes and reopens the project by itself.'],
    'lang': ['EN', 'ع'], 'btn.ok': ['تمام', 'OK'], 'btn.cancel': ['إلغاء', 'Cancel'], 'btn.yes': ['أيوه', 'Yes'], 'tf.link': ['ربط المحاور', 'Link axes'], 'ok': ['تمام', 'OK'], 'cancel': ['إلغاء', 'Cancel'], 'yes': ['أيوه', 'Yes'], 'ui.more': ['خيارات متقدمة', 'Advanced options'],
    'upd.done': ['اتحدّثت الأداة لنسخة {v}', 'Updated to version {v}'], 'upd.restart': ['اتحدّثت لنسخة {v}. اقفل After Effects وافتحه تاني', 'Updated to {v}. Restart After Effects'],
    'st.noHost': ['وضع المعاينة: مش متوصل بـ After Effects', 'Preview mode: not connected to After Effects'], 'st.ready': ['جاهز', 'Ready'],
    'err.UNSAVED': ['احفظ التمبلت مرة الأول (File > Save)', 'Save the template once first (File > Save)'],
    'err.NO_FILE': ['الملف مش موجود', 'File not found'], 'err.NO_LAYER': ['الطبقة مش موجودة', 'Layer not found'],
    'err.TRACE_EMPTY': ['الـ Trace مطلّعش أشكال. غيّر الحد', 'Nothing traced. Change the threshold'], 'err.TRACE_LOAD': ['مقدرتش أفتح صورة اللوجو', 'Could not open the logo image'],
    'err.VECTOR_FAIL': ['الملف ده مفيهوش شكل فكتور', 'This file has no vector outlines'],
    'err.EVAL': ['الأداة مقدرتش تكلم After Effects. اقفل اللوحة وافتحها تاني', 'The panel could not talk to After Effects. Reopen it'],
    'err.HOST': ['After Effects رجّع خطأ: {e}', 'After Effects error: {e}'], 'err.AEP': ['مقدرتش أعدّل ملف البروجكت: {e}', 'Could not edit the project file: {e}']
  };
  var lang = 'ar';
  try { lang = localStorage.getItem('tsrb.lang') || 'ar'; } catch (e) {}
  window.I18N = {
    get lang() { return lang; },
    set: function (l) { lang = l === 'en' ? 'en' : 'ar'; try { localStorage.setItem('tsrb.lang', lang); } catch (e) {} },
    t: function (k, vars) { var e = D[k], s = e ? (lang === 'ar' ? e[0] : e[1]) : k, v; if (vars) for (v in vars) s = s.split('{' + v + '}').join(vars[v]); return s; },
    tip: function (k) { var e = D[k]; return e && e.length > 2 ? (lang === 'ar' ? e[2] : e[3]) : ''; },
    has: function (k) { return !!D[k]; }
  };
  window.t = window.I18N.t;
})();
