---
outline: deep
---

# Console アプリケーション入口

ターミナルで動くコマンド入口を作る：Web と **共有**する services / バリデータだが、舞台は `aomex <command>`。マイグレーション、キャッシュウォーム、OpenAPI 書き出し、Cron——実行したら終了し、HTTP ポートを占有しない。

```bash
pnpm add @aomex/console @aomex/common @aomex/logger
```

```typescript
import { combineServices } from '@aomex/common';
import { Commander, commanders, ConsoleApp } from '@aomex/console';

const services = await combineServices(
  {
    logger: () => import('./services/logger.service.js'),
  },
  { eager: ['logger'] },
);

const commander = new Commander();
commander.create('hello', {
  action: async (ctx) => {
    await ctx.logger.info('hello from console');
  },
});

const app = new ConsoleApp({ // [!code focus:6]
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [commanders([commander])], // [!code highlight]
});

const code = await app.run();
process.exit(code);

declare module '@aomex/console' {
  namespace ConsoleApp {
    type T = ConsoleApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

```bash
npx aomex hello
```
`ctx.logger` に補完がある（Web と同様、マウントしたサービス / ミドルウェア由来）。あとで `options({ ... })` を足すと `ctx.options` が宣言どおりの形になる。`app.run()` の戻りは**終了コード**（0 が成功）。フレームワークは `process.exit` しない——テストで断言しやすい。

::: warning
失敗時に黙って return して終了コード 0 のままにしない——CI は成功とみなす。エラーを投げるか `run` に非ゼロを返す。
:::

## run でサブコマンド指定

`app.run()` は1本のコマンドを解析・実行し終了コードを返す。引数なしは `process.argv`（ターミナルの `npx aomex cache:warm` と同じ）。テストやオーケストレーションではコマンド名と引数を直接渡せ、argv を変えなくてよい：

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```
## language

CLI には **Accept-Language がない**。`language` は文字列のみ（例 `zh-CN`、`en-US`）。Web の `fixed` と同じ効果：`options()` 失敗やフレームワークメッセージはその1言語。Web の `{ mode, header }` オブジェクトは渡さない。

```typescript
new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```
言語コードはハイフン。`zh_CN` は使わない。Web でリクエストヘッダ協議するなら [Web アプリケーション入口 · language](/ja/web/#language)。製品の文言は [上級：ビジネス i18n](/ja/advanced/i18n)。

## Web との対照

| | Web | Console |
| --- | --- | --- |
| マッチ | method + path | コマンド名 |
| 入力 | query / body / params | `options()` |
| 言語 | リクエストで協議可 | 固定のみ |
| ライフサイクル | listen + シグナルで停止 | `run` 終了で完了 |

業務 service、mixin ミドルウェアは両方にマウント可。運用向け作業は Console に置くのが一般的。DB・外部 API は Web と同様 `services/` へ。HTTP と CLI で二重管理しない。

## 次のステップ

- [コマンドルーティング](/ja/console/commander)
- [入力パラメータ](/ja/console/options)
- [OpenAPI 書き出し](/ja/console/openapi)
- [Cron](/ja/plugins/cron)
