---
outline: deep
---

# Mongoose

В MongoDB-проектах частая боль: **валидация HTTP и Mongoose Schema пишутся дважды**, при смене поля расходятся. defineMongooseModel строит Mongoose Schema из тех же rule, что и роуты, и расширяет проверку ObjectId / Decimal128 — эта страница связывает модель, HTTP и ожидания по типам.

Сложные индексы, middleware Mongoose, поля только в БД — дополняйте в модели или response роута; не пихайте в мост всё подряд.

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

Mongo-специфичные rule регистрируются при загрузке пакета (путь в entry — как у вас):

```typescript
import { rule } from '@aomex/common';
import '@aomex/mongoose';

rule.mongoObjectId();
rule.mongoDecimal128();
```

Типичные слои (пакет **не** middleware):

1. models/user.ts — defineMongooseModel
2. schemas/user.schema.ts — общие schema входа/выхода
3. routers/user.ts — body / response ссылаются на schema или поля
4. web.ts — обычный WebApp + routers

```typescript
import { body, response } from '@aomex/web';
import { userBodySchema } from '@/schemas/user.schema';

router.post('/users', {
  mount: [body(userBodySchema)], // [!code highlight]
  response: { content: { /* внешний DTO, без полей только БД */ } },
  action: async (ctx) => {
    await User.create(ctx.body);
    ctx.send({ ok: true });
  },
});
```

defineMongooseModel возвращает обычную Mongoose Model с выводом **ввода/вывода** — при создании и запросе поля документа в hover часто совпадают с rule-цепочкой. Вложенные голые объекты в schemas схлопываются в object validation, как `body({ ... })` на роуте. rule.mongoObjectId() и т.п. появляются на rule **после** `import '@aomex/mongoose'`; иначе типы и рантайм разъедутся (забыли side-effect import). formatMongoResult приводит результат запроса к более JSON-дружелюбному виду (_id, Decimal и т.д.) — по экспортам пакета и подсказкам типов.

## Поля модели и внешний DTO

Поля в `schemas` → Validator (вложенный голый объект → object validation). `indexes`, `timestamps`, `versionKey` и прочие SchemaOptions уходят в Mongoose — составной unique, pre hook и то, что валидатор не покрывает, остаётся в модели.

Наружу не отдавайте документ Mongoose как есть в `ctx.send` — утечут секреты и поля только БД. На роуте `response({ content })` или явный pick в DTO.

Другой сценарий, чем [Prisma](/ru/plugins/prisma): Mongoose + Mongo. Только модель через define, а на роуте другая ручная shape — правки снова в двух местах, против идеи «общие rule».

## См. также

- Свои Mongo rule: [кастомный валидатор](/ru/advanced/validator) (тот же приём, что mongoObjectId)
- Вход HTTP: [body](/ru/web/body)
- Список валидаторов: [builtins](/ru/validators/builtins)