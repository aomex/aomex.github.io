---
outline: deep
---

# rule.uuid()

**UUID 文字列**（ハイフン付き）を検証する：パス :id、parentId、イベント correlationId。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const paramsSchema = schema({
  id: rule.uuid('v4'), // [!code highlight]
});
// '550e8400-e29b-41d4-a716-446655440000' → 通过
```

- 成功後の型推論は string。
- ファクトリで v1〜v8 または配列を限定できる；バージョン未指定時は一般的な各版を受け付ける。
- 大文字小文字は通常区別しない。

### match(pattern: RegExp)

**いつ使うか：** ほぼない——UUID で十分狭い；本当に業務プレフィックスを重ねるとき（多くのプロジェクトは別フィールド）。

```typescript
import { rule } from '@aomex/common';

rule.uuid('v4').match(/^550e8400-/);
```

共通チェーンは [共通チェーン](../chain)；[ulid](./ulid)、[string](./string)、[anyOf](./any-of)。
