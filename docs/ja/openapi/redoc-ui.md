---
outline: deep
---

# Redoc UI

プロダクトや連携先向けに、**長文閲覧向き**の API 説明を載せる。左ナビ、折りたたみ schema で Swagger よりすっきり。**ページ内から直接試行はできない**——連携は [Swagger UI](/ja/openapi/swagger-ui)、[Scalar UI](/ja/openapi/scalar-ui)、または自前クライアント。複数 UI を同一サイトで併存可。**ルート接頭辞の重複に注意**。

契約の出どころ：[生成OpenAPI](/ja/openapi/)。

```bash
pnpm add @aomex/redoc-ui
```

mount に redocUI を載せると、チームが /redoc（デフォルト）で同じ OpenAPI（JSON または YAML パス）を読める。

## Swagger と接頭辞を分けて併存

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // 或与 Swagger 一样用函数：
    // openapi: () => {
    //   return generateOpenapi({
    //     routers: './src/routers',
    //     app,
    //   });
    // },
  }),
  routers('./src/routers'),
],
```

Swagger と併用する場合：

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc は**ページ内試行不可**。QA に Swagger の代わりと思わせない。他 UI と併存時は `uriPrefix` を分け、**ランダム文字列**（例 `/redoc-7c3e9a1f02b48d6e`）を入れるとスキャン後の悪用リスクを下げやすい——詳細は [Swagger UI](/ja/openapi/swagger-ui)。
:::

Swagger UI と同様、redocUI は Web ミドルウェア設定で、業務ルート上の ctx の型は変わらない。`openapi` は文字列パス、または Document を非同期返す関数。関数の場合 `generateOpenapi` のオプション型は [生成OpenAPI](/ja/openapi/) と同じ。

アクセス制御、`uriPrefix`（ランダム文字列含む）、`enable` などは Swagger / Scalar と**同じ考え方**——具体フィールドはインストールパッケージの型ヒントに従う。

```typescript
redocUI({
  openapi: './openapi.json',
  uriPrefix: '/redoc-7c3e9a1f02b48d6e',
});
```

Swagger / Scalar との比較、併存、シナリオ選定は [ドキュメント UI の選び方](/ja/openapi/choose-ui)。静的 `openapi.yaml` のパス誤りやビルドでファイル未コピーだと本番 404。契約がファイル出力の場合、ルート変更後は [生成OpenAPI](/ja/openapi/) を再実行。

## 関連

- [ドキュメント UI の選び方](/ja/openapi/choose-ui)
- [Swagger UI](/ja/openapi/swagger-ui) · [Scalar UI](/ja/openapi/scalar-ui)
- [生成OpenAPI](/ja/openapi/)