---
name: criar-diagramas
description: Use quando o usuário quiser criar, desenhar ou visualizar qualquer tipo de diagrama — arquitetura, fluxo, sequência, organograma, mapa mental, ER, etc.
---

# Criar diagramas

## Quando usar

Use esta skill sempre que o usuário pedir para criar, desenhar, esboçar ou
visualizar algo: arquitetura de sistemas, fluxo de dados, fluxo de processo,
diagrama de sequência, organograma, mapa mental, diagrama ER, ou qualquer
outra representação visual.

## Entrevista

Antes de gerar, faça as perguntas necessárias para entender o diagrama.
Adapte as perguntas ao contexto — não faça todas se o usuário já forneceu
informações suficientes. Agrupe em uma única mensagem.

**Perguntas-base:**

1. **Tipo** — qual tipo de diagrama? (fluxo de sistemas/arquitetura, fluxo de
   processo, sequência de chamadas, organograma, mapa mental, ER, outro)
2. **Componentes** — quais são os elementos principais? (serviços, bancos,
   filas, pessoas, etapas, entidades…)
3. **Conexões** — como eles se conectam? Há direção? Há caminhos incertos ou
   a confirmar?
4. **Anotações** — há metadados importantes a mostrar em cada nó? (repositório,
   aplicação, tecnologia, responsável, observação…)
5. **Destaques visuais** — algum nó ou caminho precisa de cor, estilo ou
   ênfase especial?

Se o usuário responder de forma vaga, gere uma versão razoável e ofereça
ajuste.

## Formato de saída

Pergunte ao usuário qual formato prefere. Se não responder ou não tiver
preferência, use **SVG**.

| Formato | Quando usar |
|---|---|
| **SVG** | padrão; editável, escalável, funciona em qualquer visualizador |
| **SVG + PNG** | quando o usuário precisar embutir em documento ou apresentação; renderize o PNG via Edge headless: `msedge --headless=new --screenshot --window-size=W,H --force-device-scale-factor=2 --screenshot=arquivo.png arquivo.svg` |
| **Excalidraw** | quando o usuário quiser editar visualmente depois; siga a skill `desenhar-excalidraw` |
| **Mermaid** | quando o destino for markdown/GitHub e edição textual for preferida |

Ao gerar SVG+PNG, confira o PNG antes de entregar: texto cortado na borda e
seta sobre rótulo são os erros mais comuns.

## Onde salvar

Siga sempre a skill `onde-salvar-arquivos` antes de gravar qualquer arquivo.
Não salve diagramas em pastas de configuração (`skills/`, `agents/`,
`.claude/`, etc.).

## Estilo visual para SVG (arquitetura e fluxo)

Use este estilo como padrão para diagramas de arquitetura e fluxo de sistemas.
Adapte para outros tipos conforme necessário.

### Nós (tiles)

```svg
<!-- tile padrão: retângulo arredondado cinza claro, ícone centralizado, rótulo em negrito abaixo -->
<rect width="80" height="80" rx="10" fill="#f1f3f4" stroke="#c9cdd1" stroke-width="1.5"/>
<!-- ícone SVG interno (banco, serviço, fila, API…) -->
<!-- rótulo: font-weight:600, font-size:13px, text-anchor:middle, abaixo do tile -->
```

**Ícones sugeridos por tipo:**
- Banco de dados: cilindro ou ícone de stack (`🗄` em SVG nativo)
- Serviço/Worker: engrenagem (`⚙`)
- Fila de mensagens: envelope ou ícone de fila
- API/Gateway: caixa com texto "API" em fonte monoespaçada
- Usuário/Ator: silhueta ou círculo com inicial

**Selos de tecnologia** (badge circular no canto superior direito do tile):
- Use círculo pequeno (r=10) com iniciais ou cor da stack (ex: roxo para .NET,
  laranja para Java, azul para Node)

### Anotações

```svg
<!-- nota lateral: texto pequeno (font-size:11px, fill:#555) com seta fina apontando ao tile -->
<!-- formato sugerido:
     Repo: nome-do-repositorio
     Aplicação: nome-da-aplicacao
-->
```

### Conexões

- Seta sólida (`→`): fluxo confirmado
- Seta tracejada (`- - →`): caminho a confirmar ou eventual
- Chip HTTP: retângulo preto arredondado, texto branco monospace (`POST /rota`)
- Cor verde (`#22c55e`) / âmbar (`#f59e0b`): sinal de vida confirmado / sem prova

### Layout

- Fluxo da esquerda para a direita ou de cima para baixo
- Espaçamento mínimo entre tiles: 40px horizontal, 60px vertical
- Anotações sempre fora da linha de fluxo principal (abaixo ou à direita do tile)
- Viewbox com margem de 20px em todos os lados

## Fluxo de trabalho

1. Entreviste o usuário (uma mensagem com as perguntas relevantes).
2. Confirme o formato de saída.
3. Siga `onde-salvar-arquivos` para definir o destino.
4. Gere o diagrama.
5. Para SVG+PNG, renderize e confira o PNG.
6. Informe o caminho dos arquivos gerados e ofereça ajuste.
