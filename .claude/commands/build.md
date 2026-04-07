# /build {taskId} — Generate + Deploy 일괄 빌드

**인자**: $ARGUMENTS (taskId)

## 목적
analyze 완료 + 사용자 검토 완료 상태에서 pre-build diff → generate → deploy를 순차 실행하여
FERP 단위화면(HTML, XML, SQL, Controller, Service)을 일괄 생성 및 배포한다.
v4의 verify 단계는 generate의 self-check phase에 통합되어 별도 실행하지 않는다.

## 경로
모든 경로는 `system/config/paths.yml` 참조.
PROJECT_ROOT = C:/auto_gdi_work_v5

## 실행 원칙
- **Stateless**: 각 skill은 독립 실행. skill 간 직접 데이터 전달 금지. manifest를 통해서만 연결.
- **Manifest 기반**: 각 skill의 manifest가 이전 단계 완료를 확인한 후 다음 단계 진행.
- **정책 기반**: 각 단계별 policies/ 하위 정책 자동 적용.
- **Skeleton 강제**: 코드 생성 시 반드시 skeleton 기반. 자유 생성 금지.

## 전제조건
- `/analyze {taskId}` 완료 (system/runtime/tasks/{taskId}/manifest.yaml status: `analyzed`)
- 사용자가 `final/people_spec.md` 검토/수정 완료

## 실행 순서

```
0. pre-build  — original/people_spec.md vs final/people_spec.md diff → final/machine_spec.yml 생성
       ↓
1. generate   — final/machine_spec.yml + skeleton → HTML/XML/SQL/Java 생성 + 정적 검증(self-check)
       ↓ (generate.manifest.yaml 생성)
2. deploy     — generate 완료 시 SOURCE_ROOT 배포 + deliverables 복사
       ↓ (deploy.manifest.yaml 생성)
```

각 단계는 이전 단계의 manifest status가 complete일 때만 진행한다.

---

## STEP 0: Pre-build diff 반영

build 시작 전에 아래 절차를 수행한다:

1. `original/people_spec.md`와 `final/people_spec.md` diff 수행
2. 변경/추가 내용 추출
3. `original/machine_spec.yml`에 반영
4. `final/machine_spec.yml` 생성

**삭제는 자동 반영하지 않는다.** 명시적 삭제 표기 규칙이 있을 때만 반영 가능하다.

최종적으로 build에서 사용하는 파일은 `final/machine_spec.yml` 하나로 고정한다.

---

## STEP 1: Generate (`.claude/skills/generate.md`)

### 생성 흐름

```
1. Screen Type Classify  — final/machine_spec.yml에서 screen_type 확인
2. Template Select        — screen-types/*.yml에서 skeleton 매핑
3. Skeleton Generate      — skeletons/{계층}/ 기본 골격 생성
4. Implementation Fill    — skeleton의 TODO/placeholder를 명세 기반으로 구현 채움
5. Policy Validate        — policies/framework/*.yml로 금지 API, 필수 패턴 검증
6. Self-check             — v4 verify 로직 통합 (아래 상세)
7. Self-diagnosis         — DDL 미존재 컬럼, 코드 미등록 등 자기진단
```

### Self-check (v4 verify 통합)

generate 완료 후, 별도 verify 단계 없이 생성 코드를 즉시 검증한다.
검증 정책은 `policies/verify/*.yml`을 그대로 적용한다.

#### Critical 검증 (미통과 시 자동 수정 → 재검증 → 실패 시 deploy 차단)

**HTML** (policies/verify/html_checks.yml):
- IIFE 패턴, PGM 변수, listener 초기화
- initPgm / activePgm 존재
- 금지 API 미사용 + 올바른 API 사용
- 버튼 매핑, etc 리스너, webix.ui, Fragment, 동적 ID
- DATA_VIEW 상수, 코드콤보 선언, editor.change, 서브화면 이동
- 결과 0건 실패 처리

**XML** (policies/verify/xml_checks.yml):
- namespace 소문자, resultType="java.util.Map"
- comp_cd/brndz_cd 미사용, 감사컬럼, current_timestamp, _dts 접미사
- DDL 컬럼 전수 일치, SELECT 코드명 서브쿼리, COALESCE 타입 통일

**SQL** (policies/verify/sql_checks.yml):
- 메뉴등록 SQL 존재, sy_pgm_info DDL 일치, pgm_path 형식
- 서브화면 sy_menu_info 미등록, 감사컬럼 8개, execution_order.md

**Controller/Service** (해당 시):
- 어노테이션, 생성자 주입, BaseResponse, try-catch, extends BaseService
- reader/writer 분리, @Transactional, namespace 소문자

#### 자동 수정 가능 유형
- 금지 API → 올바른 API 치환
- resultType="map" → "java.util.Map"
- now() → current_timestamp
- _dtm → _dts
- namespace 대문자 → 소문자
- etc_desc{N}.click → etc{N}.click

#### Warning 검증
- resetState() 존재, CSS 정렬, NULLIF 패턴, 파라미터 접두사 등

### CommonController 우선 원칙 (policies/framework/controller_generation.yml)

**기본적으로 CommonController/CommonService를 사용한다.** 커스텀 Controller/Service는 생성하지 않는 것이 기본이다.

HTML에서는 `platform.url.select`, `platform.url.save`, `platform.url.saveAll` 등 Common 엔드포인트를 호출하고,
`statement` 파라미터로 XML mapper의 namespace.statementId를 지정하여 쿼리를 실행한다.

#### 커스텀 Controller/Service가 필요한 경우 (CG-002)
1. 암호화/복호화 처리
2. 복잡한 비즈니스 로직 (조건부 분기 INSERT/UPDATE, 계산 로직)
3. 외부 API 연동
4. CommonController 파일 기능으로 불충분한 파일 처리
5. 프로시저 호출 후 추가 가공
6. saveAll로 불가능한 다중 테이블 조건부 트랜잭션
7. 기능정의서에 명시적으로 "커스텀 로직 필요"로 태깅된 경우

#### CommonController로 충분한 경우 (CG-003) — 커스텀 생성 금지
- 단순 SELECT (단건/다건/페이징)
- 단순 INSERT/UPDATE/DELETE
- 다건 저장 (saveAll)
- 코드헬프 조회
- 상태 체크 후 저장/삭제 차단 (HTML에서 처리)

### 산출물 유형 (화면유형별)

| 화면유형 | HTML | XML | SQL | Controller | Service |
|----------|------|-----|-----|------------|---------|
| grid-only | O | O (select-only) | O | X | X |
| search-grid-form | O | O (standard-crud) | O | 조건부 | 조건부 |
| form-detail | O | O (standard-crud) | O | 조건부 | 조건부 |
| popup-grid | O | O (select-only) | O | X | X |

---

## STEP 2: Deploy (`.claude/skills/deploy.md`)

### 전제조건
- generate.manifest.yaml status: complete
- self-check critical_pass: true

### 배포 경로 매핑

| 구분 | 원본 (runtime) | 대상 (SOURCE_ROOT) |
|------|---------------|-------------------|
| HTML | outputs/{ScreenId}.html | src/main/resources/templates/project/{module}/{category}/{ScreenId}.html |
| XML | outputs/{screenid}.xml | src/main/resources/mapper/sjerp/{module}/{category}/{screenid}.xml |
| Controller | outputs/{ScreenId}Controller.java | src/main/java/com/sjinc/sjerp/proj/{module}/{category}/{screenid}/{ScreenId}Controller.java |
| Service | outputs/{ScreenId}Service.java | src/main/java/com/sjinc/sjerp/proj/{module}/{category}/{screenid}/{ScreenId}Service.java |

### 절차
1. 배포 대상 경로 생성 (final/machine_spec.yml에서 module_id, category_id 추출)
2. 기존 파일 존재 시 backups/에 타임스탬프 포함 백업
3. HTML/XML/Controller/Service 파일 복사
4. `user/output/tasks/{taskId}/deliverables/{screenId}/`에 사본 복사
5. SQL 파일은 deliverables에만 (자동 실행 금지)
6. deploy.manifest.yaml 생성

---

## 입력
- `system/runtime/tasks/{taskId}/manifest.yaml`
- `system/runtime/tasks/{taskId}/screens/{screenId}/analyze.manifest.yaml`
- `user/review/tasks/{taskId}/original/people_spec.md`
- `user/review/tasks/{taskId}/original/machine_spec.yml`
- `user/review/tasks/{taskId}/final/people_spec.md`

## 출력

### 사용자용
- `user/output/tasks/{taskId}/report.md` — 빌드 결과 종합 보고서
- `user/output/tasks/{taskId}/deliverables/{screenId}/` — 최종 산출물 사본
  - {ScreenId}.html
  - {screenid}.xml
  - sql/*.sql
  - {ScreenId}Controller.java (해당 시)
  - {ScreenId}Service.java (해당 시)

### 시스템 내부
- `user/review/tasks/{taskId}/final/machine_spec.yml` — pre-build diff 결과
- `system/runtime/tasks/{taskId}/screens/{screenId}/generate.manifest.yaml`
- `system/runtime/tasks/{taskId}/screens/{screenId}/deploy.manifest.yaml`

## 자동화 적합성 판단

build 시작 전 각 화면에 대해 자동화 적합성을 판단한다:

```yaml
auto_eligible: true/false
criteria:
  template_match_confidence: 0.0 ~ 1.0
  unresolved_count: 0
  convention_coverage: 0.0 ~ 1.0
```

- template_match_confidence < 0.5 → manual_required: true
- unresolved_count > 3 → manual_required: true
- 수작업 전환 대상은 report.md에 사유와 함께 명시

## 화면별 독립 실행
- 화면 A 실패가 화면 B 빌드를 중단시키지 않음
- 각 화면의 결과는 개별 manifest에 기록
- report.md에 전체 화면의 성공/실패 요약

## STEP 3: Cleanup (policies/runtime/lifecycle.yml 참조)

build 완료 후 아래 working 산출물을 정리한다:

1. **삭제 가능**: `system/runtime/tasks/{taskId}/ppt_raw.json`, `extract_ppt.py` (analyze 중간물)
2. **archive 이동**: `generation_log.md` (로그성 → archive 가능, 또는 삭제)
3. **유지**: manifest, outputs, deploy.manifest 등 active 산출물

cleanup은 build 성공 시에만 수행한다. 실패 시 디버깅을 위해 working 유지.

## 완료 후 안내
```
빌드 완료. user/output/tasks/{taskId}/report.md를 확인하세요.
→ 기능 테스트: /test {taskId}
→ 문제 발견 시: /fix {fixId} {taskId}
```

## DB lookup (policies/runtime/db_access.yml)
build 수행 중 convention Grep으로 확인 불가능한 정보는 DB 직접 조회(SELECT only) 허용:
- 뷰(VIEW) 정의 확인 → SELECT 쿼리 기반 코드 생성
- 실제 데이터 패턴 확인 (코드값 형식, NULL 비율 등)
- 시퀀스 존재/현재값, 인덱스 구조 확인
- convention Grep 선행 필수, 조회 사유 기록

## 금지사항
- analyze 미완료 상태에서 실행 금지
- skill 간 직접 데이터 전달 금지 (manifest 경유 필수)
- 다른 task의 runtime 참조 금지
- skeleton 없이 직접 코드 생성 금지
- 금지 API 사용 금지
- DDL에 없는 컬럼 사용 금지
- convention 전체 Read 금지 (Grep만 허용)
- self-check critical 미통과 상태로 deploy 진행 금지
- 기존 파일 백업 없이 덮어쓰기 금지
- SQL 파일 자동 실행 금지
