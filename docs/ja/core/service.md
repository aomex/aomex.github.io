# サービス層

「DB 照会・外部 API・キャッシュ読み書き」をルート action から切り出し、再利用可能な **Service** にまとめます。**combineServices** で型付き `services` 袋を組み、Web・Console・Cron で同じ名前で呼びます。

業務クラスは `Service` を継承し、外向きは通常の async メソッドだけ。接続・ウォームアップは `onInit`、解放は `onDestroy`（protected のまま、外から直接呼ばない）。

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // 接続ウォームアップ、設定読み込み…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

ファクトリ + `combineServices` で登録。**プロセス起動と同時に繋ぎたいサービス**は eager に（Prisma / 外部 SDK など）：

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('@/services/user.service'),
  },
  { eager: ['user'] },
);
```

Web に渡すと、`services` の型は combineServices のキー名と各 Service の**公開メソッド**から直接決まります：`await services.user.findById(1)` は引数・戻り値が補完されます。`onInit`、`onDestroy`、private フィールドは **services.user に出ません**。同期メソッドでも外から呼ぶ型上は **Promise** として統一し、`await` で書きます。

```typescript
import { WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services, // [!code highlight]
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

::: tip
業務内で `new UserService()` だけして WebApp / ConsoleApp の `services` に渡さないと、シャットダウン時にフレームワークが追えず接続漏れの原因になります。
:::

ルートやミドルウェア内：

```typescript
import { logger } from '@/services/logger.service';

const user = await services.user.findById(1);
logger.info(`用户已查询 ${user?.name ?? ''}`);
```

別ファイルでは `import { services } from '@/services'` で十分。モジュール拡張は不要です。

## 遅延読み込みとテスト注入

本番は `() => import('@/services/xxx.service')` で遅延し、コールドスタートを速くします：

```typescript
user: () => import('@/services/user.service'),
```

テストでは async ファクトリで偽実装を返せます：

```typescript
user: async () => FakeUserService,
```

::: warning
本番で `async () => UserService` と書かないでください。クラスは既にモジュールと一緒にメモリに入り、遅延の意味がなく、無駄にメモリを食います。本番は必ず `() => import('@/services/user.service')`；上記はテスト注入専用です。
:::

各ファイルは `export default class XxxService` が一番楽で、loader が複数 export を推測しません。

## eager

既定は**遅延読み込み**：最初の `await services.xxx` でインスタンス化・`onInit`。`eager` に列挙した名前は `combineServices` 返却前に構築 — 「プロセス起動と同時に接続」向け（Prisma など）。

```typescript
{ eager: ['user', 'prisma'] },
```

ローカル試行や最小 CLI は eager なしでも可。A の `onInit` 内で `await services.user.xxx` するのに user が eager でないと、初期化は初回業務呼び出しまで遅れ、起動フェーズで順序バグになりやすいです。

## ライフサイクルフック

`services` 袋に入らないリソース（モジュール级 PrismaClient、プラグイン内 Redis store など）でも、起動時接続・停止時切断が要るときは `registerLifecycle`：登録と同時に `onInit`、WebApp / ConsoleApp シャットダウンで `onDestroy`。

遅延接続（アダプタ、自前クライアント）では「ラッチ + 失敗時クリア」がよくある — 次回再試行しやすく。**自動リトライはしません**：

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let ready: Promise<void> | undefined;

function ensureReady() {
  ready ??= registerLifecycle({ // [!code focus:7]
    onInit: () => prisma.$connect(),
    onDestroy: () => prisma.$disconnect(),
  }).catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}
```

一度きりの接続（起動スクリプト、モジュールトップレベル）では `await registerLifecycle({ … })` でも可。返却関数で**登録を早めに解除**（停止済み・解除後は無効）。`onInit` 失敗時は破棄キューに入りません。レート制限などプラグイン内部も同じフックを使い、業務側で二重登録は通常不要です。

`combineServices` に入れたクラスは `onInit` / `onDestroy` のままでよく、`registerLifecycle` を重ねる必要はありません。

## 複数袋のマージ

大規模リポジトリでドメインごとに combineServices を分け、App にマージ：

```typescript
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

クラス名が `Service` 終わりのとき、[`createRemember`](/ja/core/cache#キャッシュデコレータ) などはサフィックス除去後の名前でキャッシュキーを区別します（UserService → User）。

サービス間呼び出し：クラス内で `import { services } from '@/services'` し `await services.other.method()`。クラス内 `this.foo()` はそのまま；**クラス跨ぎ**だけ `await services.other.foo()`。

## 次のステップ

- 共有 `Caching`、`createRemember`：[キャッシュ](/ja/core/cache)
- 全站 `Logger`：[ログ](/ja/core/logger)
- ルートを薄く：[ルーティング](/ja/web/router)