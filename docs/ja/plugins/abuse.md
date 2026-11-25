---
outline: deep
---

# 不正利用対策

ディレクトリ走査、ハニーポット接触、短時間の大量 404、偽 token でのログアウト試行——これらは「普通の超過」ではなく境界を探っていることが多い。`@aomex/abuse` は戦略ごとに**数え**、上限で **IP を封鎖**する（またはコールバックであなたがアカウントを封じる）。[リクエスト制限](/ja/plugins/rate-limit) と補完関係：制限は突発 QPS を抑え、不正利用は偵察と業務側からの通報を拾う。

カウントと封鎖状態は `@aomex/cache` のアダプタ上（memory / Redis など）。複数インスタンスで共有するなら Redis。`ctx.request.ip` に依存するので、本番では `proxyIP: { mode: 'detect' }`（または固定の信頼チェーン）を付ける。そうしないと全站がリバースプロキシの IP だけに見えることがある。

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## 作成して `.web()` を載せる

`new Abuse(...)` が返すのは**サービス**（`ipAbuse` / `blockIP` などの API がある）。mount にそのまま入れられるミドルウェアではない。HTTP 側は `.web()` を `WebApp.mount` に載せる。業務コードでは同じ `abuse` インスタンスの API を呼び続ける——**`ctx` には載らない**。

次の設定はよく使う 2 戦略を先に載せる：ハニーポットパス（触ったらすぐ封鎖）とエラー状態コード累計（短時間で 401 / 404 が溜まってから封鎖）。

```typescript
import { Abuse } from '@aomex/abuse';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const cache = new Caching(new CacheMemoryAdapter());

const abuse = new Abuse({ // [!code focus:18]
  store: cache,
  strategies: [
    {
      strategy: 'honeypot',
      paths: ['/.env', '/wp-admin/**'],
      limit: 1,
      window: '1 hour',
      blockFor: '1 month',
    },
    {
      strategy: 'http-error',
      statusCodes: [401, 404],
      limit: 30,
      window: '10 minutes',
      blockFor: '1 week',
    },
  ],
});

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [abuse.web(), routers('./src/routers')], // [!code highlight]
});
```

ローカル / 単体テストは memory。本番の複数レプリカは `store` を Redis アダプタに替える。そうしないと封鎖は自機だけ。`window` / `blockFor` などの長さはミリ秒または読みやすい文字列（`'1 hour'`、`'30m'`）。[キャッシュ](/ja/core/cache#期間-durationinput) と同じ `DurationInput`。

リクエスト到来時：既に封鎖済み IP → 既定 **403**。ハニーポットに当たり上限 → その場で封鎖して 403。`http-error` は応答後に数える——**当たった当回は元の状態コードのまま**。次のリクエストから封鎖で 403。

WebSocket 側は同じ `abuse` に `.socket()`（イベントハニーポットなど）。[不正利用対策（WebSocket）](/ja/websocket/abuse) を参照。本ページでは繰り返さない。

## ハニーポットパス

通常ユーザーが踏まないパスをわざと置く（`/.env`、`/wp-admin/**` など）。誰かが掃くと IP ごとに数え、上限で封鎖。パス文字列は完全一致と単純 glob。正規表現も可。正規表現は `pathname + search` を見るので、変な query 付きの偵察を拾いやすい。`methods` は任意。未指定ならメソッドは問わない。

```typescript
{
  strategy: 'honeypot',
  paths: ['/.env', '/.env*', '/.git/**', '/wp-*.php', /^\/admin\?.*dump=/],
  methods: ['GET'],
  limit: 1,
  window: '1 hour',
  blockFor: '1 day',
}
```

書き方の対照：

| 書き方 | マッチ範囲 |
| --- | --- |
| 正確な文字列（`*` なし） | pathname 全体が完全一致。`'/.env'` は `'/.env.local'` に当たらない |
| `*` | **単一セグメント内**の任意文字。**`/` は跨がない**。`'/wp-*.php'` は `/wp-login.php` に当たり、`/wp/admin.php` には当たらない |
| `**` | **複数セグメントを跨げる**。`'/a/**/c'` は `/a/b/d/c` に当たり、`/a/c` には当たらない（間に少なくとも 1 段） |
| 末尾 `/**` | ディレクトリ自身 + 任意の深い子パス。`'/.git/**'` は `/.git`、`/.git/config` に当たり、`/.github` は誤爆しない |
| `RegExp` | `pathname + search` を検査。例：`/^\/admin\?.*dump=/` |

glob は pathname だけ。query は影響しない。query も見たいときは正規表現。`paths` は空にできない。作成時に検証する。波括弧などの拡張構文はなく、リテラルとしてマッチする。

## エラー状態コードの累計

短時間に大量の 404 / 401 は、インターフェース走査や資格情報の当たりが多い。`http-error` を使う：同一戦略内の複数 `statusCodes` は**混ぜて累計**。さらに `paths` / `methods` で絞れる。未指定なら全站その状態コードを数える。

```typescript
{
  strategy: 'http-error',
  statusCodes: [404],
  paths: ['/api/**'],
  limit: 50,
  window: '15 minutes',
  blockFor: '2 hours',
}
```

API 走査を止めるのに向く。ログイン上の 401 も厳しくしたいなら、`paths` 付きの戦略を別に載せる。全站 404 と同じ桶に混ぜない。

## 業務通報：偽 token の試行

応答自体は成功（例：logout は token の有無に関わらず 204）でも、IP 単位で「怪しい試行」を数えたいときは `ip-abuse` + ルート内呼び出し。`reason` は文字列でよい。戦略で宣言した値と一致させる。未知の reason は実行時にエラー。同じ reason は 1 戦略だけ。

```typescript
const abuse = new Abuse({
  store,
  strategies: [
    {
      strategy: 'ip-abuse',
      reason: 'logout-miss',
      limit: 5,
      window: '1 hour',
      blockFor: '6 hours',
    },
  ],
});

router.post('/logout', {
  action: async (ctx) => {
    const hit = await services.user.deleteLoginToken(token);
    if (!hit) {
      await abuse.ipAbuse(ctx.request.ip, 'logout-miss'); // [!code highlight]
    }
    ctx.send(204);
  },
});
```

業務 reason が増えたら TypeScript の `enum`（文字列または数値メンバー）でまとめると、魔法文字列の散らばりを防げる。戦略と `ipAbuse` の両方に enum メンバーを渡す。第 2 引数は「戦略に出たメンバー」に絞られ、未設定メンバーや裸の `'logout-miss'` は型で止まる。

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// strategies 里：reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

## 業務通報：アカウント次元

アカウント単位の不正利用（クーポン連打、資格情報当たり後のユーザー次元など）は `user-abuse`。パッケージは**ユーザー庫を触らない**——上限では `onBanUser` だけ呼び、あなたがコールバックで DB 更新や session キックをする。どれか 1 つでも `user-abuse` があれば **`onBanUser` は必須**。作成時に検査する。`reason` も文字列または enum。

```typescript
const abuse = new Abuse({
  store,
  strategies: [
    {
      strategy: 'user-abuse',
      reason: 'order-probe',
      limit: 10,
      window: '1 day',
      banFor: '7 days', // 建议封禁时长，经回调传出
    },
  ],
  onBanUser: async (id, reason, detail) => { // [!code focus:6]
    await db.user.update({
      where: { id: Number(id) },
      data: { bannedUntil: new Date(Date.now() + (detail.banFor ?? 0)) },
    });
  },
});

await abuse.userAbuse(userId, 'order-probe');
```

enum の書き方は IP と同じ：戦略は `UserAbuseReason.OrderProbe`、通報と `onBanUser` の `reason` はユニオンメンバーに絞られる。数値 enum（`OrderProbe = 1`）も可。保存前に `String(reason)` するので、バケットキーは文字列形。

`detail` には `count` / `limit`、ミリ秒に解決した `banFor`（戦略未設定なら `undefined`）。同一ユーザー + 同一 reason は窓内で `onBanUser` が成功するのは一度だけ（キャッシュのプレースホルダで並行走査を防ぐ）。コールバックが例外を投げるとプレースホルダが外れ、窓内の再試行が可能になる。

## ヘルスチェック迂回と手動封鎖

プローブパスを封鎖ロジックで止めない：`.web()` に `bypass` を渡す。運用で一時的に IP を封じ / 解くなら `blockIP` / `unblockIP`。照会は `isIPBlocked`。監査ログを残すなら `onBlockIP`——戦略の上限、`ipAbuse` 満額、手動 `blockIP` のどれでもコールバックに入る。

封鎖時の既定は **403**。制限と同じく 429 に揃えたいなら `blockedError` を渡す。

```typescript
import { logger } from '@/services/logger.service';

const abuse = new Abuse({
  store,
  strategies: [/* ... */],
  onBlockIP: async (ip, reason, detail) => {
    await logger.withBindings({ ip, reason, ...detail }, async () => {
      logger.warn('abuse.block');
    });
  },
});

mount: [
  abuse.web({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.request.pathname === '/health';
    },
    blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  }),
  routers('./src/routers'),
],

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

HTTP 側の `onBlockIP` の `reason` はよく `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`。同じインスタンスに WebSocket イベントハニーポットも載せていれば `'socket-events'` も出る（[不正利用対策（WebSocket）](/ja/websocket/abuse)）。`detail.blockFor` の単位はミリ秒。既に封鎖済みなら再度の `blockIP` はスキップ（TTL を伸ばさず、コールバックも繰り返さない）。

::: tip
不正利用の封鎖は「捕まえたらしばらく閉じる」寄り。全站のソフト制限は [リクエスト制限](/ja/plugins/rate-limit) を見る。両方載せてよい：制限を前に置いてスパイクを抑え、不正利用は戦略累計のあとで封鎖。
:::

## 関連

- [リクエスト制限](/ja/plugins/rate-limit)
- [不正利用対策（WebSocket）](/ja/websocket/abuse)
- [キャッシュ](/ja/core/cache)（`store` アダプタと `DurationInput`）
- [CSRF 対策](/ja/plugins/csrf)
