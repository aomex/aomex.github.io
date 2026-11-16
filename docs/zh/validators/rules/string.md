---
outline: deep
---

# rule.string()

校验并收窄**一段可读文本**：昵称、标题、搜索词、备注。

通用链（optional / required / nullable / default / transform / docs 等）见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const nicknameSchema = schema({
  displayName: rule.string().trim().length({ min: 1, max: 32 }), // [!code highlight]
  q: rule.string().trim().optional(),
});
// body: { displayName: '  Ada  ' } → displayName 为 'Ada'
```

- 校验通过后字段推断为 string（transform 之后以 transform 返回类型为准，见 [通用链式](../chain)）。
- 默认把空串 '' 当成「没传」；和 optional() 联用时，空串往往变成 undefined。
- allowEmptyString() 之后，'' 会作为合法 string 保留。

### trim(is?: boolean)

**什么时候用：** 表单、粘贴、输入法带来的首尾空格——不 trim 会导致「看起来一样」的值对不上库。

```typescript
import { rule } from '@aomex/common';

rule.string().trim();
rule.string().trim().length({ min: 1, max: 32 });
```

### length(n | { min?, max? })

**什么时候用：** 验证码位数、密码最短长度、备注上限（按 JS 字符串 .length，UTF-16 码元）。

```typescript
import { rule } from '@aomex/common';

rule.string().length(6);
rule.string().length({ min: 8, max: 128 });
```

与 trim 联用时，长度按 **trim 之后** 计算。

### match(pattern: RegExp)

**什么时候用：** 用户名只允许字母数字下划线、固定邀请码格式。邮箱 / URL / UUID 优先专用工厂。

```typescript
import { rule } from '@aomex/common';

rule.string().trim().match(/^[a-z][a-z0-9_]{2,31}$/i);
```

邮箱、URL、IP 等别用 match 凑合——专用工厂的 OpenAPI 语义更准。

### allowEmptyString()

**什么时候用：** 搜索框清空仍传 q=、备注允许显式存空串、和前端受控组件 value="" 对齐。

```typescript
import { rule } from '@aomex/common';

rule.string().allowEmptyString().default('');
// '' → ''（通过）；未调用时 optional 下 '' 常当没传
```

需要和 optional() 联用却又要把 '' 当合法值时，别忘了 allowEmptyString()——否则空串常像「没传」。

通用链见 [通用链式](../chain)；专用形态见 [email](./email)、[url](./url)、[uuid](./uuid)、[ip](./ip)、[hash](./hash)。
