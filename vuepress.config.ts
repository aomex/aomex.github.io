import { defineUserConfig } from 'vuepress';
import { defaultTheme } from '@vuepress/theme-default';
import { docsearchPlugin } from '@vuepress/plugin-docsearch';

export default defineUserConfig({
  lang: 'zh-CN',
  title: 'Aomex',
  description: '流畅的node.js框架',
  plugins: [
    docsearchPlugin({
      appId: 'KTATXKGPDA',
      apiKey: 'e0abbeb47d518aaa5af5af838ab6dcdc',
      indexName: 'aomex-js',
      placeholder: '搜索文档',
    }),
  ],
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
            link: '/console/mock.html',
          },
        ],
      },
      {
        text: '官方插件',
        collapsible: true,
        children: [
          {
            text: '压缩内容',
            link: '/plugins/compress.html',
          },
          {
            text: '跨域',
          },
          {
            text: '定时任务',
          },
          {
            text: 'ETag报头',
          },
          {
            text: '报头安全',
          },
          {
            text: 'JWT令牌',
          },
          {
            text: '请求日志',
          },
          {
            text: '生成openapi文档',
          },
          {
            text: '美化JSON输出',
          },
          {
            text: 'Prisma数据模型层',
          },
          {
            text: '速率限制',
          },
          {
            text: '计算API响应时间',
          },
          {
            text: '服务层',
          },
          {
            text: '请求静态文件',
          },
        ],
      },
    ],
  }),
});
