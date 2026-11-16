---
outline: deep
---

# rule.hash()

**16 進ハッシュ文字列の形**（アルゴリズムごとの定長）を検証する：contentMd5、etag、sha256 フィンガープリント（ハッシュ計算はせず、形式のみ）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const callbackSchema = schema({
  contentMd5: rule.hash('md5').required(), // [!code highlight]
});
// 'd41d8cd98f00b204e9800998ecf8427e' → 通过
```

- 成功後の型推論は string。
- アルゴリズムはファクトリのみ：md5 / sha1 / sha256 / sha512 など；0x 付きや Base64 は通常失敗。
- ファクトリの第 2 引数でアルゴリズムを選ぶ，例：rule.hash('sha256')；未知のアルゴリズムは型ヒントと実行時エラーに従う。

共通チェーンは [共通チェーン](../chain)；近い形は [string](./string)、[buffer](./buffer)、[file](./file)。
