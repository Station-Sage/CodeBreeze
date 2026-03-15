# AGENTS.md — AI Agent 컨텍스트

## GitHub
https://github.com/Station-Sage/CodeBreeze

## 세션 시작
위 레포에서 아래 순서로 읽기:
1. .ai/index.md (라우터)
2. BUGS.md (버그 현황)
3. .ai/todo.md (할일)

## 프로젝트
CodeBreeze — AI챗(젠스파크, ChatGPT, Claude 등) ↔ VS Code 간 코드 전달 자동화 확장
클립보드 기반 범용 설계, 특정 AI 서비스 비종속

## 기술 스택
- 언어: TypeScript
- 런타임: VS Code Extension API + Node.js
- 빌드: tsc → out/
- 패키징: vsce package → VSIX
- 의존성: diff (패치 적용), adm-zip (GitHub Actions 로그)

## 빌드
- 컴파일: npm run compile
- 패키징: npm run package
- 린트: npm run lint
- 테스트: npm test

## 소스 경로
src/

## 주요 파일
- extension.ts — 진입점, 명령 등록, 모니터 초기화
- config.ts — 설정 로드 (VS Code 설정 + .codebreeze.json 병합)
- types.ts — 공유 타입 정의
- apply/ — AI챗 → VS Code (코드 적용)
- collect/ — VS Code → AI챗 (컨텍스트 수집)
- monitor/ — VS Code 이벤트 감시
- ui/ — 사이드바, 컨트롤 패널, 상태바

## 핵심 규칙
- 1파일 300줄 이하, 초과 시 분할
- 모든 외부 명령은 utils/exec.ts의 execAsync 사용
- 클립보드 출력 포맷은 마크다운 코드 블록 (파일 경로 포함)
- AI 서비스 특정 코드 금지 (범용 클립보드만 사용)

## 향후 확장 방향
- MCP 서버 모드: 확장이 로컬 MCP 서버로 동작, Copilot/외부 에이전트에 도구 제공
- WebSocket 브릿지: 브라우저 확장과 실시간 통신 (클립보드 우회)
- 프로젝트 맵 자동 생성: AST 기반 함수/클래스 시그니처 추출
- code-server 완전 호환: 브라우저 환경 클립보드 폴백 처리
