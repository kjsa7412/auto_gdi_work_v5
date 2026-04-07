# deploy — 배포

## 호출원
`/build`, `/fix`

## 목적
생성 및 통합 검증 통과한 코드를 실제 소스 경로에 배포하고, 사용자용 deliverables 사본을 생성한다.

## 경로
모든 경로는 `system/config/paths.yml` 참조.

## 실행 원칙
- **generate 통합 검증 통과 필수**: generate.manifest.yaml status=complete AND verify_results.critical_pass=true일 때만 실행.
- **백업 필수**: 기존 파일 존재 시 반드시 백업 후 배포.
- **Manifest 기반**: deploy.manifest.yaml에 배포 경로와 결과 기록.

## 배포 경로 매핑

| 구분 | 원본 (runtime) | 대상 (SOURCE_ROOT) |
|------|---------------|-------------------|
| HTML | outputs/{ScreenId}.html | src/main/resources/templates/project/{module}/{category}/{ScreenId}.html |
| XML | outputs/{screenid}.xml | src/main/resources/mapper/sjerp/{module}/{category}/{screenid}.xml |
| Controller | outputs/{ScreenId}Controller.java | src/main/java/com/sjinc/sjerp/proj/{module}/{category}/{screenid}/{ScreenId}Controller.java |
| Service | outputs/{ScreenId}Service.java | src/main/java/com/sjinc/sjerp/proj/{module}/{category}/{screenid}/{ScreenId}Service.java |

### 경로 변수
- `{module}` = final/machine_spec.yml의 module_id 소문자 (SE → se)
- `{category}` = final/machine_spec.yml의 category_id 소문자 (SEA → sea)
- `{ScreenId}` = 화면ID 원본 (SEA010)
- `{screenid}` = 화면ID 소문자 (sea010)

## 입력
- `system/runtime/tasks/{taskId}/screens/{screenId}/generate.manifest.yaml`
- `system/runtime/tasks/{taskId}/screens/{screenId}/outputs/`
- `user/review/tasks/{taskId}/final/machine_spec.yml`

## 출력

### 배포
- SOURCE_ROOT 하위 실제 소스 경로에 파일 복사

### 사용자용
- `user/output/tasks/{taskId}/deliverables/{screenId}/` — 산출물 사본
  - {ScreenId}.html
  - {screenid}.xml
  - sql/*.sql
  - {ScreenId}Controller.java (해당 시)
  - {ScreenId}Service.java (해당 시)

### 시스템 내부
- `system/runtime/tasks/{taskId}/screens/{screenId}/deploy.manifest.yaml`

## deploy.manifest.yaml 구조

```yaml
screen_id: {screenId}
phase: deploy
status: deployed | failed | skipped
deployed_at: {timestamp}
files:
  - source: outputs/SEA010.html
    target: C:/gdi/src/main/resources/templates/project/se/sea/SEA010.html
    backup: backups/SEA010.html.{timestamp}.bak
    status: deployed
  - source: outputs/sea010.xml
    target: C:/gdi/src/main/resources/mapper/sjerp/se/sea/sea010.xml
    backup: null
    status: deployed
  - source: outputs/SEA010Controller.java
    target: C:/gdi/src/main/java/com/sjinc/sjerp/proj/se/sea/sea010/SEA010Controller.java
    backup: null
    status: deployed
  - source: outputs/SEA010Service.java
    target: C:/gdi/src/main/java/com/sjinc/sjerp/proj/se/sea/sea010/SEA010Service.java
    backup: null
    status: deployed
sql_files:
  - outputs/sql/SEA010_메뉴등록.sql
sql_note: "SQL 파일은 DBA 검토 후 수동 실행 필요"
rollback:
  instruction: "backups/ 폴더의 .bak 파일로 원복"
```

## 절차

### Phase 1: 사전 검증
1. generate.manifest.yaml 로드
2. status=complete AND verify_results.critical_pass=true 확인
3. 미통과 시 deploy 중단 (status: skipped)
4. 배포 대상 경로 생성 (final/machine_spec.yml에서 module_id, category_id 추출)

### Phase 2: 백업
5. 대상 경로에 기존 파일 존재 확인
6. 존재하면 backups/에 타임스탬프 포함 백업

### Phase 3: 배포
7. HTML/XML 파일 복사
8. Controller/Service 파일 복사 (해당 시, 디렉토리 없으면 생성)
9. 복사 후 파일 존재 및 크기 확인

### Phase 4: 사용자용 산출물
10. `user/output/tasks/{taskId}/deliverables/{screenId}/`에 사본 복사
11. SQL 파일은 deliverables에만 (자동 실행 금지)
12. deploy.manifest.yaml 생성

## SQL 파일 처리
SQL 파일은 **자동 실행하지 않는다**:
- deliverables에 사본 복사
- report.md에 실행 필요 SQL 목록 + execution_order.md 포함
- DBA 또는 사용자가 검토 후 수동 실행

## 금지사항
- generate 통합 검증 미통과(verify_results.critical_pass: false)에서 배포 금지
- 기존 파일 백업 없이 덮어쓰기 금지
- SQL 파일 자동 실행 금지
- pgm_path에 /project 접두사 또는 대문자 사용 금지
