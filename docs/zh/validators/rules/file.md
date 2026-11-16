---
outline: deep
---

# rule.file()

校验 **multipart 上传文件**（`@aomex/web`）：头像、证件照、CSV 导入（输出 formidable 文件对象）。

通用链见 [通用链式](../chain)，下文只写**本规则专属**方法。上传流程见 [文件上传](/zh/web/attach)。

```typescript
import { rule } from '@aomex/web';

export const avatarField = rule.file().maxSize('2mb').mimeTypes('image/jpeg', 'image/png');
```

浏览器 JSON body 上传别用 file——走 multipart 与 [文件上传](/zh/web/attach)。

- 通过后是 formidable 文件对象（路径、size、mimetype 等），不是 Buffer。
- 本规则常 **无** nullable / default——以专页与类型提示为准。
- mimeTypes + 魔数不匹配时，行为跟是否 fallbackToMimetype 有关。

### maxSize(byte: number | string)

**什么时候用：** 防大文件打满磁盘；'20kb' / '2mb' 或字节数。

```typescript
import { rule } from '@aomex/web';

rule.file().maxSize('2mb');
rule.file().maxSize(500_000);
```

### mimeTypes(...tokens | tokens[])

**什么时候用：** 头像只收图片、导入只收 CSV；有签名时以内容为准。

```typescript
import { rule } from '@aomex/web';

rule.file().mimeTypes('.png', 'image/jpeg');
rule.file().mimeTypes(['image/*']);
rule.file().mimeTypes('.csv', 'text/csv');
```

### fallbackToMimetype(enable?: boolean)

**什么时候用：** CSV / HTML / 纯文本等没有稳定魔数——默认 true 时退回客户端 Content-Type 对照 mimeTypes。

```typescript
import { rule } from '@aomex/web';

rule.file()
  .mimeTypes('.html', 'text/plain', 'text/csv')
  .fallbackToMimetype();
```

临时文件响应结束后会清理——action 里尽快 rename 或上传对象存储。

通用链见 [通用链式](../chain)；[buffer](./buffer)、[stream](./stream)。
