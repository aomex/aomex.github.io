---
outline: deep
---

# Заголовки безопасности Helmet

Добавляет к ответам для браузера разумный набор HTTP security-заголовков (clickjacking, MIME sniffing и т.д.) и снижает типичные фронтовые риски. Для чистого JSON API опционально; при H5, админке, док-сайте обычно вешают по умолчанию, а CSP ужесточают под реальные ресурсы.

На базе upstream [helmet](https://github.com/helmetjs/helmet); опции совпадают с HelmetOptions, детали — в [документации helmet](https://helmetjs.github.io/).

```bash
pnpm add @aomex/helmet
```

## Стандартный набор на WebApp

Безаргументный `helmet()` включает дефолтный набор браузерных security-заголовков upstream; при HTML, док-сайте, админке обычно кладут в `WebApp.mount`, для чистого JSON API можно не ставить.

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

Вместе с [CORS](/ru/plugins/cors) оба ставьте перед routers; заголовки можно добавить и на reverse proxy, in-app удобнее переключать по среде.

Возвращает обычный WebMiddleware, бизнес-поля ctx не трогает. В DevTools → Network → Response Headers видны X-Content-Type-Options, X-Frame-Options и т.д. (конкретный набор зависит от дефолтов helmet и подопций).

## CSP и ветки по среде

Когда есть фронтовые страницы, поверх безаргументного набора ужесточайте `contentSecurityPolicy`: белый список CDN / доменов скриптов. Если у Swagger / ReDoc не поднимаются inline-скрипты, в разработке или на doc-маршрутах временно `contentSecurityPolicy: false`.

Прод: ужесточённый CSP (скелет, правьте под реальные ресурсы):

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

Локально меньше трения, в проде жёстче — часто ветвят по среде:

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| Среда | Рекомендация |
| --- | --- |
| Прод (админка / H5) | включить, CSP сверить со списком фронтовых ресурсов |
| Прод (только JSON, без HTML) | опционально; если шлюз уже ставит заголовки — можно опустить |
| Локально | док-сайт / Swagger могут с `contentSecurityPolicy: false` |

Если скопировать жёсткий CSP-шаблон и забыть CDN / домены скриптов — белый экран и куча CSP в консоли. Выключить CSP в проде «для простоты» расширяет поверхность inline-скриптов — против цели ужесточения. Helmet **не заменяет** [CORS](/ru/plugins/cors): кросс-домен настраивается отдельно.

## Дальше

- Кросс-домен: [CORS](/ru/plugins/cors)
- Cookie-вход и защита от подделки: [CSRF](/ru/plugins/csrf)
- UI публичной документации API: [Swagger UI](/ru/openapi/swagger-ui), [Redoc UI](/ru/openapi/redoc-ui)
- Куда вешать middleware: [Middleware](/ru/core/middleware)
