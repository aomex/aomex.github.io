---
outline: deep
---

# Markdown 문구

OpenAPI의 여러 **description** 필드는 **CommonMark**로 렌더됩니다(Swagger UI / Redoc 모두 파싱). aomex는 별도 문법을 만들지 않습니다 — 문자열에 Markdown을 쓰면 Document에 들어가고 문서 사이트가 표시합니다.

적합한 내용: API 배경, 인증 설명, 페이징 규칙, 오류 코드 표. `summary`는 **한 줄 짧은 제목**을 유지하는 것이 좋습니다 — 사이드바와 목록은 주로 이것을 봅니다.

## generateOpenapi에서 작성

전체 사이트 설명은 `docs.info.description`에, 그룹 설명은 `docs.tags[].description`에 둡니다(라우트 tag 이름과 대응, [태그](/ko/openapi/tags) 참고).

```typescript
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

await generateOpenapi({
  routers: './src/routers',
  app,
  docs: { // [!code focus:18]
    info: {
      title: 'My API',
      version: '1.0.0',
      description: `
面向内部服务的 HTTP API。

## 鉴权

除标注为公开的接口外，请带 \`Authorization: Bearer <token>\`。

## 约定

| 项 | 说明 |
| --- | --- |
| 分页 | \`page\` 从 **1** 起 |
| 时间 | ISO-8601，UTC |
`, // [!code highlight]
    },
    tags: [
      {
        name: 'User',
        description: '用户域。\n\n详见 [用户模型](https://wiki.example.com/user)。',
      },
    ],
  },
});
```

템플릿 리터럴의 줄바꿈은 Document에 그대로 들어갑니다. 표, 제목, 굵게, 인라인 코드는 Redoc에서 보통 Swagger보다 읽기 쉽습니다. 링크는 일반 Markdown 링크면 됩니다.

::: tip
Console 내보내기(`openapi()` / `aomex openapi`)도 같은 `docs`를 받으며 필드는 여기와 같고, 결과만 파일로 씁니다.
:::

## 라우트에서 작성

단일 operation의 긴 설명은 메서드 수준 `docs.description`에, 목록용 짧은 문장은 `summary`에 둡니다. Router 수준에도 `deprecated` 등을 쓸 수 있으며 메서드와 얕게 병합됩니다.

```typescript
import { response, Router } from '@aomex/web';
import { rule } from '@aomex/common';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/:id', { // [!code focus:22]
  docs: {
    summary: '用户详情',
    description: `
按主键取用户。

- 存在 → **200** + 用户对象
- 不存在 → **404**（见全局错误格式）

\`\`\`
GET /users/42
\`\`\`
`, // [!code highlight]
  },
  mount: [
    response({
      statusCode: 200,
      description: '找到用户；body 为资料字段',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '用户不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

`response({ description })`와 검증기의 `rule.*.docs({ description })`에도 짧은 Markdown을 쓸 수 있습니다(파라미터 설명에 복잡한 표는 피하세요 — 사이드바 공간이 제한적입니다).

```typescript
query({
  page: rule.int().min(1).default(1).docs({
    description: '页码，从 **1** 起', // [!code highlight]
  }),
}),
```

## 작성 시 참고

| 상황 | 권장 |
| --- | --- |
| 사이드바 제목 | `summary` 사용, 줄바꿈 넣지 않기 |
| operation 설명 / 요청 예시 | `docs.description` |
| 전역 규칙 | `generateOpenapi` → `docs.info.description` |
| 그룹 안내 | `docs.tags[].description` |
| 코드 펜스 | 템플릿 리터럴 안에 \`\`\` 작성; 바깥 TypeScript fence와 겹치면 들여쓰기 코드 블록 사용 |

문구를 바꾼 뒤 `generateOpenapi`를 다시 실행하거나 동적 Swagger / Redoc을 새로고침해야 렌더 결과를 볼 수 있습니다. 정적 `openapi.json` 모드에서는 [OpenAPI 생성](/ko/openapi/) 절차를 한 번 더 실행하세요.

## 다음 단계

- [태그](/ko/openapi/tags): 이름 출처, 덮어쓰기
- [OpenAPI 생성](/ko/openapi/): 라우트 스캔과 `app` 전달
- [Swagger UI](/ko/openapi/swagger-ui) · [Redoc UI](/ko/openapi/redoc-ui): Markdown 미리보기