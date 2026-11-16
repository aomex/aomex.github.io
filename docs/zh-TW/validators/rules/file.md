---
outline: deep
---

# rule.file()

校驗 **multipart 上傳檔案**（`@aomex/web`）：頭像、證件照、CSV 匯入（輸出 formidable 檔案物件）。

通用鏈見 [通用鏈式](../chain)，下文只寫**本規則專屬**方法。上傳流程見 [檔案上傳](/zh-TW/web/attach)。

```typescript
import { rule } from '@aomex/web';

export const avatarField = rule.file().maxSize('2mb').mimeTypes('image/jpeg', 'image/png');
```

瀏覽器 JSON body 上傳別用 file——走 multipart 與 [檔案上傳](/zh-TW/web/attach)。

- 通過後是 formidable 檔案物件（路徑、size、mimetype 等），不是 Buffer。
- 本規則常 **無** nullable / default——以專頁與型別提示為準。
- mimeTypes + 魔數不匹配時，行為跟是否 fallbackToMimetype 有關。

### maxSize(byte: number | string)

**什麼時候用：** 防大檔案打滿磁碟；'20kb' / '2mb' 或位元組數。

```typescript
import { rule } from '@aomex/web';

rule.file().maxSize('2mb');
rule.file().maxSize(500_000);
```

### mimeTypes(...tokens | tokens[])

**什麼時候用：** 頭像只收圖片、匯入只收 CSV；有簽名時以內容為準。

```typescript
import { rule } from '@aomex/web';

rule.file().mimeTypes('.png', 'image/jpeg');
rule.file().mimeTypes(['image/*']);
rule.file().mimeTypes('.csv', 'text/csv');
```

### fallbackToMimetype(enable?: boolean)

**什麼時候用：** CSV / HTML / 純文本等沒有穩定魔數——預設 true 時退回客戶端 Content-Type 對照 mimeTypes。

```typescript
import { rule } from '@aomex/web';

rule.file()
  .mimeTypes('.html', 'text/plain', 'text/csv')
  .fallbackToMimetype();
```

臨時檔案響應結束後會清理——action 裡儘快 rename 或上傳物件儲存。

通用鏈見 [通用鏈式](../chain)；[buffer](./buffer)、[stream](./stream)。
