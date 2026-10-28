# cli-context-hub (app)

Aplicação Electron do cli-context-hub: escolha um workspace, inicie ou retome uma sessão e trabalhe
com Claude Code CLI, Copilot CLI ou Gemini CLI num terminal integrado.

## Rodar

```bash
npm install
npm start
```

`npm start` empacota o editor de desenho e o de Markdown na primeira vez (ou quando `src/renderer/draw/*` muda).
Para forçar: `npm run build:draw`.

Pré-requisitos: os CLIs que deseja usar instalados e acessíveis pelo CMD.
Para Gemini: `npm install -g @google/gemini-cli@latest`.
Ativar um CLI no app não instala o executável nem altera suas credenciais.
O preflight do Gemini verifica `--help` e exige suporte a `--session-id`,
`--resume`, `--prompt-interactive` e `--include-directories`, antes de criar abas.

Testes de integração dos motores (sem acessar provedores): `npm test`.

## Estrutura

```
src/
├── main/                 ← processo principal (acesso ao SO)
│   ├── main.js           ← janela + IPC (workspace:list, session:list, session:open, terminal:*)
│   ├── settings.js       ← lê ../settings.yaml (configurações do programa)
│   ├── engines.js        ← cadastro único de CLIs, metadados e argumentos
│   ├── workspaces.js      ← lê ../workspaces/*/workspace.yaml
│   ├── sessions.js       ← cria/lista sessões, abas, log (fila de escrita única)
│   ├── terminals.js      ← PTY (node-pty) + preflight e execução dos CLIs
│   ├── sync.js           ← tradutor: copia skills/agents/commands do workspace para .claude/ e .github/
│   ├── files.js          ← explorador: lista e vigia a pasta files/ do workspace
│   ├── usage.js          ← mini-dashboard: statusline do Claude + /usage do Copilot
├── statusline/
│   └── claude-statusline.js ← statusline do Claude que grava os limites do plano
│   └── util.js
├── preload.js            ← ponte segura (window.hub)
├── renderer/draw/        ← desenho (index.jsx: Excalidraw + React) e Markdown (md.js), empacotados em draw/dist
└── renderer/             ← tela (HTML/CSS/JS puro + xterm.js)
```

## Como as sessões nativas são ligadas

- Nova aba: o app gera um UUID e abre `claude --session-id <uuid>` / `copilot --session-id <uuid>`,
  gravando o UUID no `handoff.md` antes mesmo do CLI abrir.
- Retomar aba: `claude --resume <uuid>` / `copilot --resume <uuid>`, na mesma pasta (`workdir`).
- Gemini usa `--session-id <uuid>` e `--resume <uuid>`; nunca retoma "latest".
  O prompt usa `--prompt-interactive` para manter o terminal interativo.
- Para `workdir` fora do workspace, o app inclui sua raiz via `--add-dir` (Claude/Copilot)
  ou `--include-directories` (Gemini). Dentro do workspace não é necessário incluir diretórios extras.

## Configurações do programa

Ficam em `cli-context-hub/settings.yaml` (criado automaticamente na primeira execução e relido a cada uso):

```yaml
engine:
  default: claude      # claude | copilot | gemini | codex | ollama
  enabled: [claude, copilot, gemini]
terminal:
  shell: null          # null = CMD no Windows
```

Ordem de prioridade do motor padrão: `workspace.yaml` (`engines.default`) > `settings.yaml` > primeiro motor suportado.
Somente motores ativos e suportados entram nessa escolha; nenhuma opção compatível resulta em `null`.

Em **Configurações → CLIs ativos**, marque/desmarque os provedores e clique em Salvar.
Ao desativar, o app pede confirmação e **encerra os terminais abertos** desses CLIs,
inclusive operações em andamento e sondas de uso. Sessões e arquivos são preservados;
novas sessões e retomadas ficam bloqueadas até reativar. É obrigatório manter pelo
menos um CLI ativo e selecionar um padrão ativo. A mudança vale sem reiniciar.

Configurações antigas sem `engine.enabled` habilitam todos os cadastrados. No
`workspace.yaml`, `engines.supported: null` herda o cadastro; uma lista explícita
restringe compatibilidade. O template e os workspaces existentes usam `null`.
Opções `gemini.model` e `gemini.args` permitem escolher modelo/argumentos por workspace.

## Explorador de arquivos (direita)

Com uma aba aberta, a barra da direita mostra a pasta `files/` do workspace daquela aba, com subpastas
carregadas sob demanda e atualização ao vivo (o que muda fica verde por 1 minuto). Clique duplo abre o
arquivo no programa padrão; botão direito: abrir, mostrar no Explorer, copiar caminho. O botão 🗂 na
barra de abas mostra/oculta; a borda esquerda redimensiona.

Se o `workspace.yaml` não define `workdir` (vazio, `null` ou `~`), o terminal abre na **raiz do workspace**,
onde os CLIs encontram `AGENTS.md`, `CLAUDE.md` e as skills. A skill `onde-salvar-arquivos` (com a regra
no `AGENTS.md`) faz os modelos salvarem em `files/` e perguntarem a pasta quando você não disser.

## Tradutor do workspace (src/main/sync.js)

Antes de abrir cada aba, o app copia o formato neutro do workspace para as pastas que os CLIs leem,
**uma única vez por workspace, na raiz dele** (nunca dentro das sessões):

| Origem | Destino | Quem lê |
|---|---|---|
| `skills/<x>/` | `.claude/skills/<x>/` | Claude e Copilot |
| `agents/<x>.md` | `.claude/agents/<x>.md` e `.github/agents/<x>.agent.md` | Claude / Copilot |
| `commands/<x>.md` | `.claude/commands/<x>.md` | Claude |
| `AGENTS.md` | `CLAUDE.md` com `@AGENTS.md` | Claude (o Copilot lê o AGENTS.md direto) |
| `AGENTS.md` | `GEMINI.md` com `@AGENTS.md` | Gemini |
| `skills/<x>/` | `.gemini/skills/<x>/` | Gemini |

O **Codex** usa `AGENTS.md` diretamente e é iniciado pelo CLI Context Hub com
`codex start --no-daemon`. Esses argumentos são acrescentados automaticamente em toda nova sessão, junto com `CODEX_CA_CERTIFICATE` apontando para o bundle de certificados do Git. O executável deve estar instalado no PATH. O Codex não entra no
mini-dashboard de uso enquanto não houver uma fonte de métricas própria.

O **Ollama** abre só o executável `ollama` na pasta da sessão (`workdir`), sem ID de sessão, prompt,
modelo, variáveis nem sincronização de skills: o menu do próprio Ollama escolhe o modelo/integração.
`ollama.args` no `workspace.yaml` vira os argumentos (ex.: `[run, qwen3.5:9b]`). "Retomar" a aba apenas
abre o `ollama` de novo, sem histórico. Sem integração de uso no mini-dashboard.

Ao abrir ou retomar uma aba, a sincronização prepara somente os recursos do CLI
escolhido. Gemini não acessa `.claude` ou `.github`; Copilot ainda usa as skills
em `.claude/skills`. Falhas nas pastas necessárias ao CLI continuam sendo
informadas e impedem a abertura, sem iniciar com configuração incompleta.
| `mcp/mcp.json` | `.mcp.json` (se houver servidores) | Claude e Copilot |

As pastas geradas são recriadas a cada aba: edite só as originais. Itens com nome iniciado por `_`
(ex.: `_exemplo-skill`) são ignorados.
Para Gemini, skills geradas são identificadas com `.cch-generated`;
skills manuais conflitantes produzem erro em vez de serem sobrescritas. Um
`GEMINI.md` manual é preservado. Agentes, comandos e MCP ainda não são traduzidos
para formatos Gemini: essa integração cobre instruções, skills e sessões.

## Desenhos (Excalidraw) agrupados à aba

Cada aba de terminal pode ter **subabas de desenho**: arquivos `.excalidraw` da `files/` do workspace.

- **A IA cria/edita** um `.excalidraw` (ou um `<nome>.excalidraw.patch.json`) → o app abre a subaba
  sozinho na aba ativa daquele workspace e redesenha na hora. Formatos aceitos: completo, esqueleto
  (`convertToExcalidrawElements`) e Mermaid (`"mermaid": "flowchart ..."`). Veja a skill `desenhar-excalidraw`.
- **Você desenha** → o app salva no arquivo (0,7 s depois de parar) e mantém para a IA
  `.cch/desenhos/<rel>.png` (imagem) e `.cch/desenhos/<rel>.md` (resumo com ids, textos e conexões).
- Terminal e desenho ficam lado a lado (arraste a divisória) ou **⤢ Maximizar**.
- No explorador: ✏ cria um desenho; clique duplo em `.excalidraw` abre na subaba; botão direito
  numa pasta → "Novo desenho aqui".
- Os desenhos abertos em cada aba ficam no `handoff.md` (`tabs[].drawings`) e reabrem ao retomar.

## Arquivos Markdown (.md)

Clique duplo num `.md` no explorador (ou botão direito → "Abrir no leitor" / "Editar arquivo") abre uma
subaba 📝 no mesmo esquema dos desenhos. Um único botão alterna **✎ Editar arquivo** ↔ **👁 Visualizar arquivo**:

- **Visualizar:** `markdown-it` + `DOMPurify` (scripts e atributos `on*` são removidos), tabelas, listas de
  tarefas, âncoras e blocos ```` ```mermaid ```` como diagrama. Links web abrem no navegador; links para
  outros `.md`/`.excalidraw` abrem em subaba.
- **Editar:** CodeMirror 6 com realce de Markdown. Salva sozinho 0,8 s depois de parar de digitar.
- Se a IA alterar o arquivo aberto, a subaba atualiza na hora. Se você tiver alterações ainda não salvas,
  a sua versão é mantida e o app avisa.

## Mini-dashboard de uso

- **Claude:** as abas do Claude abertas pelo app usam a statusline `src/statusline/claude-statusline.js`
  (via `--settings`). Depois de cada resposta o Claude entrega os limites do plano para ela, que grava
  `cli-context-hub/.usage/claude-statusline.json`; o painel atualiza na hora. Nenhuma consulta extra é feita
  (o `/usage` do Claude consulta um servidor da Anthropic que pode estar bloqueado em redes corporativas).
- **Copilot:** a cada `usage.intervalMinutes` (padrão 5) o app abre o CLI num terminal invisível
  (`cli-context-hub/.usage/probe`), digita `/usage` e lê a tela. A última tela fica em `.usage/copilot-last.txt`.
- **Gemini:** o painel mostra a tag **free** definida no `workspace.yaml` e não
  calcula uso ou cota. Isso evita transformar uma sessão de sondagem vazia em
  feedback de erro ou em percentual enganoso.
  A tela original fica em `.usage/gemini-last.txt` para diagnóstico.
  O formato pode variar conforme versão e autenticação; dados não reconhecidos
  aparecem como `sem leitura`, nunca como uma estimativa inventada.
  O resultado registra o comando consultado. O cache de versões anteriores da
  sonda Gemini é invalidado ao iniciar, para não rotular `/stats model` como
  `/model`. Números preservados após falha são marcados como antigos.
  A sonda remove variáveis herdadas de VS Code/Cursor, usa `--screen-reader` e
  `--skip-trust`, rejeita o onboarding de atalhos e limpa sugestões antes de
  executar o comando. Assim ela não tenta instalar o Gemini CLI Companion nem
  alterar keybindings do editor.
- CLIs desativados não são consultados nem mostrados no painel.

Clicar no motor no menu mostra os dados brutos recebidos.
Limites da Gemini API são por projeto, não por chave:
[documentação oficial](https://ai.google.dev/gemini-api/docs/rate-limits).

## Adicionar outro CLI

Use a skill `adicionar-modelo` da pasta principal `skills/` do workspace (incluída
também no template). O cadastro fica em `src/main/engines.js`; a interface recebe
os metadados por `engines:list`. Confirme flags e capacidades oficiais, adapte
preflight/sincronização quando necessário e acrescente testes. Variantes internas
de um mesmo provedor são configuradas em `model`, não como motores duplicados.

Contrato Gemini consultado:
[argumentos oficiais](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/config.ts),
[sessões](https://geminicli.com/docs/cli/session-management/) e
[skills](https://geminicli.com/docs/cli/skills/).

## Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `CCH_HOME` | `../workspaces` | Onde ficam os workspaces |
| `CCH_SETTINGS` | `../settings.yaml` | Arquivo de configurações |
| `CCH_SHELL` | `terminal.shell` | Sobrepõe o shell das configurações |

Dentro de cada terminal o app define `CCH_WORKSPACE`, `CCH_SESSION_DIR`,
`CCH_TAB` e `CCH_ENGINE` (base para os hooks de log que virão).

## Atalhos

- `Ctrl+Shift+C` / `Ctrl+Shift+V`: copiar / colar no terminal
