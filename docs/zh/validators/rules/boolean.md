---
outline: deep
---

# rule.boolean()

把开关类入参收成 **boolean**：是否发布、?featured=1、JSON 里的 isAdmin。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  published: rule.boolean().default(false), // [!code highlight]
});
// ?published=1 → true；省略 → false
```

- 通过后推断为 boolean。
- 默认真/假字面量（如 'true'、1）会映射成布尔；改列表后只有列表内值才过。
- default(false) 后，没传字段时类型上仍有 boolean。

默认真值含 1 / '1' / true / 'true'，假值含 0 / '0' / false / 'false'。三态 UI（未选 / 是 / 否）别硬塞 boolean——用 optional() 或单独枚举字段。

### setTruthyValues(values: any[])

**覆盖**默认真值列表（不是追加）。

**什么时候用：** 老系统或 HTML 提交 yes / on / Y 而不是 true。

```typescript
import { rule } from '@aomex/common';

rule.boolean().setTruthyValues(['yes', 'on', 'Y', 1, true]);
// 'on' → true；覆盖后默认的 'true' 可能不再认
```

只改 setTruthyValues 却忘了改假值列表时，容易出现「关不掉」或中间态全 400。

### setFalsyValues(values: any[])

**覆盖**默认假值列表。

**什么时候用：** 与真值列表成对，对方用 no / off 表示关。

```typescript
import { rule } from '@aomex/common';

rule.boolean()
  .setTruthyValues(['yes', 'on', 1, true])
  .setFalsyValues(['no', 'off', 0, false]);
```

不在两份列表里的值直接失败；没有 strict()，松紧完全靠列表。

通用链见 [通用链式](../chain)；多档状态见 [enum](./enum)，纯文本开关名见 [string](./string)。
