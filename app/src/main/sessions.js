// Sessões: cada uma é uma pasta sessions/<id>/ só com memória e registro: handoff.md, log.md e messages.md.
// Sessões não têm arquivos de trabalho: esses ficam na pasta files/ do harness, compartilhada por todas.
// Todas as escritas passam por uma fila por sessão ("um único escrivão").
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { isDir, nowIso, today, slugify, parseFrontmatter, stringifyFrontmatter } = require('./util')

const TEMPLATE_DIR = '_modelo-sessao'
const SESSION_FILES = ['handoff.md', 'log.md', 'messages.md']

const DEFAULT_BODY = title => `
# ${title}

## Objetivo
<!-- O que esta sessão quer alcançar -->

## Estado atual
<!-- Onde paramos. Escreva para quem chega agora e não viu nada. -->

## Decisões tomadas
<!-- - decisão · motivo -->

## Arquivos relevantes
<!-- - caminho/do/arquivo · por que importa -->

## Próximos passos
- [ ] ...
`

// ---------- fila de escrita ----------
const queues = new Map()
function enqueue (key, fn) {
  const prev = queues.get(key) || Promise.resolve()
  const next = prev.catch(() => {}).then(fn)
  queues.set(key, next)
  next.finally(() => { if (queues.get(key) === next) queues.delete(key) })
  return next
}

// ---------- leitura ----------
function sessionsDir (harness) {
  return path.join(harness.path, 'sessions')
}

function readHandoff (sessionPath) {
  const file = path.join(sessionPath, 'handoff.md')
  const text = fs.readFileSync(file, 'utf8')
  return parseFrontmatter(text)
}

function normalizeTopics (topics) {
  return Array.isArray(topics)
    ? topics.map(topic => String(topic).trim()).filter(Boolean)
    : []
}

function summarize (sessionPath) {
  const { data } = readHandoff(sessionPath)
  return {
    id: data.id || path.basename(sessionPath),
    title: data.title || path.basename(sessionPath),
    status: data.status || 'ativa',
    created: data.created || null,
    updated: data.updated || null,
    last_engine: data.last_engine || null,
    last_tab: data.last_tab || null,
    projects: data.projects || [],
    topics: normalizeTopics(data.topics),
    tabs: Array.isArray(data.tabs) ? data.tabs : [],
    workdir: data.workdir || null,
    path: sessionPath
  }
}

function list (harness) {
  const dir = sessionsDir(harness)
  if (!isDir(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map(d => path.join(dir, d.name))
    .filter(p => fs.existsSync(path.join(p, 'handoff.md')))
    .map(p => { try { return summarize(p) } catch { return null } })
    .filter(Boolean)
    .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')))
}

function get (harness, id) {
  const p = path.join(sessionsDir(harness), id)
  if (!fs.existsSync(path.join(p, 'handoff.md'))) throw new Error(`Sessão não encontrada: ${id}`)
  return summarize(p)
}

// ---------- escrita ----------
function updateHandoff (sessionPath, mutate) {
  return enqueue(sessionPath, () => {
    const file = path.join(sessionPath, 'handoff.md')
    const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    const result = mutate(data)
    data.updated = nowIso()
    fs.writeFileSync(file, stringifyFrontmatter(data, body), 'utf8')
    return result
  })
}

function appendLog (sessionPath, { tab = null, engine = null, text }) {
  return enqueue(sessionPath, () => {
    const time = nowIso().replace('T', ' ').slice(0, 19)
    const who = [tab, engine].filter(Boolean).join(' · ')
    const entry = `\n### ${time}${who ? ' · ' + who : ''}\n${text}\n`
    fs.appendFileSync(path.join(sessionPath, 'log.md'), entry, 'utf8')
  })
}

async function create (harness, { title, workdir, topics }) {
  title = String(title || '').trim() || 'Nova sessão'
  workdir = workdir ? String(workdir).trim() || null : null
  const dir = sessionsDir(harness)
  fs.mkdirSync(dir, { recursive: true })

  // id único: aaaa-mm-dd-slug(-2, -3...)
  const base = `${today()}-${slugify(title)}`
  let id = base
  for (let i = 2; fs.existsSync(path.join(dir, id)); i++) id = `${base}-${i}`
  const sessionPath = path.join(dir, id)

  // copia do modelo do harness só os três arquivos de memória (qualquer outra coisa no modelo é ignorada)
  fs.mkdirSync(sessionPath, { recursive: true })
  const tpl = path.join(dir, TEMPLATE_DIR)
  for (const name of SESSION_FILES) {
    const src = path.join(tpl, name)
    if (isDir(tpl) && fs.existsSync(src)) fs.copyFileSync(src, path.join(sessionPath, name))
  }

  // handoff.md com frontmatter preenchido
  const file = path.join(sessionPath, 'handoff.md')
  let body = DEFAULT_BODY(title)
  if (fs.existsSync(file)) {
    body = parseFrontmatter(fs.readFileSync(file, 'utf8')).body
      .replace(/^# .*$/m, `# ${title}`)
  }
  const now = nowIso()
  const data = {
    id,
    title,
    status: 'ativa',
    created: now,
    updated: now,
    last_engine: null,
    last_tab: null,
    projects: [],
    topics: Array.isArray(topics) ? normalizeTopics(topics) : normalizeTopics(harness.defaultTopics),
    tabs: [],
    workdir: workdir || null
  }
  fs.writeFileSync(file, stringifyFrontmatter(data, body), 'utf8')

  for (const [name, head] of [['log.md', '# Log da sessão\n'], ['messages.md', '# Mensagens entre abas\n']]) {
    if (!fs.existsSync(path.join(sessionPath, name))) fs.writeFileSync(path.join(sessionPath, name), head, 'utf8')
  }

  await appendLog(sessionPath, { text: `Sessão criada: **${title}**` })
  return summarize(sessionPath)
}

async function addTab (sessionPath, { engine, workdir }) {
  const tab = await updateHandoff(sessionPath, data => {
    data.tabs = Array.isArray(data.tabs) ? data.tabs : []
    const n = data.tabs.reduce((max, t) => Math.max(max, Number(String(t.id).replace(/\D/g, '')) || 0), 0) + 1
    const now = nowIso()
    const t = {
      id: `aba-${n}`,
      engine,
      session_id: crypto.randomUUID(),
      workdir,
      project: null,
      role: null,
      created: now,
      last_used: now
    }
    data.tabs.push(t)
    data.last_engine = engine
    data.last_tab = t.id
    return t
  })
  await appendLog(sessionPath, { tab: tab.id, engine, text: `Aba aberta em \`${workdir}\` (session_id \`${tab.session_id}\`)` })
  return tab
}

async function touchTab (sessionPath, tabId) {
  const tab = await updateHandoff(sessionPath, data => {
    const t = (data.tabs || []).find(x => x.id === tabId)
    if (!t) throw new Error(`Aba não encontrada: ${tabId}`)
    t.last_used = nowIso()
    data.last_engine = t.engine
    data.last_tab = t.id
    return { ...t }
  })
  await appendLog(sessionPath, { tab: tab.id, engine: tab.engine, text: 'Aba retomada' })
  return tab
}

// Apaga a pasta da sessão (handoff, log, mensagens). Só dentro de sessions/ e nunca modelos (_*).
function remove (harness, id) {
  const dir = sessionsDir(harness)
  const target = path.resolve(dir, String(id))
  if (path.dirname(target) !== path.resolve(dir) || path.basename(target).startsWith('_') || path.basename(target).startsWith('.')) {
    throw new Error(`Sessão inválida: ${id}`)
  }
  if (!fs.existsSync(path.join(target, 'handoff.md'))) throw new Error(`Sessão não encontrada: ${id}`)
  return enqueue(target, () => fs.rmSync(target, { recursive: true, force: true }))
}

module.exports = { list, get, create, remove, addTab, touchTab, appendLog, updateHandoff }
