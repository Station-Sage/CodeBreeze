# .ai/index.md — AI 문서 라우터

## 세션 시작 시 읽기 (필수)
1. BUGS.md (루트) — 버그 현황, 미수정 항목 확인
2. .ai/todo.md — 오늘 할일, 진행 상태

## 작업별 참조 (필요 시만)
| 파일 | 언제 읽나 |
|------|----------|
| .ai/architecture.md | 확장 구조, 데이터 흐름 파악 시 |
| .ai/files.md | 소스 파일 역할, 수정 대상 파악 시 |
| .ai/decisions.md | 설계 판단, 과거 결정 이유 확인 시 |
| .ai/changelog.md | 최근 변경사항 확인 시 (최신 3건) |
| .ai/changelog-archive.md | 오래된 변경 이력 필요 시 (보통 불필요) |
| .ai/roadmap.md | 향후 확장 방향, 장기 계획 확인 시 |

## 토큰 전략

### Claude Code — Pro 토큰 한도 소모
읽기 절약:
- 세션 시작 시 소스 코드 자동으로 읽지 않음
- .ai/files.md로 대상 파악 후 필요한 파일만 읽기
- 한 번에 2~3개 파일, 600줄 이내
- 이미 읽은 파일 재읽기 금지

출력 절약:
- 코드만 출력, 부가 설명 최소화
- 변경된 부분만 출력 (전체 파일 재출력 지양)
- diff 또는 줄 범위 지정 교체 우선

### AI챗 (젠스파크 등) — 토큰 무제한
- 전체 파일 읽기/출력 가능
- 설명 포함 가능

## 빌드 명령
- 컴파일: npm run compile
- 에러 확인: npm run compile 2>&1 | head -50
- 린트: npm run lint
- 패키징: npm run package
