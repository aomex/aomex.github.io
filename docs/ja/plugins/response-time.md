---
outline: deep
---

# レスポンス時間

各レスポンスヘッダーにサーバー処理時間（例：X-Response-Time）を書き、ブラウザ・ゲートウェイ・結合テストで遅い API を見る。設定項目なし。載せれば動く。

```bash
pnpm add @aomex/response-time
```

## アクセスログと並べる

`responseTime()` は設定なし。アクセスログの横に置き、リクエスト終了後にヘッダーへ所要時間を書く。Nginx `access_log` / [httpAccessLog](/ja/plugins/access-log) の duration と補完関係（ヘッダーはクライアント/ゲートウェイ、ログはプラットフォーム集計）。本番のアクセスログは依然エッジ優先。このプラグインは「ヘッダーに時間を載せるか」だけを扱う。

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

process.hrtime を使い、ヘッダーはしばしば 12.345ms の形。失敗レスポンスにも付く。エラー経路では HttpError.headers にマージされることがある。

通常の WebMiddleware。ctx の業務型は変えない。Network パネルのレスポンスヘッダーを見ればよく、action に手書き不要。

## レスポンスヘッダー vs アクセスログ

| 出力 | 誰向け | 経験 |
| --- | --- | --- |
| `X-Response-Time` | ブラウザ、API ゲートウェイ、テストアサーション | ルート変更と無関係、サイト全体同じ挙動 |
| アクセスログ `duration` | ログ基盤、アラート、ルート別集計 | [HTTP アクセスログ](/ja/plugins/access-log) 参照 |

オプション表はない：**ヘッダーに時間が要るならオン、不要なら載せない。** 一般に routers の前、アクセスログの近く。

| 環境 | 推奨 |
| --- | --- |
| 本番 | 多くは `httpAccessLog()` と一緒にオン |
| ローカル | コンソールだけ tail ならアクセスログのみでも可 |

X-Response-Time はエンドツーエンド総時間ではない。手前にゲートウェイ、TLS、クライアント待ちがある。外向き API で情報漏えいが心配ならエッジでヘッダーを剥ぐ。社内/自社フロントなら多くは問題ない。responseTime だけでログに落とさないとき、ピーク時の障害切り分けにはログ集計の duration が依然必要（[HTTP アクセスログ](/ja/plugins/access-log)）。

## 次のステップ

- アクセスログ：[HTTP アクセスログ](/ja/plugins/access-log)
- 分散トレース：[リンクトレース](/ja/plugins/async-trace)
- [ミドルウェア](/ja/core/middleware)