---
outline: deep
---

# Mongoose

MongoDB プロジェクトの典型痛点：**HTTP 入参用と Mongoose Schema を二重保守**、フィールド変更で二箇所がずれる。defineMongooseModel はルートと同じ rule で Mongoose Schema を生成し ObjectId / Decimal128 検証を拡張——本稿はモデル定義、HTTP 接続、型の期待を一本化。

複合インデックス、Mongoose ミドルウェア、DB のみのフィールドはモデルかルート response で補う。ブリッジが覆わないものは Mongoose に戻す。

## defineMongooseModel

```bash
pnpm add @aomex/mongoose mongoose
```

```typescript
import { rule } from '@aomex/common';
import { defineMongooseModel } from '@aomex/mongoose';

export const User = defineMongooseModel('users', { // [!code highlight]
  schemas: {
    name: rule.string(),
    email: rule.email(),
    profile: {
      bio: rule.string().optional(),
    },
  },
  timestamps: true,
  indexes: [{ fields: { email: 1 }, unique: true }],
});
```

Mongo 専用ルールはパッケージ読み込みで登録（プロジェクトエントリに合わせる）：

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

典型レイヤー（本パッケージは**ミドルウェアではない**）：

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — 共有入参 / 出参 schema
3. routers/user.ts — body / response が schema またはフィールド表を参照
4. web.ts — 通常の WebApp + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '../schemas/user.schema.js';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* 对外 DTO，别默认泄露仅 DB 字段 */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

defineMongooseModel は標準 Mongoose Model を返し**入出力**関連の推論付き——作成・クエリでドキュメントフィールドのホバーが rule チェーンと揃うことが多い。schemas 内ネスト裸オブジェクトは自動でオブジェクト検証。ルート body({ ... }) と同型。rule.mongoObjectId() 等は **import '@aomex/mongoose' の後**で rule に現れる。忘れると型と実行時が不一致（副作用 import 忘れで未登録）。formatMongoResult：クエリ結果を JSON 向きに整形（_id、Decimal 等）。パッケージ export と型ヒントに従う。

## モデルフィールドと外部 DTO

| フィールド / オプション | いつ使う |
| --- | --- |
| `schemas` | フィールド → Validator、またはネストオブジェクト |
| `indexes` | `{ fields, ...IndexOptions }[]` |
| `timestamps` / `versionKey` | Mongoose SchemaOptions と同じ |
| その他 SchemaOptions | Mongoose へ透過 |
| ルート `response({ content })` | 外部 DTO。DB のみフィールドを API にデフォルト露出しない |

[Prisma](/ja/plugins/prisma) とは別シーン。ここは Mongoose + Mongo。definePrismaSchema ではない。

モデルだけ定義しルートが別 shape 手書きだと変更時に二箇所——「rule 共有」の目的に反する。Mongoose ドキュメントをそのまま ctx.send しない。機密や DB 専用フィールドが漏れる。response か明示 pick。検証器が覆わない複合ユニーク、pre hook 等はモデル層で設定。

## 関連

- カスタム Mongo ルールの考え方：[カスタムバリデータ](/ja/advanced/validator)（mongoObjectId 同系）
- HTTP 入参：[リクエストボディ](/ja/web/body)
- バリデータ一覧：[builtins](/ja/validators/builtins)