---
outline: deep
---

# 快速安裝

從零拉起一個能跑的 aomex 專案：HTTP 能訪問，終端也能跑指令。腳手架把 logger / language / 關停等必填項帶好，比空手搭省事。

```bash
npx create-aomex@latest
cd your-project
pnpm install
pnpm start
```

::: tip 環境
**Node.js ≥ 24**（先 node -v）。包管理器用 **pnpm** 最省心；npm / yarn 一般也能用。
:::

起來之後瀏覽器打一下健康檢查或首頁（埠看模板的 PORT）。終端側：

```bash
pnpm aomex -h
```

## 目錄結構

腳手架大概長這樣（版本不同會微調）。先抓住三條線：`src/web.ts` 起 HTTP，`src/cli.ts` 起終端 / Cron / OpenAPI 落盤，`src/routers/` 與 `src/commanders/` 各寫介面與指令；鑑權、錯誤格式、訪問日誌等可複用中介軟體放 `src/middleware/`，查庫、快取放進 `src/services/`，**兩邊共用**。

| 檔案 / 目錄 | 你改它做什麼 |
| --- | --- |
| `src/web.ts` | 起 HTTP |
| `src/cli.ts` | 起終端指令 / Cron / 落盤 OpenAPI |
| `src/routers/` | 寫介面 |
| `src/commanders/` | 寫 CLI 指令 |
| `src/middleware/` | 鑑權、formatError、訪問日誌、Swagger 等可複用中介軟體，再掛到 `web.ts` / 路由 mount |
| `src/services/` | 查庫、快取、發郵件——業務 SQL 別塞進路由 `action` |
| `src/schemas/` | 可複用校驗，檔名 `xxx.schema.ts`（OpenAPI 與 CLI 共用同一份） |

用不到的（prisma、i18n…）刪掉即可，不必留著裝門面。CORS、鑑權、OpenAPI 等是獨立包，用到再裝。

## 改一條介面試試

腳手架裡已有 `src/routers/`。新檔案 `export const router = new Router()`，`routers('./src/routers')` 會掃進去。先驗再進 action：

```typescript
// src/routers/hello.router.ts
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/hello', {
  mount: [
    query({ name: rule.string().default('world') }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.send({ message: `hello, ${ctx.query.name}` });
  },
});
```

`pnpm start` 後訪問 `/hello?name=ada`，這時 `ctx.query.name` 已是 string。

## 跑一條指令試試

Console 與 Web **共用** services / schemas。改 `src/commanders/` 裡的指令，或直接跑腳手架自帶的：

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```

定時任務、OpenAPI 落盤也走 `src/cli.ts`，見 [Cron](/zh-TW/plugins/cron) · [生成OpenAPI](/zh-TW/openapi/)。

## 下一步

1. [Web 應用入口](/zh-TW/web/) — `WebApp` 必填項、language、關停  
2. [介面路由](/zh-TW/web/router) — mount、docs、disabled  
3. [驗證器](/zh-TW/validators/) — 欄位怎麼驗、型別怎麼收窄  
4. [服務層](/zh-TW/core/service) — 查庫、快取往哪兒放  
5. [Console 應用入口](/zh-TW/console/) — 指令與 Cron
