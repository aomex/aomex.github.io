# キャッシュ

**CacheService** を作る：memory / file / Redis アダプタを選び、`this.cache` で読み書き。ログイン **session**（token → ユーザー情報）で「発行・認証読み取り・ログアウト削除」の一連を通す。

サブクラスは `createAdapter()` を実装。業務キーは `protected readonly` + `this.concat` で一元管理し、文字列を散らばらせない。

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.concat('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.concat(this.loginTokenKey, token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.concat(this.loginTokenKey, token),
      session,
      this.ttl.DAY * 7,
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.concat(this.loginTokenKey, token));
  }
}
```
`get<T>(key)` にジェネリックを付けると戻り値の型は `T | null`。`set` の第三引数は有効期限**ミリ秒**。`this.ttl.DAY`、`this.ttl.MINUTE` でマジックナンバーを減らす。`services.cache.xxx` のメソッド名・引数は CacheService で宣言したものと一致。署名変更時コンパイラがルートと認証コールバックまで追ってくれる。

登録とウォームアップ（本番で Redis に替えるとき特に eager を推奨）：

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

ログインで token 発行後、「token → ユーザー情報」をキャッシュへ。認証 onLoaded で読み戻し。ログアウトで delete。キー名は `this.concat` でバージョン接頭辞。リリースでセッション構造を変えるとき1箇所変えれば一括無効化。

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
token 発行・DB 照会は User / Auth などの Service に残す。CacheService は格納・取得だけ。

## memory と Redis

アダプタがデータの居場所を決める：**memory** は依存ゼロ・プロセス内・再起動で消える。ローカルと単体テスト向け。**Redis** は複数インスタンスで session・レート制限カウントを共有。少しディスク永続化なら **file**。業務コードは多くの場合 `createAdapter()` だけ変え、読み書き API は同じ。

ローカル開発・単体テストは `@aomex/cache/memory`、依存なし、再起動で消失：

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```
本番や session / レート制限を複数で共有するなら `@aomex/cache-redis-adapter`。多くは `createAdapter` だけ変更：

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```
単機で少し永続化なら `@aomex/cache/file`。

## キー命名とバージョン

`protected readonly` フィールドで業務接頭辞（例 `login-token`）を集約。`this.concat` で token や id を連結。メソッド内にマジック文字列を散らさない。接頭辞にバージョン（`v1` → `v2`）を入れると**名前を変えずに**旧 session を捨てられる。リリースでペイロードを変えるときによく使う。

v1 → v2 はキー全体が無効化。session 載せ替えリリースで定番：

```typescript
protected readonly loginTokenKey = this.concat('login-token', 'v2');
```
各メソッドにバージョン文字列を散らさない。クラスの readonly 接頭辞 + `this.concat`。

## setNX とカウント

`setNX` はキーが無いときだけ書き込み。分散ロック、冪等「一度だけ処理」に。TTL はタスク最悪時間を超えること。さもないとロック切れ後に別 worker が取る。`increment` / `expire` は CAPTCHA 失敗回数やスライディングウィンドウ向け。

ロック取得・冪等（TTL は最悪処理時間より長く）：

```typescript
const ok = await this.cache.setNX(lockKey, '1', 30_000);
if (ok) {
  await this.cache.expire(lockKey, 30_000);
}
```
CAPTCHA 失敗回数などは increment / expire。

## メソッドデコレータ @remember

読み多く書き少ない、短時間キャッシュできるクエリで、毎回 get → miss → set を手書きしたくないとき、**業務 Service** メソッドに `@remember`。CacheService.onInit で `remember.setInstance(this)`、`eager: ['cache']` をセット。停止時 `deleteInstance`。

```typescript
protected override async onInit() {
  await super.onInit();
  remember.setInstance(this); // [!code highlight]
}

protected override async onDestroy() {
  remember.deleteInstance(); // [!code highlight]
  await super.onDestroy();
}
```

```typescript
class ReportService extends Service {
  @remember(60_000)
  async build(id: number) {
    return heavyCompute(id);
  }

  @remember({ // [!code highlight]
    duration: 60_000,
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
::: warning
副作用のある書き込みには付けない。無効化は自分で delete かキーバージョン変更。`@remember` を更新メソッドに付けると古い結果が残る。無効化設計は自分で。
:::

## 次のステップ

- サービス登録と eager：[サービス層](/ja/core/service)
- session を認証で使う：[統一認証 Auth](/ja/plugins/auth)
- Bearer と token ストラテジ：[Bearer ストラテジ](/ja/plugins/auth-bearer-strategy)
