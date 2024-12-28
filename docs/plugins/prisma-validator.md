# Prisma验证器

路由过滤的数据往往和数据库的字段保持一致，为了避免重复操作或者修改字段后与类型不同步问题，框架提供一套工具把表结构转换成对应的验证器。

## 安装

```bash:no-line-numbers
pnpm add @aomex/prisma
```

## 初始化

#### 1. 在文件 `prisma/schema.prisma` 中引入插件

```diff
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

+ generator aomex {
+   provider = "aomex-prisma"
+ }

model user {
  id    Int  @id @default(autoincrement())
  /// 这是一段注释，会被写入验证器。注意开头是3个斜杆
  name  String
  age   Int?
  created_at DateTime @default(now())
  updated_at DateTime @default(now()) @updatedAt()
}
```

#### 2. 执行生成脚本

```bash
npx prisma generate
```

生成的验证器代码会保存在 `node_modules/@aomex/prisma` 目录（与@prisma/client做法一致）。修改表结构后，需要重新执行生成代码

## 使用

```typescript
import { body, Router } from '@aomex/web';
import { prismaInput, prismaOutput } from '@aomex/prisma';

export const router = new Router();

router.post('/users', {
  mount: [
    body({
      // 等价于：{ name: rule.string(), age: rule.int().optional() }
      ...prismaInput.user.pick('name', 'age'),
    }),
    response({
      statusCode: 201,
      // 包含所有字段：id, name, age, created_at, updated_at
      content: prismaOutput.user.columns,
    }),
  ],
  action: async (ctx) => {
    const { name, age } = ctx.body;
    const user = await save(name, age);
    ctx.send(201, user);
  },
});
```

## 子集

有些接口只需要传入部分字段，比如创建时一般不需要 自增编号，时间 这些字段，那就可以直接使用剔除函数

```typescript
import { prismaInput } from '@aomex/prisma';

// 等价于：{ name: rule.string(), age: rule.int().optional() }
prismaInput.user.omit('id', 'created_at', 'updated_at');
```

或者直接指定你想要的字段也行

```typescript
import { prismaInput } from '@aomex/prisma';

prismaInput.user.pick('name', 'age');
```

**pick**的优点是：精确控制想要的字段；缺点是：数据库增删字段时路由层也需要同步增删。<br>
**omit**的优点是：只需过滤掉可自动生成的字段；缺点是：不够直观。
