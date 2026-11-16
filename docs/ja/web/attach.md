---
outline: deep
---

# ファイルアップロード

アバターや添付付き multipart API：`body()` でファイルフィールドを [rule.file()](/ja/validators/rules/file) に。`ctx.body` から一時パスと MD5 を取り、リクエスト終了前に移動（OSS、ローカルなど）。`body()` なしの multipart はファイルを解析しない。

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
クライアントは multipart/form-data：name は通常フィールド、avatar はファイル part。よくあるのは action で即アップロード/コピーして返す——レスポンス後一時ファイルは消える。

avatar 検証後はだいたい filepath、size、mimetype、hash、hashAlgorithm、originalFilename。業務で多いのは filepath と hash。`rule.array(rule.file())` なら `ctx.body.attachments` はファイルオブジェクト配列。

::: warning
201 を返す前にファイルを移動/アップロードしていないと、一時パスは次のラウンドでは読めない保証がない。
:::

## サイズと MIME

単一フィールドの `rule.file().maxSize()` / `.mimeTypes()` は**検証段階**で巨大/不正タイプを弾き、action 内判定より IO が少ない。アプリ級 `formData` と併用時は厳しい方。ルートだけ変えたら 413 は両方確認。

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
`rule.file().maxSize('2mb')` はそのフィールドだけ。アプリ級 formData.maxFileSize と併用時は**厳しい方が勝つ**。

魔数が不安定なら MIME にフォールバック：

```typescript
rule.file().mimeTypes('image/svg+xml').fallbackToMimetype(),
```
::: warning
インターネット公開のアバターで安易に `fallbackToMimetype()` しない——クライアントの Content-Type を信じすぎる。イントラネットなど制御下だけ。
:::

## 同一フィールド複数ファイル

HTML フォームの同名 input が複数 part。`rule.array(rule.file())` で配列化。`.length({ max: n })` で1リクエスト上限。一度に巨大ファイルを詰め込まない。

```typescript
body({
  attachments: rule.array(rule.file().maxSize('10mb')).length({ max: 5 }),
});
```
同一リクエストで複数ファイルフィールドがある場合、合計個数はアプリ級 formData.maxFiles も効き、ルート級と合わせて厳しい方。

## WebApp.formData クォータ

解析は2層：**WebApp.body.formData** がサイトデフォルト（単体サイズ、part 数）、ルート `rule.file()` がフィールド単位。片方だけ変えて 413 なら、どちらが効いたか両方見る。

| 層 | 典型用法 |
| --- | --- |
| `WebApp.body.formData` | サイトデフォルト上限。大ファイルサービスはここを先に |
| `body()` + schema | schema で名指ししたフィールドだけ解析 |
| `rule.file()` | 単一フィールドの業務ルール（MIME、サイズ） |

```typescript
new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    formData: { maxFileSize: '20mb', maxFiles: 10 }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```
大ファイルはディスク一時領域へ流し、オブジェクトストレージへストリームアップロードしやすくする。ルートで maxSize だけ変えたらアプリ級 formData と照合。413 は両層。

ネストオブジェクトに `rule.file()` を入れると multipart の平坦フィールド名と合わないことが多い。複雑構造はクライアントの送り方を先に揃える。

::: warning
`mimeTypes` で認識できないトークンは設定段階でエラーになる。 silently 全タイプ開放はしない。
:::

## 次のステップ

- [リクエストボディ](/ja/web/body)（multipart ホワイトリスト、作成と PATCH）
- [rule.file()](/ja/validators/rules/file)（フィールド専用オプション）
- [Web アプリケーション入口](/ja/web/)（body.formData グローバルクォータ）
