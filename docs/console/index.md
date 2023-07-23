# 创建入口

对于需要主动触发的业务逻辑，我们必须执行类似`node schedule.js`这种命令。对于业务逻辑，执行单个js文件可能面临以下问题：

- 无法复用中间件
- 参数接收过滤麻烦
- 执行时不清楚需要哪些参数
- 管理松散

此时终端应用闪亮登场，让你的任务正规化，可视化

## 安装

[![npm](https://img.shields.io/npm/v/@aomex/console?logo=npm&label=@aomex/console)](https://www.npmjs.com/package/@aomex/console)
[![npm](https://img.shields.io/npm/v/@aomex/console?logo=npm&label=@aomex/commander)](https://www.npmjs.com/package/@aomex/commander)

```bash:no-line-numbers
pnpm add @aomex/core @aomex/console @aomex/commander
pnpm add typescript @types/node -D
```

## 初始化

执行如下命令：

```bash:no-line-numbers
npx aomex --init
```

接着项目根目录会生成一个`aomex.json`的文件，它的作用就是根据不同的`process.env.NODE_ENV`找到你的入口文件

```json:no-line-numbers
// aomex.json
{
  "$schema": "./node_modules/@aomex/console/config.json",
  "cliEntry": {
    "production": "./src/cli.js",
    "default": "./src/cli.ts"
  }
}
```

然后我们根据提示创建出入口文件：

```typescript
// ./src/cli.ts
import { ConsoleApp } from '@aomex/console';

const app = new ConsoleApp();

const code = await app.run();
process.exit(code);
```

恭喜，终端应用已经初步成型。试着输入如下指令，看看会输出什么内容

```bash
npx aomex --help
```
