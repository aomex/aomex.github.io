---
outline: deep
---

# rule.array()

**配列**を検証する：タグ一覧、一括 ID、注文明細行（要素に小さなオブジェクト形状をネスト可）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const batchSchema = schema({
  ids: rule.array(rule.int()).length({ max: 100 }), // [!code highlight]
  tags: rule.array(rule.string()).length({ min: 1, max: 20 }),
});
```

- 要素ルールが T[] を決める；オブジェクト形状は array(object({...})) と同等。
- unique 系メソッドは OpenAPI の uniqueItems の有無に影響（各メソッド説明参照）。
- forceToArray 後は query の単一値も配列型になる。

### length(n | { min?, max? })

**いつ使うか：** タグ最低 1 件、一括最大 100 件、緯度経度 2 要素固定。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).length({ min: 1, max: 20 });
rule.array(rule.number()).length(2);
```

### unique()

**いつ使うか：** 要素全体の重複排除（Set 意味、オブジェクトは参照）；OpenAPI uniqueItems: true。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique();
// ['a','a'] → 失败
```

unique() はオブジェクト要素を参照で比較——構造が同じ別オブジェクトは重複とみなさない。

### unique(key)

**いつ使うか：** 行オブジェクトを sku / userId で重複排除；'a.b' パス非対応；OpenAPI uniqueItems は書かない。

```typescript
import { rule } from '@aomex/common';

rule.array({ sku: rule.string(), qty: rule.int() }).unique('sku');
```

### unique(fn)

**いつ使うか：** 大文字小文字無視タグ、正規化フィールドでの重複排除。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).unique((s) => { // [!code highlight]
  return s.toLowerCase();
});
// ['Ada', 'ada'] → 失败
```

### forceToArray('separator', separator?)

**いつ使うか：** query ?tags=a,b,c や ?ids=1,2,3 が文字列で来る。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('separator');
rule.array(rule.int()).forceToArray('separator', '|');
```

### forceToArray('block')

**いつ使うか：** 単選 ?tag=news が ['news'] ではなく文字列。

```typescript
import { rule } from '@aomex/common';

rule.array(rule.string()).forceToArray('block');
// 'news' → ['news']
```

query 配列で forceToArray を忘れると、単一値と複数値で形が揃わず 400 になりやすい。

共通チェーンは [共通チェーン](../chain)；[object](./object)、[string](./string)、[int](./int)。
