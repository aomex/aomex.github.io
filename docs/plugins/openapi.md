# 文档生成器

为http服务接口生成标准的openapi文档

## 安装

```bash
pnpm add @aomex/openapi
```

## 挂载

```typescript
// src/cli.ts
import { ConsoleApp } from '@aomex/core';
import { openapi } from '@aomex/openapi';

const app = new ConsoleApp({
  mount: [openapi({ routers: './src/routers' })],
});
```

## 开始生成

```bash
npx aomex openapi
```

执行成功后，项目下会自动创建一个`openapi.json`的文件。该文件可以被 [swagger](https://petstore.swagger.io/)文档平台或者任意支持 openapi V3 的文档平台解析

## 自定义文档信息

一些文档的基础信息可以通过配置传入

```typescript{3}
openapi({
  routers: './src/routers',
  docs: {
    info: {
      title: '一个好项目',
    },
    servers: [
      {
        url: 'https://example.com',
        description: '正式环境',
      },
      {
        url: 'http://localhost:3000',
        description: '本地开发',
      },
    ],
  },
});
```

## 手动修复文档

插件生成的内容如果不符合业务需求，则可以传递函数进行二次修正

```typescript{3}
openapi({
  routers: './src/routers',
  fix: (docs) => {
    const tag = docs.tags.find((tag) => tag.name === 'x');
    tag?.description = '这是一个说明';
  },
});
```

## 指定格式

如果不指定文件名，插件默认使用 `openapi.json` 作为目标文件。文件名的后缀也决定了格式的选择：

- `*.json` 保存为JSON格式
- `*.yml` 保存为YAML格式
- `*.yaml` 保存为YAML格式

```typescript
openapi({
  routers: './src/routers',
  saveToFile: 'openapi.yaml', // [!code ++]
});
```
