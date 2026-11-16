---
outline: deep
---

# rule.any()

形状を **一時的に拘束しない** JSON 断片：プラグイン settings、監査の before/after、移行期の未知フィールド。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const pluginSchema = schema({
  name: rule.string().required(),
  settings: rule.any().optional(), // [!code highlight]
});
// settings 可以是对象、数组、字符串、数字等常见 JSON 形态
```

- 推論はかなり広い（unknown / 広いユニオンに近い；コンパイラに従う）。
- ctx.body を消費するときは、自分で狭めるか二重検証が必要になりがち。
- 専用チェーンなし。

モデル化できるなら [object](./object) / [record](./record) を優先；サードパーティコールバック丸ごと、Admin の JSON Blob は過渡期に rule.any()。長期の裸 any は OpenAPI と TS の意味を失う——移行後は schema を狭める。「キー自由・値は同質」は [record](./record)，not any。

共通チェーンは [共通チェーン](../chain)；構造化の代替は [record](./record)、[oneOf](./one-of)、[object](./object)。
