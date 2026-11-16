---
outline: deep
---

# rule.stream()

**Readable ストリーム**（Node Readable）を検証する：エクスポートジョブのソース、子プロセス stdout、内部 job パイプ（JSON body のフィールドではない）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { Readable } from 'node:stream';
import { rule, schema } from '@aomex/common';

export const exportSchema = schema({
  format: rule.literal('csv'),
  source: rule.stream().required(), // [!code highlight]
});
// Readable.from([...]) → 通过；{ foo: 1 } → 失败
```

- 成功後は Readable ストリーム型に狭まる（`Validator.Infer` に従う）。
- 専用チェーンなし；optional / required は [共通チェーン](../chain) を参照。
- JSON のデシリアライズ結果に本物のストリームは出ない——HTTP JSON ルートで期待しない。

共通チェーンは [共通チェーン](../chain)；[file](./file)、[buffer](./buffer)、[literal](./literal)。
