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
