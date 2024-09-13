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

```

```
