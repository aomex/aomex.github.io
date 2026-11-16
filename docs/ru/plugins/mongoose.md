---
outline: deep
---

# Mongoose

Боль MongoDB: **одни правила для HTTP, вторая Mongoose Schema руками** — поля расходятся при изменениях. `defineMongooseModel` строит Mongoose Schema из тех же `rule`, что и маршруты, плюс валидация `ObjectId` / `Decimal128` — здесь модель, HTTP и типы в одной цепочке.

Сложные индексы, middleware Mongoose, поля только в БД остаются в модели или `response` маршрута; мост не заменяет всю настройку Mongoose.

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

Mongo-правила нужно зарегистрировать до использования (путь входа — под ваш проект):

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

Типичные слои (это **не** middleware):

1. `models/user.ts` — `defineMongooseModel`
2. `schemas/user.schema.ts` — общие input/output schema
3. `routers/user.ts` — `body` / `response` из schema
4. `web.ts` — обычный `WebApp` + routers

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

`defineMongooseModel` возвращает обычную Mongoose Model с выводом **input/output** — при создании/запросе поля документа в подсказках. Вложенные объекты в `schemas` становятся object-валидаторами как `body({ ... })` на маршруте. `rule.mongoObjectId()` появляется на `rule` только **после** `import '@aomex/mongoose'`. `formatMongoResult` приводит результат запроса к JSON-дружелюбному виду (`_id`, `Decimal` и т.д.) — смотрите экспорты и типы пакета.

## Поля модели vs публичный DTO

| Поле / опция | Когда использовать |
| --- | --- |
| `schemas` | поле → Validator или вложенный объект |
| `indexes` | `{ fields, ...IndexOptions }[]` |
| `timestamps` / `versionKey` | Как у Mongoose SchemaOptions |
| Прочие SchemaOptions | Пробрасываются в Mongoose |
| `response({ content })` на маршруте | Публичный DTO; поля только БД не в API по умолчанию |

Не путать с [Prisma](/ru/plugins/prisma) — здесь Mongoose + Mongo, не `definePrismaSchema`.

Только модель, а на маршрутах другая форма — снова два места правок. Не `ctx.send` сырого документа Mongoose — утечут чувствительные/служебные поля; `response` или явный pick. Составные уникальные индексы, `pre` hook и т.п. — в слое модели.

## Связанное

- Свои Mongo-правила: [Пользовательские валидаторы](/ru/advanced/validator) (тот же подход, что `mongoObjectId`)
- HTTP input: [Тело запроса](/ru/web/body)
- Список валидаторов: [builtins](/ru/validators/builtins)
