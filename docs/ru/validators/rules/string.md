---
outline: deep
---

# rule.string()

Проверяет и сужает **читаемый текст**: ник, заголовок, поисковый запрос, заметка.

Общая цепочка (optional / required / nullable / default / transform / docs и т.д.) — в [общей цепочке](../chain); ниже только методы **этого правила**.

```typescript
import { rule, schema } from '@aomex/common';

export const nicknameSchema = schema({
  displayName: rule.string().trim().length({ min: 1, max: 32 }), // [!code highlight]
  q: rule.string().trim().optional(),
});
// body: { displayName: '  Ada  ' } → displayName равен 'Ada'
```

- После успешной проверки поле выводится как string (после transform — тип возвращаемого transform, см. [общую цепочку](../chain)).
- Пустая строка `''` по умолчанию считается «не передано»; вместе с `optional()` часто становится `undefined`.
- После `allowEmptyString()` `''` сохраняется как легальный string.

### trim(is?: boolean)

**Когда использовать:** пробелы с краёв из форм, вставки, IME — без trim «одинаковые на вид» значения не совпадут с БД.

```typescript
import { rule } from '@aomex/common';

rule.string().trim();
rule.string().trim().length({ min: 1, max: 32 });
```

### length(n | { min?, max? })

**Когда использовать:** длина кода, минимальная длина пароля, верхняя граница заметки (по JS `.length` строки, кодовые единицы UTF-16).

```typescript
import { rule } from '@aomex/common';

rule.string().length(6);
rule.string().length({ min: 8, max: 128 });
```

Вместе с trim длина считается **после** trim.

### match(pattern: RegExp)

**Когда использовать:** имя пользователя только буквы/цифры/подчёркивание, фиксированный формат инвайт-кода. Для email / URL / UUID предпочитайте специализированные фабрики.

```typescript
import { rule } from '@aomex/common';

rule.string().trim().match(/^[a-z][a-z0-9_]{2,31}$/i);
```

Email, URL, IP через `match` не «дотягивайте» — у специализированных фабрик точнее семантика OpenAPI.

### allowEmptyString()

**Когда использовать:** поисковое поле очищено, но всё ещё шлёт `q=`, заметка явно хранит пустую строку, выравнивание с controlled `value=""` на фронте.

```typescript
import { rule } from '@aomex/common';

rule.string().allowEmptyString().default('');
// '' → '' (проходит); без вызова при optional '' часто как «не передано»
```

Если нужен и `optional()`, и `''` как легальное значение — не забудьте `allowEmptyString()`, иначе пустая строка часто выглядит как «не передано».

Общая цепочка: [общая цепочка](../chain); специализированные формы: [email](./email), [url](./url), [uuid](./uuid), [ip](./ip), [hash](./hash).
