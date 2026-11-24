---
outline: deep
---

# Markdown 記述

OpenAPI の多くの **description** フィールドは **CommonMark** としてレンダリングされる（Swagger UI / Redoc ともに解析）。aomex は独自構文を持たない：文字列に Markdown を書けば、Document に載ったあとドキュメントサイトで表示される。

向いている内容：API の背景、認証の説明、ページングの約束、エラーコード表。`summary` は**1 行の短いタイトル**のままがよい——サイドバーや一覧は主にこちらを見る。

## generateOpenapi で書く

サイト全体の説明は `docs.info.description`；グループ説明は `docs.tags[].description`（ルート上の tag 名と対応。詳しくは [タグ](/ja/openapi/tags)）。

```typescript
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from './app.js';

await generateOpenapi({
  routers: './src/routers',
  app,
  docs: { // [!code focus:18]
    info: {
      title: 'My API',
      version: '1.0.0',
      description: `
面向内部服务的 HTTP API。

## 鉴权

除标注为公开的接口外，请带 \`Authorization: Bearer <token>\`。

## 约定

| 项 | 说明 |
| --- | --- |
| 分页 | \`page\` 从 **1** 起 |
| 时间 | ISO-8601，UTC |
`, // [!code highlight]
    },
    tags: [
      {
        name: 'User',
        description: '用户域。\n\n详见 [用户模型](https://wiki.example.com/user)。',
      },
    ],
  },
});
```

テンプレート文字列の改行は Document に入る。表・見出し・太字・インラインコードは Redoc の方が Swagger より読みやすいことが多い。リンクは通常の Markdown リンクでよい。

::: tip
Console 落盤（`openapi()` / `aomex openapi`）も同じ `docs` を受け取る。フィールドはここと同じで、結果だけファイルになる。
:::

## ルートで書く

1 操作の長い説明はメソッド級 `docs.description`；`summary` は一覧用の短い文。Router 級では `deprecated` なども書け、メソッド級と浅いマージする。

```typescript
import { response, Router } from '@aomex/web';
import { rule } from '@aomex/common';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/:id', { // [!code focus:22]
  docs: {
    summary: '用户详情',
    description: `
按主键取用户。

- 存在 → **200** + 用户对象
- 不存在 → **404**（见全局错误格式）

\`\`\`
GET /users/42
\`\`\`
`, // [!code highlight]
  },
  mount: [
    response({
      statusCode: 200,
      description: '找到用户；body 为资料字段',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '用户不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

`response({ description })` や、バリデータの `rule.*.docs({ description })` にも短い Markdown が書ける（パラメータ説明で複雑な表は控えめに。サイドバーのスペースが限られる）。

```typescript
query({
  page: rule.int().min(1).default(1).docs({
    description: '页码，从 **1** 起', // [!code highlight]
  }),
}),
```

## 書くときの注意

| 場面 | 推奨 |
| --- | --- |
| サイドバー見出し | `summary` を使い、改行を入れない |
| 操作説明 / リクエスト例 | `docs.description` |
| サイト全体の約束 | `generateOpenapi` → `docs.info.description` |
| グループの導入 | `docs.tags[].description` |
| コードフェンス | テンプレート文字列内に \`\`\`；外側の TypeScript fence と衝突する場合はインデントコードブロックにする |

文案を変えたら `generateOpenapi` を再実行するか、動的 Swagger / Redoc を更新しないとレンダリング結果は変わらない。静的 `openapi.json` モードでは [OpenAPI を生成](/ja/openapi/) の手順で再出力する。

## 次のステップ

- [タグ](/ja/openapi/tags)：名前の出どころ、上書きの仕方
- [OpenAPI を生成](/ja/openapi/)：ルート走査と `app` の渡し方
- [Swagger UI](/ja/openapi/swagger-ui) · [Redoc UI](/ja/openapi/redoc-ui)：Markdown のプレビュー