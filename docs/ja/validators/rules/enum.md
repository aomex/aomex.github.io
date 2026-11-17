---
outline: deep
---

# rule.enum()

フィールドを **有限集合**に制限：status、sort、role（OpenAPI enum に載る）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  sort: rule.enum(['asc', 'desc']).default('desc'), // [!code highlight]
});
// ?sort=asc → 'asc'；不正値 → 失敗
```

- 配列引数はリテラルユニオンに推論される（例：`'asc' | 'desc'`）。
- pick / omit で新しい enum バリデーターになり、optional / default はしばしば維持。
- pick / omit が空、または default が集合外だと設定時に例外。

すでに TypeScript の `enum`（または `as const` の列挙オブジェクト）があるなら、`rule.enum` にそのまま渡せる。配列を手で書き写す必要はない：

```typescript
import { rule, schema } from '@aomex/common';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

export const patchBody = schema({
  color: rule.enum(Color), // [!code highlight]
});
// { color: 'red' } → Color.Red；'green' → 失敗
```

通過後の型は enum メンバー（`Color`）で、裸の `'red' | 'blue'` ではない——`ctx.body.color` を `Color.Red` と比較できる。数値 enum も同様で、推論は `Status`：

```typescript
import { rule } from '@aomex/common';

enum Status {
  Off = 0,
  On = 1,
}

rule.enum(Status); // → Status
```

`enum` キーワードがなく定数オブジェクトだけのときは `as const` を付けて渡し、推論は値のユニオンになる：

```typescript
import { rule } from '@aomex/common';

const Role = { Admin: 'admin', User: 'user' } as const;

rule.enum(Role); // → 'admin' | 'user'
```

オブジェクトの値は string / number のみ。真偽値は配列形式 `rule.enum([true, false])` を使う。

### pick(...values | values[])

**いつ使うか：** 全状態は管理画面；ユーザー公開 API は draft → published のみ。

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

TS enum を渡した場合、pick / omit はメンバーそのものでよい：`rule.enum(Color).pick(Color.Red, Color.Blue)`。

### omit(...values | values[])

**いつ使うか：** 作成時に archived 不可；フィルタ UI から内部状態を除外。

```typescript
import { rule } from '@aomex/common';

rule.enum(['draft', 'published', 'archived']).omit('archived');
```

default 変更後も pick/omit 後の集合内に残す。

### strict(is?: boolean)

**いつ使うか：** 数値 enum で body がすでに number；query 文字列はデフォルトのままが多い。

```typescript
import { rule } from '@aomex/common';

rule.enum([0, 1, 2]).strict();
// '1' → 失敗；1 → 通過
```

共通チェーンは [共通チェーン](../chain)；[literal](./literal)、[oneOf](./one-of)、[string](./string)。
