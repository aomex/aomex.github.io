---
outline: deep
---

# コマンドルーティング

Console では HTTP の method + path ではなく「動詞フレーズ」形式のコマンド（例：`cache:warm`）を定義します。複数コマンドは同一の Commander と prefix を共有できます。Web の Router + `routers()` と対称な構成です。

```typescript
import { logger } from '@/services/logger.service';

import { Commander, commanders, ConsoleApp, options } from '@aomex/console';
import { rule } from '@aomex/common';

export const commander = new Commander({
  prefix: 'cache:', // [!code highlight]
});

commander.create('warm', {
  docs: { summary: '预热缓存' },
  mount: [
    options({
      key: rule.string().optional(),
    }),
  ],
  action: async (ctx) => {
    logger.info(`warming ${ctx.options.key ?? 'all'}`);
  },
});

commander.create(['flush', 'clear'], {
  action: async (ctx) => {
    logger.info('cache cleared');
  },
});

// ConsoleApp.mount
commanders('./src/commanders');
// または commanders([commander])
```

```bash
aomex cache:warm --key users
aomex cache:clear
```

`options({ ... })` を載せると、`ctx.options` の形はフィールド表と一致します（Web の query/body と同じ rule 体系）。`create` 内 action の戻り値はプロセス終了の意味に関わります。非同期エラーはフレームワーク規約どおり失敗終了コードに浮上します。

`create` 署名の要点：

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```

コマンド名はコンストラクタの `prefix` と連結されます。`disabled: true` のときは登録されません（環境で機能を切り、ロールバックしやすい）。

## prefix

`prefix` はコマンド名の接頭辞です。`new Commander({ prefix: 'cache:' })` のあと `create('warm')` は対外的に `aomex cache:warm`。領域ごと（`cache:`、`user:`）に分けるとファイル跨ぎの衝突が減り、`--help` で関連コマンドが一目で分かります。

どのコマンドにもマッチしないとき、アプリは通常**非ゼロ終了コード**でヘルプを出力します — CI では stdout だけでなく終了コードをアサートしてください。`ConsoleApp.mount` に `commanders(...)` を忘れると、ファイルに書いても CLI に出ません。

## commanders 登録

| 整理の仕方 | 説明 |
| --- | --- |
| `commanders('./dir')` | ディレクトリがレジストリ、import 維持が少ない |
| `commanders([a, b])` | テストやサブセットだけ載せる |
| ドメインごと 1 ファイル | `cache.commander.ts`、`user.commander.ts` |
| Cron と共用 | 定期実行と手実行を同ファイル・同 `action`；Cron の `args` も同じ `options()` を通す。[Cron](/ja/plugins/cron) |
| OpenAPI 落盘 | `openapi()` と `commanders()` を Console の `mount` に並べる。[OpenAPI の生成](/ja/openapi/) |

## docs と disabled

docs は `--help` の要約に入ります。`options` の docs と補完関係。旧スクリプト名と新ドキュメント名を併存させるときは commandName 配列（flush / clear）。

機能フラグ：

```typescript
commander.create('sync', {
  disabled: process.env['FEATURE_SYNC'] !== '1', // [!code highlight]
  action: async (ctx) => {
    await runSync();
  },
});
```

## 次のステップ

- 引数検証：[入力パラメータ](/ja/console/options)
- スケジュール：[Cron](/ja/plugins/cron)
- エントリと終了コード：[Console アプリケーション](/ja/console/)