---
name: criar-miniapps
description: Use quando o usuário quiser definir, criar, importar ou exportar um miniapp que funcione como uma extensão do CLI Context Hub dentro do Electron.
---

# Criar miniapps no CLI Context Hub

## Definição

Um miniapp é um aplicativo pequeno para uma tarefa do dia a dia, funcionando
como uma extensão do CLI Context Hub. Exemplos: todo-list, pomodoro, agenda.

## Quando usar

Use esta skill quando o usuário quiser criar, importar, exportar ou adaptar
um miniapp para rodar dentro do CLI Context Hub.

## Diretório obrigatório

**Miniapps ficam sempre em `app/apps/miniapps/<nome>/`** — nunca em
`workspaces/*/files/` nem em qualquer outra pasta. O caminho absoluto típico é:

```
C:\Users\<usuário>\Documents\cli-context-hub\app\apps\miniapps\<nome>\
```

O nome da pasta deve ser kebab-case (ex: `pomodoro`, `todo-list`).

## Estrutura mínima

```
app/apps/miniapps/<nome>/
  miniapp.yaml   ← manifesto obrigatório
  index.html     ← ponto de entrada (ou outro arquivo declarado em entry)
```

## Manifesto (miniapp.yaml)

```yaml
name: nome-kebab-case
title: Título Visível
version: 1.0.0
description: Uma linha sobre o que o miniapp faz.
runtime: electron-web
entry: index.html
dataScope: isolated      # isolated | global
integration: none        # none | workspace
permissions: []
capabilities: []         # ex: [persistent-storage]
```

Campos obrigatórios para o host carregar: `entry` (relativo, sem `..`).
Campos com padrão se omitidos: `runtime=electron-web`, `dataScope=isolated`,
`integration=none`.

## Procedimento de criação

1. Entreviste o usuário: problema, funcionalidades, telas, dados, escopo.
2. Crie os arquivos **diretamente em `app/apps/miniapps/<nome>/`**.
3. O `miniapp.yaml` deve usar `dataScope` em camelCase (não `data-scope`).
4. Valide: entry existe, caminho relativo, nome em kebab-case.
5. Siga as instruções de instalação abaixo.

## Instalação

Após criar os arquivos, o miniapp aparece automaticamente no catálogo do
CLI Context Hub **sem reiniciar o app** — o catálogo é carregado em tempo real.

Para verificar se foi reconhecido:
1. Abra o CLI Context Hub.
2. Clique no botão **Miniapps** no menu lateral.
3. O novo miniapp deve aparecer na grade com título e descrição.

Se não aparecer, verifique:
- A pasta está em `app/apps/miniapps/<nome>/` (não em `files/`).
- O `miniapp.yaml` existe e tem `entry` apontando para um arquivo que existe.
- O nome da pasta é kebab-case sem caracteres especiais.
- Abra o DevTools do Electron (Ctrl+Shift+I) e verifique erros no console.

## Dados e isolamento

Padrão é `dataScope: isolated` — dados exclusivos do miniapp, sem acesso a
workspaces ou sessões. Para dados compartilhados entre workspaces use
`dataScope: global` e declare `persistent-storage` em `capabilities`.

## Limites atuais

Não há API de IPC exposta aos miniapps além do que o Electron permite em
`contextIsolation: true`. Funcionalidades que precisem acessar sessões,
terminais ou arquivos do workspace precisam de implementação no host.
