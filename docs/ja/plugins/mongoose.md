---
outline: deep
---

# Mongoose

MongoDB プロジェクトでよくある痛み：**HTTP 入参の検証と Mongoose Schema を二重に手書き**し、フィールド変更で二箇所がずれる。defineMongooseModel はルートと同じ rule から Mongoose Schema を生成し、ObjectId / Decimal128 検証を拡張する——本ページはモデル定義・HTTP 接続・型の期待を一本化する。

複雑なインデックス、Mongoose ミドルウェア、DB 専用フィールドはモデルかルート response で自分で補う。ブリッジが覆えないものを無理に詰め込まない。

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

Mongo 専用 rule はパッケージ読み込みで登録（プロジェクト入口のパスは環境に合わせる）：

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

典型的な層（本パッケージ**は**ミドルウェアではない）：

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — 共有入参 / 出参 schema
3. routers/user.ts — body / response が schema またはフィールド表を参照
4. web.ts — 通常の WebApp + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '@/schemas/user.schema';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* 対外 DTO。DB 専用フィールドを漏らさない */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

defineMongooseModel は標準 Mongoose Model を返し、**入出力**まわりの推論を付ける——作成・照会時にホバーで文書フィールドが rule チェーンと揃いやすい。schemas のネスト裸オブジェクトは自動でオブジェクト検証にまとまり、ルート `body({ ... })` と同型。rule.mongoObjectId() 等は **`import '@aomex/mongoose'` の後**でないと rule に出ない；さもないと型も実行時も不一致（side-effect import 忘れで未登録）。formatMongoResult は照会結果をより JSON 向きに整形（_id、Decimal 等）。パッケージ export と型ヒントに従う。

## モデルフィールドと対外 DTO

`schemas` にフィールド → Validator（ネスト裸オブジェクトは自動でオブジェクト検証）。`indexes`、`timestamps`、`versionKey` およびその他 SchemaOptions は Mongoose に透過——複合ユニーク、pre hook など検証器がカバーしないものはモデル層で。

対外に Mongoose ドキュメントをそのまま `ctx.send` しない：機密や DB 専用が漏れる。ルートで `response({ content })` か明示 pick で DTO に。

[Prisma](/ja/plugins/prisma) とは別シーン：ここは Mongoose + Mongo。モデルだけ define してルートは別 shape の手書きだと、変更は依然二箇所——「rule 共有」の意図に反する。

## 関連

- カスタム Mongo rule の考え方：[カスタムバリデータ](/ja/advanced/validator)（mongoObjectId と同根）
- HTTP 入参：[リクエスト body](/ja/web/body)
- バリデータ一覧：[builtins](/ja/validators/builtins)