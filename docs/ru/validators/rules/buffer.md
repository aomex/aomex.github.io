---
outline: deep
---

# rule.buffer()

Проверяет **Node.js `Buffer`**: шестнадцатеричную подпись, зашифрованный текст, необработанные байты в заданиях очереди (не обычные поля JSON `Buffer`).

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const attestationSchema = schema({
  signature: rule.buffer().parseFrom('base64').required(), // [!code highlight]
});
// 'SGVsbG8=' → Buffer
```

- По умолчанию только реальные `Buffer` экземпляры; Строки JSON не преобразуются автоматически без `parseFrom`.
- После `parseFrom('hex', 'base64')` поле по-прежнему будет отображаться как `Buffer`.
- Тела JSON браузера не могут содержать `Buffer` — общедоступные API почти всегда используют строки + `parseFrom`.

### parseFrom(...encodings: 'hex' | 'base64')

**Когда использовать:** REST JSON с шестнадцатеричными подписями или байтами изображения в формате Base64; вы можете перечислить несколько кодировок, которые можно попробовать во время выполнения.

```typescript
import { rule } from '@aomex/common';

rule.buffer().parseFrom('base64').required();
rule.buffer().parseFrom('hex', 'base64');
```

Чтобы принять шестнадцатеричные строки без создания `Buffer`, используйте [string](./string) + `match` или фиксированную длину [hash](./hash).

Для общих цепочек см. [Общие цепочки](../chain); см. также [file](./file), [hash](./hash), [string](./string).
