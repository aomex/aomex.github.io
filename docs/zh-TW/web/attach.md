---
outline: deep
---

# 檔案上傳

做一個帶頭像或附件的 multipart 介面：在 body() 裡把檔案欄位標成 [rule.file()](/zh-TW/validators/rules/file)，過關後從 ctx.body 拿臨時路徑和 MD5，在本輪請求結束前搬走（OSS、本地儲存都行）。沒掛 body() 的 multipart 不會幫你解析檔案。

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      name: rule.string(),
      avatar: rule.file(),
    }),
  ],
  action: async (ctx) => {
    const { name, avatar } = ctx.body;
    await saveAvatarToOss(avatar.filepath, avatar.hash);
    ctx.send(201, { name, hash: avatar.hash });
  },
});
```

客戶端用 multipart/form-data：name 普通欄位，avatar 是檔案 part。常見做法是會在 action 裡立刻上傳或複製，再返回——響應結束後臨時檔案會被清掉。

avatar 校驗通過後大致有 filepath、size、mimetype、hash、hashAlgorithm、originalFilename；業務裡最常用 filepath 和 hash。`rule.array(rule.file())` 時 ctx.body.attachments 是檔案物件陣列。

::: warning
返回 201 之前還沒把檔案搬走或上傳完，臨時路徑不保證下一輪還能讀。
:::

## 體積與 MIME

單欄位 `rule.file().maxSize()` / `.mimeTypes()` 在**校驗階段**攔住超大或型別不對的上傳，比進 action 再判省一輪 IO。和應用級 `formData` 疊用時取更嚴的一側；只改路由要記得兩邊一起看 413。

```typescript
body({
  avatar: rule.file().maxSize('2mb'),
});
```

```typescript
body({
  avatar: rule.file().mimeTypes('.png', 'image/*'),
});
```

`rule.file().maxSize('2mb')` 只收窄該欄位；和應用級 formData.maxFileSize 疊在一起時，**誰更嚴聽誰的**。

魔數不穩時退回 MIME：

```typescript
rule.file().mimeTypes('image/svg+xml').fallbackToMimetype(),
```

::: warning
公網頭像別輕易 fallbackToMimetype()——更信客戶端報的 Content-Type，只適合內網等可控場景。
:::

## 多檔案同一欄位

HTML 表單裡同名 input 可傳多個 part，`rule.array(rule.file())` 把它們收成陣列。用 `.length({ max: n })` 限制單次請求個數，避免一次塞進過多大檔案。

```typescript
body({
  attachments: rule.array(rule.file().maxSize('10mb')).length({ max: 5 }),
});
```

同一請求裡多個檔案欄位時，總個數還會受應用級 formData.maxFiles 約束，和路由級配額一起取更嚴。

## 與 WebApp.formData 配額

檔案解析分兩層：**WebApp.body.formData** 設全站預設（單檔案體積、總 part 數），路由裡 `rule.file()` 再收窄某個欄位。只改一層出現 413 時，要查是應用頂住了還是欄位規則頂住了。

| 層 | 常見做法是怎麼用 |
| --- | --- |
| `WebApp.body.formData` | 全站預設上限，大檔案站點先調這裡 |
| `body()` + schema | 只解析 schema 裡點名的欄位 |
| `rule.file()` | 單欄位業務規則（MIME、體積） |

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    formData: { maxFileSize: '20mb', maxFiles: 10 }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

大檔案走磁碟臨時目錄而不是整坨進記憶體，方便你流式上傳到物件儲存。路由裡只改 maxSize 時記得對照應用級 formData，413 要兩層都查。

巢狀物件裡塞 `rule.file()` 常對不上 multipart 的平鋪欄位名，複雜結構要先對齊客戶端怎麼傳。

::: warning
mimeTypes 裡無法識別的 token 會在配置階段就報錯，省得 silently 放開全部型別。
:::

## 下一步

- [請求實體](/zh-TW/web/body)（multipart 白名單、建立與 PATCH）
- [rule.file()](/zh-TW/validators/rules/file)（欄位級專屬選項）
- [Web 應用入口](/zh-TW/web/)（body.formData 全域性配額）