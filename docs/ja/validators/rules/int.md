---
outline: deep
---

# rule.int()

**整数**を検証する：ページ番号、数量、採番 ID、在庫数（安全整数範囲内）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1), // [!code highlight]
  pageSize: rule.int().min(1).max(100).default(20),
});
// ?page=2 → page 为 2；省略 page → 1
```

- 成功後は number かつ実行時は整数（Number.isInteger）。
- query では文字列 '2' が多い；デフォルト非 strict なら 2 に変換。
- default(n) 後、クライアント未送信でも型上は number。

Number.MAX_SAFE_INTEGER を超えるなら [bigint](./bigint)；注文金額・レートは int や裸 [number](./number) で小数を背負わず [decimal](./decimal) を参照。

### min(n, inclusive?: boolean)

**いつ使うか：** ページは 1 から、注文数量は最低 1；inclusive: false は **n より大きい**必須。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1);
rule.int().min(0, false); // 必须 > 0
```

### max(n, inclusive?: boolean)

**いつ使うか：** pageSize 上限、一括 ID 上限。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).max(100).default(20);
```

[`number.min` / `number.max`](./number) と同義だが、本ルールは整数を追加要求。

### strict(is?: boolean)

**いつ使うか：** 純 JSON body がすでに number；**query では通常付けない**。さもないと '1' で落ちる。

```typescript
import { rule } from '@aomex/common';

rule.int().strict();'18' → 失败；18 → 通过；18.5 → 失败
```

::: warning
ページング query に strict() はよくある自爆ポイント——文字列ページ番号が入らない。
:::

共通チェーンは [共通チェーン](../chain)；[number](./number)（小数）、[bigint](./bigint)（超大整数）、[decimal](./decimal)（金額）。
