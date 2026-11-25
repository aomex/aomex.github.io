# キャッシュ

コンポジションルートで共有 **`Caching`** を 1 つ：memory / file / Redis アダプタを選び、業務と認証 / 悪用対策 / OAuth などのプラグインへ**同一インスタンス**を渡します（設定名は多くの場合 `store`）。ログイン **session**（token → ユーザー情報）で「発行・認証読取・ログアウト削除」の一連を通します。

クラス名は `Caching` のまま、`Cache` に変えない — TypeScript DOM / Web Cache API のグローバル `Cache` と衝突を避けます。インスタンス変数は `cache` 推奨。初回読み書きで遅延接続、停止時は内部 `registerLifecycle` で切断。

`src/cache.ts` は **`cache` と `remember` だけ export**；ログイン session、業務キープレフィックスは各 Service に書き、ここから `import { cache }`。

```typescript
// src/cache.ts
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter()); // [!code highlight]
export const remember = createRemember(cache);
```

`get` / `set` / `delete` / `getAndDelete` / `singleFlight` などは **文字列または `CacheKey`** を受け付けます。`get<T>(key)` にジェネリックを付けると戻り値の型は `T | null`；`set` / `setNX` / `expire` の TTL は **`DurationInput`**：ミリ秒または可読文字列（`'7 days'`、`'30m'`、`'1.5 hours'`）、下記参照。

プラグイン側はこのインスタンスをそのまま渡します：

```typescript
import { cache } from '@/cache';

new Abuse({ store: cache, strategies: [/* … */] });
new AuthSessionStrategy({ store: cache, /* … */ });
new OAuth2Client({ store: cache, /* … */ });
```

::: tip
プラグインごとに `new Caching(adapter)` しない — コンポジションルートで 1 回作り共有。複数ストア（ローカル memory + 共有 Redis）のときだけ 2 つ目を作り、それぞれ `createRemember`。
:::

## session の読み書き

ログインで token 発行後、「token → ユーザー情報」をキャッシュへ。認証 `onLoaded` で読み戻し、ログアウトで delete。キーはバージョン付き `CacheKey` プレフィックス — リリースで session 構造を変えるとき 1 箇所で一括無効化。これらのメソッドは User / Auth など Service に置きます：

```typescript
// src/services/user.service.ts
import { Service } from '@aomex/common';
import { cache } from '@/cache';

export default class UserService extends Service {
  protected readonly loginTokenKey = cache.key('login-token', 'v1'); // [!code highlight]

  async getLoginToken(token: string) {
    return cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await cache.set(this.loginTokenKey.key(token), session, '7 days');
  }

  async deleteLoginToken(token: string) {
    return cache.delete(this.loginTokenKey.key(token));
  }
}
```

業務側（ログイン / 認証 / ログアウト）：

```typescript
// 登录成功后写入
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.user.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// 鉴权 onLoaded 里读取
const session = await services.user.getLoginToken(token);
if (!session) {
  return false;
}

// 退出登录删掉
await services.user.deleteLoginToken(token);
```

## アダプタ選択

アダプタがデータの置き場を決めます：**memory** はゼロ依存・プロセス内・再起動で消える（ローカルと単体テスト）；**Redis** は複数インスタンスで session・レート制限カウント共有；少しディスク永続化なら **file**。業務コードは構築時のアダプタを変えることが多く、読み書き API は同じです。

ローカル・単体テストは `@aomex/cache/memory`、ゼロ依存、再起動で消失：

```typescript
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
```

本番や複数インスタンス共有は `@aomex/cache-redis-adapter`（`ioredis` 同梱）：

```typescript
import { Caching } from '@aomex/cache';
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

export const cache = new Caching(
  new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }),
);
```

単機で軽い永続化は `@aomex/cache/file` も可。

## キーの組み立て：CacheKey

`cache.key(...)`（または静的 `CacheKey.key(...)`）の戻りは **`CacheKey`** であり plain string ではありません：片段は `:` で連結し、`.key` / `.keyHash` / `.toHash()` を続けられます。`cache.get` / `set` 等はそのまま受け取り、`String(...)` は不要です。

```typescript
cache.key('user', 1); // user:1
cache.key('user').key(1); // 同上
cache.key('user').keyHash(1); // user:<md5('1')>，前缀可读
cache.key('user', 1).toHash(); // <md5('user:1')>
cache.keyHash('user', 1); // 同上，整键哈希
```

| 書き方 | 結果 |
| --- | --- |
| `cache.key('a', 1)` | 可読キー `a:1` |
| `prefix.key(id)` | 既存 `CacheKey` プレフィックスに連結 |
| `cache.key('a').keyHash(id)` | プレフィックス維持、**今回の引数だけ**ハッシュ |
| `cache.key(...).toHash()` / `cache.keyHash(...)` | **全体** MD5、可読プレフィックスなし |

片段が長い・変な文字・Redis に平文を出したくないときはハッシュ；日常業務キーは可読プレフィックスの方が調査しやすい。旧単独 `hash()` は廃止、上記に統一。

### プレフィックスとバージョン

対応 Service で `protected readonly` に業務プレフィックス（例 `login-token`）を集約し、メソッド内で `.key(token)` / `.key(id)` — 各处魔术文字列を書かない。バージョンをプレフィックスに（`v1` → `v2`）＝**別名で**旧 session を無効化：

```typescript
protected readonly loginTokenKey = cache.key('login-token', 'v2');
```

## 期間 DurationInput

TTL を `60_000` と手計算しなくてよい。`set` / `setNX` / `expire`、および `@remember` の `duration` は次を受け付けます：

- **number**：ミリ秒（従来どおり）
- **string**：数字 + 単位、スペース任意 — `'30m'`、`'1 hour'`、`'7 days'`

よく使う単位：`ms` / `s`（`sec` / `second`）/ `m`（`min` / `minute`）/ `h`（`hr` / `hour`）/ `d`（`day`）/ `w`（`week`）/ `month` / `y`（`year`）。`month` は 30 日、`year` は 365 日。他处でも `import { parseDuration } from '@aomex/common'` で可読時間を ms に変換可。

```typescript
await cache.set(key, session, '7 days');
await cache.setNX(lockKey, '1', '30 seconds');
await cache.expire(key, '1 hour');
```

## exists：在否だけ知りたい

キーが**あるか**だけ知り、値をデコードして読む必要がないとき `exists`。`boolean` を返し、文字列または `CacheKey` を受け付けます。

```typescript
const key = loginTokenKey.key(token);
if (await cache.exists(key)) {
  // 会话还在，再决定要不要 get 详情
}
```

`get` との違い：未命中は `null`（自分で判定）し、値を逆シリアライズする；`exists` はアダプタに「キーはまだあるか」だけ聞く。プレースホルダ、ロック保持、大きいオブジェクトを get する前の確認向き。

::: tip
「exists してから get」の間に他がキーを消したり変えたりする — 厳密なトランザクション条件にしない。ロック・冪等は下記 `setNX`；一度きり消費は `getAndDelete`。
:::

## getAndDelete：読んで即削除

Redis `GETDEL` に合わせ「使い捨て凭証」なら `getAndDelete`：アトミックに取得と削除。並行 2 路では一方だけ値、他方は `null`（または渡した default）。

典型：OAuth `state`、メール验证码、短時間ダウンロード票 — 読んだら必ず無効、リプレイ防止。

```typescript
const ticket = await cache.getAndDelete<{ userId: number }>(
  cache.key('email-verify', code),
);
if (!ticket) {
  ctx.throw(400, '验证码无效或已使用');
}
// ticket.userId 可用；键已不在缓存里
```

「先 `get` 再 `delete`」との違い：その間にもう一度読める；`getAndDelete` はアダプタ層で 1 回。第 2 引数は default（未命中時、型は `get` と同様）。

## setNX とカウント

`setNX` はキーが無いときだけ書き込み — 分散ロック、冪等「一度だけ処理」。TTL はタスク最悪時間をカバーしないと、期限後に別 worker がロックを取る。`increment` / `expire` は OTP 失敗回数、固定窓カウント向き。

ロック・冪等（TTL > 最悪実行時間）：

```typescript
const ok = await cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

認証コード失敗回数：まず `increment`、初回（または未 TTL）で `expire` で窓を切る — Redis `INCR` 慣習と同じ。memory アダプタの増減は**既存 TTL を保持**、数字変更で期限を消さない。

```typescript
const key = cache.key('otp-fail', phone);
const n = await cache.increment(key);
if (n === 1 || (await cache.ttl(key)) === -1) {
  await cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## singleFlight：並行は 1 回だけ実行

同一キーで多数が「その場計算」（JWKS 取得、高コスト API 1 回）し、結果を長期キャッシュしたくないとき `singleFlight`：最初だけ `factory`、他は共有結果を待つ；**飛行終了後は長期キャッシュを残さない**、次回は再計算。

```typescript
async function loadJwks() {
  return cache.singleFlight(cache.key('jwks'), async () => { // [!code focus:3]
    return fetchJwksFromIdp();
  });
}
```

`@remember` との分担：`remember` = singleFlight + **`duration` で長期書き込み**；`singleFlight` = **今回の並行共有だけ**、終わったら散る。ロック約 30 秒、実行中は延長；失敗時待ち側は同じエラー。実行者が落ちて結果を書かなければ待ち側は再競合（回数上限あり）。

::: tip
複数インスタンスではキーを共有アダプタ（Redis 等）に — singleFlight がプロセス跨ぎで効く。ローカル memory は現プロセスのみ。
:::

## キャッシュデコレータ

業務メソッドで「get → なければ計算 → set」を繰り返すのは冗長、同一キー並行で何度も計算される。`createRemember` が `@remember` メソッドデコレータを作る：ヒットなら即返却；ミスだけ元メソッド実行と書き込み；**同一キー並行は 1 実行**、他は待つ（プレースホルダロックは `singleFlight` と同系で約 30 秒延長）。

デコレータは**具体 `Caching` インスタンス**に紐づく — `createRemember(cache)`。アダプタやクラスコンストラクタは不可。`cache.ts` で export 後、業務 Service は `remember` を import：

```typescript
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
export const remember = createRemember(cache); // [!code highlight]
```

接続は `Caching` の遅延読み込みが担当。

### 業務メソッドに載せる

メソッドは **async**（Promise を返す）。时长だけ渡すと「どれだけキャッシュするか」（`DurationInput`）：

```typescript
import { Service } from '@aomex/common';
import { remember } from '@/cache';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

カスタム key や default ならオブジェクト形式；`await services.report.find(1)` 初回は DB、窓内同参はキャッシュ。`duration` は書き込み後の有効期限：

```typescript
class ReportService extends Service {
  @remember({ // [!code focus:8]
    duration: '1 minute',
    key: (id) => {
      return `report:${id}`;
    },
    defaultValue: null,
  })
  async find(id: number) {
    return db.report.find(id);
  }
}
```

| 書き方 | 役割 |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | TTL のみ；キーは既定規則 |
| `duration` | 必須（オブジェクト）；キャッシュ期間 |
| `key: '固定串'` | メソッド全体で 1 キー（無参・全站単一結果） |
| `key: (...args) => string` | 引数でキー；`this` は業務インスタンス |
| `defaultValue` | 元メソッドが `null` のとき外に返す値（既定 `null`） |

### 既定キーの組み立て

`key` 未指定時、フレームワークは：

`クラス名または displayName` + `-` + `メソッド名` + `-` + `JSON.stringify(引数)`

`Service` 継承でクラス名が `Service` 終わりなら、サフィックス除去の `displayName`（`ReportService` → `Report`）。引数は JSON に入る — **非シリアライズ・揺れる値**（`Date`、循環参照、毎回違うオブジェクトリテラル）を入れるとキーがずれキャッシュ無効。引数が多い・構造が乱れているなら自前 `key` が安定。

### 並行と空結果

同一キー並行時、最初が `setNX` でプレースホルダを置き元メソッド実行、プレースホルダ約 30 秒・実行中延長；他はポーリングでプレースホルダ消失を待ちキャッシュ読み（または `defaultValue`）。キャッシュ stampede 防止用であり、分散ロックの業務意味ではない — 汎用ロックにしない。「今回の並行共有・長期キャッシュなし」は上記 `singleFlight`。

元メソッドが `null` のとき **`null` はキャッシュに書かない**（「無い」を長く固定しない）；呼び出し側は `defaultValue`。「明確に無い」結果をキャッシュしたいなら自前キー設計か手動 `cache.set`。

### 複数キャッシュ

ローカル memory と共有 Redis など：各 `new Caching(adapter)` ごとに `createRemember`。スコープは**インスタンス**単位、`fork()` なし。メソッドに載せた `remember` がどのストアかが決まる。

::: warning
**読み多・書き少・短い TTL でよい照会**だけに載せる。DB 書き込み・SMS・在庫引きなど副作用ありは載せない — キャッシュは古い結果。データ変更後は `cache.delete` かキーバージョン変更（上記「キーの組み立て」）。
:::

## 次のステップ

- サービス登録とライフサイクル：[サービス層](/ja/core/service)
- OAuth `state` と `store`：[OAuth2 クライアント](/ja/plugins/oauth2-client)
- 悪用カウントの `store`：[悪用対策](/ja/plugins/abuse)
- 認証での session：[統一 Auth](/ja/plugins/auth)
- Bearer と token 戦略：[Bearer 戦略](/ja/plugins/auth-bearer-strategy)