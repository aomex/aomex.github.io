---
outline: deep
---

# 驗證器列表

不知道用哪個 rule.xxx() 時，先來這頁**按任務指路**；選定工廠後點進專頁看專屬方法（trim、min、mimeTypes…）。所有工廠幾乎都掛 [通用鏈式](./chain)（optional、default、transform…）。

```typescript
import { rule, schema } from '@aomex/common';

export const task = schema({
  email: rule.email(),
  page: rule.int().min(1).default(1),
  avatar: rule.file(), // Web 上传见 @aomex/web
});
```

三個欄位覆蓋大半日常：**標識**、**分頁整數**、**檔案**——其餘按下面任務表對號入座。

- 每個 rule.xxx() 工廠推斷出不同的鏈式型別；專頁方法和通用鏈是否可用，以編輯器補全為準。
- rule.file() 只在 `@aomex/web` 專案裡註冊；Console 純 Node 入口一般沒有這條。
- 組合類（oneOf、array…）的 Infer 是巢狀或聯合型別，見 [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of)。
- 沒有現成工廠時走 [自定義驗證器](/zh-TW/advanced/validator)，別用 rule.any() 糊整個 API。

分頁常用 default(1)，PATCH 常用 optional / [partial](./schema)——鏈式選項見 [通用鏈式](./chain)。

## 按任務找工廠

| 你要做… | 先去 || --- | --- |
| 使用者名稱、備註、搜尋詞 | [`rule.string()`](./rules/string) |
| 分頁、數量、自增 id | [`rule.int()`](./rules/int) |
| 金額、比率（小數） | [`rule.decimal()`](./rules/decimal) 或 [`rule.number()`](./rules/number) |
| 開關、是否同意協議 | [`rule.boolean()`](./rules/boolean) |
| 註冊郵箱、登入賬號 | [`rule.email()`](./rules/email) |
| 回撥 URL、跳轉連結 | [`rule.url()`](./rules/url) |
| 資源 id（UUID / ULID） | [`rule.uuid()`](./rules/uuid) · [`rule.ulid()`](./rules/ulid) |
| 生效時間、預約時段 | [`rule.date()`](./rules/date) |
| 固定列舉（角色、狀態） | [`rule.enum()`](./rules/enum) · [`rule.literal()`](./rules/literal) |
| JSON body 巢狀物件 | [`rule.object()`](./rules/object) 或欄位表字面量 |
| 標籤列表、批次 id | [`rule.array()`](./rules/array) |
| 動態鍵配置袋 | [`rule.record()`](./rules/record) |
| 支付方式 / Webhook 多形態 | [`rule.oneOf()`](./rules/one-of) · [`rule.anyOf()`](./rules/any-of) |
| 頭像、附件 multipart | [`rule.file()`](./rules/file) + [檔案上傳](/zh-TW/web/attach) |
| 大整數、雜湊串、IP | [`rule.bigint()`](./rules/bigint) · [`rule.hash()`](./rules/hash) · [`rule.ip()`](./rules/ip) |
| Buffer / 流式欄位 | [`rule.buffer()`](./rules/buffer) · [`rule.stream()`](./rules/stream) |
| 實在不想約束（過渡） | [`rule.any()`](./rules/any)（別長期留在對外 API） |

### 索引：工廠分組（備查）

**文本與數字：** [string](./rules/string) · [number](./rules/number) · [int](./rules/int) · [bigint](./rules/bigint) · [decimal](./rules/decimal) · [boolean](./rules/boolean)

**時間與標識：** [date](./rules/date) · [email](./rules/email) · [url](./rules/url) · [uuid](./rules/uuid) · [ulid](./rules/ulid) · [ip](./rules/ip) · [hash](./rules/hash)

**列舉與字面量：** [enum](./rules/enum) · [literal](./rules/literal)

**結構：** [object](./rules/object) · [record](./rules/record) · [array](./rules/array) · [buffer](./rules/buffer) · [stream](./rules/stream)

**組合：** [oneOf](./rules/one-of) · [anyOf](./rules/any-of) · [allOf](./rules/all-of) · [any](./rules/any)

**Web：** [file](./rules/file)

郵箱別用 string().match 冒充——[email](./rules/email) 更省事，OpenAPI 也更準。對外資源 id 該 [uuid](./rules/uuid) 就別裸 string()。金額、餘額精度敏感用 [decimal](./rules/decimal)，別 [number](./rules/number) 裸奔。

::: warning
一個接口裡全是 rule.any() 只適合臨時聯調，儘快換成具體形狀。
:::

## 下一步

- [通用鏈式](./chain)
- [schema](./schema)
- [快速上手](/zh-TW/validators/)（若你是第一次搭驗證器）