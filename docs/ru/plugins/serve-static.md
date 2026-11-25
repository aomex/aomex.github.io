---
outline: deep
---

# Статические файлы

Каталог на диске (dist фронта, public, пакеты для скачивания) отдаётся как HTTP-файлы; при промахе — next() к API. Только указанный `root`, не корень репозитория и не node_modules.

```bash
pnpm add @aomex/serve-static
```

## Перед роутами

Статику обычно **перед** business routes: сначала файл, потом API. `root` обязателен — артефакты фронта или каталог загрузок.

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Обычный WebMiddleware. Попадание — сразу отдаёт содержимое; промах — пропуск дальше. Path traversal, `..`, NUL, dot-files отклоняются (проверки в пакете). Каталог по умолчанию падает на `index.html` (`indexFile` меняет). При `.br` / `.gz` рядом с артефактом `useCompressedFile` по умолчанию предпочитает их (можно выключить).

::: warning
`root: '.'` или каталог с node_modules — риск утечки путей; на проде так ошибались.
:::

## Chunk с hash: долгий кэш

JS/CSS с content hash — длинный `cacheControl`; для `index.html` и входов тот же `immutable` плох — пользователи застрянут на старой оболочке.

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

По умолчанию `maxAge: 0`. HTML — короткий кэш или `noCache`.

## Префикс URL ≠ путь на диске

CDN/шлюз ведёт `/assets/...` в `./dist` — `formatPath` снимает префикс перед поиском файла:

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

## API + SPA fallback

Глубокие ссылки не только статикой: после routers на неизвестный путь — `index.html`. `send` и `serveStatic` из одного пакета.

```typescript
import { middleware } from '@aomex/common';
import { send, serveStatic } from '@aomex/serve-static';

mount: [
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
  middleware.web(async (ctx) => {
    const ok = await send(ctx, {
      root: './dist',
      formatPath: () => { // [!code highlight]
        return '/index.html';
      },
    });
    if (!ok) {
      ctx.throw(404);
    }
  }),
];
```

| Среда | Рекомендация |
| --- | --- |
| Прод | Большой трафик — CDN/Nginx; Node для fallback или интранета |
| Локально | `serveStatic` на артефакты Vite |

## Дальше

- Условный кэш: [ETag](/ru/plugins/etag)
- Сжатие: [Compress](/ru/plugins/compress)
- Сборка Web: [web](/ru/web/)