# To-do list

Miniapp global do HarnessHub para tarefas independentes de harnesses e
sessões. A tela agrupa tarefas por dia e oferece prioridade, etiquetas, prazo,
recorrência, busca e filtros.

## Execução atual

Abra `index.html` em um ambiente Electron ou navegador moderno. Os dados ficam
no IndexedDB local da aplicação, no banco `harnesshub-miniapps`, store `tasks`.

O manifesto está em `miniapp.yaml`. A integração com o catálogo e a janela de
miniapps do HarnessHub ainda depende do host principal registrar e abrir o
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
