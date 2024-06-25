# 约束响应结果 <Badge type="info" text="openapi" />

如果项目有生成openapi文档的需求，则需要使用类型约束响应的结果，以及约束状态码。这样可以保证业务修改后，文档也能同步更新。

:::info
这里涉及的约束仅为TypeScript的`静态类型`约束，不会降低运行时效率。
:::

## 2xx

2开头的状态码多数代表请求成功，框架将开放`ctx.send`方法，并屏蔽 ~~throw~~ 和 ~~redirect~~ 方法

```typescript
router.get('/users', {
  mount: [
    response({
      statusCode: 200,
      content: rule.array({
        id: rule.int(),
        name: rule.string(),
      }),
    }),
  ],
  action: async (ctx) => {
    ctx.send(200, result);
    ctx.redirect(302, 'http://example.com');
          ⤷ Property 'redirect' does not exist on type 'object' // [!code error]
    ctx.throw(400);
          ⤷ Property 'throw' does not exist on type 'object' // [!code error]
  },
});
```

## 3xx

3开头的状态码多数代表跳转，框架将开放`ctx.redirect`方法，并屏蔽 ~~throw~~ 和 ~~send~~ 方法

```typescript
router.get('/users', {
  mount: [
    response({
      statusCode: 302,
    }),
  ],
  action: async (ctx) => {
    ctx.redirect(302, 'http://example.com');
    ctx.send(200, result);
          ⤷ Property 'send' does not exist on type 'object' // [!code error]
    ctx.throw(400);
          ⤷ Property 'throw' does not exist on type 'object' // [!code error]
  },
});
```

## 4xx | 5xx

4和5开头的状态码多数代表请求异常，框架将开放`ctx.throw`方法，并屏蔽 ~~send~~ 和 ~~redirect~~ 方法

```typescript
router.get('/users', {
  mount: [
    response({
      statusCode: 400,
      description: 'client error',
    }),
  ],
  action: async (ctx) => {
    ctx.throw(400, 'client error');
    ctx.send(200, result);
          ⤷ Property 'send' does not exist on type 'object' // [!code error]
    ctx.throw(400);
          ⤷ Property 'throw' does not exist on type 'object' // [!code error]
  },
});
```

## 状态码混用

请求资源时，找到则返回200状态码，找不到则返回404状态码。因此需要补充多个状态码

```typescript
router.get('/users/:id', {
  mount: [
    response({
      statusCode: 200,
      content: {
        id: rule.int(),
        name: rule.string(),
      }
    }),
    response({
      statusCode: 404,
      description: 'user not found',
    }),
  ],
  action: async (ctx) => {
    ctx.throw(404, 'user not found');
    ctx.send(200, user);
    ctx.redirect(302, 'http://example.com');
          ⤷ Property 'redirect' does not exist on type 'object' // [!code error]
  },
});
```
