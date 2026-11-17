---
outline: deep
---

# Web アプリケーション入口

HTTP サービスを起動：`new WebApp` で必須項目を埋め、`routers('./src/routers')` でルートをマウント。サイト言語、クライアント IP、ボディ上限、ルート内 `ctx.send` / `ctx.throw` / `ctx.redirect` もここで触れる。

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

const app = new WebApp({ // [!code focus:7]
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')], // [!code highlight]
});

app.listen(3000, () => {
  console.log('HTTP 服务已启动');
});

declare module '@aomex/web' {
  namespace WebApp {
    type T = WebApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```
`new WebApp({ ... })` で services、logger、language、proxyIP のいずれか欠けるとコンパイルエラー。グローバル mount で `middleware.web` が ctx にフィールドを足したのに `declare module` がないと実行時はあるが型に無く、業務で as が増える。ルートに [response()](/ja/web/response) があれば send/throw body 形状が宣言に追従。

::: warning
グローバル mount で ctx にフィールドを足し `declare module` を書かないと、実行時はあるが型に無い。業務で as が増える。
:::

```bash
node --import tsx/esm --watch src/web.ts
```
ブラウザで [http://localhost:3000](http://localhost:3000)。起動コマンドを package.json scripts に置き、`pnpm start` でチーム統一を推奨。

以下は `new WebApp({ ... })` 内の項目。ルートは「このパスで何をするか」。こちらは「サイト全体の動き方」。

## services と logger

`services` は業務コンテナ（DB、キャッシュ、メール等）。[combineServices](/ja/core/service) 後 WebApp へ。プロセス停止時、フレームワークは読み込み済みサービスに destroy を呼び接続切断・ログ flush。

`logger` は別途再渡し必須（多くは `services.logger` と同一参照）。ルート・ミドルウェアの `ctx.logger` はこのインスタンス。

```typescript
const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```
## language

**body() / query() 検証失敗とフレームワーク内蔵メッセージ**の言語。言語コードは `zh-CN`、`en-US`（ハイフン。`zh_CN` 不可）。フレームワーク側文案。Ant Design / Day.js の locale や業務文言ではない——業務多言語は [上級：ビジネス i18n](/ja/advanced/i18n)。

| モード | いつ |
| --- | --- |
| `fixed` + `language` | イントラネット管理画面、単一言語 SaaS。リクエストヘッダ不要 |
| `dynamic` | 公開マルチクライアント API。リクエストで協議 |
| `header: 'accept-language'` | ブラウザ、標準クライアント（RFC `q` 順） |
| `header: 'x-language'` | アプリ独自ヘッダ（カンマ区切り、多くは `q` 無視） |
| `fallback` | ヘッダ欠損・未知時のフォールバック |

固定言語：

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```
Accept-Language 協議：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```
カスタムヘッダ：

```typescript
language: {
  mode: 'dynamic',
  header: 'x-language', // [!code highlight]
  fallback: 'zh-CN',
},
```
自己テスト：

```bash
curl -H 'Accept-Language: en-US' http://localhost:3000/users
```
::: warning
遅いミドルウェアで言語を変えない——その前の body()/query() は既にデフォルト言語でエラーかもしれない。フレームワーク文案は WebApp.language に任せる。Console は文字列固定のみ。[Console アプリケーション入口](/ja/console/#language)。
:::

## proxyIP

`ctx.request.ip` を埋める。誤設定はレート制限・リスク管理の誤判定。

| モード | いつ |
| --- | --- |
| `detect` | ローカル `tsx`、単体テスト。前段プロキシ不明でもとりあえず動かす |
| `specify` | インターネット公開の本番。自社リバプロが書いたヘッダだけ信じ、`X-Forwarded-For` 偽造を防ぐ |

```typescript
proxyIP: { mode: 'detect' },
```
::: warning
インターネット公開の本番で detect を長期使わない。クライアントが一般的プロキシヘッダを偽造でき、レート制限・監査が誤る。本番は specify で自社リバプロのヘッダだけ。
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```
hops は実プロキシ段数と一致。さもないと1つ前のイントラネットや CDN ノードを読む。ログイン異常地通知などが狂う。

| トポロジ | 典型設定 |
| --- | --- |
| Node がインターネット直結 / 開発機直結 | `detect` または specify でプロキシヘッダ読まない |
| Nginx 1段 → Node | `specify` + `x-forwarded-for`、`hops: 1` |
| CDN + 自社 Nginx | `x-forwarded-for`、`hops: 2`（実段数に合わせる） |
| Cloudflare のみ | `specify` + `cf-connecting-ip`、`hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```
## mount

`mount` はサイト全体ミドルウェア列。各リクエストが配列順に入る（オニオン、`await next()` 前後で処理）。CORS、サイト認証、アクセスログ、`routers('./src/routers')` はここ。

一部 URL だけ効かせたいロジックは [Router](/ja/web/router) か単一ルート mount へ。WebApp に全部詰めない。

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      await ctx.logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```
## shutdown

`SIGTERM` / `SIGINT`（`docker stop`、Ctrl+C、K8s ローリング等）で WebApp は**グレースフル停止**：新接続停止、処理中リクエストをできるだけ完了、services 破棄、終了コード 0。

`timeout` は最長待ち（デフォルト約 **5 秒**。ミリ秒や `'10s'` 等）。期限後も接続があれば強制切断。プロセス固着でリリースが止まらないように。

```typescript
shutdown: { timeout: 10_000 },
```
ローカルはほぼデフォルトのまま。本番でアップロード、ロングポーリング、遅いクエリがあるなら最悪リクエスト時間に合わせて延長。停止中は新規リクエスト不可——LB は先にインスタンスを外してからシグナル。[clusterListen](/ja/advanced/cluster#clusterlisten) を使う場合、primary もシグナルを受け取り各 worker の終了を調整します。

## body サイトクォータ

アップロードや巨大 JSON webhook の前にデフォルトで足りるか確認。不足ならアプリ級で調整。

| 種類 | 典型 Content-Type | デフォルト（参考） |
| --- | --- | --- |
| `payload` | JSON、urlencoded、text 等をメモリに丸ごと | 約 `2mb`、超過 **413** |
| `formData` | `multipart/form-data` | 単ファイル約 `50mb`、ファイル数・フィールド数上限あり |

```typescript
const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:8]
    payload: { maxSize: '1mb' }, // [!code highlight]
    formData: {
      maxFileSize: '20mb',
      maxFiles: 5,
      maxFields: 50,
    },
  },
  mount: [routers('./src/routers')],
});
```
ルート [body()](/ja/web/body) でファイルフィールドがあるとアプリ級 formData と**厳しい方**。[ファイルアップロード](/ja/web/attach) 参照。

公開 webhook や大 JSON はデフォルトクォータを先に確認。丸ごとメモリで超過は **413**。検証失敗 **400** とは別。ルートだけ変えても body.payload を変えないと足りないことが多い。

## envelope

**成功・失敗で同じ JSON 外殻**、外側 HTTP **200** 固定（実コードは body 内）なら `new WebApp` で `envelope`。ルートは従来 send/throw、フレームワークが書き出し前にラップ。

宣言ツリーは `envelope.success` / `envelope.payload` / `envelope.statusCode` と任意 `envelope.slot`。[formatError](/ja/web/errors) と併用が多い。詳細・スキップ規則（リダイレクト、204、SSE 等）は [レスポンスエンベロープ](/ja/web/envelope)。

## listen、http、https

`listen` が HTTP をポートにバインド。呼ばないと App オブジェクトだけで外から来ない。`app.listen(port)` は `app.http({}).listen(port)` 相当。平文 HTTP。

```typescript
app.http({ keepAliveTimeout: 65_000 }).listen(3000);
```

```typescript
import fs from 'node:fs';
import path from 'node:path';

app
  .https({
    key: fs.readFileSync(path.resolve('ca', 'cert.key')),
    cert: fs.readFileSync(path.resolve('ca', 'cert.pem')),
  }) // [!code highlight]
  .listen(443);
```
本番は Nginx / Caddy で TLS 終端し Node HTTP へリバプロ——proxyIP も正しく。

マルチプロセス、Docker scale、K8s レプリカ、PM2、`clusterListen` は [マルチプロセスとスケール](/ja/advanced/cluster)。

## ctx.send

ルート action やグローバルミドルウェア。ステータス省略は **200**。201、204 等は第一引数に明示。

```typescript
router.get('/ping', {
  action: async (ctx) => {
    ctx.send('plain text'); // [!code highlight]
  },
});
```

```typescript
router.post('/users', {
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id }); // [!code highlight]
  },
});
```

```typescript
router.delete('/sessions/current', {
  action: async (ctx) => {
    await revokeSession(ctx);
    ctx.send(204); // [!code highlight]
  },
});
```
## ctx.throw

**4xx / 5xx** のみ。業務拒否は ctx.throw。`throw new Error` にしない——公開 4xx が 5xx としてログを汚しにくい。

```typescript
router.get('/users/:id', { // [!code focus:12]
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    const user = await findUser(ctx.params.id);
    if (!user) {
      ctx.throw(404); // [!code highlight]
    }
    if (!canView(ctx, user)) {
      ctx.throw(403, { code: 'FORBIDDEN' });
    }
    ctx.send(user);
  },
});
```

```typescript
ctx.throw(500, 'payment gateway timeout', { expose: true });
```
`expose: true` ならレスポンスに message——SQL・内部パスを入れない。

## ctx.redirect

永久 **301**、一時は多く **302**（省略時デフォルト 302）。

```typescript
router.get('/old-profile', {
  action: async (ctx) => {
    ctx.redirect(301, '/profile'); // [!code highlight]
  },
});
```

```typescript
router.get('/login-done', {
  action: async (ctx) => {
    ctx.redirect('/dashboard'); // [!code highlight]
  },
});
```
## download、sse、logger

ルートでよく使う出口。詳細は専用ページ。ここは顔合わせ：

- `ctx.download`：ファイルストリーム送出。ストリーム終了で Promise settle。「落として消す」一時ファイル向け。
- `ctx.sse()`：SSE。[SSE](/ja/web/sse)。
- `ctx.logger`：WebApp 構築時に渡した logger。`requestId` 等は [ログ · withBindings](/ja/core/logger#リクエスト単位のコンテキストwithbindings)。

### app.on('error')

action/ミドルウェアで捕捉されない例外は `emit('error', err, ctx)`。デフォルトは `expose` で logger.error するか決める。追加リスナーは Sentry、Slack など旁路通知向け。

**ここでレスポンス body を変えない**——タイミングが遅く既存レスポンスと競合しやすい。統一 JSON エラーは [formatError](/ja/web/errors)。成功失敗同じ外殻・外側 200 は [レスポンスエンベロープ](/ja/web/envelope)。

## 次のステップ

- [インターフェースルーティング](/ja/web/router)：URL と HTTP 動詞のファイル分割
- [query](/ja/web/query) / [params](/ja/web/params) / [body](/ja/web/body)：入参検証三種
- [レスポンス制約](/ja/web/response)：TypeScript と OpenAPI を一致
- [SSE](/ja/web/sse)：ctx.sse / stream / 断線続き
- [エラー形式](/ja/web/errors)：`ctx.throw` 後の JSON
- [レスポンスエンベロープ](/ja/web/envelope)：統一 JSON 外殻・HTTP 200
- [マルチプロセスとスケール](/ja/advanced/cluster)：Docker / K8s / PM2 / `clusterListen`
