# 소스 파일 인덱스

경로: src/

## 진입점
- extension.ts (~140줄) — activate/deactivate, 명령 등록, 모니터 초기화, 사이드바 등록, LSP 인덱서/인라인 완성/백그라운드 에이전트 초기화 (Phase 10-11)
- config.ts (~80줄) — CodeBreezeConfig 인터페이스 (25개 설정), VS Code 설정 + .codebreeze.json 병합
- types.ts (~55줄) — CodeBlock, ApplyResult, HistoryEntry, BuildResult, ParsedError, ContextPayload('lspProjectMap' 포함), MonitorEvent

## apply/ — AI챗 → VS Code
- clipboardApply.ts (~190줄) — 메인 적용 흐름: 클립보드 읽기 → 파싱 → 매칭 → 적용; `applyCodeBlocksHeadless()` MCP용 비대화형 적용; clipboardCompat 연동, 전체 try/catch
- markdownParser.ts (~150줄) — 마크다운 텍스트에서 코드 블록 추출; 불완전 블록 감지, 100KB+ 청크 파싱 (Phase 7-4)
- diffDetector.ts (~30줄) — 코드 블록 내용이 unified diff인지 판별
- fileMatcher.ts (~70줄) — 파일 경로를 워크스페이스 파일에 매칭 (glob, 부분 경로); 부모 디렉토리 자동 생성
- patchApplier.ts (~55줄) — unified diff를 파일에 적용 (diff 라이브러리)
- safetyGuard.ts (~65줄) — git stash 백업, 히스토리 기록, undo 복원
- diffPreview.ts (~110줄) — `diff` 패키지 `diffLines` 사용, ±3줄 컨텍스트 축소, `BlockDiff` 반환 (I-003)
- nativeDiffPreview.ts (~100줄) — VS Code 네이티브 diff editor 통합 (Phase 8-1). `vscode.diff` 명령, Accept/Reject, 멀티 파일 diff

## collect/ — VS Code → AI챗
- fileCopy.ts (~90줄) — 파일/선택영역/다중파일 → 마크다운 코드 블록 → 클립보드
- gitCollector.ts (~85줄) — git diff/log → 마크다운 → 클립보드
- errorCollector.ts (~80줄) — Problems 에러 + 주변 코드 → 클립보드
- localBuildCollector.ts (~200줄) — 빌드/테스트 실행, 출력 캡처, 에러 파싱 (TS/ESLint/GCC/Java/Python/Gradle/Swift/Rust/Go), 결과 저장
- githubLogCollector.ts (~140줄) — GitHub REST API로 워크플로우 로그 다운로드 + 에러 추출
- smartContext.ts (~190줄) — 현재 파일 + 에러 + git diff + 프로젝트 규칙 자동 조합; 'projectMap'/'lspProjectMap' 케이스 포함; `smartContextMode: auto` 시 LSP 심볼 + 에러 참조 자동 추가 (Phase 10-4)
- projectMapCollector.ts (~160줄) — 8개 언어 정규식 심볼 추출, 200파일 한도, `codebreeze.copyProjectMap` (I-002)
- lspIndexer.ts (~200줄) — LSP DocumentSymbolProvider 기반 심볼 인덱서, 증분 업데이트, 워크스페이스 캐시, `searchSymbols`, `getLspProjectMap` (Phase 10-1)
- lspReferences.ts (~170줄) — LSP ReferenceProvider + CallHierarchyProvider, `findReferences`, `getCallHierarchy`, `findReferencesByName`, 마크다운 포맷터 (Phase 10-2)
- rulesLoader.ts (~60줄) — .codebreeze-rules.md 로드, 캐시, 포맷 (Phase 8-2)

## monitor/ — 이벤트 감시
- taskMonitor.ts (~55줄) — 빌드 태스크 시작/종료 감지
- terminalMonitor.ts (~65줄) — 터미널 출력에서 에러 패턴 감지
- diagnosticsMonitor.ts (~50줄) — 컴파일 에러/경고 수 변화 감지 + 콜백
- gitEventMonitor.ts (~55줄) — git HEAD 변화 폴링 (커밋/브랜치 전환)

## ui/ — 사용자 인터페이스
- sidebarProvider.ts (~145줄) — TreeDataProvider: Send/Receive/History 트리
- chatPanel.ts (~270줄) — WebView 패널 생성 (panel 위치), 메시지 핸들링; clipboardCompat 연동, autoWatch try/catch; Bridge 관련 핸들러 (startBridge, stopBridge, bridgeSendToAI, bridgeSendContext, startAgentLoop)
- chatPanelHtml.ts (~480줄) — 컨트롤 패널 HTML/CSS/JS 템플릿; 4-tab (Send, Receive, History, Bridge); diff CSS + 🔍 Preview 버튼 포함
- historyStore.ts (~35줄) — globalState 기반 적용 히스토리 CRUD
- statusBarItem.ts (~35줄) — 상태바 아이템 생성, flash 알림

## utils/ — 공용 유틸리티
- exec.ts (~40줄) — child_process.exec 래퍼 (Promise, 타임아웃, cwd)
- markdown.ts (~35줄) — 마크다운 코드 블록 포맷 헬퍼
- clipboardCompat.ts (~170줄) — VS Code clipboard API + 파일 기반 폴백 + 2초 타임아웃, `showManualPastePanel` WebView (I-001)

## mcp/ — MCP 서버 (Phase 3 + 10 + 11)
- mcpServer.ts (~300줄) — `@modelcontextprotocol/sdk` 기반 HTTP MCP 서버, 포트 3700, 13개 도구 (`get_pending_completion` 추가 — Phase 11-4)

## bridge/ — WebSocket 브릿지 (Phase 4 + 7-9 + 11)
- wsBridgeServer.ts (~240줄) — WebSocket 서버, ACK 프로토콜, 재전송 큐, OutputChannel 로그, 연결 상태 모니터링 (Phase 7-3)
- bridgeProtocol.ts (~40줄) — 메시지 타입 정의 (ACK, AgentLoopPhase, AgentLoopAutoApplyMode)
- agentLoop.ts (~300줄) — Phase-aware 에이전트 루프 (Analyze→Request→Waiting→Apply→Verify), 3모드 자동 적용, 이전 시도 히스토리 (Phase 9)
- promptBuilder.ts (~100줄) — 구조화된 에러 수정 프롬프트 빌더, 반복 히스토리 포함 (Phase 9-1)
- backgroundAgent.ts (~200줄) — 백그라운드 에이전트, 진단 모니터링 → 자동 Agent Loop 트리거, 디바운스/쿨다운/연속 실행 제한, 상태바 표시 (Phase 11-1)

## providers/ — VS Code 프로바이더 (Phase 11)
- inlineCompletionProvider.ts (~180줄) — InlineCompletionItemProvider, 의도적 트리거 전용(D18), 캐시, bridge/MCP 소스, `triggerInlineCompletion` 수동 커맨드 (Phase 11-2)
- completionContextBuilder.ts (~130줄) — 인라인 완성용 컨텍스트 빌더, 커서 전후 코드 + LSP 심볼 + 진단 + 규칙, 토큰 버짓 2000 (Phase 11-3)

## commands/ — 명령 모듈
- fixWithAI.ts (~100줄) — 원클릭 에러 수정 워크플로우 (Phase 8-3)

## browser-extension/ (프로젝트 루트)
- manifest.json — Manifest V3, 5개 AI챗 사이트 호스트 퍼미션
- content.js (~200줄) — MutationObserver 코드 블록 감지, 셀렉터 폴백 체인, 셀렉터 테스트, AI챗 입력창 자동화 (Phase 7-2)
- background.js (~130줄) — WebSocket 연결, 지수 백오프 재연결, ACK 지원, 메시지 라우팅 (Phase 7-3)
- popup.html/js (~120줄) — 연결 상태 표시 + 포트 설정 + 셀렉터 테스트 버튼 (Phase 7-2)
- README.md — 설치/사용 가이드, WebSocket 프로토콜 설명
- icons/ — icon16.png, icon48.png, icon128.png (확장 아이콘)

## scripts/ — 빌드 스크립트
- build-browser-ext.js — browser-extension/ → dist/codebreeze-bridge.crx + .zip 패키징

## dist/ — 빌드 아티팩트
- codebreeze-bridge.crx — Chrome 확장 CRX 파일 (사이드로딩용)
- codebreeze-bridge.zip — Chrome 확장 ZIP 파일 (unpacked 로드용)

## test/suite/ — 테스트
- markdownParser.test.ts — 마크다운 파서 테스트
- markdownParserExtended.test.ts — 확장 파서 테스트
- markdownParserPhase7.test.ts — 불완전 블록, 청크 파싱, edge cases (Phase 7-4)
- markdownUtils.test.ts — 마크다운 유틸 테스트
- diffDetector.test.ts — diff 감지 테스트
- diffDetectorExtended.test.ts — 확장 diff 테스트
- diffPreview.test.ts — diff 미리보기 테스트
- types.test.ts — 타입 검증 테스트
- collectUtils.test.ts — collect 유틸 테스트
- projectMapCollector.test.ts — 프로젝트 맵 테스트
- mcpServer.test.ts — MCP 서버 테스트
- bridgeProtocol.test.ts — 브릿지 프로토콜 타입 테스트
- bridgeProtocolPhase7.test.ts — AgentLoopPhase, AutoApplyMode 타입 (Phase 7-9)
- agentLoop.test.ts — 에이전트 루프 기본 테스트
- promptBuilder.test.ts — 프롬프트 빌더 테스트 (Phase 9-1)
- rulesLoader.test.ts — 프로젝트 규칙 로더 테스트 (Phase 8-2)
- lspIndexer.test.ts — LSP 심볼 인덱서 테스트 (Phase 10-1)
- lspReferences.test.ts — LSP 참조/콜 계층 테스트 (Phase 10-2)
- mcpServerPhase10.test.ts — MCP 서버 Phase 10 도구 테스트 (Phase 10-3)
- backgroundAgent.test.ts — 백그라운드 에이전트 테스트 (Phase 11-1)
- inlineCompletion.test.ts — 인라인 완성 + 컨텍스트 빌더 테스트 (Phase 11-2/3)

## 규칙
- 1파일 300줄 이하 목표, 초과 시 분할 검토
- chatPanelHtml.ts 예외 (HTML 템플릿 특성상)
- 외부 명령 → utils/exec.ts의 execAsync 사용
- AI 서비스 특정 코드 금지 (범용 클립보드/MCP만 사용)
s