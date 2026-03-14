# 설계 결정

## D1: 클립보드 기반 범용 설계
AI 서비스(젠스파크, ChatGPT, Claude 등) 전용 API 대신 클립보드를 매개로 선택.
근거: 젠스파크에 공개 API 없음, DOM 스크래핑은 불안정, 서비스 종속 회피.
장점: 어떤 AI챗이든 동작, 유지보수 최소화.
단점: 사용자가 복사 1회 필요. 향후 WebSocket 브릿지로 보완 가능.

## D2: VS Code 데스크톱 우선, code-server 2차
code-server에서 확장 코드(Node.js API)는 대부분 호환.
문제는 브라우저 Clipboard API 불안정 (iPad, 모바일).
전략: 데스크톱에서 먼저 완성, code-server는 호환 테스트만.

## D3: 마크다운 코드 블록 = 표준 전달 포맷
AI챗 출력이 마크다운 코드 블록이므로 자연스러운 선택.
파일 경로는 ```lang:filepath 인라인 또는 직전 줄 // filepath: 주석으로 인식.
커스텀 패턴은 설정(filePathPattern)으로 확장 가능.

## D4: child_process.execSync 대신 execAsync
git, 빌드 명령 실행 시 동기 호출은 UI를 블로킹.
utils/exec.ts에 Promise 래퍼를 두고 모든 외부 명령은 비동기로 실행.

## D5: 모니터는 알림(notify) 기본, 자동(auto)은 옵트인
autoLevel 설정: off / notify(기본) / auto.
notify: 이벤트 발생 시 알림만. auto: 자동으로 컨텍스트 수집 + 클립보드 갱신.
기본을 notify로 둔 이유: 예상치 않은 클립보드 덮어쓰기 방지.

## D6: 설정 2단계 병합 (VS Code 설정 + .codebreeze.json)
VS Code Settings는 전역 기본값, .codebreeze.json은 프로젝트별 오버라이드.
프로젝트마다 빌드 명령(gradlew vs npm)이 다르므로 필요.

## D7: safetyGuard — 적용 전 git stash
코드 적용은 파괴적 작업(파일 전체 교체). 실수 방지를 위해 적용 전 자동 git stash.
히스토리에 stash ref 저장, undoLastApply로 복원 가능.

## D8: 향후 확장을 위한 인터페이스 설계
types.ts의 MonitorEvent, ContextPayload 등은 현재 내부용이지만,
MCP 서버 모드 추가 시 외부 도구에 노출하는 인터페이스로 확장 가능.
지금부터 타입을 깔끔하게 유지하는 이유.
