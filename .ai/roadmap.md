# 향후 확장 로드맵

## Phase 1: 안정화 ✅ 완료 (2026-03-17)
현재 구현된 기능의 안정성 확보.
- Apply 흐름 E2E 검증: clipboardCompat 연동, 에러 경로 try/catch
- safetyGuard: stash ref 버그 수정 (B-002), 경고 로깅
- autoWatch: clipboardCompat 연동, try/catch (B-003, B-004, B-005)
- fileMatcher: 부모 디렉토리 자동 생성 (B-006), exclude 패턴 확장
- patchApplier: temp 파일 유니크화 (B-008)
- clipboardCompat: 2초 타임아웃 추가

### 구현 완료 (2026-03-17)
- [x] 에러 추적 연쇄 수집: `errorChainCollector.ts` — import/require 체인 추적, 순환 참조 방지, 설정 가능한 깊이 (`errorChainDepth`)
- [x] 청크 분할 개선: `chunkSplitter.ts` — 정규식 기반 함수/클래스/인터페이스 경계 감지 (TS/JS/Python/Go/Rust/Java/Kotlin), 폴백 줄 수 분할

## Phase 2: 스마트 컨텍스트 강화 ✅ 완료 (2026-03-16)
### 프로젝트 맵 생성 ✅
- TS/JS/TSX/JSX/Python/Kotlin/Java/Go/Rust 정규식 기반 심볼 추출 (I-002)
- `codebreeze.copyProjectMap` 커맨드, 200파일 한도, `_` 접두사 심볼 제외
- tree-sitter 미사용 (네이티브 빌드 필요 → VSIX 배포 불가), 정규식으로 95% 정확도

### 에러 추적 연쇄 수집 ✅ 완료 (2026-03-17)
- `src/collect/errorChainCollector.ts` — import/require 체인 추적
- 지원: ES import, CommonJS require, Python import, C/C++ include, Go import, Rust use/mod
- 순환 참조 방지 (visited Set), 설정 가능한 깊이 (`codebreeze.errorChainDepth`, 기본 2)
- Agent loop에서 에러 파일의 관련 파일도 AI에 컨텍스트로 전송

### 청크 분할 개선 ✅ 완료 (2026-03-17)
- `src/collect/chunkSplitter.ts` — 함수/클래스/인터페이스 경계 감지
- 지원 언어: TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin
- 각 청크에 `startLine`, `endLine`, `name`, `kind` 메타데이터
- `fileCopy.ts`에 `buildChunkedFileMarkdown()` 함수 추가
- 경계 미감지 시 기존 줄 수 기반 폴백

## Phase 3: MCP 서버 모드 ✅ 완료 (2026-03-16)
### 구현 내용
- `src/mcp/mcpServer.ts` — `@modelcontextprotocol/sdk` 공식 라이브러리 기반
- `McpServer` + `StreamableHTTPServerTransport` 사용 (커스텀 JSON-RPC 제거)
- 포트 3700 (`codebreeze.mcpPort` 설정), localhost 전용
- **9개 도구**: `read_file`, `write_file`, `list_files`, `get_errors`, `get_git_diff`, `run_build`, `apply_code`, `get_project_map`, `apply_code_headless`
- `/health` 엔드포인트 (상태 확인용)
- 커맨드: `codebreeze.startMcpServer`, `codebreeze.stopMcpServer`

### 연결 방법
Claude Desktop `~/.claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "codebreeze": {
      "url": "http://localhost:3700/mcp"
    }
  }
}
```

### 남은 작업 (구현 후보)
- [ ] MCP transport per-request 패턴: `StreamableHTTPServerTransport` 인스턴스를 요청별로 생성 (현재 단일 인스턴스 재사용 → stateless 완전 지원)
- [ ] 인증 토큰: `codebreeze.mcpToken` 설정 추가, HTTP 미들웨어에서 `Authorization: Bearer <token>` 검증, 토큰 없으면 localhost만 허용 (현재 동작 유지)
- [ ] MCP 클라이언트 내장 (신규 `src/mcp/mcpClient.ts`): `@anthropic-ai/sdk` 또는 `openai` SDK로 AI API 직접 호출. 설정으로 provider 선택 (claude/openai/ollama). 사이드바 채팅 UI와 연동
- [ ] 도구 추가: `search_symbols` (projectMapCollector 재사용), `run_test` (localBuildCollector), `refactor` (VS Code rename API)

## Phase 4: WebSocket 브릿지 ✅ 완료 (2026-03-16)
### 구현 내용
- `src/bridge/wsBridgeServer.ts` — `ws` 라이브러리 기반 (커스텀 RFC 6455 프레임 파서 제거)
- 포트 3701 (`codebreeze.wsBridgePort` 설정), `noServer` + `handleUpgrade` 패턴
- `broadcastToBrowser()` 함수로 연결된 모든 클라이언트에 브로드캐스트
- 커맨드: `codebreeze.startWsBridge`, `codebreeze.stopWsBridge`
- src/bridge/bridgeProtocol.ts — 양방향 메시지 타입 정의 (BrowserToVSCode, VSCodeToBrowser)
- src/bridge/agentLoop.ts — 자동 에이전트 루프 (빌드→에러→AI재전송, 최대 5회 반복)

### 남은 작업 (구현 후보)
브라우저 확장 (browser-extension/)
Chrome Manifest V3, 5개 AI챗 사이트 지원 (Genspark, ChatGPT, Claude, Gemini)
content.js: MutationObserver 기반 코드 블록 감지, Site-specific selectors, 1.5초 디바운스
background.js: WebSocket 연결, 지수 백오프 재연결 (최대 10회), 메시지 라우팅
popup.html/js: 연결 상태 표시 + 포트 설정
UI 확장
chatPanelHtml.ts: Bridge 탭 추가 (대화 히스토리, 입력창, Agent Loop 버튼)
chatPanel.ts: Bridge 관련 메시지 핸들러 (startBridge, stopBridge, bridgeSendToAI, bridgeSendContext, startAgentLoop)

### 완료 (2026-03-17)
- [x] browser-extension/icons/ 아이콘 생성 (16/48/128px PNG)
- [x] Agent Loop 반복 횟수 설정화 (`codebreeze.agentLoopMaxIterations`, 1-20, 기본 5)
- [x] CRX/ZIP 빌드 스크립트 (`scripts/build-browser-ext.js`, `npm run build:browser-ext`)
- [x] 컨트롤 패널 secondarySidebar → panel 이동 (WebView 로드 이슈 해결)
- [x] localBuildCollector 다양한 빌드 도구 에러 포맷 파서 추가 (GCC/Clang, Java/Kotlin, Python, Gradle/Maven, Swift)
- [x] I-004: Marketplace 아이콘 등록 (`resources/icon.png`)

### 남은 작업 (구현 후보)
- [ ] Firefox 확장 호환 (manifest V2 변환)
- [ ] 브라우저 확장 Chrome Web Store 배포

## Phase 5: code-server 완전 호환 ✅ 완료 (2026-03-16)
### 구현 내용
- `src/utils/clipboardCompat.ts` — VS Code Clipboard API 실패 시 `.codebreeze-clipboard.md` 파일 기반 폴백 (I-001)s
- `showManualPastePanel()` — WebView textarea를 통한 수동 붙여넣기 (`codebreeze.manualPaste` 커맨드)
- `docs/code-server-guide.md` — web, code-server, Termux+code-server 설치/실행 가이드

### 참고
- MCP 서버 모드 완성으로 클립보드 의존도 자체가 감소
- Termux에서 code-server로 VS Code 확장 실행 가능 (상세: docs/code-server-guide.md)

## Phase 6: Cursor-like 자동화 개선 ✅ 완료 (2026-03-17)
### 구현 내용
Cursor agent 수준의 자동화를 위한 개선사항 구현.

**Inline Diff Apply (부분 편집)**
- `src/apply/diffRangeCalculator.ts` — 순수 diff 범위 계산 (vscode 의존 없음, 테스트 가능)
- `src/apply/inlineDiffApply.ts` — 변경된 줄만 교체 (전체 파일 교체 대체)
- `codebreeze.applyMode` 설정: `'inline'` (기본) / `'wholefile'`
- 헤드리스 모드: `applyInlineDiffHeadless()` — MCP/agent loop용

**Agent Loop 개선**
- 테스트 명령 지원: 빌드 성공 후 `testCommands[0]` 자동 실행
- 조기 종료: 동일 에러 2회 반복 시 루프 중단 (에러 fingerprint)
- 타임아웃 설정: `codebreeze.agentLoopTimeout` (기본 300초)
- 에러 체인 컨텍스트: import 체인 파일도 AI에 전송
- Stop 버튼: `stopAgentLoop()` + 패널 UI 연동 (Agent Loop ↔ Stop Agent Loop 토글)

**chatPanelHtml.ts 분할** (644줄 → 300줄 이하)
- `chatPanelStyles.ts` (~170줄): CSS 스타일
- `chatPanelScript.ts` (~280줄): JavaScript
- `chatPanelHtml.ts` (~130줄): HTML 조립

**새 설정 4개** (package.json + config.ts)
- `applyMode`: inline/wholefile (D13)
- `agentLoopTimeout`: 30-1800초 (기본 300)
- `streamingDebounceMs`: 500-10000ms (기본 1500, D11 해결)
- `errorChainDepth`: 0-5 (기본 2, D14)

**크로스 플랫폼**
- `localBuildCollector.ts`: `path.join()` 사용 (Windows 경로 호환)
- `errorChainCollector.ts`: `path.resolve()`/`path.normalize()` 사용
- Termux 호환: `clipboardCompat.ts` 파일 기반 폴백 유지

**타입 추가**
- `types.ts`: `Chunk` 인터페이스
- `config.ts`: 4개 신규 설정 필드

### 남은 작업 (구현 후보)
- [x] VS Code diff editor 통합 → Phase 8-1에서 구현 완료
- [ ] 스트리밍 모드: AI 응답 토큰 단위 표시 (현재 완성 후 일괄)
- [x] 멀티 파일 일괄 diff 미리보기 → Phase 8-1에서 구현 완료

## Phase 7: 브라우저 브릿지 실전화 ✅ 완료 (2026-03-18)
### 구현 내용
- **셀렉터 폴백 체인** (Task 7-2): content.js SITE_CONFIG에 배열 기반 다단계 셀렉터, 범용 폴백, 셀렉터 version 필드, popup.html "Test Selectors" 버튼, 코드 블록 중복 감지
- **브릿지 신뢰성** (Task 7-3): OutputChannel 로그, ACK 프로토콜(msgId), 재전송 큐(최대 3회, 5초 타임아웃), `getBridgeConnectionState()`, 상태바 클라이언트 수 표시
- **클립보드 파싱 강화** (Task 7-4): 불완전 코드 블록 감지(경고 + 최선 추측), 대용량 청크 파싱(100KB+)

## Phase 8: VS Code 네이티브 통합 + 프로젝트 규칙 ✅ 완료 (2026-03-18)
### 구현 내용
- **VS Code diff editor** (Task 8-1): `nativeDiffPreview.ts`, `vscode.diff` 명령, Accept/Reject, 멀티 파일 일괄 diff, `diffPreviewMode` 설정
- **프로젝트 규칙 시스템** (Task 8-2): `rulesLoader.ts`, `.codebreeze-rules.md` 로드/캐시, Smart Context + Agent Loop 자동 prepend
- **원클릭 에러 수정** (Task 8-3): `fixWithAI.ts`, 에러+코드+규칙 조합 프롬프트, 브릿지/클립보드 분기, Ctrl+Shift+F

## Phase 9: Agent Loop 고도화 ✅ 완료 (2026-03-18)
### 구현 내용
- **다단계 전략** (Task 9-1): `promptBuilder.ts`, Phase-aware 루프 (Analyze→Request→Waiting→Apply→Verify), 이전 시도 히스토리 누적
- **자동 적용 모드** (Task 9-2): `agentLoopAutoApply` 설정 ('preview'/'auto'/'safe'), safe=테스트 통과 시만 적용
- **진행 상황 UI** (Task 9-3): 실시간 프로그레스 바 (단계, iteration, 시간 경과)

## Phase 10: LSP 기반 코드베이스 인덱싱 ✅ 완료 (2026-03-18)
### 구현 내용
- **LSP 심볼 인덱서** (Task 10-1): `lspIndexer.ts`, DocumentSymbolProvider 기반, 증분 업데이트, 300파일 워크스페이스 캐시, `searchSymbols`, `getLspProjectMap`
- **참조 추적 + 콜 계층** (Task 10-2): `lspReferences.ts`, ReferenceProvider + CallHierarchyProvider, `findReferencesByName`, 마크다운 포맷터
- **MCP 도구 확장** (Task 10-3): `search_symbols`, `find_references`, `get_lsp_project_map` 도구 추가 (9→12개)
- **Smart Context 자동 선택** (Task 10-4): `smartContextMode` 설정 ('manual'/'auto'), LSP 맵 + 에러 참조 자동 수집

## Phase 11: 백그라운드 Agent + 인라인 코드 완성 ✅ 완료 (2026-03-18)
### 구현 내용
- **백그라운드 Agent** (Task 11-1): `backgroundAgent.ts`, 진단 모니터링 + 자동 Agent Loop 트리거, 5초 디바운스, 30초 최소 간격, 연속 3회 제한 + 60초 쿨다운, 상태바 표시, `backgroundAgentMode`/`backgroundAgentTrigger` 설정
- **인라인 코드 완성** (Task 11-2): `inlineCompletionProvider.ts`, VS Code InlineCompletionItemProvider, D18에 따른 의도적 트리거 전용 (Invoke만), 30초 캐시, bridge/MCP 소스 선택
- **완성 컨텍스트 빌더** (Task 11-3): `completionContextBuilder.ts`, 커서 위치 기반 코드 + 임포트 + LSP 심볼 + 진단 + 규칙 조합, 토큰 버짓 (2000토큰)
- **MCP 도구** (Task 11-4): `get_pending_completion` 도구 추가 (12→13개)
- **UI**: 컨트롤 패널 Background Agent 토글 + Trigger Completion 버튼

### 남은 작업 (구현 후보, Phase 12+)
- [ ] CLI + CI/CD + MCP 도구 확장 (Phase 12)
- [ ] 플러그인/커넥터 아키텍처 (Phase 13)

## 설계 원칙 — 확장 방향에 걸쳐 공통
1. 기존 모듈(apply/, collect/, monitor/) 재사용
2. types.ts를 공유 스키마로 유지
3. AI 서비스 비종속
4. 점진적 활성화: 사용자가 필요한 기능만 켜는 방식
