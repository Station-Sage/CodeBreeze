# CodeBreeze

**Automate code transfer between AI chats (Genspark, ChatGPT, Claude, etc.) and VS Code via clipboard.**

CodeBreeze removes the friction of copy-pasting code between AI chat tools and your editor. It works with any AI service — no special integration required.

---

## Features

### Apply Code from AI Chat → VS Code

| Action | Shortcut |
|--------|----------|
| Apply code blocks from clipboard | `Ctrl+Shift+A` |
| Open CodeBreeze Control Panel | `Ctrl+Shift+I` |

- Parses markdown code blocks from clipboard (supports ` ```lang:filepath ` format)
- Extracts file paths from block headers or preceding comments
- Multi-block support: QuickPick to select which files to apply
- Unified diff patch detection and application
- Safety: git stash or undo point created before applying

### Copy Context from VS Code → AI Chat

| Action | Shortcut |
|--------|----------|
| Copy current file | `Ctrl+Shift+C` |
| Copy selection | Right-click → "Copy Selection for AI" |

- Current file / selection → markdown code block
- Git diff / log → formatted output
- VS Code Problems panel errors with code context (±15 lines)
- Run local build/test and copy output
- Smart context: auto-collect current file + errors + recent git changes

### CodeBreeze Control Panel (`Ctrl+Shift+I`)

A split panel with:
- **Left (Send)**: Buttons to copy file, selection, errors, git diff, run build/test
- **Right (Receive)**: Clipboard code blocks listed with file names, Preview & Apply buttons
- **Auto-watch**: Toggle clipboard monitoring — auto-updates when AI chat response is copied

### Open AI Chat in VS Code

Click **💬 Open AI Chat** in the sidebar or run `CodeBreeze: Open AI Chat` to open your configured AI chat URL (default: Genspark) in a VS Code tab.

### VS Code Event Monitoring

CodeBreeze monitors VS Code internally and notifies you when:
- Build/compile tasks complete (success or failure)
- Terminal output contains errors
- Compiler diagnostics (errors/warnings) change
- Git state changes (commits, branch switches)

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `codebreeze.chatUrl` | `https://www.genspark.ai/agents?type=ai_chat` | AI chat URL to open |
| `codebreeze.buildCommands` | `["npm run build"]` | Local build commands |
| `codebreeze.testCommands` | `["npm test"]` | Local test commands |
| `codebreeze.gitDiffMode` | `unstaged` | Git diff mode (staged/unstaged/both) |
| `codebreeze.contextLines` | `15` | Lines around errors to include |
| `codebreeze.autoLevel` | `notify` | Automation level (off/notify/auto) |
| `codebreeze.autoWatchClipboard` | `false` | Auto-watch clipboard in control panel |
| `codebreeze.githubToken` | `` | GitHub PAT for remote CI logs (optional) |

### Project-level config

Create `.codebreeze.json` in your workspace root to override settings:

```json
{
  "buildCommands": ["make build"],
  "testCommands": ["make test"],
  "chatUrl": "https://chat.openai.com"
}
```

---

## Code Block Format

CodeBreeze recognizes these formats from AI chat responses:

**Inline filepath (preferred):**
````
```typescript:src/app.ts
// code here
```
````

**Comment-based filepath:**
````
// filepath: src/app.ts
```typescript
// code here
```
````

---

## Commands

All commands are available via `Ctrl+Shift+P` → `CodeBreeze`:

- `Apply Code from Clipboard`
- `Copy File for AI`
- `Copy Selection for AI`
- `Copy Git Diff for AI`
- `Copy Git Log for AI`
- `Copy Errors for AI`
- `Run Build and Copy Log`
- `Run Test and Copy Log`
- `Copy Smart Context for AI`
- `Open AI Chat`
- `Open CodeBreeze Control Panel`
- `Undo Last Apply`

---

## License

MIT