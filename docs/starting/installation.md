---
outline: doc
---

# 安装

框架建议使用脚手架的方式创建项目，然后根据项目的实际需求进行修改

```bash
npx create-aomex@latest
```

:::
框架对 node.js 的最低要求为 `20.13.0`，安装前请使用 `node -v` 确认版本
:::

# 目录结构

使用脚手架生成的项目目录结构如下：

```
.
├─ .husky/                          git提交前执行的代码检测脚本
├─ .vscode/                         vscode编辑器基础设置
├─ prisma/                          数据表结构和migrate文件
├─ scripts/                         运维脚本
├─ src/
   ├─ commanders/                   指令控制层
   ├─ configs/                      不同环境下的配置
   ├─ middleware/                   中间件
   ├─ routers/                      路由控制层
   ├─ services/                     业务逻辑层
   ├─ cli.ts                        控制台服务入口
   └─ web.ts                        http服务入口
├─ .env                             开发环境下的mysql配置
├─ .env.integration                 集成环境下的mysql配置
├─ .env.production                  生产环境下的mysql配置
├─ .commitlintrc.yml                commitlint配置
├─ .dockerignore                    打包docker镜像时忽略的文件
├─ .eslintrc.yml                    eslint配置
├─ .gitignore                       git忽略指定文件和目录
├─ .prettierignore                  prettier忽略指定文件和目录
├─ .prettierrc.yml                  prettier配置
├─ docker-compose-integration.yml   集成环境docker部署配置
├─ docker-compose-production.yml    生产环境docker部署配置
├─ docker-compose.yml               本地开发docker服务配置
├─ Dockerfile.integration           集成环境docker镜像脚本
├─ Dockerfile.production            生产环境docker镜像脚本
├─ package.json                     第三方依赖列表
├─ README.md                        项目介绍
└─ tsconfig.json                    Typescript配置
```
