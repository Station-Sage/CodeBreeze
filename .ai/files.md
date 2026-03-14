# 소스 파일 인덱스

경로: src/

## 진입점
- extension.ts (~80줄) — activate/deactivate, 명령 등록, 모니터 초기화, 사이드바 등록
- config.ts (~60줄) — CodeBreezeConfig 인터페이스, VS Code 설정 + .codebreeze.json 병합
- types.ts (~50줄) — CodeBlock, ApplyResult, HistoryEntry, BuildResult, ParsedError, ContextPayload, MonitorEvent

## apply/ — AI챗 → VS Code
- clipboardApply.ts (~140줄) — 메인 적용 흐름: 클립보드 읽기 → 파싱 → 매칭 → 적용
- markdownParser.ts (~70줄) — 마크다운 텍스트에서 코드 블록 추출
- diffDetector.ts (~30줄) — 코드 블록 내용이 unified diff인지 판별
- fileMatcher.ts (~70줄) — 파일 경로를 워크스페이스 파일에 매칭 (glob, 부분 경로)
- patchApplier.ts (~55줄) — unified diff를 파일에 적용 (diff 라이브러리)
- safetyGuard.ts (~65줄) — git stash 백업, 히스토리 기록, undo 복원

## collect/ — VS Code → AI챗
- fileCopy.ts (~90줄) — 파일/선택영역/다중파일 → 마크다운 코드 블록 → 클립보드
- gitCollector.ts (~85줄) — git diff/log → 마크다운 → 클립보드
- errorCollector.ts (~80줄) — Problems 에러 + 주변 코드 → 클립보드
- localBuildCollector.ts (~180줄) — 빌드/테스트 실행, 출력 캡처, 에러 파싱, 결과 저장
- githubLogCollector.ts (~140줄) — GitHub REST API로 워크플로우 로그 다운로드 + 에러 추출
- smartContext.ts (~130줄) — 현재 파일 + 에러 + git diff 자동 조합

## monitor/ — 이벤트 감시
- taskMonitor.ts (~55줄) — 빌드 태스크 시작/종료 감지
- terminalMonitor.ts (~65줄) — 터미널 출력에서 에러 패턴 감지
- diagnosticsMonitor.ts (~50줄) — 컴파일 에러/경고 수 변화 감지 + 콜백
- gitEventMonitor.ts (~55줄) — git HEAD 변화 폴링 (커밋/브랜치 전환)

## ui/ — 사용자 인터페이스
- sidebarProvider.ts (~145줄) — TreeDataProvider: Send/Receive/History 트리
- chatPanel.ts (~155줄) — WebView 패널 생성, 메시지 핸들링
- chatPanelHtml.ts (~320줄) — 컨트롤 패널 HTML/CSS/JS 템플릿
- historyStore.ts (~35줄) — globalState 기반 적용 히스토리 CRUD
- statusBarItem.ts (~35줄) — 상태바 아이템 생성, flash 알림

## utils/ — 공용 유틸리티
- exec.ts (~40줄) — child_process.exec 래퍼 (Promise, 타임아웃, cwd)
- markdown.ts (~35줄) — 마크다운 코드 블록 포맷 헬퍼

## 규칙
- 1파일 300줄 이하 목표, 초과 시 분할 검토
- chatPanelHtml.ts는 예외 (HTML 템플릿 특성상, 300줄 한도)
