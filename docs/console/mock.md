# 模拟命令行

还记得创建入口时的一行代码吗？它的作用就是接收命令行并找到和执行相应的指令

```typescript
await app.run();
```

现在我要告诉你的是，你不需要在命令行里填写参数也能执行指令。比如这样：

```typescript
await app.run('schedule', '--id', '25', '--reload');
```

居然把参数写在了代码里，有趣。但仔细想想似乎和直接用命令行传入区别不大？如果是在入口这么写的话确实意义不大，而且我们还把参数固定死了，何必呢？

如果是用在指令逻辑里呢？或者是用在中间件里呢？

```typescript
commander.create('schedule-1', {
  async action(ctx) {
    // 逻辑...
    const code1 = await ctx.app.run('schedule-2', '--test');
    const code2 = await ctx.app.run('schedule-3', '--test', '--next');
  },
});
```

思路一下子就打开了吧，不通过命令行就能执行其他指令，这种方式在一些复杂的场景下特别有用。官方插件`@aomex/cron`就是利用了这个特性才使得运行定时任务可以不依赖操作系统。
