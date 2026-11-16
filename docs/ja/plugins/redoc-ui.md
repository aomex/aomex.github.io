---
outline: deep
---

# Redoc UI

プロダクト・連携先向けに**長文読み向け** API 説明。左ナビ、schema 折りたたみ。Swagger よりすっきり。Redoc は**ページ内で試せない**——試すなら [Swagger UI](/ja/plugins/swagger-ui) か自前クライアント。両 UI を同居可。**ルートプレフィックスの衝突に注意**。

契約の出所：[OpenAPI 生成](/ja/plugins/openapi) · [OpenAPI のファイル出力](/ja/console/openapi)。

```bash
pnpm add @aomex/redoc-ui
```

mount に redocUI。チームは /redoc（既定）で同一 OpenAPI（JSON または YAML パス）を読める。

## Swagger とプレフィックス分離で共存

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

Swagger と併存するとき：

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc **はページ内試行不可**。QA に Swagger 代替にさせない。Swagger 併存時 uriPrefix を分ける（例 /redoc と /swagger）。
:::

Swagger UI と同様：redocUI は Web ミドルウェア設定。業務ルートの ctx 型は変えない。openapi は文字列パスまたは Document を返す非同期関数。関数時 `generateOpenapi` オプション型は [OpenAPI 生成](/ja/plugins/openapi) と一致。

アクセス制御、uriPrefix、enable 等は Swagger プラグイン**と同じ考え方**——詳細はインストールパッケージの型ヒントに従い補完。

## Redoc を Swagger より選ぶとき

| いつ | 推奨 |
| --- | --- |
| 対外 PDF / 引き渡し | Redoc の読みやすさ。ファイル出力した契約 + 固定 URL |
| 開発自試・ API 叩き | Swagger UI または Postman 追加 |
| 契約が頻繁に変わる | `openapi: () => generateOpenapi(...)`、または CI ファイル出力後両者が同一ファイル |
| 本番公開 | Swagger 同様 `enable` / 社内 / ゲートウェイ認証 |

静的 openapi.yaml パス誤りやビルド未コピーで本番 404。ファイル出力した契約ならルート変更後 [OpenAPI のファイル出力](/ja/console/openapi) を再実行。

## 関連

- [Swagger UI](/ja/plugins/swagger-ui)
- [OpenAPI 生成](/ja/plugins/openapi)
- [OpenAPI のファイル出力](/ja/console/openapi)