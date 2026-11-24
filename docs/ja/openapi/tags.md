---
outline: deep
---

# タグ

OpenAPI は **tag** で API をサイドバーのグループに分ける（Swagger / Redoc の左列）。aomex がルートを走査するとき、各 operation に tags を付ける。書いていない場合、既定は**ルートファイル名**（拡張子なし）。

## Router で一括してタグを付ける

同一ファイル・同一ドメインの API は、`new Router` に一度書けばよい——そのファイル内の各ルートの `docs` に浅いマージで入る：

```typescript
import { Router } from '@aomex/web';

export const router = new Router({ // [!code focus:4]
  prefix: '/users',
  docs: { tags: ['User'] }, // [!code highlight]
});

router.get('/', {
  docs: { summary: '用户列表' },
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  docs: { summary: '用户详情' },
  action: async (ctx) => {
    ctx.send({ id: 1 });
  },
});
```

2 本のルートはどちらもドキュメント上 **User** グループに入る。ファイル名が `user.router.ts` で tags を書かない場合、既定 tag は `user.router`——読みにくいので、ドメイン単位のファイルでは明示的に書くことを推奨する。

## ルート単位で上書き・追記

メソッド級 `docs` と Router 級は**浅いマージ**（後から書いた方が先を上書き）。`summary` だけ変えるときは Router の `tags` は残る。メソッド側にも `tags` を書くと Router の tags は**丸ごと置き換え**となり、配列は自動マージされない。

```typescript
export const router = new Router({
  prefix: '/orders',
  docs: { tags: ['Order'] },
});

router.get('/export', {
  docs: { // [!code focus:4]
    tags: ['Order', 'Export'], // [!code highlight]
    summary: '导出订单',
  },
  action: async (ctx) => {
    ctx.send('ok');
  },
});
```

複数ドメインにまたがる API は、同じ `tags` 配列に複数の名前を入れればよい。

## タグ自体に説明を書く

ルート上の `tags: ['User']` が渡すのは**名前だけ**。ドキュメント上部でグループに紹介文（Markdown 可）を付けるには、`generateOpenapi` の `docs.tags` で同名エントリを宣言する：

```typescript
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from './app.js';

await generateOpenapi({
  routers: './src/routers',
  app,
  docs: { // [!code focus:12]
    info: { title: 'My API', version: '1.0.0' },
    tags: [
      {
        name: 'User',
        description: '用户与资料。\n\n- 列表分页从 **1** 起\n- 详情 404 表示不存在', // [!code highlight]
      },
      { name: 'Order', description: '下单与履约' },
    ],
  },
});
```

生成後、ルートで使われたが `docs.tags` に未宣言の名前は、フレームワークが `document.tags` に**自動追加**する（`name` のみ、`description` なし）。グループの文言や並びを制御したい場合は、`docs.tags` によく使うグループを先に書いておく。

長い Markdown（見出し・リスト・リンク）の書き方は [Markdown 記述](/ja/openapi/markdown) を参照。

## showInOpenapi との関係

契約に載せないルートは `docs: { showInOpenapi: false }`（例：自前の `/openapi.json`）。その tags は used リストに入らず、空グループの原因にもならない。

## 次のステップ

- [Markdown 記述](/ja/openapi/markdown)：`info` / ルートの `description` で長文を書く
- [OpenAPI を生成](/ja/openapi/)：`generateOpenapi` と `app`
- [Swagger UI](/ja/openapi/swagger-ui) · [Redoc UI](/ja/openapi/redoc-ui)：ブラウザでグループ表示を確認