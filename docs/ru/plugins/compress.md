---
outline: deep
---

# Сжатие ответов

Крупный JSON и отчёты сжимаются при `Accept-Encoding` — gzip / br / zstd и т.д., меньше трафика.

**В проде сжимайте на Nginx (или CDN)** — меньше CPU в Node, проще вместе со статикой и TLS. `@aomex/compress` в приложении — локальный доступ без прокси или пока шлюз не умеет нужное кодирование. Пропускайте мелкие body и уже сжатые ресурсы (картинки, видео).

```bash
pnpm add @aomex/compress
```

## Монтирование на WebApp

Убедитесь, что периметр **не** сжимает те же ответы, затем `compress()` в `WebApp.mount`. Сжатие **после** `await next()` по `Accept-Encoding`; в action только `ctx.send`.

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

`compress()` добавляет `CompressProps`: `ctx.needCompress` вкл/выкл на маршруте. В ответе `Content-Encoding`; `text/event-stream` и подобное обычно пропускаются, чтобы не буферить весь поток.

## Порог и алгоритмы

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `threshold` | Мелкие body не сжимать | `1024` |
| `filter` | Глобально несжимаемые MIME; перекрывается `ctx.needCompress` | по MIME |
| `zstd` / `br` / `gzip` / `deflate` | Отключить лишние | все включены |
| `ctx.needCompress` | SSE, большие скачивания | как у `filter` |

При поддержке нескольких клиентом: **zstd → br → gzip → deflate**.

### Большие списки / экспорт

```typescript
compress({ threshold: '4kb' });
```

### SSE: сжатие выключить

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

Типичный порядок: access log / response time → compress → маршруты (нужно финальное тело).

| Среда | Рекомендация |
| --- | --- |
| Локально, прямой Node | `compress()` для проверки размера |
| Прод с Nginx / CDN | **сжатие на периметре**; в приложении не дублируйте |
| Периметр пока не сжимает | in-app `compress()` и отключите дубль на шлюзе |

::: tip
В Nginx часто `gzip on;` (и Brotli по необходимости). Шлюз **или** приложение.
:::

::: warning
Двойное сжатие редко уменьшает размер сильнее; latency и CPU часто удваиваются.
:::

Без `ctx.needCompress = false` на потоковых маршрутах буфер ломает realtime. С [ETag](/ru/plugins/etag) проверьте порядок реальными запросами: 304 и размер.

## Дальше

- Условный кеш: [ETag](/ru/plugins/etag)
- Пресжатая статика: [Статические файлы](/ru/plugins/serve-static)
- Заголовок времени: [Время отклика](/ru/plugins/response-time)
