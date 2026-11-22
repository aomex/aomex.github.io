/** 注入根首页 <head>，在首屏前完成跳转（与 autoLocale.ts 逻辑对齐） */
export const autoLocaleInlineScript = `(function(){
  try {
    var path = location.pathname;
    if (path !== '/' && path !== '/index.html') return;
    var key = 'aomex-docs-locale';
    var homes = {
      'zh-CN': '/zh/',
      'zh-TW': '/zh-TW/',
      en: '/en/',
      ja: '/ja/',
      ru: '/ru/'
    };
    var pref = localStorage.getItem(key);
    var target = homes[pref] ? pref : null;
    if (!target) {
      var langs = navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
      for (var i = 0; i < langs.length; i++) {
        var l = String(langs[i] || '').toLowerCase();
        if (l === 'zh-tw' || l.indexOf('zh-hant') === 0) {
          target = 'zh-TW';
          break;
        }
        if (l.indexOf('zh') === 0) {
          target = 'zh-CN';
          break;
        }
        if (l.indexOf('ja') === 0) {
          target = 'ja';
          break;
        }
        if (l.indexOf('ru') === 0) {
          target = 'ru';
          break;
        }
        if (l.indexOf('en') === 0) {
          target = 'en';
          break;
        }
      }
      if (!target) target = 'en';
      localStorage.setItem(key, target);
    }
    location.replace(homes[target]);
  } catch (e) {}
})();`;
