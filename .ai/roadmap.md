# 향후 확장 로드맵

## Phase 1: 안정화 ✅ 완료 (2026-03-17)
현재 구현된 기능의 안정성 확보.
- Apply 흐름 E2E 검증: clipboardCompat 연동, 에러 경로 try/catch
- safetyGuard: stash ref 버그 수정 (B-002), 경고 로깅
- autoWatch: clipboardCompat 연동, try/catch (B-003, B-004, B-005)
- fileMatcher: 부모 디렉토리 자동 생성 (B-006), exclude 패턴 확장
- patchApplier: temp 파일 유니크화 (B-008)
- clipboardCompat: 2초 타임아웃 추가

### 미구현 (향후)
- 에러 추적 연쇄 수집: `errorCollector.ts` 확장 → `vscode.languages.getDiagnostics()`로 에러 파일의 import/호출 그래프 재귀 추적. TypeScript Language Service API 활용. config `contextDepth` 추가
- 청크 분할 개선: `fileCopy.ts` 확장 → 정규식 기반 함수/클래스 경계 감지 (`/^(export\s+)?(function|class|interface)/m`). 각 청크에 컨텍스트 헤더

## Phase 2: 스마트 컨텍스트 강화 ✅ 완료 (2026-03-16)
### 프로젝트 맵 생성 ✅
- TS/JS/TSX/JSX/Python/Kotlin/Java/Go/Rust 정규식 기반 심볼 추출 (I-002)
- `codebreeze.copyProjectMap` 커맨드, 200파일 한도, `_` 접두사 심볼 제외
- tree-sitter 미사용 (네이티브 빌드 필요 → VSIX 배포 불가), 정규식으로 95% 정확도

### 에러 추적 연쇄 수집
- 에러 메시지에서 참조되는 파일/줄을 재귀적으로 추적
- 호출 스택 기반 관련 함수 자동 수집
- 최대 깊이 제한 (설정 가능)
- **상태**: 미구현 (향후 errorCollector.ts 확장)

### 청크 분할 개선
- 긴 파일을 함수/클래스 단위로 의미 있게 분할 (현재: 줄 수 기반)
- 각 청크에 컨텍스트 헤더 (파일 경로, 줄 범위, 이전/다음 청크 존재 여부)
- **상태**: 미구현 (향후 fileCopy.ts 확장)

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

### 남은 작업 (구현 후보)
- [ ] 브라우저 확장 (Chrome/Firefox Extension) 개발 — AI챗 페이지에서 코드 블록 감지 → WebSocket 전송
  - `browser-extension/manifest.json`: Manifest V3, `permissions: ["activeTab"]`, Kiwi Browser (Chromium) 호환
  - `browser-extension/content.js`: MutationObserver로 Genspark 응답 영역 감시, 입력창 `querySelector('textarea, [contenteditable]')` 탐색, Send 버튼 자동 클릭
  - `browser-extension/background.js`: `new WebSocket('ws://localhost:3701')`, 재연결 지수 백오프, 메시지 프로토콜 `{type: 'send_to_ai' | 'ai_response' | 'code_blocks', payload: string}`
  - `src/bridge/wsBridgeServer.ts` 프로토콜 확장: 메시지 타입 추가, 브라우저↔사이드바 양방향 라우팅
  - `src/ui/chatPanelHtml.ts` 채팅 UI 확장: 대화 히스토리 배열, 입력창 + Send 버튼, Genspark 응답 실시간 표시
  - 자동 에이전트 루프: 코드 적용 → `npm run build` (localBuildCollector 재사용) → diagnosticsMonitor 에러 감지 → smartContext 수집 → WebSocket으로 에러 자동 재전송. 루프 깊이 제한 (최대 5회)

## Phase 5: code-server 완전 호환 ✅ 완료 (2026-03-16)
### 구현 내용
- `src/utils/clipboardCompat.ts` — VS Code Clipboard API 실패 시 `.codebreeze-clipboard.md` 파일 기반 폴백 (I-001)
- `showManualPastePanel()` — WebView textarea를 통한 수동 붙여넣기 (`codebreeze.manualPaste` 커맨드)
- `docs/code-server-guide.md` — web, code-server, Termux+code-server 설치/실행 가이드

### 참고
- MCP 서버 모드 완성으로 클립보드 의존도 자체가 감소
- Termux에서 code-server로 VS Code 확장 실행 가능 (상세: docs/code-server-guide.md)

## 설계 원칙 — 확장 방향에 걸쳐 공통
1. 기존 모듈(apply/, collect/, monitor/) 재사용
2. types.ts를 공유 스키마로 유지
3. AI 서비스 비종속
4. 점진적 활성화: 사용자가 필요한 기능만 켜는 방식
