---
outline: deep
---

# ファイルアップロード

アバターや添付付き multipart インターフェース：`body()` でファイルフィールドを [rule.file()](/ja/validators/rules/file) にし、通過後 ctx.body から一時パスと MD5 を取得し、リクエスト終了前に移動（OSS・ローカル等）。body() なしの multipart はファイルを解析しない。

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      name: rule.string(),
      avatar: rule.file(),
    }),
  ],
  action: async (ctx) => {
    const { name, avatar } = ctx.body;
    await saveAvatarToOss(avatar.filepath, avatar.hash);
    ctx.send(201, { name, hash: avatar.hash });
  },
});
```

クライアントは multipart/form-data：name は通常フィールド、avatar はファイル part。action 内ですぐアップロード／コピーして返すのが一般的——応答後に一時ファイルは削除。

avatar 検証通過後はだいたい filepath、size、mimetype、hash、hashAlgorithm、originalFilename。業務では filepath と hash が多用。`rule.array(rule.file())` なら ctx.body.attachments はファイルオブジェクト配列。

::: warning
201 を返す前にファイルを移していない／アップロード未完了だと、一時パスは次に読めない保証がない。
:::

## サイズと MIME

単フィールド `rule.file().maxSize()` / `.mimeTypes()` は**検証段階**で oversized や型不一致を止め、action 後判定より IO を省く。アプリ級 `formData` と併用時は厳しい方。ルートだけ変えたら 413 は両層を見る。

```typescript
body({
  avatar: rule.file().maxSize('2mb'),
});
```

```typescript
body({
  avatar: rule.file().mimeTypes('.png', 'image/*'),
});
```

`rule.file().maxSize('2mb')` はそのフィールドのみ。アプリ級 formData.maxFileSize と併用時は**厳しい方に従う**。

魔数が不安定なら MIME にフォールバック：

```typescript
rule.file().mimeTypes('image/svg+xml').fallbackToMimetype(),
```

::: warning
公開アバターで安易に fallbackToMimetype() しない——クライアントの Content-Type をより信じる。内網など制御可能な場面向け。
:::

## 同一フィールド複数ファイル

HTML フォームで同名 input が複数 part を送れる。`rule.array(rule.file())` で配列化。`.length({ max: n })` で1リクエスト個数上限。

```typescript
body({
  attachments: rule.array(rule.file().maxSize('10mb')).length({ max: 5 }),
});
```

同一リクエストで複数ファイルフィールドがある場合、総数はアプリ級 formData.maxFiles ともに、厳しい方。

## WebApp.formData クォータ

ファイル解析は二層：**WebApp.body.formData** がサイトデフォルト（単体サイズ、part 総数）、ルートの `rule.file()` がフィールド単位。片方だけ変えて 413 なら、アプリかフィールドかを確認。

| 層 | 典型的な使い方 |
| --- | --- |
| `WebApp.body.formData` | サイトデフォルト上限。大ファイルサイトはここから |
| `body()` + schema | schema で名指ししたフィールドだけ解析 |
| `rule.file()` | 単フィールドの業務規則（MIME、サイズ） |

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    formData: { maxFileSize: '20mb', maxFiles: 10 }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

大ファイルはディスク一時領域へ（メモリ丸ごと避け）、オブジェクトストレージへストリームアップロードしやすい。ルートで maxSize だけ変えたら formData と照合。413 は両層。

ネストオブジェクトに `rule.file()` を入れると multipart のフラット名と合わずにずれることがある——クライアントの送り方を先に揃える。

::: warning
mimeTypes に認識できない token があると設定段階でエラー——全タイプを silently 開放しない。
:::

## 次に

- [リクエスト body](/ja/web/body)（multipart 許可リスト、作成と PATCH）
- [rule.file()](/ja/validators/rules/file)（フィールド専用オプション）
- [Web 入口](/ja/web/)（body.formData グローバルクォータ）