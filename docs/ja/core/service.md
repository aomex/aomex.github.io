# サービス層

「DB 照会、外部 API、キャッシュ読み書き」をルート action から分離し、再利用可能な **Service** にまとめる。**combineServices** で型付き `services` 袋を組み、Web、Console、Cron で同じ名前で呼ぶ。

業務クラスは Service を継承する。外向きは通常の async メソッドだけ。接続・ウォームアップは onInit、解放は onDestroy（protected のまま、外から直接呼ばせない）。

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

ファクトリ + `combineServices` で登録。**インフラは eager に入れる**と、アプリ起動直後に接続し、最初の本番リクエストまで初期化を遅らせない：

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

Web に渡すと、`services` の型は combineServices のキーと各 Service の**公開メソッド**から直接得られる。`await services.user.findById(1)` に引数・戻り値の補完がある。onInit、onDestroy、private フィールドは `services.user` に出ない。同期で書いた Service メソッドも、外からの型は **Promise** 扱い。呼び出しは `await` で統一すればよい。

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
業務コードで `new UserService()` だけして WebApp / ConsoleApp の `services` に渡さないと、停止時にフレームワークが管理できず、接続漏れの原因になる。
:::

ルートやミドルウェア内：

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```

別ファイルから `import { services } from './services/index.js'` でき、モジュール拡張は不要。

## 遅延読み込みとテスト注入

本番は `() => import('./xxx.service.js')` で遅延読み込みし、コールドスタートを速くする：

```typescript
user: () => import('./user.service.js'),
```

テストでは async ファクトリで偽実装を直接返せる：

```typescript
user: async () => FakeUserService,
```

::: warning
業務コードを `async () => UserService` にしない。クラスは既に当該モジュールに載っているので遅延の意味がなく、無駄にランタイムメモリを占める。本番は必ず `() => import('./user.service.js')`。上記パターンはテスト注入専用。
:::

各ファイルを `export default class XxxService` にすると、ローダーが複数 export を推測しなくて済む。

## eager

デフォルトは**遅延読み込み**。最初の `await services.xxx` で初めてインスタンス化し `onInit` が走る。`eager` に列挙した名前は `combineServices` が返る**前**に構築される。Redis やログなど「プロセス起動と同時に準備完了」させたいインフラ向け。

```typescript
{ eager: ['cache', 'logger'] },
```

ローカル試行や最小 CLI では eager を書かなくてもよい。A の `onInit` 内で `await services.cache.xxx` するのに cache が eager でないと、接続は初回の業務呼び出しまで遅れ、起動フェーズで時系列の罠に入りやすい。

## ライフサイクルフック

Service にしなくても `services` 袋に入れないリソース（モジュールスコープの PrismaClient、プラグイン内部の Redis store など）が、起動時に接続し、停止時に切断が要ることがある。そのときは `registerLifecycle` を使う。登録時にすぐ `onInit` が走り、`WebApp` / `ConsoleApp` 停止時に `onDestroy` が走る。

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await registerLifecycle({ // [!code focus:4]
  onInit: () => prisma.$connect(),
  onDestroy: () => prisma.$disconnect(),
});
```

返り値の関数で**登録を先取り解除**できる（既に停止・解除済みなら何もしない）。`onInit` が失敗すると破棄キューには入らない。レート制限などプラグイン内部も同じフックで store を管理する。業務側で改めて登録する必要は通常ない。

`combineServices` に入れたクラスは引き続き `onInit` / `onDestroy` で足りる。`registerLifecycle` で二重に包む必要はない。

## 複数袋のマージ

大規模リポジトリではドメインごとに combineServices を分け、App にマージする：

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

クラス名が `Service` 終わりのとき、[`createRemember`](/ja/core/cache#キャッシュデコレータ) などはサフィックスを除いた名前でキャッシュキーを区別する（UserService → User）。

サービス間呼び出しは、クラス内で `import { services } from './index.js'` し、`await services.other.method()` する。クラス内の `this.foo()` はそのまま。**クラスを跨ぐ**ときだけ `await services.other.foo()` を使う。

## 次のステップ

- セッションと `createRemember`：[キャッシュ](/ja/core/cache)
- サイト全体のログ出口：[ログ](/ja/core/logger)
- ルートを薄く保つ：[インターフェースルーティング](/ja/web/router)