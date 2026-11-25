---
outline: deep
---

# Сжатие ответа

Большой JSON и отчёты сжимаются gzip / br / zstd и т.п., когда клиент шлёт `Accept-Encoding` — меньше трафика.

**В проде предпочтительно сжимать на Nginx (или CDN)**: меньше CPU у Node и удобнее держать статику с TLS-терминацией вместе. `@aomex/compress` в приложении имеет смысл, только если идёте напрямую на Node без reverse proxy или шлюз пока не умеет нужный encoding. Маленькие ответы и уже сжатые ресурсы (картинки, видео) пропускайте, иначе CPU впустую.

```bash
pnpm add @aomex/compress
```

## Монтирование на весь WebApp

Убедитесь, что край **не** сжимает тот же ответ, и повесьте `compress()` в `WebApp.mount`. Сжатие идёт **после** `await next()` по `Accept-Encoding`; в action по-прежнему `ctx.send`, без ручной проверки gzip.

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

У compress() есть CompressProps: `ctx.needCompress` на одном маршруте принудительно включает/выключает (поле появится в автодополнении). В ответе будет Content-Encoding; потоковые типы вроде text/event-stream обычно пропускаются, чтобы не буферизовать весь поток.

Типичный порядок mount: access log / response time → compress → маршруты (сжатию нужно финальное body). Приоритет алгоритмов (когда клиент поддерживает все): **zstd → br → gzip → deflate**.

## Порог для больших списков

По умолчанию body меньше примерно `1024` байт не сжимается — экономия CPU. Для экспорта и больших списков поднимите `threshold` до `'4kb'` и т.п.; число без единицы — байты.

```typescript
compress({ threshold: '4kb' }); // [!code highlight]
```

Если нужен только один алгоритм, остальные поставьте в `false` (например `br: false`). `filter` решает по Content-Type, сжимать ли; на одном маршруте перекрывается `ctx.needCompress`.

## SSE: сжатие обязательно выключить

Если на потоковом интерфейсе забыть выключить сжатие, буфер убьёт реальность времени. В action поставьте `ctx.needCompress = false`:

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

| Среда | Рекомендация |
| --- | --- |
| Локально напрямую на Node | можно повесить `compress()` и смотреть объём |
| Прод с Nginx / CDN | **сначала сжатие на краю**; в приложении не дублировать |
| Край пока не умеет | тогда in-app `compress()`, и отключите тот же модуль на шлюзе |

::: tip
Типичная запись в Nginx: `gzip on;` (и при необходимости модуль Brotli). Приложение и шлюз — **либо одно, либо другое**.
:::

::: warning
Сжатие и на шлюзе, и в приложении часто не уменьшает объём, зато даёт двойную задержку и CPU.
:::

Совместно с [ETag](/ru/plugins/etag) не гадайте порядок — после правок проверьте 304 и объём реальными запросами.

## Дальше

- Условный кеш: [ETag](/ru/plugins/etag)
- Предсжатие статики: [Статические файлы](/ru/plugins/serve-static)
- Заголовок времени ответа: [Response time](/ru/plugins/response-time)
