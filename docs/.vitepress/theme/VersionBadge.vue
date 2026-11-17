<script setup lang="ts">
import { inBrowser } from 'vitepress';
import { onMounted, ref } from 'vue';

const PACKAGE = '@aomex/common';
const VERSION_URL = `https://cdn.jsdelivr.net/npm/${PACKAGE}/package.json`;
const CACHE_KEY = 'aomex-docs-common-version';

const version = ref('');

const readCache = (): string => {
  try {
    return sessionStorage.getItem(CACHE_KEY) || '';
  } catch {
    return '';
  }
};

const writeCache = (value: string) => {
  try {
    sessionStorage.setItem(CACHE_KEY, value);
  } catch {
    // ignore quota / private mode
  }
};

const fetchVersion = async () => {
  const cached = readCache();
  if (cached) {
    version.value = cached;
    return;
  }

  try {
    const res = await fetch(VERSION_URL, { cache: 'no-cache' });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { version?: string };
    if (data.version) {
      version.value = data.version;
      writeCache(data.version);
    }
  } catch {
    // keep empty; badge stays hidden
  }
};

onMounted(() => {
  if (inBrowser) {
    void fetchVersion();
  }
});
</script>

<template>
  <span
    v-if="version"
    class="aomex-version-badge"
    :title="`${PACKAGE}@${version}`"
  >
    v{{ version }}
  </span>
</template>
