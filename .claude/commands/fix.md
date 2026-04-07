# /fix {fixId} {taskId} — 오류 수정 + 재빌드 + 정책 자동 적용

**인자**: $ARGUMENTS (fixId taskId)

## 목적
오류/변경사항을 즉시 반영하고, 필요 시 analyze 업데이트 + 재빌드까지 일괄 수행한다.
정책 개선 제안은 severity에 따라 자동 적용(high) 또는 제안만(low) 처리한다.
v4와 달리 사용자 리뷰 없이 즉시 실행하고, 완료 후 결과를 보고한다.

## 경로
모든 경로는 `system/config/paths.yml` 참조.
PROJECT_ROOT = C:/auto_gdi_work_v5

## 실행 원칙
- **Stateless**: fix 간 컨텍스트 공유 금지. 각 fix는 독립 실행.
- **Manifest 기반**: fix.manifest.yaml에 allowed_inputs/outputs 명시. 범위 외 접근 금지.
- **정책 기반**: policies/framework/*.yml 금지 API/패턴 재검증 필수.
- **Skeleton 강제**: 코드 재생성 시 반드시 skeleton 기반.
- **즉시 실행**: 사용자 리뷰 없이 바로 수행. 완료 후 결과 보고.
- **정책 자동 적용**: high severity 정책 제안은 자동 적용, low severity는 제안만.

## 사용법

```
/fix fix001 task001    — 수정 + analyze 업데이트(필요시) + 재빌드(필요시) + 정책 자동 적용
```

## 입력
- `user/inbox/fixes/{fixId}/fix.md` — 오류 보고 또는 변경 요청
- `user/inbox/fixes/{fixId}/` 하위 첨부 파일 (스크린샷, 로그 등)

## fix.md 구조 (사용자 작성 또는 /test가 자동 생성)

```markdown
# Fix 요청

## 대상
- task_id: task001
- screen_id: SEA010

## 유형
- [ ] 버그 수정
- [ ] 기능 변경
- [ ] 신규 추가

## 설명
(오류 현상 또는 변경 내용)
```

## 출력
- `system/runtime/fixes/{fixId}/manifest.yaml`
- `system/runtime/fixes/{fixId}/logs/` — 수정 작업 로그
- `system/runtime/fixes/{fixId}/outputs/` — 수정된 파일
- `user/output/fixes/{fixId}/fix_result.md` — 수정 완료 보고
- `proposals/policy_changes/done/` 또는 `proposals/policy_changes/new/` — 정책 변경

## fix.manifest.yaml 구조

```yaml
fix_id: {fixId}
task_id: {taskId}
status: analyzing | executing | updating_analyze | regenerating | deploying | applying_policy | complete | failed
target:
  task_id: task001
  screen_ids: [SEA010]
allowed_inputs:
  - user/inbox/fixes/{fixId}/
  - system/runtime/tasks/{task_id}/screens/{screenId}/outputs/
  - user/review/tasks/{taskId}/final/machine_spec.yml
  - system/cache/convention/ (Grep only)
  - policies/
  - system/templates/skeletons/
allowed_outputs:
  - system/runtime/fixes/{fixId}/
  - user/output/fixes/{fixId}/
  - proposals/policy_changes/
changes: []
policy_proposals: []
policy_applied: []
```

---

## 절차

### STEP 1: 입력 분석

1. `user/inbox/fixes/{fixId}/fix.md` 및 첨부 파일 로드
2. 오류/변경 내용 종합 해석
3. 영향 범위 분석:
   - 대상 화면 식별 (screen_ids)
   - 영향받는 파일 유형 (HTML, XML, SQL, Controller, Service, 정책, 템플릿)
   - 오류 분류 코드 부여 (API/XML/CCH/MOD/NAV/FRM/SQL/STR/FW)
4. 대상 파일 로드 (allowed_inputs 범위 내)
5. convention Grep으로 DDL/코드 매핑 재확인

### STEP 2: 수정 실행

1. **대상 코드 수정**
   - 기존 outputs 파일을 fix/outputs/에 복사 후 수정
   - 원본 파일은 직접 수정하지 않음 (롤백 안전)
   - skeleton 구조 준수 여부 확인
   - policies/framework/*.yml 금지 API/패턴 재검증

2. **정책/템플릿 영향 확인**
   - 수정 내용이 정책 위반에서 비롯된 경우 → STEP 5에서 정책 처리
   - 수정 내용이 템플릿 결함에서 비롯된 경우 → STEP 5에서 정책 처리

### STEP 3: Analyze 업데이트 (필요 시)

fix 내용이 명세 수준 변경을 수반하는 경우 (기능 변경, 신규 추가 등):

1. 대상 화면의 `final/machine_spec.yml` 업데이트
2. 대상 화면의 `final/people_spec.md` 업데이트
3. analyze.manifest.yaml 갱신

**코드 수준 버그 수정만인 경우 이 단계는 건너뛴다.**

### STEP 4: 재빌드 (필요 시)

수정/업데이트된 내용을 반영하여 해당 task의 대상 화면을 재빌드한다.

```
fix 수정 완료 → generate (self-check 포함) → deploy
```

각 단계는 해당 skill의 규칙을 그대로 따른다:
- generate: `.claude/skills/generate.md` (skeleton 강제, 금지 API 교정, self-check 통합)
- deploy: `.claude/skills/deploy.md` (백업 필수, SOURCE_ROOT 배포)

**코드 직접 수정만으로 충분한 경우 (단순 텍스트 오류 등) 재빌드를 건너뛰고 deploy만 수행할 수 있다.**

### STEP 5: 정책 개선 처리 (자동)

수정 과정에서 시스템적 문제 발견 시 **propose-policy-fix 스킬**(`.claude/skills/propose-policy-fix.md`)을 호출한다.

#### 판단 기준
- 금지 API가 generate에서 차단되지 않은 경우 → forbidden_apis.yml 보강 제안
- 동일 유형 오류가 다른 화면에서도 재현 가능한 경우 → 검증 규칙 추가 제안
- skeleton 구조에 누락된 패턴이 있는 경우 → skeleton_contract.yml 보강 제안
- verify 체크리스트에 해당 항목이 없는 경우 → verify 정책 추가 제안

#### Severity 기반 자동 적용 (v4 대비 변경)

v4에서는 모든 정책 제안을 축적 후 `/apply-policy-fix`로 별도 적용했으나,
v5에서는 severity에 따라 자동 처리한다:

| Severity | 처리 방식 | 예시 |
|----------|----------|------|
| **high** | 즉시 자동 적용 (백업 + 적용 + 로그) | 금지 API 누락, critical 검증 규칙 공백 |
| **low** | 제안만 생성 (`proposals/policy_changes/new/`) | CSS 규칙, warning 수준 개선 |

**자동 적용 절차** (high severity):
1. 정책 제안 YML 생성 (status: `auto_approved`)
2. 기존 정책 백업 → `proposals/policy_changes/backups/`
3. 정책 파일에 변경 적용
4. YML 문법 검증
5. 적용 로그 → `proposals/policy_changes/done/`
6. fix_result.md에 적용 내역 포함

### STEP 6: 완료 처리 + Cleanup (policies/runtime/lifecycle.yml 참조)

1. fix.manifest.yaml status → `complete`
2. `user/output/fixes/{fixId}/fix_result.md` 생성
3. **Cleanup**: fix runtime을 archive로 이동
   - `system/runtime/fixes/{fixId}/` → `system/archive/fixes/{fixId}/`
   - archive 이동 후 runtime에서 삭제
   - archive는 이후 실행 입력으로 사용 불가 (forbidden_always)

## fix_result.md 구조

```markdown
# Fix 완료 보고 — {fixId}

## 요약
- fix_id: {fixId}
- task_id: {taskId}
- 대상 화면: {screen_ids}
- 오류 유형: {error_codes}
- 처리 결과: 완료/부분완료/실패

## 수정 내역
| 파일 | 수정 유형 | 변경 내용 |
|------|----------|----------|

## Analyze 업데이트 (해당 시)
- final/machine_spec.yml 변경사항
- final/people_spec.md 변경사항

## 재빌드 결과 (해당 시)
- 결과: {성공/실패}
- self-check: {PASS/FAIL 상세}

## 배포 결과 (해당 시)
| 파일 | 배포 경로 | 상태 |
|------|----------|------|

## 정책 변경
### 자동 적용 (high severity)
| 제안 ID | 대상 정책 | 변경 유형 | 적용 결과 |
|---------|----------|----------|----------|

### 제안만 (low severity)
| 제안 ID | 대상 정책 | 변경 유형 | 파일 위치 |
|---------|----------|----------|----------|
```

## 오류 분류 코드

| 카테고리 | 코드 | 설명 |
|----------|------|------|
| API | API-xxx | 금지 API 사용 |
| XML | XML-xxx | XML 패턴 위반 |
| CCH | CCH-xxx | 코드콤보 오류 |
| MOD | MOD-xxx | 모드 전환 오류 |
| NAV | NAV-xxx | 화면 이동 오류 |
| FRM | FRM-xxx | 폼/그리드 오류 |
| SQL | SQL-xxx | SQL 오류 |
| STR | STR-xxx | 구조 오류 |
| FW | FW-xxx | 프레임워크 위반 |

## DB lookup (policies/runtime/db_access.yml)
fix 수행 중 convention Grep으로 확인 불가능한 정보는 DB 직접 조회(SELECT only) 허용:
- 오류 원인 파악 (실제 데이터/구조 확인)
- 누락 컬럼/인덱스/트리거 확인
- 뷰 정의 확인
- convention Grep 선행 필수, 조회 사유를 fix_result.md에 기록

## 금지사항
- manifest의 allowed_inputs/outputs 범위 외 파일 접근 금지
- 다른 fix/task의 runtime 참조 금지
- skeleton 없이 직접 코드 생성 금지
- convention 전체 Read 금지 (Grep만 허용)
- high severity 정책 적용 시 백업 없이 덮어쓰기 금지
- 적용 로그 없이 정책 변경 금지
