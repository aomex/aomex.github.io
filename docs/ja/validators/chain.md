---
outline: deep
---

# 共通チェーン

任意の rule.xxx() に**共通チェーン**を載せる：「渡されたか」「null を許すか」「デフォルト値」「strict」「変換」「ドキュメントの書き方」を扱う。trim や min のような**専用**メソッドとは直交する。専用は [バリデーター一覧](./builtins) の各ページを参照。

```typescript
import { rule, schema } from '@aomex/common';

export const listQuery = schema({
  page: rule.int().min(1).default(1),
  q: rule.string().trim().optional(),
});

// GET ?page=2&q=ada  → { page: 2, q: 'Ada' }（若你还链了 transform）
// GET 省略 page     → { page: 1, q: undefined }
```

ページングのデフォルト + 任意の検索語は、プロジェクトで最初によく組む組み合わせ。

- optional() のあと、フィールド推論はだいたい T | undefined；default(...) のあとはだいたい「必ず値があり」、クライアントが渡さなくてもデフォルトに落ちる。
- nullable() は null を別枠で許す；「渡されていない」とは別。PATCH でフィールドを空にするときの型は null であって undefined ではない。
- strict() 有効時、文字列 '18' は `rule.int()` を通りにくい；query はほぼ文字列なので、通常 **query に strict は付けない**。
- transform(fn) の戻り型がフィールド型を置き換える——`rule.string().transform(...)` のあとは transform の戻り値型であり string ではない。
- docs(...) は**実行時型を変えず**、OpenAPI メタデータだけに効く。

一部の組み合わせクラスや file は default / strict が無いことがある。専ページに従う。

各メソッドに「いつ使うか」とコピー可能な demo あり；チェーン順は型制約 → default / optional → transform と docs が無難。

### optional()

フィールドは渡さなくてよい。undefined とデフォルトの空文字 '' はだいたい「空」扱い——optional を付けると通過し、値は undefined。

**いつ使うか：** 一覧フィルタ、PATCH の部分更新、Console の任意フラグ。

```typescript
import { rule } from '@aomex/common';

// GET /users?q=ada —— q 可以完全不出现
rule.string().trim().optional();
```

すでに [default(...)](#default値-値) があるなら optional() は通常不要——default があれば足りる。空文字も値として扱うなら [allowEmptyString()](./rules/string)。

### required()

optional() の逆：再び必須にする。

**いつ使うか：** 下書き schema を partial() したあと、本提出で締める。

```typescript
import { rule } from '@aomex/common';

const title = rule.string().optional();
title.required();
```

すでに default(...) があるとき required() を呼んでも**通常は**デフォルトは消えない——欠落時は引き続きデフォルト。

### nullable()

JSON の null を許し、「渡されていない」とは分ける。

**いつ使うか：** PATCH で「null を渡してクリア、渡さなければ変更なし」。

```typescript
import { rule } from '@aomex/common';

rule.string().nullable().optional();
// null → 清空；没传 → undefined，业务里跳过该字段

rule.int().nullable();
```

nullable を付けていないとき null は「空」扱いになることがある。型ヒントに従う。

PATCH でフィールドをクリアするには nullable() で null；「変更しない」は渡さない → undefined——optional() だけで二者を区別できないことに注意。

### default(値 | () => 値)

渡さないか空のとき直接デフォルトを使い、フィールドは非必須に；デフォルト値自体は**通常、型検証をもう一度通さない**。

**いつ使うか：** ページング、ソート、新規リソースの初期状態。

```typescript
import { rule } from '@aomex/common';

rule.int().min(1).default(1); // [!code highlight]
rule.enum(['asc', 'desc']).default('desc');
rule.date().default(() => {
  return new Date();
});
```

デフォルトは関数にでき、検証時に呼ぶ——「現在時刻」や設定読み込み向き。ログでは「クライアント未送信」がデフォルト値として見える。トラブルシュート時に注意。

### strict(is?: boolean)

より硬い型契約：よくある効果は寛容な変換の削減（文字列が密かに数値になる、など）。

**いつ使うか：** JSON body の契約が硬い；**query / フォーム**はほぼ文字列なので、通常は付けない。

```typescript
import { rule } from '@aomex/common';

rule.int().strict();
// '18' → 失败

rule.object({ id: rule.int() }).strict();
```

strict(false) でオフ可能；全ファクトリにこのチェーンがあるわけではない（例：多くの boolean では strict に頼らない）。

::: warning
query / フォームはほぼ文字列；query に strict() を付けるとページ全体 400 になりがち。
:::

### transform(fn)

検証（デフォルト含む）成功後、値を望む形にする；**推論型は戻り値に追随**。

**いつ使うか：** query で CSV、大小文字正規化、入口で業務 enum に変換。

```typescript
import { rule } from '@aomex/common';

rule.string().transform((s) => {
  return s.split(',').map((x) => {
    return x.trim();
  });
}); // [!code highlight]

rule.string().optional().transform((s) => {
  return s ?? '';
});
```

Promise を返せる。transform 内で権限・クォータなどの業務判定はしない——失敗経路が不明瞭。action / サービス層に残す。transform 付き schema で引数なし [partial()](./schema#partial) が制限されることがある。partial はフィールド名指定のみに。

### docs(schema, mode?)

OpenAPI の description / example などを書き込む。**実行時には影響しない**。

**いつ使うか：** フロント連携、ドキュメント生成で読みやすいフィールド説明が欲しいとき。

```typescript
import { rule } from '@aomex/common';

rule.string().docs({ description: '用户昵称', example: 'Ada' });
rule.string().docs({ title: 'Name' }, 'replace');
```

docs() は OpenAPI メタデータのみ。**実行時検証は変えない**。

| 引数 | いつ使うか |
| --- | --- |
| `mode: 'merge'`（デフォルト） | 既存 docs に追記 |
| `mode: 'replace'` | 丸ごと上書き |

### Validator.has(source, Type)

静的メソッド：バリデーターまたはフィールド表がある検証器クラスを**ネスト含めて含むか**を調べる。

**いつ使うか：** プラグイン、コード生成でたまに；業務 action ではほぼ不要。

```typescript
import { Validator, rule, StringValidator } from '@aomex/common';

Validator.has(rule.string(), StringValidator);
Validator.has({ nest: { name: rule.string() } }, StringValidator);
```

## 次のステップ

- [schema](./schema)（partial / pick / extend）
- [バリデーター一覧](./builtins)（タスクから rule.xxx() を探す）
- [クエリパラメータ](/ja/web/query) / [リクエストボディ](/ja/web/body)（チェーンルールをルートに載せる）
