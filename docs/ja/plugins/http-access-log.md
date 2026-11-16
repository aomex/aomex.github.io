---
outline: deep
---

# HTTP アクセスログ

リクエスト終了時に 1 行のアクセスログ：メソッド、URL、ステータス、所要時間など。流量と遅い API の把握向き。

**本番は Nginx access_log 優先**（ゲートウェイ / LB 付属ログ）：フォーマット統一、Node イベントループを占有しにくく、既存収集と相性がよい。`@aomex/http-access-log` はローカル開発、リバースプロキシなし、アプリに入って初めて取れる **userId / テナント / traceId** をログに載せたいとき。

```bash
pnpm add @aomex/http-access-log
```

## 前の方にサイト全体で

アプリ内アクセスログが要るとき `httpAccessLog()` を `routers` の**前**へ：終了時に combined 風 1 行。404、バリデーション 400 も記録。後ろだとチェーン全体の時間が揃いにくい。

```typescript
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

無設定時は combined 風 1 行テキスト。既定は logger 出口（ローカルは多くコンソール）。フィールド例：ip、method、url、statusCode、duration、contentLength。

::: warning
routers の**後ろ**だとチェーン全体の時間と早期 404 が「サイト全体監査」意図と合わないことがある。

:::

customTokens のコールバック引数は WebContext。ctx.auth 等は**内側の認証完了後**に読める——アクセスログは await next() の後に行を書くため、オニオン内側の属性は一般に取れる。customTokens で ctx.auth が常に - ならオニオン順を確認。認証がルート内、ログが外側で終わる前に切れるなら認証を Router mount へ上げる。

## フォーマットと永続化

| 能力 | いつ使う | デフォルト |
| --- | --- | --- |
| `format` | 本番で ELK/Loki のフィールド順に合わせる | 組み込み combined 風 |
| `transports` | ファイル、リモート収集 | コンソール（`logger` に追随） |
| `customTokens` | ユーザー ID、テナント、traceId | — |
| `HttpAccessLogToken.*` | `ip` / `method` / `duration` 等を連結 | パッケージ export |

### 本番：ファイル出力

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/http-access-log';
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

### 認証後に userId

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

[レスポンス時間](/ja/plugins/response-time) と併用が多い：ヘッダー X-Response-Time はクライアント/ゲートウェイ、ログ duration はプラットフォーム。

| 環境 | 推奨 |
| --- | --- |
| ローカル直結 | 本プラグインでコンソールへ。遅い API なら `responseTime()` 追加可 |
| 本番 Nginx あり | **優先** `access_log`。カスタム token（ユーザー、テナント）が要るときだけアプリ層 |
| 本番 リバースプロキシなし | 本プラグインでファイル/収集。業務ログと分流 |

アクセスログは流量・時間の観測向き。**機密操作の唯一の監査源にしない**——重要業務は業務ログや監査テーブル。Nginx access_log とアプリ内ログは併存可。フィールド定義が二系統で矛盾しないよう注意。

## 次のステップ

- レスポンスヘッダー時間：[レスポンス時間](/ja/plugins/response-time)
- レベル別出口 / requestId：[ログ](/ja/core/logger)