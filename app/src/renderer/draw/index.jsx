// Módulo de desenho do cli-context-hub: Excalidraw (React) empacotado pelo esbuild.
// O resto da tela é JS puro; este arquivo expõe uma API simples em window.HubDraw.
//
// Formatos que a IA pode escrever num arquivo .excalidraw (o app converte para o formato completo):
//   1) completo:   { "type": "excalidraw", "elements": [ ...elementos do Excalidraw... ] }
//   2) esqueleto:  { "type": "excalidraw", "elements": [ { "type": "rectangle", "x": 0, "y": 0,
//                    "label": { "text": "API" } }, ... ] }   (sem "version"/"seed": o app completa)
//   3) mermaid:    { "type": "excalidraw", "mermaid": "flowchart LR\n  A --> B" }
// Para editar um desenho existente, a IA escreve <nome>.excalidraw.patch.json:
//   { "add": [esqueletos], "remove": ["id", ...], "update": [{ "id": "x", "text": "novo", "x": 10, ... }],
//     "mermaid": "..." (opcional, acrescenta ao lado do que já existe) }
import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  exportToBlob,
  serializeAsJSON,
  restoreElements,
  CaptureUpdateAction
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

// fontes locais (copiadas para draw/dist/fonts pelo build): nada é baixado da internet
window.EXCALIDRAW_ASSET_PATH = new URL('./', import.meta.url).href

// ---------- conversões ----------

// O texto é medido com a fonte do Excalidraw: ela precisa estar carregada antes de converter,
// senão a medida sai com a fonte reserva (mais estreita) e o texto aparece cortado.
let fontsReady = null
async function ensureFonts () {
  // espera o Excalidraw registrar as fontes e força o download de todas as partes delas
  for (let i = 0; i < 30; i++) {
    const faces = [...document.fonts].filter(f => /Excalifont|Virgil|Nunito|Cascadia/.test(f.family))
    if (faces.some(f => /Excalifont/.test(f.family))) {
      await Promise.all(faces.map(f => f.load().catch(() => {})))
      return
    }
    await new Promise(r => setTimeout(r, 100))
  }
}
const FONT_NAME = { 1: 'Virgil', 2: 'Helvetica', 3: 'Cascadia', 5: 'Excalifont', 6: 'Nunito', 7: 'Lilita One', 8: 'Comic Shanns', 9: 'Liberation Sans' }
const measureCtx = document.createElement('canvas').getContext('2d')
function measureText (text, fontSize, fontFamily, lineHeight = 1.25) {
  measureCtx.font = `${fontSize}px "${FONT_NAME[fontFamily] || 'Excalifont'}"`
  const lines = String(text).split('\n')
  const width = Math.max(...lines.map(l => measureCtx.measureText(l).width))
  return { width: Math.ceil(width), height: Math.ceil(lines.length * fontSize * lineHeight) }
}
// novo texto dentro de uma forma: remede, centraliza e alarga a forma se precisar
function fitBoundText (textEl, container, bump) {
  const { width, height } = measureText(textEl.text, textEl.fontSize, textEl.fontFamily, textEl.lineHeight || 1.25)
  textEl.width = width
  textEl.height = height
  if (container && container.type !== 'arrow') {
    const PAD = 20
    if (width + PAD * 2 > container.width) { container.width = width + PAD * 2; bump(container) }
    textEl.x = container.x + (container.width - width) / 2
    textEl.y = container.y + (container.height - height) / 2
  }
}

// Um elemento "completo" tem versão e seed; o esqueleto não
const isFull = el => el && typeof el.version === 'number' && typeof el.seed === 'number'

async function mermaidToElements (definition) {
  const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw')
  const { elements, files } = await parseMermaidToExcalidraw(definition, { themeVariables: { fontSize: '16px' } })
  return { elements: refitTexts(convertToExcalidrawElements(elements, { regenerateIds: false })), files: files || {} }
}

function skeletonToElements (list) {
  const full = list.filter(isFull)
  const skeleton = list.filter(el => !isFull(el))
  const converted = skeleton.length ? refitTexts(convertToExcalidrawElements(skeleton, { regenerateIds: false })) : []
  return restoreElements([...full, ...converted], null)
}

// mede de novo os textos (agora com a fonte certa) e ajusta posição/tamanho das formas
function refitTexts (elements) {
  const byId = new Map(elements.map(e => [e.id, e]))
  const noop = () => {}
  for (const e of elements) {
    if (e.type !== 'text') continue
    const container = e.containerId ? byId.get(e.containerId) : null
    if (container?.type === 'arrow') {
      const { width, height } = measureText(e.text, e.fontSize, e.fontFamily, e.lineHeight || 1.25)
      const cx = e.x + e.width / 2; const cy = e.y + e.height / 2
      Object.assign(e, { width, height, x: cx - width / 2, y: cy - height / 2 })
    } else {
      fitBoundText(e, container, noop)
    }
  }
  // formas podem ter crescido: refaz o traçado das setas presas nas duas pontas
  const links = elements
    .filter(e => e.type === 'arrow' && e.startBinding?.elementId && e.endBinding?.elementId)
    .map(e => ({ id: e.id, s: e.startBinding.elementId, e: e.endBinding.elementId }))
  if (links.length) connectArrows(elements, links, noop)
  return elements
}

// desloca elementos novos para a direita do que já existe (para não sobrepor)
function placeBeside (existing, incoming) {
  const alive = existing.filter(e => !e.isDeleted)
  if (!alive.length || !incoming.length) return incoming
  const maxX = Math.max(...alive.map(e => e.x + (e.width || 0)))
  const minY = Math.min(...alive.map(e => e.y))
  const inMinX = Math.min(...incoming.map(e => e.x))
  const inMinY = Math.min(...incoming.map(e => e.y))
  const dx = maxX + 120 - inMinX
  const dy = minY - inMinY
  return incoming.map(e => ({ ...e, x: e.x + dx, y: e.y + dy }))
}

/**
 * Lê o texto de um .excalidraw (qualquer um dos 3 formatos) e devolve a cena completa.
 * `converted` diz se o arquivo precisa ser regravado no formato completo.
 */
async function normalize (text) {
  await ensureFonts()
  let data
  try { data = JSON.parse(text || '{}') } catch (e) { throw new Error(`JSON inválido: ${e.message}`) }
  if (Array.isArray(data)) data = { elements: data }
  let elements = Array.isArray(data.elements) ? data.elements : []
  let files = data.files || {}
  let converted = false

  if (elements.some(el => !isFull(el))) {
    elements = skeletonToElements(elements)
    converted = true
  } else {
    elements = restoreElements(elements, null)
  }
  if (typeof data.mermaid === 'string' && data.mermaid.trim()) {
    const m = await mermaidToElements(data.mermaid)
    elements = [...elements, ...placeBeside(elements, m.elements)]
    files = { ...files, ...m.files }
    converted = true
  }
  return { elements, files, appState: data.appState || {}, converted }
}

// ponto na borda do retângulo de `a`, na direção do centro de `b`
function edgePoint (a, b) {
  const ax = a.x + a.width / 2; const ay = a.y + a.height / 2
  const bx = b.x + b.width / 2; const by = b.y + b.height / 2
  const dx = bx - ax; const dy = by - ay
  if (!dx && !dy) return [ax, ay]
  const sx = dx ? (a.width / 2) / Math.abs(dx) : Infinity
  const sy = dy ? (a.height / 2) / Math.abs(dy) : Infinity
  const k = Math.min(sx, sy)
  return [ax + dx * k, ay + dy * k]
}

// liga setas a formas (existentes ou novas) e recalcula o traçado de centro a centro
function connectArrows (elements, links, bump) {
  const byId = new Map(elements.map(e => [e.id, e]))
  for (const l of links) {
    const arrow = byId.get(l.id)
    const from = byId.get(l.s || l.sNew)
    const to = byId.get(l.e || l.eNew)
    if (!arrow || !from || !to) continue
    const [x1, y1] = edgePoint(from, to)
    const [x2, y2] = edgePoint(to, from)
    const GAP = 6
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    const ux = (x2 - x1) / len; const uy = (y2 - y1) / len
    const sx = x1 + ux * GAP; const sy = y1 + uy * GAP
    const ex = x2 - ux * GAP; const ey = y2 - uy * GAP
    Object.assign(arrow, {
      x: sx, y: sy, points: [[0, 0], [ex - sx, ey - sy]],
      width: Math.abs(ex - sx), height: Math.abs(ey - sy),
      startBinding: { elementId: from.id, focus: 0, gap: GAP },
      endBinding: { elementId: to.id, focus: 0, gap: GAP }
    })
    bump(arrow)
    for (const shape of [from, to]) {
      const list = (shape.boundElements || []).filter(b => b.id !== arrow.id)
      shape.boundElements = [...list, { id: arrow.id, type: 'arrow' }]
      bump(shape)
    }
    // rótulo da seta acompanha o meio do traçado
    const label = elements.find(t => t.containerId === arrow.id && t.type === 'text')
    if (label) { label.x = (sx + ex) / 2 - label.width / 2; label.y = (sy + ey) / 2 - label.height / 2; bump(label) }
  }
}

/** Aplica um patch da IA sobre os elementos atuais. */
async function applyPatch (elements, patch) {
  await ensureFonts()
  let next = elements.map(e => ({ ...e }))
  let files = {}
  const byId = new Map(next.map(e => [e.id, e]))
  const bump = e => { e.version = (e.version || 1) + 1; e.versionNonce = Math.floor(Math.random() * 2 ** 31); e.updated = Date.now() }

  for (const id of patch.remove || []) {
    const e = byId.get(id)
    if (e) { e.isDeleted = true; bump(e) }
    // apaga também o texto preso dentro da forma
    for (const t of next) if (t.containerId === id) { t.isDeleted = true; bump(t) }
  }
  for (const u of patch.update || []) {
    const e = byId.get(u.id)
    if (!e) continue
    const { id, text, ...rest } = u
    Object.assign(e, rest)
    if (typeof text === 'string') {
      const target = e.type === 'text' ? e : next.find(t => t.containerId === e.id && t.type === 'text')
      if (target) {
        target.text = text
        target.originalText = text
        fitBoundText(target, target.containerId ? byId.get(target.containerId) : null, bump)
        bump(target)
      }
    }
    bump(e)
  }
  if (Array.isArray(patch.add) && patch.add.length) {
    // Setas que ligam a formas JÁ existentes: o conversor só liga formas do mesmo lote,
    // então tiramos essas pontas da conversão e ligamos à mão depois.
    const existingIds = new Set(next.filter(e => !e.isDeleted).map(e => e.id))
    const links = []
    const prepared = patch.add.map(a => {
      if (a.type !== 'arrow') return a
      const id = a.id || `seta-${Math.random().toString(36).slice(2, 10)}`
      const s = a.start?.id && existingIds.has(a.start.id) ? a.start.id : null
      const e = a.end?.id && existingIds.has(a.end.id) ? a.end.id : null
      const c = { x: 0, y: 0, ...a, id }
      if (s || e) {
        links.push({ id, s, e, sNew: !s && a.start?.id, eNew: !e && a.end?.id })
        if (s) delete c.start
        if (e) delete c.end
      }
      return c
    })
    let added = skeletonToElements(prepared)
    const shapesHavePos = patch.add.filter(a => a.type !== 'arrow').every(a => typeof a.x === 'number' && typeof a.y === 'number')
    if (!shapesHavePos) added = placeBeside(next, added)
    next = [...next, ...added]
    connectArrows(next, links, bump)
  }
  if (typeof patch.mermaid === 'string' && patch.mermaid.trim()) {
    const m = await mermaidToElements(patch.mermaid)
    next = [...next, ...placeBeside(next, m.elements)]
    files = m.files
  }
  return { elements: next, files }
}

/** Resumo em Markdown para a IA "ler" o desenho sem decifrar o JSON inteiro. */
function summarize (elements) {
  const alive = elements.filter(e => !e.isDeleted)
  const byId = new Map(alive.map(e => [e.id, e]))
  const labelOf = e => {
    if (!e) return '?'
    if (e.type === 'text') return e.text
    const t = alive.find(x => x.containerId === e.id && x.type === 'text')
    return t ? t.text : `${e.type} ${e.id}`
  }
  const shapes = alive.filter(e => ['rectangle', 'ellipse', 'diamond', 'frame'].includes(e.type))
  const texts = alive.filter(e => e.type === 'text' && !e.containerId)
  const arrows = alive.filter(e => e.type === 'arrow' || e.type === 'line')
  const lines = ['# Resumo do desenho', '', `Formas: ${shapes.length} · textos soltos: ${texts.length} · setas/linhas: ${arrows.length}`, '']
  if (shapes.length) {
    lines.push('## Formas', '')
    for (const s of shapes) lines.push(`- \`${s.id}\` ${s.type} "${labelOf(s).replace(/\n/g, ' ')}" em (${Math.round(s.x)}, ${Math.round(s.y)}) ${Math.round(s.width)}×${Math.round(s.height)}`)
    lines.push('')
  }
  if (arrows.length) {
    lines.push('## Conexões', '')
    for (const a of arrows) {
      const from = a.startBinding ? labelOf(byId.get(a.startBinding.elementId)) : '(solta)'
      const to = a.endBinding ? labelOf(byId.get(a.endBinding.elementId)) : '(solta)'
      const lbl = alive.find(x => x.containerId === a.id && x.type === 'text')
      lines.push(`- \`${a.id}\` "${from}" → "${to}"${lbl ? ` (rótulo: "${lbl.text}")` : ''}`)
    }
    lines.push('')
  }
  if (texts.length) {
    lines.push('## Textos soltos', '')
    for (const t of texts) lines.push(`- \`${t.id}\` "${t.text.replace(/\n/g, ' ')}" em (${Math.round(t.x)}, ${Math.round(t.y)})`)
    lines.push('')
  }
  return lines.join('\n')
}

function serialize (elements, appState, files) {
  return serializeAsJSON(elements, appState || {}, files || {}, 'local')
}

async function exportPng (elements, appState, files, { selectedOnly = false } = {}) {
  let els = elements.filter(e => !e.isDeleted)
  if (selectedOnly && appState?.selectedElementIds) {
    const sel = appState.selectedElementIds
    const ids = new Set(Object.keys(sel).filter(k => sel[k]))
    // inclui textos presos às formas selecionadas
    els = els.filter(e => ids.has(e.id) || (e.containerId && ids.has(e.containerId)))
  }
  if (!els.length) return null
  const blob = await exportToBlob({
    elements: els,
    appState: { ...appState, exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
    files: files || {},
    mimeType: 'image/png',
    exportPadding: 24
  })
  const buf = await blob.arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// ---------- componente ----------
/**
 * Monta um editor num container.
 * onChange(elements, appState, files) é chamado a cada mudança feita pelo usuário.
 */
function mount (container, { initialData, onChange, onReady }) {
  const root = createRoot(container)
  let api = null
  let suppress = 0 // ignora o onChange disparado por atualizações vindas do disco

  const handle = {
    get api () { return api },
    getScene () {
      if (!api) return null
      return { elements: api.getSceneElementsIncludingDeleted(), appState: api.getAppState(), files: api.getFiles() }
    },
    // substitui/mescla a cena com o que veio do disco, sem disparar onChange
    setScene ({ elements, files }) {
      if (!api) return
      suppress++
      if (files && Object.keys(files).length) api.addFiles(Object.values(files))
      api.updateScene({ elements, captureUpdate: CaptureUpdateAction?.NEVER ?? 'NEVER' })
      setTimeout(() => { suppress = Math.max(0, suppress - 1) }, 0)
    },
    // ao ficar visível (estava oculto na montagem): recalcula o tamanho e centraliza o conteúdo
    reveal ({ fit = false } = {}) {
      if (!api) return
      api.refresh()
      // o refresh atualiza o tamanho no próximo quadro; só então dá para enquadrar
      if (fit) setTimeout(() => api.scrollToContent(undefined, { fitToContent: true, animate: false }), 80)
    },
    scrollToContent () { api?.scrollToContent(undefined, { fitToContent: true, animate: true }) },
    destroy () { root.unmount() }
  }

  root.render(
    <Excalidraw
      excalidrawAPI={a => {
        if (api) return
        api = a
        onReady?.(handle)
      }}
      initialData={{ ...initialData, scrollToContent: true }}
      theme='dark'
      langCode='pt-BR'
      onChange={(elements, appState, files) => { if (!suppress) onChange?.(elements, appState, files) }}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: { saveFileToDisk: true } } }}
    >
      {/* menu enxuto: sem links externos */}
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
    </Excalidraw>
  )
  return handle
}

window.HubDraw = { mount, normalize, applyPatch, summarize, serialize, exportPng }
window.dispatchEvent(new Event('hubdraw:ready'))
