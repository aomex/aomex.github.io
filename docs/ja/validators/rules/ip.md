---
outline: deep
---

# rule.ip()

**IP リテラル**を検証する：ホワイトリストの clientIp、VPN 対向、リゾルバアドレス（v4 / v6 はファクトリで選択）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const allowlistSchema = schema({
  peer: rule.ip('v4').required(), // [!code highlight]
});
// '203.0.113.10' → 通过；'2001:db8::1' 在只 v4 时 → 失败
```

- 成功後の型推論は string。
- **バージョンはファクトリのみ** rule.ip('v4' | 'v6' | [...])；.v6() チェーンはない。

### match(pattern: RegExp)

**いつ使うか：** IP が合法なあと、明らかな非公網レンジを弾く（複雑な CIDR は action で専用ライブラリを推奨）。

```typescript
import { rule } from '@aomex/common';

rule.ip('v4').match(/^10\./);
// '10.0.0.1' → 通过；'203.0.113.1' → 失败
```

共通チェーンは [共通チェーン](../chain)；[string](./string)、[url](./url)、[hash](./hash)。
