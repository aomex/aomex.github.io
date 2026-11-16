---
outline: deep
---

# API Key 戦略

スクリプト、パートナー、内部向けに「鍵があれば呼べる」経路。AuthApiKeyStrategy はヘッダー（または設定した query/cookie）から**生**の鍵を読み、アプリ身元にマップ——Bearer のような二段式**ではない**。エンドユーザー向けログインは [Bearer](/ja/plugins/auth-bearer-strategy) または [JWT](/ja/plugins/auth-jwt-strategy)。

x-api-key（またはカスタムヘッダー）を検証し、通過後業務で ctx.auth.apiKey。オープン API はユーザーログイン領域と Router プレフィックスを分けられる。

## インストール

Bearer と共通で `@aomex/auth` メインパッケージ。

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

ユーザー Bearer と併存するときは戦略名が別々、別 Router にマウントすればよい。

成功後：

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

authorize('apiKey', …) の追加引数の型は Bearer と同様、onAuthorize の定義から。onAuthorize なしのときは多く「合法な key があるか」だけ。

## keyLoaders とレート制限の次元

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `keyLoaders` | header / query / cookie を順に試す | `[{ type: 'header', key: 'x-api-key' }]` |
| `onLoaded` | key を検証しアプリ身元を返す | **必須** |
| `onAuthorize` | scope、プランなどでさらに絞る | 任意 |

対応 loader：

- header — ヘッダー生値（key 名は小文字で照合）
- query — 慎重に。ログに残りやすい
- cookie — チーム約束

**body から Key は読まない**。鍵がリクエストボディログに落ちないため。query の key はアクセスログに入る。本番は header 優先。

複数ソースのフォールバック例：

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

signature() でランダム Key 文字列を生成（新クライアント発行時）。Bearer 戦略と同様。

[@aomex/rate-limit](/ja/plugins/rate-limit) と組み合わせ、key でクォータ次元——レート制限の前に認証完了、または自分で header から key を読む：

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI は apiKey scheme を注入。in / name は多く**最初**の keyLoader から。

::: warning
鍵漏洩は権限漏洩：DB にはハッシュ、ローテーションを支援。平文を長期放置しない。API Key は C 向けログインの代替ではない。エンド製品は Bearer/JWT。

:::

ユーザーセッションと API Key を同一路由群に混ぜない。オープン API は別 prefix + authenticate('apiKey') が明確。

## 関連

- [認証](/ja/plugins/auth)
- [Bearer 戦略](/ja/plugins/auth-bearer-strategy)
- [レート制限](/ja/plugins/rate-limit)