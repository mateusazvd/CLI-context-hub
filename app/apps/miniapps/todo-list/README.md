# To-do list

Miniapp global do CLI Context Hub para tarefas independentes de workspaces e
sessões. A tela agrupa tarefas por dia e oferece prioridade, etiquetas, prazo,
recorrência, busca e filtros.

## Execução atual

Abra `index.html` em um ambiente Electron ou navegador moderno. Os dados ficam
no IndexedDB local da aplicação, no banco `cch-miniapps`, store `tasks`.

O manifesto está em `miniapp.yaml`. A integração com o catálogo e a janela de
miniapps do CLI Context Hub ainda depende do host principal registrar e abrir o
ponto de entrada.

## Funcionalidades

- criar, editar, concluir e excluir tarefas;
- prioridades baixa, média e alta;
- etiquetas;
- prazo;
- recorrência diária, semanal ou mensal;
- busca textual;
- filtro por status e prioridade;
- agrupamento por dia;
- persistência local no IndexedDB.
