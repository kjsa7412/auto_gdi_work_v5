# v5 아키텍처

## 전체 구조

```
auto_gdi_work_v5/
├── user/               ← 사용자 영역 (입력, 검토, 테스트, 산출물)
├── system/             ← 시스템 내부 영역 (중간산출물, 이력, 설정)
│   ├── runtime/        ← 진행 중 task/fix (working → active)
│   ├── archive/        ← 완료 task/fix 보관 (실행 입력 금지)
│   ├── cache/          ← convention 캐시
│   ├── config/         ← 전역 설정
│   ├── templates/      ← 스켈레톤, 화면유형
│   └── tests/          ← Playwright 인프라
├── policies/           ← YML 기반 정책 (기계 판독 규칙)
├── schemas/            ← 검증 스키마
├── proposals/          ← 정책 변경 제안 (new/done/backups)
├── docs/               ← 문서, 템플릿
├── .claude/            ← 명령어(commands), 스킬(skills)
└── ARCHITECTURE.md     ← 이 파일
```

## 1. v4 → v5 파이프라인 비교

### v4: 11단계 파이프라인

```
/sync → /analyze-phase1 → [사용자 보충] → /analyze-phase2 → [사용자 확인]
→ instruct → generate → verify → deploy → /test → /fix → /apply-policy-fix
```

- 사용자 검토 구간 4회
- 중간 산출물 다수 (screen_discovery.md, merged_spec, review.md, questions.md 등)
- analyze가 phase1/phase2로 분리
- verify가 generate와 별도 step
- instruct가 독립 skill

### v5: 4단계 파이프라인

```
/analyze {taskId} → [사용자 검토 1회] → /build {taskId} → /test {taskId}
                                                         → /fix {fixId} {taskId}
```

**v5 표준 단계: `analyze` / `build` / `test` / `fix`**

- 사용자 검토 구간 1회 (analyze 완료 후, `final/people_spec.md` 수정)
- 중간 산출물 최소화
- analyze가 단일 명령으로 통합
- verify가 generate 내부 self-check로 흡수
- instruct가 analyze 내부로 흡수

### 단계 매핑

| v4 | v5 | 변경 내용 |
|----|-----|----------|
| /sync | /analyze 내부 | sync를 analyze 첫 단계로 통합 |
| /analyze-phase1 | /analyze 내부 | PPT 추출 ~ 1차 기능정의서 |
| [사용자 보충 ①] | 제거 | 시스템이 자동 완성 |
| /analyze-phase2 | /analyze 내부 | 분류 ~ spec 완성 |
| [사용자 확인 ②] | [사용자 검토] | 유일한 검토 구간 (final/people_spec.md 수정) |
| instruct (skill) | /analyze 내부 | spec 완성 시 machine_spec.yml 동시 생성 |
| generate (skill) | /build 내부 | 생성 + self-check 통합 |
| verify (skill) | /build 내부 | generate self-check로 흡수 |
| deploy (skill) | /build 내부 | 생성 후 즉시 배포 |
| /test | /test | 동일 (독립 Playwright 테스트) |
| /fix | /fix | 간소화 (사용자 검토 없이 즉시 실행) |
| /apply-policy-fix | /fix 내부 | severity 기반 자동 적용 |

## 2. 파이프라인: /analyze {taskId}

### 통합 흐름

```
/analyze {taskId}
    ↓
    ① sync — convention DB 스냅샷 갱신
    ↓
    ② PPT 추출 — inbox/tasks/{taskId}/*.pptx 파싱
    ↓
    ③ 화면 발견 — PPT에서 화면 목록 식별
    ↓
    ④ 화면 분류 — screen-type 자동 매핑
    ↓
    ⑤ 컨벤션 매핑 — DDL/코드 매핑, 필드 바인딩
    ↓
    ⑥ spec 완성 — dual-spec 생성 (people_spec.md + machine_spec.yml)
    ↓
    ⑦ 사용자 검토 대기
```

### 산출물 (dual-spec 구조)

| 파일 | 위치 | 용도 |
|------|------|------|
| people_spec.md | user/review/tasks/{taskId}/original/ | 사람 검토용 원본 기능정의서 |
| machine_spec.yml | user/review/tasks/{taskId}/original/ | 기계 판독용 원본 명세 |
| people_spec.md | user/review/tasks/{taskId}/final/ | 사용자 검토/수정용 기능정의서 (original의 복제본) |

### 사용자 검토 (유일한 검토 구간)

```
═══ 사용자 검토 — final/people_spec.md 확인/보충 ═══
```

- v4에서 2회 검토(phase1 보충 + phase2 확인)를 1회로 통합
- 시스템이 충분히 완성된 spec을 제공하므로 보충 부담 최소화
- 사용자는 `final/people_spec.md`에 직접 검토/수정 내용을 작성
- 시스템은 `original/people_spec.md`와 `final/people_spec.md`를 비교
- 변경/추가 내용만 `original/machine_spec.yml`에 반영하여 `final/machine_spec.yml`을 생성

## 3. 파이프라인: /build {taskId}

### 통합 흐름

```
/build {taskId}
    ↓
    ① pre-build diff — original/people_spec.md vs final/people_spec.md 비교
    │   └── 변경/추가 내용 추출 → original/machine_spec.yml에 반영 → final/machine_spec.yml 생성
    ↓
    ② generate (with self-check) — final/machine_spec.yml → HTML/XML/SQL/Java 생성
    │   └── 생성 직후 verify 정책 기반 self-check 실행
    │   └── 위반 발견 시 즉시 자체 수정 후 재생성
    ↓
    ③ deploy — SOURCE_ROOT + deliverables 배포
```

### pre-build diff 반영 절차

build 시작 전에 아래 절차를 수행한다:
1. `original/people_spec.md`와 `final/people_spec.md` diff 수행
2. 변경/추가 내용 추출
3. `original/machine_spec.yml`에 반영
4. `final/machine_spec.yml` 생성

**삭제는 자동 반영하지 않는다.** 명시적 삭제 표기 규칙이 있을 때만 반영 가능하다.

### build 입력

build는 반드시 `final/machine_spec.yml` 하나만 읽는다.

### verify 통합 (self-check)

v4에서 별도 step이었던 verify가 generate 내부로 흡수되었다.

```
[v4]  generate → (산출물) → verify → (로그) → [위반 시 재생성]
[v5]  generate { 생성 → self-check → [위반 시 즉시 수정] → 완료 } → deploy
```

- generate가 파일 생성 후 policies/verify/*.yml 규칙으로 자체 검증
- 위반 항목 발견 시 별도 step 없이 즉시 수정
- 검증 통과 후에만 deploy 진행
- 별도 verify manifest, verify 로그 불필요

## 4. 파이프라인: /fix {fixId} {taskId}

### 통합 흐름

```
/fix {fixId} {taskId}
    ↓
    ① fix 내용 분석 — inbox/fixes/{fixId}/fix.md 파싱
    ↓
    ② 즉시 수정 — 대상 파일 수정
    ↓
    ③ generate (self-check) → deploy
    ↓
    ④ 정책 자동 수정 — severity 기반 자동 적용
```

### v4와의 차이

| 항목 | v4 | v5 |
|------|-----|-----|
| 사용자 검토 | fix.md 확인 후 실행 | 즉시 실행 (검토 없음) |
| 정책 제안 | propose-policy-fix → 사용자 승인 → /apply-policy-fix | severity에 따라 자동 적용 |
| /apply-policy-fix | 별도 명령 필요 | 제거 (/fix 내부 자동 처리) |

### 정책 자동 수정 (severity 기반)

| severity | 동작 |
|----------|------|
| high | 자동 적용 (백업 + 적용 + 로그) |
| low | 제안만 생성 (`proposals/policy_changes/new/`) |

## 5. 파이프라인: /test {taskId} [screenId]

### 흐름

```
/test {taskId} [screenId]
    ↓
    ① Playwright 테스트 실행
    ↓
    ② 결과 리포트 생성
    ↓
    ③ 실패 시 fix.md 자동 생성 → /fix 연계
```

### 산출물

| 파일 | 위치 |
|------|------|
| summary.md | user/test/tasks/{taskId}/ |
| {screenId}_test.md | user/test/tasks/{taskId}/ |
| fix.md (실패 시) | user/inbox/fixes/{fixId}/ |

- v4와 동일한 독립 테스트 파이프라인
- screenId 지정 시 해당 화면만 테스트
- 테스트 시 참조 spec은 `final/machine_spec.yml` 기준

## 6. 중간 산출물 제거

### 제거된 산출물

| v4 산출물 | 이유 |
|-----------|------|
| screen_discovery.md | analyze 내부 처리, 별도 파일 불필요 |
| analyze.manifest.yaml | 단일 analyze로 통합 |
| instruct.manifest.yaml | analyze에 흡수 |
| verify.manifest.yaml | generate self-check로 흡수 |
| review.md | spec.md로 통합 |
| questions.md | spec.md 내 인라인으로 통합 |
| confirm.md | 제거 — 사용자가 final/people_spec.md 수정 완료 시점 기준 |
| final_spec.yaml | dual-spec 구조로 대체 (machine_spec.yml) |
| verify 로그 | generate self-check 내부 처리 |

### 유지되는 산출물

| 산출물 | 위치 | 용도 |
|--------|------|------|
| manifest.yaml | system/runtime/tasks/{taskId}/ | task 전체 상태 |
| people_spec.md (original) | user/review/tasks/{taskId}/original/ | 분석 원본 (사람 검토용) |
| machine_spec.yml (original) | user/review/tasks/{taskId}/original/ | 분석 원본 (기계 판독용) |
| people_spec.md (final) | user/review/tasks/{taskId}/final/ | 사용자 검토/수정본 |
| machine_spec.yml (final) | user/review/tasks/{taskId}/final/ | build 입력 (diff 반영 결과) |
| generate.manifest.yaml | system/runtime/tasks/{taskId}/screens/{screenId}/ | 생성 상태 |
| deploy.manifest.yaml | system/runtime/tasks/{taskId}/screens/{screenId}/ | 배포 상태 |
| outputs/ | system/runtime/tasks/{taskId}/screens/{screenId}/ | 생성물 (HTML, XML, SQL, Java) |

## 7. 정책 구조

### 정책 디렉토리

```
policies/
├── analyze/           ← analyze 단계 정책
│   ├── phase_rules.yml
│   ├── classify_tags.yml
│   ├── merge_priority.yml
│   ├── screen_type_rules.yml
│   └── source_access.yml
├── framework/         ← build(generate) 단계 정책
│   ├── forbidden_apis.yml
│   ├── button_mapping.yml
│   ├── template_selection.yml
│   ├── skeleton_contract.yml
│   ├── layout_rules.yml
│   ├── html_patterns.yml
│   ├── xml_patterns.yml
│   ├── controller_patterns.yml
│   └── service_patterns.yml
├── verify/            ← generate self-check 정책
│   ├── html_checks.yml
│   ├── xml_checks.yml
│   ├── sql_checks.yml
│   ├── controller_checks.yml
│   ├── service_checks.yml
│   └── escalation_rules.yml
└── runtime/           ← 런타임 격리 정책
    ├── allowed_paths.yml
    ├── context_isolation.yml
    ├── session_rules.yml
    ├── lifecycle.yml      ← 산출물 생명주기 (active/working/archive)
    └── db_access.yml      ← DB 직접 접근 정책 (convention 보완용)
```

### 정책 적용 시점

| 시점 | 적용 정책 |
|------|----------|
| /analyze | analyze/*.yml |
| /build — generate (skeleton) | framework/template_selection.yml, skeleton_contract.yml |
| /build — generate (fill) | framework/html_patterns.yml, xml_patterns.yml, controller_patterns.yml, service_patterns.yml |
| /build — generate (self-check) | verify/*.yml (전수 검증), framework/forbidden_apis.yml |
| /build — deploy | runtime/allowed_paths.yml |
| runtime (모든 명령) | runtime/*.yml (격리 규칙) |

### DB 직접 접근 정책 (policies/runtime/db_access.yml)

convention 캐시(Grep)로 확인 불가능한 정보는 DB 직접 조회를 허용한다.

| 접근 등급 | 설명 | 허용 step | 허용 조작 |
|----------|------|----------|----------|
| **sync** | convention 캐시 전체 갱신 | analyze (PHASE 1만) | SELECT, COPY |
| **lookup** | 실시간 소량 조회 (뷰, 트리거, 코드값 등) | analyze, build, test, fix | SELECT only |

**lookup 규칙:**
1. convention Grep 선행 필수 (DB-001) — Grep 결과가 불충분할 때만 DB 조회
2. SELECT만 허용 (DB-002) — INSERT/UPDATE/DELETE/DDL 절대 금지
3. 해당 task/screen 관련 테이블만 조회 (DB-003)
4. 조회 사유 기록 필수 (DB-004)
5. 대량 조회 금지 (DB-005) — LIMIT 없는 SELECT 금지 (sync 제외)

**주요 lookup 용도:** 뷰(VIEW) 구조, 트리거 존재, 시퀀스, 인덱스, 코드값 실데이터, 컬럼 상세

### 금지 API 정책

- `APP_PGM.getOpenParam(PGM)` 사용 금지
- 대체 표준: `activePgm(param, isNew)`의 첫 번째 인자 사용
- 상세 목록: `policies/framework/forbidden_apis.yml` 참조

## 8. 화면유형 + 산출물

### 화면유형 (screen-types)

| 유형 | 파일 | 설명 |
|------|------|------|
| grid-only | screen-types/grid-only.yml | 조회 + 그리드 (목록 전용) |
| search-grid-form | screen-types/search-grid-form.yml | 조회 + 그리드 + 상세폼 (마스터디테일) |
| form-detail | screen-types/form-detail.yml | 서브화면 단건 상세 |
| popup-grid | screen-types/popup-grid.yml | 팝업 (모달) — activePgm(param, isNew) 파라미터 수신 |

### 스켈레톤 매핑

| 화면유형 | HTML | XML | Controller | Service |
|----------|------|-----|------------|---------|
| grid-only | grid-only.html | select-only.xml | X | X |
| search-grid-form | search-grid-form.html | standard-crud.xml | standard-controller.java | standard-service.java |
| form-detail | form-detail.html | standard-crud.xml | standard-controller.java | standard-service.java |
| popup-grid | popup.html | select-only.xml | X | X |

### 산출물 요약

| 구분 | 생성 조건 | 배포 경로 (SOURCE_ROOT 하위) |
|------|----------|---------------------------|
| HTML | 모든 화면 | src/main/resources/templates/project/{m}/{c}/{ScreenId}.html |
| XML | 모든 화면 | src/main/resources/mapper/sjerp/{m}/{c}/{screenid}.xml |
| Controller | screen-types에서 skeleton.controller != null | src/main/java/com/sjinc/sjerp/proj/{m}/{c}/{screenid}/{ScreenId}Controller.java |
| Service | screen-types에서 skeleton.service != null | src/main/java/com/sjinc/sjerp/proj/{m}/{c}/{screenid}/{ScreenId}Service.java |
| SQL | 모든 화면 (메뉴등록 필수) | deliverables에만 (수동 실행) |

## 9. 컨텍스트 격리

### 격리 단위

```
task (작업 단위)
 └── screen (화면 단위)
      └── step (처리 단계: analyze / build / test / fix)
```

### 격리 원칙

- 각 명령 실행 시 manifest가 해당 명령의 접근 범위를 제한한다
- task 간 데이터 참조 금지
- screen 간 데이터 참조 금지 (동일 task 내에서도)
- 정책(policies/)과 템플릿(templates/)은 전역 공유

### 명령별 접근 범위

| 명령 | allowed_inputs 핵심 | allowed_outputs 핵심 |
|------|---------------------|---------------------|
| /analyze | inbox/tasks/{taskId}/*.pptx, convention | original/people_spec.md, original/machine_spec.yml, final/people_spec.md |
| /build | final/machine_spec.yml, skeletons, policies | outputs/, SOURCE_ROOT, deliverables/ |
| /test | final/machine_spec.yml, deployed files | test/ |
| /fix | inbox/fixes/, 대상 outputs | runtime/fixes/, outputs/ |

## 10. 경로 중앙 관리

모든 경로는 **`system/config/paths.yml`** 에서 일괄 관리한다.
commands, skills, policies에서 경로를 참조할 때는 이 파일을 기준으로 한다.

## 11. user/ vs system/ 분리 원칙

| 질문 | user/ | system/ |
|------|-------|---------|
| 사용자가 직접 작성/편집하는가? | O | X |
| 사용자가 검토해야 하는가? | O | X |
| 최종 배포/확인 대상인가? | O | X |
| 파이프라인 중간 산출물인가? | X | O |
| 오류 예방/이력 데이터인가? | X | O |

## 12. 참조 우선순위

```
1순위: system/cache/convention/ (DDL, 코드) — Grep 전용, 유일한 진실
1-B순위: DB 직접 조회 (lookup) — convention에 없는 뷰/트리거/실시간 정보 (db_access.yml 준수)
2순위: policies/*.yml (프레임워크 정책) — 기계 판독 규칙
3순위: system/templates/ (스켈레톤 템플릿) — 화면 유형별 골격
4순위: REFERENCE_ROOT (FERP 참고 소스) — 패턴 검증
5순위: SOURCE_ROOT (운영 소스) — 실제 배포 상태 참조
최하위: 에이전트 자체 판단 — 위 참조에 없는 경우에만
```

**상위 참조에 내용이 있으면 자의적 판단을 금지한다.**

## 13. 산출물 생명주기 (active / working / archive)

상세 정의: `policies/runtime/lifecycle.yml`

### 상태 정의

| 상태 | 설명 | 실행 입력 | 위치 |
|------|------|----------|------|
| **active** | 현재 시스템이 실제 입력으로 사용 | O | policies/, templates/, config/, schemas/, review/final/ |
| **working** | 작업 중 임시 생성물 | 해당 단계 내에서만 | runtime/ 내 ppt_raw.json, generation_log.md 등 |
| **archive** | 보관/추적용 — 실행 입력 **절대 금지** | X | system/archive/, proposals/done/, proposals/backups/ |

### cleanup 시점

| 시점 | 동작 |
|------|------|
| analyze 완료 | ppt_raw.json, extract_ppt.py → working 유지 (build까지) |
| build 완료 | working 중간물 삭제 또는 archive, generation_log.md 정리 |
| test 전체 PASS | runtime/ → system/archive/ 이동 (task 완결) |
| fix 완료 | fix runtime → system/archive/fixes/ 이동 |

### archive 보장 방식
- `allowed_paths.yml` forbidden_always에 `system/archive/**` 등록
- `context_isolation.yml` CI-006 규칙으로 차단
- `.gitignore`에 `system/archive/` 등록

## 14. 전체 파이프라인 흐름도

```
[/analyze {taskId}]
    ↓  sync → PPT추출 → 화면발견 → 분류 → 매핑 → spec완성
    ↓  산출물: original/people_spec.md + original/machine_spec.yml + final/people_spec.md
    ↓
  ═══ 사용자 검토 — final/people_spec.md 확인/보충 (유일한 검토 구간) ═══
    ↓
[/build {taskId}]
    ↓  pre-build diff → final/machine_spec.yml 생성
    ↓  generate (self-check 포함) → deploy
    ↓
[/test {taskId}]
    ↓  Playwright 테스트 + 실패 시 fix.md 자동 생성
    ↓
[/fix {fixId} {taskId}]
    ↓  즉시 수정 → generate (self-check) → deploy
    ↓  severity 기반 정책 자동 수정 (high: 자동 적용, low: 제안만)
    ↓  필요 시 /test 재실행
```
