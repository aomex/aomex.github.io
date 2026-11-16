---
outline: deep
---

# ETag

Считает entity tag для успешных GET/HEAD: при `If-None-Match` и неизменном теле отвечает **304** и экономит трафик. Подходит для полу-статической конфигурации и версий; сильно персонализированные списки редко выигрывают.

```bash
pnpm add @aomex/etag
```

## Монтирование на WebApp

Добавьте `etag()` в `WebApp.mount` — успешные GET/HEAD получат ETag автоматически. Совпадение `If-None-Match` без изменений → 304. В action по-прежнему `ctx.send`.

```typescript
import { etag } from '@aomex/etag';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    etag(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

По-прежнему `ctx.send(data)`; при совпадении тега middleware отдаёт 304 с пустым телом.

Обычный `WebMiddleware`, новых полей на `ctx` нет. Первый ответ с ETag; повтор с тем же `If-None-Match` → **304**. Уже есть заголовок `Etag`, не 2xx или не GET/HEAD — обычно без перезаписи.

## Слабая валидация и стек

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `weak` | Семантически эквивалентно достаточно для 304; strong — побайтовое совпадение | `false` (`ReadStream` часто weak) |

```typescript
mount: [etag({ weak: true })];
```

### Полу-статический API (в проде часто включают)

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

### Статика + сжатие

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

| Среда | Рекомендация |
| --- | --- |
| Прод | Включайте для статики и полу-статики; не навешивайте ETag на весь сайт для «мои заказы» |
| Локально | JSON «залип» — отключите ETag или hard refresh; для conditional request включите снова |

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

На больших нагрузках кеш на CDN; in-app ETag полезен, когда вы сами контролируете семантику 304.

Локально «код поменял, браузер нет» — сначала **304**, потом бизнес-логика. Strong ETag на каждый персональный ответ — лишний CPU. С [Compress](/ru/plugins/compress) проверьте порядок middleware и шлюза по реальным 304/размеру.

## Дальше

- Сжатие: [Compress](/ru/plugins/compress)
- Статика: [Статические файлы](/ru/plugins/serve-static)
- Форма ответа: [Ограничения response](/ru/web/response)
