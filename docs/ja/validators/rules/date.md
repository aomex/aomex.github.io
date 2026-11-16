---
outline: deep
---

# rule.date()

入力を **Date** にまとめる：予約時刻、誕生日、レポート期間、イベントタイムスタンプ。

共通チェーンは [共通チェーン](../chain) を参照。以降は**このルール専用**のメソッドのみ記す。

```typescript
import { rule, schema } from '@aomex/common';

export const bookingSchema = schema({
  at: rule.date().min(() => { // [!code highlight]
    return new Date();
  }),
});
// ISO 字符串或时间戳 → Date；早于 now → 失败
```

- 成功後の型推論は Date。
- ファクトリに Luxon 形式文字列可；未指定時はだいたい ISO、デフォルトでタイムスタンプも解析。
- min / max は **関数** を渡し、検証のたびに「現在」の境界を取る。プロセス起動時刻に凍結しない。

### min(freshDate: () => Date, inclusive?: boolean)

**いつ使うか：** 過去は予約不可、有効日は今日以降。

```typescript
import { rule } from '@aomex/common';

rule.date().min(() => {
  return new Date();
});
```

::: warning
min / max は毎回境界を取る関数を渡す；`min(new Date())` と書いて起動時刻に凍結しない。
:::

### max(freshDate: () => Date, inclusive?: boolean)

**いつ使うか：** 未来禁止、活動終了から 1 年以内。

```typescript
import { rule } from '@aomex/common';

rule.date().max(() => {
  return new Date();
}); // [!code highlight]

rule.date().max(() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
});
```

### parseFromTimestamp(is?: boolean)

**いつ使うか：** デフォルトオン——モバイルのミリ秒タイムスタンプ；契約が ISO のみなら parseFromTimestamp(false)。

```typescript
import { rule } from '@aomex/common';

rule.date(); // 1711257956199 → Date
rule.date().parseFromTimestamp(false);
```

カスタム形式トークンは [Luxon ドキュメント](https://moment.github.io/luxon/#/formatting?id=table-of-tokens) を参照。

日付のみ保存でタイムゾーン無視のときは業務と DB 型を揃え、デフォルト ISO 解析の暗黙 TZ に頼りすぎない。

共通チェーンは [共通チェーン](../chain)；[int](./int)（純タイムスタンプ数値フィールド）、[string](./string)。
