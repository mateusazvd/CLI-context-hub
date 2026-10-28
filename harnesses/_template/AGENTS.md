# <Nome do harness>

## Contexto
<!-- Quem é você neste contexto, qual o domínio, quais projetos fazem parte -->

## Como trabalhar
<!-- Regras de conduta: idioma, estilo de resposta, nível de autonomia -->

## Proteção contra gasto excessivo de tokens
- Antes de trabalho substancial, avalie rapidamente o risco com o contexto disponível, sem ferramentas, pesquisa ou subagente só para avaliar. Tarefas simples seguem sem aviso.
- Avise antes de investigação ampla em integração incerta, mudanças em muitos componentes, processamento em massa ou delegação extensa. Pare também quando houver repetição de falhas sem evidência nova ou crescimento relevante do escopo aprovado.
- Em até 80 palavras, diga o motivo do risco, o resultado útil esperado e UMA alternativa econômica (validar uma premissa, reduzir escopo ou abrir sessão curta com handoff). Ofereça: **Alternativa econômica / Escopo completo / Não prosseguir**; use formulário se disponível e aguarde escolha. Sem resposta não autoriza continuar; aprovação vale só para o escopo escolhido. Não repita o aviso sem mudança material.
- Não invente previsão numérica, custo ou saldo; tokens acumulados de entrada/cache não equivalem à cobrança. Priorize o valor declarado pelo usuário, não a complexidade técnica da tarefa.
- O agente `guardiao-de-tokens` é para avaliação explicitamente solicitada, não uma chamada automática por mensagem. Esta regra é preventiva, não um medidor nem um bloqueio técnico de consumo.

## Stack e convenções
<!-- Linguagens, frameworks, padrões de código, testes, commits -->

## Comandos úteis
<!-- Como rodar, testar, fazer build e deploy -->

## Onde criar arquivos
- Todo arquivo de trabalho fica em `files/`, dentro da pasta deste harness. Antes de criar ou salvar qualquer arquivo, siga a skill `onde-salvar-arquivos`: se o usuário não disse onde salvar, pergunte se é numa pasta existente de `files/`, numa pasta nova ou na raiz de `files/`.
- Para desenhar, diagramar ou ler um desenho (`.excalidraw`), siga a skill `desenhar-excalidraw`: o desenho abre numa subaba ao lado do terminal e o usuário edita junto com você.
- Nunca salve arquivos de trabalho em `sessions/` nem nas pastas de configuração (`skills/`, `agents/`, `commands/`, `mcp/`, `.claude/`, `.github/`).

## Nunca faça
<!-- Limites claros: o que o agente não deve fazer -->
