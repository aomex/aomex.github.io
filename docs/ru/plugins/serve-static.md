---
outline: deep
---

# Статические файлы

Каталог на диске (frontend dist, public, пакеты для скачивания) отдаётся как HTTP-файлы; при промахе — `next()` дальше в API. Обслуживайте только указанный `root`, не указывайте корень проекта или `node_modules`.

```bash
pnpm add @aomex/serve-static
```

## Перед маршрутами

Статический middleware обычно ставят **перед** бизнес-маршрутами (сначала файл, потом API). `root` обязателен — на продукт фронта или каталог загрузок.

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Обычный WebMiddleware. При попадании в файл отдаёт содержимое; при промахе пропускает дальше. Path traversal, `..`, NUL, dot-файлы отклоняются (проверки внутри пакета). При доступе к каталогу по умолчанию fallback на `index.html` (меняется через `indexFile`). Если сборка уже положила рядом `.br` / `.gz`, `useCompressedFile` по умолчанию предпочитает их (можно выключить).

::: warning
`root: '.'` или каталог с `node_modules` рискует утечкой путей — на проде такие ошибки уже встречались.
:::

## Chunk с hash: долгий кеш

JS/CSS chunk с content hash можно отдавать с длинным `cacheControl`; входные вроде `index.html` не стоит делать так же `immutable` — после релиза пользователь останется на старой оболочке.

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

По умолчанию `maxAge: 0`. HTML лучше с коротким кешем или `noCache`.

## URL-префикс не совпадает с диском

Когда CDN / шлюз отдаёт `/assets/...` из `./dist`, через `formatPath` снимите префикс и ищите файл:

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

Глубокий refresh нельзя закрыть одним статическим middleware: промах после routers нужно отдавать `index.html`. `send` и `serveStatic` экспортируются из одного пакета.

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
| Прод | большой трафик часто отдаёт статику CDN/Nginx; Node удобен для fallback или интранета |
| Локально | достаточно `serveStatic` на продукт сборки Vite |

## Дальше

- Условный кеш: [ETag](/ru/plugins/etag)
- Сжатие передачи: [Compress](/ru/plugins/compress)
- Сборка входа Web: [Вход приложения](/ru/web/)
