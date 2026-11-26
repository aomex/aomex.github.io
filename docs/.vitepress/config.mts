import { defineConfig, type DefaultTheme } from 'vitepress';
import { autoLocaleInlineScript } from './theme/autoLocaleInline';

const github = 'https://github.com/aomex/aomex';
const editPattern =
  'https://github.com/aomex/aomex.github.io/tree/main/docs/:path';

const withPrefix = (prefix: string, path: string) => {
  if (!prefix) {
    return path;
  }
  return `/${prefix}${path}`;
};

const makeNav = (prefix: string): DefaultTheme.NavItem[] => {
  return [
    { text: 'Web', link: withPrefix(prefix, '/web/') },
    { text: 'WebSocket', link: withPrefix(prefix, '/websocket/') },
    { text: 'Console', link: withPrefix(prefix, '/console/') },
    { text: 'GitHub', link: github },
  ];
};

type SidebarLabels = {
  start: string;
  quickStart: string;
  webApp: string;
  webEntry: string;
  router: string;
  io: string;
  query: string;
  body: string;
  params: string;
  attach: string;
  response: string;
  sse: string;
  errors: string;
  envelope: string;
  middlewares: string;
  cors: string;
  csrf: string;
  compress: string;
  helmet: string;
  etag: string;
  accessLog: string;
  prettyJson: string;
  rateLimit: string;
  abuse: string;
  responseTime: string;
  serveStatic: string;
  auth: string;
  authEntry: string;
  bearer: string;
  session: string;
  apiKey: string;
  jwt: string;
  oauth2Client: string;
  docs: string;
  openapi: string;
  openapiTags: string;
  openapiMarkdown: string;
  openapiChooseUi: string;
  swagger: string;
  redoc: string;
  scalar: string;
  consoleApp: string;
  consoleEntry: string;
  commander: string;
  options: string;
  cron: string;
  websocketApp: string;
  websocketEntry: string;
  websocketChannel: string;
  websocketIo: string;
  websocketPayload: string;
  websocketEmit: string;
  websocketTransport: string;
  websocketHub: string;
  websocketMiddlewares: string;
  websocketDocs: string;
  asyncapi: string;
  asyncapiUi: string;
  common: string;
  middleware: string;
  service: string;
  cache: string;
  logger: string;
  kafka: string;
  prisma: string;
  mongoose: string;
  asyncTrace: string;
  validators: string;
  validatorsIntro: string;
  validatorsList: string;
  validatorsOverview: string;
  chain: string;
  schema: string;
  validate: string;
  advanced: string;
  customMiddleware: string;
  customValidator: string;
  customAuth: string;
  i18n: string;
  cluster: string;
};

const zhLabels: SidebarLabels = {
  start: '开始',
  quickStart: '快速安装',
  webApp: 'Web 应用',
  webEntry: '应用入口',
  router: '接口路由',
  io: '输入输出',
  query: '查询字符串',
  body: '请求实体',
  params: '路径参数',
  attach: '文件上传',
  response: '约束响应',
  sse: '服务端推送 SSE',
  errors: '错误格式',
  envelope: '响应体套壳',
  middlewares: '常用中间件',
  cors: '跨域 CORS',
  csrf: 'CSRF 防护',
  compress: '压缩 Compress',
  helmet: '安全报文 Helmet',
  etag: 'ETag',
  accessLog: '访问日志',
  prettyJson: '美化 JSON',
  rateLimit: '请求限速',
  abuse: '滥用防护',
  responseTime: '响应时间',
  serveStatic: '静态文件',
  auth: '身份认证',
  authEntry: '统一入口 Auth',
  bearer: 'Bearer 策略',
  session: 'Session 策略',
  apiKey: 'API Key 策略',
  jwt: 'JWT 策略',
  oauth2Client: 'OAuth2 客户端',
  docs: '业务文档',
  openapi: '生成OpenAPI',
  openapiTags: 'Tags 分组',
  openapiMarkdown: 'Markdown 文案',
  openapiChooseUi: '怎么选文档 UI',
  swagger: 'Swagger UI',
  redoc: 'Redoc UI',
  scalar: 'Scalar UI',
  consoleApp: 'Console 应用',
  consoleEntry: '应用入口',
  commander: '指令路由',
  options: '输入参数',
  cron: '定时任务 Cron',
  websocketApp: 'WebSocket 应用',
  websocketEntry: '应用入口',
  websocketChannel: '事件路由',
  websocketIo: '输入输出',
  websocketPayload: '入站 payload',
  websocketEmit: '出站 emit',
  websocketTransport: '传输层',
  websocketHub: '多机 Hub',
  websocketMiddlewares: '常用中间件',
  websocketDocs: '业务文档',
  asyncapi: '生成 AsyncAPI',
  asyncapiUi: 'AsyncAPI UI',
  common: '通用模块',
  middleware: '中间件',
  service: '服务层',
  cache: '缓存',
  logger: '日志',
  kafka: 'Kafka',
  prisma: 'Prisma',
  mongoose: 'Mongoose',
  asyncTrace: '链路追踪',
  validators: '验证器',
  validatorsIntro: '快速上手',
  validatorsList: '验证器列表',
  validatorsOverview: '总览',
  chain: '通用链式',
  schema: 'schema',
  validate: '手动校验',
  advanced: '高级指南',
  customMiddleware: '自定义中间件',
  customValidator: '自定义验证器',
  customAuth: '自定义鉴权策略',
  i18n: '业务国际化',
  cluster: '多进程与扩容',
};

const zhTWLabels: SidebarLabels = {
  start: '開始',
  quickStart: '快速安裝',
  webApp: 'Web 應用',
  webEntry: '應用入口',
  router: '介面路由',
  io: '輸入輸出',
  query: '查詢字串',
  body: '請求實體',
  params: '路徑引數',
  attach: '檔案上傳',
  response: '約束響應',
  sse: '服務端推送 SSE',
  errors: '錯誤格式',
  envelope: '響應體套殼',
  middlewares: '常用中介軟體',
  cors: '跨域 CORS',
  csrf: 'CSRF 防護',
  compress: '壓縮 Compress',
  helmet: '安全報文 Helmet',
  etag: 'ETag',
  accessLog: '訪問日誌',
  prettyJson: '美化 JSON',
  rateLimit: '請求限速',
  abuse: '濫用防護',
  responseTime: '響應時間',
  serveStatic: '靜態檔案',
  auth: '身份認證',
  authEntry: '統一入口 Auth',
  bearer: 'Bearer 策略',
  session: 'Session 策略',
  apiKey: 'API Key 策略',
  jwt: 'JWT 策略',
  oauth2Client: 'OAuth2 用戶端',
  docs: '業務文件',
  openapi: '生成OpenAPI',
  openapiTags: 'Tags 分組',
  openapiMarkdown: 'Markdown 文案',
  openapiChooseUi: '怎麼選文件 UI',
  swagger: 'Swagger UI',
  redoc: 'Redoc UI',
  scalar: 'Scalar UI',
  consoleApp: 'Console 應用',
  consoleEntry: '應用入口',
  commander: '指令路由',
  options: '輸入引數',
  cron: '定時任務 Cron',
  websocketApp: 'WebSocket 應用',
  websocketEntry: '應用入口',
  websocketChannel: '事件路由',
  websocketIo: '輸入輸出',
  websocketPayload: '入站 payload',
  websocketEmit: '出站 emit',
  websocketTransport: '傳輸層',
  websocketHub: '多機 Hub',
  websocketMiddlewares: '常用中介軟體',
  websocketDocs: '業務文件',
  asyncapi: '生成 AsyncAPI',
  asyncapiUi: 'AsyncAPI UI',
  common: '通用模組',
  middleware: '中介軟體',
  service: '服務層',
  cache: '快取',
  logger: '日誌',
  kafka: 'Kafka',
  prisma: 'Prisma',
  mongoose: 'Mongoose',
  asyncTrace: '鏈路追蹤',
  validators: '驗證器',
  validatorsIntro: '快速上手',
  validatorsList: '驗證器列表',
  validatorsOverview: '總覽',
  chain: '通用鏈式',
  schema: 'schema',
  validate: '手動校驗',
  advanced: '高階指南',
  customMiddleware: '自定義中介軟體',
  customValidator: '自定義驗證器',
  customAuth: '自定義鑑權策略',
  i18n: '業務國際化',
  cluster: '多程序與擴容',
};

const enLabels: SidebarLabels = {
  start: 'Getting started',
  quickStart: 'Quick start',
  webApp: 'Web app',
  webEntry: 'App entry',
  router: 'HTTP routing',
  io: 'Input / output',
  query: 'Query string',
  body: 'Request body',
  params: 'Path params',
  attach: 'File upload',
  response: 'Response schema',
  sse: 'Server-sent events',
  errors: 'Error format',
  envelope: 'Response envelope',
  middlewares: 'Common middleware',
  cors: 'CORS',
  csrf: 'CSRF',
  compress: 'Compress',
  helmet: 'Helmet',
  etag: 'ETag',
  accessLog: 'Access log',
  prettyJson: 'Pretty JSON',
  rateLimit: 'Rate limit',
  abuse: 'Abuse protection',
  responseTime: 'Response time',
  serveStatic: 'Static files',
  auth: 'Authentication',
  authEntry: 'Auth entry',
  bearer: 'Bearer strategy',
  session: 'Session strategy',
  apiKey: 'API Key strategy',
  jwt: 'JWT strategy',
  oauth2Client: 'OAuth2 client',
  docs: 'Business docs',
  openapi: 'Generate OpenAPI',
  openapiTags: 'Tags',
  openapiMarkdown: 'Markdown copy',
  openapiChooseUi: 'Choosing a docs UI',
  swagger: 'Swagger UI',
  redoc: 'Redoc UI',
  scalar: 'Scalar UI',
  consoleApp: 'Console app',
  consoleEntry: 'App entry',
  commander: 'Commands',
  options: 'CLI options',
  cron: 'Cron jobs',
  websocketApp: 'WebSocket app',
  websocketEntry: 'App entry',
  websocketChannel: 'Event channels',
  websocketIo: 'Input / output',
  websocketPayload: 'Inbound payload',
  websocketEmit: 'Outbound emit',
  websocketTransport: 'Transport',
  websocketHub: 'Multi-node Hub',
  websocketMiddlewares: 'Common middleware',
  websocketDocs: 'Business docs',
  asyncapi: 'Generate AsyncAPI',
  asyncapiUi: 'AsyncAPI UI',
  common: 'Common modules',
  middleware: 'Middleware',
  service: 'Services',
  cache: 'Cache',
  logger: 'Logger',
  kafka: 'Kafka',
  prisma: 'Prisma',
  mongoose: 'Mongoose',
  asyncTrace: 'Async tracing',
  validators: 'Validators',
  validatorsIntro: 'Quick start',
  validatorsList: 'Validator list',
  validatorsOverview: 'Overview',
  chain: 'Common chain',
  schema: 'schema',
  validate: 'Manual validate',
  advanced: 'Advanced',
  customMiddleware: 'Custom middleware',
  customValidator: 'Custom validators',
  customAuth: 'Custom auth strategy',
  i18n: 'Business i18n',
  cluster: 'Multi-process & scaling',
};

const jaLabels: SidebarLabels = {
  start: "はじめに",
  quickStart: "クイックスタート",
  webApp: "Web アプリ",
  webEntry: "アプリのエントリ",
  router: "ルート",
  io: "入出力",
  query: "クエリ文字列",
  body: "リクエストボディ",
  params: "パスパラメータ",
  attach: "ファイルアップロード",
  response: "レスポンスの制約",
  sse: "サーバー送信 SSE",
  errors: "エラー形式",
  envelope: "レスポンスのエンベロープ",
  middlewares: "よく使うミドルウェア",
  cors: "CORS",
  csrf: "CSRF",
  compress: "Compress",
  helmet: "Helmet（セキュリティヘッダ）",
  etag: "ETag",
  accessLog: "アクセスログ",
  prettyJson: "JSON の整形",
  rateLimit: "レート制限",
  abuse: "乱用対策",
  responseTime: "レスポンス時間",
  serveStatic: "静的ファイル",
  auth: "認証",
  authEntry: "Auth エントリ",
  bearer: "Bearer ストラテジー",
  session: "Session ストラテジー",
  apiKey: "API Key ストラテジー",
  jwt: "JWT ストラテジー",
  oauth2Client: "OAuth2 クライアント",
  docs: "業務ドキュメント",
  openapi: "OpenAPI を生成",
  openapiTags: "タグ",
  openapiMarkdown: "Markdown 記述",
  openapiChooseUi: "ドキュメント UI の選び方",
  swagger: "Swagger UI",
  redoc: "Redoc UI",
  scalar: "Scalar UI",
  consoleApp: "Console アプリ",
  consoleEntry: "アプリのエントリ",
  commander: "コマンドルート",
  options: "オプション",
  cron: "Cron",
  websocketApp: "WebSocket アプリ",
  websocketEntry: "アプリのエントリ",
  websocketChannel: "イベントルーティング",
  websocketIo: "入出力",
  websocketPayload: "受信 payload",
  websocketEmit: "送信 emit",
  websocketTransport: "トランスポート",
  websocketHub: "マルチノード Hub",
  websocketMiddlewares: "よく使うミドルウェア",
  websocketDocs: "業務ドキュメント",
  asyncapi: "AsyncAPI を生成",
  asyncapiUi: "AsyncAPI UI",
  common: "共通モジュール",
  middleware: "ミドルウェア",
  service: "サービス層",
  cache: "キャッシュ",
  logger: "ログ",
  kafka: "Kafka",
  prisma: "Prisma",
  mongoose: "Mongoose",
  asyncTrace: "分散トレース",
  validators: "バリデータ",
  validatorsIntro: "クイックスタート",
  validatorsList: "バリデータ一覧",
  validatorsOverview: "概要",
  chain: "チェーン API",
  schema: "schema",
  validate: "手動検証",
  advanced: "上級ガイド",
  customMiddleware: "カスタムミドルウェア",
  customValidator: "カスタムバリデータ",
  customAuth: "カスタム認証ストラテジー",
  i18n: "アプリの i18n",
  cluster: "マルチプロセスとスケール",
};

const ruLabels: SidebarLabels = {
  start: "Начало",
  quickStart: "Быстрая установка",
  webApp: "Web-приложение",
  webEntry: "Точка входа",
  router: "Маршруты API",
  io: "Ввод и вывод",
  query: "Query string",
  body: "Тело запроса",
  params: "Параметры пути",
  attach: "Загрузка файлов",
  response: "Ограничение ответа",
  sse: "Server-Sent Events (SSE)",
  errors: "Формат ошибок",
  envelope: "Обёртка ответа",
  middlewares: "Частые middleware",
  cors: "CORS",
  csrf: "CSRF",
  compress: "Compress",
  helmet: "Helmet",
  etag: "ETag",
  accessLog: "Лог доступа",
  prettyJson: "Pretty JSON",
  rateLimit: "Ограничение частоты",
  abuse: "Защита от злоупотреблений",
  responseTime: "Время ответа",
  serveStatic: "Статические файлы",
  auth: "Аутентификация",
  authEntry: "Auth",
  bearer: "Bearer",
  session: "Session",
  apiKey: "API Key",
  jwt: "JWT",
  oauth2Client: "OAuth2-клиент",
  docs: "Бизнес-документация",
  openapi: "Генерация OpenAPI",
  openapiTags: "Теги",
  openapiMarkdown: "Markdown-тексты",
  openapiChooseUi: "Какой docs UI выбрать",
  swagger: "Swagger UI",
  redoc: "Redoc UI",
  scalar: "Scalar UI",
  consoleApp: "Console-приложение",
  consoleEntry: "Точка входа",
  commander: "Маршруты команд",
  options: "Параметры ввода",
  cron: "Cron",
  websocketApp: "WebSocket-приложение",
  websocketEntry: "Точка входа",
  websocketChannel: "Маршруты событий",
  websocketIo: "Ввод и вывод",
  websocketPayload: "Входящий payload",
  websocketEmit: "Исходящий emit",
  websocketTransport: "Транспорт",
  websocketHub: "Hub для нескольких узлов",
  websocketMiddlewares: "Частые middleware",
  websocketDocs: "Бизнес-документация",
  asyncapi: "Генерация AsyncAPI",
  asyncapiUi: "AsyncAPI UI",
  common: "Общие модули",
  middleware: "Middleware",
  service: "Сервисный слой",
  cache: "Кэш",
  logger: "Логирование",
  kafka: "Kafka",
  prisma: "Prisma",
  mongoose: "Mongoose",
  asyncTrace: "Трассировка",
  validators: "Валидаторы",
  validatorsIntro: "Быстрый старт",
  validatorsList: "Список валидаторов",
  validatorsOverview: "Обзор",
  chain: "Общие цепочки",
  schema: "schema",
  validate: "Ручная валидация",
  advanced: "Продвинутое",
  customMiddleware: "Свой middleware",
  customValidator: "Свой валидатор",
  customAuth: "Своя стратегия Auth",
  i18n: "i18n в приложении",
  cluster: "Многопроцессность и масштабирование",
};

const makeSidebar = (
  prefix: string,
  t: SidebarLabels,
  options: { includeOpenapiExtras?: boolean } = {},
): DefaultTheme.Sidebar => {
  const p = (path: string) => {
    return withPrefix(prefix, path);
  };

  const docsItems: DefaultTheme.SidebarItem[] = [
    { text: t.swagger, link: p('/openapi/swagger-ui') },
    { text: t.redoc, link: p('/openapi/redoc-ui') },
    { text: t.scalar, link: p('/openapi/scalar-ui') },
    { text: t.openapiChooseUi, link: p('/openapi/choose-ui') },
    { text: t.openapi, link: p('/openapi/') },
    ...(options.includeOpenapiExtras
      ? [
          { text: t.openapiTags, link: p('/openapi/tags') },
          { text: t.openapiMarkdown, link: p('/openapi/markdown') },
        ]
      : []),
  ];

  return [
    {
      text: t.start,
      items: [{ text: t.quickStart, link: p('/starting/installation') }],
    },
    {
      text: t.webApp,
      collapsed: false,
      items: [
        { text: t.webEntry, link: p('/web/') },
        { text: t.router, link: p('/web/router') },
        {
          text: t.io,
          collapsed: true,
          items: [
            { text: t.query, link: p('/web/query') },
            { text: t.body, link: p('/web/body') },
            { text: t.params, link: p('/web/params') },
            { text: t.attach, link: p('/web/attach') },
            { text: t.response, link: p('/web/response') },
            { text: t.sse, link: p('/web/sse') },
            { text: t.errors, link: p('/web/errors') },
            { text: t.envelope, link: p('/web/envelope') },
          ],
        },
        {
          text: t.middlewares,
          collapsed: true,
          items: [
            { text: t.cors, link: p('/plugins/cors') },
            { text: t.csrf, link: p('/plugins/csrf') },
            { text: t.compress, link: p('/plugins/compress') },
            { text: t.helmet, link: p('/plugins/helmet') },
            { text: t.etag, link: p('/plugins/etag') },
            { text: t.accessLog, link: p('/plugins/access-log') },
            { text: t.prettyJson, link: p('/plugins/pretty-json') },
            { text: t.rateLimit, link: p('/plugins/rate-limit') },
            { text: t.abuse, link: p('/plugins/abuse') },
            { text: t.responseTime, link: p('/plugins/response-time') },
            { text: t.serveStatic, link: p('/plugins/serve-static') },
          ],
        },
        {
          text: t.auth,
          collapsed: true,
          items: [
            { text: t.authEntry, link: p('/plugins/auth') },
            { text: t.bearer, link: p('/plugins/auth-bearer-strategy') },
            { text: t.session, link: p('/plugins/auth-session-strategy') },
            { text: t.apiKey, link: p('/plugins/auth-api-key-strategy') },
            { text: t.jwt, link: p('/plugins/auth-jwt-strategy') },
            { text: t.oauth2Client, link: p('/plugins/oauth2-client') },
          ],
        },
        {
          text: t.docs,
          collapsed: true,
          items: docsItems,
        },
      ],
    },
    {
      text: t.consoleApp,
      collapsed: false,
      items: [
        { text: t.consoleEntry, link: p('/console/') },
        { text: t.commander, link: p('/console/commander') },
        { text: t.options, link: p('/console/options') },
        { text: t.cron, link: p('/plugins/cron') },
      ],
    },
    {
      text: t.websocketApp,
      collapsed: false,
      items: [
        { text: t.websocketEntry, link: p('/websocket/') },
        { text: t.websocketChannel, link: p('/websocket/channel') },
        {
          text: t.websocketIo,
          collapsed: true,
          items: [
            { text: t.websocketPayload, link: p('/websocket/payload') },
            { text: t.websocketEmit, link: p('/websocket/emit') },
          ],
        },
        { text: t.websocketTransport, link: p('/websocket/transport') },
        { text: t.websocketHub, link: p('/websocket/hub') },
        {
          text: t.websocketMiddlewares,
          collapsed: true,
          items: [
            { text: t.accessLog, link: p('/websocket/access-log') },
            { text: t.rateLimit, link: p('/websocket/rate-limit') },
            { text: t.abuse, link: p('/websocket/abuse') },
          ],
        },
        {
          text: t.websocketDocs,
          collapsed: true,
          items: [
            { text: t.asyncapiUi, link: p('/asyncapi/asyncapi-ui') },
            { text: t.asyncapi, link: p('/asyncapi/') },
          ],
        },
      ],
    },
    {
      text: t.common,
      collapsed: false,
      items: [
        { text: t.middleware, link: p('/core/middleware') },
        { text: t.service, link: p('/core/service') },
        { text: t.cache, link: p('/core/cache') },
        { text: t.logger, link: p('/core/logger') },
        { text: t.kafka, link: p('/core/kafka') },
        { text: t.prisma, link: p('/plugins/prisma') },
        { text: t.mongoose, link: p('/plugins/mongoose') },
        { text: t.asyncTrace, link: p('/plugins/async-trace') },
      ],
    },
    {
      text: t.validators,
      collapsed: false,
      items: [
        { text: t.validatorsIntro, link: p('/validators/') },
        {
          text: t.validatorsList,
          collapsed: true,
          items: [
            { text: t.validatorsOverview, link: p('/validators/builtins') },
            { text: 'string', link: p('/validators/rules/string') },
            { text: 'number', link: p('/validators/rules/number') },
            { text: 'int', link: p('/validators/rules/int') },
            { text: 'bigint', link: p('/validators/rules/bigint') },
            { text: 'decimal', link: p('/validators/rules/decimal') },
            { text: 'boolean', link: p('/validators/rules/boolean') },
            { text: 'date', link: p('/validators/rules/date') },
            { text: 'email', link: p('/validators/rules/email') },
            { text: 'url', link: p('/validators/rules/url') },
            { text: 'uuid', link: p('/validators/rules/uuid') },
            { text: 'ulid', link: p('/validators/rules/ulid') },
            { text: 'ip', link: p('/validators/rules/ip') },
            { text: 'hash', link: p('/validators/rules/hash') },
            { text: 'enum', link: p('/validators/rules/enum') },
            { text: 'literal', link: p('/validators/rules/literal') },
            { text: 'object', link: p('/validators/rules/object') },
            { text: 'record', link: p('/validators/rules/record') },
            { text: 'array', link: p('/validators/rules/array') },
            { text: 'buffer', link: p('/validators/rules/buffer') },
            { text: 'stream', link: p('/validators/rules/stream') },
            { text: 'oneOf', link: p('/validators/rules/one-of') },
            { text: 'anyOf', link: p('/validators/rules/any-of') },
            { text: 'allOf', link: p('/validators/rules/all-of') },
            { text: 'any', link: p('/validators/rules/any') },
            { text: 'file', link: p('/validators/rules/file') },
          ],
        },
        { text: t.chain, link: p('/validators/chain') },
        { text: t.schema, link: p('/validators/schema') },
        { text: t.validate, link: p('/validators/validate') },
      ],
    },
    {
      text: t.advanced,
      collapsed: true,
      items: [
        { text: t.customMiddleware, link: p('/advanced/middleware') },
        { text: t.customValidator, link: p('/advanced/validator') },
        { text: t.customAuth, link: p('/advanced/auth-strategy') },
        { text: t.i18n, link: p('/advanced/i18n') },
        { text: t.cluster, link: p('/advanced/cluster') },
      ],
    },
  ];
};

export default defineConfig({
  title: 'aomex.js',
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  // 根路径 `/` 无正文，仅识别语言后跳到 /zh/ /en/ …（深链不改）
  transformHead({ pageData }) {
    if (pageData.relativePath !== 'index.md') {
      return [];
    }
    return [['script', {}, autoLocaleInlineScript]];
  },
  locales: {
    // root 仅承载跳转页 docs/index.md；正文全在带前缀的 locale 下。
    // label 用不可见字符，避免语言菜单里多出一项「空语言」。
    root: {
      label: '\u200B',
      lang: 'en-US',
      title: 'aomex.js',
      description: 'aomex.js docs',
      themeConfig: {
        nav: [],
        sidebar: [],
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description:
        'Type-safe Node.js framework: one middleware model for Web, WebSocket, and Console',
      themeConfig: {
        editLink: {
          pattern: editPattern,
          text: 'Edit this page',
        },
        outline: {
          level: 'deep',
          label: 'On this page',
        },
        nav: makeNav('en'),
        sidebar: makeSidebar('en', enLabels, { includeOpenapiExtras: true }),
        lastUpdated: {
          text: 'Last updated',
        },
        docFooter: {
          prev: 'Previous',
          next: 'Next',
        },
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light mode',
        darkModeSwitchTitle: 'Switch to dark mode',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Back to top',
        langMenuLabel: 'Change language',
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      description: '类型安全的 Node.js 框架：同一套中间件，同时写 Web、WebSocket 与 Console',
      themeConfig: {
        editLink: {
          pattern: editPattern,
          text: '编辑当前文档',
        },
        outline: {
          level: 'deep',
          label: '当前页大纲',
        },
        nav: makeNav('zh'),
        sidebar: makeSidebar('zh', zhLabels, { includeOpenapiExtras: true }),
        lastUpdated: {
          text: '最后更新于',
        },
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',
      },
    },
    'zh-TW': {
      label: '繁體中文',
      lang: 'zh-TW',
      link: '/zh-TW/',
      description: '型別安全的 Node.js 框架：同一套中介軟體，同時寫 Web、WebSocket 與 Console',
      themeConfig: {
        editLink: {
          pattern: editPattern,
          text: '編輯目前文件',
        },
        outline: {
          level: 'deep',
          label: '本頁大綱',
        },
        nav: makeNav('zh-TW'),
        sidebar: makeSidebar('zh-TW', zhTWLabels, { includeOpenapiExtras: true }),
        lastUpdated: {
          text: '最後更新於',
        },
        docFooter: {
          prev: '上一頁',
          next: '下一頁',
        },
        darkModeSwitchLabel: '外觀',
        lightModeSwitchTitle: '切換到淺色模式',
        darkModeSwitchTitle: '切換到深色模式',
        sidebarMenuLabel: '選單',
        returnToTopLabel: '回到頂部',
        langMenuLabel: '切換語言',
      },
    },
    ja: {
      label: "日本語",
      lang: "ja-JP",
      link: "/ja/",
      description: "型安全な Node.js フレームワーク — Web・WebSocket・Console で同じミドルウェアを共有",
      themeConfig: {
        editLink: {
          pattern: editPattern,
          text: "このページを編集",
        },
        outline: {
          level: 'deep',
          label: "目次",
        },
        nav: makeNav('ja'),
        sidebar: makeSidebar('ja', jaLabels, { includeOpenapiExtras: true }),
        lastUpdated: {
          text: "最終更新",
        },
        docFooter: {
          prev: "前へ",
          next: "次へ",
        },
        darkModeSwitchLabel: "表示",
        lightModeSwitchTitle: "ライトモードに切り替え",
        darkModeSwitchTitle: "ダークモードに切り替え",
        sidebarMenuLabel: "メニュー",
        returnToTopLabel: "トップへ戻る",
        langMenuLabel: "言語",
      },
    },
    ru: {
      label: "Русский",
      lang: "ru-RU",
      link: "/ru/",
      description: "Type-safe фреймворк Node.js: одни middleware для Web, WebSocket и Console",
      themeConfig: {
        editLink: {
          pattern: editPattern,
          text: "Редактировать страницу",
        },
        outline: {
          level: 'deep',
          label: "Содержание",
        },
        nav: makeNav('ru'),
        sidebar: makeSidebar('ru', ruLabels, { includeOpenapiExtras: true }),
        lastUpdated: {
          text: "Обновлено",
        },
        docFooter: {
          prev: "Назад",
          next: "Далее",
        },
        darkModeSwitchLabel: "Тема",
        lightModeSwitchTitle: "Светлая тема",
        darkModeSwitchTitle: "Тёмная тема",
        sidebarMenuLabel: "Меню",
        returnToTopLabel: "Наверх",
        langMenuLabel: "Сменить язык",
      },
    },
  },
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        locales: {
          en: {
            translations: {
              button: {
                buttonText: 'Search',
                buttonAriaLabel: 'Search docs',
              },
              modal: {
                noResultsText: 'No results found',
                resetButtonTitle: 'Clear query',
                footer: {
                  selectText: 'to select',
                  navigateText: 'to navigate',
                  closeText: 'to close',
                },
              },
            },
          },
          zh: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档',
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
          'zh-TW': {
            translations: {
              button: {
                buttonText: '搜尋文件',
                buttonAriaLabel: '搜尋文件',
              },
              modal: {
                noResultsText: '找不到相關結果',
                resetButtonTitle: '清除查詢條件',
                footer: {
                  selectText: '選擇',
                  navigateText: '切換',
                  closeText: '關閉',
                },
              },
            },
          },
          ja: {
            translations: {
              button: {
                buttonText: 'ドキュメントを検索',
                buttonAriaLabel: 'ドキュメントを検索',
              },
              modal: {
                noResultsText: '結果が見つかりません',
                resetButtonTitle: '検索をクリア',
                footer: {
                  selectText: '選択',
                  navigateText: '移動',
                  closeText: '閉じる',
                },
              },
            },
          },
          ru: {
            translations: {
              button: {
                buttonText: 'Поиск по документации',
                buttonAriaLabel: 'Поиск по документации',
              },
              modal: {
                noResultsText: 'Ничего не найдено',
                resetButtonTitle: 'Сбросить запрос',
                footer: {
                  selectText: 'Выбрать',
                  navigateText: 'Переключить',
                  closeText: 'Закрыть',
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [{ icon: 'github', link: github }],
  },
});
