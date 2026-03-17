# 소스 파일 인덱스

경로: src/

## 진입점
- extension.ts (~120줄) — activate/deactivate, 명령 등록, 모니터 초기화, 사이드바 등록
- config.ts (~60줄) — CodeBreezeConfig 인터페이스, VS Code 설정 + .codebreeze.json 병합
- types.ts (~55줄) — CodeBlock, ApplyResult, HistoryEntry, BuildResult, ParsedError, ContextPayload('projectMap' 포함), MonitorEvent

## apply/ — AI챗 → VS Code
- clipboardApply.ts (~190줄) — 메인 적용 흐름: 클립보드 읽기 → 파싱 → 매칭 → 적용; `applyCodeBlocksHeadless()` MCP용 비대화형 적용; clipboardCompat 연동, 전체 try/catch
- markdownParser.ts (~70줄) — 마크다운 텍스트에서 코드 블록 추출
- diffDetector.ts (~30줄) — 코드 블록 내용이 unified diff인지 판별
- fileMatcher.ts (~70줄) — 파일 경로를 워크스페이스 파일에 매칭 (glob, 부분 경로); 부모 디렉토리 자동 생성
- patchApplier.ts (~55줄) — unified diff를 파일에 적용 (diff 라이브러리)
- safetyGuard.ts (~65줄) — git stash 백업, 히스토리 기록, undo 복원
- diffPreview.ts (~110줄) — `diff` 패키지 `diffLines` 사용, ±3줄 컨텍스트 축소, `BlockDiff` 반환 (I-003)

## collect/ — VS Code → AI챗
- fileCopy.ts (~90줄) — 파일/선택영역/다중파일 → 마크다운 코드 블록 → 클립보드
- gitCollector.ts (~85줄) — git diff/log → 마크다운 → 클립보드
- errorCollector.ts (~80줄) — Problems 에러 + 주변 코드 → 클립보드
- localBuildCollector.ts (~200줄) — 빌드/테스트 실행, 출력 캡처, 에러 파싱 (TS/ESLint/GCC/Java/Python/Gradle/Swift/Rust/Go), 결과 저장
- githubLogCollector.ts (~140줄) — GitHub REST API로 워크플로우 로그 다운로드 + 에러 추출
- smartContext.ts (~140줄) — 현재 파일 + 에러 + git diff 자동 조합; 'projectMap' 케이스 포함
- projectMapCollector.ts (~160줄) — 8개 언어 정규식 심볼 추출, 200파일 한도, `codebreeze.copyProjectMap` (I-002)

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

## mcp/ — MCP 서버 (Phase 3)
- mcpServer.ts (~220줄) — `@modelcontextprotocol/sdk` 기반 HTTP MCP 서버, 포트 3700, 9개 도구

## bridge/ — WebSocket 브릿지 (Phase 4)
- wsBridgeServer.ts (~200줄) — WebSocket 서버, ai_response/send_to_ai 핸들러, getConnectionCount()
- bridgeProtocol.ts (~60줄) — 메시지 타입 정의 (BrowserToVSCode, VSCodeToBrowser, BridgeCodeBlock, DEFAULT_AGENT_LOOP_MAX_ITERATIONS)
- agentLoop.ts (~140줄) — 자동 에이전트 루프 (빌드→에러→AI재전송, codebreeze.agentLoopMaxIterations 설정)

## browser-extension/ (프로젝트 루트)
- manifest.json — Manifest V3, 5개 AI챗 사이트 호스트 퍼미션
- content.js (~180줄) — MutationObserver 코드 블록 감지, AI챗 입력창 자동화
- background.js (~120줄) — WebSocket 연결, 지수 백오프 재연결, 메시지 라우팅
- popup.html/js (~100줄) — 연결 상태 표시 + 포트 설정
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
- markdownUtils.test.ts — 마크다운 유틸 테스트
- diffDetector.test.ts — diff 감지 테스트
- diffDetectorExtended.test.ts — 확장 diff 테스트
- diffPreview.test.ts — diff 미리보기 테스트
- types.test.ts — 타입 검증 테스트
- collectUtils.test.ts — collect 유틸 테스트
- projectMapCollector.test.ts — 프로젝트 맵 테스트
- mcpServer.test.ts — MCP 서버 테스트
- bridgeProtocol.test.ts — 브릿지 프로토콜 타입 테스트
- agentLoop.test.ts — 에이전트 루프 기본 테스트

## 규칙
- 1파일 300줄 이하 목표, 초과 시 분할 검토
- chatPanelHtml.ts 예외 (HTML 템플릿 특성상)
- 외부 명령 → utils/exec.ts의 execAsync 사용
- AI 서비스 특정 코드 금지 (범용 클립보드/MCP만 사용)
s