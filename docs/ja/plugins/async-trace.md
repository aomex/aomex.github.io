---
outline: deep
---

# 非同期リンクトレース

アクセスログは「この 1 リクエストが 800ms」としか言わない。**どの await が時間を食ったか**を当該リクエスト内で木構造にまとめる——遅い API の切り分け、Service 内の一連の IO 分解向き。日常の CRUD にデフォルト依存は不要。標準の分散トレースなら OpenTelemetry を検討。本パッケージはより軽量でアプリ内障害切り分け向き。

## リクエスト全体の traceMiddleware

インストール（必要なとき）：

```bash
pnpm add @aomex/async-trace
```

リクエスト全体をミドルウェアで包む：

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';

mount: [
  traceMiddleware('request', (record) => { // [!code highlight]
    if (record.duration > 500) {
      void asyncTrace.toStack([record]);
    }
  }),
  routers('./src/routers'),
],
```

traceMiddleware を載せず ctx.asyncTrace を期待すると、型も実行時もルート記録がない。ミドルウェアを載せるか、局所の traceBlock だけ使う。

Service 内の局所分解：

```typescript
import { traceBlock } from '@aomex/async-trace';

const data = await traceBlock('loadUser', async () => { // [!code highlight]
  const profile = await db.profile.find();
  const prefs = await db.prefs.find();
  return { profile, prefs };
});
```

メソッド単位はデコレータ（クラスメソッドに複数 await があると手書き traceBlock よりきれい）：

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

label 未指定時は ClassName.methodName に近い既定。スタックを見るとき分かりやすい。

traceMiddleware 後、Web コンテキストに **AsyncTraceMiddlewareProps** がマージされる。リクエスト内で **ctx.asyncTrace.record** が使える（詳細は型ヒント参照）。traceMiddleware は **mixin** ミドルウェアで `middleware.web` 専用ファクトリではないが Web mount にそのまま入れられる。Console / command の mount にも載せられる。`asyncTrace.run(label, callback)` は既存の木の子ノードを開く。ネスト後 toStack はインデント構造。記録には label、duration、parent / children、error など——障害時は duration と label を見れば足りることが多い。

## マウント階層とコールバック

| シナリオ | 使い方 |
| --- | --- |
| サイト全体 HTTP | `WebApp.mount: [traceMiddleware('http')]` |
| API グループ | `Router.mount: [traceMiddleware('api-v1')]` |
| コンソールタスク | `ConsoleApp` / command の `mount` にも可 |
| ホットスポットメソッド | `@traceMethod()` または `traceBlock` |
| 遅いリクエストをログへ | `traceMiddleware` 第 2 引数 `callback`。本番ホットパスで全スタックを無条件 console.log しない |

::: warning
本番で全スタックを閾値なし出力するとランタイムコストが出る。callback で duration やサンプリングでログ基盤へ。

:::

[@aomex/http-access-log](/ja/plugins/http-access-log) と補完：アクセスログは総時間、リンクトレースは子ステップ。本パッケージは OpenTelemetry 等の分散 trace の代替ではない。サービス横断は標準方式を使う。

## 関連

- ミドルウェア順：[Web アプリ](/ja/web/)、[カスタムミドルウェア](/ja/advanced/middleware)
- requestId 付きログ：[ログ · withBindings](/ja/core/logger#リクエスト単位コンテキストwithbindings)