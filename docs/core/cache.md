# 缓存

临时存储不经常变化的数据

## 安装

```bash
pnpm add @aomex/cache
```

## 使用

内置一个内存适配器，适合在开发和测试阶段使用

```typescript
import { Caching, memoryAdapter } from '@aomex/cache';

export const memoryCache = new Caching(memoryAdapter());
```

## redis适配器

- [@aomex/cache-redis-adapter](https://www.npmjs.com/package/@aomex/cache-redis-adapter)

```typescript
import { Caching } from '@aomex/cache';
import { redisAdapter } from '@aomex/cache-redis-adapter';

export const redisCache = new Caching(
  redisAdapter({
    host: '',
    password: '',
    port: 6379,
  }),
);
```

## 方法

```typescript
export type Types = string | number | object | boolean;
```

### get()

签名：<br>`<T>(key: string, defaultValue: T): Promise<T>`
<br>`<T extends Types>(key: string): Promise<T | null>`

获取缓存。如果未找到缓存并且未提供默认值，则返回`null`

### set()

签名：`(key: string, value: Types, durationMS?: number) => Promise<boolean>`

设置缓存。可以指定过期时间（毫秒）

### setNX()

签名：`(key: string, value: Types, durationMs?: number): Promise<boolean>`

设置缓存。如果缓存已经存在，则设置失败，返回`false`

```typescript
await cache.setNX('foo', 'bar'); // true
await cache.setNX('foo', 'baz'); // false
```

### leftPush()

签名：`(key: string, ...values: Types[]): Promise<boolean>`

将一个或多个值按顺序插入到列表头部。当 key 存在但不是列表类型时，返回一个错误

```typescript
await cache.leftPush('foo', 'a'); // ['a']
await cache.leftPush('foo', 'b', 'c'); // ['b', 'c', 'a']
```

### rightPop()

签名：`<T extends Types>(key: string): Promise<T | null>`

移除列表的最后一个元素，返回值为被移除的元素

### increment()

签名：`(key: string): Promise<number>`

将key中储存的数字值增一。如果key不存在，那么key的值会先被初始化为0，然后再执行操作。如果值包含错误的类型，或字符串类型的值不能表示为数字，那么返回一个错误

```typescript
await cache.increment('foo'); // 1
await cache.increment('foo'); // 2
await cache.increment('foo'); // 3
```

### decrement()

签名：`(key: string): Promise<number>`

将key中储存的数字值减一。如果key不存在，那么key的值会先被初始化为0，然后再执行操作。如果值包含错误的类型，或字符串类型的值不能表示为数字，那么返回一个错误。

### expire()

签名：`(key: string, durationMs: number): Promise<boolean>`

重新设置缓存时间。如果key不存在，则返回`false`

### exists()

签名：`(key: string): Promise<boolean>`

查看缓存是否存在

### ttl()

签名：`(key: string): Promise<number>`

检测缓存的剩余生存时间(Time to live)

- 不存在则返回`-2`
- 未设置过期时间则返回`-1`
- 已设置过期时间则返回剩余时间，单位**毫秒**

```typescript
await cache.ttl('foo'); // -2
await cache.set('foo', 'bar');
await cache.ttl('foo'); // -1
await cache.expire('foo', 60000);
await cache.ttl('foo'); // 59000
```

### delete()

签名：`(key: string): Promise<boolean>`

删除指定缓存

### deleteAll()

签名：`(): Promise<boolean>`

删除所有缓存

## 装饰器

想象一下，你是否经常写这种代码，先判断缓存是否存在，不存在则获取，然后保存缓存。

```
class MyClass {
  async getMyData(id: number) {
    const key = `my_key_${id}`;
    let data = await cache.get(key);
    if (!data) {
      data = await ... // 业务逻辑在这里
      await cache.set(key, data, 3600_000);
    }
    return data;
  }
}
```

这种写法有以下几个方面的缺点：

1. 过于模板化，浪费时间
2. 模板化不利于阅读
3. 拼接key有点繁琐
4. 并发时，缓存未命中的情况下，逻辑被执行多次

---

此时，装饰器方案可以很好地解决这些问题

```typescript
class MyClass {
  @cache.decorate({ duration: 3600_000 })
  async getMyData(id: number) {
    const data = await ... // 业务逻辑在这里
    return data;
  }
}
```

是了，带来一种清**爽**的感觉！缓存逻辑与业务分离，书写方便，利于阅读，还能自动管理key，重点是并发时只处理一次逻辑。

如果你想手动管理key，那也是没问题的

```typescript
class MyClass {
  @cache.decorate({
    // 这里id的类型会自动推导为number类型
    key: (id) => `my_key_${id}`,
    duration: 3600_000,
  })
  async getMyData(id: number) {
    const data = await ... // 业务逻辑在这里
    return data;
  }
}
```

如果key不需要参数，也可以大胆地使用常量（这意味着总是只有一个缓存）

```typescript
class MyClass {
  @cache.decorate({ key: 'my_key', duration: 3600_000 })
  async getMyData(id: number) {
    const data = await ... // 业务逻辑在这里
    return data;
  }
}
```
