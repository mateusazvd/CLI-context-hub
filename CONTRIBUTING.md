# Contribuindo com o CLI Context Hub

Obrigado pelo interesse! Este guia resume como o código é organizado e as convenções do projeto.

## Começando

```bash
git clone https://github.com/mateusazvd/CLI-context-hub.git
cd CLI-context-hub
npm install            # ferramental da raiz (ESLint, Prettier)
npm --prefix app install   # dependências da aplicação Electron
npm start              # abre o app (= npm --prefix app start)
```

Veja a visão geral em [`docs/architecture.md`](docs/architecture.md).

## Padrões de código

- **Estilo:** 2 espaços, sem ponto e vírgula, aspas simples (`.editorconfig` + `.prettierrc.json`).
- **Formatação:** `npm run format` (Prettier). Confira com `npm run format:check`.
- **Lint:** `npm run lint` (ESLint). O lint deve passar sem erros antes de abrir um PR.
- **Testes:** `npm test`. Novas funcionalidades no núcleo devem vir com teste (ver Fase 5 do roadmap).
- **Idioma:** comentários e UI em pt-BR; nomes de identificadores em inglês quando fizer sentido.

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>: <resumo no imperativo>

[corpo opcional]
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `build`, `ci`.

Exemplos:
- `feat: adiciona store de extensões`
- `fix: corrige retomada de aba do Copilot no Windows`
- `refactor: extrai navegador embutido para extensão`

## Pull Requests

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`).
2. Garanta que `npm run lint` e `npm test` passam.
3. Descreva o que muda e por quê; relacione a fase do roadmap, se aplicável.
4. Um PR por assunto. Evite misturar renomeações em massa com mudanças de lógica.

## Estrutura do repositório

```
CLI-context-hub/
├── app/                ← aplicação Electron
│   ├── src/main/       ← processo principal (Node, sistema)
│   ├── src/renderer/   ← interface
│   ├── src/preload.js  ← ponte IPC (window.hub)
│   └── tests/          ← testes (node:test)
├── workspaces/         ← _template e workspaces
├── docs/               ← documentação
├── eslint.config.js    ← ESLint (flat config)
└── .prettierrc.json    ← Prettier
```

## Extensões (a partir da Fase 3)

Ferramentas como visualizador de SVG, navegador embutido e MathNotes serão **extensões** com manifesto próprio, instaláveis por uma store. O guia de autoria de extensões será adicionado em `docs/` quando a API estabilizar.
