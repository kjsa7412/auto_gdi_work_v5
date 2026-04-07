# propose-policy-fix — 정책 변경 제안 + severity 기반 자동 적용

## 호출원
`/fix` (STEP 5에서 자동 호출)

## 목적
fix 처리 과정에서 발견된 시스템적 문제(반복 오류 패턴, 정책 누락, 규칙 모순 등)에 대해
정책 변경을 **제안**하고, severity에 따라 **자동 적용** 또는 **제안만** 처리한다.

## 경로
모든 경로는 `system/config/paths.yml` 참조.

## 실행 원칙
- **severity 기반 처리**: high → 자동 적용 (백업 + 적용 + 로그), low → 제안만 생성
- **근거 필수**: 발견 경위, 영향 범위, 변경 전/후 비교 포함
- **백업 필수**: high severity 자동 적용 시 반드시 기존 정책 백업
- **로그 필수**: 적용 내역을 proposals/policy_changes/done/에 기록

## 입력
- fix 처리 중 발견된 패턴/규칙 개선 필요사항
- `system/runtime/fixes/{fixId}/logs/`
- 현재 `policies/` 하위 정책 파일

## 출력

### high severity (자동 적용)
1. 정책 제안 YML 생성 (status: `auto_approved`)
2. 기존 정책 백업 → `proposals/policy_changes/backups/`
3. 정책 파일에 변경 적용
4. YML 문법 검증
5. 적용 완료 → `proposals/policy_changes/done/`
6. fix_result.md에 적용 내역 포함

### low severity (제안만)
1. 정책 제안 YML 생성 (status: `pending`)
2. `proposals/policy_changes/new/`에 저장
3. fix_result.md에 제안 링크 포함

## proposal YML 구조
`proposals/policy_changes/example_policy_fix.yml` 파일의 구조를 참고하여 작성한다.
반드시 해당 예시 파일을 Read하여 동일한 형식으로 작성할 것.

## 절차
1. 문제 패턴 식별 — fix 로그에서 반복 패턴 또는 정책 공백 발견
2. 영향받는 정책 파일 식별
3. severity 판정:
   - **high**: 금지 API 누락, critical 검증 규칙 공백, 보안 위반 등 즉시 적용 필요
   - **low**: CSS 규칙, warning 수준 개선, 편의성 향상 등
4. 변경 제안 YML 작성 — before/after, 근거, 영향도, severity 명시
5. severity에 따라 처리:
   - high → 백업 + 적용 + done/ 이동
   - low → new/에 저장

## 제안 유형

| 유형 | 설명 |
|------|------|
| 금지 패턴 추가 | 새로운 금지 API/패턴 발견 |
| 필수 패턴 추가 | 누락된 필수 규칙 발견 |
| 규칙 수정 | 기존 규칙이 부정확 |
| 규칙 삭제 | 불필요하거나 충돌하는 규칙 |
| 기본값 변경 | default_resolution 정책 변경 |

## 정책 반영 수준 판단

수정사항은 아래 수준 중 어디에 반영되어야 하는지 반드시 판단한다:
- **Local patch**: 해당 화면/파일에만 적용 (fix로 종결)
- **Type-level rule**: 특정 화면유형에 적용 (verify/framework 정책 수정)
- **Global policy**: 전체 시스템에 적용 (runtime/analyze 정책 수정)

판단 근거 없이 국소 수정만 하지 않는다.

## 금지사항
- 근거 없는 제안 금지
- high severity 적용 시 백업 없이 덮어쓰기 금지
- 적용 로그 없이 정책 변경 금지
- active 정책만 수정 대상 (archive 정책 수정 금지)
