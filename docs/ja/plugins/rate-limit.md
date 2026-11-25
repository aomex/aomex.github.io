---
outline: deep
---

# レート制限

時間窓内でクライアント識別子ごとにカウントし、超過で **429**。API 刷りやバーストを止める。

**IP / 接続のサイト全体制限は本番では Nginx 優先**（`limit_req_zone` / `limit_req`）：Node に入る前に落とし、複製でも先に Redis は不要。`@aomex/rate-limit` は向く：**ユーザー / API Key など業務キー**、ログイン SMS などルート単位の締め、リバースプロキシがないローカルでの暫定。

デフォルトは**プロセス内メモリ**——単機で足りる。複製かつアプリ内で共有カウントが要るなら Redis。さもないと総上限はおおよそ `limit × インスタンス数`。

```bash
pnpm add @aomex/rate-limit
# 複数インスタンスでアプリ内共有カウントが要る場合：
pnpm add @aomex/rate-limit-redis-store
```

## 全サイトに載せる

エッジで IP 制限済みなら、もう一層全サイト `rateLimit()` は不要。業務キーやローカル直結なら、`rateLimit()` を mount の前の方へ。窓内超過はその場で **429**。各 action で数えなくてよい。

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      limit: 100,
      window: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

`window` はカウント窓（ミリ秒または `'1 hour'`、`'30s'` など。デフォルト 1 時間）。`limit` は窓内許可回数（デフォルト 2500）。未設定は「IP あたり、1 時間 2500」——ローカル直結は緩めて自分をロックアウトしない。

通常の WebMiddleware。超過は HTTP エラー **429**。応答に `X-RateLimit-*`；`headers: false` でオフ可。

## Key / ユーザーごと、ヘルスチェック除外

デフォルト `id` は `ctx.request.ip`。API Key やログインユーザーでバケット分けするなら自前 `id`；`false` はこの行をカウントしない（ヘルスチェック向け）。内網を丸ごとスキップは `allowList`；特定 IP を即拒否は `denyList`（**403**、カウントしない）。

```typescript
rateLimit({
  limit: 60,
  window: 60_000,
  id: (ctx) => { // [!code highlight]
    if (ctx.request.pathname === '/health') {
      return false;
    }
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
  allowList: (ctx) => {
    return ctx.request.ip === '127.0.0.1';
  },
});
```

IP のみだと NAT 背後のオフィス全体が一キーで誤爆しやすい。ログイン・SMS はユーザーまたは API Key 向き。全サイトがきつすぎるならホットルートだけ mount が一般的。

## 単一ルートだけ

ログイン・CAPTCHA は全サイトだと緩すぎる。該当ルートの mount に `rateLimit()` を、`body()` と並べる。

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ limit: 10, window: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

## 本番複製：Redis に切替

複数 Pod でデフォルト memory だと各インスタンス別カウント、総クォータが倍化。共有は `@aomex/rate-limit-redis-store`。

コンストラクタには `RedisOptions` のみ（`host` / `port` 等。型は本パッケージから）。既存 `Redis` インスタンスは渡さない。`ioredis` は同梱、別依存不要。store は内部 `lazyConnect`。`rateLimit()` が [`registerLifecycle`](/ja/core/service#ライフサイクルフック) 経由で接続/切断。

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  limit: 500,
  window: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

デフォルト memory store は `@aomex/rate-limit/memory` から明示 import 可。シャットダウンでプロセス内カウントクリア。自前 store はパッケージ内 `RateLimitStore` の原子 `getAndSet` を実装。接続が要るなら `onInit` / `onDestroy` を上書き（`rateLimit()` が自動登録）。シグネチャは型定義準拠。

::: tip
本番で Nginx がある：**まず** `limit_req` 等で IP / 接続制限；アプリ層はログイン、SMS、Key クォータへ。ゲートウェイと同じきつい IP 上限を二重に重ね誤爆しない。
:::

## 次に

- ハニーポット / エラー累積 / IP 封鎖：[悪用防止](/ja/plugins/abuse)
- WebSocket 受信メッセージ制限：[レート制限（WebSocket）](/ja/websocket/rate-limit)
- 実 IP（制限キー）：[Web 入口](/ja/web/) の proxyIP
- 身份：[Auth](/ja/plugins/auth)
- エラー形：[エラー形式](/ja/web/errors)