---
outline: deep
---

# rule.file()

Проверяет **многочастную загрузку** (`@aomex/web`): аватары, фотографии для удостоверений личности, импорт CSV (выводит внушительный файловый объект).

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule } from '@aomex/web';

export const avatarField = rule.file().maxSize('2mb').mimeTypes('image/jpeg', 'image/png');
```

Не используйте `file` для загрузки JSON браузера — используйте multipart и [Загрузка файлов](/ru/web/attach).

- После проверки вы получаете внушительный файловый объект (путь, размер, mimetype и т. д.), а не `Buffer`.
- Это правило часто имеет **нет** `nullable` / `default` — следуйте этой странице и вводите подсказки.
- Когда `mimeTypes` и магические байты не совпадают, поведение зависит от `fallbackToMimetype`.

### maxSize(byte: number | string)

**Когда использовать:** блокировать огромные файлы, заполняющие диск; `'20kb'` / `'2mb'` или необработанные байты.

```typescript
import { rule } from '@aomex/web';

rule.file().maxSize('2mb');
rule.file().maxSize(500_000);
```

### mimeTypes(...токены | токены[])

**Когда использовать:** только изображения аватаров, импорт только CSV; когда подписи существуют, выигрывает контент.

```typescript
import { rule } from '@aomex/web';

rule.file().mimeTypes('.png', 'image/jpeg');
rule.file().mimeTypes(['image/*']);
rule.file().mimeTypes('.csv', 'text/csv');
```

### FallbackToMimetype(включить?: логическое значение)

**Когда использовать:** CSV/HTML/обычный текст без стабильной магии — по умолчанию `true` возвращается к клиенту `Content-Type` вместо `mimeTypes`.

```typescript
import { rule } from '@aomex/web';

rule.file()
  .mimeTypes('.html', 'text/plain', 'text/csv')
  .fallbackToMimetype();
```

Временные файлы очищаются после ответа — `rename` или сразу же загружаются в хранилище объектов в действии.

Для общих цепочек см. [Общие цепочки](../chain); см. также [buffer](./buffer), [stream](./stream).
