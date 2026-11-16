---
outline: deep
---

# Собственная стратегия аутентификации

[Bearer](/ru/plugins/auth-bearer-strategy), [API Key](/ru/plugins/auth-api-key-strategy) и [JWT](/ru/plugins/auth-jwt-strategy) уже охватывают большинство API «токен/ключ в заголовке». Вы настраиваете, когда форма учетных данных не соответствует этим плагинам, но вы все равно хотите:

- Один путь через `auth.authenticate ` / ` authorize `  
- **401**, если вы не вошли в систему, **403**, если это запрещено.  
- ` ctx.auth.<strategyName>.data ` в обработчиках  
- Соответствие безопасности в OpenAPI.  

Типичные случаи: сеансы cookie, заголовки, внедренные шлюзом, удостоверения из mTLS. Если вам нужно только ` user ` on ` ctx ` и не обращайте внимания на соглашения об аутентификации, простое middleware работает, но у вас есть безопасность и неаутентифицированные ветки.

Ниже приведен **сеанс cookie** с нуля путем монтажа на маршрутах.

## Шаг 1: Решите, как будет выглядеть личность

Исправьте полезную нагрузку после входа в систему, например. `{ userId: number }`. Это становится первым обобщением стратегии и типом ` ctx.auth.session.data `.

Второй универсальный вариант ` authorize ` аргументы, например названия ролей: `[string]` → позже `.authorize('admin')`.

## Шаг 2: Реализация ` authenticate ` (собрать учетные данные)

Прочитайте учетные данные из запроса; Отсутствующие или недействительные должны соответствовать приведенному ниже контракту — **не выдавать необнаруженные ошибки** (клиенты часто видят 500 и предполагают, что служба не работает).

```typescript
// src/auth/session.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class SessionStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const sid = ctx.request.cookies?.['sid']; // [!code highlight]
    if (!sid) {
      return false; // → 401 未登录
    }
    const user = await findBySession(sid);
    if (!user) {
      return new AuthError('session expired'); // → 401，带消息
    }
    return { userId: user.id }; // → 写入 ctx.auth
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

` authenticate `Соглашение о возвращаемом значении:

| возвращаемое значение | Поведение |
| --- | --- |
| идентификационный объект | писать` ctx.auth `, продолжайте движение вниз по течению |
| ` false ` | Не авторизован → **401** |
| ` AuthError ` | Ошибка аутентификации с сообщением → **401** |

` authorize `Вернуть ложь или` AuthError `→ **403**.` authorize `проходить` this.getIdentity()`Получите текущий идентификатор (то есть объект при успешной аутентификации).

## Шаг 3. Передайте его авторизации, имя ключа — это имя политики.

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { SessionStrategy } from './session.strategy.js';

export const auth = new Auth({
  strategies: {
    session: new SessionStrategy(), // [!code highlight]
  },
});
```

Ключевое имя здесь ` session ` Определитесь с тремя вещами:

1.` auth.authenticate('session')`  
2. ` ctx.auth.session `  
3. ` ctx.auth.session.data ` Форма (из общей стратегии)

## Шаг 4. Подключитесь к маршрутизатору и попробуйте

Откройте интерфейс входа и интерфейс для аутентификации. **Разберите маршрутизатор** (или укажите цепочку аутентификации). `.skip`, см. [Промежуточное ПО](/ru/core/middleware)), не сбивайтесь в одну группу и не полагайтесь на чувства, чтобы передвигаться.

```typescript
import { Router } from '@aomex/web';
import { auth } from '../auth/index.js';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('session')], // 本组都要登录
});

router.get('/dashboard', {
  mount: [auth.authenticate('session').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.session.data.userId;
    ctx.send({ userId });
  },
});
```

Его также можно использовать только на одном маршруте. ` mount`Вешать трубку ` authenticate`, не обязательно на уровне маршрутизатора. цепь `.authorize('admin')` Не менять `data` Тип; сбой будет возвращен платформой как 403. Как правило, нет необходимости повторно оценивать роль в действии (более подробные бизнес-разрешения будут обсуждаться отдельно).

Проверьте вручную:

1. Без файлов cookie → **401**
2. Есть куки и недостаточно ролей → **403**
3. Через → действие `userId` Есть завершение

## Шаг 5. Дополните безопасность OpenAPI

Самописная стратегия по умолчанию приведет только к ответу 401 (базовый класс `openapi()`). Если вы не объявите схему безопасности, Swagger «Authorize» не будет соответствовать вашему заголовку Cookie/custom, а внешний интерфейс всегда будет генерировать 401, используя Bearer для создания клиента.

Переопределить в политике ` openapi()`(Поля подлежат вводу подсказок, просто обратитесь к подключаемому модулю Bearer):

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['sessionCookie'] ||= {
        type: 'apiKey',
        in: 'cookie',
        name: 'sid',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ sessionCookie: [] });
    },
  };
}
```

Восстановите OpenAPI и проверьте безопасность и описания ошибок 401 для затронутых операций.

::: предупреждение
Имена файлов cookie, имена заголовков и метаданные безопасности должны соответствовать тому, как вы читаете учетные данные, иначе интеграция зациклится на **401**.
:::

## Когда не следует настраивать

| Ситуация | Подход |
| --- | --- |
| Стандартный носитель/ключ JWT/API | Стратегии плагинов |
| Файлы cookie, заголовки шлюза, пользовательская подпись | Обычай ` Strategy ` (эта страница) |
| Проверка работоспособности, статические страницы | Отдельный маршрутизатор или `.skip `; см. [Промежуточное ПО](/ru/core/middleware) |

## Асимметричные клавиши и вращение JWT (все еще используйте плагин)

Пользовательские стратегии решают **как вы собираете учетные данные**; Алгоритмы и ротация JWT остаются в [стратегии JWT](/ru/plugins/auth-jwt-strategy) — переписывать не нужно:

```typescript
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import fs from 'node:fs';

new AuthJwtStrategy({
  publicKey: fs.readFileSync('public.pem'),
  privateKey: fs.readFileSync('private.pem'),
  verifyOptions: { algorithms: ['RS256'] }, // [!code highlight]
  legacySecretOrPublicKey: [oldSecret],
  onVerified: (payload) => {
    return payload;
  },
});
```

## Похожие

- Точка входа и встроенные стратегии: [Auth](/ru/plugins/auth)
- 401/403 JSON: [Формат ошибки](/ru/web/errors)