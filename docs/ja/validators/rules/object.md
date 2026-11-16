---
outline: deep
---

# rule.object()

**名前付き JSON オブジェクト**を検証：body の profile、ネストフィールド表、既存 schema を更大形状に埋め込む。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const userBody = schema({
  id: rule.int(),
  profile: rule.object({ // [!code highlight]
    bio: rule.string().optional(),
  }),
});
// 默认白名单：未声明字段会被丢掉
```

デフォルトは未宣言フィールドを捨てる——クライアントが余分なキーを送っても「静かに消える」。サーバーがエラーを返すと誤解しない。

- フィールド表が推論形状を決める；ネストは rule.object({...}) または裸 { key: rule... }。
- additional() は追加キーを残し、型は広がる。
- parseFromString 成功後もオブジェクト型。

### additional()

**いつ使うか：** Webhook 透過、プロキシの余分なキーも永続化（できるだけホワイトリスト推奨）。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional();
// { id: 1, traceId: 'x' } → 两者都保留
```

### additional({ key?, value? })

**いつ使うか：** meta_* キーのみ残す、追加値は string 必須、宣言フィールド + 同質拡張袋。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional({ key: /^(meta|ext)_/ });
rule.object().additional({ value: rule.string() });
rule.object({ id: rule.int() }).additional({ value: rule.number() });
```

動的キーで値が同質・固定フィールドなしなら [record](./record) を優先。

### parseFromString(is?: boolean)

**いつ使うか：** form / query が JSON を 1 文字列に詰める、例 filter={"status":"on"}。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).parseFromString();
// '{"id":1}' → { id: 1 }
```

### strict(is?: boolean)

**いつ使うか：** body がすでにオブジェクト；通常文字列を JSON と誤認しない（parseFromString(true) と併用しない限り）。

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).strict();
```

同質動的キーを空 object() で無理しない。[record](./record) を使う。

共通チェーンは [共通チェーン](../chain)；[record](./record)、[array](./array)、[oneOf](./one-of)。
