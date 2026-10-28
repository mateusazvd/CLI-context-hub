// Explorador de arquivos: lista e vigia a pasta contexts/ de cada workspace.
//
// Analogia: é a gaveta de documentos do workspace. A barra lateral é o "vidro" da gaveta:
// mostra o que tem dentro e acende uma luz quando alguém coloca ou mexe em algo.
// A listagem é preguiçosa (uma pasta por vez), então funciona bem mesmo com muitas pastas.
const fs = require('node:fs')
const path = require('node:path')

// Pastas pesadas ou internas que não vale mostrar
const IGNORE = new Set(['node_modules', '.git', '.DS_Store', 'Thumbs.db', 'desktop.ini', '__pycache__', '.venv'])
const MAX_ENTRIES = 2000

function filesRoot (workspace) {
  const root = path.join(workspace.path, 'contexts')
  fs.mkdirSync(root, { recursive: true })
  return root
}

// Converte um caminho relativo (vindo da tela) em absoluto, sem deixar sair da pasta contexts/
function resolveInside (root, rel = '') {
  const abs = path.resolve(root, String(rel || ''))
  const relBack = path.relative(root, abs)
  if (relBack.startsWith('..') || path.isAbsolute(relBack)) throw new Error('Caminho fora da pasta contexts/')
  return abs
}

const toRel = (root, abs) => path.relative(root, abs).split(path.sep).join('/')

// Lista UMA pasta: primeiro as subpastas, depois os arquivos, em ordem alfabética
function listDir (workspace, rel = '') {
  const root = filesRoot(workspace)
  const dir = resolveInside(root, rel)
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    if (e.code === 'ENOENT') return { root, rel, entries: [] }
    throw e
  }
  const out = []
  for (const d of entries) {
    if (IGNORE.has(d.name) || d.name.endsWith('.tmp-hub')) continue
    const abs = path.join(dir, d.name)
    let stat = null
    try { stat = fs.statSync(abs) } catch { continue }
    out.push({
      name: d.name,
      rel: toRel(root, abs),
      type: stat.isDirectory() ? 'dir' : 'file',
      size: stat.isDirectory() ? null : stat.size,
      mtimeMs: stat.mtimeMs
    })
    if (out.length >= MAX_ENTRIES) break
  }
  out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'pt-BR', { numeric: true }) : a.type === 'dir' ? -1 : 1))
  return { root, rel: rel || '', entries: out, truncated: out.length >= MAX_ENTRIES }
}

/**
 * Vigia a pasta contexts/ de um workspace (inclusive subpastas) e avisa o que mudou.
 * Junta várias mudanças seguidas num único aviso (debounce), como fazem os editores.
 */
function createFilesWatcher ({ onChange, log = () => {} }) {
  const watchers = new Map() // workspace.name -> { watcher, pending, timer }

  function watch (workspace) {
    if (watchers.has(workspace.name)) return
    const root = filesRoot(workspace)
    const entry = { watcher: null, pending: new Set(), timer: null }
    try {
      entry.watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
        if (!filename) return
        const rel = String(filename).split(path.sep).join('/')
        if (rel.split('/').some(part => IGNORE.has(part)) || rel.endsWith('.tmp-hub')) return
        entry.pending.add(rel)
        clearTimeout(entry.timer)
        entry.timer = setTimeout(() => {
          const changed = [...entry.pending]
          entry.pending.clear()
          const items = changed.map(r => {
            let exists = true
            let created = false // arquivo recém-criado (não só alterado, movido ou renomeado)
            try { created = Date.now() - fs.statSync(path.join(root, r)).birthtimeMs < 15000 } catch { exists = false }
            return { rel: r, exists, created }
          })
          onChange({ workspace: workspace.name, changes: items })
        }, 250)
      })
      entry.watcher.on('error', e => log('files:watch', e))
    } catch (e) {
      log('files:watch', e)
    }
    watchers.set(workspace.name, entry)
  }

  function closeAll () {
    for (const e of watchers.values()) { try { e.watcher?.close() } catch {} clearTimeout(e.timer) }
    watchers.clear()
  }

  return { watch, closeAll }
}

// Leitura/escrita de texto dentro da files/ (usado pelos desenhos)
function readText (workspace, rel) {
  const abs = resolveInside(filesRoot(workspace), rel)
  try { return fs.readFileSync(abs, 'utf8') } catch (e) { if (e.code === 'ENOENT') return null; throw e }
}
function writeText (workspace, rel, text) {
  const abs = resolveInside(filesRoot(workspace), rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  // gravação direta (não "grava temporário + renomeia"): mantém o mesmo arquivo no disco, o que
  // não confunde o vigia de pastas e não falha no Windows quando outro programa está com ele aberto
  fs.writeFileSync(abs, text, 'utf8')
}
// Cria arquivo ou pasta novos (com as pastas intermediárias); nunca sobrescreve o que já existe.
function createEntry (workspace, rel, { dir = false, text = '' } = {}) {
  const root = filesRoot(workspace)
  const abs = resolveInside(root, rel)
  if (abs === root) throw new Error('Informe um nome.')
  if (fs.existsSync(abs)) throw new Error(`Já existe "${toRel(root, abs)}".`)
  if (dir) return fs.mkdirSync(abs, { recursive: true })
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, text, { encoding: 'utf8', flag: 'wx' })
}
function removeFile (workspace, rel) {
  fs.rmSync(resolveInside(filesRoot(workspace), rel), { force: true })
}
// Prévia de um desenho para a IA ler: .cch/desenhos/<rel>.png e .md (fora da files/, para não poluir)
function writeDrawPreview (workspace, rel, { png, summary, suffix = '' }) {
  const base = path.join(workspace.path, '.cch', 'desenhos', ...String(rel).split('/'))
  fs.mkdirSync(path.dirname(base), { recursive: true })
  const out = {}
  if (png) { fs.writeFileSync(`${base}${suffix}.png`, Buffer.from(png, 'base64')); out.png = `${base}${suffix}.png` }
  if (summary != null) { fs.writeFileSync(`${base}${suffix}.md`, summary, 'utf8'); out.summary = `${base}${suffix}.md` }
  return out
}

// Move arquivo ou pasta dentro da contexts/ (renomeia se já existe nome igual no destino)
function moveEntry (workspace, srcRel, destFolder) {
  const root = filesRoot(workspace)
  const srcAbs = resolveInside(root, srcRel)
  if (!fs.existsSync(srcAbs)) throw new Error(`"${srcRel}" não existe.`)
  const name = path.basename(srcAbs)
  const destDir = resolveInside(root, destFolder)
  // destino precisa ser pasta
  if (fs.existsSync(destDir) && !fs.statSync(destDir).isDirectory()) throw new Error('Destino não é uma pasta.')
  fs.mkdirSync(destDir, { recursive: true })
  let finalName = name
  let destAbs = path.join(destDir, finalName)
  // evita sobrescrever: adiciona sufixo numérico
  if (fs.existsSync(destAbs) && destAbs !== srcAbs) {
    const ext = path.extname(name)
    const base = path.basename(name, ext)
    let i = 1
    while (fs.existsSync(destAbs)) { finalName = `${base} (${i})${ext}`; destAbs = path.join(destDir, finalName); i++ }
  }
  if (destAbs === srcAbs) return toRel(root, destAbs) // já está no destino
  fs.renameSync(srcAbs, destAbs)
  return toRel(root, destAbs)
}

// Renomeia arquivo ou pasta na mesma pasta; nunca sobrescreve (só troca de maiúsculas é permitida)
function renameEntry (workspace, rel, newName) {
  const root = filesRoot(workspace)
  const srcAbs = resolveInside(root, rel)
  if (srcAbs === root) throw new Error('Não é possível renomear a pasta contexts/.')
  if (!fs.existsSync(srcAbs)) throw new Error(`"${rel}" não existe.`)
  const name = String(newName || '').trim()
  if (!name || /[\\/]/.test(name) || name === '.' || name === '..') throw new Error('Nome inválido.')
  const destAbs = resolveInside(root, path.join(path.dirname(path.relative(root, srcAbs)), name))
  if (destAbs === srcAbs) return toRel(root, destAbs)
  if (fs.existsSync(destAbs) && destAbs.toLowerCase() !== srcAbs.toLowerCase()) throw new Error(`Já existe "${name}" nesta pasta.`)
  fs.renameSync(srcAbs, destAbs)
  return toRel(root, destAbs)
}

// Importa arquivo externo para dentro da contexts/
function importFile (workspace, externalPath, destFolder) {
  const root = filesRoot(workspace)
  const destDir = resolveInside(root, destFolder)
  fs.mkdirSync(destDir, { recursive: true })
  const name = path.basename(externalPath)
  let finalName = name
  let destAbs = path.join(destDir, finalName)
  if (fs.existsSync(destAbs)) {
    const ext = path.extname(name)
    const base = path.basename(name, ext)
    let i = 1
    while (fs.existsSync(destAbs)) { finalName = `${base} (${i})${ext}`; destAbs = path.join(destDir, finalName); i++ }
  }
  fs.copyFileSync(externalPath, destAbs)
  return toRel(root, destAbs)
}

// Lê texto de qualquer arquivo dentro do workspace (rel ao workspace root, não ao contexts/)
function readWorkspaceText (workspace, rel) {
  const root = workspace.path
  const abs = path.resolve(root, String(rel || ''))
  const relBack = path.relative(root, abs)
  if (relBack.startsWith('..') || path.isAbsolute(relBack)) throw new Error('Caminho fora do workspace')
  try { return fs.readFileSync(abs, 'utf8') } catch (e) { if (e.code === 'ENOENT') return null; throw e }
}

module.exports = { listDir, filesRoot, resolveInside, createFilesWatcher, readText, writeText, createEntry, removeFile, writeDrawPreview, moveEntry, renameEntry, importFile, readWorkspaceText }
