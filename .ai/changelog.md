# 변경 이력

## 최근 (최신 3건만 유지 — 이전 항목은 .ai/changelog-archive.md로 이동)

### 2026-03-15 — Collect 흐름 완성 + GitHub API 개선
- lint warning 8개 → 0 (fs/CodeBlock/url/config/prevCommit/workspaceRoot/warnings/copyMultipleFilesForAI 미사용 제거)
- gitEventMonitor: `prevCommit` 활용하여 HEAD hash 변경 시에만 'commit' 이벤트 발행 (기존: 모든 state 변경에 무조건 발행)
- githubLogCollector: `githubToken` 선택사항으로 변경 — public 레포는 토큰 없이 조회 가능 (60 req/hr), private은 기존대로 토큰 필요. `buildHeaders()` 헬퍼 추출
- `copyMultipleFilesForAI` 커맨드 등록 + package.json 선언 + explorer/context 다중 선택 메뉴 추가
- lint 스크립트 `./node_modules/.bin/eslint` 로 고정 (전역 ESLint v10 충돌 방지)
- 신규 테스트: `test/suite/collectUtils.test.ts` 10개 (buildFileMarkdown, getGitLog/Diff/Branch, getLastBuildResult)

### 2026-03-15 — 단위테스트 + CI 강화
- 테스트 4파일 추가: markdownUtils, diffDetectorExtended, markdownParserExtended, types
- 기존 11개 + 신규 34개 = 총 45개 테스트, 전부 통과 (67ms)
- CI에 `xvfb-run -a npm test` 단계 추가
- VSIX 패키징 수정: package.json main 경로 out/src/extension.js, icon 참조 제거
- I-004 등록 (Marketplace 아이콘 미등록)

