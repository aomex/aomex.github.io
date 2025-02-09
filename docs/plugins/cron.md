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

const cache = new Caching(redisAdapter({ host: 'http://' }));
const app = new ConsoleApp({
  mount: [
    crons({
      cache,
    }),
  ],
});
```

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
      serves: 5, // [!code ++]
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

现在，所有启动的服务中有5个会定期执行任务。

## 并发和重叠

框架使用`concurrent`参数控制同时执行任务的数量。concurrent未设置时，它会使用`serves`的值作为默认值，这样可以保证同一时间点集群指定服务生成的任务能够刚好被允许执行。

如果当前时间点A的任务在下一个时间点B到达时仍未完成，则会面临任务重叠的问题。时间A完成了 3/5，则时间B只有 2/5 的任务能被允许执行，B剩下的 3/5 任务会被放入等待池，并不断尝试获得执行权，直到超时被丢弃。

增加`concurrent`的值能有效地解决任务重叠时并发额度不足的问题

```typescript
// src/commanders/mail.ts
import { Commander } from '@aomex/console';
import { cron } from '@aomex/cron';

export const commander = new Commander();

commander.create('send:mail', {
  mount: [
    cron({
      minute: '*',
      serves: 5,
      concurrent: 12, // [!code ++]
    }),
  ],
  action: async (ctx) => {
    // 1分钟内无法完成的任务，同一时间可能会有10个任务并发执行
  },
});
```

## 等待时间

重叠的任务在`10秒`内是安全的，它会在等待池不断尝试获得执行权。这个时间也可以通过传递`waitingTimeout`人为控制。

```typescript
// src/commanders/mail.ts
import { Commander } from '@aomex/console';
import { cron } from '@aomex/cron';

export const commander = new Commander();

commander.create('send:mail', {
  mount: [
    cron({
      minute: '*',
      waitingTimeout: 15_000, // [!code ++]
    }),
  ],
  action: async (ctx) => {
    // 1分15秒内完成，下一个时间点的任务就能获得执行权
  },
});
```
