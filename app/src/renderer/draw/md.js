// Leitor/editor de Markdown do harness-hub.
// - Visualizar: markdown-it gera o HTML e o DOMPurify limpa (a IA também escreve esses arquivos:
//   nada de <script> ou atributos on*). Blocos ```mermaid viram diagrama.
// - Editar: CodeMirror 6 com realce de Markdown; você edita o texto puro do arquivo.
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

const md = new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: false })

// ---- listas de tarefas: "- [ ]" / "- [x]" viram caixinhas (só leitura) ----
md.core.ruler.after('inline', 'task-lists', state => {
  const tokens = state.tokens
  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue
    const m = t.content.match(/^\[([ xX])\]\s+/)
    if (!m) continue
    const first = t.children[0]
    if (first?.type === 'text') first.content = first.content.replace(/^\[([ xX])\]\s+/, '')
    const box = new state.Token('html_inline', '', 0)
    box.content = `<input type="checkbox" disabled${m[1] !== ' ' ? ' checked' : ''}> `
    t.children.unshift(box)
    tokens[i - 2].attrJoin('class', 'task-item')
  }
})

// ---- blocos mermaid ficam marcados para virar diagrama depois ----
const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const t = tokens[idx]
  if (t.info.trim().toLowerCase() === 'mermaid') {
    return `<div class="md-mermaid" data-src="${encodeURIComponent(t.content)}"><pre><code>${md.utils.escapeHtml(t.content)}</code></pre></div>`
  }
  return defaultFence(tokens, idx, options, env, self)
}

// âncoras nos títulos (para links #secao funcionarem)
md.core.ruler.push('heading-ids', state => {
  const used = new Map()
  for (let i = 0; i < state.tokens.length; i++) {
    const t = state.tokens[i]
    if (t.type !== 'heading_open') continue
    const text = state.tokens[i + 1]?.content || ''
    let slug = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    const n = used.get(slug) || 0
    used.set(slug, n + 1)
    if (n) slug += `-${n}`
    t.attrSet('id', slug)
  }
})

let mermaidSeq = 0
async function renderMermaidBlocks (root) {
  const blocks = root.querySelectorAll('.md-mermaid')
  if (!blocks.length) return
  const { default: mermaid } = await import('mermaid')
  // htmlLabels:false → rótulos como texto SVG (o filtro de segurança remove HTML dentro do SVG)
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark', htmlLabels: false, flowchart: { htmlLabels: false } })
  for (const b of blocks) {
    try {
      const { svg } = await mermaid.render(`md-mermaid-${++mermaidSeq}`, decodeURIComponent(b.dataset.src))
      b.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true } })
    } catch { /* diagrama inválido: fica o código */ }
  }
}

/**
 * Renderiza Markdown dentro de `el`.
 * resolveUrl(href) transforma caminhos relativos (imagens) em URLs que o app consegue abrir.
 */
async function render (el, text, { resolveUrl } = {}) {
  const html = md.render(text || '')
  el.innerHTML = DOMPurify.sanitize(html, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'iframe', 'form'] })
  if (resolveUrl) {
    for (const img of el.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src')
      if (!/^[a-z]+:|^\/\//i.test(src)) img.src = resolveUrl(src)
    }
  }
  await renderMermaidBlocks(el)
}

/** Editor de texto (CodeMirror 6). onChange(text) é chamado a cada alteração feita por você. */
function createEditor (parent, text, { onChange } = {}) {
  let silent = false
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text || '',
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.lineWrapping,
        EditorView.updateListener.of(u => { if (u.docChanged && !silent) onChange?.(u.state.doc.toString()) })
      ]
    })
  })
  return {
    getText: () => view.state.doc.toString(),
    // troca o texto (mudança vinda do disco) mantendo o cursor o mais perto possível
    setText (next) {
      const cur = view.state.doc.toString()
      if (cur === next) return
      const pos = Math.min(view.state.selection.main.head, next.length)
      silent = true
      view.dispatch({ changes: { from: 0, to: cur.length, insert: next }, selection: { anchor: pos } })
      silent = false
    },
    focus: () => view.focus(),
    destroy: () => view.destroy()
  }
}

window.HubMd = { render, createEditor }
window.dispatchEvent(new Event('hubmd:ready'))
