---
outline: 2
---

# 验证器

有传递参数的地方，就需要在执行业务逻辑之前验证输入是否符合业务的要求。对于不符合要求的参数，我们希望立即抛出异常。而通过验证时，则意味着得到的所有参数都是可信赖的。

## 验证

框架提供最基础的`validate`函数，我们可以在任何地方使用它。

```typescript
import { rule, validate } from '@aomex/core';

// 不安全数据
const untrusted = { name: ' hello  ', title: 'rm -rf /' };

// 安全数据
const trusted = await validate(untrusted, {
  name: rule.string().trim(),
});

console.log(trusted); // { name: 'hello' }
```

## 通用的方法

大部分验证器都有相同的方法，为了节省文笔，在此统一指出。

### .optional()

指定字段是选填的，允许数据是 `undefined, null, ''`或者不传，统一转换成**undefined**

### .default(value)

如果指定字段为空值，则为该字段提供默认的输入值。调用该方法意味着字段是选填的，即无需再执行`.optional()`

### .nullable()

把`null`识别成`非空`值

### .strict(is=true)

是否开启严格模式。输入渠道可能不支持多种数据类型，开启后可能无法转换类型，因此一般建议不开启

### .transform(callback)

指定字段验证成功后触发，允许我们对数据进行最后的转换操作

### .docs(opts, mode)

扩展openapi的配置，允许多次调用，默认采用合并对象的形式收集配置。<br>如果需要覆盖原来的docs配置，则传递 mode 为`replace`

## rule.string()

字符串类型

### .trim(is=true)

删除字符串两边空格后再进行验证，属于前置操作

```typescript
// 'ab c'
await validate(' ab c   ', rule.string().trim());
```

### .length(...)

设置字符串长度，该方法使用了函数重载：

- `.length(exact: number)` 指定具体的长度
- `.length({ min?: number, max?: number })` 对象，指定最小长度或者最大长度，都指定则为长度区间

```typescript
// 字符串长度必须是20
rule.string().length(20);
// 长度最长为20
rule.string().length({ max: 20 });
// 长度最短为3
rule.string().length({ min: 3 });
// 长度必须在3-20之间（包含）
rule.string().length({ min: 3, max: 20 });
```

### .allowEmptyString()

把空字符串`''`设置为`非空`值

```typescript
const allowEmpty = rule.string().allowEmptyString();
const denyEmpty = rule.string();

await validate('', allowEmpty); // ''
await validate('abc', allowEmpty); // 'abc'

await validate(undefined, allowEmpty); // 抛出异常
await validate(null, allowEmpty); // 抛出异常
await validate('', denyEmpty); // 抛出异常
```

### .match(reg)

字符串需匹配正则表达式

```typescript
const match = rule.string().match(/^\d+$/);

await validate('1234', match); // '1234'
await validate('a1234', match); // 抛出异常
```

## rule.number()

数字类型，包括整型和浮点数

### .min(min,inclusive=true)

设置最小值。如果第二个参数`inclusive`设置为true，则对比时使用`>=`判断，否则使用`>`判断

### .max(max,inclusive=true)

设置最大值。如果第二个参数`inclusive`设置为true，则对比时使用`<=`判断，否则使用`<`判断

### .precision(maxDecimals:number)

设置小数最大长度

## rule.int()

整数类型

### .min(min,inclusive=true)

设置最小值。如果第二个参数`inclusive`设置为true，则对比时使用`>=`判断，否则使用`>`判断

### .max(max,inclusive=true)

设置最大值。如果第二个参数`inclusive`设置为true，则对比时使用`<=`判断，否则使用`<`判断

## rule.boolean()

布尔值类型。预设了一些真假值，也可以自定义

**真值:** `1, '1', true, 'true'`<br>
**假值:** `0, '0', false, 'false'`<br>

### .setTruthyValues([...])

重新设置真值

```typescript
rule.boolean().setTruthyValues([true, 'yes']);
rule.boolean().setTruthyValues(['on', 'good']);
```

### .setFalsyValues([...])

重新设置假值

```typescript
boolean.setFalsyValues([false, 'no']);
rule.boolean().setFalsyValues(['off', 'bad']);
```

## rule.object(properties?)

对象类型，每个属性都是验证器

如果没有传递对象属性，则会返回所有的属性，这是不安全的。因此建议指定属性。

```typescript
const obj = { id: 1, name: 'foo', title: 'rm -rf /' };

// 返回 { id: 1, name: 'foo', title: 'rm -rf /' }
await validate(obj, rule.object());
// 返回 { id: 1, name: 'foo' }
await validate(obj, rule.object({ id: rule.int(), name: rule.string() }));
```

### .parseFromString(is=true)

如果输入值是字符串，则尝试使用`JSON.parse`转换为对象

```typescript
const fromString = rule.object().parseFromString();
const normal = rule.object();
const str = JSON.stringify({ id: 1 });

await validate(str, normal); // 抛出异常
await validate(str, fromString); // { id: 1 }
```

## rule.array(item?)

数组类型，包含一个元素验证器。

```typescript
rule.array(rule.string());
```

如果只是验证数组类型而不关心元素，则无需传递参数

```typescript
rule.array();
```

### .forceToArray(mode, separator?)

强制将`非数组`的值转换成数组类型。指令和查询字符串场景下，如果只传了一个元素，则有可能被识别为非数组，而传递多个元素时又变成了数组结构。

不同的转换模式下会有不同的输出结果：

- `separator` 使用分割符号，把字符串拆分成数组。此时可传递分隔符，默认：`/\s*,\s*/`
- `block` 把输入当成一个整体，作为数组的一个元素

```typescript
const strArray = rule.array(rule.string());

// ['a', 'b', 'c']
await validate('a,b,c', strArray.forceToArray('separator'));
// ['a,b,c']
await validate('a,b,c', strArray.forceToArray('separator', '-'));
// ['a', 'b,c']
await validate('a-b,c', strArray.forceToArray('separator', '-'));
// ['a,b,c']
await validate('a,b,c', strArray.forceToArray('block'));
// [123]
await validate(123, rule.array(rule.number()).forceToArray('block'));
```

## rule.dateTime(format?)

时间类型，可以设置解析字符串的格式

```typescript
rule.dateTime();
rule.dateTime('yyyy-MM-dd');
rule.dateTime('yyyy-MM-dd', 'MM-dd', 'yyyy-MM'),
```

### .min(date,inclusive=true)

最小时间。如果第二个参数`inclusive`设置为true，则对比时使用`>=`判断，否则使用`>`判断

### .max(date,inclusive=true)

最大时间。如果第二个参数`inclusive`设置为true，则对比时使用`<=`判断，否则使用`<`判断

### .parseFromTimestamp(is=true)

尝试把时间戳数字解析成时间对象。支持如下格式：

- 13位：1711257956199
- 14位：1711257956.199
- 10位：1711257956

## rule.enum([...])

枚举类型，必须是数字或者字符串。宽松模式下，如果没有匹配到枚举值，数字字符串会尝试转换为数字类型后再做对比

```typescript
const enums = rule.enum([1, 2, 'a']);

await validate(1, enums); // 1
await validate('2', enums); // 2
await validate('a', enums); // 'a'
await validate(3, enums); // 抛出异常
```

::: info

:::

## rule.ip(...)

IP字符串类型，支持v4和v6版本

```typescript
rule.ip('v4');
rule.ip(['v4']);
rule.ip('v6');
rule.ip(['v6']);
rule.ip(['v4', 'v6']);
```

### .match(reg)

IP需匹配正则表达式

```typescript
const match = rule.ip('v4').match(/^192\.168\.0\.\d+$/);

await validate('192.168.0.22', match); // '192.168.0.22'
await validate('35.62.20.9', match); // 抛出异常
```

## rule.email()

电子邮箱类型

```typescript
const email = rule.email();

await validate('abc@qq.com', email); // abc@qq.com
await validate('abc@qq.com.cn', email); // abc@qq.com.cn
await validate('abc@', email); // 抛出异常
```

### .match(reg)

邮箱需匹配正则表达式

```typescript
const match = rule.email().match(/@qq\.com$/);

await validate('abc@qq.com', match); // abc@qq.com
await validate('abc@qq.cn', match); // 抛出异常
```

## rule.hash(algorithm)

哈希串类型，仅仅是判断长度是否与给定算法一致，不验证真实性。

已支持的算法包括：

- md5
- md4
- sha1
- sha256
- sha384
- sha512
- ripemd128
- ripemd160
- tiger128
- tiger160
- tiger192
- crc32
- crc32b

```typescript
// aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
await validate('a'.repeat(32), rule.hash('md5'));
// 抛出异常
await validate('a'.repeat(31), rule.hash('md5'));
```

## rule.uuid()

通用唯一识别码，共有5个版本

```typescript
// 单个版本
rule.uuid('v1');
rule.uuid('v2');
rule.uuid('v3');
rule.uuid('v4');
rule.uuid('v5');
// 多版本一起支持
rule.uuid(['v4', 'v5']);
// 全部支持
rule.uuid(['v1', 'v2', 'v3', 'v4', 'v5']);
```

### .match(reg)

字符串需匹配正则表达式

## rule.ulid()

可排序的全局唯一标识符，号称UUID的替代品

### .match(reg)

字符串需匹配正则表达式

## rule.bigint()

大整型类型

### .min(min,inclusive=true)

设置最小值。如果第二个参数`inclusive`设置为true，则对比时使用`>=`判断，否则使用`>`判断

### .max(max,inclusive=true)

设置最大值。如果第二个参数`inclusive`设置为true，则对比时使用`<=`判断，否则使用`<`判断

## rule.buffer()

缓冲区类型

### .parseFrom(...encodings)

尝试从其他类型恢复为buffer类型：

- `hex` 从十六进制字符串恢复
- `base64` 从base64字符串恢复

## rule.stream()

数据流类型

## rule.oneOf([...])

必须且只能匹配其中一个规则，如果匹配上多个则失败

```typescript
const oneOf = rule.oneOf([rule.string(), rule.url()]);

await validate('abc', oneOf); // 'abc'
await validate('http://example.com', oneOf); // 匹配多个，抛出异常
await validate(123, oneOf); // 没有匹配上，抛出异常
```

## rule.anyOf()

规则以管道形式执行，需要至少匹配一个规则

```typescript
const anyOf = rule.anyOf([rule.string(), rule.url()]);

await validate('abc', anyOf); // 'abc'
await validate('http://example.com', anyOf); // 'http://example.com'
await validate(123, anyOf); // 没有匹配上，抛出异常
```

## rule.allOf()

规则以管道形式执行，需要至少匹配一个规则

```typescript
const allOf = rule.allOf([rule.string(), rule.url()]);

await validate('abc', allOf); // 未匹配url，抛出异常
await validate('http://example.com', allOf); // 'http://example.com'
await validate(123, allOf); // 没有匹配上，抛出异常
```

## rule.any()

任意类型，不做任何运行时检测，请谨慎使用
