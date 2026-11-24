---
outline: deep
---

# 非同期リンクトレース

アクセスログは「このリクエストが 800ms」としか教えてくれない。**どの await が時間を食ったか**を、このリクエスト内で木にまとめる——遅い API の切り分けや、Service 内の一連の IO の分解に向く。日常の CRUD でデフォルト依存する必要はない。標準の分散トレースなら OpenTelemetry。本パッケージはより軽く、アプリ内の障害切り分け向け。

```bash
pnpm add @aomex/async-trace
```

## リクエスト全体を包む

`traceMiddleware` を `WebApp.mount`（または特定の Router グループ）に載せる。リクエストごとに根ノードを開き、第 2 引数はリクエスト終了後のコールバック。「遅いリクエストだけ」ログに載せるときに向く。

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    traceMiddleware('request', (record) => {
      if (record.duration > 500) {
        void asyncTrace.toStack([record]);
      }
    }),
    routers('./src/routers'),
  ],
});
```

載せたあと、Web コンテキストは **AsyncTraceMiddlewareProps** をマージする。リクエスト内では `ctx.asyncTrace.record` が使える（具体フィールドは型ヒントに従う）。載せずに `ctx.asyncTrace` を期待しても、型にも実行時にも根レコードは出ない。ミドルウェアを載せるか、局所の `traceBlock` だけ使う。

`traceMiddleware` は **mixin** ミドルウェアで、`middleware.web` 専用ファクトリではないが、Web mount にそのまま入れられる。Console / command mount にも載せられる。特定グループの API だけ遅く、サイト全体のオーバーヘッドを避けたいときは、その Router の mount に載せればよい。

::: warning
本番で全量スタックを出し、しきい値なしだと実行時コストがある。callback で duration やサンプリングに合わせてログシステムへつなぐ。
:::

## Service でホットスポットを分ける

リクエスト全体では総所要時間しか見えない。「どの DB 照会が遅いか」を分けるには、Service で `traceBlock` に一段の await を包む。入れ子になると `toStack` はインデント構造で出る。

```typescript
import { traceBlock } from '@aomex/async-trace';

async loadUser(id: number) {
  return traceBlock('loadUser', async () => { // [!code focus:5]
    const profile = await db.profile.find(id);
    const prefs = await db.prefs.find(id);
    return { profile, prefs };
  });
}
```

クラスメソッドに複数 await があるときは、手書き `traceBlock` よりデコレータの方がきれい。label 未指定時のデフォルトはだいたい `ClassName.methodName` で、スタックが見やすい：

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

`asyncTrace.run(label, callback)` は、すでに開いている木の中に子ノードを足す。レコードにはだいたい label、duration、parent / children、error などがある——障害切り分けでは duration と label を見れば足りることが多い。

[@aomex/access-log](/ja/plugins/access-log) と補完関係：アクセスログは総所要時間、リンクトレースは子ステップを分ける。本パッケージは OpenTelemetry などの分散 trace の代わりにはならない。サービス横断は標準方式が必要。

## 関連

- ミドルウェア順：[Web アプリ](/ja/web/)、[カスタムミドルウェア](/ja/advanced/middleware)
- ログに requestId を載せる：[ログ · withBindings](/ja/core/logger#リクエスト単位のコンテキストwithbindings)
