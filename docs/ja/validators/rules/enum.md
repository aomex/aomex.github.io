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
// ?sort=asc → 'asc'；非法值 → 失败
```

- TS enum を渡すとリテラルユニオンまたは enum メンバー型。
- pick / omit で新しい enum バリデーターになり、optional / default はしばしば維持。
- pick / omit が空、または default が集合外だと設定時に例外。

### pick(...values | values[])

**いつ使うか：** 全状態は管理画面；ユーザー公開 API は draft → published のみ。

```typescript
import { rule } from '@aomex/common';

const status = rule.enum(['draft', 'published', 'archived']);
status.pick('draft', 'published');
status.pick(['draft', 'published']);
```

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

rule.enum([0, 1, 2]).strict();'1' → 失败；1 → 通过
```

共通チェーンは [共通チェーン](../chain)；[literal](./literal)、[oneOf](./one-of)、[string](./string)。
