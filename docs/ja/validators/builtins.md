---
outline: deep
---

# バリデーター一覧

どの rule.xxx() を使うか迷ったら、まず本ページで**タスク別に案内**；ファクトリを決めたら専ページで専用メソッド（trim、min、mimeTypes…）を確認。ほぼすべてのファクトリは [共通チェーン](./chain)（optional、default、transform…）を載せられる。

```typescript
import { rule, schema } from '@aomex/common';

export const task = schema({
  email: rule.email(),
  page: rule.int().min(1).default(1),
  avatar: rule.file(), // Web 上传见 @aomex/web
});
```

3 フィールドで日常の大半をカバー：**識別子**、**ページング整数**、**ファイル**——残りは下のタスク表で探す。

- 各 rule.xxx() ファクトリは異なるチェーン型を推論；専用メソッドと共通チェーンの可否はエディタ補完に従う。
- rule.file() は `@aomex/web` プロジェクトでのみ登録；Console の純 Node エントリには通常ない。
- 組み合わせ（oneOf、array…）の Infer はネストまたはユニオン。[object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of) を参照。
- 既成ファクトリがなければ [カスタムバリデーター](/ja/advanced/validator)；rule.any() で API 全体を糊塗にしない。

ページングは default(1)、PATCH は optional / [partial](./schema) が多い——チェーンは [共通チェーン](./chain)。

## タスクでファクトリを選ぶ

| やりたいこと | まず見るページ |
| --- | --- |
| ユーザー名、備考、検索語 | [`rule.string()`](./rules/string) |
| ページング、数量、採番 id | [`rule.int()`](./rules/int) |
| 金額、比率（小数） | [`rule.decimal()`](./rules/decimal) または [`rule.number()`](./rules/number) |
| スイッチ、規約同意 | [`rule.boolean()`](./rules/boolean) |
| 登録メール、ログイン ID | [`rule.email()`](./rules/email) |
| コールバック URL、リンク | [`rule.url()`](./rules/url) |
| リソース id（UUID / ULID） | [`rule.uuid()`](./rules/uuid) · [`rule.ulid()`](./rules/ulid) |
| 有効時刻、予約枠 | [`rule.date()`](./rules/date) |
| 固定列挙（ロール、状態） | [`rule.enum()`](./rules/enum) · [`rule.literal()`](./rules/literal) |
| JSON body のネストオブジェクト | [`rule.object()`](./rules/object) またはフィールド表リテラル |
| タグ一覧、一括 id | [`rule.array()`](./rules/array) |
| 動的キーの設定袋 | [`rule.record()`](./rules/record) |
| 支払い / Webhook 複数形 | [`rule.oneOf()`](./rules/one-of) · [`rule.anyOf()`](./rules/any-of) |
| アバター、添付 multipart | [`rule.file()`](./rules/file) + [ファイルアップロード](/ja/web/attach) |
| 大整数、ハッシュ、IP | [`rule.bigint()`](./rules/bigint) · [`rule.hash()`](./rules/hash) · [`rule.ip()`](./rules/ip) |
| Buffer / ストリーム | [`rule.buffer()`](./rules/buffer) · [`rule.stream()`](./rules/stream) |
| どうしても拘束したくない（過渡） | [`rule.any()`](./rules/any)（外部 API に長期置かない） |

### 索引：ファクトリグループ（参照用）

**テキストと数値：** [string](./rules/string) · [number](./rules/number) · [int](./rules/int) · [bigint](./rules/bigint) · [decimal](./rules/decimal) · [boolean](./rules/boolean)

**時刻と識別子：** [date](./rules/date) · [email](./rules/email) · [url](./rules/url) · [uuid](./rules/uuid) · [ulid](./rules/ulid) · [ip](./rules/ip) · [hash](./rules/hash)

**列挙とリテラル：** [enum](./rules/enum) · [literal](./rules/literal)

**構造：** [object](./rules/object) · [record](./rules/record) · [array](./rules/array) · [buffer](./rules/buffer) · [stream](./rules/stream)

**組み合わせ：** [oneOf](./rules/one-of) · [anyOf](./rules/any-of) · [allOf](./rules/all-of) · [any](./rules/any)

**Web：** [file](./rules/file)

メールは string().match で代用しない——[email](./rules/email) の方が楽で OpenAPI も正確。外部リソース id は [uuid](./rules/uuid) 相当なら裸 string() にしない。金額・残高は [decimal](./rules/decimal)；[number](./rules/number) のまま暴走しない。

::: warning
1 エンドポイントが rule.any() だらけは一時的な結合試験向け。早く具体形状に置き換える。
:::

## 次のステップ

- [共通チェーン](./chain)
- [schema](./schema)
- [クイックスタート](/ja/validators/)（バリデーターを初めて組むとき）
