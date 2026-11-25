---
outline: deep
---

# アクセスログ

アプリ内で「誰がどの HTTP ルートを叩き、何ミリ秒かかったか」を見たい——`@aomex/access-log` の `httpAccessLog()` を使う。リクエスト終了時に 1 行書く。

**本番では Nginx の access_log を優先**（またはゲートウェイ同梱）。本パッケージが向くのはローカル開発、前段にリバースプロキシが無いとき、そして **userId / テナント / traceId** のように Node に入ってからしか取れないフィールドを行に載せたいとき。

```bash
pnpm add @aomex/access-log
```

## routers の前に載せる

`httpAccessLog()` は `routers` の**前**に置く。玉ねぎ一通り終わったあと 1 行書く。404 や検証 400 も記録される。後ろすぎると、所要時間や早期 return が「全站監査」と揃わない。

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

何も渡さないと既定でコンソールへ、だいたい combined 風：ip、method、url、statusCode、duration、contentLength。ローカル直結ならこれで十分。遅いルートを追うときは [応答時間](/ja/plugins/response-time) も足す。

::: warning
routers の**後ろ**に載せると、鎖全体の所要時間や早期 404 が「全站監査」と合わないことがある。
:::

## 形式を変え、ファイルに落とす

本番で ELK / Loki のフィールド順に合わせる、またはファイルに書くときは `format` + `transports`。`format` は `HttpAccessLogToken` を並べて組み立てるのが安全。手打ちプレースホルダは打ち間違いやすい。

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

空の `transports` や `disabled: true` はアクセスログをオフにするのと同じ。本番に Nginx があるときは**優先**してゲートウェイの `access_log`。カスタム token が要る、または前段が無いときだけアプリ層で落盤 / 収集し、業務ログと分ける。

## userId を載せる

行は `await next()` の**あと**に書くので、内側の認証が付けた `ctx.auth` はだいたい読める。`customTokens` で業務フィールドを `format` に差し込む。コールバックが受け取るのは完全な `WebContext`。

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

よく [応答時間](/ja/plugins/response-time) と組む：ヘッダーの `X-Response-Time` はクライアント / ゲートウェイ向け、ログの duration は収集基盤向け。

アクセスログはトラフィックと所要時間向き。**機密操作の唯一の監査にしない**——注文や権限変更は業務ログや監査表に書く。

## 次のステップ

- 応答ヘッダーの所要時間：[応答時間](/ja/plugins/response-time)
- WebSocket の接続 / メッセージアクセスログ：[アクセスログ（WebSocket）](/ja/websocket/access-log)
- レベル付き出口 / requestId：[ログ](/ja/core/logger)
