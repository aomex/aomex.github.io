# AGENTS.md

面向在本仓库改文档的 Agent。本仓是 **aomex 官方文档站**（VitePress），不是框架源码仓。

## 项目速览

- 文档根目录：`docs/`
- 站点配置：`docs/.vitepress/config.mts`（`nav` / `sidebar`）
- 本地：`pnpm dev`；构建：`pnpm build`
- 框架实现参考（只读，勿在本仓「发明」API）：
  - 源码：`../aomex`（同级仓库时）
  - 脚手架约定：`../create-aomex`（目录、Prisma Json、生成路径等）

## 回复与文案语言

- 对用户说明、提交说明：**简体中文**（除非用户明确要求其他语言）。
- 文档正文按 locale（均带路径前缀）：`docs/zh/` 简体、`docs/zh-TW/` 台湾繁体、`docs/en/` 英文，以及 `docs/ja|ko|ru/`；侧栏文案与链接前缀在 `docs/.vitepress/config.mts` 的 `locales` 里维护。
- 根路径 `/` **没有正文**，只做语言识别后跳转：`zh-TW` / `zh-Hant`→`/zh-TW/`；其它 `zh*`→`/zh/`；`ja*` / `ko*` / `ru*`→对应前缀；`en*` 或无法识别→`/en/`。顶栏切换写入 `localStorage`（`aomex-docs-locale`）。深链不自动改语言。实现见 `docs/.vitepress/theme/`。
- 代码标识、包名、API 名保持原样（写法与源码一致）。
- 简体在 `docs/zh/`；改完后同步繁体可用 OpenCC（`cn → twp`）写入 `docs/zh-TW/`，绝对链接用 `/zh-TW` 前缀；勿改代码 fence 内标识符。
- 日语 / 韩语 / 俄语：用 `pnpm translate ja|ko|ru`（源为 `docs/zh/`，需 `TRANSLATE_API_KEY` 或 `OPENAI_API_KEY`）。脚本跳过代码 fence、加 locale 前缀，并生成 `scripts/generated/{id}-labels.json`；**默认不自动改 config**。未启用前不要提交未审的 `docs/ja|ko|ru`。

### 正文里的行内代码

短词当普通词写；**稍长的代码片段必须用反引号**，否则正文里一串符号难扫。

| 加反引号（长一点的片段） | 可裸写（短词 / 概念） |
| --- | --- |
| `` `routers('./src/routers')` ``、`` `Router({ mount: [...] })` ``、`` `new WebApp({ ... })` `` | mount、action、Router、query、body（当普通名词） |
| `` `Number(ctx.request.query.page)` ``、`` `rule.int().min(1).default(1)` ``、`` `ctx.request.query` `` | get / post、page、number（上下文已清楚时） |
| 路径 `` `src/schemas/*.schema.ts` ``、包名 `` `@aomex/web` ``、字面量 `` `zh-CN` `` | 「方法级 mount」「挂上 query()」里的短调用可裸写或只给带参数的长调用加反引号 |

反例（斑驳）：一句里给 mount、action、query()、ctx 各包一层。  
反例（该亮不亮）：「用 routers('./src/routers') 一次性挂上」——整段调用应写成 `` `routers('./src/routers')` ``。

同一段里同一长片段出现多次：第一次加反引号即可，后文可简写。表格单元格照常可用反引号。

**正文里的 `<…>` 必须包进反引号**（如 `` `get<T>(key)` ``、`` `Promise<Document>` ``、`` `Record<string, V>` ``、`` `Bearer <token>` ``）。VitePress 按 Vue 编译 Markdown，裸露的 `<T>` 会被当成 HTML 标签，后面整段文字会吞进「未闭合元素」里，看起来像 demo 没结束。代码 fence 内部不受影响。

## 文档写法（最重要）

### 语气

写给**第一次接触 aomex 的同行**：用法清楚、场景具体、语气克制。

- **对读者用「你」，不要用「我」第一人称**（「你可以…」「你会看到…」；别写「我一般…」「我优先…」「我会改成…」）。
- **每个概念 / 选项先说「是干什么的」**，再贴配置或 demo。别一上来只甩 `shutdown: { timeout }`、假定读者已知道优雅关停是什么。
- 像一份好用的工程文档，**不要**培训班腔（少用「今天要完成什么」「学员」「踩坑 / 别这样」这类课堂标题）。
- 假定读者**看得见 TypeScript 类型提示**，但对 aomex 术语与配置项是陌生人——不讲源码，不装精确，也不跳过「这东西解决什么问题」。
- 读者要的是「怎么用、类型怎样、配错会怎样」，不是作者笔记，也不是原理课。

| 少写 | 多写 |
| --- | --- |
| 类继承、内部钩子、实现原理 | 真实接口 / 指令场景 |
| 按 API 清单扫字段 | 先能跑的示例，再补常改选项 |
| 「该选项在底层表示…」 | 「什么时候用；配错会上线出什么问题」 |
| 课堂口吻、说教 | 平实说明 + 代码 |

拿不准的机制：写「按类型提示来」或链到专页，不要编造实现细节。核对 API 时可读同级 `../aomex` 的类型声明；**正文仍保持黑盒用法叙述**。

### 叙事方式：边讲边敲，不要章章同构

写文档像**对着屏幕把活做完**：先说要干什么 → 贴一段能跑的代码（focus 标出重点）→ 顺口交代类型/易错/选项 → 再往下一块。

**禁止**每页都固定三板斧：`## 示例` → `## 类型` → `## 常用选项`（再加 `## 相关`）。这样读起来像填表，不像在讲用法。

可以这样组织（按内容需要取舍，标题随便起、也可以没有小标题）：

- 开头一两句用途  
- 一块完整 demo，讲挂载 / 字段时 highlight 关键行；类型用「这时 ctx.query.page 已是 number」这类**夹在段落里的一句**，不必单开「类型」章，也别为 number / page 再套反引号  
- 下一个特性再开一小节 + 新 demo；选项在用到时说「什么时候用」，不要先甩一张总表再补代码  
- 真需要对照表时（出口列表、适配器选型）可以有表，但表要贴着对应 demo，不是每页必有的「常用选项」

配置 / 参数 / 方法：做什么 → 什么时候用 → **带 focus 的 Demo** → 顺带类型或易错（同一段里说完）。

### 注意事项写在哪

**不要**文末攒「注意」。易错点、生产 vs 开发写在**正在讲的特性旁边**（demo 后一两句，或 `::: tip` / `::: warning`）。

反例：只列 `min(n)` 签名，或整段代码无焦点。  
正例：分页从 1 起 → 完整可跑片段里用 focus 标出 `.min(1).default(1)`。

### Demo 与代码高亮（必做）

**每个特性都要有可运行/可粘贴的 demo**，不要只靠表格或纯文字。

用 VitePress / Shiki 标记引导视线。两种都要会用，**别因怕滥用就把 focus 全删光**。

| 标记 | 什么时候用 |
| --- | --- |
| `// [!code focus:N]` | fence 里有 **import / 样板 / 第二条无关路由**，需要弱化噪音、圈住正在讲的那一段时——**优先用** |
| `// [!code highlight]` | 上下文都要读、只想给关键行加背景；或主题就是某一字段行 |
| `// [!code focus]` | 极少用；几乎总是 `focus:N` 圈一段 |
| `// [!code ++]` / `// [!code --]` | 对比改前/改后 |

**有样板的长 demo → focus 圈主题段；较长块里的单点字段 → highlight。**  
**4 行以内（含）的 demo 不加任何 highlight / focus**——太短，涂了等于整块亮，没对比。  
反例：整站零 focus（长 demo 视线没落点）；反例：只 focus `ctx.send(users)` 一行、路由定义全糊。

```typescript
// ✅ 讲「怎么注册路由」：focus 整条 router.get（含 action）；import / 数据 / 第二条路由变暗
router.get('/users', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send(users);
  },
});

// ❌ 只亮 send —— 读者看不清在注册什么
ctx.send(users); // [!code focus]

// ❌ ≤4 行的短块还加 highlight / focus —— 没对比，直接裸写
mount: [routers('./src/routers')], // [!code highlight]
```

**highlight 标「正在讲的那一行」，不是无关外壳；且整段须超过 4 行。**

```typescript
// ✅ 本段在讲分页默认值，且整段够长 → highlight 那一行
page: rule.int().min(1).default(1), // [!code highlight]

// ✅ 本段在讲 envelope，fence 含 import + formatError 样板 → focus 圈 envelope 段
envelope: { // [!code focus:7]
  content: {
    success: envelope.success,
    statusCode: envelope.statusCode,
    data: envelope.payload,
  },
},
```

规则：

- 先问：本小节主题是哪**一段**？有噪音可糊 → `focus:N`；只要点一下某字段 → `highlight`。
- **禁止**乱亮 / 乱糊外壳：`router.get('/x', {` 仅当主题就是「注册这条路由」时才作为 focus 起点；讲 query/body 时 focus/highlight 落在 `query({` / 字段上，别只亮 `router.get`。
- **4 行以内（含）的 demo 不加** highlight / focus（空行不计入实质行）。
- 一个 fence 里 focus **一段**（或 highlight 1～2 行），不要散点乱标。
- bash / prisma：`# [!code focus:N]` / `# [!code highlight]`。

### 示例代码风格

文档里的函数（含箭头函数、回调）**一律写花括号，并显式 `return`**，不要用表达式体省略。

```typescript
// ❌
input: (s) => s.extend({ profile: userProfile.optional() }),

// ✅
input: (s) => {
  return s.extend({ profile: userProfile.optional() });
},
```

例外：`combineServices` 的懒加载工厂跟脚手架一致，写成 `() => import('./xxx.service.js')`，不要花括号 + `return`。

## 内容禁忌

- **不要**写「旧文档已合并」「从某某页搬迁」之类迁移备注。
- **不要**虚构不存在的 API / 选项；以类型声明与脚手架用法为准。
- **不要**在用户未要求时 `git commit` / `push`。
- 改文档时保持既有结构与交叉链接；非必要不改 `config.mts` 以外的工程配置。

## 信息架构约定

侧栏大致顺序（以 `config.mts` 为准）：

开始 → Web → Console → 通用模块 → **验证器** → **业务文档** → 高级

- 验证器是一级栏目，放在 **通用模块之后**；「验证器列表」默认 `collapsed: true`。
- Web 下含：输入输出（含 SSE；默认合上）、常用中间件、身份认证。
- **业务文档**是一级栏目，放在 **高级指南之前**（路径前缀 `/openapi/`）：侧栏先挂 **Swagger UI / Redoc UI / Scalar UI**，再是 **怎么选文档 UI**（`/openapi/choose-ui`，三套对照），然后是 **生成OpenAPI**（含 `generateOpenapi` 与 Console `openapi()` 落盘，同页 `/openapi/`）、Tags、Markdown 文案。各 locale 侧栏均挂 Tags 与 Markdown（`includeOpenapiExtras: true`）。
- OpenAPI：**路由声明 + `generateOpenapi`** 与 **`openapi()` + `aomex openapi` 落盘**写在同一篇「生成OpenAPI」；落盘指令仍挂在 `ConsoleApp` 上。生成时传 **`app`（`WebApp` 实例）**，由其带出全局 mount 与 envelope；**不要**再手写一份 `mount` 数组。CLI import 时 `new WebApp` 与 `app.listen` 须拆开。
- **中间件 / 服务层 / 缓存 / 日志 / Prisma / Mongoose / 链路追踪** 放在 **通用模块**（不再单开「核心概念」）。

## 验证器与 schema

- 可复用字段表约定：`src/schemas/xxx.schema.ts`。
- 通用链集中在 `docs/validators/chain.md`；各 `rules/*` 只写专属方法。
- 专用形态（email / url / uuid…）优先专用工厂。
- 自定义验证器放高级指南；**手动校验**（`validate()`）放验证器栏目。
- **高级指南**定位：资深工程师带着第一次自定义的人**一步一步做完**——先说会遇到什么、为什么要自定义，再拆步骤（建文件 → 写最小可跑 → 补类型 / 文档钩子 → 挂到路由试一下 → 配错会怎样）。禁止只甩一个大 demo 或一张表就收工；也禁止培训班腔（「今天完成」「学员」「踩坑课」）。仍用「你」，不用「我」。

## Prisma 文档要点

Json 对齐按脚手架约定写全链路：`generator aomex` + `prisma-json-types-generator` + `/// [Name]` → `definePrismaSchema` 里 `extend` → `PrismaJson` 用 `Validator.Infer`。不要直接拿生成文件当路由 schema。

## 改文档时的操作习惯

- 增删侧栏条目：同步改 `docs/.vitepress/config.mts`。
- 新页面补交叉链接，避免孤儿页。
- 插件页写清何时装、生产 vs 开发、挂哪儿；选项表场景化。

## 范围边界

| 做 | 不做 |
| --- | --- |
| 改 `docs/**/*.md` 与 VitePress 配置 | 在本仓实现 `@aomex/*` 运行时 |
| 按类型声明 / 脚手架校正示例 | 编造未发布的 API |
| 用法与场景文档 | 无请求时的提交、发版、改 CI |
