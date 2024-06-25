# 服务层

如果把路由层当作控制层(Controller)，那么我们仍然需要一个服务层(Service)。中大型项目业务庞杂，如果没有服务层，会导致代码重复，尤其是协同开发的项目，开发者之间无法总是知道对方是否写过相同的逻辑。

## 创建入口

service采用单例模式创建，可以在任意地方使用

```typescript
// ./src/services/index.ts
import { combineServices } from '@aomex/core';

export const services = await combineServices({
  // 这里注册服务
});

declare module '@aomex/core' {
  type T = typeof services;
  export interface CombinedServices extends T {}
}
```

## 第一个服务

框架提供 Service 基础类，继承它即可

```typescript
// ./src/services/user.service.ts
import { Service } from '@aomex/core';

export class UserService extends Service {
  findAll() {
    return db.user.findAll();
  }

  findOne(userId: number) {
    return db.user.findOne({ where: { user_id: userId } });
  }

  countPosts(userId: number) {
    return db.post.count({ where: { user_id: userId } });
  }
}
```

接着把服务注册到入口

```typescript
// ./src/services/index.ts
import { combineServices } from '@aomex/core';
import { UserService } from './user.service'; // [!code ++]

export const services = await combineServices({
  user: UserService, // [!code ++]
});
```

## 使用服务

```typescript{1,10,21}
import { services } from '../services';

const router = new Router();

// 开发者A
router.get('/users', {
  action: async (ctx) => {
    const users = await services.user.findAll();
    users.forEach((user) => {
      user.post_count = await services.user.countPosts(user.id);
    });
    ctx.send(users);
  },
});

// 开发者B
router.get('/users/:id', {
  action: async (ctx) => {
    const { id } = ctx.params;
    const user = await services.user.findOne(id);
    user.post_count = await services.user.countPosts(id);
    ctx.send(users);
  },
});
```

随着时间的推移，开发者A 发现获取`post_count`的逻辑有问题，只有已发布文章才能统计进去，因此作为如下修改：

```typescript
// 开发者A
export class UserService extends Service {
  countPosts(userId: number) {
    return db.post.count({
      where: {
        user_id: userId,
        status: 1, // [!code ++]
      },
    });
  }
}
```

由于 开发者B 也使用了相同的方法，因此无需再做任何处理。这就是服务层的妙处！

## 服务初始化

一些服务需要处理一些连接操作后才能使用，比如 redis、mysql连接。不用担心，框架提供了初始化方法`init()`，并自动等待异步操作完成

```typescript{4-7}
export class RedisService extends Service {
  protected redis!: Redis;

  protected override async init() {
    this.redis = new Redis();
    await redis.connect();
  }

  getValue(key: string) {
    return this.redis.get(key);
  }

  async setValue(key: string, value: string) {
    await this.redis.set(key, value);
  }
}
```

同样地，别忘了注册服务

```typescript
// ./src/services/index.ts
import { combineServices } from '@aomex/core';
import { UserService } from './user.service';
import { RedisService } from './redis.service'; // [!code ++]

export const services = await combineServices({
  user: UserService,
  redis: RedisService, // [!code ++]
});
```

## 服务中使用服务

还记得服务入口那一段代码吗？再温习一下

```typescript
// ./src/services/index.ts
import { combineServices } from '@aomex/core';

export const services = await combineServices({
  // 这里注册服务
});

/* prettier-ignore */
declare module '@aomex/core' { // [!code focus]
  type T = typeof services; // [!code focus]
  export interface CombinedServices extends T {} // [!code focus]
} // [!code focus]
```

类型扩展让我们可以在服务实例中愉快地使用其他服务

```typescript
// ./src/services/user.service.ts
import { Service } from '@aomex/core';

export class UserService extends Service {
  async countPosts(userId: number) {
    let amount = await this.services.redis.getValue('post_count'); // [!code ++]
    if (!amount) {
      amount = await db.post.count({ where: { user_id: userId } });
      await this.services.redis.setValue('post_count', amount); // [!code ++]
    }
    return amount;
  }
}
```
