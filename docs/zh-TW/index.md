---
layout: home

hero:
  name: Aomex
  text: 型別安全的 Node.js 框架
  tagline: 同一套中介軟體，同時寫 Web 與 Console。路由引數、請求體、上下文到業務程式碼——型別可推導、可跳轉、可補全。
  actions:
    - theme: brand
      text: 開始使用
      link: /zh-TW/starting/installation
    - theme: alt
      text: GitHub
      link: https://github.com/aomex/aomex

features:
  - title: TypeScript 貫穿
    details: 不是「寫完再補型別」，而是從中介軟體掛載那一刻起，ctx 上多出來的欄位就會自動流向 action。
  - title: 一套中介軟體，兩個舞臺
    details: Web HTTP 與 Console 指令共用洋蔥模型與組合方式。業務邏輯寫一次，掛哪兒都行。
  - title: 輸入先驗，再談業務
    details: 驗證器覆蓋字串到 ULID、檔案到 Decimal。過關的資料才進入你的程式碼，型別也隨之收窄。
  - title: 服務層懶載入
    details: combineServices 用動態 import + Proxy：按需初始化，方法一律 Promise，關停時自動 onDestroy。
  - title: 開箱生態
    details: 鑑權、快取、日誌出口、限流、壓縮、CORS、Cron、OpenAPI / Swagger / Redoc——按需安裝即可。
  - title: Node ≥ 24
    details: 緊跟執行時能力：內建壓縮演算法、更穩的檔案與網路 API，少揹負一層歷史包袱。
---
