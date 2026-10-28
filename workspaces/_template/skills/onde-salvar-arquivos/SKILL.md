---
name: onde-salvar-arquivos
description: Use SEMPRE antes de criar, salvar, gerar, exportar ou mover qualquer arquivo ou pasta (código, documento, planilha, imagem, dados, anotação). Define que os arquivos ficam dentro da pasta files/ do workspace e como perguntar ao usuário em qual pasta gravar.
---

# Onde salvar arquivos

Todo arquivo de trabalho deste workspace mora em **`files/`**, dentro da pasta do workspace (o terminal
abre na raiz do workspace, então o caminho relativo é `files/...`). Essa pasta é compartilhada por todas
as sessões e aparece no explorador do cli-context-hub.

## Antes de criar um arquivo

1. **Se o usuário já disse onde salvar**, use esse lugar e não pergunte de novo.
2. **Se não disse**, liste as subpastas atuais de `files/` (por exemplo com `dir files /b /ad` no CMD
   ou a ferramenta de listar arquivos) e **pergunte** em uma única mensagem curta:
   - em qual **pasta existente** de `files/` salvar (mostre as opções numeradas);
   - ou se prefere **criar uma nova pasta** (sugira um nome em `kebab-case` coerente com o conteúdo);
   - ou salvar na **raiz de `files/`**.
3. Se a tarefa vai gerar **vários arquivos**, pergunte **uma vez só** e use a mesma pasta para todos,
   a menos que o usuário diga outra coisa.
4. Se a resposta for uma pasta nova, crie-a dentro de `files/` antes de salvar.

## Nunca

- Nunca salve fora da pasta do workspace, a não ser que o usuário dê um caminho explícito para isso.
- Nunca salve arquivos de trabalho em `sessions/` (lá ficam só `handoff.md`, `log.md` e `messages.md`)
  nem nas pastas de configuração do workspace: `skills/`, `agents/`, `commands/`, `mcp/`, `.claude/`, `.github/`.
- Nunca sobrescreva um arquivo existente sem avisar; se o nome já existir, pergunte ou sugira outro nome.

## Depois de salvar

Informe o caminho relativo de cada arquivo criado ou alterado, por exemplo `files/api/login.js`.
