# CodeBreeze Browser Extension

AI 챗 페이지(Genspark, ChatGPT, Claude, Gemini)의 코드 블록을 감지하여
VS Code CodeBreeze 확장에 실시간 전달하는 Chrome 확장입니다.

## 지원 사이트

- Genspark (genspark.ai)
- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)

## 설치 방법

1. Chrome에서 `chrome://extensions` 열기
2. **개발자 모드** 활성화 (우측 상단 토글)
3. **압축 해제된 확장 프로그램 로드** 클릭
4. `browser-extension/` 폴더 선택

> **Kiwi Browser** (Android): 동일한 방법으로 설치 가능합니다.

## 사용 방법

1. VS Code에서 `Ctrl+Shift+P` → `CodeBreeze: Start Browser Bridge` 실행
2. 브라우저 확장 팝업에서 포트 확인 (기본 3701) → **Connect**
3. AI 챗에서 코드가 포함된 응답이 생성되면 자동으로 VS Code에 전달됩니다

## 연결 상태

- 팝업의 초록색 점: VS Code 브릿지에 연결됨
- 빨간색 점: 연결 끊김 (자동 재연결 시도, 최대 10회)

## WebSocket 프로토콜

| 방향 | type | 설명 |
|---|---|---|
| Browser → VS Code | `codeBlocks` | 감지된 코드 블록 전송 |
| Browser → VS Code | `ai_response` | AI 전체 응답 텍스트 |
| Browser → VS Code | `ping` | 연결 유지 |
| VS Code → Browser | `send_to_ai` | AI 챗 입력창에 텍스트 전송 |
| VS Code → Browser | `pong` | ping 응답 |
| VS Code → Browser | `status` | 브릿지 상태 정보 |

## 포트 변경

VS Code 설정에서 `codebreeze.wsBridgePort` 값을 변경한 후,
브라우저 확장 팝업에서도 동일한 포트 번호를 입력하세요.
