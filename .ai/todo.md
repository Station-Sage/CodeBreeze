# 할일 (2026-03-15)

## 긴급 — 컴파일 에러 수정
- [ ] npm run compile 실행 후 에러 확인 및 수정
- [ ] 모든 import 경로 정상 확인

## 우선 — 핵심 기능 검증
- [ ] Apply 흐름 E2E 테스트: 마크다운 코드 블록 복사 → Ctrl+Shift+A → 파일 적용
- [ ] Collect 흐름 테스트: Ctrl+Shift+C → 클립보드에 마크다운 포맷 확인
- [ ] git diff/log 수집 테스트
- [ ] 컨트롤 패널(Ctrl+Shift+I) WebView 로드 확인

## 다음 — 안정화
- [ ] 에러 경로 처리: 빈 클립보드, 코드 블록 없는 텍스트, 파일 경로 매칭 실패
- [ ] safetyGuard: git stash → apply → undo 전체 흐름 검증
- [ ] localBuildCollector: 다양한 빌드 도구 에러 포맷 파싱

## 미수정 버그
- (아직 없음)

## 미구현 개선사항
- I-001: code-server 클립보드 폴백
- I-002: 프로젝트 맵 자동 생성 (AST)
- I-003: 컨트롤 패널 diff 미리보기
