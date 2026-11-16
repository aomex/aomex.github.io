---
outline: deep
---

# rule.decimal()

**decimal.js** で金額、為替、税率を検証——0.1 + 0.2 のような浮動小数誤差を避ける。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const paySchema = schema({
  amount: rule.decimal().min('0.01').max('50000'), // [!code highlight]
});
// body: { amount: '19.99' } → Decimal 实例
```

- 成功後の実行時は多くが Decimal（decimal.js）で、number ではない。
- default('0') は文字列/数値を Decimal に包んでデフォルトにする。
- JSON レスポンス前はだいたい .toString()；メソッド付きオブジェクトをそのまま JSON.stringify しない。

OpenAPI / フロント型はしばしば string；実行時 Decimal は業務境界で変換。

### min(value, inclusive?: boolean)

**いつ使うか：** 最小支払額、残高非負；value は string / number / Decimal 可。

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01');
rule.decimal().min(0, false);
```

### max(value, inclusive?: boolean)

**いつ使うか：** 単筆上限、割引 1 以下。

```typescript
import { rule } from '@aomex/common';

rule.decimal().min('0.01').max('50000');
```

### default(value)

**いつ使うか：** 新規口座残高 0 から、任意送料デフォルト 0（Decimal に包まれる）。

```typescript
import { rule } from '@aomex/common';

rule.decimal().default('0');
```

### strict(is?: boolean)

**いつ使うか：** 内部で Decimal インスタンスを渡す；外向け HTTP はデフォルトの文字列受け入れのまま。

```typescript
import { rule } from '@aomex/common';

rule.decimal().strict();'1.5' → 失败
```

検証通過後の加減算も Decimal 上で；表示層と保存層で裸 number を混ぜない。

共通チェーンは [共通チェーン](../chain)；[number](./number)、[int](./int)、[bigint](./bigint)。
