---
outline: deep
---

# リクエスト制限

時間窓の中でクライアント識別子ごとに数え、上限を超えたら **429** を返す。スクレイピングや突発トラフィックを抑える。

**IP / 接続単位の全站制限は、本番では Nginx を優先**（`limit_req_zone` / `limit_req`）：リクエストが Node に入る前に止まり、複数レプリカでも先に Redis は要らない。`@aomex/rate-limit` が向くのは **ユーザー / API Key など業務キー**、ログインや SMS など単一ルートの締め付け、またはリバースプロキシがまだ無いローカルでの暫定防衛。

既定のカウントは**プロセス内メモリ**——単機なら十分。複数レプリカでアプリ内共有が必要なら Redis に替える。そうしないと実効上限はだいたい `limit × インスタンス数` になる。

```bash
pnpm add @aomex/rate-limit
# 複数インスタンスでアプリ内の共有カウントが必要なとき：
pnpm add @aomex/rate-limit-redis-store
```

## 全站に載せる

エッジで既に IP 制限しているなら、アプリにもう一段の全站 `rateLimit()` は不要。業務キー、またはローカル直結のときは mount の前寄りに置く：窓内で超過したらすぐ **429**、各 action で数え直す必要はない。

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ja-JP' },
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

`window` はカウント窓（ミリ秒、または `'1 hour'` / `'30s'` のような読みやすい長さ。既定は 1 時間）。`limit` は窓内の許可回数（既定 2500）。何も渡さないと「IP ごと、1 時間 2500 回」——ローカル直結は少し緩めにし、調査中に自分をロックアウトしないようにする。

普通の WebMiddleware。超過すると HTTP エラーを投げ、状態は **429**。応答に `X-RateLimit-*` ヘッダーが付く。`headers: false` でオフにできる。

## Key / ユーザー単位、ヘルスチェックは除外

既定の `id` は `ctx.request.ip`。API Key やログインユーザーでバケットを分けたいときは自分で `id` を書く。`false` を返すとその行は数えない（ヘルスチェックでよく使う）。イントラを丸ごと飛ばすなら `allowList`、特定 IP をすぐ拒否するなら `denyList`（ヒットは **403**、カウントはしない）。

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

IP だけだと NAT の裏でオフィス全体が同じキーになり、誤検知しやすい。ログインや SMS はユーザーや API Key の方が向く。全站上限が緩すぎるときは、ホットなルートだけ別 mount するのが普通。

## 単一ルートだけ制限

ログインや検証コードは、全站上限だと緩すぎることが多い。そのルートの mount に `rateLimit()` を載せ、`body()` と並べればよい。

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

## 本番の複数レプリカ：Redis に換える

複数 Pod が既定のメモリ store のままだと、各インスタンスが別々に数え、総クォータが倍々になる。共有カウントなら `@aomex/rate-limit-redis-store` に替える。

コンストラクタには `RedisOptions`（`host` / `port` など。型は本パッケージから）だけ渡す。できあがった `Redis` インスタンスは渡さない。`ioredis` はパッケージ同梱なので別途入れなくてよい。store 内部は `lazyConnect`。`rateLimit()` が [`registerLifecycle`](/ja/core/service#ライフサイクルフック) 経由でプロセス側の接続 / 切断を登録する。

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

既定のメモリ store は `@aomex/rate-limit/memory` から明示 import もできる。シャットダウン時にプロセス内カウントをクリアする。自前ストアはパッケージ内 `RateLimitStore` の原子的 `getAndSet` を実装する。接続 / 切断が要るときは `onInit` / `onDestroy` を上書き（`rateLimit()` が自動登録）。シグネチャは型定義に従う。

::: tip
本番に Nginx があるとき：**優先**して `limit_req` などで IP / 接続制限する。アプリ層はログイン、SMS、Key 単位のクォータに残す。ゲートウェイと同じ厳しすぎる IP 上限を重ねると誤検知しやすい。
:::

## 次のステップ

- ハニーポット / エラー累計 / IP 封鎖：[不正利用対策](/ja/plugins/abuse)
- WebSocket の受信メッセージ制限：[リクエスト制限（WebSocket）](/ja/websocket/rate-limit)
- 実クライアント IP（制限キー）：[Web アプリ入口](/ja/web/) の proxyIP
- 身元の次元：[Auth](/ja/plugins/auth)
- エラーの形：[エラー形式](/ja/web/errors)
