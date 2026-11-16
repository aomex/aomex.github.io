---
outline: deep
---

# Выгрузка OpenAPI

При условии, что процесс HTTP не изменяется, используйте консольную команду для записи контракта, отсканированного маршрутом, в файл для использования CI, SDK или станцией документации. Как объявить маршруты?`generateOpenapi ` Как использовать, см. на веб-странице [Генерация OpenAPI](/ru/plugins/openapi).

```bash
pnpm add @aomex/openapi
```

существовать ` ConsoleApp`Крепление в креплении ` openapi({ routers, app, saveToFile, … })`, локальное или конвейерное выполнение ` aomex openapi`,получать ` openapi.json`(или указанный вами путь). ` app`Отправьте ту же копию, что и онлайн. ` WebApp`, глобальное middleware и [envelope](/ru/web/envelope) заключат договор вместе.

входящий ` app`когда, пожалуйста ` new WebApp(...)`и ` app.listen(...)`**Разбирать** (или слушать только на входе), иначе Консоль ` import`Веб-модули будут иметь побочные эффекты.

```typescript
// src/app.ts —— 只导出 WebApp，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [formatError({ /* … */ }), routers('./src/routers')],
});
```

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';

new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# 脚手架里常见：pnpm aomex openapi
```

После успеха файл контракта появится в текущем рабочем каталоге (или по указанному вами пути).

Ссылка на консоль в основном предназначена для **файлов пакетной записи** и не сужает ctx, как веб-маршрутизация. Тело/ответ на бизнес-маршруте по-прежнему сужает действие во время компиляции; команда размещения считывает только один и тот же набор определений маршрута +` app `Глобальная конфигурация включена для генерации JSON.

::: warning
` saveToFile `Путь должен быть согласован с каталогом продукта CI, иначе конвейер не сможет найти файл, и нижестоящий SDK по-прежнему будет использовать старый контракт. Измените маршрутизацию или измените` app `После монтирования/конверта не забудьте запустить` aomex openapi `, не позволяйте контрактным документам разбрасываться по складу.
:::

## роутеры и приложения

Команда размещения на самом деле не запускает HTTP, но при создании контракта вы должны прочитать каталог маршрутизации, соответствующий онлайн-каталогу маршрутизации, и ту же копию.` WebApp `(Аутентификация, formatError и конверт — все это происходит из него).` routers `Указывает на тот же глобус, что и в сети; пропущенная передача` app `В настоящее время безопасность, текст ошибки и формы оболочки в документе легко не соответствуют реальному ответу.

| Параметры | когда использовать | по умолчанию |
| --- | --- | --- |
| ` routers ` | Необходимый; тот же глобус, что и сканер веб-маршрутов | — |
| ` app ` | То же, что и онлайн` WebApp `Пример | — |
| ` docs ` | ` info.title `/` version `/` description ` | — |
| ` fix ` | ремонт` servers `, контакт и другие поля уровня документа | — |
| ` saveToFile ` | Путь падения; CI-архив | ` openapi.json ` |

Пример архива CI:

```typescript
import { app } from './app.js';

openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});
```

## Сбросить на диск или выдать JSON во время выполнения

| сцена | упражняться |
| --- | --- |
| Контракт архива сборки CI каждый раз | Эта страница:` openapi()`+` aomex openapi ` |
| После изменения маршрута обновите файл локально | То же, что и выше, запустите вручную |
| При запуске выдавать последний JSON по запросу. | Настройка веб-маршрутизации ` generateOpenapi({ routers, app })`, не нужно заходить в консоль |

Отправьте сгенерированные файлы в [Swagger UI](/ru/plugins/swagger-ui)/[Redoc UI](/ru/plugins/redoc-ui), либо отправьте их на склад для контрактного тестирования.

Динамическое плевание во время размещения и выполнения `/openapi.json` Это не одно и то же: высокочастотное онлайн-сканирование требует затрат ресурсов ЦП, а большинство производственных документ-станций используют диск + статические или UI-плагины для чтения файлов.

## Связанный

- [Генерация OpenAPI](/ru/plugins/openapi)
- [Конверт для ответа](/ru/web/envelope)
- [Swagger UI](/ru/plugins/swagger-ui)
- [Redoc UI](/ru/plugins/redoc-ui)