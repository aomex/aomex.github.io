---
outline: deep
---

# Список валидаторов

Не знаете, какой `rule.xxx()` взять? Начните **по задаче**, затем откройте отдельную страницу для специфичных методов фабрики (`trim`, `min`, `mimeTypes`, …). Почти каждая фабрика поддерживает [Общие цепочки](./chain) (`optional`, `default`, `transform`, …).

```typescript
import { rule, schema } from '@aomex/common';

export const task = schema({
  email: rule.email(),
  page: rule.int().min(1).default(1),
  avatar: rule.file(), // Web 上传见 @aomex/web
});
```

Три поля закрывают большую часть будней: **идентификатор**, **целое для пагинации**, **файл** — остальное смотрите в таблице задач ниже.

- Каждая фабрика `rule.xxx()` выводит свой тип цепочки; какие методы и цепочки доступны — смотрите подсказки редактора.
- `rule.file()` подключается в проектах `@aomex/web`; чистая Console-точка входа обычно без file rule.
- Комбинаторы (`oneOf`, `array`, …) выводят вложенные или union-типы — см. [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of).
- Нет подходящей фабрики? Используйте [кастомные валидаторы](/ru/advanced/validator); не маскируйте API через `rule.any()`.

Для пагинации часто ставят `default(1)`; для PATCH — `optional` / [partial](./schema); опции цепочки — в [Общие цепочки](./chain).

## Подобрать фабрику по задаче

| Вам нужно… | Начните здесь |
| --- | --- |
| Имя, заметки, поисковые строки | [`rule.string()`](./rules/string) |
| Пагинация, количество, автоинкремент id | [`rule.int()`](./rules/int) |
| Деньги, коэффициенты (десятичные) | [`rule.decimal()`](./rules/decimal) или [`rule.number()`](./rules/number) |
| Переключатели, флаги согласия | [`rule.boolean()`](./rules/boolean) |
| Email при регистрации, логин | [`rule.email()`](./rules/email) |
| Callback URL, редиректы | [`rule.url()`](./rules/url) |
| Id ресурса (UUID / ULID) | [`rule.uuid()`](./rules/uuid) · [`rule.ulid()`](./rules/ulid) |
| Время действия, бронирование | [`rule.date()`](./rules/date) |
| Фиксированные enum (роль, статус) | [`rule.enum()`](./rules/enum) · [`rule.literal()`](./rules/literal) |
| Вложенные JSON-объекты | [`rule.object()`](./rules/object) или таблицы полей |
| Списки тегов, пакеты id | [`rule.array()`](./rules/array) |
| Конфиг с динамическими ключами | [`rule.record()`](./rules/record) |
| Способы оплаты / формы webhook | [`rule.oneOf()`](./rules/one-of) · [`rule.anyOf()`](./rules/any-of) |
| Аватар, вложения multipart | [`rule.file()`](./rules/file) + [загрузка файлов](/ru/web/attach) |
| Большие целые, хеши, IP | [`rule.bigint()`](./rules/bigint) · [`rule.hash()`](./rules/hash) · [`rule.ip()`](./rules/ip) |
| Поля Buffer / stream | [`rule.buffer()`](./rules/buffer) · [`rule.stream()`](./rules/stream) |
| Без ограничений (переходный период) | [`rule.any()`](./rules/any) (не оставляйте на публичных API) |

### Index: factory groups (reference)

**Текст и числа:** [string](./rules/string) · [number](./rules/number) · [int](./rules/int) · [bigint](./rules/bigint) · [decimal](./rules/decimal) · [boolean](./rules/boolean)

**Время и идентификаторы:** [date](./rules/date) · [email](./rules/email) · [url](./rules/url) · [uuid](./rules/uuid) · [ulid](./rules/ulid) · [ip](./rules/ip) · [hash](./rules/hash)

**Enum и литералы:** [enum](./rules/enum) · [literal](./rules/literal)

**Структура:** [object](./rules/object) · [record](./rules/record) · [array](./rules/array) · [buffer](./rules/buffer) · [stream](./rules/stream)

**Комбинаторы:** [oneOf](./rules/one-of) · [anyOf](./rules/any-of) · [allOf](./rules/all-of) · [any](./rules/any)

**Web:** [file](./rules/file)

Не подделывайте email через `string().match` — [email](./rules/email) проще и лучше для OpenAPI. Публичные id ресурсов — [uuid](./rules/uuid), не голый `string()`. Деньги и балансы — [decimal](./rules/decimal), не сырой [number](./rules/number).

::: warning
Эндпоинт из `rule.any()` — только для временной интеграции; быстро замените на конкретные формы.
:::

## Дальше

- [Общие цепочки](./chain)
- [schema](./schema)
- [Обзор](/ru/validators/) (первичная настройка)