---
outline: deep
---

# 파일 업로드

아바타나 첨부 파일이 있는 multipart API를 만들 때, `body()` 안에서 파일 필드를 [rule.file()](/ko/validators/rules/file)로 표시합니다. 통과 후 `ctx.body`에서 임시 경로와 MD5를 가져와 이 요청이 끝나기 전에 옮기면 됩니다(OSS, 로컬 저장소 모두 가능). `body()` 없이는 multipart 파일을 파싱하지 않습니다.

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

클라이언트는 multipart/form-data를 씁니다. name은 일반 필드이고 avatar는 파일 part입니다. 흔히 action에서 바로 업로드하거나 복사한 뒤 응답하는데, 응답이 끝나면 임시 파일은 정리됩니다.

avatar 검증이 통과하면 대략 filepath, size, mimetype, hash, hashAlgorithm, originalFilename이 있고, 업무에서는 filepath와 hash를 가장 많이 씁니다. `rule.array(rule.file())`일 때 `ctx.body.attachments`는 파일 객체 배열입니다.

::: warning
201을 반환하기 전에 파일을 옮기거나 업로드하지 않으면, 임시 경로는 다음에도 읽을 수 있다고 보장되지 않습니다.
:::

## 크기와 MIME

단일 필드 `rule.file().maxSize()` / `.mimeTypes()`는 **검증 단계**에서 너무 크거나 타입이 맞지 않는 업로드를 막아, action에 들어가 판단하는 것보다 IO를 한 번 덜 씁니다. 앱 수준 `formData`와 겹치면 더 엄격한 쪽을 따르고, 라우트만 바꿀 때 413은 양쪽 설정을 함께 확인하세요.

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

`rule.file().maxSize('2mb')`는 해당 필드만 좁힙니다. 앱 수준 formData.maxFileSize와 겹치면 **더 엄격한 쪽을 따릅니다**.

매직 넘버가 불안정할 때 MIME으로 되돌립니다:

```typescript
rule.file().mimeTypes('image/svg+xml').fallbackToMimetype(),
```

::: warning
공개 아바타에는 함부로 fallbackToMimetype()를 쓰지 마세요. 클라이언트가 보낸 Content-Type을 더 믿게 되며, 내부망 등 통제 가능한 환경에만 맞습니다.
:::

## 한 필드에 여러 파일

HTML 폼에서 같은 name의 input으로 여러 part를 보낼 수 있고, `rule.array(rule.file())`가 이를 배열로 모읍니다. `.length({ max: n })`로 한 요청당 개수를 제한해 한 번에 너무 많은 대용량 파일을 넣지 않도록 합니다.

```typescript
body({
  attachments: rule.array(rule.file().maxSize('10mb')).length({ max: 5 }),
});
```

한 요청에 여러 파일 필드가 있으면 총 개수는 앱 수준 formData.maxFiles에도 막히며, 라우트 수준 할당과 함께 더 엄격한 쪽을 따릅니다.

## WebApp.formData 할당량

파일 파싱은 두 층입니다. **WebApp.body.formData**가 사이트 전역 기본(단일 파일 크기, 총 part 수)을 두고, 라우트의 `rule.file()`이 특정 필드를 더 좁힙니다. 한 층만 바꿨을 때 413이 나오면 앱이 막았는지 필드 규칙이 막았는지 확인하세요.

| 층 | 흔한 사용법 |
| --- | --- |
| `WebApp.body.formData` | 사이트 전역 상한. 대용량 파일 사이트는 여기를 먼저 조정 |
| `body()` + schema | schema에 적은 필드만 파싱 |
| `rule.file()` | 단일 필드 업무 규칙(MIME, 크기) |

```typescript
new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    formData: { maxFileSize: '20mb', maxFiles: 10 }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

대용량 파일은 메모리 전체가 아니라 디스크 임시 디렉터리로 가므로 객체 스토리지로 스트리밍 업로드하기 쉽습니다. 라우트에서 maxSize만 바꿀 때는 앱 수준 formData와 대조하고, 413은 두 층 모두 확인하세요.

중첩 객체에 `rule.file()`을 넣으면 multipart의 평탄한 필드명과 맞지 않는 경우가 많습니다. 복잡한 구조는 클라이언트가 어떻게 보내는지 먼저 맞추세요.

::: warning
mimeTypes에 인식할 수 없는 토큰이 있으면 설정 단계에서 바로 오류가 납니다. 조용히 모든 타입을 허용하는 일을 막습니다.
:::

## 다음 단계

- [요청 본문](/ko/web/body)(multipart 화이트리스트, 생성과 PATCH)
- [rule.file()](/ko/validators/rules/file)(필드 수준 전용 옵션)
- [Web 앱 진입점](/ko/web/)(body.formData 전역 할당량)
