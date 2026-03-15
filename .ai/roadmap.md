# 향후 확장 로드맵

## Phase 1: 안정화 (현재)
현재 구현된 기능의 안정성 확보.
컴파일 에러 수정, 핵심 흐름 E2E 검증, edge case 처리.

## Phase 2: 스마트 컨텍스트 강화
### 프로젝트 맵 생성
- TypeScript/Kotlin/Python AST를 파싱하여 파일별 함수/클래스 시그니처 추출
- AI에게 전체 구조를 먼저 보여주고 필요한 파일만 상세 전달하는 2단계 전략
- tree-sitter 또는 언어별 간단한 정규식 기반 파서 (경량화 우선)

### 에러 추적 연쇄 수집
- 에러 메시지에서 참조되는 파일/줄을 재귀적으로 추적
- 호출 스택 기반 관련 함수 자동 수집
- 최대 깊이 제한 (설정 가능)

### 청크 분할 개선
- 긴 파일을 함수/클래스 단위로 의미 있게 분할 (현재: 줄 수 기반)
- 각 청크에 컨텍스트 헤더 (파일 경로, 줄 범위, 이전/다음 청크 존재 여부)

## Phase 3: MCP 서버 모드
### 설계
- 확장이 로컬 MCP 서버로 동작
- VS Code의 Copilot Agent Mode, 젠스파크 MCP, 외부 에이전트가 도구를 호출
- 제공 도구 (MCP tools):
  - read_file: 워크스페이스 파일 읽기
  - write_file: 파일 쓰기 (safetyGuard 적용)
  - get_errors: 현재 컴파일 에러 조회
  - get_git_diff: git diff 조회
  - run_build: 빌드 실행 + 결과 반환
  - get_project_map: 프로젝트 구조 조회

### 장점
- AI가 직접 VS Code 내 파일을 읽고 쓸 수 있음
- 클립보드 복사-붙여넣기 완전 제거
- 여러 AI 도구가 동시에 연결 가능

### 설계 고려
- 현재 types.ts의 ContextPayload, MonitorEvent를 MCP 응답 스키마로 확장
- 현재 collect/ 모듈을 MCP tool handler로 래핑 (기존 코드 재사용)
- 현재 apply/ 모듈을 MCP write_file tool로 래핑
- 보안: localhost 전용, 인증 토큰 선택적

## Phase 4: WebSocket 브릿지 (선택)
### 설계
- 브라우저 확장이 AI챗 페이지의 코드 블록을 감지
- WebSocket으로 VS Code 확장에 실시간 전달
- VS Code 확장이 자동 파싱 → 적용 제안

### 장점
- 클립보드 복사조차 불필요 (완전 자동)
- AI챗의 스트리밍 응답 실시간 추적 가능

### 단점
- 브라우저 확장 추가 개발/유지 필요
- AI챗 서비스 DOM 변경에 취약
- MCP Phase 3이 더 범용적이므로 우선순위 낮음

## Phase 5: code-server 완전 호환
### 문제
- 브라우저 Clipboard API 불안정 (특히 iPad, 모바일)
- HTTPS 필수, 일부 브라우저에서 권한 팝업

### 해결 방안
- 클립보드 실패 시 파일 기반 폴백
- 컨트롤 패널 WebView 내에서 textarea 기반 수동 붙여넣기 지원
- MCP 서버 모드가 완성되면 클립보드 의존도 자체가 감소

## 설계 원칙 — 확장 방향에 걸쳐 공통
1. 기존 모듈(apply/, collect/, monitor/) 재사용
2. types.ts를 공유 스키마로 유지
3. AI 서비스 비종속
4. 점진적 활성화: 사용자가 필요한 기능만 켜는 방식
