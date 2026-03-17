Phase 4 남은 작업 — 상세 개발 계획
개요
Phase 4의 WebSocket 브릿지 서버(wsBridgeServer.ts)는 이미 구현 완료되었으나, **브라우저 확장(클라이언트 측)**과 자동 에이전트 루프, 프로토콜 확장, 채팅 UI 확장이 남아있습니다. 총 6개 작업 단위로 분할합니다.

작업 구조 (의존성 순서)
Task 1: 메시지 프로토콜 확장 (wsBridgeServer.ts)
  ↓
Task 2: 브라우저 확장 스캐폴딩 (browser-extension/)
  ↓
Task 3: content.js — AI챗 페이지 코드 블록 감지
  ↓
Task 4: background.js — WebSocket 연결 + 메시지 라우팅
  ↓
Task 5: chatPanelHtml.ts 채팅 UI 확장 (대화 히스토리 + 입력창)
  ↓
Task 6: 자동 에이전트 루프 (빌드→에러→재전송)

Task 1: WebSocket 프로토콜 확장
브랜치: claude/phase4-ws-protocol 파일: src/bridge/wsBridgeServer.ts, src/bridge/bridgeProtocol.ts (신규)

1-1. 신규 파일: src/bridge/bridgeProtocol.ts (~60줄)
메시지 타입을 타입 안전하게 정의합니다.

1-2. src/bridge/wsBridgeServer.ts 수정 (~30줄 추가)
handleWsMessage()에 신규 메시지 타입 핸들러 추가:

notifyControlPanel() 함수 추가 — chatPanel.ts의 updateControlPanel()을 import하여 호출.

1-3. 변경 사항 요약
파일	변경	예상 줄
src/bridge/bridgeProtocol.ts	신규 생성	~60줄
src/bridge/wsBridgeServer.ts	프로토콜 핸들러 추가	+30줄 (총 ~190줄)
src/types.ts	-	변경 없음
Task 2: 브라우저 확장 스캐폴딩
브랜치: claude/phase4-browser-ext-scaffold 디렉토리: browser-extension/

2-1. 디렉토리 구조

browser-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md

2-2. browser-extension/manifest.json

2-3. browser-extension/popup.html + popup.js (~60줄 + ~40줄)
간단한 연결 상태 표시 + 포트 설정 팝업:

2-4. browser-extension/README.md (~50줄)
설치 방법, 사용 방법, Kiwi Browser 호환 설명.

Task 3: content.js — AI챗 페이지 코드 블록 감지
브랜치: claude/phase4-content-script (Task 2와 동일 브랜치로 통합 가능) 파일: browser-extension/content.js (~180줄)

3-1. 핵심 로직

3-2. 주요 설계 결정
결정	근거
Site-specific selectors	AI챗마다 DOM 구조가 다름. 오브젝트 맵으로 관리
1.5초 디바운스	스트리밍 응답 완료 대기. 너무 짧으면 불완전한 코드 감지
MutationObserver	폴링보다 효율적, DOM 변경 즉시 감지
nativeInputValueSetter	React 등 프레임워크가 관리하는 input에 값 주입 시 필요

Task 4: background.js — WebSocket 연결 + 메시지 라우팅
브랜치: claude/phase4-background-ws (Task 2와 통합 가능) 파일: browser-extension/background.js (~120줄)

Task 5: chatPanelHtml.ts 채팅 UI 확장
브랜치: claude/phase4-chat-ui 파일: src/ui/chatPanelHtml.ts (~+80줄), src/ui/chatPanel.ts (~+40줄)

5-1. chatPanelHtml.ts — 변경 사항
컨트롤 패널에 Bridge 탭 추가 (기존 Send/Receive/History 옆에 4번째 탭):
JS 추가 (~50줄):

5-2. chatPanel.ts — 메시지 핸들러 추가 (~40줄)
setupMessageHandler() switch에 새 case 추가:
sendBridgeStatus() 헬퍼 함수:

Task 6: 자동 에이전트 루프
브랜치: claude/phase4-agent-loop 파일: src/bridge/agentLoop.ts (신규, ~150줄)

6-1. 로직 흐름
1. 사용자가 "Agent Loop" 클릭
2. AI 응답의 코드 블록 적용 (applyCodeBlocksHeadless)
3. npm run build 실행 (localBuildCollector의 runCommandAndCopy 재사용)
4. diagnosticsMonitor로 에러 감지
5. 에러 있으면 → smartContext 수집 → WebSocket으로 브라우저에 전송
6. AI 응답 대기 (wsBridgeServer의 ai_response 메시지)
7. 2번으로 돌아감 (최대 5회)
8. 성공 또는 최대 반복 도달 시 종료

6-2. src/bridge/agentLoop.ts

6-3. wsBridgeServer.ts에 에이전트 루프 연동 추가
handleWsMessage()의 ai_response case에서:

Task 7: wsBridgeServer에 getConnectionCount 추가 + 테스트
파일: src/bridge/wsBridgeServer.ts (+5줄)

테스트 파일: test/suite/agentLoop.test.ts, test/suite/bridgeProtocol.test.ts (~40줄)

기본 타입 검증 + 프로토콜 메시지 구조 테스트.

파일별 변경 요약
파일	작업	예상 줄 수
src/bridge/bridgeProtocol.ts	신규	~60
src/bridge/agentLoop.ts	신규	~150
src/bridge/wsBridgeServer.ts	수정 (프로토콜 확장)	+35 (→ ~195)
src/ui/chatPanelHtml.ts	수정 (Bridge 탭)	+80 (→ ~430)
src/ui/chatPanel.ts	수정 (핸들러 추가)	+40 (→ ~305)
browser-extension/manifest.json	신규	~45
browser-extension/content.js	신규	~180
browser-extension/background.js	신규	~120
browser-extension/popup.html	신규	~25
browser-extension/popup.js	신규	~30
browser-extension/README.md	신규	~50
test/suite/bridgeProtocol.test.ts	신규	~25
test/suite/agentLoop.test.ts	신규	~20
.ai/roadmap.md	수정	~10줄 변경
.ai/todo.md	수정	~15줄 추가
.ai/files.md	수정	~10줄 추가
.ai/changelog.md	수정	~10줄 추가
.ai/decisions.md	수정	~15줄 추가
총 신규 코드: ~705줄 (소스) + ~95줄 (테스트) 총 수정 코드: ~155줄 추가 모든 소스 파일 300줄 이하 규칙 준수 (chatPanelHtml.ts는 HTML 템플릿 예외)