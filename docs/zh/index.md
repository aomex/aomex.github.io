---
layout: home

hero:
  name: Aomex
  text: 类型安全的 Node.js 框架
  tagline: 同一套中间件，同时写 Web 与 Console。路由参数、请求体、上下文到业务代码——类型可推导、可跳转、可补全。
  actions:
    - theme: brand
      text: 开始使用
      link: /zh/starting/installation
    - theme: alt
      text: GitHub
      link: https://github.com/aomex/aomex

features:
  - title: TypeScript 贯穿
    details: 不是「写完再补类型」，而是从中间件挂载那一刻起，ctx 上多出来的字段就会自动流向 action。
  - title: 一套中间件，两个舞台
    details: Web HTTP 与 Console 指令共用洋葱模型与组合方式。业务逻辑写一次，挂哪儿都行。
  - title: 输入先验，再谈业务
    details: 验证器覆盖字符串到 ULID、文件到 Decimal。过关的数据才进入你的代码，类型也随之收窄。
  - title: 服务层懒加载
    details: combineServices 用动态 import + Proxy：按需初始化，方法一律 Promise，关停时自动 onDestroy。
  - title: 开箱生态
    details: 鉴权、缓存、日志出口、限流、压缩、CORS、Cron、OpenAPI / Swagger / Redoc——按需安装即可。
  - title: Node ≥ 24
    details: 紧跟运行时能力：内置压缩算法、更稳的文件与网络 API，少背负一层历史包袱。
---
