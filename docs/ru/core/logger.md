---
outline: deep
---

# Логирование

Создайте **LoggerService** и объявите, куда его отправлять в createTransports; зарегистрируйте его в joinServices и **нетерпеливо разогрейте**. Веб-консоль/консоль используют один и тот же файл Services.logger и соответствуют необходимому регистратору для WebApp.

```bash
pnpm add @aomex/logger
```

```typescript
import {
  BaseLoggerService,
  ConsoleTransport,
  FileTransport,
} from '@aomex/logger';

export default class LoggerService extends BaseLoggerService {
  protected createTransports() { // [!code focus:9]
    return [
      { transport: new ConsoleTransport(), level: 'debug' },
      {
        transport: new FileTransport({ file: './logs/app.log' }),
        level: 'warn', // [!code highlight]
      },
    ];
  }
}
```

```typescript
export const services = await combineServices(
  {
    logger: () => import('./logger.service.js'),
  },
  { eager: ['logger'] }, // [!code highlight]
);

await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
```

WebApp нужно передавать отдельно помимо сервисов ` logger: services.logger`(Достаточно той же ссылки):

```typescript
new WebApp({
  services,
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## Уровень и подпись

У каждого журнала есть **уровень**: уровень шума увеличивается от незначительного до фатального. Уровень, установленный в таблице выходов, определяет, «насколько шумно будет входить в этот канал». Первый параметр ошибки подписи/фатальной:` Error `, остальные оценки средние`(message, context?)`.

— трассировка/отладка/информация/предупреждение: (сообщение, контекст?)
- ошибка/фатальная: (ошибка, сообщение, контекст?)
- Уровень каждого выхода может быть одним уровнем или диапазоном {min, max}.

Уровень варьируется от шумного до тихого: трассировка → отладка → информация → предупреждение → ошибка → фатальный.

::: warning
Включение отладки/трассировки на длительное время в рабочей среде сделает горячий путь и диск невыносимым; используйте ошибку и фатальный сбой в бизнесе, чтобы оставить процесс неработоспособным. Не отмечайте все неудачи как фатальные.
:::

```typescript
await services.logger.info('服务已就绪');
await services.logger.error(err, '结账失败');
await services.logger.fatal(err, '数据库不可用，准备退出');
```

## список экспорта

| Выход | Сумка | когда использовать |
| --- | --- | --- |
| [ConsoleTransport](#consoletransport) | `@aomex/logger ` | Локальная разработка, контейнерный стандартный вывод |
| [FileTransport](#filetransport) | `@aomex/logger ` | Размещение заказов, сортировка файлов по дням/классам |
| [StreamTransport](#streamtransport) | `@aomex/logger ` | Напишите любую запись (тест, конвейер) |
| [WebhookTransport](#webhooktransport) | `@aomex/logger ` | Нажмите на пользовательский HTTP-хук |
| [CustomTransport](#customtransport) | `@aomex/logger ` | Самостоятельная очередь / БД / SDK производителя |
| [SentryTransport](#sentrytransport) | `@aomex/logger-sentry ` | ошибка в Sentry |
| [TelegramTransport](#telegramtransport) | `@aomex/logger-telegram ` | фатально разбуди кого-нибудь |

Распространенные комбинации для производства: информация консоли + предупреждение о файле + ошибка Sentry + фатальная ошибка Telegram. Каждая розетка устанавливает свой уровень, и ни один канал не несет весь шум.

---

### Консольтранспорт

Позвоните в терминал. Текст по умолчанию окрашен в цвет телетайпа; конвейер сбора можно изменить на json.

```typescript
{ transport: new ConsoleTransport(), level: 'debug' },
```

```typescript
new ConsoleTransport({
  format: 'json',
  colorize: false,
});
```

| Параметры | когда использовать | по умолчанию |
| --- | --- | --- |
| ` format ` | При сборе используйте NDJSON`'json'` | `'text'` |
| ` colorize ` | Цвет переключателя силы | Вкл. текстовые сообщения и телетайп |
| ` colors ` | Изменить цвет уровня | встроенный |
| ` output ` | Все уровни следуют одному и тому же потоку | — |
| ` stderrLevels ` | Не установлено` output `Какие уровни входят в stderr, когда | ` error `/` fatal ` |

### Файловый Транспорт

Добавить локальные файлы; если каталог не существует, он будет создан автоматически.

```typescript
{
  transport: new FileTransport({ file: './logs/app.log' }),
  level: 'warn',
},
```

```typescript
new FileTransport({
  file: './logs/{year}-{month}-{day}/{level}.log',
  format: 'json',
});
```

| Параметры | когда использовать | по умолчанию |
| --- | --- | --- |
| ` file ` | Фиксированный путь или с`{year}`/`{level}` держатель места; также доступен `(log) => path` | Сортировка файлов по дню + уровню |
| ` format ` | Дайте Fluent Bit время на использование`'json'` | `'text'` |
| ` fileMode `/` dirMode ` | Если вы хотите ужесточить разрешения | Система по умолчанию |

### СтримТранспорт

Написание произвольных записываемых объектов (поддельные потоки модульных тестов, конвейеры процессов).

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json',
});
```

| Параметры | когда использовать |
| --- | --- |
| ` stream ` | Обязательно, цель доступна для записи |
| ` format ` | `'text'`/`'json'`, текст по умолчанию |

### ВебхукТранспорт

HTTP-отправка к конечной точке тревоги/собственной коллекции.

```typescript
new WebhookTransport({
  url: process.env.ALERT_WEBHOOK_URL!, // [!code highlight]
  headers: { Authorization: ` Bearer ${process.env.HOOK_TOKEN}` },
  format: 'json',
});
```

| Параметры | когда использовать | по умолчанию |
| --- | --- | --- |
| ` url ` | Обязательно, адрес привязки | — |
| ` method ` | Когда не публикуется | ` POST ` |
| ` headers ` | Аутентификация, пользовательский заголовок | — |
| ` format ` | `'json'`/`'text'`, или функция пишется тело | `'json'` |
| ` timeoutMs ` | Поднимите медленный крючок | `30000` |

### CustomTransport

Самостоятельная логика потребления; formatLog настраивается в этом отношении.

```typescript
new CustomTransport({
  async consume(log) { // [!code highlight]
    await myQueue.push(this.formatLog(log, 'json'));
  },
});
```

Если одна линия выйдет из строя, другие выходы, как правило, не будут заблокированы. Наследуйте Transport, когда вам нужен более точный контроль.

### SentryTransport

```bash
pnpm add @aomex/logger-sentry
```

```typescript
import { SentryTransport } from '@aomex/logger-sentry';

{
  transport: new SentryTransport({
    dsn: process.env.SENTRY_DSN!,
  }),
  level: 'error', // [!code highlight]
},
```

| Параметры | когда использовать | по умолчанию |
| --- | --- | --- |
| ` dsn ` | Необходимый; будет создан при построении` Sentry.init ` | — |
| ` flushTimeout ` | Дождитесь отчета перед выключением | `2000` |

DSN использует переменные среды, не записывайте их в хранилище. Рекомендуется уровень должен быть не ниже ошибки и не заливать инфу в Sentry.

### TelegramТранспорт

```bash
pnpm add @aomex/logger-telegram
```

```typescript
import { TelegramTransport } from '@aomex/logger-telegram';

{
  transport: new TelegramTransport({
    botToken: process.env.TG_BOT_TOKEN!,
    chatId: process.env.TG_CHAT_ID!,
  }),
  level: 'fatal', // [!code highlight]
},
```

| Параметры | когда использовать | по умолчанию |
| --- | --- | --- |
| ` botToken `/` chatId ` | Обязательно, от BotFather/идентификатор группы | — |
| ` timeout ` | Общий тайм-аут с автоматическими повторами | `120000` |
| ` format ` | Пользовательское тело сообщения | встроенный |
| ` dedupe ` | Слияние с отпечатками пальцев внутри интервала;` false `закрытие | Включено (около 30 с) |

Подходит для "звонка кому-нибудь после зависания процесса"; не привязывайте много предупреждений.

## Комбинация нескольких розеток

```typescript
import { BaseLoggerService, ConsoleTransport, FileTransport } from '@aomex/logger';
import { SentryTransport } from '@aomex/logger-sentry';
import { TelegramTransport } from '@aomex/logger-telegram';

class LoggerService extends BaseLoggerService {
  protected createTransports() { // [!code highlight]
    return [
      { transport: new ConsoleTransport(), level: 'info' },
      {
        transport: new FileTransport({ file: './logs/app.log', format: 'json' }),
        level: 'warn',
      },
      {
        transport: new SentryTransport({ dsn: process.env.SENTRY_DSN! }),
        level: 'error',
      },
      {
        transport: new TelegramTransport({
          botToken: process.env.TG_BOT_TOKEN!,
          chatId: process.env.TG_CHAT_ID!,
        }),
        level: 'fatal',
      },
    ];
  }
}
```

Также можно просто отправить файл на пересылку в Fluent Bit — сторона приложения тоньше.

## Контекст уровня запроса: withBindings

При устранении неполадок задайте вопрос: «Какому запросу принадлежит этот журнал?»: оберните next() перед веб-монтированием, и в нисходящем журнале автоматически появятся поля.

```typescript
import { middleware } from '@aomex/common';

export const bindRequestLog = middleware.web(async (ctx, next) => {
  const requestId =
    ctx.request.headers['x-request-id']?.toString() || crypto.randomUUID();

  await ctx.logger.withBindings( // [!code highlight]
    {
      requestId,
      method: ctx.request.method,
      path: ctx.request.pathname,
    },
    next,
  );
});
```

```typescript
mount: [
  bindRequestLog, // [!code highlight]
  httpAccessLog(),
  routers('./src/routers'),
],
```

После аутентификации добавляем userId (объединяем с внешним слоем, внутренний слой перезаписываем одноименным ключом):

```typescript
await ctx.logger.withBindings({ userId: ctx.auth.bearer.data.id }, next);
```

То же самое относится и к Services.logger.withBindings в консоли/Cron. Вы можете дождаться Services.logger.flush() перед завершением работы или тестированием.

::: warning
withBindings должен обернуть await next() в обратный вызов, в противном случае нисходящий журнал может находиться в другом контексте.
:::

## Связанный

- [Услуги](/ru/core/service)
- [Промежуточное ПО](/ru/core/middleware)
- [Журнал доступа](/ru/plugins/http-access-log) (HTTP требует времени на строку, что дополняет иерархический экспорт)