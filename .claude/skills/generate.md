# generate — HTML/XML/SQL/Java 생성 + 통합 검증

## 호출원
`/build`, `/fix`

## 목적
final/machine_spec.yml을 기반으로 FERP 프레임워크 표준에 맞는 HTML, XML, SQL, Controller, Service 코드를 생성한다.
반드시 skeleton 기반으로 생성하며, 자유 생성은 금지한다.
v5에서는 별도 verify 단계가 제거되고, 생성 흐름 내 **Integrated Verify** 단계에서 모든 정적 검증을 수행한다.

## 경로
모든 경로는 `system/config/paths.yml` 참조.

## 실행 원칙
- **Stateless**: manifest 기반 입출력만 허용. 다른 screen/task 컨텍스트 참조 금지.
- **Skeleton 강제**: system/templates/skeletons/ 기본 골격에서 시작. 자유 생성 금지.
- **정책 검증**: policies/framework/*.yml 전수 적용. 금지 API 자동 교정.
- **참고 소스 검증 필수**: 불확실한 패턴은 REFERENCE_ROOT에서 Grep으로 실사용례 확인.
- **통합 검증**: 생성 완료 후 policies/verify/*.yml 체크리스트를 인라인으로 적용. 별도 verify 단계 없음.

## 생성 흐름

```
1. Screen Type Classify  — final/machine_spec.yml에서 screen_type 확인
2. Template Select        — screen-types/*.yml에서 skeleton 매핑
3. Skeleton Generate      — skeletons/{계층}/ 기본 골격 생성
4. Implementation Fill    — skeleton의 TODO/placeholder를 명세 기반으로 구현 채움
5. Policy Validate        — policies/framework/*.yml로 금지 API, 필수 패턴 검증
6. Self-diagnosis         — DDL 미존재 컬럼, 코드 미등록 등 자기진단
7. Integrated Verify      — policies/verify/*.yml 전체 체크 인라인 수행
   - 자동 수정 가능 항목 → 즉시 수정 후 재검증
   - 결과를 generation_log.md에 기록
   - Critical 실패 → 생성 차단 (status: failed)
```

## 입력
- `user/review/tasks/{taskId}/final/machine_spec.yml`
- `system/templates/skeletons/` (계층별 skeleton)
- `system/templates/screen-types/` (화면유형 정의)
- `policies/framework/` (생성 정책)
- `policies/verify/` (검증 정책 — Integrated Verify용)
- `system/cache/convention/` (DDL/코드, Grep 전용)
- REFERENCE_ROOT (패턴 검증용)

## 출력
- `system/runtime/tasks/{taskId}/screens/{screenId}/outputs/`
  - {screenId}.html
  - {screenId소문자}.xml
  - sql/{screenId}_메뉴등록.sql
  - sql/ (기타 DDL보완, 코드등록 등)
  - {screenId}Controller.java (해당 시)
  - {screenId}Service.java (해당 시)
  - generation_log.md
- `system/runtime/tasks/{taskId}/screens/{screenId}/generate.manifest.yaml`

## 산출물 유형 (화면유형별)

| 화면유형 | HTML | XML | SQL | Controller | Service |
|----------|------|-----|-----|------------|---------|
| grid-only | O | O (select-only) | O | X | X |
| search-grid-form | O | O (standard-crud) | O | 조건부 | 조건부 |
| form-detail | O | O (standard-crud) | O | 조건부 | 조건부 |
| popup-grid | O | O (select-only) | O | X | X |

### CommonController 우선 원칙 (policies/framework/controller_generation.yml 필수 준수)

**기본적으로 CommonController/CommonService를 사용한다.** 커스텀 Controller/Service는 생성하지 않는 것이 기본이다.

HTML에서는 `platform.url.select`, `platform.url.save`, `platform.url.saveAll` 등 Common 엔드포인트를 호출하고,
`statement` 파라미터로 XML mapper의 namespace.statementId를 지정하여 쿼리를 실행한다.

#### 커스텀 Controller/Service가 필요한 경우 (CG-002)
아래 조건 중 하나 이상 해당 시에만 커스텀 생성:
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
- 다건 저장 (saveAll — Param 객체로 복수 statement 전달)
- 코드헬프 조회
- 상태 체크 후 저장/삭제 차단 (HTML에서 처리)

#### HTML Common 엔드포인트 호출 패턴
```javascript
// 목록 조회
let param = listener.form.searchForm.getData();
param.statement = "namespace.selectList";
platform.post(platform.url.select, param, callback);

// 단건 조회
let param = { wrk_mast_id: pkValue };
param.statement = "namespace.selectInfo";
platform.post(platform.url.select, param, callback);

// 단건 저장 (INSERT/UPDATE)
let param = listener.form.postForm.getData();
param.statement = "namespace.insertXxx";  // 또는 updateXxx
platform.post(platform.url.save, param, callback);

// 다건 저장 (saveAll — 그리드 데이터)
const param = new Param();
param.add('namespace.deleteOldList', { wrk_mast_id: masterId });
param.add('namespace.insertNewList', gridDataList);
platform.post(platform.url.saveAll, param.data, callback);

// 단건 삭제
let param = { wrk_mast_id: pkValue };
param.statement = "namespace.deleteXxx";
platform.post(platform.url.save, param, callback);
```

## generate.manifest.yaml 구조

```yaml
screen_id: {screenId}
phase: generate
status: complete | partial | failed
template_used: grid-only
skeleton_files:
  html: skeletons/html/grid-only.html
  xml: skeletons/xml/select-only.xml
  controller: null  # 또는 skeletons/controller/standard-controller.java
  service: null      # 또는 skeletons/service/standard-service.java
generated_files:
  - outputs/{screenId}.html
  - outputs/{screenId소문자}.xml
  - outputs/sql/{screenId}_메뉴등록.sql
policy_violations_fixed:
  - rule: forbidden_api.platform_openPgm
    found_in: line 45
    fixed_to: APP_PGM.openPgm
self_diagnosis:
  ddl_missing_columns: []
  unregistered_codes: []
  pattern_warnings: []
verify_results:
  total_checks: 60
  passed: 58
  failed: 0
  warnings: 2
  auto_fixed: 1
  critical_pass: true
  manual_required: false
  details:
    html_checks:
      passed: []
      failed: []
      warnings: []
      auto_fixed: []
    xml_checks:
      passed: []
      failed: []
      warnings: []
      auto_fixed: []
    sql_checks:
      passed: []
      failed: []
      warnings: []
      auto_fixed: []
    controller_checks:
      passed: []
      failed: []
      warnings: []
      auto_fixed: []
    service_checks:
      passed: []
      failed: []
      warnings: []
      auto_fixed: []
```

## HTML 레이아웃 규칙 (policies/framework/layout_rules.yml 필수 준수)

### 1. 폼 필드 5칸 배치 (LR-001)
검색폼/상세폼의 cols 배열은 항상 gravity 합계가 5가 되도록 구성한다.
```javascript
// 기본 5칸
cols: [{ view: DATA_VIEW.text, ... }, { view: DATA_VIEW.codeNone, ... }, { ... }, { ... }, { ... }]

// 3칸만 사용 시 → 빈 객체로 채움
cols: [{ view: DATA_VIEW.text, ... }, { view: DATA_VIEW.codeNone, ... }, { view: DATA_VIEW.date, ... }, {}, {}]

// gravity:2 사용 시 → 2+1+1+1 = 5
cols: [{ view: DATA_VIEW.textarea, gravity: 2, ... }, { view: DATA_VIEW.text, ... }, { view: DATA_VIEW.codeNone, ... }, {}]
```

### 2. 레이아웃 CSS 클래스 (LR-002)
```html
<!-- 단일 영역 (그리드만, 폼만) -->
<div class="data-content-fill">...</div>

<!-- 좌우 분할 (메인 + 보조) — data-content-fill 필수, data-content-half-right 사용 금지 -->
<div class="data-content-wrapper">
    <div class="data-content-fill">...</div>          <!-- 가장 넓은 메인 영역 -->
    <div class="data-content-half-left">...</div>      <!-- 보조 영역 -->
</div>

<!-- 금지: data-content-half (존재하지 않는 클래스), data-content-half-right (사용 금지) -->
```

### 3. 그리드 div에 data-grid 클래스 필수 (LR-003)
```html
<!-- 올바름 -->
<div class="data-grid" th:id="|${PGM}grid1|"></div>

<!-- 잘못됨 -->
<div th:id="|${PGM}grid1|"></div>
```

### 4. 편집 그리드 초기 빈 행 (LR-004)
editable:true 그리드가 있으면 initPgm 끝에서 addRow 호출:
```javascript
listener.initPgm = () => {
    createSearchForm();
    createToolbarsAndGrids();
    createPostForm();
    listener.gridRow.addRow(); // 편집 그리드 초기 빈 행
};
```

### 5. data-content-wrapper 필수 구조 (LR-005)
data-page 안에 반드시 data-content-wrapper를 포함해야 한다:
```html
<!-- 올바름 -->
<div class="data-page">
    <div class="data-content-wrapper">
        <div class="data-content-fill">...</div>
    </div>
</div>

<!-- 잘못됨 — wrapper 생략 금지 -->
<div class="data-page">
    <div class="data-content-fill">...</div>
</div>
```

### 6. 그리드 코드헬프 컬럼 (LR-006)
그리드 컬럼이 코드헬프(돋보기 검색)를 사용하는 경우:
- editor: `GRID_VIEW.code` (NOT GRID_VIEW.text)
- type: `DATA_CODE_TYPE.{코드유형}` (예: user, dept, code, style 등)
- targetCols: 선택 시 자동입력할 컬럼 매핑
```javascript
{ id: 'user_id', header: '성명', editor: GRID_VIEW.code,
  type: DATA_CODE_TYPE.user, width: 150,
  targetCols: { dept_nm: 'dept_nm', jbps_nm: 'jbps_nm', jbttl_nm: 'jbttl_nm' } }
```
프레임워크가 자동으로 코드헬프 팝업과 targetCols 자동입력을 처리한다.

## Skeleton Contract

### HTML Skeleton
```
IIFE 래퍼
├── const PGM = /*[[${PGM}]]*/ null;
├── const listener = platform.listener[PGM];
├── 전역 상태 변수
├── resetState()
├── createSearchForm()
├── createToolbarsAndGrids()
├── createPostForm()          (search-grid-form, form-detail)
├── Event Handlers
├── Data Operations
└── Assign Handlers (항상 마지막)
```

### XML Skeleton
```
<mapper namespace="{screenid}">
├── <select id="select{Subject}List" resultType="java.util.Map">
├── <select id="select{Subject}Info" resultType="java.util.Map">
├── <insert id="insert{Subject}">  — 감사컬럼(firs_reg_*) 포함
├── <update id="update{Subject}">  — 감사컬럼(fina_reg_*) 포함
└── <delete id="delete{Subject}">
```

### Controller Skeleton (search-grid-form, form-detail)
```
@Slf4j @Controller @RequestMapping("/{screenid}")
├── 생성자 주입 (Service)
├── select()    — @LogAction @AddUserInfo @ResponseBody
├── selectInfo()
├── save()
└── delete()
```

### Service Skeleton (search-grid-form, form-detail)
```
@Slf4j @Service extends BaseService
├── 생성자 주입 (ferpWriterSqlSessionTemplate, ferpReaderSqlSessionTemplate)
├── selectList()  — @Transactional(reader, readOnly)
├── selectInfo()  — @Transactional(reader, readOnly)
├── save()        — @Transactional(txManagerFerpWriter)
└── delete()      — @Transactional(txManagerFerpWriter)
```

## 금지 API (policies/framework/forbidden_apis.yml)

| 금지 | 올바른 대체 |
|------|------------|
| `platform.openPgm(...)` | `APP_PGM.openPgm(모듈ID, 화면ID, param)` |
| `APP_PGM.getOpenParam(PGM)` | `activePgm(param, isNew)` 첫 번째 인자로 수신 |
| `platform.closePgm(...)` | `APP_PGM.closePgm(pgmId)` |
| `grid.getCheckedItems()` | `grid.getCheckedData()` |
| `form.formEnable()` | `form.formReadonly(false)` |
| `form.formDisable()` | `form.formReadonly(true)` |
| `platform.msg(...)` | `popup.alert.show(message, callback?)` |
| `platform.confirm(...)` | `popup.confirm.show(message, callback)` |
| `APP_CODE.load(...)` | elements 내 type: DATA_CODE_TYPE.code + param 선언 |
| `listener.button.etc_desc{N}.click` | `listener.button.etc{N}.click` |
| `resultType="map"` (XML) | `resultType="java.util.Map"` |
| `now()` (XML) | `current_timestamp` |
| `_dtm` 접미사 (XML) | `_dts` 접미사 |
| namespace 대문자 (XML) | namespace 소문자 |
| `comp_cd` / `brndz_cd` (XML) | 사용 금지 (TOBE 삭제 컬럼) |

## 코드콤보 생성 규칙

```javascript
// 기본 코드콤보 (특별한 지시 없을 때 기본값)
{ view: DATA_VIEW.codeNone, type: DATA_CODE_TYPE.codeValue,
  label: "코드명", name: "P_field_cd",
  param: { wrk_tp_cd: 'XX', cd_tp_cd: 'YYY' } }

// 명시적 요청 시에만 사용
// { view: DATA_VIEW.code, type: DATA_CODE_TYPE.code, ... }

// 코드콤보 연관 (부모 → 자식)
{ ..., name: 'parent_cd', depElement: ['child_cd'] }
{ ..., name: 'child_cd', refElement: [{ name: 'parent_cd', field: 'rel_comm_cd' }] }
```

### 코드 헬프 검색 원칙
- 사용자는 코드ID/PK를 알 필요 없음
- 화면에서 코드성 컴포넌트에 값을 입력하여 검색할 때 코드명(명칭) 기반으로 검색 가능해야 함

## PostgreSQL 금지 패턴 (XML SQL 작성 시 필수 준수)

DB는 PostgreSQL이다. 아래 패턴은 PostgreSQL에서 문법 오류를 발생시키므로 절대 사용 금지:

| 금지 패턴 | 오류 | 올바른 대체 |
|-----------|------|------------|
| `STRING_AGG(... COUNT(*) OVER(...) ...)` | 집계함수 내 윈도우함수 금지 | 서브쿼리에서 GROUP BY로 먼저 집계 후 외부에서 STRING_AGG |
| `SUM(COUNT(...))` | 집계함수 내 집계함수 중첩 금지 | 서브쿼리에서 COUNT 후 외부에서 SUM |
| `STRING_AGG(DISTINCT (SELECT ...))` | STRING_AGG 내 서브쿼리 + DISTINCT 조합 | 서브쿼리를 JOIN으로 풀거나, 내부 서브쿼리에서 DISTINCT 처리 후 외부에서 STRING_AGG |

### 올바른 집계 패턴 예시

```sql
/* X 금지: 집계함수 내 윈도우함수 */
SELECT STRING_AGG(name || '(' || COUNT(*) OVER(PARTITION BY type) || ')', ', ')
FROM ...

/* O 올바름: 서브쿼리에서 GROUP BY 후 STRING_AGG */
SELECT STRING_AGG(sub.name || '(' || sub.cnt || ')', ', ')
FROM (
    SELECT type, name, COUNT(*) AS cnt
    FROM ...
    GROUP BY type, name
) sub

/* X 금지: STRING_AGG 내 상관 서브쿼리 + DISTINCT */
SELECT STRING_AGG(DISTINCT (SELECT user_nm FROM users WHERE user_id = t.id), ', ')
FROM ...

/* O 올바름: JOIN 후 STRING_AGG */
SELECT STRING_AGG(DISTINCT u.user_nm, ', ')
FROM ... t
LEFT JOIN users u ON u.user_id = t.id
```

## SQL 생성 규칙

| SQL 종류 | 파일명 | 생성 조건 |
|----------|--------|-----------|
| 메뉴등록 | {screenId}_메뉴등록.sql | 모든 화면 |
| DDL 보완 | {screenId}_DDL보완.sql | DDL에 누락 컬럼 시 |
| 코드 등록 | {screenId}_코드등록.sql | 코드 미등록 시 |

### 코드 등록 SQL 생성 규칙 (PP-20260404-001)

1. **comm_cd는 순수 코드값만 사용**
   - 올바름: `comm_cd = '010'`, `'020'`, `'030'`
   - 잘못됨: `comm_cd = 'RP080010'` (wrk_tp_cd+cd_tp_cd 접두사 결합 금지)

2. **신규 코드그룹 등록 전 기존 존재 여부 확인 필수**
   - convention `코드_업무구분.txt`를 Grep하여 해당 wrk_tp_cd+cd_tp_cd가 이미 존재하는지 확인
   - 이미 존재하는 cd_tp_cd에 다른 용도로 등록 **절대 금지** (기존 코드 데이터 파괴)
   - 미사용 cd_tp_cd 번호를 찾아 할당해야 함

## 자기진단 (생성 완료 후 필수)

1. DDL에 없는 컬럼 사용 → DDL보완 SQL 제안
2. 코드_상세.txt에 없는 코드 → 코드등록 SQL 제안
3. [작업자 확인 필요] 항목 미해결 → 주석 처리 후 경고
4. 금지 API 잔존 여부 재확인
5. skeleton 구조 준수 여부 확인

## Integrated Verify (policies/verify/*.yml 전체 인라인 적용)

생성 흐름 7단계에서 수행. 별도 verify 스킬 호출 없이 generate 내에서 완결한다.
정책 기반으로 기계적 적용. 주관적 판단 금지.
자동 수정 우선: 정책으로 명확히 교정 가능한 오류는 자동 수정 후 재검증.
자동 수정 불가한 오류는 manual_required로 에스컬레이션.

### 1. HTML 검증 (policies/verify/html_checks.yml)

#### Critical (미통과 시 생성 실패 처리)
- IIFE 패턴: `(() => { ... })()`
- PGM 변수: `const PGM = /*[[${PGM}]]*/ null;`
- listener 초기화: `const listener = platform.listener[PGM];`
- initPgm / activePgm 존재
- 금지 API 미사용
- 올바른 API 사용 (APP_PGM.openPgm, popup.alert.show 등)
- 버튼 매핑 정확성
- etc 리스너: `listener.button.etc{N}.click`
- webix.ui 기반 폼/그리드
- Fragment: `th:block th:replace`
- 동적 ID: `th:id="|${PGM}...|"`
- DATA_VIEW 상수만 사용
- 코드콤보: elements 내 직접 선언
- editor.change: `el.config.name` 사용
- 서브화면 이동: `gridRow.dblclick` 사용
- 결과 0건 실패 처리

#### Warning
- resetState() 존재
- CSS 정렬 규칙
- 코드콤보 refElement 자기참조 금지

### 2. XML 검증 (policies/verify/xml_checks.yml)

#### Critical
- namespace 소문자
- `resultType="java.util.Map"`
- comp_cd / brndz_cd 미사용
- INSERT 감사컬럼 4개 (firs_reg_*)
- UPDATE 감사컬럼 4개 (fina_reg_*)
- `current_timestamp` 사용
- `_dts` 접미사
- DDL 컬럼 전수 일치
- SELECT 코드명 서브쿼리
- COALESCE 인자 타입 통일

#### Warning
- NULLIF 패턴
- 파라미터 접두사 규칙

### 3. SQL 검증 (policies/verify/sql_checks.yml)

#### Critical
- 메뉴등록 SQL 존재
- sy_pgm_info 컬럼 DDL 일치
- pgm_path 형식 규칙
- 서브화면 sy_menu_info 미등록
- 감사컬럼 8개
- execution_order.md 존재

### 4. Controller 검증 (policies/verify/controller_checks.yml)

#### Critical (Controller 생성 화면만)
- `@Slf4j @Controller` 어노테이션
- 생성자 주입 (Service)
- 메서드 어노테이션: `@AddUserInfo @LogAction @ResponseBody @RequestMapping`
- `BaseResponse` 반환
- try-catch + `log.error` + `BaseResponse.Error`

### 5. Service 검증 (policies/verify/service_checks.yml)

#### Critical (Service 생성 화면만)
- `extends BaseService`
- reader/writer SqlSessionTemplate 주입
- 읽기 메서드 → reader 사용
- 쓰기 메서드 → writer + `@Transactional(value='txManagerFerpWriter')`
- namespace.statementId 소문자

### Integrated Verify 오류 처리 흐름

```
오류 발견
  ├── severity: critical
  │   ├── 자동 수정 가능 → 수정 → 재검증
  │   └── 자동 수정 불가 → manual_required: true → status: failed
  └── severity: warning
      ├── 자동 수정 가능 → 수정
      └── 자동 수정 불가 → warning 기록
```

### 자동 수정 가능 유형
- 금지 API → 올바른 API 치환
- resultType="map" → "java.util.Map"
- now() → current_timestamp
- _dtm → _dts
- namespace 대문자 → 소문자
- etc_desc{N}.click → etc{N}.click

### 생성 완료 조건
- verify_results.critical_pass: true
- verify_results.manual_required: false
- 미충족 시 status: failed, generation_log.md에 사유 기록

## DB lookup (policies/runtime/db_access.yml)
generate 수행 중 convention Grep으로 확인 불가능한 정보는 DB 직접 조회(SELECT only) 허용:
- 뷰(VIEW) 정의 확인 → 뷰 기반 SELECT 쿼리 생성
- 시퀀스 존재/현재값 확인
- 인덱스 구조 확인 (쿼리 최적화)
- 실제 코드값 형식 확인 (convention 캐시와 불일치 시)
- convention Grep 선행 필수, 조회 사유를 generation_log.md에 기록

## 금지사항
- skeleton 없이 직접 코드 생성 금지
- 금지 API 사용 금지
- DDL에 없는 컬럼 사용 금지
- 순수 HTML/CSS/JS 생성 금지
- convention 전체 Read 금지
- 다른 screen의 outputs 참조 금지 (Stateless)
- 정책에 정의되지 않은 주관적 기준으로 검증 판단 금지
