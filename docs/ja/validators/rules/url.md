---
outline: deep
---

# rule.url()

**URL 文字列**を検証する：アバター、トップ、コールバック、ドキュメントリンク（デフォルト http / https）。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const profileSchema = schema({
  avatar: rule.url().optional(), // [!code highlight]
});
// 'https://cdn.example.com/u/1.png' → 通过；'not a url' → 失败
```

- 成功後の型推論は string（成功値はしばしば正規化後の URL 文字列；実行時に従う）。
- scheme([...]) はデフォルトプロトコルリストを**上書き**し、追記ではない。

### scheme(schemes: string[])

**いつ使うか：** 本番コールバックは HTTPS のみ；イントラネットミラーは http+https；稀なプロトコル（ftp など）は明示的に列挙。

```typescript
import { rule } from '@aomex/common';

rule.url().scheme(['https']).required();
rule.url().scheme(['https', 'http']);
```

共通チェーンは [共通チェーン](../chain)；[email](./email)、[string](./string)、[ip](./ip)。
