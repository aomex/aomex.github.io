---
outline: deep
---

# Helmet (безопасные заголовки)

Добавляет разумный набор HTTP security headers для ответов в браузер (clickjacking, MIME-sniffing и т.д.) и снижает типичные риски фронта. Чистый JSON API — по желанию; при H5, админке, док-сайте обычно вешают по умолчанию, CSP сужают под реальные ресурсы.

Основано на [helmet](https://github.com/helmetjs/helmet); опции совпадают с HelmetOptions, детали — в [документации helmet](https://helmetjs.github.io/).

```bash
pnpm add @aomex/helmet
```

## Полный набор по умолчанию в WebApp

Без аргументов `helmet()` добавляет дефолтный набор браузерных заголовков upstream. При HTML, док-сайте, админке — в `WebApp.mount`. Только JSON API можно пропустить.

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

С [CORS](/ru/plugins/cors) — оба перед routers. Заголовки можно и на reverse proxy; в приложении проще переключать по среде.

Обычный WebMiddleware, бизнес-поля ctx не трогает. В DevTools → Network → заголовки ответа: X-Content-Type-Options, X-Frame-Options и др. (набор зависит от дефолтов helmet и вложенных настроек).

## CSP и ветвление по среде

При фронтовых страницах ужесточайте `contentSecurityPolicy` поверх безаргументного набора: allowlist CDN/скриптов. Не заводятся inline в Swagger/ReDoc — временно `contentSecurityPolicy: false` в dev или на doc-роутах.

Прод, ужесточённый CSP (скелет, под свои ресурсы):

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

Локально меньше трения, в проде жёстче — часто так:

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| Среда | Рекомендация |
| --- | --- |
| Прод (админка / H5) | Включить, CSP сверить со списком ресурсов фронта |
| Прод (только JSON, без HTML) | Опционально; если шлюз уже ставит заголовки — можно не дублировать |
| Локально | Для док-сайта / Swagger допустимо `contentSecurityPolicy: false` |

Скопировали строгий шаблон и забыли CDN/скрипты — белый экран и CSP в консоли. Ослабили CSP «для удобства» в проде — расширили inline, против цели ужесточения. Helmet **не заменяет** [CORS](/ru/plugins/cors).

## Дальше

- Кросс-домен: [CORS](/ru/plugins/cors)
- CSRF при cookie-входе: [CSRF](/ru/plugins/csrf)
- UI API-доков: [Swagger UI](/ru/openapi/swagger-ui), [Redoc UI](/ru/openapi/redoc-ui)
- Где вешать middleware: [middleware](/ru/core/middleware)