# auto_gdi_work_v5 파일별 수정지시서 v3

## 1. 목적

본 문서는 `auto_gdi_work_v5` 레포지토리를 v5 기준으로 정렬하기 위한 **파일별 수정지시서**이다.  
본 지시서는 아래 확정사항을 반영하여, 문서/정책/명령/템플릿/스키마 간 정합성을 맞추는 것을 목표로 한다.

---

## 2. 확정 의사결정

### 2.1 v5 표준 단계 정의 고정
v5 표준 단계는 아래 4개로 고정한다.

- `analyze`
- `build`
- `test`
- `fix`

`instruct`, `generate`, `verify`, `deploy`는 독립 단계로 사용하지 않는다.  
필요 시 내부 처리 명칭으로만 사용할 수 있으나, 외부 공개 단계/manifest 단계명/사용자 안내 단계명으로는 사용하지 않는다.

---

### 2.2 spec 운영 방식 변경
기존의 `final_spec.yaml` 단일 구조는 제거한다.  
대신 analyze 결과를 **사람 검토용 spec**과 **기계 해석용 spec**으로 분리한다.

#### analyze 수행 시 생성 파일
- `original/people_spec.md`
- `original/machine_spec.yml`
- `final/people_spec.md`

#### 사용자 검토 방식
사용자는 `final/people_spec.md`에 직접 검토 및 수정 내용을 작성한다.

#### build 직전 처리 방식
시스템은 아래 두 파일을 비교한다.

- `original/people_spec.md`
- `final/people_spec.md`

비교 결과 중 **변경되거나 추가된 내용만** 추출하여 아래 파일에 반영한다.

- 입력: `original/machine_spec.yml`
- 출력: `final/machine_spec.yml`

즉, 최종적으로 build에서 사용하는 파일은 아래 하나로 고정한다.

- `final/machine_spec.yml`

---

### 2.3 confirm.md 제거
`confirm.md`는 더 이상 사용하지 않는다.  
승인 여부는 별도 confirm 파일로 관리하지 않고, 사용자가 `final/people_spec.md`를 수정 완료한 시점을 기준으로 후속 처리한다.

즉:
- `confirm.md` 생성 금지
- `confirm.md` 읽기 금지
- 관련 경로/정책/문서/명령 설명 전부 제거

---

### 2.4 정책 자동 적용 severity 규칙 고정
severity는 아래 2단계만 사용한다.

- `high`: 자동 적용
- `low`: 제안만 수행

`medium`은 사용하지 않는다.  
관련 문서, 정책, 스키마, 안내 문구 전부 동일하게 맞춘다.

---

### 2.5 금지 API 규칙 고정
다음 규칙을 표준으로 고정한다.

- `APP_PGM.getOpenParam(PGM)` 사용 금지
- 대체 표준: `activePgm(param, isNew)`의 첫 번째 인자 사용

관련 정책, screen-type 템플릿, 예제 코드, 설명 문서 모두 동일 기준으로 수정한다.

---

## 3. 목표 구조

### 3.1 analyze 결과물 구조
예시 경로:

```text
user/review/tasks/{taskId}/original/people_spec.md
user/review/tasks/{taskId}/original/machine_spec.yml
user/review/tasks/{taskId}/final/people_spec.md
```

### 3.2 build 직전 생성 구조
예시 경로:

```text
user/review/tasks/{taskId}/final/machine_spec.yml
```

### 3.3 build 입력
`build`는 반드시 아래 파일만 읽는다.

```text
user/review/tasks/{taskId}/final/machine_spec.yml
```

---

## 4. 파일별 수정지시

## 4.1 `ARCHITECTURE.md`
### 수정 목적
v5 전체 구조를 본 문서의 확정 의사결정 기준으로 재정렬한다.

### 수정 지시
1. 단계 정의를 아래 4개만 남긴다.
   - `analyze`
   - `build`
   - `test`
   - `fix`

2. 기존 문서 내 아래 표현은 제거 또는 내부 처리 설명으로만 축소한다.
   - `instruct`
   - `generate`
   - `verify`
   - `deploy`

3. spec 구조 설명을 아래 방식으로 변경한다.
   - analyze 산출물:
     - `original/people_spec.md`
     - `original/machine_spec.yml`
     - `final/people_spec.md`
   - build 직전 산출물:
     - `final/machine_spec.yml`

4. 기존 `final_spec.yaml` 관련 설명을 전부 제거한다.

5. 사용자 검토 방식은 아래처럼 명시한다.
   - 사용자는 `final/people_spec.md`에 직접 검토/보완 내용을 작성한다.
   - 시스템은 `original/people_spec.md`와 `final/people_spec.md`를 비교한다.
   - 변경/추가 내용만 `original/machine_spec.yml`에 반영하여 `final/machine_spec.yml`을 생성한다.

6. `confirm.md` 관련 설명을 전부 제거한다.

7. severity 규칙을 아래로 통일한다.
   - `high`: 자동 적용
   - `low`: 제안만 수행

8. 금지 API 정책 예시 및 popup 설명을 아래로 통일한다.
   - `APP_PGM.getOpenParam(PGM)` 금지
   - `activePgm(param, isNew)` 표준 사용

### 완료 기준
- v5 단계 설명이 4단계만 남아 있을 것
- `final_spec.yaml`, `confirm.md` 설명이 사라질 것
- dual-spec + diff 반영 구조가 문서에 반영될 것

---

## 4.2 `schemas/manifest.schema.json`
### 수정 목적
manifest 또는 이에 준하는 계약 구조를 v5 기준으로 맞춘다.

### 수정 지시
1. `step` enum을 아래 4개로 정리한다.
   - `analyze`
   - `build`
   - `test`
   - `fix`

2. 아래 단계값은 제거한다.
   - `instruct`
   - `generate`
   - `verify`
   - `deploy`

3. spec 관련 필드가 있다면 아래 구조를 반영한다.
   - `original_people_spec_path`
   - `original_machine_spec_path`
   - `final_people_spec_path`
   - `final_machine_spec_path`

4. 기존 `final_spec.yaml` 참조 필드는 제거한다.

5. `confirm.md` 관련 필드는 제거한다.

6. severity enum은 아래 2개만 허용한다.
   - `high`
   - `low`

### 완료 기준
- 스키마와 아키텍처 문서의 단계명이 일치할 것
- spec 관련 경로명이 dual-spec + yml 기준으로 일치할 것
- severity 규칙이 일치할 것

---

## 4.3 `system/config/paths.yml`
### 수정 목적
경로 정의를 중앙관리 기준으로 정리한다.

### 수정 지시
1. review 영역에 아래 경로를 명시적으로 추가한다.
   - `user.review.tasks.{taskId}.original.people_spec`
   - `user.review.tasks.{taskId}.original.machine_spec`
   - `user.review.tasks.{taskId}.final.people_spec`
   - `user.review.tasks.{taskId}.final.machine_spec`

2. 기존 `final_spec.yaml` 경로 정의가 있으면 제거한다.

3. `confirm.md` 경로 정의가 있으면 제거한다.

4. build 입력 경로는 `final/machine_spec.yml` 하나로 고정한다.

### 완료 기준
- review 관련 spec 경로가 중앙관리 항목에 모두 존재할 것
- final_spec / confirm 관련 경로가 제거될 것

---

## 4.4 `.claude/settings.json`
### 수정 목적
하드코딩 경로 및 구버전 spec 참조를 정리한다.

### 수정 지시
1. settings 내 spec 입력/출력 관련 경로가 있다면 `paths.yml` 참조 기준으로 정리한다.
2. `final_spec.yaml` 참조가 있으면 제거한다.
3. `confirm.md` 참조가 있으면 제거한다.
4. 가능하면 절대경로 하드코딩을 줄이고 중앙 path alias 기준으로 설명을 맞춘다.

### 완료 기준
- settings와 paths.yml이 충돌하지 않을 것
- spec 관련 구버전 명칭이 제거될 것

---

## 4.5 `.claude/commands/analyze.md`
### 수정 목적
analyze의 산출물 정의를 dual-spec 구조로 바꾼다.

### 수정 지시
1. analyze 산출물 설명을 아래로 수정한다.
   - `original/people_spec.md`
   - `original/machine_spec.yml`
   - `final/people_spec.md`

2. `final/people_spec.md`는 `original/people_spec.md`의 복제본으로 생성된다고 명시한다.

3. analyze는 `final/machine_spec.yml`을 생성하지 않는다고 명시한다.
   - 이는 build 직전 diff 반영 단계에서 생성된다.

4. `final_spec.yaml` 생성 관련 내용을 제거한다.

5. `confirm.md` 생성 관련 내용을 제거한다.

6. 사람 검토가 필요한 항목은 `people_spec.md`에 들어가야 함을 명시한다.
   - 누락 기능
   - 애매한 업무 규칙
   - 버튼/이벤트/검증 보완 필요사항
   - 쿼리/테이블/파라미터 보정 필요사항

### 완료 기준
- analyze 결과물이 3개 파일 구조로 설명될 것
- machine spec은 `.yml` 기준으로만 설명될 것

---

## 4.6 `.claude/commands/build.md`
### 수정 목적
build 입력과 pre-build 처리 절차를 새 구조에 맞춘다.

### 수정 지시
1. build 입력을 아래 파일 하나로 고정한다.
   - `final/machine_spec.yml`

2. build 시작 전에 아래 절차를 수행한다고 명시한다.
   - `original/people_spec.md`와 `final/people_spec.md` diff 수행
   - 변경/추가 내용 추출
   - `original/machine_spec.yml`에 반영
   - `final/machine_spec.yml` 생성

3. 삭제는 자동 반영하지 않는다고 명시한다.
   - 명시적 삭제 표기 규칙이 있을 때만 반영 가능하도록 한다.

4. `confirm.md` 체크 로직을 제거한다.

5. `final_spec.yaml` 입력 설명을 제거한다.

6. self-check 대상도 `final/machine_spec.yml` 기준으로 설명한다.

### 완료 기준
- build 문서에 confirm 조건이 사라질 것
- build 입력이 `final/machine_spec.yml` 하나로 명확해질 것

---

## 4.7 `.claude/commands/test.md`
### 수정 목적
test 입력 기준을 새 구조에 맞춘다.

### 수정 지시
1. 테스트 시 참조 spec을 `final/machine_spec.yml` 기준으로 통일한다.
2. `final_spec.yaml` 표현이 있으면 제거한다.
3. 필요 시 사람이 읽는 기준 문서는 `final/people_spec.md`를 참고 문서로만 사용할 수 있다고 명시한다.
4. `confirm.md` 관련 언급이 있으면 제거한다.

### 완료 기준
- test 문서가 build 결과와 동일한 spec 기준을 사용할 것

---

## 4.8 `.claude/commands/fix.md`
### 수정 목적
fix 단계의 정책 반영 규칙과 spec 기준을 통일한다.

### 수정 지시
1. severity를 아래 2단계만 사용한다.
   - `high`: 자동 적용
   - `low`: 제안만 수행

2. `medium` 관련 설명 제거

3. fix가 spec을 참조할 경우 `final/machine_spec.yml` 기준으로 맞춘다.

4. `confirm.md` 언급 제거

5. `final_spec.yaml` 언급 제거

### 완료 기준
- severity 정책이 아키텍처 문서와 일치할 것

---

## 4.9 `policies/framework/forbidden_apis.yml`
### 수정 목적
금지 API 정책을 최종 결정사항으로 확정한다.

### 수정 지시
1. 아래 항목을 명시적으로 금지한다.
   - `APP_PGM.getOpenParam(PGM)`

2. 대체 표준을 아래로 고정한다.
   - `activePgm(param, isNew)`

3. 설명/예시/허용 패턴 모두 이 기준으로 정리한다.

### 완료 기준
- 금지 API와 대체 패턴이 명확히 선언될 것

---

## 4.10 `system/templates/screen-types/popup-grid.yml`
### 수정 목적
screen-type 템플릿과 금지 API 정책 충돌을 제거한다.

### 수정 지시
1. `APP_PGM.getOpenParam(PGM)` 사용 안내 제거
2. popup-grid 파라미터 수신 방식은 아래로 통일
   - `activePgm(param, isNew)`의 첫 번째 인자 사용

3. notes, examples, required_functions, parameter_binding 관련 설명을 모두 동일 기준으로 맞춘다.

### 완료 기준
- forbidden_apis 정책과 popup-grid 템플릿이 충돌하지 않을 것

---

## 4.11 `docs/templates/screen_spec_template.md`
### 수정 목적
사람 검토용 spec 템플릿을 새 구조에 맞춘다.

### 수정 지시
1. 해당 템플릿은 `people_spec.md` 용도임을 명시한다.
2. 사용자는 `final/people_spec.md`를 검토/수정한다는 점을 명시한다.
3. 기존 Phase 1 / Phase 2 / 재실행 설명이 있다면 제거한다.
4. `final_spec.yaml` 생성 전제 문구 제거
5. `confirm.md` 전제 문구 제거
6. 사람 검토 시 보완해야 할 항목 예시를 추가한다.
   - 누락 기능
   - 잘못 해석된 업무 규칙
   - 버튼/이벤트/검증 규칙 보완
   - 파라미터/쿼리/테이블 보정
   - 예외 처리 보강

### 완료 기준
- 사람 검토 문서 역할이 분명해질 것
- 기계 spec 생성 로직과 혼동되지 않을 것

---

## 4.12 `policies/runtime/allowed_paths.yml`
### 수정 목적
새 spec 파일 구조를 runtime 접근정책에 반영한다.

### 수정 지시
1. analyze 읽기/쓰기 경로에 아래를 반영한다.
   - write:
     - `original/people_spec.md`
     - `original/machine_spec.yml`
     - `final/people_spec.md`

2. build 읽기/쓰기 경로에 아래를 반영한다.
   - read:
     - `original/people_spec.md`
     - `original/machine_spec.yml`
     - `final/people_spec.md`
   - write:
     - `final/machine_spec.yml`

3. `final_spec.yaml` 경로 제거
4. `confirm.md` 경로 제거

### 완료 기준
- 런타임 정책과 실제 입출력 구조가 일치할 것

---

## 5. 권장 machine_spec.yml 구조 기준

아래는 권장 최소 구조이다.

```yaml
meta:
  task_id: task001
  screen_id: SEA0001M01
  step: build
  screen_type: popup-grid
  template_id: popup-grid

ui:
  search: {}
  grid: {}
  form: {}

behavior:
  required_functions:
    - initPgm
    - activePgm
  parameter_binding:
    source: activePgm_param
  forbidden_apis:
    - APP_PGM.getOpenParam(PGM)

data:
  tables: []
  queries:
    select: ""
    save: ""

implementation:
  controller_mode: common
  service_mode: common

policy:
  severity_mode:
    high: auto_apply
    low: propose_only
```

주의:
- build는 prose가 아니라 `machine_spec.yml`만을 해석 기준으로 사용한다.
- 사용자 검토 결과는 diff 반영 절차를 통해서만 machine spec에 들어간다.

---

## 6. 반영 순서

아래 순서로 수정한다.

1. `ARCHITECTURE.md`
2. `schemas/manifest.schema.json`
3. `system/config/paths.yml`
4. `.claude/settings.json`
5. `.claude/commands/analyze.md`
6. `.claude/commands/build.md`
7. `.claude/commands/test.md`
8. `.claude/commands/fix.md`
9. `policies/framework/forbidden_apis.yml`
10. `system/templates/screen-types/popup-grid.yml`
11. `docs/templates/screen_spec_template.md`
12. `policies/runtime/allowed_paths.yml`

---

## 7. 검증 체크리스트

### 7.1 단계 정합성
- [ ] 모든 문서의 표준 단계가 `analyze/build/test/fix`만 사용되는가
- [ ] `instruct/generate/verify/deploy`가 외부 단계명으로 제거되었는가

### 7.2 spec 정합성
- [ ] `final_spec.yaml`이 완전히 제거되었는가
- [ ] `original/people_spec.md`가 존재하는가
- [ ] `original/machine_spec.yml`가 존재하는가
- [ ] `final/people_spec.md`가 존재하는가
- [ ] `final/machine_spec.yml`가 build 입력으로 정의되었는가

### 7.3 confirm 제거
- [ ] `confirm.md` 관련 설명이 전부 제거되었는가
- [ ] `confirm.md` 경로가 정책/설정/문서에서 제거되었는가

### 7.4 정책 정합성
- [ ] severity가 `high/low`만 사용되는가
- [ ] `high = 자동 적용`, `low = 제안만`으로 통일되었는가
- [ ] `APP_PGM.getOpenParam(PGM)` 금지 정책이 일관되게 적용되는가
- [ ] popup-grid 템플릿이 `activePgm(param, isNew)` 기준으로 맞춰졌는가

### 7.5 build 흐름 정합성
- [ ] build 직전 diff 반영 절차가 문서화되었는가
- [ ] build가 `final/machine_spec.yml`만 읽는가
- [ ] test/fix도 동일 spec 기준을 참조하는가

---

## 8. 최종 목표 상태

최종적으로 본 시스템은 아래처럼 동작해야 한다.

1. `analyze` 수행
2. 아래 파일 생성
   - `original/people_spec.md`
   - `original/machine_spec.yml`
   - `final/people_spec.md`
3. 사용자가 `final/people_spec.md` 검토 및 수정
4. 시스템이 `original/people_spec.md`와 `final/people_spec.md`를 비교
5. 변경/추가 내용만 `original/machine_spec.yml`에 반영
6. `final/machine_spec.yml` 생성
7. `build`는 `final/machine_spec.yml`만 사용
8. `test`, `fix`도 동일한 spec 기준으로 동작

이 상태가 되면:
- 사람 검토 결과가 실제 build 입력에 반영되고
- 기계 해석 기준은 YAML로 안정적으로 유지되며
- 정책 통제는 문장 해석이 아니라 구조 해석 기준으로 수행된다.
