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

## D9: 브라우저 확장 Site-specific selectors
AI챗마다 DOM 구조가 다름. CSS selector를 사이트별 오브젝트 맵으로 관리.
범용 셀렉터 대신 사이트별 최적화 선택 — 안정성 우선.
새 AI챗 추가 시 SITE_CONFIG에 항목 추가만 하면 됨.

## D10: 에이전트 루프 최대 반복 제한 (설정 가능)
무한 루프 방지. 기본 5회, `codebreeze.agentLoopMaxIterations` 설정으로 1-20 범위 조정 가능.
5회 이상은 AI가 해결 못하는 근본적 문제일 가능성 높음.
`DEFAULT_AGENT_LOOP_MAX_ITERATIONS` 상수를 기본값으로 사용, 런타임에 VS Code 설정에서 오버라이드.

## D12: 컨트롤 패널 Panel 위치 (secondarySidebar 대신)
`viewsContainers.secondarySidebar`는 VS Code의 proposed API로, 일반 확장에서 사용 시 "Drag a view here" 이슈 발생.
안정적으로 동작하는 `panel` (하단 패널) viewsContainer를 사용하여 WebviewView를 배치.
사용자가 원하면 VS Code UI에서 드래그하여 Secondary Sidebar로 이동 가능.

## D11: 스트리밍 응답 디바운스 (설정 가능)
AI챗은 토큰 단위로 스트리밍. 너무 빨리 감지하면 불완전한 코드 블록 추출.
기본 1.5초. `codebreeze.streamingDebounceMs` 설정으로 500~10000ms 조정 가능 (D11 해결).

## D13: 코드 적용 모드 — inline 기본 (D7 개선)
기존: 전체 파일 교체 (`fullRange.replace`). 문제: 변경 없는 부분도 교체되어 git diff 노이즈.
개선: `applyMode: 'inline'` (기본) — `diff` 패키지로 변경 범위만 계산, `WorkspaceEdit`으로 해당 줄만 교체.
`'wholefile'`로 되돌리기 가능 (설정). 헤드리스 모드에서도 동일 로직 사용 (MCP/agent loop).
순수 로직은 `diffRangeCalculator.ts`에 분리 — vscode 의존 없이 테스트 가능.

## D14: 에러 체인 추적 깊이
에러 파일의 import를 재귀 추적하면 관련 파일 컨텍스트가 풍부해짐.
기본 깊이 2 (`errorChainDepth`). 0=비활성, 5=최대.
너무 깊으면 관련 없는 파일까지 포함 → 토큰 낭비. 2가 실용적 균형점.
순환 참조는 `visited` Set으로 방지.

## D15: 프로젝트 규칙 시스템 (.codebreeze-rules.md)
LLM 직접 제어 불가 → 프롬프트에 규칙 삽입으로 간접 제어.
`.codebreeze-rules.md` 파일이 있으면 Smart Context, Agent Loop 프롬프트에 자동 prepend.
Cursor Memories/Rules, Claude Code CLAUDE.md에 대응. 기존 `.codebreeze.json` 구조와 병행.
`rulesFile` 설정으로 파일 경로 커스텀 가능.

## D16: 커넥터 인터페이스 (api / bridge 이원화) — 장기 로드맵
Genspark은 bridge(API 없음), Claude/OpenAI는 api. 동일 인터페이스로 추상화하여
Agent Loop이 커넥터에 무관하게 동작. Phase 13에서 구현 예정.

## D17: diff preview 모드 이원화 (native / inline)
VS Code diff editor는 강력하지만 임시 파일 생성 필요.
WebView 인라인은 가볍지만 기능 제한. 사용자가 선택.
`diffPreviewMode: 'native'` (기본) / `'inline'` (기존 WebView 방식).

## D18: Agent Loop 자동 적용 3단계 (preview/auto/safe)
안전성과 자동화의 균형.
- `preview`: diff editor로 사용자 확인 후 적용 (가장 안전)
- `auto`: 즉시 적용 (가장 빠르지만 위험)
- `safe`: 적용 후 빌드+테스트 → 실패 시 자동 undo (실용적 기본값 후보)
기본값은 `preview` — 사용자가 신뢰를 쌓은 후 `safe`로 전환.

## D19: LSP 폴백 전략 (Phase 10)
LSP DocumentSymbolProvider가 없는 파일(언어 서버 미설치)은 기존 정규식 기반 `projectMapCollector.ts`로 폴백.
`getLspProjectMap()`이 빈 결과 시 `getProjectMap()`을 자동 사용.
MCP에서는 `get_lsp_project_map`(정확) / `get_project_map`(범용) 둘 다 노출.
Smart Context `auto` 모드에서는 LSP 우선, 실패 시 정규식 폴백.
`smartContextMode: 'manual'` (기본) — 기존 동작 유지, LSP 자동 수집 비활성.

## D20: 백그라운드 Agent 안전장치 (Phase 11)
자동 실행의 위험을 제한하기 위한 다중 안전장치:
1. **디바운스** (5초): 에러 발생 후 안정화 대기
2. **최소 간격** (30초): 잦은 재실행 방지
3. **연속 실행 제한** (3회 + 60초 쿨다운): 무한 루프 방지
4. **트리거 모드**: `notify`(기본) = 사용자 확인 후 실행, `auto` = 즉시 실행
5. **기본 비활성**: `backgroundAgentMode: 'off'` — 사용자가 명시적으로 활성화해야 함
인라인 완성도 D18에 따라 의도적 트리거(Invoke)만 지원. 자동 완성은 의도적으로 비활성화.
