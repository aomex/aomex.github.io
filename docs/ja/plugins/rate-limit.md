---
outline: deep
---

# レート制限

時間窓内でクライアント識別子をカウントし、超過時は **429** を返す。API 乱打や突発トラフィックを抑える。

**IP / 接続単位のサイト全体制限は、本番では Nginx を優先**（`limit_req_zone` / `limit_req` など）。リクエストは Node に入る前に遮断でき、複数レプリカでも先に Redis は不要。`@aomex/rate-limit` は **ユーザー / API Key など業務キー**、ログイン SMS など単一路由の絞り込み、ローカルにリバースプロキシがないときのつなぎ向き。

既定は**プロセス内メモリ**でのカウント。単機なら十分。複数レプリカでアプリ内カウントが必須なら Redis に換える。さもないと実効上限はおおよそ `maxRequest × インスタンス数`。

```bash
pnpm add @aomex/rate-limit
# 複数インスタンスでアプリ内共有カウントが必須のとき：
pnpm add @aomex/rate-limit-redis-store
```

## サイト全体マウント

エッジで IP 制限済みなら、アプリでまたサイト全体の `rateLimit()` を載せる必要はない。業務キーやローカル直結のときは `rateLimit()` を mount の前の方へ。窓内超過は **429**。各 action でカウントしなくてよい。複数レプリカで共有カウントが要るときは Redis store（下記）。

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      maxRequest: 100,
      duration: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

通常の WebMiddleware。超過時は HTTP エラーでステータス **429**。各 action に手書き判定は不要。`id` が `false` を返すとそのリクエストはカウントしない（ヘルスチェックでよく使う）。

## カウントキーと許可 / 拒否リスト

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `duration` | ウィンドウの長さ | 1 時間 |
| `maxRequest` | ウィンドウ内の許可回数 | 2500 |
| `id` | API Key / ユーザー単位。`false` で免除 | IP |
| `allowList` / `denyList` | 内網スキップ。IP 遮断 | — |
| `store` | **複数インスタンスでは Redis 等に必須** | メモリ |

### Key / ユーザー単位、ヘルスチェックは除外

```typescript
rateLimit({
  maxRequest: 60,
  duration: 60_000,
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

### 単一路由だけ制限

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ maxRequest: 10, duration: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

### 本番・複数レプリカ：Redis

コンストラクタには **`RedisOptions` だけ**渡す（`host` / `port` など。型は当パッケージから import 可）。**既に作った `Redis` インスタンスは渡さない**。`ioredis` は `@aomex/rate-limit-redis-store` に同梱。別途依存を足す必要はない。store は内部で `lazyConnect` し、`rateLimit()` が [`registerLifecycle`](/ja/core/service#ライフサイクルフック) 経由でプロセス側の接続 / 切断を行う。

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
  maxRequest: 500,
  duration: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

既定のメモリ store は `@aomex/rate-limit/memory` から明示 import もできる。停止時にプロセス内カウントはクリアされる。

| 環境 | 推奨 |
| --- | --- |
| ローカル直結 | アプリ制限は可。上限は緩め、自分をロックアウトしない |
| 本番に Nginx | **優先** `limit_req` 等で IP / 接続制限。アプリ層はログイン・SMS・Key クォータ |
| 本番・複数 Pod + アプリ内カウント | **必須** 共有 `store`（Redis）。ゲートウェイと同じ厳しすぎる IP 上限を二重にしない |

自前ストアはパッケージ内 `RateLimitStore` の原子 `getAndSet` を実装する。接続 / 切断が要るときは `onInit` / `onDestroy` を上書きできる（`rateLimit()` が自動登録）。署名は型定義に従う。

IP のみの制限だと、NAT 背後のオフィス全体が 1 キーになり誤爆しやすい。ログインなどはユーザーまたは API Key 単位の方が向く。サイト全体の上限が厳しすぎるときは、ホットルートだけ別 mount で絞るのが一般的。

## 次のステップ

- ハニーポット / エラー累計 / IP ブロック：[乱用対策](/ja/plugins/abuse)
- 実 IP（レート制限キー）：[アプリ入口](/ja/web/) の proxyIP
- 認証の軸：[Auth](/ja/plugins/auth)
- エラーの形：[エラーフォーマット](/ja/web/errors)