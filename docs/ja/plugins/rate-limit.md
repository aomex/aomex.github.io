---
outline: deep
---

# レート制限

時間窓内でクライアント識別子をカウントし、超過で **429**。API 乱打やバースト対策。

**IP / 接続のサイト全体制限は本番 Nginx 優先**（`limit_req_zone` / `limit_req` 等）：Node に入る前に遮断。複数レプリカでも先に Redis は不要。`@aomex/rate-limit` は**ユーザー / API Key 等の業務キー**、ログイン SMS 等の単一路由絞り、ローカルにリバースプロキシがないときのつなぎ向き。

既定は**プロセス内メモリ**カウント——単機で足りる。複数レプリカでアプリ内カウント必須なら Redis。さもないと総上限はおおよそ `maxRequest × インスタンス数`。

```bash
pnpm add @aomex/rate-limit
# 多实例且必须在应用内共享计数：
pnpm add @aomex/rate-limit-redis-store ioredis
```

## サイト全体マウント

エッジで IP 制限済みならアプリでまたサイト全体 `rateLimit()` は不要。業務キーやローカル直結なら `rateLimit()` を mount の前の方へ。窓内超過は **429**。各 action でカウント不要。複数レプリカ共有は Redis store（下記）。

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

通常 WebMiddleware。超過は HTTP エラー **429**。各 action に手書き不要。id が false を返すと当該リクエストはカウントしない（ヘルスチェック向き）。

## カウントキーとホワイトリスト

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `duration` | 窓の長さ | 1 時間 |
| `maxRequest` | 窓内許可数 | 2500 |
| `id` | API Key / ユーザー。`false` で免除 | IP |
| `allowList` / `denyList` | 社内スキップ。IP 封鎖 | — |
| `store` | **複数インスタンスでは必須** Redis 等 | メモリ |

### Key / ユーザー、ヘルスチェック除外

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

### 単一路由のみ

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

### 本番複数レプリカ：Redis

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';
import Redis from 'ioredis';

rateLimit({
  store: new RateLimitRedisStore(new Redis()), // [!code highlight]
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

| 環境 | 推奨 |
| --- | --- |
| ローカル直結 | アプリ制限可。上限は緩め、自分をロックアウトしない |
| 本番 Nginx | **優先** `limit_req` 等で IP/接続制限。アプリ層はログイン、SMS、Key クォータ |
| 本番 複数 Pod + アプリ内カウント | **必須**共有 `store`（Redis）。ゲートウェイと同じ厳しすぎ IP 上限を二重にしない |

自前ストアはパッケージ RateLimitStore の原子 getAndSet を実装。署名は型定義準拠。

IP のみ制限だと NAT 背後のオフィス全体が 1 キーで誤爆しやすい。ログイン等はユーザーまたは API Key が向く。サイト全体上限が厳しすぎるとホットルートだけ mount が多い。

## 次のステップ

- 実 IP（制限キー）：[アプリ入口](/ja/web/) の proxyIP
- 認証次元：[Auth](/ja/plugins/auth)
- エラー形：[エラーフォーマット](/ja/web/errors)