---
outline: deep
---

# rule.literal()

入力がある **リテラル値と完全一致** することを要求する：Webhook event、判別共用体の type、固定 action: 'ping'。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const pingSchema = schema({
  action: rule.literal('ping'), // [!code highlight]
});
// { action: 'ping' } → 通过；'pong' → 失败；'1' 与 1 不相等
```

- 推論は具体的なリテラル型（例：'ping'）に狭まる。
- 型変換はしない——'1' と 1 は別ブランチ。
- 専用チェーンなし；optional / default は [共通チェーン](../chain) を参照。

共通チェーンは [共通チェーン](../chain)；[enum](./enum)、[oneOf](./one-of)、[anyOf](./any-of)。
