---
outline: deep
---

# 認証

まず二つを分ける：**誰か**（認証）と**何ができるか**（認可）。`@aomex/auth` は複数戦略を一つの Auth インスタンスに集約。身分が通らないときは多く **401**、身分はあるが権限不足は **403**。フロントと監視は「ログインへ」か「アカウント/権限変更へ」を判断できる。

業務 API 群に「先にログイン必須」を付け、少数だけ高いロールが必要。ログイン API 自体には認証を載せず、ログイン後 ctx.auth で身元を読む。

## インストール

実際の戦略に合わせてパッケージを入れる。ログイン未実装なら本稿をロードマップとして読める。

```bash
pnpm add @aomex/auth
# JWT 另装：pnpm add @aomex/auth-jwt-strategy
```

| 戦略パッケージ | 典型的なシーン |
| --- | --- |
| [`@aomex/auth/bearer`](/ja/plugins/auth-bearer-strategy) | 不透明 token、サーバー側セッション |
| [`@aomex/auth/api-key`](/ja/plugins/auth-api-key-strategy) | マシン間、オープンプラットフォーム |
| [`@aomex/auth-jwt-strategy`](/ja/plugins/auth-jwt-strategy) | 自己完結 JWT、DB 参照を減らす |

## Router に authenticate を載せる

`Auth` インスタンスに各戦略（Bearer / API Key / JWT）を登録。`authenticate(name)` は「先に身元を検証」するミドルウェアを返し、Router または単一ルートに載せる。通過後 `ctx.auth[name]` で身元を読める。単一ルートで `authorize` により細かい権限。

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token) => {
        const user = await findUserByToken(token);
        return user ?? false; // false → 401
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

export const router = new Router({ // [!code focus:10]
  prefix: '/api',
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/profile', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authorize('bearer', 10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

同一ルートで「ログイン後に権限チェック」するならチェーンで書ける：

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

- ctx.auth.bearer は authenticate('bearer') を載せて通過後に意味がある。型に戦略名に対応するフィールドが付く。
- authorize('bearer', 10) の第 2 引数の型は戦略の onAuthorize 署名（数値、権限コードなど）から来る。
- auth.strategy('bearer').signature(...) は**ログイン action**で token を発行。認証ミドルウェアに入れない——別 API ライン。

```typescript
// 登录成功后签发（示例）
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## authenticate(name)

| いつ使う | 載せる場所 |
| --- | --- |
| 一連の API すべてログイン必須 | `Router.mount` |
| 公開 API と同じファイル | 単一ルート `mount`、または Router を 2 つに分割 |

流れ：戦略が通らない → **401**；成功で ctx.auth[name] に書き込み。返るミドルウェアは .authorize(...) を持ちチェーンでさらに絞れる。未ログイン / 無効 token は **401**；ログイン済みでロール不足は **403**。同じ意味に混ぜない。

### authorize(name, ...args)

対応戦略の認証を**済ませた**前提。authorize だけ、authenticate 忘れは型ほど実行時に守ってくれない——マウント順を逆にしない。失敗は多く **403**。

### strategy(name)

ログイン、トークン更新時に業務コードで資格情報を発行（Bearer ランダム文字列、JWT payload など）。**ログインルートに authenticate を載せない**。token がなければ永遠に入れない。

### マウント位置の選び方

| 位置 | 向く | 注意 |
| --- | --- | --- |
| `Router.mount` | プライベート API 一式 | 同ファイルに公開ルートを混ぜない |
| 単一ルート `mount` | 一部公開 / より厳しい認可 | 重複多ければ定数に抽出 |
| `WebApp.mount` | ほぼサイト全体プライベート | ヘルスチェック等は別 Router |

公開 API を認証済み Router に無理に入れない。authenticate なしの別 Router の方が保守しやすい。

OpenAPI 生成時、本番と同じ `app` を `generateOpenapi` に渡すとドキュメントの security が実認証と一致しやすい。複数戦略では `authenticate('jwt')` 等の名前が strategies のキーと揃える。

## 関連

- [Bearer 戦略](/ja/plugins/auth-bearer-strategy)
- [API Key 戦略](/ja/plugins/auth-api-key-strategy)
- [JWT 戦略](/ja/plugins/auth-jwt-strategy)
- 特殊プロトコル：[上級：カスタム認証戦略](/ja/advanced/auth-strategy)