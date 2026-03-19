# CodeBreeze — 웹 / code-server / Termux 실행 가이드

CodeBreeze는 데스크톱 VS Code 외에도 **브라우저 기반 VS Code 환경**(code-server)에서 동작합니다.
Android 태블릿, iPad, 또는 원격 서버에서도 AI와 코딩이 가능합니다.

---

## 목차

1. [환경 비교](#1-환경-비교)
2. [데스크톱 VS Code (기본)](#2-데스크톱-vs-code-기본)
3. [code-server (서버/VPS)](#3-code-server-서버vps)
4. [Termux + code-server (Android 태블릿/폰)](#4-termux--code-server-android-태블릿폰)
5. [클립보드 동작 방식](#5-클립보드-동작-방식)
6. [MCP 서버 연결 (선택사항)](#6-mcp-서버-연결-선택사항)
7. [자주 묻는 질문](#7-자주-묻는-질문)

---

## 1. 환경 비교

| 환경 | 클립보드 | MCP 서버 | WebSocket 브릿지 | 권장도 |
|------|----------|----------|------------------|--------|
| 데스크톱 VS Code | ✅ 완전 지원 | ✅ | ✅ | ⭐⭐⭐ |
| code-server (로컬) | ✅ HTTPS 필요 | ✅ | ✅ | ⭐⭐⭐ |
| code-server (원격 서버) | ⚠️ 폴백 사용 | ✅ | ✅ | ⭐⭐ |
| Termux + code-server | ⚠️ 폴백 사용 | ✅ | ✅ | ⭐⭐ |
| GitHub Codespaces | ⚠️ 폴백 사용 | ❌ (네트워크 제한) | ❌ | ⭐ |

> **폴백 사용**: 클립보드 API 실패 시 파일(`.codebreeze-clipboard.md`) 기반으로 자동 전환

---

## 2. 데스크톱 VS Code (기본)

표준 설치. 별도 설정 없이 모든 기능 사용 가능.

```bash
# VSIX 파일로 설치
code --install-extension codebreeze-0.1.0.vsix

# 또는 VS Code Marketplace에서 "CodeBreeze" 검색
```

---

## 3. code-server (서버/VPS)

브라우저에서 VS Code를 실행하는 방법. Ubuntu 서버, Raspberry Pi, VPS 등에 설치합니다.

### 3-1. code-server 설치

```bash
# 공식 설치 스크립트 (권장)
curl -fsSL https://code-server.dev/install.sh | sh

# 또는 npm으로 설치
npm install -g code-server
```

### 3-2. code-server 실행

```bash
# 로컬 전용 (HTTP)
code-server --bind-addr 127.0.0.1:8080 --auth none

# 외부 접근 허용 (HTTPS 필수 — 클립보드 API 요구사항)
code-server --bind-addr 0.0.0.0:8443 --cert --auth password
```

> **중요**: 브라우저 Clipboard API는 **HTTPS 또는 localhost** 환경에서만 동작합니다.
> 외부에서 HTTP로 접근하면 클립보드 API가 차단되어 파일 폴백으로 동작합니다.

### 3-3. HTTPS 설정 (Let's Encrypt)

```bash
# nginx 리버스 프록시 + certbot 예시
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# nginx 설정 (/etc/nginx/sites-available/code-server)
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3-4. CodeBreeze VSIX 설치

```bash
# VSIX 파일을 서버에 복사 후
code-server --install-extension codebreeze-0.1.0.vsix
```

또는 code-server 웹 UI에서:
`Extensions` 패널 → `...` 메뉴 → `Install from VSIX`

### 3-5. 클립보드 폴백 사용 (HTTP 환경)

HTTPS 없이 사용하는 경우 클립보드 대신 파일을 통해 코드를 전달합니다.

**AI → VS Code (Apply):**
1. AI 응답의 코드 블록을 `.codebreeze-clipboard.md` 파일에 붙여넣기
2. `Ctrl+Shift+P` → `CodeBreeze: Apply Code from Clipboard`

또는:
1. `Ctrl+Shift+P` → `CodeBreeze: Manual Paste`
2. 팝업 textarea에 AI 응답 붙여넣기 → Apply 클릭

**VS Code → AI (Copy):**
1. `Ctrl+Shift+C` (파일 복사) 실행
2. `.codebreeze-clipboard.md` 파일이 워크스페이스 루트에 생성됨
3. 해당 파일 내용을 AI 채팅에 붙여넣기

---

## 4. Termux + code-server (Android 태블릿/폰)

Android 태블릿(삼성 덱스, 일반 태블릿)이나 스마트폰에서 실행합니다.

> **참고**: VS Code 데스크톱 앱은 Android에서 직접 실행 불가 (Electron 기반).
> Termux + code-server 조합으로 브라우저에서 VS Code를 사용합니다.

### 4-1. Termux 설치

[F-Droid](https://f-droid.org/packages/com.termux/)에서 Termux 설치 (Google Play 버전은 구버전).

### 4-2. 기본 패키지 설치

```bash
# Termux 패키지 업데이트
pkg update && pkg upgrade

# Node.js 설치 (code-server 의존성)
pkg install nodejs

# git 설치
pkg install git

# 저장소 접근 권한 (선택사항)
termux-setup-storage
```

### 4-3. code-server 설치

```bash
# npm으로 설치
npm install -g code-server

# 설치 확인
code-server --version
```

> **ARM 호환성**: Termux는 ARM 환경이며, code-server v4.x는 ARM64를 공식 지원합니다.

### 4-4. code-server 실행

```bash
# 로컬 실행 (Termux 내 브라우저에서 접근)
code-server --bind-addr 127.0.0.1:8080 --auth none &

# 같은 Wi-Fi의 다른 기기에서 접근 (태블릿 IP 확인: ip addr)
code-server --bind-addr 0.0.0.0:8080 --auth password &
```

브라우저(Chrome/Firefox)에서 `http://localhost:8080` 접속.

### 4-5. 프로젝트 클론 및 CodeBreeze 설치

```bash
# 프로젝트 클론
git clone https://github.com/Station-Sage/CodeBreeze ~/project
cd ~/project

```bash
# 최신 dev 빌드 다운로드
wget -O codebreeze-latest.vsix https://github.com/Station-Sage/CodeBreeze/releases/download/dev-latest/codebreeze-latest.vsix
code-server --install-extension codebreeze-latest.vsix --force

# 브라우저 확장 (Lemur: ZIP / PC Chrome·Edge: CRX)
wget -O ~/codebreeze-bridge.zip https://github.com/Station-Sage/CodeBreeze/releases/download/dev-latest/codebreeze-bridge.zip
wget -O ~/codebreeze-bridge.crx https://github.com/Station-Sage/CodeBreeze/releases/download/dev-latest/codebreeze-bridge.crx

# 설치
code-server --install-extension codebreeze.vsix
```

### 4-6. 삼성 덱스 사용 시 권장 설정

삼성 덱스 모드에서는 키보드/마우스가 연결되어 더 편리하게 사용할 수 있습니다.

```json
// .codebreeze.json (워크스페이스 루트)
{
  "chatUrl": "https://claude.ai",
  "buildCommands": ["npm run build"],
  "testCommands": ["npm test"]
}
```

- 브라우저(Samsung Internet 또는 Chrome)를 덱스 창으로 열고 AI 채팅
- code-server를 다른 창으로 열어 나란히 배치
- **Manual Paste** 커맨드로 클립보드 없이 코드 전달

### 4-7. 백그라운드 실행 (Termux 세션 유지)

```bash
# tmux 설치
pkg install tmux

# tmux 세션에서 code-server 실행
tmux new-session -d -s codeserver 'code-server --bind-addr 127.0.0.1:8080 --auth none'

# 세션 재연결
tmux attach -t codeserver
```

### 4-8. `README.md` — 태블릿 가이드 링크 (선택)

```markdown
> 📱 Android tablet (Termux + code-server): [Setup Guide](docs/code-server-guide.md#4-termux--code-server-android-태블릿폰)
---

## 5. 클립보드 동작 방식

CodeBreeze는 환경을 자동 감지하여 클립보드 전략을 선택합니다.

```
VS Code Clipboard API 쓰기 시도
    ↓ 실패 (권한 거부 / HTTP 환경)
.codebreeze-clipboard.md 파일에 저장
    ↓ (사용자가 파일 열어서 복사하거나)
Manual Paste 패널 (WebView textarea)
```

### 파일 폴백 위치

```
워크스페이스 루트/.codebreeze-clipboard.md
```

이 파일은 `.gitignore`에 추가하는 것을 권장합니다:

```bash
echo ".codebreeze-clipboard.md" >> .gitignore
```

### Manual Paste 패널

클립보드 없이 코드를 전달하는 가장 안정적인 방법:

1. `Ctrl+Shift+P` → `CodeBreeze: Manual Paste`
2. 팝업 textarea에 AI 응답(마크다운 코드 블록 포함) 전체를 붙여넣기
3. **Apply** 클릭

---

## 6. MCP 서버 연결 (선택사항)

code-server 환경에서도 MCP 서버를 실행하면 AI가 직접 파일을 읽고 쓸 수 있어 클립보드가 불필요합니다.

### code-server에서 MCP 서버 시작

```
Ctrl+Shift+P → "CodeBreeze: Start MCP Server"
```

포트 3700에서 시작됩니다.

### 로컬 접근 (같은 기기)

```json
// Claude Desktop ~/.claude_desktop_config.json
{
  "mcpServers": {
    "codebreeze": {
      "url": "http://localhost:3700/mcp"
    }
  }
}
```

### 원격 접근 (다른 기기에서 서버에 접근)

```bash
# SSH 포트 포워딩으로 안전하게 접근
ssh -L 3700:localhost:3700 user@your-server

# 그 후 로컬에서
curl http://localhost:3700/health
```

### Termux에서 MCP 사용

같은 Wi-Fi 내 다른 기기(PC)에서 태블릿의 MCP 서버에 접근:

```bash
# 태블릿 IP 확인
ip addr show wlan0 | grep "inet "

# PC의 Claude Desktop 설정
{
  "mcpServers": {
    "codebreeze-tablet": {
      "url": "http://192.168.1.xxx:3700/mcp"
    }
  }
}
```

---

## 7. 자주 묻는 질문

**Q: Termux에서 code-server 설치가 느립니다.**
A: `npm install -g code-server` 대신 직접 바이너리 다운로드가 더 빠릅니다.
```bash
# ARM64 바이너리 직접 다운로드
VERSION=4.93.1
wget "https://github.com/coder/code-server/releases/download/v${VERSION}/code-server-${VERSION}-linux-arm64.tar.gz"
tar -xzf code-server-*.tar.gz
mv code-server-*/bin/code-server ~/bin/
```

**Q: 클립보드 복사 후 파일에 아무것도 안 씁니다.**
A: VS Code Clipboard API가 성공했다는 의미입니다. 파일 폴백은 API 실패 시에만 작동합니다. HTTPS 환경이면 클립보드 API가 정상 동작합니다.

**Q: `Ctrl+Shift+A`가 동작하지 않습니다 (code-server).**
A: 브라우저 단축키와 충돌할 수 있습니다. 대신 `Ctrl+Shift+P` → `Apply Code from Clipboard`를 사용하거나, code-server 설정에서 단축키를 재매핑하세요.

**Q: Android에서 VS Code 앱을 직접 설치할 수 없나요?**
A: VS Code 데스크톱은 Electron(Chromium + Node.js) 기반으로 Android에서 직접 실행되지 않습니다. code-server(브라우저 기반)가 유일한 공식 방법입니다.

**Q: iPad에서도 사용 가능한가요?**
A: 가능합니다. Termux 대신 **iSH** (Alpine Linux 에뮬레이터)를 사용하거나, 원격 서버의 code-server에 Safari로 접속하세요. iSH는 x86 에뮬레이션이라 성능이 낮습니다.

**Q: GitHub Codespaces에서 MCP 서버가 안 됩니다.**
A: Codespaces의 포워딩 포트(3700)를 `Public`으로 변경하면 외부에서 접근 가능합니다. 단, 보안에 주의하세요. 일반 사용은 클립보드 또는 Manual Paste를 권장합니다.
