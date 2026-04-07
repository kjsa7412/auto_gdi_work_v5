# /test {taskId} [screenId] — Playwright 기능 테스트 + fix.md 자동 생성

**인자**: $ARGUMENTS (taskId [screenId])

## 목적
배포된 화면의 **구현된 비즈니스 기능**을 Playwright로 테스트한다.
테스트 실패 시 fix.md를 자동 생성하여 `/fix` 명령으로 즉시 수정 가능하게 한다.
test는 파이프라인과 독립적으로 언제든 실행 가능하다.

## 경로
모든 경로는 `system/config/paths.yml` 참조.
PROJECT_ROOT = C:/auto_gdi_work_v5

## 실행 원칙
- **파괴적 테스트**: 저장, 삭제, 상태변경 등 데이터 변경 기능을 실제 실행
- **구현 기능 위주**: `final/machine_spec.yml`에 정의된 버튼/이벤트/검증만 테스트
- **참고 문서**: 사람이 읽는 기준 문서로 `final/people_spec.md`를 참고할 수 있으나, 테스트 판정 기준은 `final/machine_spec.yml`
- **제외 대상**: favorite, info 버튼 (공통 프레임워크)
- **배포 완료 필수**: SOURCE_ROOT에 배포되어 있어야 함
- **서버 구동 필수**: localhost:8080 실행 중이어야 함
- **독립 실행**: analyze/build 파이프라인과 별개로 언제든 실행 가능

## 사용법
```
/test task002           — task002의 모든 화면 테스트
/test task002 SEA010    — SEA010 화면만 테스트
```

## 입력
- `system/runtime/tasks/{taskId}/manifest.yaml` — 화면 목록
- `user/review/tasks/{taskId}/final/machine_spec.yml` — 기능 정의 (테스트 기준)
- `user/review/tasks/{taskId}/final/people_spec.md` — 참고 문서 (보조)
- `system/runtime/tasks/{taskId}/screens/{screenId}/analyze.manifest.yaml` — 화면 유형

## 출력
- `user/test/tasks/{taskId}/{screenId}_test.md` — 화면별 테스트 결과
- `user/test/tasks/{taskId}/summary.md` — 전체 요약
- `user/inbox/fixes/{fixId}/fix.md` — 실패 시 자동 생성 (STEP 3)
- `user/test/tasks/{taskId}/fix_plan.md` — fix 계획 (실패 시)

## 테스트 제외 항목
- favorite, info 버튼 (공통)
- IIFE/PGM/listener 등 프레임워크 구조 (generate self-check 영역)

---

## 절차

### STEP 1: 준비
1. manifest.yaml에서 대상 화면 목록 결정
2. 각 화면의 `final/machine_spec.yml` 로드 → 테스트 시나리오 결정
3. 서버 구동 확인 (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8080`)
4. `user/test/tasks/{taskId}/` 폴더 생성

### STEP 2: 화면별 테스트 실행

#### grid-only 시나리오

| ID | 시나리오 | 판정 기준 |
|----|---------|----------|
| G01 | 화면진입 + JS에러 | 탭 존재 AND pageerror 0건 |
| G02 | 자동조회 | spec에 init_load 있으면: API 호출 발생 |
| G03 | 검색폼 필드 수 | spec 필드 수 = 렌더링 필드 수 |
| G04 | 조회 버튼 | pageerror 0건, API 호출 발생 |
| G05 | 초기화 버튼 | 검색 필드 값 비어있음 |
| G06 | 그리드 컬럼 매칭 | visible 컬럼 수 일치 |
| G07 | 삭제 버튼 | confirm 팝업 또는 validation 메시지 |
| G08 | 커스텀 버튼 (etc) | 서브화면 이동 또는 상태변경 동작 |
| G09 | 더블클릭 네비게이션 | 대상 화면 탭 생성 |
| G10 | Validation 검증 | spec 메시지와 일치 |

#### search-grid-form 시나리오

grid-only 시나리오(G01~G10) + 아래 추가:

| ID | 시나리오 | 판정 기준 |
|----|---------|----------|
| SGF01 | 폼 필드 수 | spec 필드 수 = 렌더링 필드 수 |
| SGF02 | 코드콤보 렌더링 | code 필드 드롭다운 존재 |
| SGF03 | 신규 모드 진입 | 모든 필드 비어있음 |
| SGF04 | 수정 모드 진입 | 폼에 데이터 채워짐 |
| SGF05 | 필수값 검증 | required validation 발생 |
| SGF06 | 저장 (신규) | 성공 메시지 |
| SGF07 | 저장 (수정) | 성공 메시지 |
| SGF08 | 삭제 | confirm → 삭제 완료 |

#### form-detail 시나리오

| ID | 시나리오 | 판정 기준 |
|----|---------|----------|
| F01 | 화면진입 + JS에러 | 탭 존재 AND pageerror 0건 |
| F02 | 폼 필드 수 | spec 필드 수 = 렌더링 필드 수 |
| F03 | 코드콤보 렌더링 | code 필드 드롭다운 존재 |
| F04 | 신규 모드 진입 | 모든 필드 비어있음 |
| F05 | 수정 모드 진입 | 폼에 데이터 채워짐 |
| F06 | 필수값 검증 | required validation 발생 |
| F07 | 저장 (신규) | 성공 메시지 |
| F08 | 저장 (수정) | 성공 메시지 |
| F09 | 삭제 | confirm → 삭제 완료 |
| F10 | 커스텀 버튼 | spec 기반 동작 확인 |
| F11 | Readonly 모드 | 필드 readonly + 버튼 비활성화 |
| F12 | 동적 UI 전환 | 조건별 필드 표시/숨김 |
| F13 | 닫기/복귀 | 부모 화면 탭 활성화 |

#### popup-grid 시나리오

| ID | 시나리오 | 판정 기준 |
|----|---------|----------|
| P01 | 팝업 진입 + JS에러 | 팝업 렌더링 AND pageerror 0건 |
| P02 | 검색 기능 | API 호출 발생 |
| P03 | 그리드 컬럼 매칭 | visible 컬럼 수 일치 |
| P04 | 선택 반환 | 부모 화면에 값 전달 |

### STEP 3: 실패 시 fix.md 자동 생성

테스트 실패가 1건 이상이면 자동으로 fix.md를 생성한다.

#### 실패 분석
각 실패 항목에 대해:
1. 해당 화면의 `final/machine_spec.yml`, outputs 코드 확인
2. 원인 분류:
   - **CODE**: 구현 코드 오류 → fix.md 생성
   - **SPEC**: spec 해석 오류 → fix.md 생성
   - **DATA**: 테스트 데이터 문제 → fix.md 미생성 (fix_plan에 안내)
   - **ENV**: 환경 문제 → fix.md 미생성 (fix_plan에 안내)

#### fix 그룹핑
1. 같은 화면의 CODE/SPEC 실패는 하나의 fix로 묶음
2. fixId 채번: 기존 user/inbox/fixes/ 내 최대 번호 + 1

#### fix.md 구조
```markdown
# Fix 요청 — 테스트 실패 수정

## 출처
- 테스트: /test {taskId}
- 결과: user/test/tasks/{taskId}/{screenId}_test.md

## 대상
- task_id: {taskId}
- screen_id: {screenId}

## 유형
- [x] 버그 수정

## 실패 항목
### {testId} — {시나리오}
- **현상**: {에러/동작}
- **예상 원인**: {코드 수준 분석}
- **관련 코드**: {파일} 라인 {N}
- **기대 동작**: {spec 기반 정상 동작}

## 수정 방향
{전체적인 수정 방향 요약}
```

#### fix_plan.md 생성
```markdown
# Fix 계획 — {taskId}

## 생성된 Fix
| fixId | 화면 | 실패 수 | 원인 | 설명 |
|-------|------|---------|------|------|

## 실행 순서
1. `/fix {fixId} {taskId}` — 수정 + 재빌드
2. `/test {taskId}` — 재테스트

## DATA/ENV 항목 (fix 미생성)
| 화면 | 테스트 | 원인 | 조치 |
|------|--------|------|------|
```

### STEP 4: 결과 보고
1. summary.md + 화면별 결과를 사용자에게 출력
2. 실패 시: fix_plan.md 내용과 함께 안내
   ```
   테스트 실패 {N}건. fix.md가 생성되었습니다.
   user/inbox/fixes/{fixId}/fix.md 를 확인 후 `/fix {fixId} {taskId}`를 실행하세요.
   ```
3. 전체 통과 시 (cleanup 포함 — policies/runtime/lifecycle.yml 참조):
   - task runtime을 archive로 이동: `system/runtime/tasks/{taskId}/` → `system/archive/tasks/{taskId}/`
   - archive 이동 후 runtime에서 삭제
   - active 산출물 유지: user/output/, user/test/, user/review/
   ```
   모든 테스트 통과. 작업 완료.
   runtime 데이터가 archive로 이동되었습니다.
   ```

---

## Playwright 실행 가이드

### 로그인
```javascript
await page.goto('http://localhost:8080');
// 로그인 (kjsa/1)
```

### JS 에러 수집
```javascript
const errors = [];
page.on('pageerror', err => errors.push(err.message));
```

### 그리드 데이터 접근
```javascript
const rowCount = await page.evaluate(() => {
  const PGM = Object.keys(platform.listener).find(k => k.startsWith('SEA'));
  return platform.listener[PGM].grid.grid1.getRowCount();
});
```

## DB lookup (policies/runtime/db_access.yml)
test 수행 중 convention Grep으로 확인 불가능한 정보는 DB 직접 조회(SELECT only) 허용:
- 테스트 데이터 존재 확인
- 실제 데이터 상태 확인 (테스트 전제조건 검증)
- 뷰 조회 결과 검증
- convention Grep 선행 필수, 조회 사유를 test 결과에 기록

## 금지사항
- favorite, info 버튼 테스트 금지
- 프레임워크 구조 테스트 금지 (generate self-check 영역)
- 서버 미구동 시 테스트 금지
- spec에 없는 기능 테스트 금지
- 테스트 중 코드 수정 금지
