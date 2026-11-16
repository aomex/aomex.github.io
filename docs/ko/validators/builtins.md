---
outline: deep
---

# 검증기 목록

사용할 규칙.xx() 알려진 경우, 이 페이지**는 작업에 따른다. **; 식물은 독점 방법(trim, Min, mimeTypes...)을 볼 때 선택된다. 거의 모든 식물은 [일반적인 사슬] (./chain) (선택, 과태, 변형...)를 걸었다.

```typescript
import { rule, schema } from '@aomex/common';

export const task = schema({
  email: rule.email(),
  page: rule.int().min(1).default(1),
  avatar: rule.file(), // Web 上传见 @aomex/web
});
```

세 가지 필드는 일상 생활의 대부분을 커버:** ID**,** 전체 페이지 휴식**,** 문서** — 나머지는 아래 차트의 기초에 자리 잡을 것입니다.

- 각 rule.xx() 플랜트는 다른 체인 유형의 세분화; 편집 완료에 따라 pap 방법 및 범용 체인의 가용성.
- rule.file()은 `@aomex/web' 프로젝트에서만 등록됩니다. 이것은 일반적으로 콘솔 넷 노드 입구에서 사용할 수 없습니다.
- 범주의 조합에 대한 Infer (하나, 배열 ...)는 임베디드 또는 결합 유형이며, [object] (./rules/object) / [array] (./rules/array) / [oneof] (./rules/one-of)를 참조하십시오.
- 준비된 식물이 없을 때, [Customized certifier] (/ko/advanced/validator)를 이동하여 API를 통해 rule.any()를 사용하지 마십시오.

페이지는 일반적으로 사용되는 기본 (1), PATCH 일반적으로 사용되는 옵션 / [partial] (./schema) - 체인 옵션은 [general chain] (./chain)에서 사용할 수 있습니다.

# 사명으로 공장 찾기

당신은 ... 먼저 이동 ...
| 사용자 이름, 댓글, 검색어 [`rule.stream()` ] (./rules/string) |
| 페이지 브레이크, 번호, 자동 증가 ID | [`rule.int()`(./rules/int)|
| 금액, 비율(진수) | [`rule.decimal()`(./rules/decimal)] 또는 [`rule.number()`(./rules/number) |
스위치, 계약에 동의 [`rule.bolean()`(./rules/bolean)|
등록 우편함, 로그인 계정 [`rule.email()`] (./rules/email) |
| 반품 URL, 점프 링크 | [`rule.url()`(./rules/url)|
id (UUID / ULID) | [`rule.uuid()`] (./rules/uuid) [`rule.ulid()`] (./rules/ulid) |
입장 시간, 약속 기간 [`rule.date()' ] (./rules/date) |
| 고정수 (로레, 주) | [`rule.enum()`(./rules/enum)`[`rule.literal()`(./rules/literal) |
| JSON body 배열 객체 | [`rule.object() '](./rules/object) 또는 필드의 단어 볼륨
| 라벨 목록, 일괄 ID | [`rule.array()`(./rules/array)|
| 동적인 키 구성 가방 | [`rule.record()`] (./rules/record) |
| 결제 모드 / 웹훅 멀티폼 | [`rule.oneof()`] (./rules/one-of) · [`rule.anyof()`(./rules/any-of) |
이미지, 첨부 파일 multipart | [`rule.file()`(./rules/file) + [document upload] (/ko/web/attach) |
| 대형 정수, 해시, IP | [`rule.bigint()`(./rules/bigint) [`rule.hash()`(./rules/hash)`[`rule.ip()`(./rules/ip)|
| 버퍼 / 플로우 필드 | [`rule.buffer()`(./rules/buffer) | [`rule.stream()`] (./rules/stream) |
| (국번없이)|【`rule.any()`(./rules/any)|

인덱스: Factories Group (사용 가능)

** 텍스트와 숫자:** [string] (./rules/string] [number] (./rules/number) [int] (./rules/int) [bigint] (./rules/bigint) [decimal] (./rules/disarmament) [bolean] (./rules/bolean)

** 시간 및 표시:** [날짜] (./rules/date) [email] (./rules/email) [url] (./rules/url) [uuid] (./rules/uid) [lid] (./rules/ulid) [ip] (.rules/ip) [hash] (./rules/hash)

** 양자 및 말 그대로:** [enum] (./rules/enum) [literal] (./rules/literal)

** 구조:** [부설] (./rules/object) [부설] (./rules/record) [array] (./rules/array) [부설] (./rules/buffer) [스트림] (./rules/stream)

** 그룹:** [하나의] (./rules/one-of)] [anyof] (./rules/any-of) [allof] (./rules/all-of) [any] (./rules/any)

**Web：** [file](./rules/file)

mailbox는 문자열(.match)가 임의화되지 않아야 한다 - [email](./rules/email)는 경제적이고 OpenAPI가 더 적합하다. 외부 자원 ID [uuid] (./rules/uuid)는 nudist가 아닙니다. 수량, 균형 정확도 민감한 [decimal] (./rules/decimal), 아니 [nomber] (./rules/nomber) nudity.

::: warning
1개의 공용영역은 가능한 빨리 특정한 모양과 더불어 ad hoc 연결을 위해 적당한 rule.any ()의 가득 차 있습니다.
:::

이름 *

- [일반 체인](./chain)
- [schema](./schema)
- [Quick Start] (/ko/validaters/) (첫 번째 테스터에 있다면)