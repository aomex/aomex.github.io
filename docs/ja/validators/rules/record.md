---
outline: deep
---

# rule.record()

**`Record<string, V>`** を表す：機能フラグ表、多言語文言、タグ→重み——キー名は固定せず、値の型は統一。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const flagsSchema = schema({
  features: rule.record(rule.boolean()), // [!code highlight]
});
// { darkMode: true, beta: false } → 通过
```

- `rule.object().additional({ value })` と同等で、推論は「任意の文字列キー + 固定の値型」。
- 値ルールの min / optional などは **value** 側の rule に載せる。
- 本ルール専用チェーンなし；optional / default は [共通チェーン](../chain) を参照。

共通チェーンは [共通チェーン](../chain)；[object](./object)、[any](./any)、[boolean](./boolean)。
