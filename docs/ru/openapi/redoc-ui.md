---
outline: deep
---

# Redoc UI

Для продукта и интеграторов — **удобное длинное чтение**: левое меню, свёрнутые schema, спокойнее Swagger. Redoc **не дергает API в странице** — интеграция через [Swagger UI](/ru/openapi/swagger-ui), [Scalar UI](/ru/openapi/scalar-ui) или свой клиент. Несколько UI на одном сайте можно, **префиксы роутов не должны совпадать**.

Сначала [официальное демо](https://redocly.github.io/redoc/). Источник контракта: [Генерация OpenAPI](/ru/openapi/).

```bash
pnpm add @aomex/redoc-ui
```

Повесь `redocUI` в mount — команда открывает `/redoc` (по умолчанию) и читает тот же OpenAPI (путь к JSON или YAML).

## Рядом со Swagger — разные префиксы

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

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

Если нужен Swagger рядом:

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc **не умеет пробу в странице**; не подсовывайте QA его вместо Swagger. При нескольких UI разведите `uriPrefix` и лучше добавьте **случайную строку** (например `/redoc-7c3e9a1f02b48d6e`), чтобы снизить риск после сканирования — подробнее в [Swagger UI](/ru/openapi/swagger-ui).
:::

Как у Swagger UI: `redocUI` — middleware-конфиг, типы `ctx` на бизнес-роутах не меняет. `openapi` — строка-путь или функция с асинхронным `Document`; в функции опции `generateOpenapi` те же, что в [Генерация OpenAPI](/ru/openapi/).

Доступ, `uriPrefix` (в т.ч. случайная строка), `enable` — **та же идея**, что у Swagger / Scalar; точные поля смотри в типах пакета.

```typescript
redocUI({
  openapi: './openapi.json',
  uriPrefix: '/redoc-7c3e9a1f02b48d6e',
});
```

Сравнение, совместная работа и сценарии — [Какой docs UI выбрать](/ru/openapi/choose-ui). Неверный путь к `openapi.yaml` или файл не скопирован при сборке — 404; при контракте с диска после смены роутов снова [Генерация OpenAPI](/ru/openapi/).

## Связанное

- [Какой docs UI выбрать](/ru/openapi/choose-ui)
- [Swagger UI](/ru/openapi/swagger-ui) · [Scalar UI](/ru/openapi/scalar-ui)
- [Генерация OpenAPI](/ru/openapi/)