# 버그 목록

## B-001: Termux code-server activation 실패
- **발견**: 2026-03-17
- **증상**: 사이드바 "There is no data provider registered", 명령 실행 시 "command not found"
- **원인 1**: `@modelcontextprotocol/sdk` 의존성인 `fast-deep-equal`이 VSIX 번들에 누락 → extension.js 로드 시 크래시 → `activate()` 전체 실패
- **원인 2**: `src/extension.ts`에서 `mcpServer`/`wsBridgeServer`를 static import하여 모듈 로드 실패가 activation 전체를 중단시킴
- **수정**:
  - `src/extension.ts`: `mcpServer`, `wsBridgeServer` static import 제거 → dynamic import로 전환 (명령 실행 시점 로드)
  - `.vscodeignore`: `fast-deep-equal`, `ajv`, `json-schema-traverse` 화이트리스트 추가
  - `src/extension.ts`: commands 배열 중복 항목 제거
- **상태**: 수정 완료 (2026-03-17) — `fix/activation-events` 브랜치

## B-002: safetyGuard stash ref 추출 버그
- **발견**: 2026-03-17
- **증상**: `createUndoPoint`에서 `git stash list` 전체를 파싱하여 다른 stash 존재 시 잘못된 ref 반환
- **수정**: `stash@{0}` 직접 사용 (직전 push이므로 항상 정확)
- **상태**: 수정 완료 (2026-03-17)

## B-003: clipboardCompat 미연동 (code-server 폴백 미작동)
- **발견**: 2026-03-17
- **증상**: `clipboardCompat.ts`가 구현되었으나 모든 모듈에서 `vscode.env.clipboard` 직접 호출
- **수정**: `chatPanel.ts`, `clipboardApply.ts`에서 `readClipboard`/`writeClipboard` 사용으로 교체
- **상태**: 수정 완료 (2026-03-17)

## B-004: autoWatch 예외 시 silent failure
- **발견**: 2026-03-17
- **증상**: `startClipboardWatch` setInterval 내 `clipboard.readText()` 예외 시 interval 사망, UI 상태 불일치
- **수정**: try/catch 추가, 에러 로그, interval 유지
- **상태**: 수정 완료 (2026-03-17)

## B-005: chatPanel message handler 에러 처리 누락
- **발견**: 2026-03-17
- **증상**: `applyBlock`, `sendContext`, `previewBlock` 등 clipboard 호출에 try/catch 없음
- **수정**: 각 case에 개별 try/catch 추가
- **상태**: 수정 완료 (2026-03-17)

## B-006: fileMatcher 부모 디렉토리 미생성
- **발견**: 2026-03-17
- **증상**: `resolveOrCreateFile`에서 중첩 경로(`src/new/dir/file.ts`) 파일 생성 시 ENOENT
- **수정**: `createDirectory` 호출 추가
- **상태**: 수정 완료 (2026-03-17)

## B-007: clipboardApply 에러 경로 미처리
- **발견**: 2026-03-17
- **증상**: `detectContentType`, `parseClipboard`에 try/catch 없음 → 비정상 입력 시 크래시
- **수정**: 전체 흐름 try/catch 래핑, skip 사유 로깅
- **상태**: 수정 완료 (2026-03-17)

## B-008: patchApplier temp 파일 고정 이름
- **발견**: 2026-03-17
- **증상**: `.codebreeze-patch.diff` 고정 이름 → 동시 적용 시 충돌, 크래시 시 잔여 파일
- **수정**: `Date.now()` 기반 유니크 이름
- **상태**: 수정 완료 (2026-03-17)

---

# 개선사항

## I-001: code-server 클립보드 폴백
- 브라우저 환경에서 Clipboard API 실패 시 대체 수단 필요
- **상태**: 구현 완료 (2026-03-15)
  - `src/utils/clipboardCompat.ts`: 파일 기반 폴백 (.codebreeze-clipboard.md)
  - `codebreeze.manualPaste`: WebView 수동 붙여넣기 패널 (code-server/태블릿용)

## I-002: 프로젝트 맵 자동 생성
- 현재 스마트 컨텍스트는 에러 위치 기반 코드 수집만 지원
- **상태**: 구현 완료 (2026-03-15)
  - `src/collect/projectMapCollector.ts`: 정규식 기반 심볼 추출 (TS/JS/Py/Kotlin/Go/Rust)
  - 명령: `codebreeze.copyProjectMap`

## I-003: 컨트롤 패널 Receive 측 미리보기
- 코드 블록 적용 전 diff 미리보기 (현재 파일 vs 적용 후) 표시
- **상태**: 구현 완료 (2026-03-15)
  - `src/apply/diffPreview.ts`: diff 패키지 기반 인라인 diff
  - 컨트롤 패널 🔍 버튼으로 토글

## I-004: Marketplace 아이콘 등록
- 발견: 2026-03-15 (낮음, UX)
- resources/icon.png (128x128) 생성 후 package.json에 `"icon": "resources/icon.png"` 재추가 필요
- **상태**: 구현 완료 (2026-03-17)
  - `resources/icon.png`: 128x128 PNG 로봇 아이콘 생성
  - package.json에 `"icon": "resources/icon.png"` 추가

## B-009: 컨트롤 패널 Secondary Sidebar WebView 미로드
- **발견**: 2026-03-17
- **증상**: 컨트롤 패널 클릭 시 "Drag a view here to display" 메시지만 표시, WebView 렌더링 안 됨
- **원인**: `viewsContainers.secondarySidebar`는 VS Code proposed API (`contribSecondarySideBar`), 일반 확장에서 사용 불가
- **수정**: `secondarySidebar` → `panel` (하단 패널) viewsContainer로 이동. 안정적 API 사용
- **상태**: 수정 완료 (2026-03-17)

## B-010: chatPanel.ts / wsBridgeServer.ts 중복 함수 선언
- **발견**: 2026-03-17
- **증상**: `npm run compile` 시 `TS2393: Duplicate function implementation` 에러
- **원인**: `sendBridgeStatus` (chatPanel.ts), `getConnectionCount` (wsBridgeServer.ts) 각각 2회 선언
- **수정**: 중복 함수 선언 제거
- **상태**: 수정 완료 (2026-03-17)

## B-011: clipboardCompat isCodeServer() 환경 감지 실패
- **발견**: 2026-03-18
- **증상**: code-server (Android Kiwi Browser 등) 환경에서 `isCodeServer()` false → 클립보드 실패 시 fallback UI 미표시
- **원인**: `process.env.VSCODE_AGENT_FOLDER` / `CS_DISABLE_FILE_DOWNLOADS` 환경 변수가 모든 code-server 환경에 없음. `vscode.env.remoteName`은 Remote-SSH에서도 true.
- **수정**:
  - `isCodeServer()`: `vscode.env.uriScheme === 'http'/'https'` 기반 감지로 변경
  - `writeClipboard()`: clipboard write→readback 실패 캐싱, "Open Manual Paste" 버튼 추가
- **상태**: 수정 완료 (2026-03-18)

---

# 버그 감사 (Phase 1~11 전체 점검, 2026-03-18)

## B-014: inlineCompletionProvider requestViaBridge() dead code
- **발견**: 2026-03-18 (감사)
- **파일**: `src/providers/inlineCompletionProvider.ts:95-130`
- **증상**: `requestViaBridge()` 내부에서 `checkInterval`과 `timeout`을 설정한 직후(L127-128) 즉시 `clearInterval`/`clearTimeout`하고 `resolve(null)` 호출 → 항상 즉시 null 반환. bridge 응답을 대기하는 코드가 실질적으로 동작하지 않음. L112-113의 `require('../bridge/agentLoop')` dead code.
- **원인**: bridge 기반 completion은 비동기(AI 응답 타이밍 불확정)라 pull 방식으로 구현할 수 없음. 개발 중 미완성 상태로 즉시 null 반환으로 전환했으나 dead code 미제거.
- **심각도**: Critical (혼동 유발 + dead code)
- **상태**: 수정 완료 (2026-03-18)

## B-015: agentLoop stopAgentLoop()이 pending Promise 미해제
- **발견**: 2026-03-18 (감사)
- **파일**: `src/bridge/agentLoop.ts:341-347`
- **증상**: `stopAgentLoop()`이 `state.resolveResponse = null`로 설정하면, `waitForAIResponse()`에서 생성한 Promise가 resolve/reject 되지 않고 영원히 대기 → GC까지 메모리 누수, timeout 콜백도 아무 효과 없음
- **원인**: stopAgentLoop에서 resolveResponse를 null로 설정하지만, 해당 Promise의 reject를 호출하지 않음
- **심각도**: High
- **상태**: 수정 완료 (2026-03-18)

## B-016: backgroundAgent OutputChannel 매회 생성 누수
- **발견**: 2026-03-18 (감사)
- **파일**: `src/bridge/backgroundAgent.ts:169`
- **증상**: `tryTriggerAgentLoop()` 호출 시마다 `vscode.window.createOutputChannel('CodeBreeze Background Agent')` 새로 생성. 동일 이름 OutputChannel이 누적되며 dispose 안 됨.
- **원인**: OutputChannel을 state에 저장하지 않고 매번 로컬 변수로 생성
- **심각도**: High (메모리 누수)
- **상태**: 수정 완료 (2026-03-18)

## B-017: patchApplier path traversal 미검증
- **발견**: 2026-03-18 (감사)
- **파일**: `src/apply/patchApplier.ts:20-21`
- **증상**: diff 헤더에서 추출한 `targetFile`이 `../` 포함 시 workspace 외부 파일에 patch 적용 가능
- **원인**: `path.join(workspaceRoot, targetFile)` 결과가 workspaceRoot 내부인지 검증 없음
- **심각도**: High (보안 — path traversal)
- **상태**: 수정 완료 (2026-03-18)

## B-018: mcpServer read_file/write_file symlink bypass
- **발견**: 2026-03-18 (감사)
- **파일**: `src/mcp/mcpServer.ts:59-60, 69-70`
- **증상**: `path.join(root, relPath)` + `startsWith(root)` 검증은 symlink로 우회 가능. workspace 내 symlink가 외부를 가리키면 읽기/쓰기 가능.
- **원인**: symlink resolution 없이 string prefix 비교만 수행
- **심각도**: High (보안 — symlink traversal)
- **상태**: 수정 완료 (2026-03-18)

## B-019: exec.ts spawnAsync timeout 미존재
- **발견**: 2026-03-18 (감사)
- **파일**: `src/utils/exec.ts:14-52`
- **증상**: `spawnAsync()`로 실행된 프로세스가 hang 시 Promise가 영원히 resolve 되지 않음. Agent Loop 등에서 빌드 명령이 멈추면 전체 루프가 멈춤.
- **원인**: timeout 메커니즘 미구현, `proc.kill()` 로직 없음
- **심각도**: High (hang → 전체 기능 마비)
- **상태**: 수정 완료 (2026-03-18)

## B-020: safetyGuard stash 경합 조건
- **발견**: 2026-03-18 (감사)
- **파일**: `src/apply/safetyGuard.ts:22, 45`
- **증상**: `createUndoPoint()`가 `stash@{0}`을 저장하지만, undo 시점까지 사이에 다른 stash push가 발생하면 `git stash pop stash@{0}`이 잘못된 stash를 pop
- **원인**: stash ref가 positional (`stash@{0}`)이라 중간에 다른 stash 작업이 끼면 shift됨
- **심각도**: High (데이터 손실 가능)
- **상태**: 수정 완료 (2026-03-18)

## B-021: wsBridgeServer scheduleRetry 이중 setTimeout
- **발견**: 2026-03-18 (감사)
- **파일**: `src/bridge/wsBridgeServer.ts:194-225`
- **증상**: `scheduleRetry()` 내부에서 첫 번째 `setTimeout` 콜백(L195) 안에 다시 `setTimeout`(L211)을 설정. `pending.timer`가 두 번째 timer로 덮어써져 첫 번째 timer 참조 소실. `stopWsBridge()`에서 `clearTimeout(pending.timer)` 시 두 번째 timer만 해제, 첫 번째 계속 실행 가능.
- **원인**: retry 로직이 재귀적 setTimeout 대신 중첩 setTimeout 사용
- **심각도**: Medium (timer 누수, retry 중복)
- **상태**: 수정 완료 (2026-03-18)

## B-022: gitCollector gitLogCount 범위 미제한
- **발견**: 2026-03-18 (감사)
- **파일**: `src/collect/gitCollector.ts:52-53, 80-81`
- **증상**: `config.gitLogCount`가 매우 큰 값(e.g. 100000)이면 `git log --oneline -100000`이 실행되어 메모리 소모. package.json에 maximum 미설정.
- **원인**: 설정값 범위 제한 없음 (minimum/maximum 미지정)
- **심각도**: Medium
- **상태**: 수정 완료 (2026-03-18)

## B-023: lspReferences findReferences Promise.all 전체 실패
- **발견**: 2026-03-18 (감사)
- **파일**: `src/collect/lspReferences.ts:49-62`
- **증상**: `Promise.all()` 내부의 `openTextDocument` 하나라도 실패 시 전체 `findReferences()` 실패. 외부 try/catch에서 잡히지만 부분 결과 반환 불가.
- **원인**: `Promise.all` 사용 (하나 실패 → 전체 reject)
- **심각도**: Medium
- **상태**: 수정 완료 (2026-03-18)

## B-024: statusBarItem flashStatusBar 경합
- **발견**: 2026-03-18 (감사)
- **파일**: `src/ui/statusBarItem.ts:23-29`
- **증상**: `flashStatusBar()`를 빠르게 연속 호출하면 각각의 `setTimeout`이 서로 다른 `original` 값을 복원하려 함 → 이전 flash의 복원이 현재 flash 텍스트를 덮어씀
- **원인**: timeout ID 미저장, 이전 timeout 미취소
- **심각도**: Low (UI 깜빡임)
- **상태**: 수정 완료 (2026-03-18)

## B-025: mcpServer CORS wildcard
- **발견**: 2026-03-18 (감사)
- **파일**: `src/mcp/mcpServer.ts:294`
- **증상**: `Access-Control-Allow-Origin: *`로 모든 origin 허용. 악성 웹페이지에서 localhost:3700으로 CORS 요청 가능.
- **원인**: 개발 편의를 위해 wildcard 설정
- **심각도**: Medium (보안 — 127.0.0.1 바인딩으로 리스크 제한적이나, 브라우저 탭에서 접근 가능)
- **상태**: 수정 완료 (2026-03-18)

## B-026: content.js MutationObserver debounceTimer 미정리
- **발견**: 2026-03-18 (감사)
- **파일**: `browser-extension/content.js:184-220`
- **증상**: `debounceTimer`가 페이지 unload 시 정리되지 않음. SPA 라우팅이나 탭 전환 시 timer가 계속 실행 가능.
- **원인**: `beforeunload` 리스너 미등록, observer disconnect 시 timer 미정리
- **심각도**: Low (브라우저 확장 context에서 GC로 해결되지만, SPA에서는 누적 가능)
- **상태**: 수정 완료 (2026-03-18)

## B-027: githubLogCollector HTTP 상태 코드 미처리
- **발견**: 2026-03-18 (감사)
- **파일**: `src/collect/githubLogCollector.ts:122-133`
- **증상**: `githubGet()`에서 HTTP 4xx/5xx 응답을 에러로 처리하지 않음. 401 Unauthorized 시 빈 JSON 파싱 시도 → `JSON.parse` 실패 또는 빈 결과.
- **원인**: `https.get` 콜백에서 `res.statusCode` 미확인
- **심각도**: Medium
- **상태**: 수정 완료 (2026-03-18)

## B-028: chatPanel clipboardWatcher async 콜백 중첩
- **발견**: 2026-03-18 (감사)
- **파일**: `src/ui/chatPanel.ts:275-305`
- **증상**: `setInterval(async () => {...}, 1000)` — 이전 콜백의 비동기 작업이 1초 이내에 완료되지 않으면 다음 콜백이 중첩 실행됨. clipboard read + parse + postMessage가 동시에 여러 번 실행 가능.
- **원인**: setInterval은 이전 콜백 완료를 기다리지 않음
- **심각도**: Medium (중복 알림, 경합)
- **상태**: 수정 완료 (2026-03-18)

## B-029: gitEventMonitor activate() 미대기
- **발견**: 2026-03-18 (감사)
- **파일**: `src/monitor/gitEventMonitor.ts:60`
- **증상**: `activate()` async 함수를 await 없이 호출. git 확장이 아직 활성화 안 된 상태에서 실패 시 에러가 unhandled promise rejection.
- **원인**: `registerGitEventMonitor()` 내부에서 `activate()`를 fire-and-forget 호출
- **심각도**: Low (git 확장이 보통 빨리 활성화되므로 실제 문제 희소)
- **상태**: 수정 완료 (2026-03-18)

## B-030: nativeDiffPreview pending 파일 crash 시 잔존
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/apply/nativeDiffPreview.ts:33-36`
- **증상**: `showNativeDiff()`에서 `.codebreeze-pending` 임시 파일을 `fs.writeFileSync`로 생성하지만, VS Code가 crash하거나 사용자가 diff 에디터를 닫고 Accept/Reject를 선택하지 않으면 임시 파일이 workspace에 남음.
- **원인**: `cleanupPendingFile`은 Accept/Reject 선택 후에만 호출됨. crash 시 cleanup 불가. `deactivate()`에서도 `cleanupAllPending()`을 호출하지 않음.
- **심각도**: Medium (workspace 오염)
- **상태**: 수정 완료 (2026-03-18)

## B-031: errorCollector / copyErrorsForAI clipboard 직접 호출
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/collect/errorCollector.ts:13`
- **증상**: `copyErrorsForAI()`에서 `vscode.env.clipboard.writeText()` 직접 호출. B-003에서 다른 모듈은 `writeClipboard()`로 교체했으나 이 파일은 누락됨.
- **원인**: B-003 수정 시 errorCollector.ts가 교체 대상에서 빠짐
- **심각도**: Medium (code-server 환경에서 클립보드 실패 시 fallback 미작동)
- **상태**: 수정 완료 (2026-03-18)

## B-032: fileCopy / gitCollector / fixWithAI clipboard 직접 호출
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/collect/fileCopy.ts:29,55,76`, `src/collect/gitCollector.ts:43,65`, `src/commands/fixWithAI.ts:109,122`
- **증상**: B-031과 동일 — `vscode.env.clipboard.writeText()` 직접 호출. `writeClipboard()`를 사용해야 함.
- **원인**: B-003 수정 범위 누락
- **심각도**: Medium
- **상태**: 수정 완료 (2026-03-18)

## B-033: localBuildCollector clipboard 직접 호출
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/collect/localBuildCollector.ts:90,111`
- **증상**: `runCommandAndCopy()`와 `copyLastBuildLog()`에서 `vscode.env.clipboard.writeText()` 직접 호출
- **원인**: B-003 수정 범위 누락
- **심각도**: Medium
- **상태**: 수정 완료 (2026-03-18)

## B-034: wsBridgeServer codeBlocks handler clipboard 직접 호출
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/bridge/wsBridgeServer.ts:302`
- **증상**: `handleWsMessage()` 내 codeBlocks case에서 `vscode.env.clipboard.writeText(markdown)` 직접 호출
- **원인**: B-003 수정 범위 누락
- **심각도**: Medium
- **상태**: 수정 완료 (2026-03-18)

## B-035: mcpServer startMcpServer clipboard 직접 호출
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/mcp/mcpServer.ts:334`
- **증상**: "Copy URL" 버튼 클릭 시 `vscode.env.clipboard.writeText()` 직접 호출
- **원인**: B-003 수정 범위 누락
- **심각도**: Low (URL 복사는 code-server에서 큰 문제 아님)
- **상태**: 수정 완료 (2026-03-18)

## B-036: patchApplier execSync 명령어 인자 미이스케이프
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/apply/patchApplier.ts:30-31`
- **증상**: `execSync(\`git apply --check ${tmpName}\`)` — tmpName이 `Date.now()` 기반이라 현재는 안전하지만, 파일명에 shell 메타문자가 포함되면 command injection 가능.
- **원인**: shell 메타문자 이스케이프 미적용. `execSync`이 내부적으로 `cp.execSync`에 `{ shell: true }` 없이 실행하나, 실제로는 `exec` 자체가 shell을 사용.
- **심각도**: Low (현재 Date.now() 기반이라 실질적 위험 없음, 그러나 방어적 코딩 필요)
- **상태**: 수정 완료 (2026-03-18)

## B-037: nativeDiffPreview 새 파일 시 원본 경로 미존재 crash
- **발견**: 2026-03-18 (감사 2차)
- **파일**: `src/apply/nativeDiffPreview.ts:46-48`
- **증상**: `isNewFile=true`일 때 `emptyPath = actualOriginalUri.fsPath + '.codebreeze-empty'`로 빈 파일 생성하지만, `actualOriginalUri`의 부모 디렉토리가 존재하지 않으면 `fs.writeFileSync` ENOENT crash.
- **원인**: 새 파일 경로의 부모 디렉토리 존재 여부 미확인
- **심각도**: Medium
- **상태**: 수정 완료 (2026-03-18)

## B-012: Browser Bridge 자동 시작 설정 미존재
- **발견**: 2026-03-18
- **증상**: VS Code 시작 시 매번 `Ctrl+Shift+P → Start Browser Bridge` 수동 실행 필요
- **원인**: `autoStartBridge` 설정 미존재
- **수정**:
  - `package.json`: `codebreeze.autoStartBridge` boolean 설정 추가 (기본: false)
  - `config.ts`: `autoStartBridge` 속성 추가
  - `extension.ts`: `activate()`에서 설정 확인 후 자동 `startWsBridge()` 호출
- **상태**: 수정 완료 (2026-03-18)

## B-013: 브라우저 확장 Service Worker 비활성화 시 WebSocket 끊김
- **발견**: 2026-03-18
- **증상**: Manifest V3 Service Worker가 30초 후 비활성화되면 `setInterval` 멈추고 WebSocket 끊김. 팝업 열어도 끊긴 상태 유지.
- **원인**: `setInterval`은 Service Worker lifecycle에서 신뢰할 수 없음 (Chrome이 worker를 종료시킴)
- **수정**:
  - `manifest.json`: `alarms` permission 추가
  - `background.js`: `setInterval` → `chrome.alarms.create()` (24초 간격) 으로 keep-alive + 자동 재연결
  - `popup.js`: 팝업 open 시 연결 상태 확인 → 끊긴 경우 자동 재연결 시도
- **상태**: 수정 완료 (2026-03-18)
