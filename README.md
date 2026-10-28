# CLI Context Hub

A desktop workspace for managing large amounts of information concisely, built around AI CLIs (Claude Code, GitHub Copilot, Gemini, Codex, Ollama).

> **Status:** early development, but runnable. You can clone, install and launch it today. The extension system and store (see roadmap) are not built yet.

## What it is

CLI Context Hub keeps terminals, sessions, handoffs and working files (*contexts*) in one place, so work started with one AI CLI can be continued by another — or by you, days later — without losing the thread.

- **Workspaces** group related work. Each one has its own skills, agents, commands and a `contexts/` folder.
- **Sessions** carry a `handoff.md` and a `log.md`, so any model picks up where the last one stopped.
- **Integrated terminal** runs the AI CLI of your choice; built-in browser, drawings and mini-apps live alongside it.

## Prerequisites

- **[Node.js](https://nodejs.org/) 18 or newer** (includes `npm`).
- **[Git](https://git-scm.com/).**
- **Windows build tools** — `node-pty` (the terminal) compiles native code. On Windows, install the *Desktop development with C++* workload from Visual Studio Build Tools, or run `npm install --global windows-build-tools` once. On macOS install Xcode Command Line Tools; on Linux install `build-essential` and `python3`.
- **At least one AI CLI** installed and logged in. Install only the ones you use:

  | CLI | Install |
  |---|---|
  | Claude Code | `npm install -g @anthropic-ai/claude-code` |
  | GitHub Copilot | `npm install -g @github/copilot` |
  | Gemini | `npm install -g @google/gemini-cli@latest` |
  | Codex | `npm install -g @openai/codex` |
  | Ollama | download from <https://ollama.com/download> |

  The app launches these commands for you, but it does not install or authenticate them. Each CLI handles its own login.

## Install & run

```bash
git clone https://github.com/mateusazvd/CLI-context-hub.git
cd CLI-context-hub

npm install              # dev tooling (ESLint, Prettier)
npm install --prefix app # the Electron app's dependencies

npm start                # launches the app
```

> Tip: avoid putting the project inside a synced folder (OneDrive, Dropbox). Native modules and `node_modules` can clash with background syncing.

## Using it

1. **Pick or create a workspace** in the left sidebar (`＋` next to the name). A new workspace is copied from `workspaces/_template`.
2. **Start a session** and choose an AI CLI. The app opens it in an integrated terminal, already pointed at the workspace.
3. **Work with files** in the `contexts/` folder of the workspace — the explorer, the built-in editor, drawings and the embedded browser all read and write there.
4. **Resume later.** Claude and Copilot sessions can be resumed; the `handoff.md` keeps the thread. Other CLIs always open a fresh session.
5. **Settings (⚙)** let you enable/disable CLIs, pick the default one and configure the integrated terminal.

## Configuration

`settings.yaml` at the repo root holds the enabled CLIs, the default engine and terminal options. You can edit it in the app (⚙) or by hand.

Environment variables (all prefixed `CCH_`) override defaults — e.g. `CCH_HOME` for the workspaces folder, `CCH_BROWSER_CDP_PORT` for the embedded browser's debugging port. See [`docs/architecture.md`](docs/architecture.md).

## Development

```bash
npm run lint          # ESLint
npm run format        # Prettier (write)
npm test              # unit tests (node:test)
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/architecture.md`](docs/architecture.md).

## Roadmap

1. ✅ Import the prototype and rename it to CLI Context Hub
2. 🔄 Code standards and architecture
3. Extension system — move SVG viewer, embedded browser, MathNotes, Excalidraw, 3D graph and mini-apps out of the core
4. Extension store
5. Automated tests and CI
6. Packaged installers (releases)

## License

[MIT](LICENSE) © Mateus Azevedo

---

## Sobre (PT-BR)

Espaço de trabalho desktop para gerir grandes volumes de informação de forma concisa, em torno de CLIs de IA. Mantém terminais, sessões (com *handoff* e *log*) e arquivos de trabalho (*contexts*) num só lugar, para continuar com um modelo o que começou com outro.

**Pré-requisitos:** Node.js 18+, Git, ferramentas de build nativo (para o `node-pty`) e pelo menos um CLI de IA instalado e logado (tabela acima). **Rodar:** `npm install`, `npm install --prefix app` e `npm start`. O núcleo enxuto e as ferramentas como extensões instaláveis por uma loja ainda estão por vir (itens 3 e 4 do roadmap).
