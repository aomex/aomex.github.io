# openapi生成器

为http服务接口生成标准的openapi 3.0文档。http服务中的 **路由、中间件、验证器**，这些其实都已经携带了openapi信息，相当于你啥也不用干，就已经生成了70%的文档。而且框架允许你把剩下的30%按需补全。

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

## 在web路由中使用

是的没错，生成openapi文档不一定要用cli，直接引入包可以实现相同的效果（区别就是这边属于静默生成，终端无提示文字）

```typescript
import { Router } from '@aomex/web';
import { generateOpenapi } from '@aomex/openapi';

const router = new Router();

router.get('/openapi.json', {
  action: async (ctx) => {
    const { document } = await generateOpenapi({
      routers: './src/routers',
    });
    ctx.send(document);
  },
});
```

## 与前端配合

openapi文档可以用来做很多有趣的事情，其中一件就是生成`前端请求服务`，这里推荐作者另一个前端系列的库 [foca-openapi](https://github.com/foca-js/foca-openapi)。我们可以这么用：

```typescript
// openapi.config.ts
import { defineConfig } from 'foca-openapi';

export default defineConfig({
  // 本地文件或者在线实时获取
  path: 'http://host.com/openapi.json?token=约定令牌',
});
```

执行生成指令 `npx foca-openapi` 后就能获得满屏的类型提示了

```typescript
// index.ts
import { OpenapiClient } from 'foca-openapi';
import { fetchAdapter } from 'foca-openapi/adapters/fetch';

const adapter = fetchAdapter({ baseURL: 'http://host.com' });
const client = new OpenapiClient(adapter);

const users = await client.get('/users');
```
