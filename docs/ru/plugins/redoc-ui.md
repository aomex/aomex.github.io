---
outline: deep
---

# Redoc UI

**Длинная, удобная для чтения** справка по API для продукта и интеграторов: навигация слева, свёрнутые schema — спокойнее, чем Swagger. Redoc **не вызывает API со страницы** — для проверок [Swagger UI](/ru/plugins/swagger-ui) или свой клиент. Оба UI можно на одном сайте; **разные uriPrefix**.

Источник контракта: [Генерация OpenAPI](/ru/plugins/openapi) · [Экспорт OpenAPI](/ru/console/openapi).

```bash
pnpm add @aomex/redoc-ui
```

Повесьте `redocUI` в `mount`; команда открывает `/redoc` (по умолчанию) и читает тот же OpenAPI (путь к JSON или YAML).

## Отдельный префикс от Swagger

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // 或与 Swagger 一样用函数：
    // openapi: () => {
    //   return generateOpenapi({
    //     routers: './src/routers',
    //     app,
    //   });
    // },
  }),
  routers('./src/routers'),
],
```

Вместе со Swagger:

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc **не дергает API в браузере**; не подменяйте им Swagger в QA. При двух UI разделите `uriPrefix` (например `/redoc` и `/swagger`).
:::

Как Swagger UI: `redocUI` — middleware-конфиг; типы бизнес-маршрутов на `ctx` не меняет. `openapi` — путь к файлу или async-функция с `Document`; вариант с функцией совпадает с опциями [генерации OpenAPI](/ru/plugins/openapi).

`enable`, `uriPrefix`, доступ и т.п. — **та же идея, что у Swagger**; точные поля смотрите в типах пакета.

## Redoc vs Swagger

| Ситуация | Рекомендация |
| --- | --- |
| PDF / передача документации | Redoc читабельнее; экспорт контракта + стабильный URL |
| Самопроверка и вызовы API | Добавьте Swagger UI или Postman |
| Контракт часто меняется | `openapi: () => generateOpenapi(...)`, или CI-экспорт и один файл на оба UI |
| Доступ в проде | Как у Swagger — `enable`, внутренняя сеть, auth на шлюзе |

Неверный путь к `openapi.yaml` или файл не скопирован в билд → 404. При файловом контракте после смены маршрутов снова запускайте [экспорт OpenAPI](/ru/console/openapi).

## Связанное

- [Swagger UI](/ru/plugins/swagger-ui)
- [Генерация OpenAPI](/ru/plugins/openapi)
- [Экспорт OpenAPI](/ru/console/openapi)
