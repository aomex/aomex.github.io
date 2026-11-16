---
layout: home

hero:
  name: Aomex
  text: 型安全な Node.js フレームワーク
  tagline: 同じミドルウェアで Web と Console を両方。ルートパラメータ、リクエストボディ、コンテキストからビジネスコードまで——型は推論でき、ジャンプでき、補完できる。
  actions:
    - theme: brand
      text: はじめる
      link: /ja/starting/installation
    - theme: alt
      text: GitHub
      link: https://github.com/aomex/aomex

features:
  - title: TypeScript を貫く
    details: 「あとから型を足す」のではなく、ミドルウェアをマウントした瞬間から、ctx に増えたフィールドが action へ自動的に流れ込む。
  - title: ミドルウェアはひとつ、舞台はふたつ
    details: Web HTTP と Console コマンドが同じオニオンモデルと組み合わせ方を共有。ビジネスロジックは一度書けば、どこにマウントしてもよい。
  - title: 入力を先に検証してからビジネスへ
    details: バリデータは文字列から ULID、ファイルから Decimal までをカバー。通過したデータだけがコードに入り、型も絞り込まれる。
  - title: サービス層の遅延ロード
    details: combineServices は動的 import と Proxy で、必要なときだけ初期化。メソッドはすべて Promise で、停止時に自動 onDestroy。
  - title: すぐ使えるエコシステム
    details: 認証、キャッシュ、ログ出力、レート制限、圧縮、CORS、Cron、OpenAPI / Swagger / Redoc——必要なものだけインストールすればよい。
  - title: Node ≥ 24
    details: ランタイムの能力に追従：組み込み圧縮アルゴリズム、より安定したファイル・ネットワーク API で、歴史的負債を少なく。
---
