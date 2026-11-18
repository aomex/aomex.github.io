---
outline: deep
---

# Быстрая установка

Поднимите работающий проект aomex с нуля: возможен доступ к HTTP, а терминал также может запускать команды. Scaffolding предоставляет обязательные поля, такие как журнал/язык/выключение, что проще, чем настраивать с пустыми руками.

```bash
npx create-aomex@latest
cd your-project
pnpm install
pnpm start
```

::: окружающая среда подсказки
**Node.js ≥ 24** (сначала узел -v). **pnpm** — самый удобный менеджер пакетов; Обычно можно использовать npm/пряжа.
:::

Встав, откройте проверку работоспособности или домашнюю страницу браузера (см. ПОРТ шаблона порта). Сторона терминала:

```bash
pnpm aomex -h
```

## Структура каталогов

Шаблон выглядит примерно так (версия чуть подправит детали). Три линии: `src/web.ts` поднимает HTTP, `src/cli.ts` — терминал / Cron / экспорт OpenAPI; `src/routers/` и `src/commanders/` — API и CLI-команды; переиспользуемые middleware (аутентификация, formatError, access log, Swagger и т.д.) лежат в `src/middleware/` и подключаются в `web.ts` или в mount маршрута; БД и кэш — в `src/services/`, **общие для Web и Console**.

| Файл / каталог | Зачем трогать |
| --- | --- |
| `src/web.ts` | Запуск HTTP |
| `src/cli.ts` | CLI / Cron / экспорт OpenAPI в файл |
| `src/routers/` | HTTP-маршруты |
| `src/commanders/` | CLI-команды |
| `src/middleware/` | Переиспользуемые middleware: аутентификация, formatError, access log, Swagger — смонтировать в `web.ts` или mount маршрута |
| `src/services/` | БД, кэш, почта — бизнес-SQL не в `action` маршрута |
| `src/schemas/` | Общие валидаторы, файлы `xxx.schema.ts` (одна схема для OpenAPI и CLI) |

Просто удалите те, которые вам не нужны (prisma, i18n...), нет необходимости держать их напоказ. CORS, аутентификация, OpenAPI и т. д. являются независимыми пакетами и должны быть установлены после использования.

## Попробуйте сменить интерфейс

Уже в строительных лесах ` src/routers/`. новый файл ` export const router = new Router()`,` routers('./src/routers')`Он будет отсканирован. Прежде чем приступить к действию, расставьте приоритеты:

```typescript
// src/routers/hello.router.ts
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/hello', {
  mount: [
    query({ name: rule.string().default('world') }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.send({ message: ` hello, ${ctx.query.name}` });
  },
});
```

` pnpm start `позже посетить`/hello?name=ada `, в это время` ctx.query.name `Уже строка.

## Попробуйте запустить команду

Консоль **совместно** использует службы/схемы с Web. изменять` src/commanders/`Инструкции здесь или напрямую запустите ту, которая идет в комплекте со лесами:

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```

Запланированные задачи и OpenAPI также можно разместить на диске. ` src/cli.ts `, см. [Cron](/ru/plugins/cron) · [Генерация OpenAPI](/ru/openapi/).

## Дальше

1. [Запись веб-приложения](/ru/web/) —` WebApp` Обязательные поля, язык, выключение
2. [HTTP-маршрутизация](/ru/web/router) — монтировать, документы, отключено
3. [Валидаторы](/ru/validators/) — Как проверять поля и узкие типы
4. [Услуги](/ru/core/service) — Куда разместить базу данных и кэш
5. [Запись консольного приложения](/ru/console/) — Команды и Cron