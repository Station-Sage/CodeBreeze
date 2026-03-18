# 변경 이력

## 최근 (최신 3건만 유지 — 이전 항목은 .ai/changelog-archive.md로 이동)

### 2026-03-18 — Phase 10 구현 (LSP 기반 코드베이스 인덱싱)

#### Task 10-1: LSP 심볼 인덱서
- **lspIndexer.ts** 신규 (~200줄): `vscode.executeDocumentSymbolProvider`로 정확한 심볼 추출
- 증분 업데이트: `onDidSaveTextDocument` 감지, 파일 삭제 시 캐시 제거
- 워크스페이스 전체 인덱싱: `indexWorkspace()`, 300파일 한도, 60초 캐시
- `searchSymbols()`: 이름 패턴 + SymbolKind 필터 검색
- `getLspProjectMap()`: LSP 기반 프로젝트 맵 (종류별 레이블: ƒ함수, ◆클래스, ◇인터페이스 등)
- `getAllSymbolsFlat()`: MCP/외부 도구용 평탄화 심볼 목록

#### Task 10-2: 참조 추적 + 콜 계층
- **lspReferences.ts** 신규 (~170줄): `vscode.executeReferenceProvider` + `vscode.prepareCallHierarchy`
- `findReferences()`: 위치 기반 참조 검색 (최대 50개)
- `getCallHierarchy()`: 호출자(callers) + 피호출자(callees) 추적 (최대 30개)
- `findReferencesByName()`: 이름 기반 참조 검색 (MCP 도구용)
- `formatReferencesMarkdown()`, `formatCallHierarchyMarkdown()`: AI 컨텍스트용 마크다운 포맷터

#### Task 10-3: MCP 도구 확장
- `search_symbols` 도구: LSP 심볼 검색 (query 파라미터)
- `find_references` 도구: 심볼 참조 검색 (symbol + file 파라미터)
- `get_lsp_project_map` 도구: LSP 기반 프로젝트 맵
- MCP 도구 수: 9 → 12개

#### Task 10-4: Smart Context 자동 선택 모드
- `smartContextMode` 설정: 'manual' (기본) / 'auto'
- auto 모드: LSP 프로젝트 맵 + 에러 위치 심볼 참조 자동 수집
- `buildContextPayload()`에 'lspProjectMap' 타입 추가

#### 테스트 & 설정
- 새 설정 1개: `smartContextMode`
- 새 커맨드 2개: `indexWorkspace`, `copyLspProjectMap`
- 신규 테스트 ~20개: lspIndexer (8), lspReferences (7), mcpServerPhase10 (7)
- 설계 결정 1개: D19 (LSP 폴백 전략)

### 2026-03-18 — Phase 7-9 구현 (브릿지 실전화 + 네이티브 통합 + Agent Loop 고도화)

#### Phase 7: 브라우저 브릿지 실전화
- **셀렉터 폴백 체인** (Task 7-2): content.js SITE_CONFIG에 배열 기반 다단계 셀렉터. 1차 셀렉터 실패 시 범용 셀렉터(`pre > code, [class*="code-block"]`)로 폴백. 셀렉터 `version` 필드 + popup.html "Test Selectors" 버튼. 코드 블록 중복 감지(Set 기반 dedup)
- **브릿지 신뢰성** (Task 7-3): OutputChannel 로그(`CodeBreeze Bridge`), ACK 프로토콜(msgId 기반), 재전송 큐(최대 3회, 5초 타임아웃), `getBridgeConnectionState()`, 상태바 클라이언트 수 표시. background.js ACK 지원
- **클립보드 파싱 강화** (Task 7-4): 불완전 코드 블록 감지(닫는 ``` 없음 → 경고 + 최선 추측), 대용량 청크 파싱(100KB+ → 코드 블록 경계 기반 분할)

#### Phase 8: VS Code 네이티브 통합 + 프로젝트 규칙
- **VS Code diff editor** (Task 8-1): `nativeDiffPreview.ts` 신규, `vscode.diff` 명령 활용, Accept/Reject 프롬프트, 멀티 파일 일괄 diff, `diffPreviewMode` 설정 ('native'/'inline')
- **프로젝트 규칙 시스템** (Task 8-2): `rulesLoader.ts` 신규, `.codebreeze-rules.md` 로드/캐시, Smart Context와 Agent Loop에 자동 prepend, `rulesFile` 설정
- **원클릭 에러 수정** (Task 8-3): `fixWithAI.ts` 신규, 에러+코드+규칙 조합 프롬프트, 브릿지 연결 시 자동 전송, 미연결 시 클립보드, 단축키 Ctrl+Shift+F, 에디터 컨텍스트 메뉴

#### Phase 9: Agent Loop 고도화
- **다단계 전략** (Task 9-1): `promptBuilder.ts` 신규 (~100줄), Phase-aware 루프 (Analyze→Request→Waiting→Apply→Verify), 이전 시도 히스토리 누적(같은 실수 반복 방지), 구조화된 프롬프트 템플릿
- **자동 적용 모드** (Task 9-2): `agentLoopAutoApply` 설정 ('preview'/'auto'/'safe'). preview=diff editor 표시, auto=직접 적용, safe=테스트 통과 시만 적용+실패 시 자동 undo
- **진행 상황 UI** (Task 9-3): `agentLoopProgress` 메시지로 실시간 프로그레스 바 (단계, iteration, 시간 경과)

#### 테스트 & 설정
- 새 설정 3개: `diffPreviewMode`, `rulesFile`, `agentLoopAutoApply`
- 신규 테스트 23개: promptBuilder (7), rulesLoader (4), markdownParser Phase7 (9), bridgeProtocol Phase7 (3)
- 설계 결정 4개: D15 (프로젝트 규칙), D16 (커넥터 인터페이스), D17 (diff preview 이원화), D18 (인라인 완성 의도적 트리거)

### 2026-03-17 — Cursor-like 자동화 개선 (Phase 6)
- **에러 체인 추적**: `errorChainCollector.ts` 신규 — import/require 체인 추적 (ES, CommonJS, Python, C/C++, Go, Rust), 순환 참조 방지, 설정 가능한 깊이 (`errorChainDepth`)
- **청크 분할**: `chunkSplitter.ts` 신규 — 함수/클래스/인터페이스 경계 감지 (7개 언어), `fileCopy.ts`에 `buildChunkedFileMarkdown()` 추가
- **인라인 diff 적용**: `diffRangeCalculator.ts` + `inlineDiffApply.ts` 신규 — 변경된 줄만 교체 (전체 파일 교체 대체), `applyMode` 설정 (`inline`/`wholefile`)
- **Agent Loop 개선**: 테스트 명령 자동 실행, 동일 에러 2회 반복 시 조기 종료, 설정 가능한 타임아웃, 에러 체인 컨텍스트 전송, Stop 버튼 UI 연동
- **chatPanelHtml.ts 분할**: 644줄 → `chatPanelStyles.ts` (~170줄) + `chatPanelScript.ts` (~280줄) + `chatPanelHtml.ts` (~130줄)
- **새 설정 4개**: `applyMode`, `agentLoopTimeout`, `streamingDebounceMs`, `errorChainDepth`
- **테스트**: 37개 신규 — 전체 102개 통과

### 2026-03-17 — 컨트롤 패널 수정, 빌드 파서 개선, 아이콘 및 CRX 아티팩트
- **컨트롤 패널 수정**: `secondarySidebar` → `panel` (하단 패널) 이동
- **localBuildCollector 개선**: GCC/Clang, Java/Kotlin, Python traceback, Gradle/Maven, Swift 에러 포맷 파서 추가
- **Agent Loop 설정화**: `codebreeze.agentLoopMaxIterations` 설정 추가 (1-20, 기본 5)
- **I-004 구현**: `resources/icon.png` (128x128) 생성
- **CRX 빌드**: `scripts/build-browser-ext.js` 추가
