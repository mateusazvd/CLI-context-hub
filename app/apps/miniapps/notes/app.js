// Editor de páginas em blocos, no estilo do Notion. Tudo fica salvo no IndexedDB deste miniapp.
// Banco próprio (não o "cch-miniapps" do todo-list): miniapps dividem a mesma origem file://.
const DB_NAME = 'cch-paginas'
const STORE = 'pages'
const UI_KEY = 'cch.paginas.ui'

const TYPES = [
  { type: 'p', icon: 'T', label: 'Texto', hint: 'Parágrafo simples', keys: 'texto paragrafo text' },
  { type: 'h1', icon: 'H1', label: 'Título 1', hint: 'Atalho: #', keys: 'titulo heading h1 cabecalho' },
  { type: 'h2', icon: 'H2', label: 'Título 2', hint: 'Atalho: ##', keys: 'titulo heading h2 subtitulo' },
  { type: 'h3', icon: 'H3', label: 'Título 3', hint: 'Atalho: ###', keys: 'titulo heading h3' },
  { type: 'ul', icon: '•', label: 'Lista', hint: 'Atalho: -', keys: 'lista marcadores bullet ul' },
  { type: 'ol', icon: '1.', label: 'Lista numerada', hint: 'Atalho: 1.', keys: 'lista numerada ordenada numbered ol' },
  { type: 'todo', icon: '☑', label: 'Tarefa', hint: 'Atalho: []', keys: 'tarefa todo checkbox caixa checklist' },
  { type: 'quote', icon: '❝', label: 'Citação', hint: 'Atalho: >', keys: 'citacao quote' },
  { type: 'callout', icon: '💡', label: 'Destaque', hint: 'Caixa com ícone', keys: 'destaque callout aviso nota' },
  { type: 'code', icon: '</>', label: 'Código', hint: 'Atalho: ```', keys: 'codigo code programacao' },
  { type: 'divider', icon: '—', label: 'Divisória', hint: 'Atalho: ---', keys: 'divisoria linha separador divider hr' },
  { type: 'page', icon: '📄', label: 'Subpágina', hint: 'Página dentro desta', keys: 'pagina subpagina page' }
]
const TEXT_TYPES = new Set(['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'todo', 'quote', 'callout', 'code'])
const LIST_TYPES = new Set(['ul', 'ol', 'todo'])
const PLACEHOLDER = {
  p: "Digite '/' para ver os comandos", h1: 'Título 1', h2: 'Título 2', h3: 'Título 3', ul: 'Lista',
  ol: 'Lista', todo: 'Tarefa', quote: 'Citação', callout: 'Escreva um destaque', code: 'Código'
}
// Atalhos digitados no começo de um bloco de texto (o texto antes do cursor precisa ser exatamente isso).
const SHORTCUTS = [
  [/^#\s$/, 'h1'], [/^##\s$/, 'h2'], [/^###\s$/, 'h3'], [/^[-*+]\s$/, 'ul'], [/^1[.)]\s$/, 'ol'],
  [/^\[\s?\]\s$/, 'todo'], [/^\[x\]\s$/i, 'done'], [/^>\s$/, 'quote'], [/^```$/, 'code'], [/^---$/, 'divider']
]
// Linhas coladas viram blocos conforme o prefixo Markdown.
const LINE_RULES = [
  [/^###\s+/, 'h3'], [/^##\s+/, 'h2'], [/^#\s+/, 'h1'], [/^[-*+]\s+\[[xX]\]\s+/, 'done'], [/^[-*+]\s+\[\s\]\s+/, 'todo'],
  [/^[-*+]\s+/, 'ul'], [/^\d+[.)]\s+/, 'ol'], [/^>\s?/, 'quote'], [/^(---|\*\*\*)\s*$/, 'divider']
]
const EMOJIS = ['📄', '📝', '📚', '📌', '💡', '✅', '🚀', '🎯', '🧠', '🛠️', '⚙️', '📊', '📅', '🗂️', '🔒', '🌱',
  '🔥', '⭐', '❤️', '🎨', '🧪', '🐛', '💬', '📎', '🏠', '💼', '🎓', '🧭', '🔍', '👋']

const state = { pages: new Map(), current: null, expanded: new Set(), query: '' }
const menu = { open: false, items: [], index: 0, slash: null, slashStart: 0 }
const pending = new Map()

// ---------- utilidades ----------
const $ = sel => document.querySelector(sel)
function el (tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props)
  for (const c of children.flat()) if (c != null) node.append(c)
  return node
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const normalize = s => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
function htmlToText (html) {
  const t = document.createElement('template')
  t.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n')
  return t.content.textContent
}

// ---------- banco de dados ----------
let dbPromise
function db () {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}
async function tx (mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  })
}
const loadAll = () => tx('readonly', s => s.getAll())
const putPage = page => tx('readwrite', s => s.put(page))
const removePages = ids => tx('readwrite', s => { ids.forEach(id => s.delete(id)) })

function setStatus (text, error = false) {
  const s = $('#status')
  s.textContent = text
  s.classList.toggle('error', error)
}

function scheduleSave (page) {
  page.updatedAt = Date.now()
  clearTimeout(pending.get(page.id))
  setStatus('Salvando…')
  pending.set(page.id, setTimeout(() => writeNow(page.id), 350))
}
function writeNow (id) {
  clearTimeout(pending.get(id))
  pending.delete(id)
  const page = state.pages.get(id)
  if (!page) return
  putPage(page)
    .then(() => { if (!pending.size) setStatus('Salvo') })
    .catch(e => setStatus(`Erro ao salvar: ${e.message}`, true))
}
const flushSaves = () => { for (const id of [...pending.keys()]) writeNow(id) }

function loadUi () { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {} } catch { return {} } }
function persistUi () {
  try { localStorage.setItem(UI_KEY, JSON.stringify({ current: state.current, expanded: [...state.expanded] })) } catch {}
}

// ---------- páginas ----------
const newBlock = (type = 'p', html = '') => ({ id: uid(), type, html, checked: false })
const currentPage = () => state.pages.get(state.current)
const save = () => scheduleSave(currentPage())
const titleOf = p => p.title.trim() || 'Sem título'
const iconOf = p => p.icon || '📄'
const childrenOf = id => [...state.pages.values()].filter(p => p.parentId === id).sort((a, b) => a.createdAt - b.createdAt)
const descendants = id => childrenOf(id).flatMap(c => [c.id, ...descendants(c.id)])

function createPage (parentId = null, title = '') {
  const now = Date.now()
  const page = { id: uid(), parentId, title, icon: '', blocks: [newBlock()], createdAt: now, updatedAt: now }
  state.pages.set(page.id, page)
  if (parentId) state.expanded.add(parentId)
  scheduleSave(page)
  return page
}

// Cria a subpágina e um link para ela no fim da página mãe.
function createSubpage (parent) {
  const child = createPage(parent.id)
  parent.blocks.push({ ...newBlock('page'), pageId: child.id })
  scheduleSave(parent)
  return child
}

async function deletePage (id) {
  const page = state.pages.get(id)
  const ids = [id, ...descendants(id)]
  const extra = ids.length > 1 ? ` e ${ids.length - 1} subpágina(s)` : ''
  if (!confirm(`Excluir "${titleOf(page)}"${extra}? Isso não pode ser desfeito.`)) return
  for (const pid of ids) {
    clearTimeout(pending.get(pid))
    pending.delete(pid)
    state.pages.delete(pid)
    state.expanded.delete(pid)
  }
  for (const p of state.pages.values()) {
    const kept = p.blocks.filter(b => !(b.type === 'page' && ids.includes(b.pageId)))
    if (kept.length !== p.blocks.length) {
      p.blocks = kept.length ? kept : [newBlock()]
      scheduleSave(p)
    }
  }
  try { await removePages(ids) } catch (e) { setStatus(`Erro ao excluir: ${e.message}`, true) }
  if (ids.includes(state.current)) openPage(state.pages.has(page.parentId) ? page.parentId : null)
  else { renderSidebar(); renderPage() }
}

function openPage (id, opts = {}) {
  closeMenu()
  hideEmoji()
  if (!id || !state.pages.has(id)) id = (childrenOf(null)[0] || createPage()).id
  state.current = id
  for (let p = state.pages.get(id); p.parentId; p = state.pages.get(p.parentId)) state.expanded.add(p.parentId)
  persistUi()
  renderSidebar()
  renderPage()
  $('#content').scrollTop = 0
  if (opts.focusTitle) focusEnd($('#title'))
}

// ---------- barra lateral ----------
function renderSidebar () {
  const tree = $('#tree')
  tree.replaceChildren()
  const q = normalize(state.query.trim())
  if (q) {
    const hits = [...state.pages.values()].filter(p => normalize(titleOf(p)).includes(q)).sort((a, b) => b.updatedAt - a.updatedAt)
    hits.forEach(p => tree.append(treeRow(p, 0, false)))
    if (!hits.length) tree.append(el('p', { className: 'tree-empty' }, 'Nenhuma página encontrada.'))
    return
  }
  const walk = (parentId, depth) => {
    for (const p of childrenOf(parentId)) {
      tree.append(treeRow(p, depth, true))
      if (state.expanded.has(p.id)) walk(p.id, depth + 1)
    }
  }
  walk(null, 0)
}

function treeRow (page, depth, nested) {
  const hasKids = childrenOf(page.id).length > 0
  const open = state.expanded.has(page.id)
  const row = el('div', { className: 'tree-row' + (page.id === state.current ? ' active' : ''), title: titleOf(page) })
  row.style.paddingLeft = `${4 + depth * 14}px`
  const canToggle = nested && hasKids
  const toggle = el('button', { className: 'tree-toggle', textContent: canToggle ? (open ? '▼' : '▶') : '' })
  toggle.onclick = e => {
    e.stopPropagation()
    if (!canToggle) return openPage(page.id)
    open ? state.expanded.delete(page.id) : state.expanded.add(page.id)
    persistUi()
    renderSidebar()
  }
  const label = el('span', { className: 'tree-label' },
    el('span', { className: 'tree-icon' }, iconOf(page)),
    el('span', { className: 'tree-title' }, titleOf(page)))
  const add = el('button', { className: 'tree-action', title: 'Nova subpágina', textContent: '+' })
  add.onclick = e => {
    e.stopPropagation()
    const child = createSubpage(page)
    openPage(child.id, { focusTitle: true })
  }
  const del = el('button', { className: 'tree-action', title: 'Excluir página', textContent: '🗑' })
  del.onclick = e => { e.stopPropagation(); deletePage(page.id) }
  row.append(toggle, label, add, del)
  row.onclick = () => openPage(page.id)
  return row
}

// ---------- página ----------
function renderCrumbs () {
  const crumbs = $('#crumbs')
  crumbs.replaceChildren()
  const chain = []
  for (let p = currentPage(); p; p = state.pages.get(p.parentId)) chain.unshift(p)
  chain.forEach((p, i) => {
    if (i) crumbs.append(el('span', { className: 'crumb-sep' }, '/'))
    const b = el('button', { className: 'crumb' }, `${iconOf(p)} ${titleOf(p)}`)
    b.onclick = () => openPage(p.id)
    crumbs.append(b)
  })
  document.title = `${titleOf(currentPage())} · Notes`
}

function renderPage () {
  const page = currentPage()
  const icon = $('#page-icon')
  icon.textContent = iconOf(page)
  icon.classList.toggle('placeholder', !page.icon)
  const title = $('#title')
  if (!(document.activeElement === title && title.dataset.page === page.id)) title.textContent = page.title
  title.dataset.page = page.id
  renderCrumbs()
  renderBlocks()
}

function renderBlocks () {
  const root = $('#blocks')
  root.replaceChildren()
  let n = 0
  for (const block of currentPage().blocks) {
    n = block.type === 'ol' ? n + 1 : 0
    root.append(blockView(block, n))
  }
}

function blockView (block, number) {
  const row = el('div', { className: `block b-${block.type}` })
  row.dataset.id = block.id

  const add = el('button', { className: 'g-btn', title: 'Adicionar bloco abaixo', textContent: '+' })
  add.onmousedown = e => e.preventDefault()
  add.onclick = () => {
    const b = insertAfter(block, newBlock('p', '/'))
    renderBlocks()
    focusBlock(b, 'end')
    showSlash(b, textEl(b), 0, '')
  }
  const handle = el('button', { className: 'g-btn handle', title: 'Transformar, duplicar ou excluir', textContent: '⋮⋮' })
  handle.onmousedown = e => e.preventDefault()
  handle.onclick = () => openBlockMenu(block, handle)
  row.append(el('div', { className: 'gutter' }, add, handle))

  if (block.type === 'divider') {
    const atom = el('div', { className: 'atom', tabIndex: 0 }, el('hr'))
    atom.onkeydown = e => atomKey(e, block)
    row.append(atom)
    return row
  }
  if (block.type === 'page') {
    const target = state.pages.get(block.pageId)
    const atom = el('div', { className: 'atom page-link', tabIndex: 0, title: 'Abrir página' },
      el('span', {}, target ? iconOf(target) : '📄'),
      el('span', { className: 'pl-title' }, target ? titleOf(target) : 'Página excluída'))
    atom.onclick = () => target && openPage(target.id)
    atom.onkeydown = e => atomKey(e, block)
    row.append(atom)
    return row
  }

  const body = el('div', { className: 'b-body' })
  if (block.type === 'ul') body.append(el('span', { className: 'marker' }, '•'))
  if (block.type === 'ol') body.append(el('span', { className: 'marker' }, `${number}.`))
  if (block.type === 'callout') body.append(el('span', { className: 'marker callout-icon' }, '💡'))
  if (block.type === 'todo') {
    const box = el('input', { type: 'checkbox', checked: block.checked, title: 'Concluir' })
    box.onchange = () => { block.checked = box.checked; row.classList.toggle('done', box.checked); save() }
    row.classList.toggle('done', block.checked)
    body.append(box)
  }
  const text = el(block.type === 'code' ? 'pre' : 'div', { className: 'text' })
  text.contentEditable = block.type === 'code' ? 'plaintext-only' : 'true'
  text.spellcheck = block.type !== 'code'
  text.dataset.placeholder = PLACEHOLDER[block.type] || ''
  if (block.type === 'code') text.textContent = block.html
  else text.innerHTML = block.html
  text.addEventListener('input', e => onInput(e, block, text))
  text.addEventListener('keydown', e => onKey(e, block, text))
  text.addEventListener('paste', e => onPaste(e, block, text))
  body.append(text)
  row.append(body)
  return row
}

// ---------- operações em blocos ----------
const blocksOf = () => currentPage().blocks
const textEl = block => document.querySelector(`.block[data-id="${block.id}"] .text`)
const atomEl = block => document.querySelector(`.block[data-id="${block.id}"] .atom`)

function insertAfter (block, fresh) {
  const blocks = blocksOf()
  blocks.splice(blocks.indexOf(block) + 1, 0, fresh)
  save()
  return fresh
}

function syncBlock (block, text) {
  if (!text.textContent && block.type !== 'code') text.innerHTML = ''
  block.html = block.type === 'code' ? text.textContent : text.innerHTML
}

function setType (block, type) {
  if (block.type === type) return
  if (type === 'code') block.html = htmlToText(block.html)
  else if (block.type === 'code') block.html = escapeHtml(block.html).replace(/\n/g, '<br>')
  block.type = type
  if (type !== 'todo') block.checked = false
  save()
}

// Aplica um tipo escolhido no menu: subpágina e divisória têm tratamento próprio.
function convert (block, type) {
  if (type === 'page') {
    const child = createPage(state.current)
    Object.assign(block, { type: 'page', pageId: child.id, html: '', checked: false })
    save()
    openPage(child.id, { focusTitle: true })
    return
  }
  if (type === 'divider') {
    Object.assign(block, { type: 'divider', html: '', checked: false })
    const next = insertAfter(block, newBlock())
    renderBlocks()
    focusBlock(next, 0)
    return
  }
  setType(block, type)
  renderBlocks()
  focusBlock(block, 'end')
}

function removeBlock (block) {
  const blocks = blocksOf()
  const idx = blocks.indexOf(block)
  blocks.splice(idx, 1)
  if (!blocks.length) blocks.push(newBlock())
  save()
  renderBlocks()
  focusBlock(blocks[Math.max(0, idx - 1)], 'end')
}

function duplicateBlock (block) {
  const copy = { ...structuredClone(block), id: uid() }
  insertAfter(block, copy)
  renderBlocks()
  focusBlock(copy, 'end')
}

function focusFirstBlock () {
  const blocks = blocksOf()
  if (blocks[0] && TEXT_TYPES.has(blocks[0].type)) return focusBlock(blocks[0], 0)
  const b = newBlock()
  blocks.unshift(b)
  save()
  renderBlocks()
  focusBlock(b, 0)
}

// ---------- cursor ----------
function caretOffset (node) {
  const sel = getSelection()
  if (!sel.rangeCount) return 0
  const r = sel.getRangeAt(0)
  if (!node.contains(r.startContainer)) return 0
  const pre = document.createRange()
  pre.selectNodeContents(node)
  pre.setEnd(r.startContainer, r.startOffset)
  return pre.toString().length
}
function pointAt (node, offset) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let left = offset
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (left <= t.length) return [t, left]
    left -= t.length
  }
  return [node, node.childNodes.length]
}
function setCaret (node, offset) {
  const r = document.createRange()
  r.setStart(...pointAt(node, offset))
  r.collapse(true)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
}
function rangeBetween (node, start, end) {
  const r = document.createRange()
  r.setStart(...pointAt(node, start))
  r.setEnd(...pointAt(node, end))
  return r
}
function focusEnd (node) { node.focus(); setCaret(node, node.textContent.length) }
function focusBlock (block, offset) {
  const text = textEl(block)
  if (!text) return atomEl(block)?.focus()
  text.focus()
  setCaret(text, offset === 'end' ? text.textContent.length : offset)
}
function caretRect (node) {
  const sel = getSelection()
  if (sel.rangeCount) {
    const rects = sel.getRangeAt(0).getClientRects()
    if (rects.length) return rects[0]
  }
  return node.getBoundingClientRect()
}
// O cursor está na primeira (ou última) linha visual do bloco?
function onEdgeLine (node, dir, caret, len) {
  const sel = getSelection()
  if (!sel.rangeCount) return true
  const rects = sel.getRangeAt(0).getClientRects()
  if (!rects.length) return dir === 'up' ? caret === 0 : caret === len
  const box = node.getBoundingClientRect()
  const lh = parseFloat(getComputedStyle(node).lineHeight) || 24
  return dir === 'up' ? rects[0].top - box.top < lh * 0.9 : box.bottom - rects[rects.length - 1].bottom < lh * 0.9
}

// ---------- edição ----------
function onInput (e, block, text) {
  syncBlock(block, text)
  save()
  if (block.type === 'code') return
  if (markdownShortcut(block, text)) return
  updateSlash(e, block, text)
}

function markdownShortcut (block, text) {
  if (block.type !== 'p') return false
  const caret = caretOffset(text)
  const head = text.textContent.slice(0, caret)
  const hit = SHORTCUTS.find(([re]) => re.test(head))
  if (!hit) return false
  closeMenu()
  rangeBetween(text, 0, caret).deleteContents()
  syncBlock(block, text)
  const type = hit[1]
  if (type === 'divider') {
    const rest = block.html
    Object.assign(block, { type: 'divider', html: '' })
    const next = insertAfter(block, newBlock('p', rest))
    renderBlocks()
    focusBlock(next, 0)
    return true
  }
  setType(block, type === 'done' ? 'todo' : type)
  if (type === 'done') block.checked = true
  renderBlocks()
  focusBlock(block, 0)
  return true
}

function onKey (e, block, text) {
  if (menu.open) return
  const blocks = blocksOf()
  const idx = blocks.indexOf(block)
  const prev = blocks[idx - 1]
  const next = blocks[idx + 1]
  const collapsed = getSelection().isCollapsed
  const caret = caretOffset(text)
  const len = text.textContent.length

  if (block.type === 'code' && ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey) || e.key === 'Tab')) {
    e.preventDefault()
    document.execCommand('insertText', false, e.key === 'Tab' ? '  ' : '\n')
    return
  }
  if (e.key === 'Tab') { e.preventDefault(); return }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (LIST_TYPES.has(block.type) && !len) { convert(block, 'p'); return }
    const nextType = LIST_TYPES.has(block.type) ? block.type : 'p'
    if (caret === 0 && len && collapsed) {
      blocks.splice(idx, 0, newBlock(nextType))
      save()
      renderBlocks()
      focusBlock(block, 0)
      return
    }
    let tail = ''
    if (block.type !== 'code') {
      if (!collapsed) getSelection().deleteFromDocument()
      const r = document.createRange()
      r.setStart(...pointAt(text, caretOffset(text)))
      r.setEnd(text, text.childNodes.length)
      const box = el('div')
      box.append(r.extractContents())
      tail = box.textContent ? box.innerHTML : ''
      syncBlock(block, text)
    }
    const fresh = insertAfter(block, newBlock(nextType, tail))
    renderBlocks()
    focusBlock(fresh, 0)
    return
  }

  if (e.key === 'Backspace' && collapsed && caret === 0) {
    if (block.type !== 'p') { e.preventDefault(); convert(block, 'p'); focusBlock(block, 0); return }
    if (!prev) return
    e.preventDefault()
    if (!TEXT_TYPES.has(prev.type)) {
      if (!len) { blocks.splice(idx, 1); save(); renderBlocks() }
      atomEl(prev)?.focus()
      return
    }
    const at = textEl(prev).textContent.length
    prev.html += prev.type === 'code' ? htmlToText(block.html) : block.html
    blocks.splice(idx, 1)
    save()
    renderBlocks()
    focusBlock(prev, at)
    return
  }

  if (e.key === 'Delete' && collapsed && caret === len && next) {
    e.preventDefault()
    if (TEXT_TYPES.has(next.type)) {
      if (block.type === 'code') block.html += htmlToText(next.html)
      else block.html += next.type === 'code' ? escapeHtml(next.html) : next.html
    }
    blocks.splice(idx + 1, 1)
    save()
    renderBlocks()
    focusBlock(block, len)
    return
  }

  const toPrev = () => { e.preventDefault(); prev ? focusBlock(prev, 'end') : focusEnd($('#title')) }
  const toNext = () => { if (next) { e.preventDefault(); focusBlock(next, 0) } }
  if (e.shiftKey || e.altKey) return
  if (e.key === 'ArrowUp' && onEdgeLine(text, 'up', caret, len)) toPrev()
  else if (e.key === 'ArrowDown' && onEdgeLine(text, 'down', caret, len)) toNext()
  else if (e.key === 'ArrowLeft' && collapsed && caret === 0) toPrev()
  else if (e.key === 'ArrowRight' && collapsed && caret === len) toNext()
}

function atomKey (e, block) {
  const blocks = blocksOf()
  const idx = blocks.indexOf(block)
  const prev = blocks[idx - 1]
  const next = blocks[idx + 1]
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeBlock(block) }
  else if (e.key === 'Enter') {
    e.preventDefault()
    if (block.type === 'page' && state.pages.has(block.pageId)) return openPage(block.pageId)
    const b = insertAfter(block, newBlock())
    renderBlocks()
    focusBlock(b, 0)
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    prev ? focusBlock(prev, 'end') : focusEnd($('#title'))
  } else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && next) {
    e.preventDefault()
    focusBlock(next, 0)
  }
}

function lineToBlock (line) {
  for (const [re, type] of LINE_RULES) {
    if (!re.test(line)) continue
    const b = newBlock(type === 'done' ? 'todo' : type, type === 'divider' ? '' : escapeHtml(line.replace(re, '')))
    if (type === 'done') b.checked = true
    return b
  }
  return newBlock('p', escapeHtml(line))
}

// Colar sempre como texto puro; várias linhas viram vários blocos.
function onPaste (e, block, text) {
  e.preventDefault()
  const data = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
  if (block.type === 'code' || !data.includes('\n')) { document.execCommand('insertText', false, data); return }
  const [first, ...rest] = data.split('\n')
  document.execCommand('insertText', false, first)
  syncBlock(block, text)
  let last = block
  for (const line of rest) last = insertAfter(last, lineToBlock(line))
  renderBlocks()
  focusBlock(last, 'end')
}

// ---------- menus (/ e opções do bloco) ----------
function renderMenu () {
  const box = $('#menu')
  box.replaceChildren()
  if (!menu.items.length) { box.append(el('div', { className: 'menu-empty' }, 'Nenhum resultado')); return }
  menu.items.forEach((item, i) => {
    if (item.section && item.section !== menu.items[i - 1]?.section) box.append(el('div', { className: 'menu-section' }, item.section))
    const row = el('div', { className: 'menu-item' + (i === menu.index ? ' active' : '') },
      el('span', { className: 'mi-icon' }, item.icon),
      el('span', { className: 'mi-text' },
        el('span', { className: 'mi-label' }, item.label),
        item.hint ? el('span', { className: 'mi-hint' }, item.hint) : null))
    row.onmousedown = e => { e.preventDefault(); pickMenu(i) }
    row.onmousemove = () => { if (menu.index !== i) { menu.index = i; renderMenu() } }
    box.append(row)
  })
  box.querySelector('.active')?.scrollIntoView({ block: 'nearest' })
}

function placeMenu (rect) {
  const box = $('#menu')
  box.classList.remove('hidden')
  const h = box.offsetHeight
  const w = box.offsetWidth
  let top = rect.bottom + 6
  if (top + h > innerHeight - 8) top = Math.max(8, rect.top - h - 6)
  box.style.top = `${top}px`
  box.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - w - 8))}px`
}

function pickMenu (i) {
  const item = menu.items[i]
  closeMenu()
  item?.action()
}

function closeMenu () {
  menu.open = false
  menu.slash = null
  $('#menu').classList.add('hidden')
}

function showSlash (block, text, start, query) {
  const q = normalize(query)
  menu.items = TYPES
    .filter(t => !q || normalize(`${t.label} ${t.keys}`).includes(q))
    .map(t => ({ ...t, section: q ? '' : 'Blocos básicos', action: () => applySlash(block, start, t.type) }))
  if (!menu.items.length && q.length > 3) return closeMenu()
  menu.index = 0
  menu.slash = block.id
  menu.slashStart = start
  menu.open = true
  renderMenu()
  placeMenu(caretRect(text))
}

function updateSlash (e, block, text) {
  const caret = caretOffset(text)
  const t = text.textContent
  if (e.inputType === 'insertText' && e.data === '/') {
    const before = t.slice(0, caret - 1)
    if (!before || /\s$/.test(before)) return showSlash(block, text, caret - 1, '')
  }
  if (!menu.open || menu.slash !== block.id) return
  const start = menu.slashStart
  if (caret <= start || t[start] !== '/') return closeMenu()
  const query = t.slice(start + 1, caret)
  if (/^\s|\s\s/.test(query)) return closeMenu()
  showSlash(block, text, start, query)
}

// Remove o "/consulta" digitado e aplica o tipo: no próprio bloco se ficou vazio, senão num bloco novo abaixo.
function applySlash (block, start, type) {
  const text = textEl(block)
  if (!text) return
  const end = Math.max(caretOffset(text), start + 1)
  rangeBetween(text, start, end).deleteContents()
  syncBlock(block, text)
  const empty = !text.textContent.trim()
  if (empty) block.html = ''
  convert(empty ? block : insertAfter(block, newBlock()), type)
}

function openBlockMenu (block, anchor) {
  const items = []
  if (TEXT_TYPES.has(block.type)) {
    for (const t of TYPES) {
      if (t.type !== block.type && t.type !== 'page') items.push({ ...t, hint: '', section: 'Transformar em', action: () => convert(block, t.type) })
    }
  }
  items.push({ section: 'Ações', icon: '⧉', label: 'Duplicar', action: () => duplicateBlock(block) })
  items.push({ section: 'Ações', icon: '🗑', label: 'Excluir', action: () => removeBlock(block) })
  Object.assign(menu, { items, index: 0, slash: null, open: true })
  renderMenu()
  placeMenu(anchor.getBoundingClientRect())
}

// ---------- ícone da página ----------
function showEmoji () {
  const box = $('#emoji')
  box.replaceChildren(
    ...EMOJIS.map(em => el('button', { className: 'emoji-btn', textContent: em, onclick: () => setIcon(em) })),
    el('button', { className: 'emoji-remove', textContent: 'Remover ícone', onclick: () => setIcon('') }))
  const r = $('#page-icon').getBoundingClientRect()
  box.style.top = `${r.bottom + 6}px`
  box.style.left = `${r.left}px`
  box.classList.remove('hidden')
}
const hideEmoji = () => $('#emoji').classList.add('hidden')
function setIcon (icon) {
  currentPage().icon = icon
  save()
  hideEmoji()
  renderPage()
  renderSidebar()
}

// ---------- início ----------
function createWelcome () {
  const page = createPage(null, 'Primeiros passos')
  page.icon = '👋'
  page.blocks = [
    newBlock('p', 'Um editor em blocos no estilo do Notion. Tudo é salvo sozinho neste miniapp.'),
    newBlock('h2', 'Escrevendo'),
    newBlock('ul', 'Digite <b>/</b> no começo de uma linha para escolher o tipo de bloco.'),
    newBlock('ul', 'Atalhos: <code>#</code> título, <code>-</code> lista, <code>1.</code> numerada, <code>[]</code> tarefa, <code>&gt;</code> citação, <code>```</code> código, <code>---</code> divisória.'),
    newBlock('ul', '<b>Ctrl+B</b> negrito, <i>Ctrl+I</i> itálico, <u>Ctrl+U</u> sublinhado. Shift+Enter quebra a linha sem criar bloco.'),
    newBlock('h2', 'Organizando'),
    newBlock('todo', 'Crie uma página com o <b>+</b> da barra lateral'),
    newBlock('todo', 'Passe o mouse numa página da barra lateral e use <b>+</b> para criar uma subpágina'),
    newBlock('callout', 'Passe o mouse num bloco e use <b>⋮⋮</b> para transformar, duplicar ou excluir.')
  ]
  scheduleSave(page)
}

function bindStatic () {
  const newRoot = () => openPage(createPage().id, { focusTitle: true })
  $('#new-root').onclick = newRoot
  $('#new-root-bottom').onclick = newRoot
  $('#search').addEventListener('input', e => { state.query = e.target.value; renderSidebar() })

  const title = $('#title')
  title.addEventListener('input', () => {
    if (!title.textContent) title.innerHTML = ''
    currentPage().title = title.textContent
    save()
    renderSidebar()
    renderCrumbs()
  })
  title.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusFirstBlock() }
  })
  title.addEventListener('paste', e => {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '))
  })

  $('#tail').onclick = () => {
    const blocks = blocksOf()
    const last = blocks[blocks.length - 1]
    if (last?.type === 'p' && !htmlToText(last.html)) return focusBlock(last, 0)
    const b = newBlock()
    blocks.push(b)
    save()
    renderBlocks()
    focusBlock(b, 0)
  }
  $('#page-icon').onclick = () => ($('#emoji').classList.contains('hidden') ? showEmoji() : hideEmoji())

  // Teclas do menu aberto são tratadas antes do bloco (fase de captura).
  document.addEventListener('keydown', e => {
    if (!menu.open) return
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return }
    if (!menu.items.length) { if (e.key === 'Enter') closeMenu(); return }
    const n = menu.items.length
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); menu.index = (menu.index + 1) % n; renderMenu() }
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); menu.index = (menu.index - 1 + n) % n; renderMenu() }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); pickMenu(menu.index) }
  }, true)
  document.addEventListener('mousedown', e => {
    if (menu.open && !$('#menu').contains(e.target)) closeMenu()
    if (!$('#emoji').contains(e.target) && !$('#page-icon').contains(e.target)) hideEmoji()
  })
  $('#content').addEventListener('scroll', () => { closeMenu(); hideEmoji() })
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSaves() })
  window.addEventListener('pagehide', flushSaves)
}

;(async function init () {
  bindStatic()
  try {
    for (const page of await loadAll()) state.pages.set(page.id, page)
  } catch (e) {
    setStatus(`Erro ao abrir os dados: ${e.message}`, true)
  }
  const ui = loadUi()
  state.expanded = new Set((ui.expanded || []).filter(id => state.pages.has(id)))
  if (!state.pages.size) createWelcome()
  openPage(ui.current)
  if (!pending.size) setStatus('Salvo')
})()
