#!/bin/bash
# scripts/update-codebreeze.sh
# CodeBreeze 원커맨드 업데이트 (Termux + code-server / PC 겸용)
set -e

TMP_DIR="${TMPDIR:-/tmp}"
BASE_URL="https://github.com/Station-Sage/CodeBreeze/releases/download/dev-latest"
EXT_ID="station-sage.codebreeze-0.1.0"

# ── 다운로드 경로 설정 ──
if [ -d "$HOME/storage/downloads" ]; then
  DOWNLOAD_DIR="$HOME/storage/downloads"
else
  DOWNLOAD_DIR="$HOME/Downloads"
  mkdir -p "$DOWNLOAD_DIR"
fi

# ── 브라우저 확장 압축 해제 경로 ──
BRIDGE_DIR="$HOME/codebreeze-bridge"

# ── 확장 설치 경로 탐색 ──
if [ -d "$HOME/.local/share/code-server/extensions/$EXT_ID" ]; then
  EXT_DIR="$HOME/.local/share/code-server/extensions/$EXT_ID"
elif [ -d "$HOME/.vscode/extensions/$EXT_ID" ]; then
  EXT_DIR="$HOME/.vscode/extensions/$EXT_ID"
else
  EXT_DIR=""
fi

echo "=== CodeBreeze 업데이트 ==="

# ── 1. VSIX ──
echo "[1/3] VSIX 다운로드..."
curl -fsSL -o "$TMP_DIR/codebreeze-latest.vsix" "$BASE_URL/codebreeze-latest.vsix"

if [ -n "$EXT_DIR" ]; then
  echo "  → 기존 확장 덮어쓰기: $EXT_DIR"
  cd "$TMP_DIR"
  unzip -o codebreeze-latest.vsix "extension/*" -d codebreeze-tmp
  cp -rf codebreeze-tmp/extension/* "$EXT_DIR/"
  rm -rf codebreeze-tmp
  echo "  → 완료 (에디터 리로드 필요)"
else
  echo "  → 기존 설치를 찾을 수 없음. 최초 설치 진행..."
  if command -v code-server &>/dev/null; then
    code-server --install-extension "$TMP_DIR/codebreeze-latest.vsix" --force
  elif command -v code &>/dev/null; then
    code --install-extension "$TMP_DIR/codebreeze-latest.vsix" --force
  else
    echo "  → $TMP_DIR/codebreeze-latest.vsix 에 저장됨 (수동 설치 필요)"
  fi
fi
rm -f "$TMP_DIR/codebreeze-latest.vsix"

# ── 2. 브라우저 확장 ZIP (Lemur용 보관 + PC용 압축 해제) ──
echo "[2/3] 브라우저 확장 ZIP 다운로드..."
curl -fsSL -o "$DOWNLOAD_DIR/codebreeze-bridge.zip" "$BASE_URL/codebreeze-bridge.zip"

mkdir -p "$BRIDGE_DIR"
unzip -o "$DOWNLOAD_DIR/codebreeze-bridge.zip" -d "$BRIDGE_DIR"
echo "  → ZIP 보관: $DOWNLOAD_DIR/codebreeze-bridge.zip"
echo "  → 압축 해제: $BRIDGE_DIR"

# ── 3. 브라우저 확장 CRX (PC Chrome/Edge용) ──
echo "[3/3] 브라우저 확장 CRX 다운로드..."
curl -fsSL -o "$DOWNLOAD_DIR/codebreeze-bridge.crx" "$BASE_URL/codebreeze-bridge.crx"

echo ""
echo "=== 완료 ==="
echo "→ VSIX : 에디터 리로드 필요 (Ctrl+Shift+P → Reload Window)"
echo "→ ZIP  : $DOWNLOAD_DIR/codebreeze-bridge.zip (Lemur에서 리로드)"
echo "→ ZIP  : $BRIDGE_DIR 에 압축 해제 완료 (Edge 개발자 모드 로드)"
echo "→ CRX  : $DOWNLOAD_DIR/codebreeze-bridge.crx (Chrome/Edge에서 설치)"
