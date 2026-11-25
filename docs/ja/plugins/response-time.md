---
outline: deep
---

# レスポンス時間

各応答ヘッダーにサーバー処理時間（例：X-Response-Time）を書き、ブラウザ・ゲートウェイ・結合テストで遅い API を観測する。設定なし、載せるだけ。

```bash
pnpm add @aomex/response-time
```

## アクセスログと並べる

`responseTime()` は設定なし。アクセスログの横に置き、リクエスト終了後に応答ヘッダーへ所要時間を書く。Nginx `access_log` / [httpAccessLog](/ja/plugins/access-log) の duration と補完（ヘッダーはクライアント/ゲートウェイ、ログはプラットフォーム集約）。本番のアクセスログは依然エッジ優先；本プラグインは「応答ヘッダーに時間を載せるか」だけ。

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

process.hrtime 使用。ヘッダーは例として 12.345ms。失敗応答にも付く。エラーパスは HttpError.headers にマージされることがある。

通常の WebMiddleware。ctx の業務型は変えない。Network パネルで応答ヘッダーを見ればよく、action で手書き不要。

## 応答ヘッダー vs アクセスログ

| 出力 | 誰向け | 経験 |
| --- | --- | --- |
| `X-Response-Time` | ブラウザ、API ゲートウェイ、テスト断言 | ルート変更と無関係、全サイト同じ |
| アクセスログ `duration` | ログ基盤、アラート、ルート集約 | [HTTP アクセスログ](/ja/plugins/access-log) |

オプション表なし：**ヘッダーに時間が要るならオン、不要なら載せない。** 通常 routers の前、アクセスログの近く。

| 環境 | 目安 |
| --- | --- |
| 本番 | よく `httpAccessLog()` と一緒 |
| ローカル | コンソール tail だけならアクセスログのみでも可 |

X-Response-Time はエンドツーエンド総時間ではない。手前にゲートウェイ、TLS、クライアント待ちがある。公開 API で情報漏えいが心配ならエッジでヘッダー剥がす。内網/自社フロントなら大抵問題なし。responseTime だけでログに残さない場合、ピーク時の切り分けはログ集約の duration も要る（[HTTP アクセスログ](/ja/plugins/access-log)）。

## 次に

- アクセスログ：[HTTP アクセスログ](/ja/plugins/access-log)
- 分散トレース：[リンクトレース](/ja/plugins/async-trace)
- [ミドルウェア](/ja/core/middleware)