# CLAUDE.md — Claude Code 컨텍스트

## GitHub
https://github.com/Station-Sage/Clip_Copy

## 세션 시작
아래 순서로 읽기:
1. .ai/index.md (라우터)
2. BUGS.md (버그 현황)
3. .ai/todo.md (할일)

## 프로젝트
AI Bridge — AI챗 ↔ VS Code 간 코드 전달 자동화 VS Code 확장 (TypeScript)

## 빌드
- 컴파일: npm run compile
- 패키징: npm run package
- 린트: npm run lint
- 테스트: npm test

## 소스 경로
src/

## 주요 파일
- extension.ts — 진입점, 명령 등록, 모니터 초기화
- config.ts — 설정 로드
- types.ts — 공유 타입
- apply/ — 클립보드 → 파일 적용 (파서, 매처, 패치, 안전장치)
- collect/ — 컨텍스트 수집 → 클립보드 (파일, git, 에러, 빌드, 스마트)
- monitor/ — 이벤트 감시 (태스크, 터미널, 진단, git)
- ui/ — 사이드바, 컨트롤 패널, 히스토리, 상태바

## 핵심 규칙
- 1파일 200줄 이하, 초과 시 분할
- 모든 외부 명령은 utils/exec.ts의 execAsync 사용
- 클립보드 출력 포맷은 마크다운 코드 블록 (파일 경로 포함)
- AI 서비스 특정 코드 금지 (범용 클립보드만 사용)
