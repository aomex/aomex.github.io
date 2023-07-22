# 验证器

有传递客户端参数的地方，就需要在执行业务逻辑之前验证数据是否符合业务的要求。对于不符合要求的参数，我们希望立即抛出异常。而通过验证时，得到的所有参数都是可信赖的。

> 验证器是生成swagger文档的一部分

首先我们看看验证器如何使用：

```typescript
import { rule, validate } from '@aomex/core';

const untrusted = { name: ' hello  ', danger: 'rm -rf *' };
const trusted = await validate(untrusted, {
  name: rule.string().trim(),
});

console.log(trusted); // { name: 'hello' }
```

通常，你不需要使用直接`validate`函数，它会被集成到各个中间件中以满足不同的场景需求。同时`rule`集成了所有的验证器，我敢保证它你每天都需要和它打交道。

## string

**描述：** 字符串类型<br>
**用法：** `rule.string()`<br>
|扩展|说明|
|--|--|
|`.trim()`|删除字符串两边空格后再进行验证|
|`.length(exact: number)`<br>`.length(min, max)`<br>`.length({min?,max?,exact?})`|设置字符串长度|
|`.allowEmpty()`|把空字符串`''`设置为合法的值|
|`.match(reg:RegExp)`|字符串需匹配正则表达式|
|`.default(value:string)`|如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`|
|`.optional()`|允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**|
|`.nullable()`|把`null`识别成合法的值|
|`.docs({ ... })`|扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace`|
|`.transform(fn)`|数据验证成功后触发，允许我们对数据进行最后的转换操作|

## number

**描述：** 数字类型，包括整型和浮点数<br>
**用法：** `rule.number()`<br>
**宽松模式**: 默认开启。尝试将字符串转换为数字
|扩展|说明|
|--|--|
|`.min(min,inclusive=true)`|设置最小值。如果第二个参数`inclusive`设置为true，则对比时使用`>=`判断，否则使用`>`判断|
|`.max(max,inclusive=true)`|设置最小值。如果第二个参数`inclusive`设置为true，则对比时使用`<=`判断，否则使用`<`判断|
|`.precision(decimals:number)`|设置数字精度|
|`.default(value: number)`|如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`|
|`.optional()`|允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**|
|`.nullable()`|把`null`识别成合法的值|
|`.docs({ ... })`|扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace`|
|`.strict(is=true)`|是否开启严格模式。开启后数据必须是数字类型|
|`.transform(fn)`|数据验证成功后触发，允许我们对数据进行最后的转换操作|

## int

**描述：** 整数类型<br>
**用法：** `rule.int()`<br>
**宽松模式**: 默认开启。尝试将字符串转换为数字
|扩展|说明|
|--|--|
|`.min(min,inclusive=true)`|设置最小值。如果第二个参数`inclusive`设置为true，则对比时使用`>=`判断，否则使用`>`判断|
|`.max(max,inclusive=true)`|设置最小值。如果第二个参数`inclusive`设置为true，则对比时使用`<=`判断，否则使用`<`判断|
|`.default(value: number)`|如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`|
|`.optional()`|允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**|
|`.nullable()`|把`null`识别成合法的值|
|`.docs({ ... })`|扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace`|
|`.strict(is=true)`|是否开启严格模式。开启后数据必须是数字类型|
|`.transform(fn)`|数据验证成功后触发，允许我们对数据进行最后的转换操作|

## bigint

**描述：** 大整型类型<br>
**用法：** `rule.bigint()`<br>
**宽松模式**: 默认开启。尝试将字符串和数字转换为大整型

| 扩展                     | 说明                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `.default(value:bigint)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`                                   |
| `.optional()`            | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**                                                        |
| `.nullable()`            | 把`null`识别成合法的值                                                                                                       |
| `.docs({ ... })`         | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.strict(is=true)`       | 是否开启严格模式。开启后数据必须是大整型                                                                                     |
| `.transform(fn)`         | 数据验证成功后触发，允许我们对数据进行最后的转换操作                                                                         |

## boolean

**描述：** 布尔值类型<br>
**用法：** `rule.boolean()`<br>
**真值:** `1, '1', true, 'true'`<br>
**假值:** `0, '0', false, 'false'`<br>
| 扩展 | 说明 |
| ----------------- | ------------ |
| `.trueValues([...])` | 设置新的真值 |
| `.falseValues([...])` | 设置新的假值 |
| `.default(value:boolean)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |

## object

**描述：** 对象类型，每个属性都是验证器<br>
**用法：**

```typescript
// 只验证是个纯对象类型，并保留所有属性
rule.object();

// 验证是个纯对象类型，并且只保留id和name这两个属性
rule.object({ id: rule.int(), name: rule.string() });
```

| 扩展                        | 说明                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.parseFromString(is=true)` | 如果数据是字符串，则尝试使用`JSON.parse`转换为对象                                                                           |
| `.default(value:object)`    | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`                                   |
| `.optional()`               | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**                                                        |
| `.nullable()`               | 把`null`识别成合法的值                                                                                                       |
| `.docs({ ... })`            | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.strict(is=true)`          | 是否开启严格模式。**所有的子验证器都会同步为该状态**                                                                         |
| `.transform(fn)`            | 数据验证成功后触发，允许我们对数据进行最后的转换操作                                                                         |

## array

**描述：** 数组类型，包含一个元素验证器<br>
**用法：**

```typescript
// 只验证是个数组类型
rule.array();

// 数字内每个元素都必须是字符串
rule.array(rule.string());

// 数组的元素可以是空的，也可以是字符串类型
rule.array(rule.string().optional());

// 数组哪每个元素都必须是对象，对象必须包含id和name属性
rule.array({
  id: rule.int(),
  name: rule.string(),
});
```

| 扩展                    | 说明                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.forceToArray({...})`  | 如果数据不是数组类型，则强制转换为数组形式。[查看参数](validator.html#forcetoarray)                                          |
| `.default(value:Array)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`                                   |
| `.optional()`           | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**                                                        |
| `.nullable()`           | 把`null`识别成合法的值                                                                                                       |
| `.docs({ ... })`        | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.strict(is=true)`      | 是否开启严格模式。**元素验证器也会同步为该状态**                                                                             |
| `.transform(fn)`        | 数据验证成功后触发，允许我们对数据进行最后的转换操作                                                                         |

#### forceToArray

| 属性                 | 类型                   | 说明                                                                                   |
| -------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| filter               | `(value:any)=>boolean` | 过滤允许转换为数组的数据，不设置则代表全部允许                                         |
| transform            | `(value:any)=>any[]`   | 转换的方式。默认方式：<br>`(value) => {return [value]}`                                |
| stringSeparator      | `string\|RegExp`       | 如果碰上字符串，则使用分割符转换为数组。优先级高于`transform`属性                      |
| stringCommaSeparator | `boolean`              | 如果碰上字符串，则使用`/\s*,\s*/`这个正则表达式来分割。优先级高于`stringSeparator`属性 |

## buffer

**描述：** 缓冲区类型<br>
**用法：** `rule.buffer()`<br>
|扩展|说明|
|--|--|
| `.default(value:Buffer)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |

## enum

**描述：** 枚举类型<br>
**用法：** `rule.enum(['a', 'b', 'c'])`<br>
|扩展|说明|
|--|--|
| `.default(value:T)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |

## ip

**描述：** IP字符串类型，支持v4和v6版本<br>
**用法：**

```typescript
// ipv4
rule.ip('v4');
rule.ip(['v4']);

// ipv6
rule.ip('v6');
rule.ip(['v6']);

// ipv4 + ipv6
rule.ip(['v4', 'v6']);
```

| 扩展                     | 说明                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `.trim()`                | 删除字符串两边空格后再进行验证                                                                                               |
| `.match(reg:RegExp)`     | 字符串需匹配正则表达式                                                                                                       |
| `.default(value:string)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`                                   |
| `.optional()`            | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**                                                        |
| `.nullable()`            | 把`null`识别成合法的值                                                                                                       |
| `.docs({ ... })`         | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)`         | 数据验证成功后触发，允许我们对数据进行最后的转换操作                                                                         |

## email

**描述：** 电子邮件类型<br>
**用法：** `rule.email()`<br>
|扩展|说明|
|--|--|
| `.trim()` | 删除字符串两边空格后再进行验证 |
| `.match(reg:RegExp)` | 字符串需匹配正则表达式 |
| `.default(value:string)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |

## hash

**描述：** 哈希串类型<br>
**用法：** `rule.hash(algorithm: Hash)`<br>
**哈希算法：** "md5" | "md4" | "sha1" | "sha256" | "sha384" | "sha512" | "ripemd128" | "ripemd160" | "tiger128" | "tiger160" | "tiger192" | "crc32" | "crc32b"
|扩展|说明|
|--|--|
| `.trim()` | 删除字符串两边空格后再进行验证 |
| `.match(reg:RegExp)` | 字符串需匹配正则表达式 |
| `.default(value:Hash)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |

## uuid

**描述：** 通用唯一识别码，共有6个版本<br>
**用法：**

```typescript
// 单个版本
rule.uuid('v1');
rule.uuid('v2');
rule.uuid('v3');
rule.uuid('v4');
rule.uuid('v5');

// 多版本一起支持
rule.uuid(['v4', 'v5', 'v6']);

// 全部支持
rule.uuid(['v1', 'v2', 'v3', 'v4', 'v5']);
```

| 扩展                     | 说明                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `.trim()`                | 删除字符串两边空格后再进行验证                                                                                               |
| `.match(reg:RegExp)`     | 字符串需匹配正则表达式                                                                                                       |
| `.default(value:string)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`                                   |
| `.optional()`            | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**                                                        |
| `.nullable()`            | 把`null`识别成合法的值                                                                                                       |
| `.docs({ ... })`         | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)`         | 数据验证成功后触发，允许我们对数据进行最后的转换操作                                                                         |

## ulid

**描述：** 可排序的全局唯一标识符，号称UUID的替代品<br>
**用法：** `rule.ulid()`<br>
|扩展|说明|
|--|--|
| `.trim()` | 删除字符串两边空格后再进行验证 |
| `.match(reg:RegExp)` | 字符串需匹配正则表达式 |
| `.default(value:string)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |

## one-of

**描述：** 从左往右匹配其中一种规则<br>
**用法：**

```typescript
// 字符串或者数字
rule.oneOf([rule.string(), rule.number()]);

// 哈希 | uuid | ulid
rule.oneOf([rule.hash(), rule.uuid(), rule.ulid()]);
```

| 扩展                     | 说明                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `.default(value:string)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()`                                   |
| `.optional()`            | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined**                                                        |
| `.nullable()`            | 把`null`识别成合法的值                                                                                                       |
| `.docs({ ... })`         | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.strict(is=true)`       | 是否开启严格模式。**子验证器也会同步为该状态**                                                                               |
| `.transform(fn)`         | 数据验证成功后触发，允许我们对数据进行最后的转换操作                                                                         |

## date-time

**描述：** 时间类型<br>
**用法：** `rule.dateTime()`<br>
|扩展|说明|
|--|--|
|`.min(date,inclusive=true)`|最小时间。如果第二个参数`inclusive`设置为true，则对比时使用`>=`判断，否则使用`>`判断|
|`.max(date,inclusive=true)`|最大时间。如果第二个参数`inclusive`设置为true，则对比时使用`<=`判断，否则使用`<`判断|
| `.default(value:Date)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |

## any

**描述：** 任意类型<br>
**用法：** `rule.any()`<br>
**类型限制：** number | string | boolean | any[] | object | bigint | Buffer
|扩展|说明|
|--|--|
| `.default(value:T)` | 如果值为空或者没传入，则使用该默认值，而且无需验证。<br>执行该方法后无需再执行`optional()` |
| `.optional()` | 允许数据是 `undefined, null, ''`或者**不传**，统一转换成**undefined** |
| `.nullable()` | 把`null`识别成合法的值 |
| `.docs({ ... })` | 扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递第二个参数为`replace` |
| `.transform(fn)` | 数据验证成功后触发，允许我们对数据进行最后的转换操作 |
