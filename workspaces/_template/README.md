# Modelo de workspace

Esta pasta é o **molde** de todo workspace. Cada peça tem um papel:

| Pasta / arquivo | O que é | Analogia |
|---|---|---|
| `workspace.yaml` | Identidade e configuração do workspace | A etiqueta da caixa |
| `AGENTS.md` | Regras e contexto que o modelo sempre lê | O manual de conduta |
| `skills/` | Procedimentos sob demanda (um `SKILL.md` por pasta) | Receitas guardadas na gaveta |
| `agents/` | Subagentes especialistas (um `.md` por agente) | Colegas que você chama para tarefas específicas |
| `commands/` | Prompts prontos, chamados como `/comando` | Atalhos do teclado |
| `mcp/mcp.json` | Ferramentas externas (servidores MCP) | As tomadas onde se pluga equipamento |
| `files/` | Todos os arquivos de trabalho do workspace, compartilhados por todas as sessões | A gaveta de documentos da sala |
| `sessions/` | Uma pasta por sessão, só com memória e registro (handoff, log, mensagens) | O prontuário compartilhado entre os dois médicos |

## Como cada peça vira arquivo de cada CLI

| Peça | Claude Code | Copilot CLI |
|---|---|---|
| `AGENTS.md` | `CLAUDE.md` contendo `@AGENTS.md` | `AGENTS.md` |
| `skills/<x>/SKILL.md` | `.claude/skills/<x>/SKILL.md` | `.github/skills/<x>/SKILL.md` |
| `agents/<x>.md` | `.claude/agents/<x>.md` | `.github/agents/<x>.agent.md` |
| `commands/<x>.md` | `.claude/commands/<x>.md` | `.github/prompts/<x>.prompt.md` |
| `mcp/mcp.json` | `.mcp.json` | Claude e Copilot |
| `files/` | pasta de trabalho do terminal (workdir padrão) | pasta de trabalho do terminal (workdir padrão) |
| `sessions/<id>/` | `claude --session-id` / `--resume <id>` | `copilot --session-id` / `--resume <id>` |

> Quem faz essa tradução é a aplicação (`app/`). Você só edita o formato neutro.

## Sessões e handoff

Cada CLI guarda o próprio histórico e um não lê o do outro. A pasta da sessão é a ponte
(detalhes em `sessions/_modelo-sessao/README.md`):

1. **Frontmatter do `handoff.md`**: guarda cada aba com o `session_id` nativo do CLI. O app
   gera o UUID antes de abrir o CLI (`--session-id`) e depois retoma com `--resume`, então
   cada motor lembra do que ele mesmo fez.
2. **Corpo do `handoff.md` + `log.md`**: o que permite a um motor saber o que o **outro** fez.

## Regras do formato

- Nomes de pastas e arquivos em `kebab-case`
- Todo `SKILL.md` e todo agente começa com frontmatter YAML contendo `name` e `description`
- A `description` é o que o modelo usa para decidir **quando** usar a peça: seja específico
- Pastas e arquivos iniciados com `_` são ignorados pela aplicação
- Sessões: uma pasta por sessão em `sessions/`, nomeada `aaaa-mm-dd-nome`, igual ao `id`
