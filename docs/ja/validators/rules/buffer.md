---
outline: deep
---

# rule.buffer()

**Node.js Buffer** を検証する：署名 hex、暗号化 ciphertext、キュー任務の生バイト（通常の JSON 内 Buffer ではない）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const attestationSchema = schema({
  signature: rule.buffer().parseFrom('base64').required(), // [!code highlight]
});
// 'SGVsbG8=' → Buffer
```

- デフォルトは本物の Buffer のみ；parseFrom 未設定時は JSON 文字列は自動変換されない。
- parseFrom('hex', 'base64') 後もフィールド推論は Buffer。
- ブラウザ JSON body で Buffer は渡せない——外向けはほぼ文字列 + parseFrom。

### parseFrom(...encodings: 'hex' | 'base64')

**いつ使うか：** REST JSON で hex 署名、base64 画像バイト；複数列挙で実装に応じ試行。

```typescript
import { rule } from '@aomex/common';

rule.buffer().parseFrom('base64').required();
rule.buffer().parseFrom('hex', 'base64');
```

「hex っぽい文字列」だけ見て Buffer にしないときは [string](./string) + match または定長 [hash](./hash)。

共通チェーンは [共通チェーン](../chain)；[file](./file)、[hash](./hash)、[string](./string)。
