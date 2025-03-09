# 日志

如果想通过业务运行过程中输出的文字进行分析，直接使用 `console.log` 会导致信息过度集中，难以分类，也无法存储归档。不妨试下框架提供的日志功能

## 使用

```typescript
import { Logger } from '@aomex/common';

export const logger = Logger.create({
  levels: ['debug', 'info', 'warn', 'error'],
  transports: [
    {
      transport: new Logger.transports.Console(),
      level: { from: 'debug' },
    },
  ],
});

// logger.info('hello world');
// logger.error('oops, something went wrong');
```

## 参数

### levels

日志的等级名称，等级从左到右依次变大，至于名称可以随意配置，看着舒服就行。

### transports

日志消费实例列表，可指定接收的日志等级。

- 消费所有等级 `level: 'all'`
- 消费指定等级 `level: ['info', 'error']`
- 消费等级区间 `level: {from : 'debug', to: 'warn'}`
- 关闭消费功能 `level: 'none'`

## 内置的消费实例

### ConsoleTransport

日志输出到终端，甚至可以为不同的等级配置不同的输出颜色

```typescript
import { Logger } from '@aomex/common';

const transport = new Logger.transports.Console({
  colors: {
    debug: 'gray',
    info: 'green',
    warn: 'yellow',
    error: 'red',
  },
});
```

### FileTransport

日志输出到文件，也可以根据日期生成文件

```typescript
import { Logger } from '@aomex/common';

const transport = new Logger.transports.File({
  file: `logs/error-{year}-{month}-{day}.log`,
});
```

时间占位符如下：

- `{year}` 年
- `{month}` 月
- `{day}` 日
- `{hour}` 时
- `{minute}` 分
- `{second}` 秒

### CustomTransport

自定义消费

```typescript
import { Logger } from '@aomex/common';

const transport = new Logger.transports.Custom({
  async consume(log) {
    // 消费逻辑
  },
});
```

## 自定义消费实例

与内置的 CustomTransport 类似，但是自定义class可以自定义方法，也可以传入初始化参数，能更好地分离逻辑。

```typescript
import { LoggerTransport } from '@aomex/common';

export class MyTransport extends LoggerTransport {
  constructor(opts) {
    super();
    // 初始化
  }

  override async consume(log: Logger.Log): Promise<any> {
    // 消费逻辑
  }

  protected methodA() {}

  protected methodB() {}
}
```
