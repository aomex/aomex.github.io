---
outline: deep
---

# Быстрая установка

С нуля поднимаете рабочий проект aomex: HTTP доступен, в терминале тоже можно гонять команды. Скаффолд уже кладёт обязательные logger / language / shutdown — проще, чем собирать с пустых рук. Нужен **Node.js `^22.22.2 || ^24.15.0 || >=26`**.

Какой командой запустите — тот пакетный менеджер и подтянется (можно перекрыть `--pm`).

```bash
pnpm create aomex
yarn create aomex
npm create aomex
```

По подсказкам выберите ORM, аутентификацию, middleware и т.д.; после генерации зайдите в каталог и стартуйте:

```bash
cd <project>
pnpm start   # или yarn start / npm start
```

В корне сгенерированного проекта есть `AGENTS.md` → `aomex-skill.md` — для расширения кода ИИ по соглашениям.

После старта откройте в браузере health-check или главную (порт — в `PORT` шаблона). В терминале:

```bash
pnpm aomex -h
```

## Неинтерактивные параметры

Все опции можно задать CLI-аргументами и пропустить вопросы (удобно для скриптов / CI). Не переданные пункты по-прежнему спросят интерактивно.

| Параметр | Описание | Пример |
| --- | --- | --- |
| `--project` | имя каталога проекта | `--project=my-api` |
| `--node` | версия Node (без аргумента — интерактивный выбор LTS, ≥24) | `--node=24.22.0` |
| `--pm` | пакетный менеджер (по умолчанию как у create) | `--pm=pnpm` \| `yarn` \| `npm` |
| `--orm` | ORM | `--orm=prisma` \| `mongoose` \| `none` |
| `--db` | БД Prisma (только `--orm=prisma`) | `--db=mysql` \| `postgresql` \| … |
| `--auth` | стратегии аутентификации, через запятую; `none` — без | `--auth=bearer,jwt` \| `--auth=none` |
| `--web-plugins` | опциональный Web middleware (`cors` / `etag` / `helmet` / `response-time` ставятся всегда) | `--web-plugins=access-log,async-trace` |
| `--docs` | UI документации | `--docs=swagger` \| `redoc` \| `scalar` \| `none` |
| `--logger` | выходы логов, через запятую | `--logger=console,file` |
| `--console-middlewares` | плагины Console; `cron` всегда, можно добавить | `--console-middlewares=openapi` |
| `--lang` | язык по умолчанию (BCP 47) | `--lang=zh-CN` |
| `--docker` | генерировать Docker-артефакты для прода | `--docker=true` \| `false` |
| `--tz` / `--timezone` | часовой пояс процесса | `--tz=Asia/Shanghai` |
| `--cluster` | схема кластера (не наслаивайте) | `--cluster=none` \| `cluster-listen` \| `pm2` |

```bash
pnpm create aomex -- \
  --project=HelloAomex \
  --pm=pnpm \
  --orm=prisma \
  --db=mysql \
  --auth=bearer \
  --docs=swagger \
  --lang=zh-CN \
  --docker=true \
  --tz=Asia/Shanghai \
  --web-plugins=access-log,async-trace \
  --logger=console,file \
  --cluster=none
```

## Структура каталогов

Скаффолд примерно такой (в разных версиях чуть плывёт). Держитесь трёх линий: `src/web.ts` поднимает HTTP, `src/cli.ts` — терминал / Cron / запись OpenAPI на диск, `src/routers/` и `src/commanders/` — интерфейсы и команды; переиспользуемый middleware (аутентификация, формат ошибок, access log) — в `src/middleware/`, БД и кеш — в `src/services/`, **общие для обеих сторон**.

| Файл / каталог | Зачем вы его правите |
| --- | --- |
| `src/web.ts` | поднять HTTP |
| `src/cli.ts` | терминальные команды / Cron / запись OpenAPI |
| `src/routers/` | писать API |
| `src/commanders/` | писать CLI-команды |
| `src/middleware/` | аутентификация, formatError, access log, Swagger и т.п. — переиспользуемый middleware, потом на `web.ts` / mount маршрутов |
| `src/services/` | БД, кеш, почта — SQL не кладите в `action` маршрута |
| `src/schemas/` | переиспользуемая валидация, имя `xxx.schema.ts` (OpenAPI и CLI делят одну копию) |

Ненужное (prisma, i18n…) можно удалить — не держите «для вида». CORS, аутентификация, OpenAPI — отдельные пакеты, ставьте по мере надобности.

## Попробуйте изменить интерфейс

В скаффолде уже есть `src/routers/`. Новый файл с `export const router = new Router()` подхватит `routers('./src/routers')`. Сначала валидация, потом action:

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
    ctx.send({ message: `hello, ${ctx.query.name}` });
  },
});
```

После `pnpm start` откройте `/hello?name=ada` — к этому моменту `ctx.query.name` уже string.

## Попробуйте запустить команду

Console и Web **делят** services / schemas. Правите команды в `src/commanders/` или сразу гоняйте те, что дал скаффолд:

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```

Планировщик и запись OpenAPI тоже через `src/cli.ts` — см. [Cron](/ru/plugins/cron) · [Генерация OpenAPI](/ru/openapi/).

## Дальше

1. [Вход Web-приложения](/ru/web/) — обязательные поля `WebApp`, language, shutdown  
2. [Маршрутизация API](/ru/web/router) — mount, docs, disabled  
3. [Валидаторы](/ru/validators/) — как проверять поля и сужать типы  
4. [Сервисный слой](/ru/core/service) — куда класть БД и кеш  
5. [Вход Console-приложения](/ru/console/) — команды и Cron
