---
outline: deep
---

# AsyncAPI UI

給即時通道也掛一頁「人能看懂」的文件，基於官方 `@asyncapi/react-component`。前提是手裡有一份 AsyncAPI：可以是 CI 落盤的 `asyncapi.json`，也可以執行時現生成。

想先感受介面：[官方演示](https://asyncapi.github.io/asyncapi-react/)。契約怎麼來：[生成 AsyncAPI](/zh-TW/asyncapi/)。

它是掛在 **WebApp** 上的普通中介軟體（不是掛在 WebsocketApp 上）——文件頁本身走 HTTP。

```bash
pnpm add @aomex/asyncapi-ui
```

## 讀落盤檔案（最常見）

CI 已經 `npx aomex asyncapi` 寫出檔案後，掛上即可。瀏覽器開啟 `/asyncapi`（或 `/asyncapi/index.html`）；同字首下一般還能拿到 `asyncapi.json` 原檔案：

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';

mount: [
  asyncapiUI({ asyncapi: './asyncapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

`asyncapi` 也可以是 `.yaml` / `.yml` 路徑。

## 每次請求現生成

不想把契約檔案提交進倉庫時，傳一個函式，裡面調 `generateAsyncapi`。`uriPrefix` 預設 `/asyncapi`，需要改路徑時再寫：

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

## 生產環境別裸奔

預設路徑 `/asyncapi` 太好猜。腳手架式的做法是加一段隨機串，並在公網用 `enable` 做 IP / 登入門檻。隨機串**不是**鑑權，只是抬高被掃到的成本。可以和 Swagger / Redoc 同時掛，只要字首別撞車。需要往文件頁 `<head>` 塞 favicon 時再加 `headTags`。

```typescript
asyncapiUI({
  asyncapi: './asyncapi.json',
  uriPrefix: '/asyncapi-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => {
    return ctx?.request.ip === '127.0.0.1';
  },
});
```

## 下一步

- [生成 AsyncAPI](/zh-TW/asyncapi/)
- [WebSocket 應用入口](/zh-TW/websocket/)
- HTTP 側文件 UI 對照：[怎麼選文件 UI](/zh-TW/openapi/choose-ui)
