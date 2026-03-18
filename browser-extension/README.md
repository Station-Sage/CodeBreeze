# CodeBreeze Browser Extension

AI 챗 페이지의 코드 블록을 감지하여 VS Code CodeBreeze 확장에 실시간 전달하는 Chrome 확장입니다.
Agent Loop 기능과 연동하여 빌드 에러를 자동으로 AI에게 전달하고 수정 코드를 받아 적용합니다.

## 지원 사이트

- Genspark (genspark.ai)
- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)

## 설치 방법

### 방법 1: 압축 해제 로드
1. Chrome에서 `chrome://extensions` 열기
2. **개발자 모드** 활성화 (우측 상단 토글)
3. **압축 해제된 확장 프로그램 로드** 클릭
4. `browser-extension/` 폴더 선택

### 방법 2: CRX/ZIP 빌드
```bash
npm run build:browser-ext
```
`dist/codebreeze-bridge.crx` 및 `.zip` 파일이 생성됩니다.

> **Kiwi Browser** (Android): 동일한 방법으로 설치 가능합니다.

## 사용 방법

1. VS Code에서 `Ctrl+Shift+P` → `CodeBreeze: Start Browser Bridge` 실행
2. 브라우저 확장 팝업에서 포트 확인 (기본 3701) → **Connect**
3. AI 챗에서 코드가 포함된 응답이 생성되면 자동으로 VS Code에 전달됩니다

## Agent Loop 연동

VS Code 컨트롤 패널의 Bridge 탭에서 **Agent Loop** 버튼을 클릭하면:
1. 코드 블록을 자동 적용
2. 빌드 명령 실행 (`codebreeze.buildCommands`)
3. 빌드 성공 시 테스트 실행 (`codebreeze.testCommands`)
4. 에러 발생 시 에러 컨텍스트 + import 체인 파일을 AI에 자동 전송
5. AI 응답을 받아 코드 재적용 (최대 `agentLoopMaxIterations`회)
6. 동일 에러 2회 반복 시 자동 중단

Agent Loop 실행 중 **Stop Agent Loop** 버튼으로 중지할 수 있습니다.

## 셀렉터 폴백 체인 (Phase 7-2)

각 AI 챗 사이트마다 배열 기반 다단계 CSS 셀렉터를 사용합니다.
1차 셀렉터 실패 시 범용 폴백 셀렉터(`pre > code`, `[class*="code-block"]`)로 자동 전환됩니다.

- 팝업에서 **Test Selectors** 버튼으로 현재 사이트의 셀렉터 동작 확인 가능
- 코드 블록 중복 감지 (동일 코드 블록 재전송 방지)

## ACK 프로토콜 (Phase 7-3)

메시지 전달 신뢰성을 위한 ACK(Acknowledgment) 프로토콜:
- 각 메시지에 `msgId`를 부여하여 수신 확인
- ACK 미수신 시 최대 3회 재전송 (5초 타임아웃)
- VS Code OutputChannel(`CodeBreeze Bridge`)에서 통신 로그 확인

## 연결 상태

- 팝업의 초록색 점: VS Code 브릿지에 연결됨
- 빨간색 점: 연결 끊김 (자동 재연결 시도, 최대 10회)

## WebSocket 프로토콜

| 방향 | type | 설명 |
|---|---|---|
| Browser → VS Code | `codeBlocks` | 감지된 코드 블록 전송 |
| Browser → VS Code | `ai_response` | AI 전체 응답 텍스트 |
| Browser → VS Code | `ping` | 연결 유지 |
| Browser → VS Code | `ack` | 메시지 수신 확인 (Phase 7-3) |
| VS Code → Browser | `send_to_ai` | AI 챗 입력창에 텍스트 전송 |
| VS Code → Browser | `pong` | ping 응답 |
| VS Code → Browser | `status` | 브릿지 상태 정보 |
| VS Code → Browser | `error_context` | 에이전트 루프 에러 컨텍스트 |
| VS Code → Browser | `agent_loop_status` | 루프 진행 상태 |
| VS Code → Browser | `ack` | 메시지 수신 확인 (Phase 7-3) |

## 포트 변경

VS Code 설정에서 `codebreeze.wsBridgePort` 값을 변경한 후,
브라우저 확장 팝업에서도 동일한 포트 번호를 입력하세요.

## 관련 설정

| 설정 | 기본값 | 설명 |
|---|---|---|
| `codebreeze.wsBridgePort` | 3701 | WebSocket 브릿지 포트 |
| `codebreeze.agentLoopMaxIterations` | 5 | Agent Loop 최대 반복 (1-20) |
| `codebreeze.agentLoopTimeout` | 300 | AI 응답 대기 타임아웃 (초) |
| `codebreeze.applyMode` | inline | 코드 적용 방식 (inline/wholefile) |
| `codebreeze.errorChainDepth` | 2 | 에러 파일 import 추적 깊이 |
| `codebreeze.streamingDebounceMs` | 1500 | 스트리밍 디바운스 간격 (ms) |
| `codebreeze.diffPreviewMode` | native | Diff 미리보기 모드 (native/inline) |
| `codebreeze.rulesFile` | .codebreeze-rules.md | 프로젝트 규칙 파일 경로 |
| `codebreeze.agentLoopAutoApply` | preview | Agent Loop 적용 모드 (preview/auto/safe) |

## 파일 구조

```
browser-extension/
├── manifest.json      # Chrome Manifest V3
├── content.js         # AI챗 DOM 감지 + 코드 블록 추출
├── background.js      # WebSocket 연결 + 메시지 라우팅
├── popup.html         # 확장 팝업 UI
├── popup.js           # 팝업 로직
├── icons/             # 확장 아이콘 (16/48/128px)
└── README.md          # 이 파일
```
