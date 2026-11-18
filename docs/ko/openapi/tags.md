---
outline: deep
---

# 태그

OpenAPI는 **tag**로 operation을 사이드바 그룹(Swagger / Redoc 왼쪽 열)으로 나눕니다. aomex가 라우트를 스캔할 때 각 operation에 tags를 붙이며, 작성하지 않으면 기본값은 **라우트 파일 이름**(확장자 제외)입니다.

## Router에서 한 번에 태그 지정

같은 파일·같은 비즈니스 도메인의 API는 `new Router`에 한 번만 쓰면 됩니다 — 해당 파일의 모든 라우트 `docs`에 얕게 병합됩니다:

```typescript
import { Router } from '@aomex/web';

export const router = new Router({ // [!code focus:4]
  prefix: '/users',
  docs: { tags: ['User'] }, // [!code highlight]
});

router.get('/', {
  docs: { summary: '用户列表' },
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  docs: { summary: '用户详情' },
  action: async (ctx) => {
    ctx.send({ id: 1 });
  },
});
```

두 라우트 모두 문서에서 **User** 그룹 아래에 표시됩니다. 파일명이 `user.router.ts`일 때 tags를 쓰지 않으면 기본 tag는 `user.router` — 가독성이 떨어지므로 도메인별 파일에는 명시적으로 적는 것을 권장합니다.

## 단일 라우트에서 덮어쓰기·도메인 추가

메서드 수준 `docs`와 Router 수준은 **얕은 병합**(나중에 쓴 값이 이김)입니다. `summary`만 바꾸면 Router의 `tags`는 유지됩니다. 메서드에도 `tags`를 쓰면 Router의 tags를 **통째로 대체**하며 배열을 자동 병합하지 않습니다.

```typescript
export const router = new Router({
  prefix: '/orders',
  docs: { tags: ['Order'] },
});

router.get('/export', {
  docs: { // [!code focus:4]
    tags: ['Order', 'Export'], // [!code highlight]
    summary: '导出订单',
  },
  action: async (ctx) => {
    ctx.send('ok');
  },
});
```

여러 도메인에 걸친 API(주문이면서 동시에 내보내기)는 같은 `tags` 배열에 이름을 여러 개 넣으면 됩니다.

## tag 자체에 설명 추가

라우트의 `tags: ['User']`는 **이름**만 기여합니다. 문서 상단에 그룹 소개( Markdown 지원)를 붙이려면 `generateOpenapi`의 `docs.tags`에 같은 이름 항목을 선언합니다:

```typescript
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

await generateOpenapi({
  routers: './src/routers',
  app,
  docs: { // [!code focus:12]
    info: { title: 'My API', version: '1.0.0' },
    tags: [
      {
        name: 'User',
        description: '用户与资料。\n\n- 列表分页从 **1** 起\n- 详情 404 表示不存在', // [!code highlight]
      },
      { name: 'Order', description: '下单与履约' },
    ],
  },
});
```

생성이 끝나면 프레임워크가 라우트에서 쓰였지만 `docs.tags`에 아직 없는 이름을 `document.tags`에 **자동으로 보강**합니다(`name`만 있고 description은 없음). 그룹 문구나 정렬을 제어하려면 `docs.tags`에 자주 쓰는 그룹을 미리 모두 적어 두세요.

더 긴 Markdown(제목, 목록, 링크)은 [Markdown 문구](/ko/openapi/markdown)를 참고하세요.

## showInOpenapi와의 관계

특정 라우트를 계약에서 제외할 때는 `docs: { showInOpenapi: false }`를 설정합니다(예: 자체 `/openapi.json`). 해당 tags는 used 목록에 나타나지 않아 빈 그룹이 생기지 않습니다.

## 다음 단계

- [Markdown 문구](/ko/openapi/markdown): `info` / 라우트 `description`에 긴 글 쓰기
- [OpenAPI 생성](/ko/openapi/): `generateOpenapi`와 `app`
- [Swagger UI](/ko/openapi/swagger-ui) · [Redoc UI](/ko/openapi/redoc-ui): 브라우저에서 그룹 확인