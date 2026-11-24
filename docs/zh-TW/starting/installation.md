---
outline: deep
---

# 快速安裝

從零拉起一個能跑的 aomex 專案：HTTP 能訪問，終端也能跑指令。腳手架把 logger / language / 關停等必填項帶好，比空手搭省事。腳手架要求 **Node.js `^22.22.2 || ^24.15.0 || >=26`**。

用哪條命令啟動，就會自動選用對應包管理器（也可用 `--pm` 覆蓋）。

```bash
pnpm create aomex
yarn create aomex
npm create aomex
```

按提示選擇 ORM、認證、中介軟體等；生成後進入目錄啟動：

```bash
cd <project>
pnpm start   # 或 yarn start / npm start
```

生成專案根目錄含 `AGENTS.md` → `aomex-skill.md`，供 AI 按約定擴充套件程式碼。

起來之後瀏覽器打一下健康檢查或首頁（埠看模板的 PORT）。終端側：

```bash
pnpm aomex -h
```

## 非互動引數

所有可選項都可用 CLI 引數跳過詢問（適合指令碼 / CI）。未傳的項仍會互動詢問。

| 引數 | 說明 | 示例 |
| --- | --- | --- |
| `--project` | 專案目錄名 | `--project=my-api` |
| `--node` | Node 版本（不傳則互動選擇 LTS，≥24） | `--node=24.22.0` |
| `--pm` | 包管理器（預設跟 create 命令走） | `--pm=pnpm` \| `yarn` \| `npm` |
| `--orm` | ORM | `--orm=prisma` \| `mongoose` \| `none` |
| `--db` | Prisma 資料庫（僅 `--orm=prisma`） | `--db=mysql` \| `postgresql` \| … |
| `--auth` | 認證策略，逗號多選；`none` 表示無 | `--auth=bearer,jwt` \| `--auth=none` |
| `--web-plugins` | 可選 Web 中介軟體（`cors` / `etag` / `helmet` / `response-time` 始終安裝） | `--web-plugins=access-log,async-trace` |
| `--docs` | 文件 UI | `--docs=swagger` \| `redoc` \| `scalar` \| `none` |
| `--logger` | 日誌出口，逗號多選 | `--logger=console,file` |
| `--console-middlewares` | Console 外掛；`cron` 始終安裝，可追加 | `--console-middlewares=openapi` |
| `--lang` | 預設語言（BCP 47） | `--lang=zh-CN` |
| `--docker` | 是否生成 Docker 生產部署產物 | `--docker=true` \| `false` |
| `--tz` / `--timezone` | 程序時區 | `--tz=Asia/Shanghai` |
| `--cluster` | 叢集方案（勿疊用） | `--cluster=none` \| `cluster-listen` \| `pm2` |

```bash
pnpm create aomex -- \
  --project=HelloAomex \
  --pm=pnpm \
  --orm=prisma \
  --db=mysql \
  --auth=bearer \
  --docs=swagger \
  --lang=zh-CN \
  --docker=true \
  --tz=Asia/Shanghai \
  --web-plugins=access-log,async-trace \
  --logger=console,file \
  --cluster=none
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
