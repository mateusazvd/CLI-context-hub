---
name: desenhar-excalidraw
description: Use quando o usuário pedir para desenhar, diagramar, esboçar, rabiscar ou visualizar algo (arquitetura, fluxo, fluxograma, sequência, telas, mapa mental, organograma, ER), quando pedir um "excalidraw", ou quando pedir para olhar, ler, entender, revisar, alterar ou implementar um desenho existente (.excalidraw).
---

# Desenhar com Excalidraw no harness-hub

Desenhos são arquivos `.excalidraw` dentro de `files/`. O harness-hub vigia essa pasta: quando você
cria ou altera um desenho, ele **abre sozinho numa subaba ao lado do terminal** e o usuário vê na hora.
O usuário também desenha e edita ali; o app salva no mesmo arquivo. Vocês trabalham no mesmo quadro.

## Onde salvar

Siga a skill `onde-salvar-arquivos`. Se o usuário não disser a pasta, sugira `files/desenhos/`.
Use nomes em `kebab-case`: `files/desenhos/arquitetura-api.excalidraw`.

## Criar um desenho novo (escolha UM formato)

### A) Mermaid — melhor para fluxos, sequências e diagramas com muitas setas
```json
{ "type": "excalidraw", "mermaid": "flowchart LR\n  A[Pedido] --> B{Pago?}\n  B -->|sim| C[Enviar]\n  B -->|não| D[Cancelar]" }
```
Funciona com `flowchart`, `sequenceDiagram` e `classDiagram`. O app converte em formas editáveis.

### B) Esqueleto — quando a posição importa (telas, layouts, arquiteturas em camadas)
```json
{
  "type": "excalidraw",
  "elements": [
    { "type": "rectangle", "id": "front", "x": 0,   "y": 0, "width": 180, "height": 70, "label": { "text": "Front (React)" } },
    { "type": "rectangle", "id": "api",   "x": 320, "y": 0, "width": 180, "height": 70, "label": { "text": "API" } },
    { "type": "ellipse",   "id": "db",    "x": 640, "y": 0, "width": 160, "height": 70, "label": { "text": "Postgres" },
      "backgroundColor": "#a5d8ff", "fillStyle": "solid" },
    { "type": "arrow", "x": 180, "y": 35, "start": { "id": "front" }, "end": { "id": "api" }, "label": { "text": "HTTP" } },
    { "type": "arrow", "x": 500, "y": 35, "start": { "id": "api" },   "end": { "id": "db" } },
    { "type": "text", "x": 0, "y": -60, "text": "Arquitetura v1", "fontSize": 28 }
  ]
}
```
- Tipos: `rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `text`, `frame`.
- Dê `id` legível a toda forma que receberá seta. Setas ligam por `start.id` / `end.id`.
- Espaçamento confortável: ~140 px entre formas; altura 60–80; largura que caiba o texto.
- Cores opcionais: `strokeColor`, `backgroundColor` (com `"fillStyle": "solid"`).
  Use poucas: `#a5d8ff` azul, `#b2f2bb` verde, `#ffec99` amarelo, `#ffc9c9` vermelho.

Escreva o arquivo de uma vez (não em partes). O app reescreve o arquivo no formato completo do
Excalidraw logo depois; isso é esperado.

## Alterar um desenho que já existe

**Não reescreva o `.excalidraw` inteiro** (o usuário pode estar desenhando nele). Escreva um patch ao lado:
`files/desenhos/arquitetura-api.excalidraw.patch.json`

```json
{
  "add":    [ { "type": "rectangle", "id": "cache", "x": 320, "y": 160, "width": 180, "height": 70, "label": { "text": "Redis" } },
              { "type": "arrow", "start": { "id": "api" }, "end": { "id": "cache" } } ],
  "update": [ { "id": "api", "text": "API (Node)" }, { "id": "db", "backgroundColor": "#b2f2bb" } ],
  "remove": [ "id-de-um-elemento" ],
  "mermaid": "flowchart LR\n  X --> Y"
}
```
- Todas as chaves são opcionais. `add` pode ligar setas a formas que já existem.
- `update` aceita `text` (troca o texto da forma) e qualquer propriedade (`x`, `y`, `width`, cores...).
- `mermaid` acrescenta um diagrama ao lado do que já existe.
- O app aplica o patch, apaga o arquivo `.patch.json` e mostra o resultado na hora.

## Ler o desenho atual (o que o usuário fez)

Antes de alterar ou implementar algo a partir de um desenho, leia o resumo que o app mantém atualizado:

- **Resumo (ids, textos, conexões):** `.hub/desenhos/<caminho-dentro-de-files>.md`
  ex.: `.hub/desenhos/desenhos/arquitetura-api.excalidraw.md`
- **Imagem:** o mesmo caminho com `.png` — olhe a imagem quando o layout ou rabiscos importarem.

Use os `id`s do resumo nos seus patches. O resumo e a imagem são atualizados sempre que o desenho muda,
então leia de novo antes de cada alteração.

## Boas práticas

- Antes de desenhar algo grande, confirme em uma frase o que vai entrar no diagrama.
- Prefira vários desenhos pequenos e focados a um gigante.
- Depois de criar ou alterar, diga em uma linha o que fez e o caminho do arquivo.
- Para transformar um desenho em código, leia o resumo, confirme o entendimento e só então implemente
  (os arquivos de código seguem `onde-salvar-arquivos`).
