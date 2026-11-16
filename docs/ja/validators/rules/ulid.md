---
outline: deep
---

# rule.ulid()

**ULID**（26 文字・おおよそ時間順）を検証する：orderId、同期カーソル after。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const orderParams = schema({
  orderId: rule.ulid().required(), // [!code highlight]
});
// '01ARZ3NDEKTSV4RRFFQ69G5FAV' → 通过
```

- 成功後の型推論は string。
- バージョン引数などのファクトリオプションはなし。専用チェーンもなく、optional / default は [共通チェーン](../chain) を使う。

共通チェーンは [共通チェーン](../chain)；[uuid](./uuid)、[int](./int)、[bigint](./bigint)。
