---
outline: deep
---

# rule.bigint()

**大整数**（bigint）を検証：チェーン上の wei、Snowflake ID、安全整数超えのカウンタ。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const ledgerSchema = schema({
  amountWei: rule.bigint().min(0n), // [!code highlight]
});
// body: { amountWei: '9007199254740992' } → 9007199254740992n
```

- 成功後の型推論は bigint。
- HTTP JSON にネイティブ bigint はなく、body では**文字列**数字が多い；非 strict なら変換を試す。
- レスポンスシリアライズ前に .toString() かカスタム replacer。

bigint をそのまま JSON.stringify しない——クライアントが壊れる。

### min(value: bigint, inclusive?: boolean)

**いつ使うか：** 最小チャージ、カーソルが前ページ ID より大きい（inclusive: false は厳密に大きい）。

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(100n);
rule.bigint().min(100n, false);
```

### max(value: bigint, inclusive?: boolean)

**いつ使うか：** 単筆上限、クォータ上限。

```typescript
import { rule } from '@aomex/common';

rule.bigint().min(0n).max(10_000_000_000_000_000_000n);
```

### strict(is?: boolean)

**いつ使うか：** 本物の bigint のみ受け付け、'1e3' などの文字列端を塞ぐ。

```typescript
import { rule } from '@aomex/common';

rule.bigint().strict();'123' → 失败
```

共通チェーンは [共通チェーン](../chain)；[int](./int)、[decimal](./decimal)、[hash](./hash)。
