---
outline: deep
---

# rule.number()

Проверяет **конечные числа (включая десятичные дроби)**: рейтинги, соотношения, компоненты широты и долготы, прогресс, а не денежные десятичные дроби.

Для общих методов цепочки см. [Общие цепочки](../chain); ниже — только **специфичные для rule** API.

```typescript
import { rule, schema } from '@aomex/common';

export const ratingSchema = schema({
  score: rule.number().min(0).max(5).precision(1), // [!code highlight]
});
// body: { score: 4.56 } → 先 toFixed(1) 再比范围，常为 4.6
```

- Выводится как `number` (не `Decimal`; в деньгах используется [decimal](./decimal)).
- Запрос `'3.5'` по умолчанию приводит к `3.5`; `strict()` принимает только `number`.
- `precision(n)` изменяет выходные десятичные знаки; тип остается `number`.

### min(n, inclusive?: boolean)

**Когда использовать** неотрицательные веса, прогресс, нижние границы скидки.

```typescript
import { rule } from '@aomex/common';

rule.number().min(0);
rule.number().min(0, false); // 必须 > 0
```

### max(n, включительно?: логическое значение)

**Когда использовать:** пятизвездочное ограничение, коэффициент ≤ 1, диапазон долготы.

```typescript
import { rule } from '@aomex/common';

rule.number().min(0).max(5);
```

### точность (десятичные числа: число)

**Когда использовать:** ползунок с длинными хвостами, API «не более двух десятичных знаков»; `toFixed`, затем `min`/`max`.

```typescript
import { rule } from '@aomex/common';

rule.number().precision(2);
rule.number().min(0).max(100).precision(1);
```

`precision` использует `toFixed` перед `min`/`max` — если это не соответствует банковскому округлению в вашем домене, обработайте это в `transform` или в действии.

### strict(is?: boolean)

**Когда использовать:** тело JSON уже `number`; оставьте запрос свободным по умолчанию.

```typescript
import { rule } from '@aomex/common';

rule.number().strict();'1.5' → 失败
```

Для общих цепочек см. [Общие цепочки](../chain); см. также [int](./int), [decimal](./decimal), [bigint](./bigint).
