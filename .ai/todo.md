# 할일 (2026-03-18)

## 완료 — Phase 7: 실 환경 검증 + 브라우저 브릿지 실전화
- [x] Task 7-2: Genspark 셀렉터 검증 및 강화
  - content.js SITE_CONFIG 셀렉터 폴백 체인 구현 (배열 기반 다단계)
  - queryWithFallback / queryOneWithFallback 헬퍼 함수
  - 범용 폴백 셀렉터 (`pre > code, [class*="code-block"]`)
  - 셀렉터 version 필드 추가 (2026-03-18)
  - popup.html "Test Selectors" 버튼 + content.js testSelectors 핸들러
  - 코드 블록 중복 감지 (Set 기반 dedup)
- [x] Task 7-3: 브릿지 신뢰성 개선
  - OutputChannel 기반 브릿지 통신 로그 ('CodeBreeze Bridge' 채널)
  - ACK 프로토콜: msgId 기반 메시지 확인
  - 메시지 재전송 큐: ACK 미수신 시 최대 3회 재전송 (5초 타임아웃)
  - 연결 상태 모니터링: getBridgeConnectionState() 함수
  - 상태바 클라이언트 수 표시
  - background.js ACK 지원 + 메시지 ID 자동 부여
- [x] Task 7-4: 클립보드 파싱 강화
  - 불완전 코드 블록 감지 (닫는 ``` 없는 경우 경고 + 최선 추측 적용)
  - 대용량 클립보드 처리 (100KB+ 청크 파싱)
  - 코드 블록 경계 기반 청크 분할

## 완료 — Phase 8: VS Code 네이티브 통합 + 프로젝트 규칙
- [x] Task 8-1: VS Code diff editor 통합
  - nativeDiffPreview.ts 신규 (~100줄)
  - vscode.diff 명령으로 적용 전/후 비교 UI
  - Accept/Reject 프롬프트
  - 멀티 파일 일괄 diff: QuickPick 선택 → 개별 diff 탭
  - diffPreviewMode 설정: 'native' (기본) / 'inline'
- [x] Task 8-2: 프로젝트 규칙 시스템
  - rulesLoader.ts 신규 (~60줄): .codebreeze-rules.md 로드, 캐시, 포맷
  - smartContext.ts: buildSmartContext + buildContextPayload에 규칙 자동 prepend
  - rulesFile 설정: 규칙 파일 경로 커스텀
- [x] Task 8-3: 원클릭 에러 수정 워크플로우
  - fixWithAI.ts 신규 (~100줄): 에러 컨텍스트 → AI 전송/클립보드
  - extension.ts 명령 등록 (codebreeze.fixErrorWithAI)
  - 단축키 Ctrl+Shift+F, 에디터 컨텍스트 메뉴 추가
  - 브릿지 연결/미연결 분기 처리

## 완료 — Phase 9: Agent Loop 고도화
- [x] Task 9-1: Agent Loop 다단계 전략
  - promptBuilder.ts 신규 (~100줄): buildErrorFixPrompt, buildIterationPrompt, buildErrorChainMarkdown, summarizeErrors
  - agentLoop.ts 리팩터: Phase-aware 루프 (Analyze → Request → Waiting → Apply → Verify)
  - 이전 시도 히스토리 (IterationRecord) 누적 전송
- [x] Task 9-2: Agent Loop 자동 적용 모드
  - agentLoopAutoApply 설정: 'preview' (기본) / 'auto' / 'safe'
  - preview: nativeDiffPreview로 사용자 확인
  - safe: 적용 → 빌드+테스트 → 실패 시 자동 undo
- [x] Task 9-3: Agent Loop 진행 상황 UI
  - agentLoopProgress 메시지: iteration, maxIterations, phase, elapsedSeconds
  - chatPanelScript.ts: 프로그레스 바 UI (단계, 시간, 진행률)

## 신규 테스트 (Phase 7-9)
- [x] promptBuilder.test.ts — 7개 (buildErrorFixPrompt, buildIterationPrompt, summarizeErrors)
- [x] rulesLoader.test.ts — 4개 (loadProjectRules, formatProjectRulesSection, hasProjectRules, clearRulesCache)
- [x] markdownParserPhase7.test.ts — 9개 (incomplete blocks, chunked parsing, edge cases)
- [x] bridgeProtocolPhase7.test.ts — 3개 (AgentLoopPhase, AgentLoopAutoApplyMode, defaults)

## 남은 검증 작업 (Task 7-1, 사용자 별도 진행)
- [ ] Collect 흐름 테스트: Ctrl+Shift+C → 클립보드에 마크다운 포맷 확인
- [ ] 컨트롤 패널(Ctrl+Shift+I) WebView 로드 확인
- [ ] Bridge 탭 UI 렌더링 확인 + Agent Loop 시작/중지 테스트
- [ ] code-server 환경 실제 테스트 (clipboardCompat 폴백 검증)
- [ ] 브라우저 확장 Chrome 로드 테스트
- [ ] Windows 10 VS Code 환경 테스트 (경로 호환 확인)
- [ ] Termux 태블릿 code-server 테스트

## 완료 — Phase 10: LSP 기반 코드베이스 인덱싱
- [x] Task 10-1: LSP 심볼 인덱서
  - lspIndexer.ts 신규 (~200줄): DocumentSymbolProvider 기반 심볼 추출
  - 증분 업데이트: onDidSaveTextDocument 감지
  - 워크스페이스 전체 인덱싱 (300파일, 60초 캐시)
  - searchSymbols(), getLspProjectMap(), getAllSymbolsFlat()
- [x] Task 10-2: 참조 추적 + 콜 계층
  - lspReferences.ts 신규 (~170줄): ReferenceProvider + CallHierarchyProvider
  - findReferences(), getCallHierarchy(), findReferencesByName()
  - 마크다운 포맷터: formatReferencesMarkdown(), formatCallHierarchyMarkdown()
- [x] Task 10-3: MCP 도구 확장
  - search_symbols, find_references, get_lsp_project_map 도구 추가
  - MCP 도구 수 9 → 12개
- [x] Task 10-4: Smart Context 자동 선택 모드
  - smartContextMode 설정: 'manual' (기본) / 'auto'
  - auto 모드: LSP 맵 + 에러 심볼 참조 자동 수집
  - buildContextPayload에 'lspProjectMap' 타입 추가

## 신규 테스트 (Phase 10)
- [x] lspIndexer.test.ts — 8개 (SymbolEntry, FileIndex, search, flatten)
- [x] lspReferences.test.ts — 7개 (ReferenceResult, CallHierarchy, format, limits)
- [x] mcpServerPhase10.test.ts — 7개 (search_symbols, find_references, get_lsp_project_map, health)

## 완료 — Phase 11: 백그라운드 Agent + 인라인 코드 완성
- [x] Task 11-1: 백그라운드 Agent
  - backgroundAgent.ts 신규 (~200줄): 진단 모니터링 → Agent Loop 자동 트리거
  - 5초 디바운스, 30초 최소 간격, 연속 3회 제한 + 60초 쿨다운
  - 상태바 표시 (idle/watching/triggered/running/cooldown)
  - backgroundAgentMode, backgroundAgentTrigger 설정
- [x] Task 11-2: 인라인 코드 완성
  - inlineCompletionProvider.ts 신규 (~180줄): InlineCompletionItemProvider
  - D18: Invoke 트리거만 (자동 완성 비활성), 30초 캐시
  - triggerInlineCompletion 커맨드 (Ctrl+Shift+L)
  - inlineCompletionEnabled, inlineCompletionSource 설정
- [x] Task 11-3: 완성 컨텍스트 빌더
  - completionContextBuilder.ts 신규 (~130줄): 커서 위치 기반 컨텍스트
  - 코드 + 임포트 + LSP 심볼 + 진단 + 규칙, 토큰 버짓 2000
- [x] Task 11-4: MCP + UI 통합
  - get_pending_completion MCP 도구 추가 (12→13개)
  - 컨트롤 패널 toggleBackgroundAgent/triggerCompletion 핸들러

## 신규 테스트 (Phase 11)
- [x] backgroundAgent.test.ts — 9개 (상태, 타이밍, 설정)
- [x] inlineCompletion.test.ts — 11개 (캐시, 소스, 컨텍스트 빌더)

## 미구현 (중기 로드맵, Phase 12+)
- [ ] CLI + CI/CD + MCP 도구 확장 (Phase 12)
- [ ] 플러그인/커넥터 아키텍처 (Phase 13)
