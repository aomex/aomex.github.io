---
outline: deep
---

# Заголовки безопасности Helmet

Разумный набор HTTP security-заголовков для ответов в браузере (clickjacking, MIME sniffing и т.д.). Для чистого JSON API опционально; для H5, админки, док-сайта обычно включают по умолчанию — CSP под реальные ресурсы.

На базе [helmet](https://github.com/helmetjs/helmet); опции как `HelmetOptions` — [документация helmet](https://helmetjs.github.io/).

```bash
pnpm add @aomex/helmet
```

## Стандартный набор на WebApp

Безаргументный `helmet()` — дефолты upstream; типично в `WebApp.mount` при HTML, доках, админке; для только JSON можно не ставить.

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

С [CORS](/ru/plugins/cors) оба **перед** `routers`; заголовки можно и на reverse proxy — in-app удобнее для переключения по среде.

Обычный `WebMiddleware`, бизнес-поля `ctx` не трогает. В DevTools → Network видны `X-Content-Type-Options`, `X-Frame-Options` и т.д. (набор зависит от дефолтов и подопций).

## CSP и ветки по среде

| Возможность | Когда использовать | Типичный дефолт |
| --- | --- | --- |
| Без аргументов | Прод Web / API для браузера | Базовая защита вкл |
| `contentSecurityPolicy` | Фронтенд-страницы, XSS | Белый список CDN/скриптов |
| `contentSecurityPolicy: false` | Блок inline у Swagger/ReDoc | часто dev или только doc-маршруты |
| Ветка по `NODE_ENV` | Проще локально, жёстче в проде | см. демо ниже |

### Прод: ужесточённый CSP (скелет)

```typescript
helmet({
  contentSecurityPolicy: { // [!code highlight]
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
});
```

### Разработка vs прод

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| Среда | Рекомендация |
| --- | --- |
| Прод (админка / H5) | Включить; CSP по списку ассетов фронта |
| Прод (только JSON, без HTML) | Опционально; если шлюз уже ставит заголовки |
| Локально | Для доков / Swagger можно `contentSecurityPolicy: false` |

CSP из шаблона без CDN/скриптов — белый экран и ошибки CSP в консоли. Выключить CSP в проде — больше inline-риск. Helmet **не заменяет** [CORS](/ru/plugins/cors) — кросс-домен настраивайте отдельно.

## Дальше

- Кросс-домен: [CORS](/ru/plugins/cors)
- UI документации: [Swagger UI](/ru/openapi/swagger-ui), [Redoc UI](/ru/openapi/redoc-ui)
- Размещение middleware: [Middleware](/ru/core/middleware)
