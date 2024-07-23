# Swagger服务

解析openapi文档并提供展示的网页，基于swagger-ui，在线体验网址：[petstore.swagger.io](https://petstore.swagger.io/)

## 安装

```bash
pnpm add @aomex/swagger-ui
```

## 使用

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

## 访问纯JSON文档

服务创建后，中间件内部包含了一个直接访问文档的接口。格式如下：`http://localhost:3000/swagger/openapi.json`

## 参数

### openapi

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

### uriPrefix

类型：`string`<br>
默认值：`'/swagger'`

为了更好地区分常规接口和swagger文档，建议设置一个请求路径前缀

### enable

类型：`(ctx?: WebContext) => boolean | Promise<boolean>`

是否允许访问文档服务，每次请求都会询问
