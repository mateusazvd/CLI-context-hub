# Arquitetura

CLI Context Hub é uma aplicação **Electron** que organiza o trabalho com CLIs de IA (Claude Code, Copilot, Gemini, Codex, Ollama) em torno de três eixos: **workspaces**, **sessões** e **contexts** (arquivos de trabalho).

## Processos

Como todo app Electron, há três camadas, com isolamento de contexto:

```
┌─────────────────┐   IPC    ┌──────────────────┐
│    renderer     │ <──────> │      main        │
│  (a "tela")     │  via     │  (a "cozinha")   │
│  app.js + draw  │ preload  │  Node + sistema  │
└─────────────────┘          └──────────────────┘
        ▲                              │
        │ window.hub (preload)         │ node-pty / WebContentsView
        ▼                              ▼
   DOM, xterm, three.js         terminais, navegador, arquivos
```

- **main** (`app/src/main/`): único com acesso ao sistema de arquivos, processos e rede. Cria a janela, gerencia terminais (`node-pty`), o navegador embutido (`WebContentsView`), workspaces, sessões, arquivos e o mini-dashboard de uso.
- **preload** (`app/src/preload.js`): expõe `window.hub`, a **única** superfície de IPC que o renderer enxerga (`contextBridge`). Nada de Node vaza para a tela.
- **renderer** (`app/src/renderer/`): desenha a interface e pede tudo ao main via `window.hub`. Não acessa o sistema diretamente.

> Convenção de nomes: no código, `hub` ainda é o nome da ponte (`window.hub`). O produto é **CLI Context Hub**; o termo de domínio é **workspace**.

## Módulos do processo main

`main.js` é a raiz de composição: carrega os módulos abaixo e registra os handlers IPC. Cada módulo é uma fábrica (`createX`) ou um conjunto de funções puras, o que facilita testar sem Electron.

| Módulo | Responsabilidade |
|---|---|
| `workspaces.js` | Listar/criar workspaces, estrutura de pastas, workdir |
| `sessions.js` | Sessões (handoff/log/messages), abas, retomada |
| `terminals.js` | `node-pty`, montagem de args por engine, shell, CDP do navegador |
| `engines.js` | Catálogo de CLIs (ENGINES), quais retomam, quais estão ativos |
| `files.js` | Explorador de `contexts/`, leitura/escrita, watcher, prévia de desenhos |
| `sync.js` | Gera `CLAUDE.md`, `.claude/`, `.github/` etc. a partir do formato neutro |
| `settings.js` | Lê/grava `settings.yaml` |
| `usage.js` | Sonda `/usage` dos CLIs num terminal invisível; statusline do Claude |
| `browser-automation.js` | Runner e gravador de receitas do navegador embutido |
| `miniapps.js` | Catálogo de miniapps (janelas auxiliares) |
| `util.js` | Utilitários compartilhados |

## Renderer

- `app.js` (~3.300 linhas) — **o principal candidato a modularização** (ver roadmap). Concentra: lista de workspaces, explorador, abas de terminal (xterm), navegador embutido, visualizador/editor de arquivos, painel de uso e configurações.
- `graph3d.js` / `workspace-graph.js` — grafo 3D (three.js) de workspaces/arquivos.
- `draw/` — módulo de desenho (Excalidraw em React), **empacotado pelo esbuild** (`npm run build:draw` → `draw/dist/`, que é gerado e fora do git). Inclui leitor de Markdown e visualizador de SVG.

## Fluxos de dados

1. **Abrir sessão:** renderer chama `hub.openSession` → main resolve o workspace, sincroniza o formato neutro (`sync.js`), monta os args do engine (`terminals.js`) e sobe um `node-pty`; a saída volta por `terminal:data`.
2. **Uso:** `usage.js` roda num terminal invisível em intervalo configurável e emite `usage:update`.
3. **Navegador:** um `WebContentsView` sobreposto; CDP na porta `CCH_BROWSER_CDP_PORT` (padrão 9222) permite controlar por Playwright/Puppeteer e pelas automações.

## Variáveis de ambiente

Prefixo `CCH_`: `CCH_HOME` (raiz dos workspaces), `CCH_SETTINGS`, `CCH_SHELL`, `CCH_ENGINE`, `CCH_WORKSPACE`, `CCH_TAB`, `CCH_SESSION_DIR`, `CCH_USAGE_DIR`, `CCH_PROBE`, `CCH_BROWSER_CDP_URL`, `CCH_BROWSER_CDP_PORT`.

## Onde isto vai dar (roadmap)

- **Fase 2 (atual):** padrões de código (ESLint/Prettier/EditorConfig), este documento, quebrar `app.js` e `main.js` em módulos menores.
- **Fase 3:** extrair ferramentas (SVG, navegador, MathNotes, Excalidraw, grafo 3D, miniapps) como **extensões** fora do núcleo, com manifesto e permissões.
- **Fase 4:** **store** de extensões (registry no GitHub).
- **Fase 5:** testes automatizados do núcleo, do IPC e das extensões.

O núcleo que deve sobrar: terminais, sessões, explorador de `contexts/`, engines, configurações e o carregador de extensões.
