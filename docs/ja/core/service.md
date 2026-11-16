# サービス層

「DB 照会、外部 API、キャッシュ読み書き」をルート action から分離し、再利用可能な **Service** にまとめる。**combineServices** で型付き `services` 袋を組み、Web、Console、Cron で同じ名前で呼ぶ。

業務クラスは Service を継承。外向きは通常の async メソッドだけ。接続・ウォームアップは onInit、解放は onDestroy（protected のまま、外から直接呼ばせない）。

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // 预热连接、读配置…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```
ファクトリ + combineServices で登録。**インフラは eager に入れる**と起動直後に接続し、最初の本番リクエストまで初期化を遅らせない：

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('./user.service.js'),
    cache: () => import('./cache.service.js'),
    logger: () => import('./logger.service.js'),
  },
  { eager: ['cache', 'logger'] },
);
```
Web に渡すと、`services` の型は combineServices のキーと各 Service の**公開メソッド**から直接得られる：`await services.user.findById(1)` に引数・戻り値補完。onInit、onDestroy、private は `services.user` に出ない。同期メソッドでも外からの型は **Promise** 扱い。統一して await。

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```
::: tip
業務コードで `new UserService()` だけして WebApp / ConsoleApp の services に渡さないと、停止時にフレームワークが管理できず接続漏れの原因になる。
:::

ルートやミドルウェア内：

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```
別ファイルから `import { services } from './services/index.js'` でき、モジュール拡張は不要。

## 遅延読み込みとテスト注入

本番は `() => import('./xxx.service.js')` で遅延、コールドスタート改善：

```typescript
user: () => import('./user.service.js'),
```
テストでは async ファクトリで偽実装を直接返す：

```typescript
user: async () => FakeUserService,
```
::: warning
業務コードを `async () => UserService` にしない。クラスは既にモジュールに載っているので遅延の意味がなくメモリも無駄。本番は必ず `() => import('./user.service.js')`。上記パターンはテスト注入専用。
:::

各ファイル `export default class XxxService` がいちばん楽。ローダーが複数 export を推測しなくてよい。

## eager

デフォルトは**遅延**：最初の `await services.xxx` で初めてインスタンス化・onInit。`eager` に列挙した名前は `combineServices` 返却前に構築——Redis、ログなど「プロセス起動と同時に準備完了」向け。

```typescript
{ eager: ['cache', 'logger'] },
```
ローカル試行や最小 CLI は eager なしでもよい。A の onInit 内で `await services.cache.xxx` するのに cache が eager でないと、接続は初回業務呼び出しまで遅れ、起動フェーズで競合しやすい。

## 複数袋のマージ

大規模リポはドメインごと combineServices を分け、App にマージ：

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```
クラス名が Service 終わりなら、[@remember](/ja/core/cache#メソッドデコレータ-remember) などはサフィックス除去名でキャッシュキーを区別（UserService → User）。

サービス間呼び出し：クラス内で `import { services } from './index.js'`、`await services.other.method()`。クラス内 `this.foo()` はそのまま。**クラス跨ぎ**だけ `await services.other.foo()`。

## 次のステップ

- セッションと Redis：[キャッシュ](/ja/core/cache)
- サイト全体ログ出口：[ログ](/ja/core/logger)
- ルートを薄く：[インターフェースルーティング](/ja/web/router)
