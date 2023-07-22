# 缓存

数据共享离不开缓存，可能是临时缓存，也可能是持久化缓存。框架提供了统一的缓存操作风格，并提供了常用的缓存引擎

- MemoryCache (内置)
- RedisCache ([@aomex/redis-cache](), [@aomex/ioredis-cache]())

> 缓存的数据类型包括：`T = string | number | object | boolean`

## get

**类型：** `<T>(key: string, defaultValue?: T): Promise<T | null>`<br>
**说明：** 获取缓存。如果未找到缓存并且未提供默认值，则返回`null`

```typescript
import { MemoryCache } from '@aomex/core';

const cache = new MemoryCache({
  keyPrefix: 'cache_', // 可选参数
});

await cache.get('key'); // null
await cache.get('key', 'default data'); // 'default data'
```

## set

**类型：** `(key: string, value: T, durationMs?: number): Promise<boolean>`<br>
**说明：** 设置缓存。可以指定过期时间（毫秒）

```typescript
import { sleep } from '@aomex/core';

// 设置内容
await cache.get<string>('key'); // null
await cache.set('key', 'data1'); // true
await cache.get<string>('key'); // 'data1'

// 指定2秒后过期
await cache.set('key', 'data1', 2000); // true
await cache.get<string>('key'); // 'data1'
await sleep(2000);
await cache.get<string>('key'); // null
```

## add

**类型：** `(key: string, value: T, durationMs?: number): Promise<boolean>`<br>
**说明：** 设置缓存。如果缓存已经存在，则设置失败，返回`false`

```typescript
import { sleep } from '@aomex/core';

// 设置内容
await cache.get<string>('key'); // null
await cache.add('key', 'data1'); // true
await cache.add('key', 'data2'); // false
await cache.get<string>('key'); // 'data1'

// 指定2秒后过期
await cache.add('key1', 'data1', 2000); // true
await cache.add('key1', 'data2'); // false
await sleep(2000);
await cache.add('key1', 'data2'); // true
```

## exists

**类型：** `(key: string): Promise<boolean>`<br>
**说明：** 查看缓存是否存在

```typescript
await cache.exists('key'); // false
await cache.set('key', 'value');
await cache.exists('key'); // true
```

## getOrSet

**类型：** `<T>(key: string, orSet: () => T | Promise<T>, durationMs?: number): Promise<T>`<br>
**说明：** 获取缓存。如果没有值，则设置该缓存

```typescript
await cache.get('key'); // null
await cache.getOrSet('key', () => 'value'); // 'value'
await cache.get('key'); // 'value'
```

## getAndDelete

**类型：** `<T>(key: string, defaultValue?: T): Promise<T>`<br>
**说明：** 获取缓存后立即将该值从引擎中删除。如果未找到缓存并且未提供默认值，则返回`null`

```typescript
await cache.set('key', 'value');
await cache.getAndDelete<string>('key'); // 'value'
await cache.get('key'); // null
```

## delete

**类型：** `(key: string): Promise<boolean>`<br>
**说明：** 删除指定缓存

```typescript
await cache.set('key', 'value');
await cache.delete('key');
await cache.set<string>('key'); // null
```

## deleteAll

**类型：** `(): Promise<boolean>`<br>
**说明：** 删除所有缓存

```typescript
await cache.set('key1', 'value');
await cache.set('key2', 'value');
await cache.deleteAll();
await cache.set<string>('key1'); // null
await cache.set<string>('key2'); // null
```
