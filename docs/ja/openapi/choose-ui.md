---
outline: deep
---

# ドキュメント UI の選び方

aomex にはドキュメントページ用プラグインが 3 つある：[Swagger UI](/ja/openapi/swagger-ui)、[Redoc UI](/ja/openapi/redoc-ui)、[Scalar UI](/ja/openapi/scalar-ui)。読み込むのは**同じ** OpenAPI 契約（ファイルに出力した `openapi.json` / yaml、または実行時の `generateOpenapi`）で、違いは**閲覧体験**と**ページ内で試せるか**にある。

本ページは読者とシナリオで選ぶための目安。パッケージの導入、`mount` の掛け方、`uriPrefix` / `enable` などの細部は各 UI 専用ページへ。契約の生成方法は [生成OpenAPI](/ja/openapi/)。

## 一言で比較

| | [Swagger UI](/ja/openapi/swagger-ui) | [Redoc UI](/ja/openapi/redoc-ui) | [Scalar UI](/ja/openapi/scalar-ui) |
| --- | --- | --- | --- |
| デフォルト接頭辞 | `/swagger` | `/redoc` | `/scalar` |
| ページ内試行 | あり（Try it out） | **なし** | あり |
| 閲覧体験 | 操作台寄り、項目が密 | 左ナビ、長文向き | モダンな体裁、閲覧と試行の両立 |
| 典型的な読者 | 開発、QA 連携 | プロダクト、連携先、引き継ぎ資料 | 読みながら手元で叩きたい人 |
| パッケージ名 | `@aomex/swagger-ui` | `@aomex/redoc-ui` | `@aomex/scalar-ui` |

3 つとも普通の Web ミドルウェアで、掛けるだけでページが出る。業務ルート上の `ctx` の型は**変わらない**。サイト全体で [envelope](/ja/web/envelope) を有効にしている場合、ドキュメントページは自動で `skipEnvelope` され、ラップされない。

## シナリオ別の選び方

| いまやっていること | 優先候補 | 理由 |
| --- | --- | --- |
| ローカル / 社内で開いてすぐ API を叩く | Swagger または Scalar | ページ内から実リクエスト可能。Try it out に慣れたチームなら Swagger、より新しい UI なら Scalar |
| 連携先に「説明書」URL を渡す | Redoc | 長文・schema の折りたたみが見やすい。ページ内試行は期待しない |
| 外向け PDF / 週報添付の API 説明 | Redoc | 印刷・スクロール閲覧向き |
| 新人オンボーディング：先に読んでから試す | Scalar、または Redoc + Swagger を併存 | 1 ページで読んで試す；または「読む」と「叩く」を別 URL |
| 既存プロジェクトで Swagger しか知らない同僚 | Swagger のまま | 学習コスト最小。見た目の差で作り直す必要はない |
| 読者が複数（プロダクト + 開発） | **併存**し、`uriPrefix` を分ける | 同じ契約で複数 UI。下文参照 |

迷ったら：開発期は **Scalar** か **Swagger** のどちらか 1 つで十分。外向け説明には **Redoc** を足す。「3 択 1」に縛られない——契約のソースは 1 つだけ。

## 能力の境界（取り違えない）

**ページ内試行**＝ブラウザでパラメータ入力・認証付きで実サービス（またはゲートウェイ越し）へ叩く。Swagger と Scalar はあり、Redoc は**なし**。

```typescript
// Redoc 只负责展示契约——联调请另开 Swagger / Scalar / Postman
mount: [
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc-…' }),
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger-…' }),
  routers('./src/routers'),
],
```

::: warning
QA や連携先に Redoc を「Try it out できる Swagger」と思わせない。リンクを間違えると読むだけで叩けず、壊れていると誤解される。
:::

その他の境界：

- ドキュメント UI は**認可の代わりにならない**。パブリック公開は API の地図を渡すのと同じ（試行できる UI は試行入口も渡す）。
- デフォルトの `/swagger`、`/redoc`、`/scalar` は当たりやすい——`uriPrefix` には**ランダムな文字列**を入れ、`enable` / 社内網 / ゲートウェイと組み合わせる。細則は各 UI 専用ページ。
- 動的 `openapi: () => generateOpenapi(...)` では本番と同じ `app` を渡す。そうしないと security / envelope が実環境とずれる。

## 同一サイトでの併存

3 つ（または任意の 2 つ）を同じ `WebApp` に載せられる。**接頭辞は必ず分ける**。契約ファイルは共有可能：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { redocUI } from '@aomex/redoc-ui';
import { scalarUI } from '@aomex/scalar-ui';

mount: [ // [!code focus:13]
  swaggerUI({
    openapi: './openapi.json',
    uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  }),
  redocUI({
    openapi: './openapi.json',
    uriPrefix: '/redoc-a1b2c3d4e5f60718',
  }),
  scalarUI({
    openapi: './openapi.json',
    uriPrefix: '/scalar-9f8e7d6c5b4a3210',
  }),
  routers('./src/routers'),
],
```

本番を社内だけに開く、IP / token で切る場合、3 つの `enable` は同じ判定に揃える（コピーまたは関数化）と、どれか1つだけ開きっぱなしを防げる。

## 「契約生成」との組み合わせ

| 契約の出どころ | UI の読み方 |
| --- | --- |
| CI の `aomex openapi` でファイル出力 | 3 つとも `openapi: './openapi.json'`（または yaml）——ルート変更後は再出力 |
| 実行時 `generateOpenapi` | `openapi: () => generateOpenapi({ routers, app })`——ファイル不要、同じ `app` に注意 |
| 連携先向け静的サイトだけ | 多くは Redoc + 出力済みファイル；試行入口は社内 |

ドキュメントサイトがオンラインで全ルートを毎回スキャンすると CPU を食う。本番の外向けページは多く **ファイル読み込み + UI**。開発期は動的生成の方が楽。出力の手順は [生成OpenAPI](/ja/openapi/)。

## 選定クイックリファレンス

| 質問 | 答え |
| --- | --- |
| 1 つだけ、試行が欲しい | Scalar または Swagger |
| 1 つだけ、見やすい説明書 | Redoc |
| プロダクトが読み、開発が叩く | Redoc +（Swagger または Scalar） |
| チームが Swagger のブックマーク / 録画前提 | いきなり換えず Redoc / Scalar を追加 |
| パブリックスキャンが心配 | ランダム `uriPrefix` + `enable`、3 つ同様 |

導入後の設定、本番の `enable`、ランダム接頭辞の例：

- [Swagger UI](/ja/openapi/swagger-ui)
- [Redoc UI](/ja/openapi/redoc-ui)
- [Scalar UI](/ja/openapi/scalar-ui)

## 関連

- [OpenAPI を生成](/ja/openapi/)
- [タグ](/ja/openapi/tags)
- [Markdown 記述](/ja/openapi/markdown)
- [Swagger UI](/ja/openapi/swagger-ui) · [Redoc UI](/ja/openapi/redoc-ui) · [Scalar UI](/ja/openapi/scalar-ui)