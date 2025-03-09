import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'aomex.js',
  lang: 'zh-CN',
  description: '流畅的 node.js 框架',
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  themeConfig: {
    editLink: {
      pattern: 'https://github.com/aomex/aomex.github.io/tree/main/docs/:path',
      text: '编辑当前文档',
    },
    outline: {
      level: 'deep',
      label: '当前页大纲',
    },
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
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
        },
      },
    },

    sidebar: [
      {
        text: '开始',
        items: [{ text: '快速安装', link: '/starting/installation' }],
      },
      {
        text: '核心概念',
        collapsed: false,
        items: [
          {
            text: '验证器',
            link: '/core/validator',
          },
          {
            text: '中间件',
            link: '/core/middleware',
          },
        ],
      },
      {
        text: 'Web应用',
        collapsed: false,
        items: [
          {
            text: '应用入口',
            link: '/web/index',
          },
          {
            text: '接口路由',
            link: '/web/router',
          },
          {
            text: '输入输出',
            items: [
              {
                text: '查询字符串',
                link: '/web/query',
              },
              {
                text: '请求实体',
                link: '/web/body',
              },
              {
                text: '路径参数',
                link: '/web/params',
              },
              {
                text: '接收附件',
                link: '/web/attach',
              },
              {
                text: '约束响应结果',
                link: '/web/response',
              },
              {
                text: 'Prisma验证器',
                link: '/plugins/prisma-validator',
              },
            ],
          },
          {
            text: '跨域共享',
            link: '/plugins/cors',
          },
          {
            text: '压缩内容',
            link: '/plugins/compress',
          },
          {
            text: '安全报文',
            link: '/plugins/helmet',
          },
          {
            text: 'ETag',
            link: '/plugins/etag',
          },
          {
            text: '身份',
            items: [
              { text: '身份认证', link: '/plugins/auth' },
              {
                text: 'Bearer策略',
                link: '/plugins/auth-bearer-strategy',
              },
              {
                text: 'JWT策略',
                link: '/plugins/auth-jwt-strategy',
              },
            ],
          },
          {
            text: '请求日志',
            link: '/plugins/http-logger',
          },
          {
            text: '美化JSON',
            link: '/plugins/pretty-json',
          },
          {
            text: '请求速率限制',
            link: '/plugins/rate-limit',
          },
          {
            text: '统计响应时间',
            link: '/plugins/response-time',
          },
          {
            text: '静态文件',
            link: '/plugins/static',
          },
        ],
      },
      {
        text: 'Console应用',
        collapsed: false,
        items: [
          {
            text: '应用入口',
            link: '/console/index',
          },
          {
            text: '指令路由',
            link: '/console/commander',
          },
          {
            text: '输入参数',
            link: '/console/options',
          },
          {
            text: '定时任务',
            link: '/plugins/cron',
          },
        ],
      },
      {
        text: '高级指南',
        collapsed: false,
        items: [
          {
            text: '服务层',
            link: '/core/service',
          },
          {
            text: '链路追踪',
            link: '/plugins/async-trace',
          },
          {
            text: '国际化',
            link: '/core/i18n',
          },
          {
            text: 'openapi文档',
            link: '/plugins/openapi',
          },
          {
            text: '缓存',
            link: '/core/cache',
          },
          {
            text: '日志',
            link: '/core/logger',
          },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/aomex/aomex' }],
  },
});
