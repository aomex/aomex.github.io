---
outline: deep
---

# Console アプリケーションのエントリ

ターミナルで動くコマンドのエントリを作ります。Web と **同じ** services、logger、バリデータを共有しますが、舞台は `aomex <コマンド>` です。マイグレーション、キャッシュウォーム、OpenAPI 落盘、Cron に向きます — 走らせたら終了し、HTTP ポートを占有しません。

```bash
pnpm add @aomex/console @aomex/common @aomex/logger
```

```typescript
import { Commander, commanders, ConsoleApp } from '@aomex/console';
import { logger } from '@/services/logger.service';
import { services } from '@/services';

const commander = new Commander();
commander.create('hello', {
  action: async () => {
    logger.info('hello from console');
  },
});

const app = new ConsoleApp({ // [!code focus:6]
  services,
  logger, // [!code highlight]
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

業務コードでは上で import した `logger` をそのまま使います（`ctx.logger` と同一参照；`ctx.logger` はサードパーティ middleware と app 内 middleware 向け）。後から `options({ ... })` を足せば `ctx.options` は宣言どおりの形に収まります。`app.run()` の戻り値は**終了コード**（0 は成功）。フレームワークは `process.exit` しません — テストでアサートしやすいです。

::: warning
失敗時に黙って return して終了コード 0 のままにしないでください — CI は成功と見なします。throw するか、run が非ゼロコードを受け取るようにしてください。
:::

## run でサブコマンド指定

`app.run()` は 1 本のコマンドを解析・実行し、終了コードを返します。引数なしなら `process.argv` から読みます（ターミナルの `npx aomex cache:warm` と同じ）。テストやオーケストレーションスクリプトでは argv を変えずにコマンド名と引数を渡せます：

```typescript
await app.run();
await app.run('cache:warm');
await app.run('export', '--out', 'a.csv');
```

## language

CLI に **Accept-Language はありません**。`language` は文字列のみ（例：`zh-CN`、`en-US`）。効果は Web の fixed と同じ：`options()` 検証失敗とフレームワーク文言はこの 1 言語。Web 向け `{ mode, header }` オブジェクトは渡さないでください。

```typescript
import { logger } from '@/services/logger.service';

new ConsoleApp({
  services,
  logger,
  language: 'zh-CN', // [!code highlight]
  mount: [commanders('./src/commanders')],
});
```

言語コードはハイフン形式。`zh_CN` は使わない。Web でリクエストヘッダー交渉する場合は [Web アプリケーションエントリ · language](/ja/web/#language)。製品の词条は [高度：アプリケーションの i18n](/ja/advanced/i18n)。

## Web との対照

| | Web | Console |
| --- | --- | --- |
| マッチ | method + path | コマンド名 |
| 入力 | query / body / params | `options()` |
| 言語 | リクエストで交渉可 | 固定のみ |
| ライフサイクル | listen + シグナル shutdown | `run` 終了で終わり |

業務 service、mixin middleware は両方に載せられます。運用向けの作業は Console に寄せることが多いです。DB・外部 API は Web と同様 services/ に置き、HTTP と CLI で二重保守しないでください。

## 次のステップ

- [コマンドルーティング](/ja/console/commander)
- [入力パラメータ](/ja/console/options)
- [OpenAPI の生成](/ja/openapi/)
- [Cron](/ja/plugins/cron)