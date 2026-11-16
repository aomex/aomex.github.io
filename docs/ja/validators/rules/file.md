---
outline: deep
---

# rule.file()

**multipart アップロードファイル**（`@aomex/web`）を検証：アバター、証明写真、CSV インポート（formidable ファイルオブジェクトを出力）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。アップロード手順は [ファイルアップロード](/ja/web/attach)。

```typescript
import { rule } from '@aomex/web';

export const avatarField = rule.file().maxSize('2mb').mimeTypes('image/jpeg', 'image/png');
```

ブラウザ JSON body でのアップロードに file は使わない——multipart と [ファイルアップロード](/ja/web/attach)。

- 成功後は formidable ファイルオブジェクト（path、size、mimetype など）で、Buffer ではない。
- 本ルールは **nullable / default が無い**ことが多い——専ページと型ヒントに従う。
- mimeTypes + マジックナンバー不一致時の挙動は fallbackToMimetype 依存。

### maxSize(byte: number | string)

**いつ使うか：** 巨大ファイルでディスク枯渇防止；'20kb' / '2mb' またはバイト数。

```typescript
import { rule } from '@aomex/web';

rule.file().maxSize('2mb');
rule.file().maxSize(500_000);
```

### mimeTypes(...tokens | tokens[])

**いつ使うか：** アバターは画像のみ、インポートは CSV；署名があるときは内容優先。

```typescript
import { rule } from '@aomex/web';

rule.file().mimeTypes('.png', 'image/jpeg');
rule.file().mimeTypes(['image/*']);
rule.file().mimeTypes('.csv', 'text/csv');
```

### fallbackToMimetype(enable?: boolean)

**いつ使うか：** CSV / HTML / プレーンテキストなど安定マジックナンバーなし——デフォルト true でクライアント Content-Type を mimeTypes と照合。

```typescript
import { rule } from '@aomex/web';

rule.file()
  .mimeTypes('.html', 'text/plain', 'text/csv')
  .fallbackToMimetype();
```

一時ファイルはレスポンス後に掃除——action 内で早めに rename かオブジェクトストレージへ。

共通チェーンは [共通チェーン](../chain)；[buffer](./buffer)、[stream](./stream)。
