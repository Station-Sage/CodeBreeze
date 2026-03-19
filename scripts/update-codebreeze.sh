#!/bin/bash
# scripts/update-codebreeze.sh
# CodeBreeze 원커맨드 업데이트 (Termux + code-server / PC 겸용)
set -e

BASE_URL="https://github.com/Station-Sage/CodeBreeze/releases/download/dev-latest"

echo "=== CodeBreeze 업데이트 ==="

# 1. VSIX
echo "[1/3] VSIX 다운로드 & 설치..."
wget -q -O /tmp/codebreeze-latest.vsix "$BASE_URL/codebreeze-latest.vsix"
if command -v code-server &>/dev/null; then
  code-server --install-extension /tmp/codebreeze-latest.vsix --force
elif command -v code &>/dev/null; then
  code --install-extension /tmp/codebreeze-latest.vsix --force
else
  echo "  → /tmp/codebreeze-latest.vsix 에 저장됨 (수동 설치 필요)"
fi
rm -f /tmp/codebreeze-latest.vsix

# 2. 브라우저 확장 ZIP (태블릿 Lemur용)
echo "[2/3] 브라우저 확장 ZIP 다운로드..."
wget -q -O "$HOME/codebreeze-bridge.zip" "$BASE_URL/codebreeze-bridge.zip"

# 3. 브라우저 확장 CRX (PC Chrome/Edge용)
echo "[3/3] 브라우저 확장 CRX 다운로드..."
wget -q -O "$HOME/codebreeze-bridge.crx" "$BASE_URL/codebreeze-bridge.crx"

echo ""
echo "=== 완료 ==="
echo "→ VSIX: 에디터 재시작 필요"
echo "→ ZIP:  ~/codebreeze-bridge.zip (Lemur에서 리로드)"
echo "→ CRX:  ~/codebreeze-bridge.crx (Chrome/Edge에서 설치)"