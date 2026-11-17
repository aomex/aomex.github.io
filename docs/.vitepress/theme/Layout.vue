<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useRoute, inBrowser } from 'vitepress';
import { onMounted, onUnmounted, watch } from 'vue';
import {
  maybeRedirectRootHome,
  writeStoredLocale,
  type DocsLocale,
} from './autoLocale';
import VersionBadge from './VersionBadge.vue';

const { Layout } = DefaultTheme;
const route = useRoute();

const localeFromPath = (path: string): DocsLocale | null => {
  if (path === '/' || path === '/index.html') {
    return null;
  }
  if (path === '/zh' || path.startsWith('/zh/')) {
    return 'zh-CN';
  }
  if (path === '/zh-TW' || path.startsWith('/zh-TW/')) {
    return 'zh-TW';
  }
  if (path === '/en' || path.startsWith('/en/')) {
    return 'en';
  }
  if (path === '/ja' || path.startsWith('/ja/')) {
    return 'ja';
  }
  if (path === '/ko' || path.startsWith('/ko/')) {
    return 'ko';
  }
  if (path === '/ru' || path.startsWith('/ru/')) {
    return 'ru';
  }
  return null;
};

const localeFromTranslationsHref = (href: string): DocsLocale | null => {
  try {
    const path = new URL(href, 'http://aomex.local').pathname;
    return localeFromPath(path);
  } catch {
    return null;
  }
};

const onTranslationsClick = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const link = target.closest('a');
  if (!link || !link.closest('.VPNavBarTranslations, .VPNavScreenTranslations')) {
    return;
  }
  const href = link.getAttribute('href');
  if (!href) {
    return;
  }
  const locale = localeFromTranslationsHref(href);
  if (locale) {
    writeStoredLocale(locale);
  }
};

const hideRootLocaleMenuItem = () => {
  const links = document.querySelectorAll(
    '.VPNavBarTranslations .items a, .VPNavScreenTranslations .items a',
  );
  for (const link of links) {
    const text = (link.textContent || '').replace(/\u200B/g, '').trim();
    const href = link.getAttribute('href') || '';
    if (!text || href === '/' || href === '/index.html') {
      const item = link.closest('.item, li, div');
      if (item instanceof HTMLElement) {
        item.style.display = 'none';
      }
    }
  }
};

watch(
  () => {
    return route.path;
  },
  (path) => {
    if (!inBrowser) {
      return;
    }
    const locale = localeFromPath(path);
    if (locale) {
      writeStoredLocale(locale);
    }
    maybeRedirectRootHome();
    requestAnimationFrame(hideRootLocaleMenuItem);
  },
  { immediate: true },
);

onMounted(() => {
  if (!inBrowser) {
    return;
  }
  document.addEventListener('click', onTranslationsClick, true);
  hideRootLocaleMenuItem();
  requestAnimationFrame(hideRootLocaleMenuItem);
});

onUnmounted(() => {
  if (!inBrowser) {
    return;
  }
  document.removeEventListener('click', onTranslationsClick, true);
});
</script>

<template>
  <Layout>
    <template #nav-bar-title-after>
      <VersionBadge />
    </template>
  </Layout>
</template>
