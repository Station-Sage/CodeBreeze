# 아키텍처

## 확장 개요
VS Code Extension (TypeScript). 클립보드를 매개로 AI챗과 VS Code 사이의 코드 전달을 자동화한다.
특정 AI 서비스에 의존하지 않는다. 마크다운 코드 블록이 표준 전달 포맷이다.

## 두 가지 데이터 흐름

### (A) AI챗 → VS Code (Apply)
1. 사용자가 AI챗에서 응답 복사 (클립보드에 마크다운 텍스트)
2. Ctrl+Shift+A 또는 컨트롤 패널에서 Apply
3. markdownParser: 클립보드 텍스트에서 코드 블록 추출 (언어, 파일 경로, 내용)
4. diffDetector: 내용이 unified diff인지 판별
5. fileMatcher: 파일 경로를 워크스페이스 내 실제 파일에 매칭
6. diff면 patchApplier로 패치 적용, 아니면 전체 교체
7. safetyGuard: 적용 전 git stash, 적용 후 히스토리 기록, undo 지원

### (B) VS Code → AI챗 (Collect)
1. 사용자가 명령 실행 (단축키, 사이드바, 컨트롤 패널)
2. Collector가 정보 수집:
   - fileCopy: 현재 파일 / 선택 영역
   - gitCollector: git diff / git log
   - errorCollector: Problems 패널 에러 + 주변 코드
   - localBuildCollector: 로컬 빌드/테스트 실행 + 출력 캡처
   - githubLogCollector: GitHub Actions 빌드 로그 (REST API)
   - smartContext: 위 항목들 자동 조합
3. 마크다운 포맷으로 클립보드에 쓰기
4. 사용자가 AI챗에서 Ctrl+V

## 모니터 시스템
VS Code 내부 이벤트를 감시하여 상태 변화 시 알림/자동 수집:
- taskMonitor: vscode.tasks.onDidEndTask — 빌드/테스트 완료 감지
- terminalMonitor: Terminal.onDidWriteData — 터미널 에러 출력 감지
- diagnosticsMonitor: vscode.languages.onDidChangeDiagnostics — 컴파일 에러 변화
- gitEventMonitor: 주기적 git status 폴링 — 커밋/브랜치 변경 감지

## UI 구조
- sidebarProvider: Activity Bar 트리뷰 (Send/Receive/History 그룹)
- chatPanel: WebView 패널 (좌: Send 버튼 그룹, 우: Receive 코드 블록 목록)
- chatPanelHtml: 컨트롤 패널 HTML/CSS/JS 생성
- historyStore: 적용 히스토리 저장 (ExtensionContext.globalState)
- statusBarItem: 상태바 아이콘 + 마지막 작업 상태

## 설정 구조
- VS Code Settings (aibridge.*): 전역 기본값
- .ai-bridge.json (워크스페이스 루트): 프로젝트별 오버라이드
- config.ts가 두 소스를 병합, 프로젝트 설정이 우선

## 코드 블록 파일 경로 인식 포맷
인라인: ```typescript:src/app.ts
주석: // filepath: src/app.ts (코드 블록 직전 줄)
커스텀: aibridge.filePathPattern 설정으로 정규식 추가 가능
