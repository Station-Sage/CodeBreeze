# 할일 (2026-03-17)

## 완료 — Phase 6: Cursor-like 자동화 개선
- [x] errorChainCollector.ts 신규 생성 — import/require 체인 추적 (~120줄)
- [x] chunkSplitter.ts 신규 생성 — 함수/클래스 경계 분할 (~100줄)
- [x] diffRangeCalculator.ts 신규 생성 — 순수 diff 범위 계산 (~50줄)
- [x] inlineDiffApply.ts 신규 생성 — 부분 편집 적용 (~80줄)
- [x] agentLoop.ts 개선 — 테스트 명령, 조기 종료, 타임아웃, 에러 체인 컨텍스트
- [x] chatPanelHtml.ts 분할 → chatPanelStyles.ts + chatPanelScript.ts (644→130줄)
- [x] clipboardApply.ts 업데이트 — inline diff 모드 연동
- [x] fileCopy.ts 업데이트 — chunkSplitter 연동 (buildChunkedFileMarkdown)
- [x] config.ts + package.json — 4개 설정 추가 (applyMode, agentLoopTimeout, streamingDebounceMs, errorChainDepth)
- [x] types.ts — Chunk 인터페이스 추가
- [x] localBuildCollector.ts — path.join 사용 (Windows 경로 호환)
- [x] chatPanel.ts — stopAgentLoop 핸들러 추가
- [x] 테스트: errorChainCollector (14개), chunkSplitter (13개), inlineDiffApply (8개) = 35개 신규
- [x] npm run compile — 에러 없음
- [x] npm run lint — 신규 warning 0 (기존 5개만)
- [x] 기존 65개 + 신규 37개 = 전체 102개 테스트 통과
- [x] MD 파일 업데이트 (roadmap, todo, changelog, decisions, browser-extension README)

## 완료 — Phase 4 브라우저 확장
- [x] Task 1~7: bridgeProtocol, browser-extension, content.js, background.js, Bridge 탭, agentLoop, 테스트

## 완료 — 안정화 + 개선
- [x] 컨트롤 패널 secondarySidebar → panel 이동
- [x] 중복 함수 제거 (sendBridgeStatus, getConnectionCount)
- [x] errorParser 추출 + 8개 빌드 도구 에러 포맷 지원
- [x] Agent Loop 반복 횟수 설정화
- [x] Marketplace 아이콘, 브라우저 확장 아이콘, CRX 빌드 스크립트

## 남은 검증 작업
- [ ] Collect 흐름 테스트: Ctrl+Shift+C → 클립보드에 마크다운 포맷 확인
- [ ] 컨트롤 패널(Ctrl+Shift+I) WebView 로드 확인
- [ ] Bridge 탭 UI 렌더링 확인 + Agent Loop 시작/중지 테스트
- [ ] code-server 환경 실제 테스트 (clipboardCompat 폴백 검증)
- [ ] 브라우저 확장 Chrome 로드 테스트
- [ ] Windows 10 VS Code 환경 테스트 (경로 호환 확인)
- [ ] Termux 태블릿 code-server 테스트

## 미구현 개선사항 (향후)
- [ ] VS Code diff editor 통합 (vscode.diff 명령)
- [ ] MCP transport per-request 패턴
- [ ] MCP 클라이언트 내장 (mcpClient.ts)
- [ ] Firefox 확장 호환 (manifest V2)
- [ ] 스트리밍 모드: AI 응답 토큰 단위 표시
- [ ] 멀티 파일 일괄 diff 미리보기
