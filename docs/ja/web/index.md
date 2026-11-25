---
outline: deep
---

# Web アプリケーション入口

HTTP サービスを起動する：`new WebApp` で必須項目を埋め、`routers('./src/routers')` でルートを掛ける。以下ではサイト全体の言語、クライアント IP、リクエストボディ上限、およびルート内の `ctx.send` / `ctx.throw` / `ctx.redirect` も説明する。

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';
import { services } from '@/services';

const app = new WebApp({ // [!code focus:7]
  services,
  logger, // [!code highlight]
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

`new WebApp({ ... })` で `services`、`logger`、`language`、`proxyIP` のいずれかを欠くとコンパイラがエラーにする。グローバル `mount` で `middleware.web` が `ctx` にフィールドを載せたのに上の `declare module` がないと、実行時には値があるのに型にない——業務で `as` が増える。ルートに [response()](/ja/web/response) があると `ctx.send` / `ctx.throw` の body 形状は宣言に沿って絞られる。

::: warning
グローバル `mount` で `ctx` にフィールドを載せたのに `declare module` を書かないと、実行時には値があるのに型にない——業務で `as` が増える。
:::

```bash
node --import tsx/esm --watch src/web.ts
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く。起動コマンドは `package.json` の scripts に入れ、チームで `pnpm start` に揃えるとよい。

以下のフィールドはすべて `new WebApp({ ... })` で触る。ルートは「このパスで何をするか」、ここは「サイト全体をどう回すか」。

## services と logger

`services` は業務サービスコンテナ（DB、メールなど）。 [combineServices](/ja/core/service) で組み立てて `WebApp` に渡す。プロセス終了時、フレームワークは破棄段階で読み込み済みサービスの `destroy` を呼び、接続を閉じる。

`logger` は [`Logger`](/ja/core/logger) インスタンス（`new Logger({ transports })`）。業務では `import { logger } from '@/services/logger.service'`；`ctx.logger` は同一参照で、サードパーティ middleware と app 内 middleware 向け。キャッシュは [`Caching`](/ja/core/cache)。

```typescript
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services, // [!code highlight]
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## language

**`body()` / `query()` 検証失敗とフレームワーク組み込みメッセージ**の言語。言語コードは `zh-CN`、`en-US`（ハイフン；`zh_CN` は不可）。フレームワーク側の文言であり、Ant Design / Day.js の locale や業務 i18n ではない——業務の多言語は [上級：業務 i18n](/ja/advanced/i18n)。

| モード | いつ使うか |
| --- | --- |
| `fixed` + `language` | イントラ管理、単一言語 SaaS。リクエストヘッダーを読まない |
| `dynamic` | 公開マルチクライアント API。リクエストで協議 |
| `header: 'accept-language'` | ブラウザ、標準クライアント（RFC の `q` でソート） |
| `header: 'x-language'` | アプリ独自ヘッダー（カンマ区切り、`q` は通常無視） |
| `fallback` | ヘッダー欠落・未認識時のフォールバック |

固定言語：

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```

Accept-Language で協議：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

カスタムヘッダー：

```typescript
language: {
  mode: 'dynamic',
  header: 'x-language', // [!code highlight]
  fallback: 'zh-CN',
},
```

動作確認：

```bash
curl -H 'Accept-Language: en-US' http://localhost:3000/users
```

::: warning
遅い middleware で言語を変えない——その前に `body()` / `query()` がデフォルト言語で既にエラーを返しているかもしれない。フレームワーク文言は `WebApp.language` に任せる。Console 側は文字列固定のみ、 [Console アプリ入口](/ja/console/#language) 参照。
:::

## proxyIP

`ctx.request.ip` を埋める。誤設定はレート制限・リスク管理の対象者を間違える。

| モード | いつ使うか |
| --- | --- |
| `detect` | ローカル `tsx`、単体テスト。前面にリバースプロキシがあるか不明なとき、まず動かす |
| `specify` | 公網本番：自社プロキシが書いたヘッダーだけ信頼し、クライアントの `X-Forwarded-For` 偽造を防ぐ |

```typescript
proxyIP: { mode: 'detect' },
```

::: warning
公網本番で `detect` を長期使わない。クライアントが一般的なプロキシヘッダーを偽造でき、レート制限と監査が人を取り違える。本番は `specify` で自社プロキシのヘッダーだけ信頼する。
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```

`hops` は実際のプロキシ段数と一致させる。ずれると前跳び内網アドレスや CDN ノードを読み、ログイン異常検知などが狂う。

| トポロジ | よくある設定 |
| --- | --- |
| Node が公網直結 / 開発機直結 | `detect` またはプロキシヘッダーを読まない `specify` |
| 1 段 Nginx → Node | `specify` + `x-forwarded-for`、`hops: 1` |
| CDN + 自社 Nginx | `x-forwarded-for`、`hops: 2`（実際の段数に合わせる） |
| トラフィックが Cloudflare のみ | `specify` + `cf-connecting-ip`、`hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```

## mount

`mount` はサイト全体のミドルウェアキュー。各リクエストが配列順に入る（オニオンモデル、`await next()` の前後で処理）。CORS、サイト全体の認証、アクセスログ、`routers('./src/routers')` でスキャンした API はここ。

特定 URL グループだけのロジックは [Router](/ja/web/router) または単一ルートの mount へ。`WebApp` に全部詰めない。

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```

## shutdown

`SIGTERM` / `SIGINT`（`docker stop`、Ctrl+C、K8s ローリングなど）を受けると WebApp は**グレースフルシャットダウン**：新規接続を止め、進行中リクエストをできるだけ完了させ、`services` を破棄し、終了コード 0 で終了。

`timeout` は最長待ち時間（デフォルト約 **5 秒**、ミリ秒または `'10s'` など）。期限時に接続が残れば強制切断し、デプロイでプロセスが固まるのを防ぐ。

```typescript
shutdown: { timeout: 10_000 },
```

ローカル開発ではめったに変更しない。本番でアップロード、ロングポーリング、遅いクエリがあるなら最悪のリクエスト時間に合わせて延ばす。シャットダウン中は新規リクエスト不可——ロードバランサは先にインスタンスを外してからシグナルを送る。[clusterListen](/ja/advanced/cluster#clusterlisten) 使用時、primary もシグナルを受け各 worker の終了を調整。

## body のサイト全体クォータ

アップロードや大きな JSON の webhook を開く前にデフォルトで足りるか確認。足りなければアプリレベルで厳しく/緩くする。

| 種類 | 典型 Content-Type | デフォルト（参考） |
| --- | --- | --- |
| `payload` | JSON、urlencoded、text などメモリに全体読み込み | 約 `2mb`、超過 **413** |
| `formData` | `multipart/form-data` | 単一ファイル約 `50mb`、ファイル数・フィールド数に上限 |

```typescript
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
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

ルートの [body()](/ja/web/body) でファイルフィールドを宣言すると、アプリレベルの `formData` 上限と**より厳しい方**が効く。アップロード詳細は [ファイルアップロード](/ja/web/attach)。

公開 webhook や大 JSON の前にデフォルトクォータを確認：全体が先にメモリに入り、超過は **413** で **400** 検証失敗とは別。ルートだけ変えて `body.payload` を触らないと足りないことが多い。

## envelope

**成功・失敗を同じ JSON 外殻**にし、外側 HTTP を **200** 固定（実ステータスは body 内）するなら `new WebApp` で `envelope`。ルートでは従来どおり `send` / `throw`、書き出し前にラップする。

`envelope.success` / `envelope.payload` / `envelope.statusCode` と任意の `envelope.slot` で宣言ツリーを組む。よく [formatError](/ja/web/errors) と併用。特定ステータスだけ素の応答は `response({ skipEnvelope: true })`。詳細と自動スキップ（リダイレクト、204、SSE 等）は [レスポンスのエンベロープ](/ja/web/envelope)。

## listen、http、https

`listen` が HTTP をポートにバインドする。呼ばないとプロセス内に App だけ残り外部から届かない。`app.listen(port)` は `app.http({}).listen(port)` と同等で平文 HTTP。

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

本番では Nginx / Caddy が TLS を終端し Node HTTP にリバースプロキシすることが多い——`proxyIP` も合わせる。

マルチプロセス、Docker scale、K8s レプリカ、PM2、`clusterListen` は [マルチプロセスとスケール](/ja/advanced/cluster)。

## ctx.send

ルート action またはグローバル middleware で、ステータス省略時デフォルト **200**。201、204 などは第一引数に明示。

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

**4xx / 5xx** のみ。業務拒否は `ctx.throw`、`throw new Error` ではない——公開 4xx を 5xx としてログを汚さない。

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

`expose: true` ではレスポンスに message が出る——SQL や内部パスを入れない。

## ctx.redirect

恒久的 **301**、一時的には **302**（省略時デフォルト 302）。

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

ルートでよく使う出口。専用ページで詳述、ここでは概要のみ：

- `ctx.download`：ファイルストリームをクライアントへ。ストリーム終了後に Promise が settle。「落としてすぐ削除」の一時ファイル向け。
- `ctx.sse()`：Server-Sent Events。[SSE](/ja/web/sse) 参照。
- 業務ログ：`import { logger } from '@/services/logger.service'`（`ctx.logger` と同一；`ctx.logger` はサードパーティ / app 内 middleware 向け）。`requestId` 等は [ログ · withBindings](/ja/core/logger#リクエスト単位のコンテキストwithbindings)。

### app.on('error')

action / middleware で捕まえられない例外は `emit('error', err, ctx)`。デフォルトは `expose` で `logger.error` するか決定済み。このイベントは Sentry、チャット通知など旁路向け。

**ここでレスポンス body を変えない**——タイミングが遅く既出レスポンスと衝突しやすい。サイト全体で統一 JSON エラーは [formatError](/ja/web/errors)；成功失敗とも同じ外殻・外側 200 は [レスポンスのエンベロープ](/ja/web/envelope)。

## 次のステップ

- [HTTP ルート](/ja/web/router)：ファイル単位の URL と HTTP 動詞
- [query](/ja/web/query) / [params](/ja/web/params) / [body](/ja/web/body)：入参検証の三つ
- [レスポンスの制約](/ja/web/response)：TypeScript と OpenAPI を揃える
- [SSE](/ja/web/sse)：`ctx.sse` / stream / 再接続
- [エラー形式](/ja/web/errors)：`ctx.throw` 後の JSON エラー体
- [レスポンスのエンベロープ](/ja/web/envelope)：統一 JSON 外殻、外側 HTTP 200
- [マルチプロセスとスケール](/ja/advanced/cluster)：Docker / K8s / PM2 / `clusterListen`