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

Леса выглядят примерно так (в зависимости от версии они будут немного скорректированы). Сначала возьмите три строки:` src/web.ts `Начиная с HTTP,` src/cli.ts `Запустите терминал/Cron/OpenAPI и скачайте диск,` src/routers/`и ` src/commanders/`Каждый интерфейс записи и инструкции; проверь базу данных и кеш ` src/services/`, **разделяется обеими сторонами**.

| файл/каталог | На что ты его меняешь? |
| --- | --- |
| ` src/web.ts ` | Начиная с HTTP |
| ` src/cli.ts ` | Запустить команду терминала/Cron/Удалить диск OpenAPI |
| ` src/routers/` | Написать интерфейс |
| ` src/commanders/` | Написание команд CLI |
| ` src/services/` | Проверка базы данных, кэширование и отправка электронной почты — не вставляйте бизнес-SQL в маршрутизацию. ` action` |
| ` src/schemas/` | Многоразовая проверка, имя файла ` xxx.schema.ts`(OpenAPI и CLI используют одну и ту же копию) |

```text
src/web.ts          # HTTP 入口
src/cli.ts          # Console / Cron / OpenAPI 落盘
src/routers/        # 接口
src/commanders/     # CLI 指令
src/services/       # Web 与 Console 共用
src/schemas/        # 可复用 rule / schema
```

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

Запланированные задачи и OpenAPI также можно разместить на диске. ` src/cli.ts `, см. [Cron](/ru/plugins/cron) · [Экспорт OpenAPI](/ru/console/openapi).

## Дальше

1. [Запись веб-приложения](/ru/web/) —` WebApp` Обязательные поля, язык, выключение
2. [HTTP-маршрутизация](/ru/web/router) — монтировать, документы, отключено
3. [Валидаторы](/ru/validators/) — Как проверять поля и узкие типы
4. [Услуги](/ru/core/service) — Куда разместить базу данных и кэш
5. [Запись консольного приложения](/ru/console/) — Команды и Cron