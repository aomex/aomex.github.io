# 定时任务

在node.js里定时执行指令

## 安装

```bash
pnpm add @aomex/cron
```

## 使用

定时任务依赖指令，因此请先编写指令。

```typescript
// src/cli.ts
import { ConsoleApp } from '@aomex/core';
import { commanders } from '@aomex/cron';
import { crons } from '@aomex/cron';

const app = new ConsoleApp({
  mount: [
    crons({ commanders: './src/commanders' }),
    commanders('./src/commanders'),
  ],
});
```

## 携带指令

输入`npx aomex -h`可以查看所有指令和描述

| 指令             | 描述                 |
| ---------------- | -------------------- |
| aomex cron:start | 启动定时任务         |
| aomex cron:eject | 导出定时任务列表     |
| aomex cron:stop  | 退出定时任务         |
| aomex cron:stats | 查看定时任务执行状态 |

## 第一个打招呼任务

```typescript{9-11}
// src/commanders/say.ts
import { Commander } from '@aomex/console';
import { cron } from '@aomex/cron';

export const commander = new Commander();

commander.create('say', {
  mount: [
    cron({
      minute: '*/10',
    }),
  ],
  action: (ctx) => {
    console.log('Hello World');
  },
});
```

## 启动任务

```bash
npx aomex cron:start
```

每隔10分钟就会有人向我打招呼，真礼貌！

## 单指令多任务

如果同时要向 唐三 和 小舞 打招呼，是否可行？试试

```typescript
// src/commanders/say.ts
import { cron } from '@aomex/cron';
import { Commander, options } from '@aomex/console';

export const commander = new Commander();

commander.create('say', {
  mount: [
    options({
      name: rule.string(),
    }),
    cron({
      minute: '*/10',
      args: ['--name', '唐三'],
    }),
    cron({
      minute: '*/10',
      args: ['--name', '小舞'],
    }),
  ],
  action: (ctx) => {
    const { name } = ctx.options;
    console.log(`Hello ${name}`);
  },
});
```

定时任务加入参数，再多招呼都能打。

## 集群

集群服务需通过存储介质共享状态，可以考虑如下介质：

- [@aomex/cache-redis-adapter](https://www.npmjs.com/package/@aomex/cache-redis-adapter)

```typescript
import { Caching } from '@aomex/cache';
import { redisAdapter } from '@aomex/cache-redis-adapter';

crons({
  cache: new Caching(redisAdapter({ host: 'http://', ... })),
});
```

## 任务并发

在集群服务中，每个服务会触发相同的任务，框架默认只允许一个服务通过抢占的形式获得任务并执行。因为并发任务就像多线程操作，读取资源需要设置排斥锁才能保证安全，否则一不留神就会造成业务被多次处理而出问题。

当然，我们也可以通过参数修改这种默认行为，让并发执行成为可能（但是注意加锁）：

```typescript
// src/commanders/mail.ts
import { Commander } from '@aomex/console';
import { cron } from '@aomex/cron';

export const commander = new Commander();

commander.create('send:mail', {
  mount: [
    cron({
      minute: '*',
      concurrent: Infinity, // [!code ++]
    }),
  ],
  action: async (ctx) => {
    // 加锁，否则可能被其它服务获取
    const mail = await service.findAndLockMail();
    try {
      await service.sendMail(mail);
    } catch {
      await service.unlockMail(mail);
    }
  },
});
```

现在，所有启动的服务都会每隔一分钟发送一次邮件。
