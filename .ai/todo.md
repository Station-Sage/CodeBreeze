# 할일 (2026-03-16)

## 완료
- [x] npm run compile 에러 없음 확인
- [x] 모든 import 경로 정상 확인
- [x] 단위테스트 56개 작성 및 통과 (markdownParser, diffDetector, markdownUtils, types, projectMapCollector, diffPreview, mcpServer)
- [x] CI에 xvfb-run npm test 단계 추가
- [x] VSIX 패키징 오류 수정 (icon.png 참조 제거, main 경로 수정)
- [x] Collect 흐름 완성: 모든 collect/ 모듈 구현 확인 및 lint 경고 0 달성 — 2026-03-15
- [x] gitEventMonitor prevCommit 활용한 실제 commit 감지 구현 — 2026-03-15
- [x] copyMultipleFilesForAI 커맨드 등록 (explorer/context 다중 선택 메뉴 포함) — 2026-03-15
- [x] GitHub Actions 로그: public 레포 토큰 없이 조회 지원 — 2026-03-15
- [x] 신규 테스트 10개 추가 (collectUtils.test.ts) — 2026-03-15
- [x] I-001: code-server 클립보드 폴백 (clipboardCompat.ts) — 2026-03-16
- [x] I-002: 프로젝트 맵 자동 생성 (projectMapCollector.ts, 8개 언어 정규식) — 2026-03-16
- [x] I-003: 컨트롤 패널 diff 미리보기 (diffPreview.ts) — 2026-03-16
- [x] Phase 3: MCP 서버 모드 (mcp/mcpServer.ts, 포트 3700, 9개 도구, @modelcontextprotocol/sdk) — 2026-03-16
- [x] Phase 4: 브라우저 WebSocket 브릿지 (bridge/wsBridgeServer.ts, 포트 3701, ws 라이브러리) — 2026-03-16
- [x] fix/bug-batch-01 머지 (squash) — 컨트롤 패널 열기 오류 수정 — 2026-03-16
- [x] .vscodeignore 런타임 패키지 화이트리스트 추가 — 2026-03-16
- [x] @types/ws devDependencies로 이동 — 2026-03-16
- [x] ws.terminate() 수정 (wsBridgeServer.ts) — 2026-03-16
- [x] docs/code-server-guide.md 작성 (web/code-server/Termux 실행 가이드) — 2026-03-16

## 우선 — 핵심 기능 검증
- [x] Apply 흐름 E2E: clipboardCompat 연동, 에러 경로 try/catch (B-007) — 2026-03-17
- [ ] Collect 흐름 테스트: Ctrl+Shift+C → 클립보드에 마크다운 포맷 확인
- [ ] git diff/log 수집 테스트
- [ ] 컨트롤 패널(Ctrl+Shift+I) WebView 로드 확인
- [ ] code-server 환경 실제 테스트 (clipboardCompat 폴백 검증)

## 다음 — 안정화
- [x] 에러 경로 처리: 빈 클립보드, 코드 블록 없는 텍스트, 파일 경로 매칭 실패 (B-007) — 2026-03-17
- [x] safetyGuard: stash ref 버그 수정, 경고 로깅 (B-002) — 2026-03-17
- [x] autoWatch: clipboardCompat 연동, try/catch, code-server 폴백 (B-003, B-004, B-005) — 2026-03-17
- [x] fileMatcher: 부모 디렉토리 자동 생성, exclude 패턴 확장 (B-006) — 2026-03-17
- [x] patchApplier: temp 파일 유니크화 (B-008) — 2026-03-17
- [ ] localBuildCollector: 다양한 빌드 도구 에러 포맷 파싱
- [ ] MCP 서버 실제 연결 테스트 (Claude Desktop / Cursor)
- [ ] WebSocket 브릿지 브라우저 확장 개발 (Phase 4 클라이언트 측)

## 미구현 개선사항
- [ ] I-004: Marketplace용 아이콘 PNG 등록
- [ ] MCP transport per-request 패턴 (현재 단일 transport 재사용, stateless 완전 지원 시 변경)
- [x] I-001: code-server 클립보드 폴백 — 2026-03-15 완료
- [x] I-002: 프로젝트 맵 자동 생성 (AST) — 2026-03-15 완료
- [x] I-003: 컨트롤 패널 diff 미리보기 — 2026-03-15 완료

## 신규 구현 (2026-03-15)
- [x] Phase 3: MCP 서버 모드 (src/mcp/mcpServer.ts) — 포트 3700, 9개 도구
- [x] Phase 4: 브라우저 WebSocket 브릿지 (src/bridge/wsBridgeServer.ts) — 포트 3701
- [x] 유닛 테스트 3개 파일 추가 (25 tests: projectMapCollector, diffPreview, mcpServer)
- [x] fix/bug-batch-01 머지 (squash) — 컨트롤 패널 열기 오류 수정

## Android 태블릿 테스트 방안
- VS Code Extension은 Electron 기반이라 Android 직접 실행 불가
- **권장**: code-server (브라우저에서 VS Code 접근) → clipboardCompat 폴백 사용
- 대안: GitHub Codespaces, Termux+code-server
