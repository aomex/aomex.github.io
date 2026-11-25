---
outline: deep
---

# Журнал доступа

Хотите в приложении видеть «кто стукнул какой HTTP-маршрут и сколько это заняло»? Используйте `httpAccessLog()` из `@aomex/access-log`. Одна строка по завершении запроса.

**В проде предпочтителен Nginx `access_log`** (или встроенный лог шлюза). Пакет уместен для локальной разработки, когда нет обратного прокси, и когда в строку нужны **userId / tenant / traceId** — поля, которые появляются только после входа в Node.

```bash
pnpm add @aomex/access-log
```

## До routers

Ставьте `httpAccessLog()` **перед** `routers`. После полного прохода «луковицы» пишется строка; 404 и validation 400 тоже попадают. Слишком поздно — длительность и ранние выходы не совпадут с «аудитом всего сайта».

```typescript
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

Без опций строки идут в консоль примерно в combined-стиле: ip, method, url, statusCode, duration, contentLength. Для локального прямого доступа хватает; при поиске медленных маршрутов добавьте [время ответа](/ru/plugins/response-time).

::: warning
Если повесить **после** routers, длительность всей цепочки и ранние 404 могут не совпасть с «аудитом всего сайта».
:::

## Формат и запись в файл

Чтобы выровнять порядок полей под ELK / Loki или писать в файл, используйте `format` + `transports`. `format` лучше собирать из `HttpAccessLogToken`, а не руками набирать плейсхолдеры — их легко опечатать.

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/access-log';
import { FileTransport } from '@aomex/logger';

httpAccessLog({
  format: [
    HttpAccessLogToken.ip,
    HttpAccessLogToken.method,
    HttpAccessLogToken.url,
    HttpAccessLogToken.statusCode,
    HttpAccessLogToken.duration,
    HttpAccessLogToken.contentType,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/access.log' })], // [!code highlight]
});
```

Пустой `transports` или `disabled: true` отключает журнал доступа. В проде с Nginx **сначала** шлюзовой `access_log`; слой приложения для диска / коллекторов открывайте только ради своих token или когда прокси нет — и отделяйте от бизнес-логов.

## Добавить userId

Строка пишется **после** `await next()`, поэтому `ctx.auth` от внутренней авторизации обычно уже читается. Через `customTokens` вставляйте бизнес-поля в `format`; колбэк получает полный `WebContext`.

```typescript
httpAccessLog({
  format: `${HttpAccessLogToken.method} ${HttpAccessLogToken.url} [userId] ${HttpAccessLogToken.statusCode}`,
  customTokens: { // [!code highlight]
    userId: (ctx) => {
      return String(ctx.auth?.bearer?.data?.userId ?? '-');
    },
  },
});
```

Часто сочетают с [временем ответа](/ru/plugins/response-time): `X-Response-Time` в заголовке — для клиента / шлюза, duration в логе — для платформы сбора.

Журнал доступа — про трафик и задержку, **не** единственный аудит чувствительных действий. Заказы и смена прав всё равно пишите в бизнес-лог или таблицу аудита.

## Дальше

- Время в заголовке ответа: [Время ответа](/ru/plugins/response-time)
- Журнал доступа WebSocket (соединения / сообщения): [Журнал доступа (WebSocket)](/ru/websocket/access-log)
- Уровни стоков / requestId: [Логгер](/ru/core/logger)
