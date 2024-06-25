# 中间件

老牌框架express和koa创建了中间件的概念，其中koa的中间件因为采用`洋葱模型`而广受业界好评。受此熏陶，本框架采用与koa同样的中间件逻辑

<img src="./middleware.jpg" height="350">

## 第一个中间件

从核心包导出`middleware`对象即可快速创建一个中间件

```typescript
import { middleware } from '@aomex/core';

export const md = middleware.mixin(async (ctx, next) => {
  console.log('enter');
  await next();
  console.log('exit');
});
```

`ctx`是一个对象，穿梭在各个中间件，可以获取属性和设置新的属性。<br>
`next`是一个函数，代表继续执行下一个中间件

## 类型提示

默认地，ctx变量的初始类型为`object`，因此在.ts文件中如果想操作对象，则会发生类型报错。

```typescript
export const md = middleware.mixin(async (ctx, next) => {
  ctx.foo = 'bar';
       ⤷ Property 'foo' does not exist on type 'object'. // [!code error]
  await next();
});

console.log(md); // MixinMiddleware<object>

```

对于TS项目，这能忍？框架不能忍。为此中间件提供了泛型策略，既能提示内部函数，也能自动导出对外使用，一举两得

```typescript{2}
interface Props {
  readonly foo: string;
}

export const md = middleware.mixin<Props>(async (ctx, next) => {
  ctx.foo = 'bar';
  await next();
});

console.log(md); // MixinMiddleware<{ readonly foo: string }>
```

## 执行顺序

正如开头看到的那张图，中间件遵循洋葱模型，从左边往右依次执行，接着从右往左反向执行。

```typescript
import { compose } from '@aomex/core';

const a = middleware.mixin(async (ctx, next) => {
  console.log(1);
  await next();
  console.log(6);
});

const b = middleware.mixin(async (ctx, next) => {
  console.log(2);
  await next();
  console.log(5);
});

const c = middleware.mixin(async (ctx, next) => {
  console.log(3);
  await next();
  console.log(4);
});

// 输出：1 2 3 4 5 6
await compose([a, b, c])({});
```
