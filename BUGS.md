# 버그 목록

(현재 발견된 버그 없음 — 초기 개발 단계)

---

# 개선사항

## I-001: code-server 클립보드 폴백
- 브라우저 환경에서 Clipboard API 실패 시 대체 수단 필요
- 예상 수정: 파일 기반 전달 (.ai-bridge-clipboard.md 임시 파일) 또는 WebSocket
- **상태**: 미구현

## I-002: 프로젝트 맵 자동 생성
- 현재 스마트 컨텍스트는 에러 위치 기반 코드 수집만 지원
- AST 파싱으로 파일별 함수/클래스 시그니처 추출하면 AI가 전체 구조 파악 가능
- **상태**: 미구현

## I-003: 컨트롤 패널 Receive 측 미리보기
- 코드 블록 적용 전 diff 미리보기 (현재 파일 vs 적용 후) 표시
- **상태**: 미구현

- **I-004** (낮음, UX) 발견: 2026-03-15
  - Marketplace용 아이콘(PNG 128x128) 미등록
  - resources/icon.png 생성 후 package.json에 `"icon": "resources/icon.png"` 재추가 필요
  - 상태: **미구현**
