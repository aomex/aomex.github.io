# キャッシュ

**CacheService** を用意する。memory / file / Redis アダプタを選び、`this.cache` で読み書きする。ログイン **session**（token → ユーザー情報）で「発行・認証読み取り・ログアウト削除」の一連を通す。

サブクラスは `createAdapter()` を実装する。業務プレフィックスは `protected readonly` と `this.key(...)` で `CacheKey` にまとめ、メソッド内では `.key(token)` を連鎖して文字列を散らさない。

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.key('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.loginTokenKey.key(token),
      session,
      '7 days',
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.loginTokenKey.key(token));
  }
}
```

`get` / `set` / `delete` などは **文字列または `CacheKey`** を受け付ける。`get<T>(key)` にジェネリックを付けると戻り値の型は `T | null`。`set` / `setNX` / `expire` の有効期限、および `@remember` の `duration` は **`DurationInput`**：ミリ秒または `'7 days'`、`'30m'`、`'1.5 hours'` のような文字列（下記参照）。`services.cache.xxx` のメソッド名・引数は CacheService で宣言したものと一致する。署名を変えるとコンパイラがルートや認証コールバックまで追ってくれる。

登録とウォームアップ（本番で Redis に替えるときは特に eager を推奨）：

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
本番や複数インスタンスで cache に eager を書かないと、最初のキャッシュ読みで Redis 接続コストが乗り、テールレイテンシが跳ねやすい。
:::

## session の読み書き

ログインで token を発行したあと、「token → ユーザー情報」をキャッシュに書き込む。認証の onLoaded で読み戻し、ログアウトで delete する。キー名はバージョン付きの `CacheKey` プレフィックスを使う。リリースでセッション構造を変えるとき、1 箇所変えれば一括無効化できる。

業務側（ログイン / 認証 / ログアウト）：

```typescript
// 登录成功后写入
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.cache.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// 鉴权 onLoaded 里读取
const session = await services.cache.getLoginToken(token);
if (!session) {
  return false;
}

// 退出登录删掉
await services.cache.deleteLoginToken(token);
```

token 発行や DB 照会は User / Auth などの Service に残す。CacheService は格納・取得だけ担う。

## アダプタの選択

アダプタがデータの置き場所を決める。**memory** は依存ゼロ・プロセス内・再起動で消える。ローカルと単体テスト向け。**Redis** は複数インスタンスで session やレート制限カウントを共有する。少しディスク永続化が要るなら **file**。業務コードは多くの場合 `createAdapter()` だけ変え、読み書き API はそのまま。

ローカル開発・単体テストは `@aomex/cache/memory`。依存なし、再起動でデータ消失：

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

本番や複数インスタンスで session / レート制限を共有するときは `@aomex/cache-redis-adapter`（`ioredis` はパッケージに同梱。多くは `createAdapter` だけ変える）：

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

単機で少し永続化したいなら `@aomex/cache/file` を選べる。

## キーの組み立て：CacheKey

`this.key(...)` が返すのは **`CacheKey`** であり、通常の文字列ではない。断片は `:` で連結でき、`.key` / `.keyHash` / `.toHash()` を続けられる。`this.cache.get` / `set` などはそのまま受け取れる。`String(...)` は不要。

```typescript
this.key('user', 1); // user:1
this.key('user').key(1); // 同上
this.key('user').keyHash(1); // user:<md5('1')>，前缀可读
this.key('user', 1).toHash(); // <md5('user:1')>
this.keyHash('user', 1); // 同上，整键哈希
```

| 書き方 | 得られるもの |
| --- | --- |
| `this.key('a', 1)` | 読めるキー `a:1` |
| `prefix.key(id)` | 既存の `CacheKey` プレフィックスの後に一段追加 |
| `this.key('a').keyHash(id)` | プレフィックスはそのまま、**今回の引数だけハッシュ** |
| `this.key(...).toHash()` / `this.keyHash(...)` | **全体** MD5、読めるプレフィックスなし |

断片が長い・変な文字を含む・Redis に平文を出したくないときはハッシュを使う。日常の業務キーは読めるプレフィックスの方が調査しやすい。旧来の単体 `hash()` は廃止され、上記に統一している。

### プレフィックスとバージョン

`protected readonly` フィールドで業務プレフィックス（例：`login-token`）をまとめ、メソッド内では `.key(token)` / `.key(id)` を連鎖する。各所にマジック文字列を書かない。プレフィックスにバージョン（`v1` → `v2`）を入れると、**名前を衝突させずに**旧 session を捨てられる：

```typescript
protected readonly loginTokenKey = this.key('login-token', 'v2');
```

## 期間 DurationInput

有効期限に `60_000` を直書きしなくてよい。`set` / `setNX` / `expire`、および `@remember` の `duration` は次を受け付ける：

- **number**：ミリ秒（従来どおり）
- **文字列**：数字 + 単位、スペース任意——`'30m'`、`'1 hour'`、`'7 days'`

よく使う単位：`ms` / `s`（`sec` / `second`）/ `m`（`min` / `minute`）/ `h`（`hr` / `hour`）/ `d`（`day`）/ `w`（`week`）/ `month` / `y`（`year`）。`month` は 30 日、`year` は 365 日。ほかの場所で読める時間をミリ秒にするなら `import { parseDuration } from '@aomex/common'` も使える。

```typescript
await this.cache.set(key, session, '7 days');
await this.cache.setNX(lockKey, '1', '30 seconds');
await this.cache.expire(key, '1 hour');
```

## exists：あるかどうかだけ

キーが**あるかどうか**だけ知りたく、値を読み出してデコードする必要がないときは `exists` を使う。戻り値は `boolean` で、文字列または `CacheKey` を受け付ける。

```typescript
const key = this.loginTokenKey.key(token);
if (await this.cache.exists(key)) {
  // セッション存続中。詳細を get するか決める
}
```

`get` との違い：未ヒット時の `get` は `null`（自分で判定する）であり、値を逆シリアライズする。`exists` はアダプタに「このキーはまだあるか」とだけ聞く。プレースホルダマーク、ロックをまだ握っているか、大きなオブジェクトを取る前の事前確認向け。

::: tip
「先に exists してから get」の間に他プロセスがキーを消したり書き換えたりする可能性がある。厳密なトランザクション条件にしないこと。ロック奪取・べき等は下の `setNX` を使う。
:::

## setNX とカウンタ

`setNX` はキーがないときだけ書き込む。分散ロックや冪等な「一度だけ処理」に使う。TTL はタスクの最悪時間をカバーすること。足りないとロック期限後に別 worker が奪う。`increment` / `expire` は認証コード失敗回数や固定ウィンドウ向け。

ロック取得・冪等（TTL はタスク最悪時間より大きく）：

```typescript
const ok = await this.cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

認証コード失敗回数：先に `increment`、初回（またはまだ TTL がない）に `expire` でウィンドウを張る——Redis の `INCR` と同じ習慣。memory アダプタの増減は**既存 TTL を残し**、数字を変えても期限を消さない。

```typescript
const key = this.key('otp-fail', phone);
const n = await this.cache.increment(key);
if (n === 1 || (await this.cache.ttl(key)) === -1) {
  await this.cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## キャッシュデコレータ

業務メソッドで「get → なければ計算 → set」を繰り返すのは冗長で、同一キーへの同時リクエストで何度も計算が走る。`createRemember` はメソッドデコレータ `@remember` を作る。ヒットなら即返す。ミスなら元メソッドだけ実行して書き込む。**同一キーが同時に来ても実行は一つ**、他は結果を待つ。

デコレータは自分のキャッシュサービスクラスに結ぶ。`BaseCacheService` の **サブクラスコンストラクタ** を渡す（基底クラスやインスタンスは不可）。`cache.service.ts` に書くのが手軽で、業務側は `remember` を import する：

```typescript
import { BaseCacheService, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService {
  protected createAdapter() {
    return new CacheMemoryAdapter();
  }
}

export const remember = createRemember(CacheService); // [!code highlight]
```

`BaseCacheService` は `onInit` でアダプタ接続後に remember を自動で付け、シャットダウンで外す。**手動登録は不要**。`combineServices` では引き続き `eager: ['cache']` を推奨。キャッシュ未準備だとデコレートされたメソッドは**待つ**。停止後の呼び出しは**例外**。

### 業務メソッドへ適用

メソッドは **async**（Promise を返す）であること。期間だけ渡すと「キャッシュ保持時間」（`DurationInput`）の意味：

```typescript
import { Service } from '@aomex/common';
import { remember } from './cache.service.js';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

キーやデフォルト値を変えたいときはオブジェクトを渡す。このとき `await services.report.find(1)` の初回は DB へ行き、ウィンドウ内の同引数の再呼び出しはキャッシュを読む。`duration` は書き込み後の有効期限：

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
| `@remember('1 minute')` / `@remember(60_000)` | 有効期限のみ。キーはデフォルト規則 |
| `duration` | 必須（オブジェクト形式）。キャッシュ期間 |
| `key: '固定文字列'` | メソッド全体で一キー（引数なし・サイト単一結果） |
| `key: (...args) => string` | 引数からキー組み立て。`this` は業務インスタンスのまま |
| `defaultValue` | 元メソッドが `null` のとき呼び出し側に返す値（デフォルト `null`） |

### デフォルトのキー組み立て

`key` を書かないとき、フレームワークは次を使う：

`クラス名または displayName` + `-` + `メソッド名` + `-` + `JSON.stringify(引数)`

`Service` を継承しクラス名が `Service` で終わるときは、末尾を除いた `displayName`（`ReportService` → `Report`）でキーに長い接尾辞を載せない。引数は JSON に入る。**直列化できない・揺れる値**（`Date`、循環参照、毎回違うオブジェクトリテラル）を入れるとキーが合わず実質キャッシュ無効。引数が多い・構造が乱雑なら自分で `key` を書く方が安全。

### 並行と空結果

同一キーが同時に来ると、最初の呼び出しが `setNX` でプレースホルダを取って元メソッドを実行する。プレースホルダは約 20 秒、実行中は更新される。他はプレースホルダが消えるまでポーリングし、キャッシュを読む（または `defaultValue`）。キャッシュスタンピード防止用であり、汎用分散ロックではない——業務ロック代わりに使わない。

元メソッドが `null` を返したとき **`null` は書き込まない**（「ない」を長く固定しない）。呼び出し側は `defaultValue` を見る。「明示的にない」結果をキャッシュしたいときはキー設計を変えるか、手書きの `this.cache.set` を使う。

### 複数キャッシュ

ローカル memory と共有 Redis を併用するとき、それぞれ `BaseCacheService` サブクラスを用意し、それぞれ `createRemember` を呼ぶ。スコープは**サービスクラス**単位。`fork()` はない。どの `remember` を付けるかでストアが決まる。

::: warning
**読み多・書き少・短時間の鮮度でよい**クエリにだけ付ける。DB 書き込み・SMS・在庫減算など副作用のあるメソッドには付けない——キャッシュは古いまま。データが変わったら該当キーを `cache.delete` するか、キーのバージョンを上げる（上記のキー組み立てを参照）。
:::

## 次のステップ

- サービス登録と eager：[サービス層](/ja/core/service)
- 乱用カウントの `store`：[乱用対策](/ja/plugins/abuse)
- 認証での session の使い方：[Auth 統一入口](/ja/plugins/auth)
- Bearer と token 戦略：[Bearer 戦略](/ja/plugins/auth-bearer-strategy)