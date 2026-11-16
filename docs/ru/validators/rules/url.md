---
outline: deep
---

# rule.url()

Проверяет **строки URL**: аватары, домашние страницы, обратные вызовы, ссылки на документы (по умолчанию `http` / `https`).

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const profileSchema = schema({
  avatar: rule.url().optional(), // [!code highlight]
});
// 'https://cdn.example.com/u/1.png' → 通过；'not a url' → 失败
```

- После проверки выводится как `string` (нормализованная строка URL-адреса во время выполнения — проверяйте типы, если вы полагаетесь на точную форму).
- `scheme([...])` **заменяет** список протоколов по умолчанию; он не добавляется.

### scheme(schemes: string[])

**Когда использовать:** рабочие обратные вызовы только по протоколу HTTPS; внутренние зеркала, позволяющие `http`+`https`; редкие схемы (`ftp` и др.) указаны явно.

```typescript
import { rule } from '@aomex/common';

rule.url().scheme(['https']).required();
rule.url().scheme(['https', 'http']);
```

Для общих цепочек см. [Общие цепочки](../chain); см. также [email](./email), [string](./string), [ip](./ip).
