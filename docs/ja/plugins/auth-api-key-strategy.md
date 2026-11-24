---
outline: deep
---

# API Key ストラテジー

スクリプト、協力先、内部サービスに「鍵を付ければ呼べる」通路を一本用意する。AuthApiKeyStrategy はヘッダー（または設定した query/cookie）から**素の**鍵を読み、アプリ身分にマップする——Bearer のような二段式ではない。エンドユーザーのログインは [Bearer](/ja/plugins/auth-bearer-strategy) または [JWT](/ja/plugins/auth-jwt-strategy)。

x-api-key（またはカスタムヘッダー）を検証し、通ったあと業務では ctx.auth.apiKey を使う。オープンプラットフォームはユーザーログイン域と別の Router プレフィックスに分けられる。

## インストール

Bearer と同じく `@aomex/auth` 本体を使う。

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
```

## オープンプラットフォーム Router

```typescript
import { Auth } from '@aomex/auth';
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    apiKey: new AuthApiKeyStrategy({
      onLoaded: async (key) => {
        const app = await clients.verify(key);
        if (!app) {
          return false;
        }
        return { appId: app.id, scopes: app.scopes };
      },
    }),
  },
});

const openApi = new Router({
  prefix: '/open',
  mount: [auth.authenticate('apiKey')], // [!code highlight]
});

openApi.get('/usage', {
  action: async (ctx) => {
    ctx.send({ appId: ctx.auth.apiKey.data.appId });
  },
});
```

ユーザー Bearer と共存させるときは、ストラテジー名をそれぞれ管理し、別の Router に載せればよい。

成功後：

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

authorize('apiKey', …) の追加引数の型は、Bearer と同じく、書いた onAuthorize から来る。onAuthorize が無いときは、だいたい「合法な key があるか」の一層だけ。

## 複数ソースから Key を取る・レート制限の次元

`onLoaded` は必須：key を検証しアプリ身分を返す。デフォルトはヘッダー `x-api-key` のみ。header / query / cookie を順に試すなら `keyLoaders` を書く。scope やプランでさらに締めるなら `onAuthorize` を足す。

対応する loader：header（ヘッダーの素値。key 名は小文字で照合）、query（慎重に。ログに入りやすい）、cookie。**body から Key は読めない**。鍵がリクエスト本体のログに落ちないようにする。本番は header 優先。

```typescript
new AuthApiKeyStrategy({
  keyLoaders: [ // [!code highlight]
    { type: 'header', key: 'x-api-key' },
    { type: 'query', key: 'api_key' },
  ],
  onLoaded: async (key) => {
    return lookup(key);
  },
});
```


signature() は乱数 Key 串の生成に使える（新しいクライアント発行時）。使い方は Bearer ストラテジーに近い。

[@aomex/rate-limit](/ja/plugins/rate-limit) と組み合わせるときは、key をクォータ次元にできる——通常はレート制限の前に認証が終わっていること、または自分で header から key を読むこと：

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI は apiKey scheme を注入する。in / name はだいたい**最初の** keyLoader から取る。

::: warning
鍵の漏洩は権限の漏洩。保存はハッシュ、ローテーションを支え、平文を長く庫に寝かせない。API Key はエンドユーザーログインの代わりではない。端末プロダクトは引き続き Bearer/JWT。
:::

ユーザー session と API Key を同じルートグループに混ぜない。オープンプラットフォームは単独の prefix + authenticate('apiKey') の方がはっきりする。

## 関連

- [認証](/ja/plugins/auth)
- [Bearer ストラテジー](/ja/plugins/auth-bearer-strategy)
- [レート制限](/ja/plugins/rate-limit)
