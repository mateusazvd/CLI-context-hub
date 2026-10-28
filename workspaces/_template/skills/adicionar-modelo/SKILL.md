---
name: adicionar-modelo
description: Use ao adicionar ou adaptar um provedor, modelo ou CLI de IA no CLI Context Hub, incluindo ativação nas Configurações.
---

# Adicionar modelo ou CLI

## Escopo

Diferencie um modelo interno (opção `model` do CLI existente) de um novo motor
(executável como Claude Code, Copilot ou Gemini). Não cadastre cada variante
de modelo como se fosse um CLI separado.

## Procedimento

1. Confirme provedor, executável, instalação, modelo opcional e escopo.
2. Leia `app/src/main/engines.js`, `settings.js`, `terminals.js`, `main.js`,
   `workspaces.js`, `sync.js`, `usage.js` e a interface de Configurações.
3. Consulte a documentação oficial e o `--help` instalado. Verifique prompt
   interativo, ID escolhido pelo host, retomada por ID, diretórios adicionais
   e seleção de modelo. Nunca presuma que flags de outro CLI funcionam.
4. Cadastre metadados e capacidades em `ENGINE_REGISTRY`. Menus, listas e
   configurações derivam desse cadastro; não adicione listas paralelas.
5. Se o CLI não aceita ID escolhido pelo host, implemente captura confiável
   do ID nativo. Nunca use "latest" para retomar abas concorrentes.
6. Preserve comandos e retomadas existentes. Valide versões incompatíveis
   antes de criar sessão/aba e informe instalação/atualização necessária.
7. Integre instruções e skills nos caminhos oficialmente suportados pelo CLI.
   Preserve arquivos manuais e explicite limitações de agentes, comandos e MCP.
8. Ativação global fica em `engine.enabled` nas Configurações; `engine.default`
   precisa estar ativo. Exija ao menos um CLI ativo. `engines.supported: null`
   no workspace herda o cadastro; listas explícitas restringem compatibilidade.
9. Ao desativar, peça confirmação avisando que os terminais serão encerrados.
   Encerre os terminais e consultas de uso daquele CLI, preserve histórico e
   bloqueie novas sessões/retomadas no backend, não só na interface.
10. Só habilite coleta de uso com fonte/parser próprios; se ausentes, informe
    "sem integração de uso". Não execute sondas que consumam prompts pagos.
11. Atualize cores, documentação, template e workspaces autorizados. Não altere
    modelos ou argumentos personalizados sem necessidade.
12. Acrescente testes de argumentos, configurações, desativação, retomada,
    CLI ausente/incompatível e sincronização. No Windows deste ambiente, use
    CMD. Se o executor depender de PowerShell bloqueado, registre o bloqueio;
    não apresente testes não executados como aprovados.

## Entrega

Informe suporte implementado, como ativar e escolher padrão, pré-requisitos
externos e limitações reais. Ativar não instala o CLI nem configura credenciais.
Use `onde-salvar-arquivos` antes de gravar e `gerar-logs-handoffs` no checkpoint.
