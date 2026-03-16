# 할일 (2026-03-15)

## 완료
- [x] npm run compile 에러 없음 확인
- [x] 모든 import 경로 정상 확인
- [x] 단위테스트 45개 작성 및 CI 통과 (markdownParser, diffDetector, markdownUtils, types)
- [x] CI에 xvfb-run npm test 단계 추가
- [x] VSIX 패키징 오류 수정 (icon.png 참조 제거, main 경로 수정)
- [x] Collect 흐름 완성: 모든 collect/ 모듈 구현 확인 및 lint 경고 0 달성 — 2026-03-15
- [x] gitEventMonitor prevCommit 활용한 실제 commit 감지 구현 — 2026-03-15
- [x] copyMultipleFilesForAI 커맨드 등록 (explorer/context 다중 선택 메뉴 포함) — 2026-03-15
- [x] GitHub Actions 로그: public 레포 토큰 없이 조회 지원 — 2026-03-15
- [x] 신규 테스트 10개 추가 (collectUtils.test.ts) — 2026-03-15

## 우선 — 핵심 기능 검증
- [ ] Apply 흐름 E2E 테스트: 마크다운 코드 블록 복사 → Ctrl+Shift+A → 파일 적용
- [ ] Collect 흐름 테스트: Ctrl+Shift+C → 클립보드에 마크다운 포맷 확인
- [ ] git diff/log 수집 테스트
- [ ] 컨트롤 패널(Ctrl+Shift+I) WebView 로드 확인

## 다음 — 안정화
- [ ] 에러 경로 처리: 빈 클립보드, 코드 블록 없는 텍스트, 파일 경로 매칭 실패
- [ ] safetyGuard: git stash → apply → undo 전체 흐름 검증
- [ ] localBuildCollector: 다양한 빌드 도구 에러 포맷 파싱
- [x] lint warning 8개 정리 (미사용 변수) — 2026-03-15 완료

## 미구현 개선사항
- [x] I-001: code-server 클립보드 폴백 — 2026-03-15 완료
- [x] I-002: 프로젝트 맵 자동 생성 (AST) — 2026-03-15 완료
- [x] I-003: 컨트롤 패널 diff 미리보기 — 2026-03-15 완료
- I-004: Marketplace용 아이콘 PNG 등록

## 신규 구현 (2026-03-15)
- [x] Phase 3: MCP 서버 모드 (src/mcp/mcpServer.ts) — 포트 3700, 9개 도구
- [x] Phase 4: 브라우저 WebSocket 브릿지 (src/bridge/wsBridgeServer.ts) — 포트 3701
- [x] 유닛 테스트 3개 파일 추가 (25 tests: projectMapCollector, diffPreview, mcpServer)
- [x] fix/bug-batch-01 머지 (squash) — 컨트롤 패널 열기 오류 수정

## Android 태블릿 테스트 방안
- VS Code Extension은 Electron 기반이라 Android 직접 실행 불가
- **권장**: code-server (브라우저에서 VS Code 접근) → clipboardCompat 폴백 사용
- 대안: GitHub Codespaces, Termux+code-server
