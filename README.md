# auto_gdi_work_v5

FERP 단위화면 자동 생성 파이프라인 — v5 아키텍처

PPT 화면설계서를 분석하여 FERP 프레임워크 기반의 HTML, XML, SQL, Controller, Service를 자동 생성하고 배포하는 시스템이다.

---

## 아키텍처 개요

### 파이프라인

```
/analyze {taskId}
    → sync → PPT추출 → 화면발견 → 분류 → 매핑 → dual-spec 생성
    → 산출물: original/people_spec.md + original/machine_spec.yml + final/people_spec.md

  ═══ 사용자 검토 (유일한 검토 구간) — final/people_spec.md 수정 ═══

/build {taskId}
    → pre-build diff (original vs final 비교 → final/machine_spec.yml 생성)
    → generate (self-check 포함) → deploy

/test {taskId} [screenId]
    → Playwright 테스트 → 실패 시 fix.md 자동 생성

/fix {fixId} {taskId}
    → 즉시 수정 → 재빌드 → severity 기반 정책 자동 적용
```

### v5 표준 단계

| 단계 | 명령 | 설명 |
|------|------|------|
| analyze | `/analyze {taskId}` | PPT 분석 → dual-spec 생성 |
| build | `/build {taskId}` | diff 반영 → 코드 생성 → 배포 |
| test | `/test {taskId} [screenId]` | Playwright 기능 테스트 |
| fix | `/fix {fixId} {taskId}` | 오류 수정 → 재빌드 → 정책 적용 |

### dual-spec 구조

analyze는 사람용과 기계용 spec을 분리 생성한다.

| 파일 | 위치 | 용도 |
|------|------|------|
| `people_spec.md` | `original/` | 사람 검토용 원본 |
| `machine_spec.yml` | `original/` | 기계 판독용 원본 |
| `people_spec.md` | `final/` | 사용자 검토/수정본 (original 복제) |
| `machine_spec.yml` | `final/` | build 입력 (build 직전 diff 반영으로 생성) |

### 핵심 설계 원칙

- **Stateless**: 각 명령은 독립 실행, task/screen 간 데이터 참조 금지
- **Manifest 기반**: 입출력은 manifest에 명시된 경로만 허용
- **정책 기반**: YML 정책으로 금지 API, 패턴, 검증 규칙을 기계적으로 적용
- **Skeleton 강제**: 코드 생성 시 반드시 skeleton 템플릿 기반
- **Convention 우선**: DDL/코드정의서가 에이전트 판단보다 우선

---

## 디렉토리 구조

```
auto_gdi_work_v5/
├── .claude/                    ← Claude Code 명령어 및 설정
├── user/                       ← 사용자 영역 (입력, 검토, 산출물, 테스트)
├── system/                     ← 시스템 내부 (런타임, 캐시, 템플릿, 테스트)
│   └── archive/                ← 완료 task/fix 보관 (실행 입력 금지)
├── policies/                   ← YML 기반 정책 규칙
├── schemas/                    ← JSON 검증 스키마
├── proposals/                  ← 정책 변경 제안
├── docs/                       ← 문서 및 템플릿
├── ARCHITECTURE.md             ← v5 아키텍처 상세 문서
└── README.md                   ← 이 파일
```

---

## `.claude/` — Claude Code 설정

Claude Code의 명령어(commands), 내부 스킬(skills), 권한 설정을 관리한다.

```
.claude/
├── commands/                   ← 사용자가 호출하는 슬래시 명령
│   ├── analyze.md              ← /analyze — PPT 분석 → dual-spec 생성
│   ├── build.md                ← /build — diff 반영 → 코드 생성 → 배포
│   ├── test.md                 ← /test — Playwright 기능 테스트
│   └── fix.md                  ← /fix — 오류 수정 → 재빌드 → 정책 적용
├── skills/                     ← 명령 내부에서 호출되는 스킬
│   ├── generate.md             ← 코드 생성 + self-check (build 내부)
│   ├── deploy.md               ← SOURCE_ROOT 배포 (build 내부)
│   └── propose-policy-fix.md   ← 정책 개선 제안 생성 (fix 내부)
└── settings.json               ← 권한(allow/deny) 및 환경변수
```

### commands vs skills

- **commands**: 사용자가 직접 `/analyze`, `/build` 등으로 호출
- **skills**: 명령 내부에서 자동 호출되는 하위 처리 단위. 사용자가 직접 호출하지 않음

### settings.json

| 키 | 설명 |
|----|------|
| `permissions.allow` | 허용 도구 목록 (Read, Glob, Grep, Edit, Write, Bash 일부) |
| `permissions.deny` | 금지 도구 목록 (rm -rf, git push, git reset --hard) |
| `env.SOURCE_ROOT` | FERP 운영 소스 경로 (`C:/gdi`) |
| `env.REFERENCE_ROOT` | FERP 참고 소스 경로 |
| `env.PROJECT_ROOT` | 이 프로젝트 루트 경로 |

---

## `user/` — 사용자 영역

사용자가 직접 작성하거나 검토하는 파일이 위치한다. 시스템이 자동 생성하지만 사용자가 편집할 수 있는 파일도 여기에 둔다.

```
user/
├── inbox/                      ← 입력 파일
│   ├── tasks/{taskId}/         ← PPT 화면설계서 (.pptx)
│   └── fixes/{fixId}/         ← fix 요청서 (fix.md + 첨부)
├── review/                     ← 검토 영역
│   └── tasks/{taskId}/
│       ├── original/           ← analyze 원본 (수정 금지)
│       │   ├── people_spec.md  ← 사람 검토용 원본
│       │   └── machine_spec.yml← 기계 판독용 원본
│       └── final/              ← 사용자 검토/수정 대상
│           ├── people_spec.md  ← 사용자가 검토/수정하는 문서
│           └── machine_spec.yml← build 직전 diff 반영으로 생성
├── output/                     ← 최종 산출물
│   ├── tasks/{taskId}/
│   │   ├── report.md           ← 빌드 결과 종합 보고서
│   │   └── deliverables/{screenId}/  ← 최종 파일 사본 (HTML, XML, SQL, Java)
│   └── fixes/{fixId}/
│       └── fix_result.md       ← fix 완료 보고서
└── test/                       ← 테스트 결과
    └── tasks/{taskId}/
        ├── summary.md          ← 전체 테스트 요약
        ├── {screenId}_test.md  ← 화면별 테스트 결과
        └── fix_plan.md         ← fix 계획 (실패 시)
```

### 주요 흐름

1. 사용자가 `inbox/tasks/{taskId}/`에 PPT를 배치
2. `/analyze` 실행 → `review/tasks/{taskId}/original/` + `final/` 생성
3. 사용자가 `final/people_spec.md` 검토/수정
4. `/build` 실행 → `output/tasks/{taskId}/` 산출물 생성
5. `/test` 실행 → `test/tasks/{taskId}/` 결과 생성
6. 실패 시 `inbox/fixes/{fixId}/fix.md` 자동 생성 → `/fix`로 수정

---

## `system/` — 시스템 내부

파이프라인의 중간 산출물, 캐시, 템플릿, 설정 등 시스템 내부 데이터를 관리한다. 사용자가 직접 편집하지 않는다.

```
system/
├── cache/
│   └── convention/             ← DB 스냅샷 (Grep only, 전체 Read 금지)
│       ├── 테이블_DDL.txt       ← 테이블 DDL 정의
│       ├── 코드_상세.txt         ← 코드 상세 정의 (wrk_tp_cd, cd_tp_cd)
│       ├── 코드_업무구분.txt     ← 코드 업무구분 정의
│       ├── 프로그램목록.txt      ← 등록된 프로그램 목록
│       └── sql/                ← convention 추출용 SQL
│           ├── 테이블_DDL_select.sql
│           ├── 코드_상세_select.sql
│           └── 코드_업무구분_select.sql
├── config/
│   └── paths.yml               ← 시스템 전역 경로 중앙 설정
├── runtime/
│   ├── tasks/{taskId}/         ← task별 런타임 데이터
│   │   ├── manifest.yaml       ← task 전체 상태
│   │   ├── extract_ppt.py      ← PPT 추출 스크립트
│   │   ├── ppt_raw.json        ← PPT 추출 원시 데이터
│   │   └── screens/{screenId}/ ← 화면별 런타임
│   │       ├── analyze.manifest.yaml
│   │       ├── generate.manifest.yaml
│   │       ├── deploy.manifest.yaml
│   │       └── outputs/        ← 생성물 (HTML, XML, SQL, Java)
│   └── fixes/{fixId}/         ← fix별 런타임 데이터
│       ├── manifest.yaml
│       ├── logs/
│       └── outputs/
├── templates/
│   ├── screen-types/           ← 화면유형 정의 (4종)
│   │   ├── grid-only.yml       ← 조회+그리드 (목록 전용)
│   │   ├── search-grid-form.yml← 조회+그리드+상세폼 (마스터디테일)
│   │   ├── form-detail.yml     ← 서브화면 단건 상세
│   │   └── popup-grid.yml      ← 팝업 (모달)
│   ├── skeletons/              ← 코드 생성 골격 템플릿
│   │   ├── html/
│   │   │   ├── grid-only.html
│   │   │   ├── search-grid-form.html
│   │   │   ├── form-detail.html
│   │   │   └── popup.html
│   │   ├── xml/
│   │   │   ├── select-only.xml     ← 조회 전용 (grid-only, popup-grid)
│   │   │   └── standard-crud.xml   ← CRUD (search-grid-form, form-detail)
│   │   ├── controller/
│   │   │   └── standard-controller.java
│   │   └── service/
│   │       └── standard-service.java
│   └── partials/               ← 재사용 가능한 템플릿 조각
│       ├── preamble.md.tmpl
│       ├── io-contract.md.tmpl
│       ├── isolation-guard.md.tmpl
│       └── policy-loader.md.tmpl
└── tests/                      ← Playwright 테스트 인프라
    ├── playwright.config.js
    ├── package.json
    ├── smoke-test-runner.js
    └── lib/
        └── ferp-helpers.js     ← FERP 프레임워크 테스트 헬퍼
```

### 화면유형별 스켈레톤 매핑

| 화면유형 | HTML | XML | Controller | Service |
|----------|------|-----|------------|---------|
| grid-only | grid-only.html | select-only.xml | - | - |
| search-grid-form | search-grid-form.html | standard-crud.xml | standard-controller.java | standard-service.java |
| form-detail | form-detail.html | standard-crud.xml | standard-controller.java | standard-service.java |
| popup-grid | popup.html | select-only.xml | - | - |

### paths.yml 주요 항목

| 키 | 설명 |
|----|------|
| `roots.SOURCE_ROOT` | FERP 운영 소스 루트 |
| `roots.REFERENCE_ROOT` | FERP 참고 소스 루트 |
| `deploy.*` | SOURCE_ROOT 하위 배포 경로 템플릿 |
| `review.*` | dual-spec 4개 파일 경로 |
| `build.input` | build 입력 파일 (`final/machine_spec.yml`) |
| `convention.*` | DB 스냅샷 캐시 파일 경로 |

---

## `policies/` — YML 기반 정책

모든 정책은 YML 형식으로 작성되며, 각 단계에서 자동으로 적용된다.

```
policies/
├── analyze/                    ← /analyze 단계 정책
│   ├── phase_rules.yml         ← 분석 단계 규칙
│   ├── classify_tags.yml       ← 13개 분류 태그 정의 (META, SEARCH, GRID 등)
│   ├── merge_priority.yml      ← 정보 병합 우선순위
│   ├── screen_type_rules.yml   ← 화면유형 분류 기준
│   ├── source_access.yml       ← 소스 접근 규칙
│   ├── ppt_extraction.yml      ← PPT 추출 규칙 (PE-001~PE-006)
│   ├── default_resolution.yml  ← 불확실 항목 기본 해결 규칙
│   ├── manual_handoff_rules.yml← 수동 전환 판단 기준
│   └── spec_required_fields.yml← spec 필수 필드 정의
├── framework/                  ← /build(generate) 단계 정책
│   ├── forbidden_apis.yml      ← 금지 API 20종 (FA-001~FA-020)
│   ├── button_mapping.yml      ← 버튼 슬롯 매핑 규칙
│   ├── template_selection.yml  ← 화면유형→스켈레톤 매핑
│   ├── skeleton_contract.yml   ← 스켈레톤 계약 조건
│   ├── layout_rules.yml        ← 레이아웃 배치 규칙
│   ├── html_patterns.yml       ← HTML 생성 패턴
│   ├── xml_patterns.yml        ← XML 생성 패턴
│   ├── controller_patterns.yml ← Controller 생성 패턴
│   ├── controller_generation.yml← CommonController 우선 원칙
│   ├── service_patterns.yml    ← Service 생성 패턴
│   └── code_component_defaults.yml ← 코드 컴포넌트 기본값
├── verify/                     ← generate self-check 정책
│   ├── html_checks.yml         ← HTML 검증 체크리스트
│   ├── xml_checks.yml          ← XML 검증 체크리스트
│   ├── sql_checks.yml          ← SQL 검증 체크리스트
│   ├── controller_checks.yml   ← Controller 검증 체크리스트
│   ├── service_checks.yml      ← Service 검증 체크리스트
│   └── escalation_rules.yml    ← 검증 실패 시 에스컬레이션 규칙
└── runtime/                    ← 런타임 격리 정책
    ├── allowed_paths.yml       ← 단계별 접근 허용/금지 경로
    ├── context_isolation.yml   ← 컨텍스트 격리 규칙
    ├── session_rules.yml       ← 세션 관리 규칙
    ├── lifecycle.yml           ← 산출물 생명주기 (active/working/archive)
    └── db_access.yml           ← DB 직접 접근 정책 (convention 보완용 lookup)
```

### 정책 적용 시점

| 시점 | 적용 정책 |
|------|----------|
| /analyze | `analyze/*.yml` |
| /build — generate (skeleton) | `framework/template_selection.yml`, `skeleton_contract.yml` |
| /build — generate (fill) | `framework/html_patterns.yml`, `xml_patterns.yml`, `controller_patterns.yml`, `service_patterns.yml` |
| /build — generate (self-check) | `verify/*.yml`, `framework/forbidden_apis.yml` |
| /build — deploy | `runtime/allowed_paths.yml` |
| 모든 명령 런타임 | `runtime/*.yml` |

### DB 직접 접근 정책 (db_access.yml)

convention 캐시로 확인 불가능한 정보(뷰, 트리거, 시퀀스, 실시간 코드값 등)는 모든 step에서 DB 직접 조회(SELECT only) 허용:

| 접근 등급 | 허용 step | 설명 |
|----------|----------|------|
| **sync** | analyze PHASE 1 | convention 캐시 전체 갱신 |
| **lookup** | analyze, build, test, fix | 실시간 소량 조회 (SELECT only) |

- convention Grep 선행 필수, 조회 사유 기록 필수
- INSERT/UPDATE/DELETE 절대 금지

### severity 규칙

| severity | 동작 |
|----------|------|
| `high` | 자동 적용 (백업 + 적용 + 로그) |
| `low` | 제안만 생성 (`proposals/policy_changes/new/`) |

### 산출물 생명주기 (lifecycle.yml)

모든 산출물은 아래 3개 상태 중 하나로 관리된다:

| 상태 | 설명 | 실행 입력 여부 |
|------|------|--------------|
| **active** | 현재 시스템이 실제 입력으로 사용하는 공식 산출물 | O |
| **working** | 작업 중 임시 생성물 (해당 단계 내에서만 참조) | 단계 내 한정 |
| **archive** | 보관/추적용 — 실행 입력 **절대 금지** | X |

cleanup 시점:
- **build 완료 후**: ppt_raw.json 등 working 중간물 정리
- **test 전체 PASS 후**: runtime/ → system/archive/ 이동
- **fix 완료 후**: fix runtime → system/archive/fixes/ 이동

archive 차단 방식:
- `allowed_paths.yml` forbidden_always에 `system/archive/**` 등록
- `context_isolation.yml` CI-006 규칙으로 접근 차단

---

## `schemas/` — JSON 검증 스키마

```
schemas/
├── manifest.schema.json        ← step manifest 구조 (step enum: analyze/build/test/fix)
├── policy.schema.json          ← 정책 YML 구조
├── review_resolved.schema.json ← 리뷰 해결 항목 구조
├── template_selection.schema.json ← 템플릿 선택 결과 구조
└── verify_result.schema.json   ← 검증 결과 구조
```

### manifest.schema.json 주요 필드

| 필드 | 설명 |
|------|------|
| `step` | `analyze` \| `build` \| `test` \| `fix` |
| `severity` | `high` \| `low` |
| `original_people_spec_path` | 원본 사람용 spec 경로 |
| `original_machine_spec_path` | 원본 기계용 spec 경로 |
| `final_people_spec_path` | 최종 사람용 spec 경로 |
| `final_machine_spec_path` | 최종 기계용 spec 경로 |

---

## `proposals/` — 정책 변경 제안

fix 과정에서 발생한 정책 개선 제안을 관리한다.

```
proposals/
└── policy_changes/
    ├── new/                    ← 미적용 제안 (low severity)
    ├── done/                   ← 적용 완료 (high severity 자동 적용 포함)
    ├── backups/                ← 정책 적용 전 백업
    └── example_policy_fix.yml  ← 제안 형식 예시
```

---

## `docs/` — 문서 및 템플릿

```
docs/
└── templates/
    ├── screen_spec_template.md ← people_spec.md 생성 템플릿 (11개 섹션)
    ├── screen_spec_guide.md    ← 기능정의서 작성 가이드
    └── examples/
        └── SEA010_spec.md      ← 기능정의서 작성 예시
```

### screen_spec_template.md 섹션 구성

| # | 섹션 | 태그 | 설명 |
|---|------|------|------|
| 1 | 화면 개요 | META | 화면ID, 프로그램명, 레이아웃 등 |
| 2 | 검색 영역 | SEARCH | 검색 필드 (row, gravity 포함) |
| 3 | 그리드 | GRID | 컬럼 정의, 이벤트 |
| 4 | 상세 폼 | FORM | 폼 필드, 동적 전환 |
| 5 | 버튼 | BUTTON | 표준/커스텀 버튼 |
| 6 | 알림/메시지 | VALID | confirm, alert, toast |
| 7 | 상태별 제어 | EVENT | 조건부 UI 변경 |
| 8 | 화면 이동 | NAV | 서브화면 이동, 팝업 호출 |
| 9 | 첨부파일 | - | [선택] |
| 10 | 팝업/모달 | - | [선택] |
| 11 | 특이사항 | - | 업무 규칙 |

---

## 참조 우선순위

```
1순위: system/cache/convention/   ← DDL, 코드 (Grep only, 유일한 진실)
2순위: policies/*.yml             ← 프레임워크 정책 (기계 판독 규칙)
3순위: system/templates/          ← 스켈레톤 템플릿 (화면유형별 골격)
4순위: REFERENCE_ROOT             ← FERP 참고 소스 (패턴 검증)
5순위: SOURCE_ROOT                ← 운영 소스 (실제 배포 상태)
최하위: 에이전트 자체 판단         ← 위 참조에 없는 경우에만
```

---

## 컨텍스트 격리

```
task (작업 단위)
 └── screen (화면 단위)
      └── step (처리 단계: analyze / build / test / fix)
```

- task 간 데이터 참조 금지
- screen 간 데이터 참조 금지 (동일 task 내에서도)
- 정책(`policies/`)과 템플릿(`templates/`)은 전역 공유
- manifest가 각 명령의 접근 범위를 제한
