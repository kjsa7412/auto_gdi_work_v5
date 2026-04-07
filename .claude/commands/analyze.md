# /analyze {taskId} — PPT 분석 → 최종 기능정의서 (통합)

**인자**: $ARGUMENTS (taskId)

## 목적
user/inbox/tasks/{taskId}/ 하위 PPT를 분석하여, convention 매핑 및 명세 보완까지 일괄 수행한 뒤
화면별 **dual-spec** (사람 검토용 + 기계 해석용)을 생성한다.
v4의 sync + analyze-phase1 + analyze-phase2 + instruct를 단일 명령으로 통합한다.

## 경로
모든 경로는 `system/config/paths.yml` 참조.
PROJECT_ROOT = C:/auto_gdi_work_v5

## 실행 원칙
- **Stateless**: 이전 대화 이력, 다른 task/screen 컨텍스트 참조 금지
- **Manifest 기반**: 입출력은 manifest.yaml에 명시된 경로만 허용
- **정책 기반**: policies/analyze/*.yml 규칙 자동 적용
- **Convention 우선**: 사용자 답변과 convention이 충돌하면 convention 우선 (충돌 사실 기록)
- **중간 산출물 최소화**: 내부 처리 파일 없음 — 최종 결과만 출력

## DB 접속 정보
- 접속 정보: `policies/runtime/db_access.yml` 참조
- **sync** (PHASE 1): convention 캐시 전체 갱신 허용
- **lookup** (PHASE 2~6): convention Grep으로 확인 불가능한 정보에 한해 DB 직접 조회 허용
  - 뷰(VIEW) 구조, 트리거, 인덱스, 코드값 실데이터, 컬럼 상세 등
  - SELECT만 허용, 데이터 변경 금지
  - convention Grep 선행 필수 (DB-001)
  - 조회 사유를 산출물에 기록

---

## 입력
- `user/inbox/tasks/{taskId}/*.pptx`
- `system/cache/convention/` (Grep only — 전체 Read 금지)
- `policies/analyze/*.yml`
- `docs/templates/screen_spec_template.md`

## 출력

### 사용자용 (dual-spec 구조)
- `user/review/tasks/{taskId}/original/people_spec.md` — 사람 검토용 원본 기능정의서
- `user/review/tasks/{taskId}/original/machine_spec.yml` — 기계 판독용 원본 명세
- `user/review/tasks/{taskId}/final/people_spec.md` — 사용자 검토/수정용 (original/people_spec.md의 복제본)

### 시스템 내부
- `system/runtime/tasks/{taskId}/manifest.yaml` (status: `analyzed`)
- `system/runtime/tasks/{taskId}/screens/{screenId}/analyze.manifest.yaml`

### analyze가 생성하지 않는 파일
- `final/machine_spec.yml` — build 직전 diff 반영 단계에서 생성된다

### 생성하지 않는 파일 (v4 대비 제거)
- ~~ppt_analysis.md~~ — 내부 처리로 대체
- ~~classification.md~~ — 내부 처리로 대체
- ~~merged_spec.md~~ — people_spec.md가 곧 최종본
- ~~trace.md~~ — 내부 처리로 대체
- ~~source_manifest.md~~ — 내부 처리로 대체
- ~~spec_completion.json~~ — manifest에 통합
- ~~questions.md~~ — people_spec.md에 통합
- ~~final_spec.yaml~~ — machine_spec.yml로 대체
- ~~confirm.md~~ — 제거 (사용자가 final/people_spec.md 수정 완료 시점 기준)
- ~~review.md~~ — people_spec.md에 통합

## manifest.yaml 구조

```yaml
task_id: {taskId}
status: syncing | analyzing | analyzed
created_at: {timestamp}
screens:
  - screen_id: {screenId}
    status: analyzed
    screen_type: grid-only | search-grid-form | form-detail | popup-grid
    manifest: screens/{screenId}/analyze.manifest.yaml
```

## analyze.manifest.yaml 구조

```yaml
screen_id: {screenId}
phase: analyze
status: analyzed
screen_type: grid-only | search-grid-form | form-detail | popup-grid
original_people_spec: user/review/tasks/{taskId}/original/people_spec.md
original_machine_spec: user/review/tasks/{taskId}/original/machine_spec.yml
final_people_spec: user/review/tasks/{taskId}/final/people_spec.md
tags_found: [META, SEARCH, GRID, FORM, BUTTON, ...]
completion:
  total_fields: 45
  resolved: 42
  manual_required: 3
  coverage: 0.93
unresolved:
  - type: code_mapping
    field: wrk_tp_cd
    tag: "[코드확인필요]"
```

---

## 절차

### PHASE 1: Sync — Convention 데이터 갱신

1. DB에서 DDL, 코드정의, 프로그램목록을 텍스트 파일로 추출하여 convention 캐시에 저장
2. 실행 SQL은 `system/cache/convention/sql/` 하위 파일 참조
3. 출력:
   - `system/cache/convention/테이블_DDL.txt`
   - `system/cache/convention/코드_상세.txt`
   - `system/cache/convention/코드_업무구분.txt`
   - `system/cache/convention/프로그램목록.txt`
4. 생성된 convention 파일은 이후 단계에서 Grep으로만 접근 (전체 Read 금지)

### PHASE 2: PPT 데이터 추출 (policies/analyze/ppt_extraction.yml 필수 준수)

PPT에서 데이터를 추출할 때 반드시 아래 규칙을 따른다:

1. **GROUP shape 재귀 탐색 (PE-001, 필수)**
   - python-pptx로 추출 시 `shape.has_text_frame`과 `shape.has_table`만 확인하면 **GROUP(type=6) 내부 콘텐츠가 누락**됨
   - 화면설계서에서 검색 필드, 폼 필드는 대부분 `라벨+입력박스` 그룹으로 표현됨
   - 모든 shape에 대해 `shape.shape_type == 6 (GROUP)`이면 내부 자식 shape를 재귀적으로 탐색
   - 그룹 내부에서 추출된 텍스트로 필드 라벨, 코드타입, 입력유형을 판별

2. **shape 위치 기반 영역 분류 (PE-002)**
   - top 좌표 순으로 정렬하여 META → 버튼 → 검색 → 그리드 → 설명 영역 구분
   - 동일 top 좌표의 그룹들은 같은 행의 필드로 판단

3. **GROUP 내부 패턴 인식 (PE-003)**
   - `라벨 + 입력박스 + '?'` = 코드헬프/콤보박스 (코드타입은 입력박스 텍스트에서 추출, 예: 'RP010')
   - `라벨 + '~' + 날짜아이콘(PICTURE)` = 날짜범위
   - `라벨 + '▼' 포함 텍스트` = 콤보박스 (선택값 예시 포함)
   - `라벨에 '*' 접두사` = 필수 필드

4. **추출 완전성 검증 (PE-004)**
   - 조회 버튼이 있으면 검색 필드가 반드시 1개 이상 존재해야 함
   - 검색 필드가 0개이면 GROUP shape 재탐색 수행
   - 설명 텍스트에서 언급된 필드가 모두 추출되었는지 확인

5. **필드 배치 레이아웃 추출 (PE-005, 필수)**
   - 같은 top 좌표(오차 0.3cm)인 GROUP들 → 같은 행(row)
   - 같은 행 내 left 좌표 순 → 열(col_order) 결정
   - GROUP의 width로 gravity 산출:
     - 행 전체 폭 ÷ 5 = 1칸 기준 폭
     - width ≈ 1칸 → gravity: 1 (생략), ≈ 2칸 → gravity: 2, ≈ 전체폭 → gravity: 5
   - 한 행의 gravity 합계가 5 미만이면 빈 칸({})으로 채움
   - 결과를 기능정의서 각 필드에 `row`, `col_order`, `gravity` 로 기록

6. **섹션 간 레이아웃 구조 추출 (PE-006)**
   - 좌/우 분할 배치 감지: 두 영역의 left 좌표가 크게 다르면 좌우 분할
   - 분할 비율: 좌/우 width 비율로 half-left/right 또는 N-left/N-right 결정
   - 상/하 배치: 동일 left에 top이 다르면 → data-content-fill
   - 결과를 기능정의서 "레이아웃" 항목에 기록

### PHASE 3: 화면 식별 + 분류 + Convention 매핑

1. **화면 식별**
   - PPT에서 슬라이드별 화면 식별
   - 동일 화면ID 슬라이드 병합 (별도 탭 분리 금지, 동일 화면의 연속 내용으로 취급)

2. **분류 태그 추출** — 13개 분류 태그:
   - META, SEARCH, GRID, FORM, BUTTON, EVENT, CODE, TABLE, API, MODAL, NAV, VALID, SQL

3. **Convention 매핑**
   - convention Grep으로 코드/DDL 매핑
   - 화면유형 분류 (policies/analyze/screen_type_rules.yml 참조)

4. **화면유형 최종 확정**
   - grid-only | search-grid-form | form-detail | popup-grid

### PHASE 4: 명세 보완 (instruct 통합)

v4의 instruct 스킬 로직을 이 단계에서 수행한다.

1. **보완 우선순위 (절대)**
   ```
   1순위: DDL (system/cache/convention/테이블_DDL.txt) — 컬럼명, 타입, 제약조건
   2순위: 코드정의서 (system/cache/convention/코드_상세.txt) — wrk_tp_cd, cd_tp_cd
   3순위: 화면유형 패턴 (policies/analyze/default_resolution.yml)
   4순위: 업무 일반 규칙 (감사컬럼, PK 패턴 등)
   최하위: 에이전트 자체 판단 — 위 참조에 없는 경우에만, [추론/보완 항목] 태그 필수
   ```

2. **불확실 항목 해결**
   - DDL/코드 Grep으로 매핑 시도
   - 매핑 실패 시 태그 유지: `[코드확인필요]`, `[사용자 확인 필요]`

3. **machine_spec.yml 생성**
   - build가 바로 코드 생성 가능한 수준의 기계판독용 최종 명세
   - 필수 포함 항목: screen, search, grid, form, buttons, events, api, codes, tables, supplements

4. **그리드 코드헬프 규칙**
   - spec에서 "코드헬프", "유저정보", "커스텀 검색" 등이 명시된 그리드 컬럼은 editor를 `GRID_VIEW.code`로 지정
   - note에만 기록하고 editor를 GRID_VIEW.text로 남겨두면 안 됨
   - type: `DATA_CODE_TYPE.{코드유형}` + targetCols 반드시 함께 지정

### PHASE 5: 기능정의서 생성 (people_spec.md)

screen_spec_template.md 기반으로 화면별 사람 검토용 기능정의서 생성.

#### 작성 규칙

1. **분석된 섹션**: PPT에서 추출 + convention 보완 내용을 채우되, 해당 섹션의 가이드/예시는 삭제
2. **미분석 섹션 (PPT에 해당 정보 없음)**:
   - 섹션 헤더와 빈 테이블 구조를 **그대로 유지**
   - 가이드 텍스트도 유지하여 사용자가 참고하여 작성 가능하게 함
   - 섹션 상단에 `<!-- PPT에서 확인되지 않은 항목입니다. 해당 사항이 있으면 작성해주세요. -->` 주석 추가
3. **부분 분석 섹션**: 분석된 행은 채우고, 추가 행을 위한 빈 행 유지
4. **불확실 항목 태깅**:
   - `[코드확인필요]` — convention에서 확인 안 된 코드
   - `[사용자 확인 필요]` — PPT에서 불명확한 정보
   - `[신규코드제안]` — 등록 필요한 신규 코드
   - `[추론/보완 항목]` — 합리적 근거로 보완한 항목 (검토 권장)
   - `[원문 반영]` — PPT 원문 그대로 반영
   - `[기본값 적용]` — 화면유형 패턴/업무 규칙 기반 기본값
5. **레이아웃 정보 필수 기록** (PE-005, PE-006):
   - 검색/폼 필드 테이블에 `row`, `gravity` 컬럼을 반드시 포함
   - PPT shape 좌표에서 추출한 행 배치와 칸 크기를 기록
   - 화면 개요의 레이아웃 항목에 섹션 간 배치 구조 기록 (좌우분할, 단일영역 등)
   - gravity가 불분명하면 `[사용자 확인 필요]` 태깅

#### 사람 검토 시 보완해야 할 항목

people_spec.md에는 아래 사항에 대한 사람 검토가 필요하다:
- 누락 기능
- 애매한 업무 규칙
- 버튼/이벤트/검증 보완 필요사항
- 쿼리/테이블/파라미터 보정 필요사항

#### 기능정의서 헤더

```markdown
# 기능정의서 — {화면ID} {프로그램명}

> **자동 분석 완료 — 사용자 검토 대기**
> 각 섹션을 검토하고, 빈 항목이나 태그가 있는 항목을 보충해주세요.
> 보충 완료 후 `/build {taskId}`를 실행하세요.
>
> **분류 태그:** `[원문 반영]` `[추론/보완 항목]` `[사용자 확인 필요]` `[코드확인필요]` `[신규코드제안]` `[기본값 적용]`
```

#### 섹션별 처리

| 섹션 | PPT에서 분석 가능 | 미분석 시 처리 |
|------|-----------------|--------------|
| 1. 화면 개요 (META) | 거의 항상 | 빈 테이블 유지 |
| 2. 검색 영역 (SEARCH) | 높음 | 빈 테이블 + 가이드 유지 |
| 3. 그리드 (GRID) | 높음 | 빈 테이블 + 가이드 유지 |
| 4. 상세 폼 (FORM) | 중간 | 빈 테이블 + 동적 전환 가이드 유지 |
| 5. 버튼 (BUTTON) | 높음 | 빈 테이블 + 기능 상세 가이드 유지 |
| 6. 알림/메시지 (VALID) | 낮음 | **반드시 유지** — PPT에 거의 없는 정보 |
| 7. 상태별 제어 (EVENT) | 중간 | 빈 테이블 + 가이드 유지 |
| 8. 화면 이동 (NAV) | 중간 | 빈 테이블 + 가이드 유지 |
| 9. 첨부파일 | 낮음 | [선택] 섹션 유지 |
| 10. 팝업/모달 | 낮음 | [선택] 섹션 유지 |
| 11. 특이사항 | 중간 | 빈 항목 유지 |

### PHASE 6: dual-spec 파일 생성

1. `original/people_spec.md` 생성 — PHASE 5에서 작성한 기능정의서
2. `original/machine_spec.yml` 생성 — PHASE 4에서 생성한 기계판독용 명세
3. `final/people_spec.md` 생성 — `original/people_spec.md`의 **복제본**
4. `final/machine_spec.yml`은 **생성하지 않음** — build 직전 diff 반영 단계에서 생성

### PHASE 7: 완료 처리

1. manifest.yaml status → `analyzed`
2. 사용자에게 검토 안내 메시지 출력:
   > 분석 완료. `user/review/tasks/{taskId}/final/people_spec.md` 에서 기능정의서를 검토/보충한 후
   > `/build {taskId}`를 실행하세요.

---

## 버튼 분류 규칙

| 표준 라벨 | 슬롯 | listener 경로 | pgm_info 컬럼 |
|-----------|------|-------------|-------------|
| 초기화 | init | listener.button.init.click | init_yn |
| 조회 | search | listener.button.search.click | srch_yn |
| 신규 | news | listener.button.news.click | new_yn |
| 저장 | save | listener.button.save.click | save_yn |
| 삭제 | del | listener.button.del.click | del_yn |
| 출력 | print | listener.button.print.click | prnt_yn |
| 업로드 | upload | listener.button.upload.click | upld_yn |

**주의: 프레임워크 실제 슬롯명 기준** (new→news, prnt→print, upld→upload). REFERENCE_ROOT 실사용례 확인 필수.

표준 라벨과 불일치하는 버튼은 etc{N} 커스텀 슬롯으로 분류한다 (listener.button.etc{N}.click).

## machine_spec.yml 필수 포함 항목

```yaml
screen:
  screen_id: SEA010
  screen_nm: "화면명"
  screen_type: grid-only | search-grid-form | form-detail | popup-grid
  module_id: SE
  category_id: SEA
  template: grid-only  # skeleton 선택용

search:
  fields:
    - name: P_field_cd
      view: DATA_VIEW.code
      type: DATA_CODE_TYPE.code
      label: "필드명"
      row: 1
      col_order: 1
      gravity: 1
      param: { wrk_tp_cd: 'SE', cd_tp_cd: '010' }

grid:
  grid_id: grid1
  editable: false
  checkable: false
  columns:
    - id: col_nm
      header: "컬럼명"
      editor: GRID_VIEW.text
      sort: string
      css: textCenter

form:
  form_id: postForm
  fields:
    - name: field_nm
      view: DATA_VIEW.text
      label: "필드명"
      required: true
      row: 1
      col_order: 1
      gravity: 1

buttons:
  standard:
    - ppt_label: "초기화"
      slot: init
      listener: listener.button.init.click
  custom:
    - ppt_label: "초안작성"
      slot: etc_desc1
      listener: listener.button.etc1.click

events:
  - trigger: gridRow.click
    action: "postForm에 데이터 세팅"
  - trigger: gridRow.dblclick
    action: "서브화면 SEA011 이동"

api:
  - statement: sea010.selectList
    type: select
    table: main_table

codes:
  - field: wrk_tp_cd
    wrk_tp_cd: SE
    cd_tp_cd: '010'
    verified: true

tables:
  - table_name: main_table
    ddl_verified: true
    missing_columns: []

supplements:
  - field: new_field
    tag: "[추론/보완 항목]"
    reason: "DDL에 존재하나 PPT에 미기재"
```

## 사용자 리뷰
- 리뷰는 analyze 완료 후 **1회만** 수행
- 사용자가 `final/people_spec.md`를 수정 완료한 후 `/build` 진행
- v4처럼 phase1 → 보충 → phase2 의 2회 리뷰 없음

## 원문 보존 원칙
- 중복 내용 병합 가능하나 임의 삭제 금지
- PPT 원문 출처 정보(슬라이드 번호 등) 기능정의서에 반드시 유지

## 금지사항
- PPT에 없는 내용 임의 추가 금지
- DDL 컬럼명 추정 금지 (Grep 확인 필수)
- convention 전체 Read 금지 (Grep만 허용)
- 다른 task/screen의 분석 결과 참조 금지 (Stateless)
- sync 외 단계에서는 lookup(SELECT 읽기 전용)만 허용 (policies/runtime/db_access.yml 준수)
- `[사용자 확인 필요]` 항목을 자체 판단으로 해결 금지
- 설계서에 없는 필드를 보완 근거 없이 임의 추가 금지
