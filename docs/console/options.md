# 接收参数

虽然命令行是在内部执行的，不存在黑客和无聊的人捣乱，但是难免会有一些粗心的开发者写错单词或者少传参数，因此框架提供了参数接收神器`options`

```typescript
// ./src/commanders/say.ts
import { rule } from '@aomex/core';
import { options } from '@aomex/console';
import { Commander } from '@aomex/commander';

export const commander = new Commander();

commander.create('schedule', {
  mount: [
    options({
      machineId: rule.int().min(1),
      reload: rule.boolean().default(false),
    }),
  ],
  /**
   * ctx类型自动推导
   * options: { machineId: number; reload: boolean; }
   */
  async action(ctx) {
    const { machineId, reload } = ctx.options;
    // 逻辑
  },
});
```

接着指令可以这么写：

```bash:no-line-numbers
npx aomex schedule --machineId 23
npx aomex schedule --machineId 105 --reload
```

## 别名

如果你觉得参数名太长了，可以为参数设置短别名

```typescript
options(
  {
    machineId: rule.int().min(1),
    reload: rule.boolean().default(false),
  },
  {
    machineId: ['id', 'i'],
    reload: 'r',
  },
);
```

设置了别名，原来的参数名也可以继续使用。

```bash:no-line-numbers
npx aomex schedule --id 23 --reload
npx aomex schedule -i 105 -r
```

## --no-前缀

参数名如果加上了`--no-`前缀，则代表它的值是false，而且我们在逻辑中不需要关心这个前缀

```bash:no-line-numbers
npx aomex schedule --reload     # reload=true
npx aomex schedule --no-reload  # reload=false
```

## 传递对象

很抱歉，命令行只能传递字符串。但其实也有办法解决，因为`对象验证器`有一个方法叫做`parseFromString()`，好家伙，一起试试嘛

```typescript
commander.create('schedule', {
  mount: [
    options({
      user: rule
        .object({
          id: rule.int(),
          name: rule.string,
        })
        .parseFromString(),
    }),
  ],
  action(ctx) {
    console.log(ctx.options.user);
  },
});
```

接着执行这么一段指令。

```bash:no-line-numbers
npx aomex schedule --user '{"id":1,"name":"bill"}'
```

办法总是比困难多，欢呼吧！
