# openapi生成器

为http服务接口生成标准的openapi 3.0文档。http服务中的 **路由、中间件、验证器**，这些其实都已经携带了openapi信息，相当于你啥也不用干，就已经生成了70%的文档。而且框架允许你把剩下的30%按需补全。

## 安装

```bash
pnpm add @aomex/openapi
```

## 动态生成文档

允许在web应用或者console应用自由使用

```typescript
import { generateOpenapi } from '@aomex/openapi';

const document = await generateOpenapi({ routers: './src/routers' });
```

### 自定义文档信息

一些文档的基础信息可以通过配置传入

```typescript{3}
generateOpenapi({
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

### 手动修复文档

插件生成的内容如果不符合业务需求，则可以传递函数进行二次修正

```typescript{3}
generateOpenapi({
  routers: './src/routers',
  fix: (docs) => {
    const tag = docs.tags.find((tag) => tag.name === 'x');
    tag?.description = '这是一个说明';
  },
});
```

## 与swagger配合

有了openapi文档结构数据，现在急需一个能解析文档并生成网页的工具供用户浏览，因此swagger登场。在线体验网址：[petstore.swagger.io](https://petstore.swagger.io/)

### 安装

```bash
pnpm add @aomex/swagger-ui
```

### 使用

```typescript
import { WebApp } from '@aomex/web';
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi';

const app = new WebApp({
  mount: [
    swaggerUI({
      openapi: () => {
        return generateOpenapi({ routers: './src/routers' });
      },
    }),
  ],
});

app.listen(3000);
```

接着就可以在浏览器输入 `http://localhost:3000/swagger` 网址查看项目文档了

### 参数

#### openapi

类型：`string | (() => Promise<OpenAPI.Document> | OpenAPI.Document)`

文档内容，有三种方式可以提供openapi文档：

1. 文件路径，支持json和yaml格式

```typescript
swaggerUI({ openapi: './openapi.json' });
swaggerUI({ openapi: './openapi.yaml' });
```

2. 传入函数直接生成

```typescript
swaggerUI({
  openapi: () => {
    return {
      version: '3.0.0',
      info: { title: 'aomex', version: '1.0.1' },
      paths: {},
    };
  },
});
```

3. 利用`@aomex/openapi`动态生成（推荐）

```typescript
// 请先安装包
import { generateOpenapi } from '@aomex/openapi';

swaggerUI({
  openapi: () => {
    return generateOpenapi({ routers: './src/routers' });
  },
});
```

#### uriPrefix

类型：`string`<br>
默认值：`'/swagger'`

为了更好地区分常规接口和swagger文档，建议设置一个请求路径前缀

#### enable

类型：`(ctx?: WebContext) => boolean | Promise<boolean>`

是否允许访问文档服务，每次请求都会询问

### 访问纯JSON文档

swagger服务创建后，中间件内部包含了一个直接访问文档的接口。格式如下：`http://host.com/swagger/openapi.json`

## 与前端项目配合

如果跟你配合的前端大佬是个暴脾气，觉得看swagger文档还是太慢了，参数容易抄错，TS类型也要自己写。这时我们就可以掏给他一个不要钱的前端库 [foca-openapi](https://github.com/foca-js/foca-openapi)，让他自己生成`前端请求服务`，体验梭哈的感觉

```typescript
// openapi.config.ts
import { defineConfig } from 'foca-openapi';

export default defineConfig({
  // 本地文件或者在线实时获取
  path: 'http://host.com/swagger/openapi.json',
});
```

让他执行指令 `npx foca-openapi` 后就能获得满屏的类型提示了，从此再也不会来找你的麻烦

```typescript
// index.ts
import { OpenapiClient } from 'foca-openapi';
import { fetchAdapter } from 'foca-openapi/adapters/fetch';

const adapter = fetchAdapter({ baseURL: 'http://host.com' });
const client = new OpenapiClient(adapter);

// rest模式
const users = await client.get('/users');
// rpc模式
const users = await client.getUsers();
// rpc-group模式
const users = await client.user.getUsers();
```

## 生成静态文件

处于某种无法满足的原因，你希望提前生成openapi.json文件，那么可以在console应用中使用指令生成

### 挂载

```typescript
// src/cli.ts
import { ConsoleApp } from '@aomex/console';
import { openapi } from '@aomex/openapi';

const app = new ConsoleApp({
  mount: [openapi({ routers: './src/routers' })],
});
```

### 开始生成

```bash
npx aomex openapi
```

执行成功后，项目下会自动创建一个`openapi.json`的文件。该文件可以被任意支持 openapi V3 的文档平台解析（包括swagger）

### 指定格式

如果不指定文件名，插件默认使用 `openapi.json` 作为目标文件。文件名的后缀也决定了格式的选择：

- `*.json` 保存为JSON格式
- `*.yaml` 保存为YAML格式

```typescript
openapi({
  routers: './src/routers',
  saveToFile: 'openapi.yaml', // [!code ++]
});
```
