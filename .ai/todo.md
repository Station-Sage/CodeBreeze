# 할일 (2026-03-17)

## 완료 — Phase 4 브라우저 확장
- [x] Task 1: bridgeProtocol.ts 신규 생성 + wsBridgeServer.ts 프로토콜 확장
- [x] Task 2: browser-extension/ 스캐폴딩 (manifest.json, popup.html/js)
- [x] Task 3: content.js — 5개 AI챗 사이트 코드 블록 감지
- [x] Task 4: background.js — WebSocket 연결 + 지수 백오프 재연결
- [x] Task 5: chatPanelHtml.ts Bridge 탭 UI + chatPanel.ts 핸들러
- [x] Task 6: agentLoop.ts — 빌드→에러→AI재전송 자동 루프 (설정화 완료)
- [x] Task 7: 테스트 + getConnectionCount 추가

## 완료 — 안정화 + 개선
- [x] npm run compile 에러 없음 확인 — 2026-03-17
- [x] npm run lint 통과 (0 errors, warnings only) — 2026-03-17
- [x] 컨트롤 패널 secondarySidebar → panel 이동 (WebView 로드 이슈 해결) — 2026-03-17
- [x] chatPanel.ts 중복 sendBridgeStatus 함수 제거 — 2026-03-17
- [x] wsBridgeServer.ts 중복 getConnectionCount 함수 제거 — 2026-03-17
- [x] localBuildCollector: 다양한 빌드 도구 에러 포맷 파싱 (GCC/Clang, Java/Kotlin, Python, Gradle/Maven, Swift) — 2026-03-17
- [x] Agent Loop 반복 횟수 설정화 (codebreeze.agentLoopMaxIterations, 기본 5, 최대 20) — 2026-03-17
- [x] I-004: Marketplace용 아이콘 PNG 등록 (resources/icon.png + package.json icon 필드) — 2026-03-17
- [x] browser-extension/icons/ 아이콘 생성 (16/48/128px PNG) — 2026-03-17
- [x] 브라우저 확장 CRX/ZIP 빌드 스크립트 (scripts/build-browser-ext.js) — 2026-03-17
- [x] agentLoop.ts 미사용 parseClipboard import 제거 — 2026-03-17

## 남은 검증 작업
- [ ] npm test — 기존 56개 + 신규 테스트 통과
- [ ] Collect 흐름 테스트: Ctrl+Shift+C → 클립보드에 마크다운 포맷 확인
- [ ] git diff/log 수집 테스트
- [ ] 컨트롤 패널(Ctrl+Shift+I) WebView 로드 확인 (panel 이동 후 재검증)
- [ ] Bridge 탭 UI 렌더링 확인
- [ ] code-server 환경 실제 테스트 (clipboardCompat 폴백 검증)
- [ ] 브라우저 확장 Chrome 로드 테스트
- [ ] MCP 서버 실제 연결 테스트 (Claude Desktop / Cursor)

## 미구현 개선사항
- [ ] MCP transport per-request 패턴 (현재 단일 transport 재사용, stateless 완전 지원 시 변경)
- [ ] MCP 클라이언트 내장 (mcpClient.ts)
- [ ] 에러 추적 연쇄 수집 (errorCollector 확장)
- [ ] 청크 분할 개선 (fileCopy 확장)
- [ ] Firefox 확장 호환 (manifest V2 변환)
- [ ] 브라우저 확장 Chrome Web Store 배포
- [x] I-001: code-server 클립보드 폴백 — 2026-03-15 완료
- [x] I-002: 프로젝트 맵 자동 생성 (AST) — 2026-03-15 완료
- [x] I-003: 컨트롤 패널 diff 미리보기 — 2026-03-15 완료

## Android 태블릿 테스트 방안
- VS Code Extension은 Electron 기반이라 Android 직접 실행 불가
- **권장**: code-server (브라우저에서 VS Code 접근) → clipboardCompat 폴백 사용
- 대안: GitHub Codespaces, Termux+code-server