# 변경 이력

## 최근 (최신 3건만 유지 — 이전 항목은 .ai/changelog-archive.md로 이동)

### 2026-03-17 — Phase 1 안정화 (에러 경로 + clipboardCompat 연동)
- **B-002 수정**: safetyGuard stash ref → `stash@{0}` 직접 사용 (git stash list 파싱 제거)
- **B-003 수정**: clipboardCompat.ts를 chatPanel.ts, clipboardApply.ts에 연동 (20+ 직접 호출 중 핵심 경로 교체)
- **B-004 수정**: autoWatch setInterval 내 try/catch 추가 (silent failure 방지)
- **B-005 수정**: chatPanel message handler 에러 처리 추가 (applyBlock, sendContext, previewBlock)
- **B-006 수정**: fileMatcher `resolveOrCreateFile` 부모 디렉토리 자동 생성
- **B-007 수정**: clipboardApply `applyFromClipboard` 전체 try/catch 래핑 + skip 사유 로깅
- **B-008 수정**: patchApplier temp 파일 `Date.now()` 기반 유니크 이름
- clipboardCompat에 2초 타임아웃 추가 (code-server 행 방지)
- findFiles exclude에 dist/out/.git 추가

### 2026-03-16 — MCP 서버, WebSocket 브릿지, 오픈소스 라이브러리 교체
- **Phase 3 MCP 서버** (src/mcp/mcpServer.ts): `@modelcontextprotocol/sdk` 공식 라이브러리 사용, 9개 도구 (read_file, write_file, list_files, get_errors, get_git_diff, run_build, apply_code, get_project_map, apply_code_headless), 포트 3700
- **Phase 4 WebSocket 브릿지** (src/bridge/wsBridgeServer.ts): `ws` 라이브러리로 교체 (커스텀 RFC 6455 프레임 파서 제거), `noServer` 모드 + `handleUpgrade` 패턴, 포트 3701
- **I-001 code-server 클립보드 폴백** (src/utils/clipboardCompat.ts): VS Code clipboard API 실패 시 `.codebreeze-clipboard.md` 파일 기반 폴백, `showManualPastePanel` WebView textarea
- **I-002 프로젝트 맵** (src/collect/projectMapCollector.ts): 8개 언어(TS/JS/Py/Kotlin/Java/Go/Rust/TSX) 정규식 기반 심볼 추출, 200파일 한도, `codebreeze.copyProjectMap` 커맨드
- **I-003 diff 미리보기** (src/apply/diffPreview.ts): `diff` npm 패키지 `diffLines` 사용, ±3줄 컨텍스트 축소, 코드 블록별 인라인 diff 표시
- **fix/bug-batch-01 squash 머지**: 컨트롤 패널 열기 오류 수정 (simpleBrowser → openExternal)
- **패키징 수정**: .vscodeignore에 ws, @modelcontextprotocol, zod 등 런타임 패키지 화이트리스트 추가
- **테스트**: 56개 통과 (projectMapCollector 7개, diffPreview 10개, mcpServer 10개 신규)
- **가이드**: docs/code-server-guide.md 작성 (web, code-server, Termux+code-server 실행 방법)

### 2026-03-15 — Collect 흐름 완성 + GitHub API 개선
- lint warning 8개 → 0 (fs/CodeBlock/url/config/prevCommit/workspaceRoot/warnings/copyMultipleFilesForAI 미사용 제거)
- gitEventMonitor: `prevCommit` 활용하여 HEAD hash 변경 시에만 'commit' 이벤트 발행
- githubLogCollector: `githubToken` 선택사항으로 변경 — public 레포는 토큰 없이 조회 가능
- `copyMultipleFilesForAI` 커맨드 등록 + explorer/context 다중 선택 메뉴 추가
- 신규 테스트: `test/suite/collectUtils.test.ts` 10개

### 2026-03-15 — 단위테스트 + CI 강화
- 테스트 4파일 추가: markdownUtils, diffDetectorExtended, markdownParserExtended, types
- 기존 11개 + 신규 34개 = 총 45개 테스트, 전부 통과
- CI에 `xvfb-run -a npm test` 단계 추가
- VSIX 패키징 수정: package.json main 경로 out/src/extension.js
