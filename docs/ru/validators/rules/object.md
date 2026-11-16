---
outline: deep
---

# rule.object()

Проверяет **именованные объекты JSON**: `profile` в теле, вложенные таблицы полей, встраивание существующей схемы в более крупную фигуру.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const userBody = schema({
  id: rule.int(),
  profile: rule.object({ // [!code highlight]
    bio: rule.string().optional(),
  }),
});
// 默认白名单：未声明字段会被丢掉
```

По умолчанию дополнительные ключи удаляются — клиенты, отправляющие неизвестные поля, увидят их **тихо удаленными**, а не 400.

- Таблица полей задает выведенную форму; гнездо с `rule.object({...})` или пустым `{ key: rule... }`.
- `additional()` сохраняет дополнительные ключи (опционально фильтруются), расширяя типы.
- После `parseFromString` значение по-прежнему является типом объекта.

### additional()

**Когда использовать:** веб-хуки пересылаются дословно, прокси-сервер передает в хранилище дополнительные ключи (по возможности по-прежнему предпочитаете белые списки).

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional();
// { id: 1, traceId: 'x' } → 两者都保留
```

### дополнительный({ключ?, значение? })

**Когда использовать:** только клавиши `meta_*`, дополнительные значения должны быть `string`, объявленные поля плюс однородный пакет расширений.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).additional({ key: /^(meta|ext)_/ });
rule.object().additional({ value: rule.string() });
rule.object({ id: rule.int() }).additional({ value: rule.number() });
```

Для динамических ключей с одинаковыми значениями и без фиксированной схемы выберите [record](./record).

### parseFromString(is?: boolean)

**Когда использовать:** форма/запрос помещает JSON в одну строку, например `filter={"status":"on"}`.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).parseFromString();
// '{"id":1}' → { id: 1 }
```

### строгий(есть?: логическое значение)

**Когда использовать:** тело уже является объектом; блокируйте простые строки, если вы также не включите `parseFromString(true)`.

```typescript
import { rule } from '@aomex/common';

rule.object({ id: rule.int() }).strict();
```

Не используйте пустой `object()` для однородных динамических клавиш — используйте [record](./record).

Для общих цепочек см. [Общие цепочки](../chain); см. также [record](./record), [array](./array), [oneOf](./one-of).
