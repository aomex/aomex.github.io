---
outline: deep
---

# 验证器列表

不知道用哪个 rule.xxx() 时，先来这页**按任务指路**；选定工厂后点进专页看专属方法（trim、min、mimeTypes…）。所有工厂几乎都挂 [通用链式](./chain)（optional、default、transform…）。

```typescript
import { rule, schema } from '@aomex/common';

export const task = schema({
  email: rule.email(),
  page: rule.int().min(1).default(1),
  avatar: rule.file(), // Web 上传见 @aomex/web
});
```

三个字段覆盖大半日常：**标识**、**分页整数**、**文件**——其余按下面任务表对号入座。

- 每个 rule.xxx() 工厂推断出不同的链式类型；专页方法和通用链是否可用，以编辑器补全为准。
- rule.file() 只在 `@aomex/web` 项目里注册；Console 纯 Node 入口一般没有这条。
- 组合类（oneOf、array…）的 Infer 是嵌套或联合类型，见 [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)。
- 没有现成工厂时走 [自定义验证器](/zh/advanced/validator)，别用 rule.any() 糊整个 API。

分页常用 default(1)，PATCH 常用 optional / [partial](./schema)——链式选项见 [通用链式](./chain)。

## 按任务找工厂

| 你要做… | 先去 || --- | --- |
| 用户名、备注、搜索词 | [`rule.string()`](./rules/string) |
| 分页、数量、自增 id | [`rule.int()`](./rules/int) |
| 金额、比率（小数） | [`rule.decimal()`](./rules/decimal) 或 [`rule.number()`](./rules/number) |
| 开关、是否同意协议 | [`rule.boolean()`](./rules/boolean) |
| 注册邮箱、登录账号 | [`rule.email()`](./rules/email) |
| 回调 URL、跳转链接 | [`rule.url()`](./rules/url) |
| 资源 id（UUID / ULID） | [`rule.uuid()`](./rules/uuid) · [`rule.ulid()`](./rules/ulid) |
| 生效时间、预约时段 | [`rule.date()`](./rules/date) |
| 固定枚举（角色、状态） | [`rule.enum()`](./rules/enum) · [`rule.literal()`](./rules/literal) |
| JSON body 嵌套对象 | [`rule.object()`](./rules/object) 或字段表字面量 |
| 标签列表、批量 id | [`rule.array()`](./rules/array) |
| 动态键配置袋 | [`rule.record()`](./rules/record) |
| 支付方式 / Webhook 多形态 | [`rule.oneOf()`](./rules/one-of) · [`rule.anyOf()`](./rules/any-of) |
| 头像、附件 multipart | [`rule.file()`](./rules/file) + [文件上传](/zh/web/attach) |
| 大整数、哈希串、IP | [`rule.bigint()`](./rules/bigint) · [`rule.hash()`](./rules/hash) · [`rule.ip()`](./rules/ip) |
| Buffer / 流式字段 | [`rule.buffer()`](./rules/buffer) · [`rule.stream()`](./rules/stream) |
| 实在不想约束（过渡） | [`rule.any()`](./rules/any)（别长期留在对外 API） |

### 索引：工厂分组（备查）

**文本与数字：** [string](./rules/string) · [number](./rules/number) · [int](./rules/int) · [bigint](./rules/bigint) · [decimal](./rules/decimal) · [boolean](./rules/boolean)

**时间与标识：** [date](./rules/date) · [email](./rules/email) · [url](./rules/url) · [uuid](./rules/uuid) · [ulid](./rules/ulid) · [ip](./rules/ip) · [hash](./rules/hash)

**枚举与字面量：** [enum](./rules/enum) · [literal](./rules/literal)

**结构：** [object](./rules/object) · [record](./rules/record) · [array](./rules/array) · [buffer](./rules/buffer) · [stream](./rules/stream)

**组合：** [oneOf](./rules/one-of) · [anyOf](./rules/any-of) · [allOf](./rules/all-of) · [any](./rules/any)

**Web：** [file](./rules/file)

邮箱别用 string().match 冒充——[email](./rules/email) 更省事，OpenAPI 也更准。对外资源 id 该 [uuid](./rules/uuid) 就别裸 string()。金额、余额精度敏感用 [decimal](./rules/decimal)，别 [number](./rules/number) 裸奔。

::: warning
一个接口里全是 rule.any() 只适合临时联调，尽快换成具体形状。
:::

## 下一步

- [通用链式](./chain)
- [schema](./schema)
- [快速上手](/zh/validators/)（若你是第一次搭验证器）