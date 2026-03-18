# 버그 감사 결과 — Phase 1~11 전체 점검

**일시**: 2026-03-18
**범위**: 전체 소스 파일 직접 확인 (src/, browser-extension/)
**심각도 기준**: Critical(즉시 수정) / High(수정 권장) / Medium(개선) / Low(참고)

---

## 식별된 버그 요약

| ID | 심각도 | Phase | 파일 | 문제 |
|-----|--------|-------|------|------|
| B-014 | Critical | 11 | inlineCompletionProvider.ts | requestViaBridge() dead code — 즉시 null 반환 |
| B-015 | High | 9 | agentLoop.ts | stopAgentLoop() pending Promise 미해제 |
| B-016 | High | 11 | backgroundAgent.ts | OutputChannel 매회 생성 누수 |
| B-017 | High | 1 | patchApplier.ts | path traversal 미검증 |
| B-018 | High | 3 | mcpServer.ts | symlink으로 path 검증 우회 |
| B-019 | High | 1 | exec.ts | spawnAsync timeout 미존재 |
| B-020 | High | 1 | safetyGuard.ts | stash 경합 조건 |
| B-021 | Medium | 4 | wsBridgeServer.ts | scheduleRetry 이중 setTimeout |
| B-022 | Medium | 2 | gitCollector.ts | gitLogCount 범위 미제한 |
| B-023 | Medium | 10 | lspReferences.ts | Promise.all 전체 실패 |
| B-024 | Low | 9 | statusBarItem.ts | flashStatusBar 경합 |
| B-025 | Medium | 3 | mcpServer.ts | CORS wildcard |
| B-026 | Low | 7 | content.js | MutationObserver timer 미정리 |
| B-027 | Medium | 2 | githubLogCollector.ts | HTTP 상태 코드 미처리 |
| B-028 | Medium | 5 | chatPanel.ts | clipboardWatcher async 중첩 |
| B-029 | Low | 5 | gitEventMonitor.ts | activate() 미대기 |

| B-030 | Medium | 8 | nativeDiffPreview.ts | pending 파일 crash 시 잔존 |
| B-031 | Medium | 2 | errorCollector.ts | clipboard 직접 호출 (B-003 누락) |
| B-032 | Medium | 2,8 | fileCopy.ts, gitCollector.ts, fixWithAI.ts | clipboard 직접 호출 (B-003 누락) |
| B-033 | Medium | 2 | localBuildCollector.ts | clipboard 직접 호출 (B-003 누락) |
| B-034 | Medium | 4 | wsBridgeServer.ts | clipboard 직접 호출 (B-003 누락) |
| B-035 | Low | 3 | mcpServer.ts | clipboard 직접 호출 (B-003 누락) |
| B-036 | Low | 1 | patchApplier.ts | execSync 인자 미이스케이프 |
| B-037 | Medium | 8 | nativeDiffPreview.ts | 새 파일 시 부모 디렉토리 미생성 |

**총 24건**: Critical 1, High 6, Medium 12, Low 5

### B-003 미완료 요약 (B-031~B-035)
B-003에서 `vscode.env.clipboard` → `writeClipboard()` 교체가 chatPanel.ts와 clipboardApply.ts에만 적용됨.
다음 파일들이 여전히 직접 호출:
- `src/collect/errorCollector.ts:13`
- `src/collect/fileCopy.ts:29,55,76`
- `src/collect/gitCollector.ts:43,65`
- `src/collect/localBuildCollector.ts:90,111`
- `src/commands/fixWithAI.ts:109,122`
- `src/bridge/wsBridgeServer.ts:302`
- `src/mcp/mcpServer.ts:334`

---

## False Positive 제외 목록

| 보고 내용 | 판단 | 사유 |
|-----------|------|------|
| diffPreview lineNo 계산 오류 | FP | original 기준 lineNo이므로 removed+context만 증가시키는 것이 정확 |
| agentLoop timeout race condition | FP | resolveResponse=null 후 timeout이 if 체크하므로 안전 |
| fileMatcher path traversal | FP | `vscode.Uri.joinPath` + `vscode.workspace.findFiles`가 workspace 범위 제한 |
| gitCollector command injection | FP | VS Code 설정이 number 타입 강제 → 문자열 주입 불가 |
| errorCollector Array out of bounds | FP | `Math.max(0, ...)` 로 방어되어 있음 |
| config.ts JSON parse 무시 | 설계의도 | 로컬 설정 파일 파싱 실패 시 기본값 사용이 의도된 동작 |

---

## 수정 우선순위 — 전체 수정 완료 (2026-03-18)

### 1차 (Critical + High 보안) ✅
B-014, B-017, B-018, B-019

### 2차 (High 안정성) ✅
B-015, B-016, B-020

### 3차 (Medium — clipboard 직접 호출 일괄 수정) ✅
B-031~B-035 — `vscode.env.clipboard.writeText` → `writeClipboard()` 일괄 교체

### 4차 (Medium — 기타) ✅
B-021, B-022, B-023, B-025, B-027, B-028, B-030, B-037

### 5차 (Low) ✅
B-024, B-026, B-029, B-036
