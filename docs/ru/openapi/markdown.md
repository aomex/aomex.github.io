---
outline: deep
---

# Markdown-тексты

Многие поля **description** в OpenAPI рендерятся по **CommonMark** (и Swagger UI, и Redoc парсят разметку). aomex не вводит свой синтаксис: вы пишете Markdown в строках, после генерации Document его показывает docs UI.

Подходит для: контекста API, описания auth, соглашений о пагинации, таблиц кодов ошибок. `summary` по-прежнему лучше держать **одной короткой строкой** — в боковой панели и в списках видна в основном она.

## В generateOpenapi

Общее описание сервиса — в `docs.info.description`; описание группы — в `docs.tags[].description` (имя tag должно совпадать с маршрутом, см. [Теги](/ru/openapi/tags)).

```typescript
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

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

Переносы строк в шаблонных литералах попадают в Document; таблицы, заголовки, жирный текст и инлайн-код в Redoc обычно читаются лучше, чем в Swagger. Ссылки — обычный Markdown.

::: tip
Запись из Console (`openapi()` / `aomex openapi`) принимает те же `docs` и те же поля; результат только пишется в файл.
:::

## На маршрутах

Длинное описание одной operation — в `docs.description` на уровне метода; `summary` — короткая фраза для списка. На Router можно задать `deprecated` и другое — с методом сливается поверхностно.

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

В `response({ description })` и в `rule.*.docs({ description })` на валидаторах тоже можно писать короткий Markdown (в описании параметров сложные таблицы лучше не раздувать — места в боковой панели мало).

```typescript
query({
  page: rule.int().min(1).default(1).docs({
    description: '页码，从 **1** 起', // [!code highlight]
  }),
}),
```

## На что смотреть при написании

| Сценарий | Рекомендация |
| --- | --- |
| Заголовок в боковой панели | `summary`, без переносов строк |
| Описание операции / пример запроса | `docs.description` |
| Общие правила сервиса | `generateOpenapi` → `docs.info.description` |
| Вводный текст группы | `docs.tags[].description` |
| Блоки кода | в шаблонной строке — \`\`\`; если конфликтует с внешним TypeScript fence, можно отступный блок |

После правок снова запустите `generateOpenapi` или обновите динамический Swagger / Redoc, чтобы увидеть рендер. В режиме статического `openapi.json` ещё раз выполните [Генерация OpenAPI](/ru/openapi/).

## Связанное

- [Теги](/ru/openapi/tags): откуда берутся имена и как переопределить
- [Генерация OpenAPI](/ru/openapi/): сканирование маршрутов и передача `app`
- [Swagger UI](/ru/openapi/swagger-ui) · [Redoc UI](/ru/openapi/redoc-ui): предпросмотр Markdown