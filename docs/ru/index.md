---
layout: home

hero:
  name: Aomex
  text: Типобезопасный фреймворк для Node.js
  tagline: Один стек middleware для Web и Console. Параметры маршрута, тела запросов и контекст попадают в обработчики — с типами, которые можно вывести, перейти по ним и дополнять в автодополнении.
  actions:
    - theme: brand
      text: Начать
      link: /ru/starting/installation
    - theme: alt
      text: GitHub
      link: https://github.com/aomex/aomex

features:
  - title: TypeScript на всём пути
    details: "Типы — не заплатка в конце: поля, которые вы добавляете на ctx через middleware, с момента монтирования текут в action."
  - title: Одно middleware — два рантайма
    details: HTTP Web и команды Console делят одну луковую модель и композицию. Бизнес-логику пишете один раз и монтируете там, где нужно.
  - title: Сначала проверка ввода
    details: Валидаторы покрывают строки до ULID, файлы до Decimal. В код попадают только данные, прошедшие проверку, и типы сужаются соответственно.
  - title: Ленивая загрузка сервисов
    details: combineServices использует dynamic import и Proxy — инициализация по требованию, методы всегда возвращают Promise, при остановке вызывается onDestroy.
  - title: Экосистема из коробки
    details: Auth, кэш, логирование, rate limit, сжатие, CORS, Cron, OpenAPI / Swagger / Redoc — ставите только то, что нужно.
  - title: Node ≥ 24
    details: "Близко к возможностям рантайма: встроенное сжатие, стабильнее файловые и сетевые API, меньше исторического багажа."
---