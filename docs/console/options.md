# 输入参数

数据校验修正、别名、参数名缩写，来自框架的礼物

## 灵活的指令

```typescript{10-12}
// src/commanders/say.ts
import { rule } from '@aomex/core';
import { Commander, options } from '@aomex/console';

export const commander = new Commander();

commander.create('say', {
  mount: [
    options({
      sayToName: rule.string().default('World'),
    }),
  ],
  async action(ctx) {
    const { sayToName } = ctx.options;
    console.log(`Hello ${sayToName}`);
  },
});
```

继续输入指令：

```bash
npx aomex say --sayToName Aomex
```

这次看到了不一样的文字：**Hello Aomex**

## 别名

参数名有点长了，不妨设置一个别名

```typescript
export const commander = new Commander();

commander.create('say', {
  mount: [
    options(
      {
        sayToName: rule.string().default('World'),
      },
      { sayToName: ['m'] }, // [!code ++]
    ),
  ],
  async action(ctx) {
    const { sayToName } = ctx.options;
    console.log(`Hello ${sayToName}`);
  },
});
```

设置了别名，原来的参数名也可以继续使用。

```bash
npx aomex say -m Aomex
npx aomex say --sayToName Aomex
```

## --no-前缀

参数名如果加上了`--no-`前缀，则代表它的值是false，而且我们在逻辑中不需要关心这个前缀

```bash
npx aomex schedule --reload     # reload=true
npx aomex schedule --no-reload  # reload=false
```

## 传递对象

虽然命令行只能传递字符串，但是`对象验证器`有一个方法叫做`parseFromString()`，可以轻松地获取对象

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

接着执行这么一段指令：

```bash
npx aomex schedule --user '{"id":1,"name":"bill"}'
```

办法总是比困难多，欢呼吧！

## 快速查看参数

执行指令`npx aomex say --help`，可以看到如下文字：

```
aomex say [选项]

打招呼详情

选项：
  -m, --sayToName           [字符串] [默认值: "World"]
```
