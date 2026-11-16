---
outline: deep
---

# rule.string()

Проверяет и сужает **удобочитаемый текст**: псевдонимы, заголовки, условия поиска, примечания.

Делимые цепи (`optional`/`required`/`nullable`/`default`/`transform`/`docs` и т.д.) живут в [Общие цепочки](../chain); ниже описаны только методы, **зависящие от правил**.

```typescript
import { rule, schema } from '@aomex/common';

export const nicknameSchema = schema({
  displayName: rule.string().trim().length({ min: 1, max: 32 }), // [!code highlight]
  q: rule.string().trim().optional(),
});
// body: { displayName: '  Ada  ' } → displayName 为 'Ada'
```

- После проверки поле принимает значение `string` (типы возвращаемых значений `transform` следуют за [Общие цепочки](../chain)).
- По умолчанию `''` считается «отсутствующим»; с `optional()` пустая строка часто становится `undefined`.
- После `allowEmptyString()` `''` остается действительным `string`.

### trim(is?: boolean)

**Когда использовать**: формы, вставку, начальные и конечные пробелы IME — без обрезки «идентичные» значения не попадают в БД.

```typescript
import { rule } from '@aomex/common';

rule.string().trim();
rule.string().trim().length({ min: 1, max: 32 });
```

### длина(n | { мин?, макс? })

**Когда использовать:** длина OTP, минимальный размер пароля, заглавные буквы (строка JS `.length`, кодовые единицы UTF-16).

```typescript
import { rule } from '@aomex/common';

rule.string().length(6);
rule.string().length({ min: 8, max: 128 });
```

При значении `trim` длина измеряется **после** обрезки.

### match(pattern: RegExp)

**Когда использовать** буквенно-цифровые имена пользователей, форматы кодов приглашения. Предпочитайте выделенные фабрики для электронной почты/URL/UUID.

```typescript
import { rule } from '@aomex/common';

rule.string().trim().match(/^[a-z][a-z0-9_]{2,31}$/i);
```

Не аппроксимируйте адрес электронной почты, URL-адрес и IP-адрес с помощью `match` — специальные фабрики обеспечивают лучшую семантику OpenAPI.

###allowEmptyString()

**Когда использовать:** очищенный поиск по-прежнему отправляет `q=`, примечания могут содержать явную пустую строку, совпадающую с контролируемым `value=""` во внешнем интерфейсе.

```typescript
import { rule } from '@aomex/common';

rule.string().allowEmptyString().default('');
// '' → ''（通过）；未调用时 optional 下 '' 常当没传
```

Если вам нужно `optional()`, но `''` допустимо, добавьте `allowEmptyString()` — иначе пустая строка будет вести себя как отсутствующая.

Для общих цепочек см. [Общие цепочки](../chain); специализированные формы: [email](./email), [url](./url), [uuid](./uuid), [ip](./ip), [hash](./hash).
