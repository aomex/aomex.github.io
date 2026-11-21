---
outline: deep
---

# 乱用対策

ディレクトリ走査、ハニーポット命中、短時間の 404 連発、ログアウトでの偽 token 試行——これらは「普通の過剰アクセス」ではなく、境界を探っていることが多い。`@aomex/abuse` は戦略ごとに**カウント**し、上限で** IP をブロック**（またはアカウント凍結はコールバック任せ）する。[レート制限](/ja/plugins/rate-limit)と補完関係：レート制限は突発 QPS、乱用対策はプロービングと業務側が報告する悪意行為向き。

カウントとブロック状態は `@aomex/cache` アダプタ（memory / Redis など）に載る。複数インスタンスなら Redis を共有する。`ctx.request.ip` に依存する。本番では `proxyIP: { mode: 'detect' }`（または固定の信頼チェーン）を設定しないと、全リクエストがリバースプロキシ IP に見える可能性がある。

```bash
pnpm add @aomex/abuse
# 既存の @aomex/cache（本番では Redis アダプタ）も必要
```

## ミドルウェアを載せる

`createAbuse` の戻り値は**ミドルウェア兼 API**（`userAbuse` / `ipAbuse` / `blockIP` など）で、**ctx には載らない**。インスタンスを作り `mount` し、ルートや Service から同じオブジェクトを呼ぶ。

```typescript
import { createAbuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';

const abuse = createAbuse({ // [!code focus:18]
  store: new CacheMemoryAdapter(),
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
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [abuse, routers('./src/routers')], // [!code highlight]
});
```

ローカル / 単体テストは memory。本番で複数レプリカなら `store` を Redis アダプタにしないとブロックは各ホストだけ。`window` / `blockFor` などの時間はミリ秒または `'1 hour'`、`'30m'` のような文字列——[キャッシュ](/ja/core/cache#期間-durationinput)と同じ `DurationInput`。

リクエストごと：IP が既にブロック → 既定 **403**。ハニーポットで上限到達 → 即ブロックして 403。`http-error` はレスポンス後にカウント。**上限を超えた当該リクエストは元のステータスのまま**、次のリクエストから 403。

## 四つの戦略

| 戦略 | 何がカウントされる | 上限時 |
| --- | --- | --- |
| `honeypot` | 意図的に置いたおとりパスへのアクセス | IP ブロック |
| `http-error` | 指定ステータスコードのレスポンス（`throw` または `send`） | IP ブロック |
| `ip-abuse` | 業務が `abuse.ipAbuse(ip, reason)` を呼ぶ | IP ブロック |
| `user-abuse` | 業務が `abuse.userAbuse(id, reason)` を呼ぶ | `onBanUser` のみ。**IP は自動ブロックしない** |

### ハニーポットパス

パス文字列は完全一致・簡易 glob。正規表現も可。正規表現は `pathname + search` を見る。変な query のプロービングに向く。`methods` は任意。未設定ならメソッド不問。

| 書き方 | マッチ範囲 |
| --- | --- |
| 完全一致（`*` なし） | pathname 全体一致。`'/.env'` は `'/.env.local'` に当たらない |
| `*` | **一段内**の任意文字、**`/` は跨がない**。`'/wp-*.php'` は `/wp-login.php` に当たり `/wp/admin.php` には当たらない |
| `**` | **複数段を跨げる**。`'/a/**/c'` は `/a/b/d/c` に当たり `/a/c` には当たらない（間に最低一段必要） |
| 末尾 `/**` | ディレクトリ自身と任意の深い子パス。`'/.git/**'` は `/.git`、`/.git/config` に当たり `/.github` には当たらない |
| `RegExp` | `pathname + search`、例 `/^\/admin\?.*dump=/` |

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

glob は pathname のみ。query は無視。query 込みなら正規表現。`paths` は空不可。作成時に検証。波括弧などは展開構文ではなくリテラル。

### エラーステータスで累計

同一戦略内の複数 `statusCodes` は**ひとつのバケットで累計**。`paths` / `methods` で絞れる。未設定ならサイト全体の該当ステータス。

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

API スキャン向け。ログインの 401 も厳しくしたいなら `paths` 付きで別戦略を足す。全站 404 と同じバケットに混ぜない。

### 業務報告：IP

レスポンスは成功のまま（logout が常に 204 など）だが IP 単位で「疑わしい試行」を記録したいときは `ip-abuse` とルート内呼び出し。`reason` は文字列でよい。戦略で宣言したものと一致必須。未知の reason は実行時に例外。同一 reason は戦略 1 本だけ。

```typescript
const abuse = createAbuse({
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
    const hit = await services.cache.deleteLoginToken(token);
    if (!hit) {
      await abuse.ipAbuse(ctx.request.ip, 'logout-miss'); // [!code highlight]
    }
    ctx.send(204);
  },
});
```

reason が増えたら TypeScript `enum`（文字列・数値どちらも可）でまとめ、魔法文字列を散らさない。戦略と `ipAbuse` に同じメンバを渡すと、第 2 引数は戦略に現れたメンバーに狭まる。未設定メンバーや裸の `'logout-miss'` は型エラー。

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// strategies: reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

### 業務報告：ユーザー

アカウント単位の乱用（特典の濫用、クレデンシャルスタッフィング後のユーザー軸など）は `user-abuse`。パッケージは**ユーザ DB を書かない**——上限で `onBanUser` のみ。DB 更新・ session 破棄はコールバック側。いずれか `user-abuse` があると **`onBanUser` 必須**（作成時チェック）。`reason` は文字列でも enum でも可。

```typescript
const abuse = createAbuse({
  store,
  strategies: [
    {
      strategy: 'user-abuse',
      reason: 'order-probe',
      limit: 10,
      window: '1 day',
      banFor: '7 days', // 推奨 BAN 時間、コールバックへ
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

enum の使い方は IP と同じ。`detail` に `count` / `limit`、ミリ秒に解釈された `banFor`（戦略未設定なら `undefined`）。同一ユーザー・同一 reason でウィンドウ内の `onBanUser` は最大 1 回（キャッシュプレースホルダで並行重複防止）。コールバックが throw するとプレースホルダ解放されウィンドウ内リトライ可。

## 手動ブロックとフック

| API | 役割 |
| --- | --- |
| `blockIP(ip, duration)` | 手動 IP ブロック。既にブロックならスキップ（TTL 更新・コールバック重複なし） |
| `unblockIP(ip)` | ブロック解除 |
| `isIPBlocked(ip)` | ブロック中か |
| `onBlockIP` | 戦略命中、`ipAbuse` 上限、手動 `blockIP` 時 |
| `bypass` | プローブカウントとブロックチェックをスキップ（ヘルス、社内） |
| `blockedError` | ブロック時のカスタム `HttpError`（既定 403） |

```typescript
const abuse = createAbuse({
  store,
  strategies: [/* ... */],
  bypass: (ctx) => {
    return ctx.request.pathname === '/health';
  },
  blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  onBlockIP: async (ip, reason, detail) => {
    services.logger.warn('abuse.block', { ip, reason, ...detail });
  },
});

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

`onBlockIP` の `reason` は `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`。`detail.blockFor` はミリ秒。

::: tip
乱用ブロックは「捕まえたらしばらく閉める」向き。サイト全体のソフトリミットは [レート制限](/ja/plugins/rate-limit)。両方載せられる：レート制限を前にして毛刺を抑え、乱用対策で戦略ベースの封じ込め。
:::

## 関連

- [レート制限](/ja/plugins/rate-limit)
- [キャッシュ](/ja/core/cache)（`store` アダプタと `DurationInput`）
- [CSRF](/ja/plugins/csrf)