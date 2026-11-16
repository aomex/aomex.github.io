---
outline: deep
---

# コマンドルーティング

Console で HTTP の method + path ではなく「動詞フレーズ」コマンド（例 `cache:warm`）を定義する。複数コマンドが同一 Commander とプレフィックスを共有可能。Web の Router + `routers()` と構造が対称。

```typescript
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
    await ctx.logger.info(`warming ${ctx.options.key ?? 'all'}`);
  },
});

commander.create(['flush', 'clear'], {
  action: async (ctx) => {
    await ctx.logger.info('cache cleared');
  },
});

// ConsoleApp.mount
commanders('./src/commanders');
// 或 commanders([commander])
```

```bash
aomex cache:warm --key users
aomex cache:clear
```
`options({ ... })` をマウントすると `ctx.options` の形がフィールド表と一致（Web の query/body と同じ rule 系）。create 内 action の戻り値はプロセス終了コードの意味に関わる。非同期エラーはフレームワーク規則どおり失敗終了コードへ。

create シグネチャの要点：

```typescript
commander.create(commandName | string[], {
  disabled?: boolean;
  mount?: ConsoleMiddleware[];
  docs?: { summary?: string; description?: string };
  action: (ctx) => any;
});
```
コマンド名は構築時の `prefix` と連結。`disabled: true` では登録されない（環境で機能を切ってロールバックしやすい）。

## prefix

`prefix` はコマンド名の接頭辞：`new Commander({ prefix: 'cache:' })` のあと `create('warm')` は外部では `aomex cache:warm`。`cache:`、`user:` のようにドメイン分割するとファイル間の重名が減り、`--help` で関連コマンドが一目で分かる。

どのコマンドにもマッチしないと、多くの場合**非ゼロ終了**でヘルプを出す——CI では stdout だけでなく終了コードで断言すること。`ConsoleApp.mount` に `commanders(...)` を忘れると、ファイルに書いても CLI に出ない。

## commanders 登録

| 整理の仕方 | 説明 |
| --- | --- |
| `commanders('./dir')` | ディレクトリがレジストリ。import 列を手入れしなくてよい |
| `commanders([a, b])` | テストやサブセットだけマウント |
| ドメインごと1ファイル | `cache.commander.ts`、`user.commander.ts` |
| Cron と共有 | 定時と手動が同じファイル・同じ `action`；Cron の `args` も同じ `options()`。[Cron](/ja/plugins/cron) |
| OpenAPI 書き出し | `openapi()` と `commanders()` を Console `mount` に。[OpenAPI 書き出し](/ja/console/openapi) |

## docs と disabled

`docs` は `--help` 要約。`options` の `docs` と補完。旧スクリプト名と新ドキュメント名が並ぶとき `commandName` 配列（flush / clear）。

機能スイッチ：

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
- 定時実行：[Cron](/ja/plugins/cron)
- 入口と終了コード：[Console アプリケーション](/ja/console/)
