import { defineUserConfig } from 'vuepress';
import { defaultTheme } from '@vuepress/theme-default';

export default defineUserConfig({
  lang: 'zh-CN',
  title: 'Aomex',
  description: '流畅的node.js框架',
  theme: defaultTheme({
    repo: 'aomex/aomex',
    docsRepo: 'aomex/aomex-docs',
    editLink: true,
    editLinkText: '编辑这页文档',
    lastUpdated: true,
    lastUpdatedText: '最后更新',
    contributors: false,
    sidebarDepth: 3,

    // 侧边栏数组
    // 所有页面会使用相同的侧边栏
    sidebar: [
      {
        text: '介绍',
        collapsible: true,
        children: [
          {
            text: '是什么',
            link: '/index.html',
          },
          {
            text: '为什么不是',
            link: '/guide/why-not.html',
          },
          {
            text: '快速开始',
          },
        ],
      },
      {
        text: '核心概念',
        collapsible: true,
        children: [
          {
            text: '验证器',
            link: '/core/validator.html',
          },
          {
            text: '中间件',
            link: '/core/middleware.html',
          },
          {
            text: '缓存',
            link: '/core/caching.html',
          },
        ],
      },
      {
        text: 'Web应用',
        collapsible: true,
        children: [
          {
            text: '创建服务',
            link: '/web/index.html',
          },
          {
            text: '路由',
            link: '/web/router.html',
          },
          {
            text: '内置的中间件',
            link: '/web/middleware.html',
          },
          {
            text: '上传文件',
            link: '/web/upload.html',
          },
          {
            text: '链条的作用',
            link: '/web/chain.html',
          },
        ],
      },
      {
        text: '终端应用',
        collapsible: true,
        children: [
          {
            text: '创建入口',
            link: '/console/index.html',
          },
          {
            text: '创建指令',
            link: '/console/commander.html',
          },
          {
            text: '接收参数',
            link: '/console/options.html',
          },
          {
            text: '模拟命令行',
          },
        ],
      },
      {
        text: '官方插件',
        collapsible: true,
        children: [
          {
            text: '压缩内容 compress',
          },
          {
            text: '跨域 cors',
          },
          {
            text: '定时任务 cron',
          },
          {
            text: 'etag',
          },
          {
            text: '报头安全 helmet',
          },
          {
            text: '令牌 JWT',
          },
          {
            text: '日志 logger',
          },
          {
            text: '生成文档 openapi',
          },
          {
            text: '美化输出 pretty-json',
          },
          {
            text: '数据模型层 prisma-model',
          },
          {
            text: '限速 rate-limit',
          },
          {
            text: '计算响应时间 response-time',
          },
          {
            text: '服务层 service',
          },
          {
            text: '静态文件 static',
          },
        ],
      },
    ],
  }),
});
