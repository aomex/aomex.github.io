---
outline: deep
---

# rule.boolean()

スイッチ系入力を **boolean** にまとめる：公開フラグ、?featured=1、JSON の isAdmin。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  published: rule.boolean().default(false), // [!code highlight]
});
// ?published=1 → true；省略 → false
```

- 成功後の型推論は boolean。
- デフォルトで真/偽リテラル（'true'、1 など）を bool にマッピング；リスト変更後はリスト内のみ通過。
- default(false) 後、未送信でも型上は boolean。

デフォルト真値は 1 / '1' / true / 'true'、偽は 0 / '0' / false / 'false'。三択 UI（未選択/はい/いいえ）は boolean に無理やり詰めない——optional() か別 enum。

### setTruthyValues(values: any[])

デフォルト真値リストを**上書き**（追記ではない）。

**いつ使うか：** 旧システムや HTML が yes / on / Y を true 以外で送る。

```typescript
import { rule } from '@aomex/common';

rule.boolean().setTruthyValues(['yes', 'on', 'Y', 1, true]);
// 'on' → true；覆盖后默认的 'true' 可能不再认
```

setTruthyValues だけ変えて偽値リストを更新し忘れると、「オフにできない」や中間値が全部 400 になりやすい。

### setFalsyValues(values: any[])

デフォルト偽値リストを**上書き**。

**いつ使うか：** 真値リストと対で、no / off でオフを表す相手側。

```typescript
import { rule } from '@aomex/common';

rule.boolean()
  .setTruthyValues(['yes', 'on', 1, true])
  .setFalsyValues(['no', 'off', 0, false]);
```

両リストのどちらにも無い値は即失敗；strict() はなく、緩急はリスト次第。

共通チェーンは [共通チェーン](../chain)；多段状態は [enum](./enum)、テキストスイッチ名は [string](./string)。
