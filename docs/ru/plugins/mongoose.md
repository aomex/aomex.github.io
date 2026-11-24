---
outline: deep
---

# Mongoose

Типичная боль MongoDB-проектов: **одна валидация HTTP-входа, вторая — руками в Mongoose Schema**, при смене поля плывут оба места. `defineMongooseModel` строит Mongoose Schema теми же `rule`, что и маршруты, и расширяет проверки ObjectId / Decimal128 — эта страница связывает определение модели, стыковку с HTTP и ожидания по типам.

Сложные индексы, middleware Mongoose и поля, живущие только в БД, всё равно дополняете в модели или в `response` маршрута; то, что мост не покрывает, остаётся в Mongoose.

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

Mongo-специфичные правила нужно зарегистрировать импортом пакета (путь подстройте под вход проекта):

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

Типичное разбиение (этот пакет **не** middleware):

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — общие schema входа / выхода
3. routers/user.ts — body / response ссылаются на schema или таблицу полей
4. web.ts — обычный WebApp + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '../schemas/user.schema.js';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* внешний DTO, не светите поля только из БД */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

`defineMongooseModel` возвращает стандартную Mongoose Model с выводом **входа/выхода** — при создании и запросах поля документа при наведении часто совпадают с цепочкой `rule`. Вложенные голые объекты в `schemas` автоматически сворачиваются в объектную валидацию, стиль как у `body({ ... })` на маршруте. `rule.mongoObjectId()` и т.п. появляются на `rule` только **после** `import '@aomex/mongoose'`; иначе типы и runtime разъедутся (без side-effect import регистрация не сработает). Есть ещё `formatMongoResult`: результат запроса в более JSON-дружелюбный вид (например `_id`, Decimal) — по экспорту пакета и подсказкам типов.

## Поля модели и внешний DTO

В `schemas` пишете поля → Validator (вложенные голые объекты сами становятся объектной проверкой). `indexes`, `timestamps`, `versionKey` и прочие SchemaOptions пробрасываются в Mongoose — уникальные составные индексы, pre hook и то, что валидатор не покрывает, настраиваете на уровне модели.

Снаружи не отдавайте документ Mongoose как есть через `ctx.send`: утекут чувствительные или только-DB поля. На маршруте сузьте через `response({ content })` или явный pick в DTO.

Это не сценарий [Prisma](/ru/plugins/prisma): здесь Mongoose + Mongo, не `definePrismaSchema`. Если модель определена, а маршруты всё ещё держат другой shape вручную, при смене поля снова две правки — против идеи «общие rule».

## Связанное

- Идея кастомных Mongo-правил: [Свой валидатор](/ru/advanced/validator) (тот же приём, что у mongoObjectId)
- HTTP-вход: [Тело запроса](/ru/web/body)
- Список валидаторов: [builtins](/ru/validators/builtins)
