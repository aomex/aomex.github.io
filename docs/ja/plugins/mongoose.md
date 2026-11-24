---
outline: deep
---

# Mongoose

MongoDB プロジェクトでよくある痛みは、**HTTP 入力の検証一式と Mongoose Schema をもう一式手書き**すること。フィールドを変えると二箇所がずれる。defineMongooseModel はルートと同じ rule から Mongoose Schema を生成し、ObjectId / Decimal128 の検証も拡張する——本ページはモデル定義、HTTP のつなぎ、型の期待を一本にする。

複雑なインデックス、Mongoose ミドルウェア、DB にしか無いフィールドは、モデルやルートの response で自分で補う。橋渡しパッケージがカバーしないものは全部 Mongoose に戻す。

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

Mongo 専用ルールは、先にパッケージ登録を読み込む（パスはプロジェクト入口に合わせる）：

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

典型的な層分け（本パッケージは**ミドルウェアではない**）：

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — 共有の入力 / 出力 schema
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

defineMongooseModel は標準の Mongoose Model を返し、**入力/出力**の推論も付く——作成・照会時にドキュメントフィールドへホバーすると、rule チェーンと揃うことが多い。schemas 内の入れ子の素オブジェクトは自動でオブジェクト検証にまとまり、書き方はルートの body({ ... }) と同じ。rule.mongoObjectId() などは **import '@aomex/mongoose' の後**でなければ rule に出ない。さもないと型も実行時も合わない（side-effect import を忘れると登録されない）。ほかに formatMongoResult：照会結果をより JSON 向きの形に整える（_id、Decimal など）。パッケージのエクスポートと型ヒントに従う。

## モデルフィールドと外部 DTO

`schemas` にフィールドを書く → Validator（入れ子の素オブジェクトは自動でオブジェクト検証にまとまる）。`indexes`、`timestamps`、`versionKey` およびその他の SchemaOptions は Mongoose に透過——一意複合インデックスや pre hook など検証器がカバーしないものは、モデル層で設定する。

外部へは Mongoose ドキュメントをそのまま `ctx.send` しない。機密や DB 専用フィールドが漏れる。ルートでは `response({ content })` か明示的な pick で DTO にまとめる。

[Prisma](/ja/plugins/prisma) の場面とは違う：ここは Mongoose + Mongo で、definePrismaSchema ではない。モデルだけ定義し、ルートで別 shape を手書きすると、フィールド変更が二箇所になり「rule 共有」の意図に反する。

## 関連

- カスタム Mongo ルールの実装の考え方：[カスタム検証器](/ja/advanced/validator)（mongoObjectId と同系統）
- HTTP 入力：[リクエスト本体](/ja/web/body)
- 検証器一覧：[builtins](/ja/validators/builtins)
