---
outline: deep
---

# AsyncAPI UI

И для realtime-канала повесьте страницу документации «для человека» на официальном `@asyncapi/react-component`. Нужен готовый AsyncAPI: файл с диска из CI (`asyncapi.json`) или генерация на лету.

Сначала посмотреть UI: [официальное демо](https://asyncapi.github.io/asyncapi-react/). Откуда берётся контракт: [генерация AsyncAPI](/ru/asyncapi/).

Это обычный middleware на **WebApp** (не на WebsocketApp) — сама страница документации идёт по HTTP.

```bash
pnpm add @aomex/asyncapi-ui
```

## Читать файл с диска (самый частый вариант)

Когда CI уже сделал `npx aomex asyncapi` и записал файл — просто повесьте. В браузере откройте `/asyncapi` (или `/asyncapi/index.html`); под тем же префиксом обычно доступен и сырой `asyncapi.json`:

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';

mount: [
  asyncapiUI({ asyncapi: './asyncapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

`asyncapi` может быть путём `.yaml` / `.yml`.

## Генерировать на каждый запрос

Если контракт не хотите коммитить в репозиторий — передайте функцию с `generateAsyncapi`. `uriPrefix` по умолчанию `/asyncapi`; путь меняйте, когда нужно:

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';
import { generateAsyncapi } from '@aomex/asyncapi-generator';

mount: [ // [!code focus:14]
  asyncapiUI({
    uriPrefix: '/asyncapi',
    asyncapi: async () => { // [!code highlight]
      return generateAsyncapi({
        channels: './src/channels',
        docs: {
          asyncapi: '3.1.0',
          info: { title: 'Realtime', version: '1.0.0' },
        },
      });
    },
  }),
  routers('./src/routers'),
],
```

## В проде не оставляйте «голым»

Путь по умолчанию `/asyncapi` слишком угадываемый. Как в scaffold: добавьте случайный сегмент и на публичной сети ограничьте доступ через `enable` (IP / логин). Случайная строка — **не** аутентификация, только повышает стоимость сканирования. Можно вешать рядом со Swagger / Redoc, лишь бы префиксы не пересекались. Favicon в `<head>` страницы — через `headTags`.

```typescript
asyncapiUI({
  asyncapi: './asyncapi.json',
  uriPrefix: '/asyncapi-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => {
    return ctx?.request.ip === '127.0.0.1';
  },
});
```

## Дальше

- [Генерация AsyncAPI](/ru/asyncapi/)
- [Точка входа WebSocket](/ru/websocket/)
- Сравнение HTTP UI: [как выбрать UI документации](/ru/openapi/choose-ui)
