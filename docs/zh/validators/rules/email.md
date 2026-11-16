---
outline: deep
---

# rule.email()

校验 **邮箱形态字符串**：注册账号、通知收件人、邀请邮件（只验格式，不验邮箱是否存在）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。

```typescript
import { rule, schema } from '@aomex/common';

export const registerSchema = schema({
  email: rule.email().required(), // [!code highlight]
});
// { email: 'ada@example.com' } → 通过；'ada@' → 失败
```

- 通过后推断为 string；OpenAPI 侧往往会标成 email 格式。
- 与 trim / 长度无专属链——需要时在 [transform](../chain) 或业务侧处理。

任何「必须是邮箱」的字段用本工厂，别 string().match 冒充。登录名「邮箱或工号」用 [anyOf](./any-of)。

### match(pattern: RegExp)

**什么时候用：** 企业注册只允许公司域、内测白名单后缀（在邮箱格式通过之后再叠正则）。

```typescript
import { rule } from '@aomex/common';

rule.email().match(/@acme\.com$/i);
// 'ada@acme.com' → 通过；'ada@gmail.com' → 格式过、match 失败
```

match 只叠格式约束，不能替代「验证码已发」——投递成功与否在业务层。

通用链见 [通用链式](../chain)；[string](./string)、[url](./url)、[anyOf](./any-of)。
