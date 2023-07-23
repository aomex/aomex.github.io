# 创建指令

指令的创建其实和Web应用中的`路由`差不多，只不过换了一个库。在创建之前，我们先新建一个文件夹`src/commanders`，接着想想你的第一个指令应该做些什么？不然还是从Hello world开始吧^\_^

```typescript
// ./src/commanders/say.ts
import { Commander } from '@aomex/commander';

export const commander = new Commander();

commander.create('say', {
  action(ctx) {
    console.log('Hello world');
  },
});
```

看看能不能输出这段文字：

```bash:no-line-numbers
npx aomex say
```

不出意外，应该是报错了。抱歉，我们忘了告诉入口应该去哪里找指令

```typescript:{3,6}
// ./src/cli.ts
import { ConsoleApp } from '@aomex/console';
import { commanders } from '@aomex/commander';

const app = new ConsoleApp();
app.mount(commanders('./src/commanders'));

const code = await app.run();
process.exit(code);
```

这下好了，再执行一次`npx aomex say`试试。你可能不太喜欢向全世界问好，反而更愿意问候身边的朋友，我们支持你的选择并对指令做出一些改变

```typescript
// ./src/commanders/say.ts
import { rule } from '@aomex/core';
import { options } from '@aomex/console';
import { Commander } from '@aomex/commander';

export const commander = new Commander();

commander.create('say', {
  mount: [
    options({
      name: rule.string().default('world'),
    }),
  ],
  action(ctx) {
    console.log(`Hello ${ctx.options.name}`);
  },
});
```

现在，指令开始允许接收一个叫`name`的参数，如果你不说问候谁，那就仍是全世界

```bash:no-line-numbers
npx aomex say --name bill # Hello bill
npx aomex say --name bro # Hello bro
npx aomex say  # Hello world
```
