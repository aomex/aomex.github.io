---
outline: deep
---

# rule.string()

**読み取り可能なテキスト**を検証・狭める：ニックネーム、タイトル、検索語、備考。

共通チェーン（optional / required / nullable / default / transform / docs など）は [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const nicknameSchema = schema({
  displayName: rule.string().trim().length({ min: 1, max: 32 }), // [!code highlight]
  q: rule.string().trim().optional(),
});
// body: { displayName: '  Ada  ' } → displayName 为 'Ada'
```

- 成功後のフィールド推論は string（transform 後は transform 戻り型。[共通チェーン](../chain) 参照）。
- デフォルトで空文字 '' は「未送信」扱い；optional() と組むと undefined になりがち。
- allowEmptyString() 後は '' が合法 string として残る。

### trim(is?: boolean)

**いつ使うか：** フォーム、貼り付け、IME の前後空白——trim しないと「見た目同じ」が DB と不一致。

```typescript
import { rule } from '@aomex/common';

rule.string().trim();
rule.string().trim().length({ min: 1, max: 32 });
```

### length(n | { min?, max? })

**いつ使うか：** 認証コード桁数、パスワード最小長、備考上限（JS 文字列 .length、UTF-16 コードユニット）。

```typescript
import { rule } from '@aomex/common';

rule.string().length(6);
rule.string().length({ min: 8, max: 128 });
```

trim と組むと長さは **trim 後** で数える。

### match(pattern: RegExp)

**いつ使うか：** ユーザー名英数字下線のみ、固定招待コード形式。メール / URL / UUID は専用ファクトリ優先。

```typescript
import { rule } from '@aomex/common';

rule.string().trim().match(/^[a-z][a-z0-9_]{2,31}$/i);
```

メール、URL、IP を match で代用しない——専用ファクトリの OpenAPI 意味が正確。

### allowEmptyString()

**いつ使うか：** 検索ボックス空でも q=、備考に空文字を明示保存、フロント制御コンポーネント value="" と揃える。

```typescript
import { rule } from '@aomex/common';

rule.string().allowEmptyString().default('');
// '' → ''（通过）；未调用时 optional 下 '' 常当没传
```

optional() と組みつつ '' を合法値にするなら allowEmptyString() を忘れない——さもないと空文字は「未送信」に見える。

共通チェーンは [共通チェーン](../chain)；専用形態は [email](./email)、[url](./url)、[uuid](./uuid)、[ip](./ip)、[hash](./hash)。
