---
outline: deep
---

# Статические файлы

Каталог на диске (`dist`, `public`, загрузки) → HTTP-файлы; промах → `next()` к API. Служите только выбранный `root`, не корень репозитория и не `node_modules`.

```bash
pnpm add @aomex/serve-static
```

## Перед API-маршрутами

Статика обычно **перед** бизнес-маршрутами (сначала файл, потом API).

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

Обычный `WebMiddleware`. Попадание — отдача файла; промах — дальше по цепочке. Traversal, `..`, NUL, dotfiles отклоняются (валидация внутри пакета).

## root и кеш

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `root` | Сборка фронта или каталог загрузок | **обязательно** |
| `formatPath` | URL-префикс ≠ путь на диске (например `/assets`) | — |
| `indexFile` | Запрос каталога → index | `index.html` |
| `useCompressedFile` | Сборка с `.br`/`.gz` рядом | `true` |
| `cacheControl` | Долгий кеш для hash-ассетов; HTML короче или `noCache` | `maxAge: 0` |

### Долгий кеш (chunk с hash)

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

### Переписывание URL-префикса

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

### API + SPA fallback (глубокие ссылки → index.html)

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
| Прод | Высокий трафик часто на CDN/Nginx; Node — fallback или внутренняя сеть |
| Локально | `serveStatic` на выход Vite |

::: warning
`root: '.'` или каталог с `node_modules` — риск утечки путей; такие ошибки бывают в проде.
:::

`index.html` не кешируйте `immutable` как hash-chunk — пользователи останутся на старой оболочке. Глубокие ссылки SPA требуют fallback **после** `routers` на `index.html` (демо выше).

## Дальше

- Условный кеш: [ETag](/ru/plugins/etag)
- Сжатие: [Compress](/ru/plugins/compress)
- Сборка Web: [Точка входа](/ru/web/)
