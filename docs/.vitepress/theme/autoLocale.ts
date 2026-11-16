import { inBrowser } from 'vitepress';

export const LOCALE_STORAGE_KEY = 'aomex-docs-locale';

export type DocsLocale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'ru';

/** 所有正文都在带前缀的路径下；`/` 只负责识别后跳转 */
export const localeHome: Record<DocsLocale, string> = {
  'zh-CN': '/zh/',
  'zh-TW': '/zh-TW/',
  en: '/en/',
  ja: '/ja/',
  ko: '/ko/',
  ru: '/ru/',
};

/**
 * 浏览器语言 → 文档 locale。
 * - zh-TW / zh-Hant → 繁体
 * - zh / zh-CN / zh-HK / 其它 zh* → 简体 /zh/
 * - ja* / ko* / ru* → 对应前缀
 * - en* 或无法识别 → /en/
 */
export const detectBrowserLocale = (): DocsLocale => {
  const languages = navigator.languages?.length
    ? [...navigator.languages]
    : [navigator.language];

  for (const raw of languages) {
    const lang = (raw || '').toLowerCase();
    if (lang === 'zh-tw' || lang.startsWith('zh-hant')) {
      return 'zh-TW';
    }
    if (lang.startsWith('zh')) {
      return 'zh-CN';
    }
    if (lang.startsWith('ja')) {
      return 'ja';
    }
    if (lang.startsWith('ko')) {
      return 'ko';
    }
    if (lang.startsWith('ru')) {
      return 'ru';
    }
    if (lang.startsWith('en')) {
      return 'en';
    }
  }

  return 'en';
};

const knownLocales: DocsLocale[] = [
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'ko',
  'ru',
];

export const readStoredLocale = (): DocsLocale | null => {
  if (!inBrowser) {
    return null;
  }
  const value = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (value && (knownLocales as string[]).includes(value)) {
    return value as DocsLocale;
  }
  return null;
};

export const writeStoredLocale = (locale: DocsLocale): void => {
  if (!inBrowser) {
    return;
  }
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};

export const localeFromVitePressLang = (lang: string): DocsLocale => {
  if (lang === 'zh-TW') {
    return 'zh-TW';
  }
  if (lang === 'zh-CN' || lang.startsWith('zh')) {
    return 'zh-CN';
  }
  if (lang === 'ja-JP' || lang.startsWith('ja')) {
    return 'ja';
  }
  if (lang === 'ko-KR' || lang.startsWith('ko')) {
    return 'ko';
  }
  if (lang === 'ru-RU' || lang.startsWith('ru')) {
    return 'ru';
  }
  if (lang === 'en-US' || lang.startsWith('en')) {
    return 'en';
  }
  return 'en';
};

/**
 * 仅在站点根 `/` 上根据偏好或浏览器语言跳转。
 * 根路径没有文档正文；识别后一定 replace 到某个 locale 首页。
 */
export const maybeRedirectRootHome = (): void => {
  if (!inBrowser) {
    return;
  }

  const path = window.location.pathname;
  if (path !== '/' && path !== '/index.html') {
    return;
  }

  const stored = readStoredLocale();
  const target = stored ?? detectBrowserLocale();
  if (!stored) {
    writeStoredLocale(target);
  }

  window.location.replace(localeHome[target]);
};
