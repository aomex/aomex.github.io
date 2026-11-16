---
outline: deep
---

# Mongoose

MongoDB에서 흔한 문제: **HTTP용 검증기와 손으로 쓴 Mongoose Schema**가 따로 놀며 필드가 어긋납니다. `defineMongooseModel`은 라우트와 같은 `rule`로 Mongoose Schema를 만들고 `ObjectId` / `Decimal128` 검증을 확장합니다. 이 페이지는 모델 정의·HTTP·타입을 잇습니다.

복잡한 인덱스, Mongoose 미들웨어, DB 전용 필드는 모델이나 라우트 `response`에 남깁니다. 브리지가 Mongoose 설정 전부를 대체하지는 않습니다.

## defineMongooseModel

```bash
pnpm add @aomex/mongoose mongoose
```

```typescript
import { rule } from '@aomex/common';
import { defineMongooseModel } from '@aomex/mongoose';

export const User = defineMongooseModel('users', { // [!code highlight]
  schemas: {
    name: rule.string(),
    email: rule.email(),
    profile: {
      bio: rule.string().optional(),
    },
  },
  timestamps: true,
  indexes: [{ fields: { email: 1 }, unique: true }],
});
```

사용 전 Mongo 규칙 로드(엔트리 경로 조정):

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

전형적인 층(미들웨어 아님):

1. `models/user.ts` — `defineMongooseModel`
2. `schemas/user.schema.ts` — 공유 input/output 스키마
3. `routers/user.ts` — 스키마의 `body` / `response`
4. `web.ts` — 일반 `WebApp` + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '../schemas/user.schema.js';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* 对外 DTO，别默认泄露仅 DB 字段 */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

`defineMongooseModel`은 표준 Mongoose Model을 반환하며 **input/output** 추론이 있습니다. 생성·조회 시 문서 필드에 호버하세요. `schemas`의 중첩 객체는 라우트 `body({ ... })`처럼 객체 검증기가 됩니다. `rule.mongoObjectId()` 등은 `import '@aomex/mongoose'` **이후** `rule`에 나타납니다. `formatMongoResult`는 JSON용 조회 결과를 정리합니다(`_id`, `Decimal` 등)—패키지 export와 타입을 따르세요.

## 모델 필드 vs 공개 DTO

| 필드 / 옵션 | 언제 쓰나 |
| --- | --- |
| `schemas` | 필드 → Validator 또는 중첩 객체 |
| `indexes` | `{ fields, ...IndexOptions }[]` |
| `timestamps` / `versionKey` | Mongoose SchemaOptions와 동일 |
| 기타 SchemaOptions | Mongoose로 전달 |
| 라우트 `response({ content })` | 공개 DTO; DB 전용 필드는 기본으로 API에 없음 |

[Prisma](/ko/plugins/prisma)와 다릅니다—Mongoose + Mongo, `definePrismaSchema`가 아님.

모델만 정의하고 라우트에 다른 shape을 손으로 쓰면 공유 `rule` 의미가 없습니다. Mongoose 문서를 그대로 `ctx.send` 하지 마세요—민감/DB 필드가 새어 나갑니다. `response`나 명시적 pick을 쓰세요. 복합 유니크 인덱스, `pre` 훅 등은 모델에 둡니다.

## 관련

- 커스텀 Mongo 규칙: [커스텀 검증기](/ko/advanced/validator) (`mongoObjectId` 동일 패턴)
- HTTP 입력: [요청 본문](/ko/web/body)
- 검증기 목록: [내장](/ko/validators/builtins)