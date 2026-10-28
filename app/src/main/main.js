// Processo principal (a "cozinha"): acesso ao sistema, sessões e terminais.
const { app, BrowserWindow, WebContentsView, session: electronSession, ipcMain, shell, dialog } = require('electron')
const BROWSER_CDP_PORT = process.env.CCH_BROWSER_CDP_PORT || '9222'

// CDP — permite controlar o navegador embutido via terminal (Playwright/Puppeteer).
// A porta pode ser alterada para evitar conflito com outro Chromium local.
app.commandLine.appendSwitch('remote-debugging-port', BROWSER_CDP_PORT)
const path = require('node:path')
const fs = require('node:fs')
const { createWorkspaceStore } = require('./workspaces')
const { createSettings } = require('./settings')
const sessions = require('./sessions')
const { createTerminalManager, buildEngineArgs, engineEnvironment, browserCdpEnvironment, preflight, findCli, defaultShell } = require('./terminals')
const { createUsageWorker } = require('./usage')
const files = require('./files')
const automation = require('./browser-automation')
const { syncWorkspace } = require('./sync')
const { createMiniappStore } = require('./miniapps')
const { ENGINES, getEngine, canResume, enabledEngines } = require('./engines')

// Onde os workspaces ficam: variável CCH_HOME ou ../workspaces ao lado do app
const WORKSPACE_ROOT = process.env.CCH_HOME || path.resolve(app.getAppPath(), '..', 'workspaces')
// Configurações: CCH_SETTINGS ou settings.yaml na raiz do cli-context-hub (ao lado de workspaces/ e app/)
const SETTINGS_FILE = process.env.CCH_SETTINGS || path.resolve(app.getAppPath(), '..', 'settings.yaml')
const settings = createSettings(SETTINGS_FILE)
const store = createWorkspaceStore(WORKSPACE_ROOT, settings.get)
const MINIAPPS_ROOT = path.resolve(app.getAppPath(), 'apps', 'miniapps')
const miniapps = createMiniappStore(MINIAPPS_ROOT)
const MINIAPP_USAGE_FILE = path.resolve(MINIAPPS_ROOT, 'miniapp-usage.json')
function loadMiniappUsage () {
  try { return JSON.parse(fs.readFileSync(MINIAPP_USAGE_FILE, 'utf8')) } catch { return {} }
}
function saveMiniappUsage (usage) {
  try { fs.writeFileSync(MINIAPP_USAGE_FILE, JSON.stringify(usage, null, 2), 'utf8') } catch {}
}

// Registro de erros em cli-context-hub/cli-context-hub.log (ajuda a diagnosticar no Windows)
const LOG_FILE = path.resolve(path.dirname(SETTINGS_FILE), 'cli-context-hub.log')
function logError (where, err) {
  const line = `[${new Date().toISOString()}] ${where}: ${err && err.stack ? err.stack : err}\n`
  try { fs.appendFileSync(LOG_FILE, line, 'utf8') } catch {}
  console.error(line)
}
process.on('uncaughtException', e => logError('uncaughtException', e))

let win = null
const miniappWindows = new Map()
const terminalEngines = new Map()
const send = (channel, payload) => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload) }

const terminals = createTerminalManager({
  getSettings: settings.get,
  onData: (id, data) => send('terminal:data', { id, data }),
  onExit: (id, code) => {
    terminalEngines.delete(id)
    for (const [key, termId] of openTabs) if (termId === id) openTabs.delete(key)
    send('terminal:exit', { id, code })
  }
})

// ---------- uso (mini-dashboard) ----------
const USAGE_DIR = path.resolve(path.dirname(SETTINGS_FILE), '.usage')
const usage = createUsageWorker({
  dataDir: USAGE_DIR,
  getSettings: settings.get,
  findCli,
  getShell: () => defaultShell(settings.get().terminal.shell),
  onUpdate: state => send('usage:update', state),
  log: logError
})
ipcMain.handle('usage:get', () => usage.get())
ipcMain.handle('usage:refresh', () => { usage.refresh(); return usage.get() })


// Arquivo de settings extra passado ao Claude (--settings): liga a statusline do cli-context-hub.
// Usar um arquivo evita ter que escapar JSON na linha de comando do CMD.
function claudeSettingsFile () {
  const script = path.join(__dirname, '..', 'statusline', 'claude-statusline.js').replace(/\\/g, '/')
  const dir = USAGE_DIR.replace(/\\/g, '/')
  const file = path.join(USAGE_DIR, 'claude-settings.json')
  fs.mkdirSync(USAGE_DIR, { recursive: true })
  fs.writeFileSync(file, JSON.stringify({
    statusLine: { type: 'command', command: `node "${script}" "${dir}"`, padding: 0 }
  }, null, 2))
  return file
}


// ---------- explorador (pasta contexts/ do workspace) ----------
const filesWatcher = files.createFilesWatcher({
  onChange: payload => send('files:changed', payload),
  log: logError
})
ipcMain.handle('files:list', (_e, { workspace, rel }) => {
  const h = store.get(workspace)
  filesWatcher.watch(h) // começa a vigiar na primeira vez que a pasta é aberta
  return files.listDir(h, rel)
})
ipcMain.handle('files:open', async (_e, { workspace, rel }) => {
  const abs = files.resolveInside(files.filesRoot(store.get(workspace)), rel)
  const err = await shell.openPath(abs) // abre no programa padrão do Windows
  if (err) throw new Error(err)
})
ipcMain.handle('files:reveal', (_e, { workspace, rel }) => {
  const root = files.filesRoot(store.get(workspace))
  const abs = files.resolveInside(root, rel)
  if (rel) shell.showItemInFolder(abs)
  else shell.openPath(root)
})
// Exclui arquivo ou pasta da files/: vai para a Lixeira do Windows (dá para recuperar)
ipcMain.handle('files:delete', async (_e, { workspace, rel }) => {
  if (!rel) throw new Error('Não é possível excluir a pasta files/ inteira')
  const abs = files.resolveInside(files.filesRoot(store.get(workspace)), rel)
  if (!fs.existsSync(abs)) return
  try {
    await shell.trashItem(abs)
  } catch (e) {
    logError('files:delete', e)
    throw new Error(`Não foi possível mover para a Lixeira: ${e.message}`)
  }
})
// Move arquivo/pasta dentro da contexts/
ipcMain.handle('files:move', (_e, { workspace, srcRel, destFolder }) => {
  if (!srcRel) throw new Error('Nenhum item para mover')
  return files.moveEntry(store.get(workspace), srcRel, destFolder)
})
// Renomeia arquivo/pasta dentro da contexts/
ipcMain.handle('files:rename', (_e, { workspace, rel, newName }) => {
  if (!rel) throw new Error('Nenhum item para renomear')
  try {
    return files.renameEntry(store.get(workspace), rel, newName)
  } catch (e) {
    if (e.code) logError('files:rename', e)
    throw e.code === 'EBUSY' || e.code === 'EPERM' ? new Error('O item está aberto em outro programa. Feche-o e tente de novo.') : e
  }
})
// Importa arquivo externo para dentro da contexts/
ipcMain.handle('files:import', (_e, { workspace, externalPath, destFolder }) => {
  if (!externalPath) throw new Error('Nenhum arquivo para importar')
  return files.importFile(store.get(workspace), externalPath, destFolder)
})
// ---------- desenhos ----------
ipcMain.handle('files:readWorkspace', (_e, { workspace, rel }) => files.readWorkspaceText(store.get(workspace), rel))
ipcMain.handle('files:read', (_e, { workspace, rel }) => files.readText(store.get(workspace), rel))
ipcMain.handle('files:write', (_e, { workspace, rel, text }) => files.writeText(store.get(workspace), rel, text))
ipcMain.handle('files:create', (_e, { workspace, rel, dir, text }) => {
  try {
    files.createEntry(store.get(workspace), rel, { dir: !!dir, text: typeof text === 'string' ? text : '' })
  } catch (e) {
    if (e.code !== 'EEXIST') logError('files:create', e)
    throw e.code === 'EEXIST' ? new Error(`Já existe "${rel}".`) : e
  }
})
ipcMain.handle('files:remove', (_e, { workspace, rel }) => {
  // só remove patches de desenho (consumidos pelo app); o resto usa a Lixeira
  if (!/\.excalidraw\.patch\.json$/i.test(String(rel))) throw new Error('Remoção direta só para patches de desenho')
  files.removeFile(store.get(workspace), rel)
})
ipcMain.handle('draw:preview', (_e, { workspace, rel, png, summary, suffix }) => {
  const h = store.get(workspace)
  const out = files.writeDrawPreview(h, rel, { png, summary, suffix })
  // caminhos relativos à raiz do workspace (onde o terminal abre)
  const relTo = p => p && path.relative(h.path, p).split(path.sep).join('/')
  return { png: relTo(out.png), summary: relTo(out.summary) }
})
// desenhos abertos em cada aba ficam no handoff, para reabrir ao retomar a aba
ipcMain.handle('session:tabDrawings', async (_e, { workspace, sessionId, tabId, drawings }) => {
  const s = sessions.get(store.get(workspace), sessionId)
  await sessions.updateHandoff(s.path, data => {
    const t = (data.tabs || []).find(x => x.id === tabId)
    if (t) t.drawings = drawings
  })
})
// links http(s)/mailto de arquivos Markdown abrem no navegador padrão
ipcMain.handle('shell:openExternal', (_e, url) => {
  if (!/^(https?:|mailto:)/i.test(String(url))) throw new Error('Link não permitido')
  return shell.openExternal(url)
})
ipcMain.handle('files:path', (_e, { workspace, rel }) => files.resolveInside(files.filesRoot(store.get(workspace)), rel))

ipcMain.handle('dialog:browse-folder', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Selecionar pasta do projeto'
  })
  return result.canceled ? null : result.filePaths[0]
})

// aba de sessão -> terminal aberto (evita abrir a mesma sessão nativa duas vezes)
const openTabs = new Map()

// ---------- prompts iniciais ----------
function promptFor ({ kind, session, workspace }) {
  const where = `A pasta da sessão é ${session.path}`
  // sessões guardam só memória; arquivos de trabalho ficam na contexts/ do workspace
  const filesRule = `Arquivos de trabalho ficam na pasta contexts/ do workspace (${path.join(workspace.path, 'contexts')}); antes de criar ou salvar qualquer arquivo use a skill onde-salvar-arquivos e, se eu não tiver dito onde, pergunte em qual pasta gravar. A pasta da sessão guarda só handoff.md, log.md e messages.md. `
  if (kind === 'new-session') {
    return `Esta é a sessão '${session.title}' do cli-context-hub (workspace ${workspace.title}). ${where}. ` +
      'Leia handoff.md e log.md dessa pasta antes de começar e mantenha as seções Estado atual, Decisões tomadas e Próximos passos do handoff.md atualizadas. ' +
      filesRule +
      'Por enquanto apenas confirme que leu e aguarde minhas instruções.'
  }
  if (kind === 'join-session') {
    return `Você está entrando na sessão '${session.title}' do cli-context-hub, que já está em andamento. ${where}. ` +
      'Leia handoff.md e log.md para entender o que já foi feito (inclusive por outros modelos), resuma em poucas linhas e aguarde minhas instruções. ' +
      'Mantenha o handoff.md atualizado conforme trabalharmos. ' + filesRule.trim()
  }
  if (kind === 'resume-after-others') {
    return `Retomando a sessão '${session.title}'. Outras abas trabalharam nela desde sua última interação. ` +
      `Leia o log.md em ${session.path} e o handoff.md, resuma o que mudou e aguarde minhas instruções.`
  }
  return null
}

// ---------- IPC ----------
ipcMain.handle('settings:get', () => settings.load())
ipcMain.handle('engines:list', () => {
  const current = settings.get()
  const enabled = enabledEngines(current)
  return ENGINES.map(id => {
    const { label, sub, install, usage } = getEngine(id)
    return { id, label, sub, install, usage, resumable: canResume(id), enabled: enabled.includes(id), usageHidden: current.usage.hidden.includes(id) }
  })
})

// Só estas chaves podem ser alteradas pela interface
const EDITABLE_SETTINGS = ['engine.default', 'engine.enabled', 'usage.hidden']
// Recebe várias alterações de uma vez: { 'engine.default': 'copilot', ... }
ipcMain.handle('settings:save', (_e, changes = {}, confirmClose = false) => {
  const keys = Object.keys(changes || {})
  const invalid = keys.filter(k => !EDITABLE_SETTINGS.includes(k))
  if (invalid.length) throw new Error(`Configuração não editável: ${invalid.join(', ')}`)
  const enabled = changes['engine.enabled'] || enabledEngines(settings.get())
  if (!Array.isArray(enabled)) throw new Error('engine.enabled deve ser uma lista de CLIs.')
  const killed = [...terminalEngines].filter(([, engine]) => !enabled.includes(engine)).map(([id]) => id)
  if (killed.length && confirmClose !== true) {
    throw new Error('Desativar este CLI encerrará os terminais abertos. Confirme a ação nas Configurações.')
  }
  const result = settings.save(Object.fromEntries(keys.map(k => [k, changes[k]])))
  usage.reschedule()
  for (const id of killed) {
    try { terminals.kill(id) } catch (error) {
      logError('settings:terminate', error)
      throw new Error(`Configurações salvas, mas ${error.message}. Encerre o terminal manualmente.`)
    }
    terminalEngines.delete(id)
    for (const [key, termId] of openTabs) if (termId === id) openTabs.delete(key)
  }
  return { ...result, killed }
})

ipcMain.handle('workspace:list', () => {
  const { warnings } = settings.load()
  return { root: store.root, workspaces: store.list(), settingsWarnings: warnings }
})

ipcMain.handle('workspace:create', (_e, details) => {
  try {
    return store.create(details || {})
  } catch (e) {
    logError('workspace:create', e)
    throw e
  }
})

ipcMain.handle('workspace:getStructure', (_e, workspaceName) => {
  try {
    const workspace = store.get(workspaceName)
    return buildFolderTree(workspace.path)
  } catch (e) {
    logError('workspace:getStructure', e)
    throw e
  }
})

ipcMain.handle('workspace:setWorkdir', (_e, { workspace: workspaceName, workdir }) => {
  try {
    const workspace = store.get(workspaceName)
    const yamlFile = path.join(workspace.path, 'workspace.yaml')
    let yaml = fs.readFileSync(yamlFile, 'utf8')
    const value = workdir ? workdir.replace(/\\/g, '/') : 'null'
    yaml = yaml.replace(/^workdir:.*$/m, `workdir: ${value}`)
    fs.writeFileSync(yamlFile, yaml, 'utf8')
    return store.get(workspaceName)
  } catch (e) {
    logError('workspace:setWorkdir', e)
    throw e
  }
})

function buildFolderTree(root, maxDepth = 8, currentDepth = 0) {
  if (currentDepth >= maxDepth) return { name: path.basename(root), path: root, children: [], type: 'dir' }

  const children = []
  const showFiles = currentDepth >= 1 // nível 0 = raiz do workspace (sem arquivos soltos), nível 1+ = mostra tudo
  try {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (d.isDirectory() && !/^[._~]/.test(d.name) && d.name !== 'node_modules') {
        const fullPath = path.join(root, d.name)
        const child = buildFolderTree(fullPath, maxDepth, currentDepth + 1)
        children.push(child)
      } else if (showFiles && d.isFile() && !/^[._~]/.test(d.name)) {
        children.push({ name: d.name, path: path.join(root, d.name), children: [], type: 'file' })
      }
    }
  } catch (e) {
    logError('buildFolderTree', e)
  }

  return {
    name: path.basename(root),
    path: root,
    children,
    type: 'dir'
  }
}

ipcMain.handle('miniapps:list', () => {
  const list = miniapps.list()
  const usage = loadMiniappUsage()
  return list.map(m => ({ ...m, lastUsed: usage[m.name] || null }))
})

// Map: webContents.id -> caminho do data.json do miniapp
const miniappDataFiles = new Map()

ipcMain.handle('miniapp:open', (_e, name) => {
  const miniapp = miniapps.get(name)
  const usage = loadMiniappUsage()
  usage[miniapp.name] = Date.now()
  saveMiniappUsage(usage)
  const existing = miniappWindows.get(miniapp.name)
  if (existing && !existing.isDestroyed()) {
    if (!existing.isVisible()) existing.show()
    existing.focus()
    return { opened: true, alreadyOpen: true }
  }

  const dataFile = path.join(path.dirname(miniapp.entryPath), 'data.json')
  const child = new BrowserWindow({
    width: 820,
    height: 720,
    minWidth: 420,
    minHeight: 480,
    skipTaskbar: false,
    frame: false,
    title: `${miniapp.title} · CLI Context Hub`,
    backgroundColor: '#0d0e11',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '..', 'miniapp-preload.js')
    }
  })
  miniappDataFiles.set(child.webContents.id, dataFile)
  miniappWindows.set(miniapp.name, child)
  child.on('closed', () => {
    miniappDataFiles.delete(child.webContents.id)
    if (miniappWindows.get(miniapp.name) === child) miniappWindows.delete(miniapp.name)
  })
  child.loadFile(miniapp.entryPath)
  return { opened: true, alreadyOpen: false }
})

// Miniapp data persistence (arquivo JSON no diretório do miniapp — sincroniza via git)
ipcMain.handle('miniapp-data:load', (e) => {
  const dataFile = miniappDataFiles.get(e.sender.id)
  if (!dataFile) return null
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) } catch { return null }
})
ipcMain.handle('miniapp-data:save', (e, data) => {
  const dataFile = miniappDataFiles.get(e.sender.id)
  if (!dataFile) return false
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8')
  return true
})

// Miniapp window controls (frameless)
ipcMain.handle('miniapp-window:minimize', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.minimize() })
ipcMain.handle('miniapp-window:maximize', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) { w.isMaximized() ? w.unmaximize() : w.maximize() } return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false })
ipcMain.handle('miniapp-window:close', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.close() })
ipcMain.handle('miniapp-window:isMaximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)
ipcMain.handle('miniapp-window:toggleFullscreen', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setFullScreen(!w.isFullScreen()); return w?.isFullScreen() ?? false })
ipcMain.handle('miniapp-window:isFullscreen', (e) => BrowserWindow.fromWebContents(e.sender)?.isFullScreen() ?? false)

ipcMain.handle('session:list', (_e, workspaceName) => sessions.list(store.get(workspaceName)))

/**
 * Abre um terminal para uma sessão.
 * - { workspace, newSession: { title }, engine }       -> cria sessão + aba
 * - { workspace, sessionId, engine }                   -> nova aba numa sessão existente
 * - { workspace, sessionId, tabId }                    -> retoma uma aba existente
 */
ipcMain.handle('session:open', async (_e, req) => {
  try {
    return await openSession(req)
  } catch (e) {
    logError('session:open', e)
    throw e
  }
})

async function openSession (req) {
  const workspace = store.get(req.workspace)

  // 1) verifica tudo ANTES de criar sessão ou aba (evita sessões vazias quando algo falha)
  let engine = req.engine
  if (req.tabId) {
    const existing = sessions.get(workspace, req.sessionId).tabs.find(t => t.id === req.tabId)
    if (!existing) throw new Error(`Aba não encontrada: ${req.tabId}`)
    engine = existing.engine
    if (!canResume(engine)) throw new Error(`O ${getEngine(engine).label} não retoma sessões. Abra uma nova aba.`)
  }
  if (!enabledEngines(settings.get()).includes(engine)) {
    throw new Error(`Motor ${engine} desativado. Ative-o nas Configurações.`)
  }
  if (!workspace.engines.supported.includes(engine)) {
    throw new Error(`Motor ${engine} não suportado por este workspace`)
  }
  const check = preflight(engine, settings.get().terminal.shell)
  try { syncWorkspace(workspace.path, engine) } catch (error) {
    logError('sync', error)
    throw error
  }

  // 2) cria/atualiza sessão e aba
  let session
  let tab
  let resume = false
  let kind

  if (req.newSession) {
    session = await sessions.create(workspace, req.newSession)
    kind = 'new-session'
  } else {
    session = sessions.get(workspace, req.sessionId)
  }

  if (req.tabId) {
    const key = `${session.path}#${req.tabId}`
    if (openTabs.has(key)) return { alreadyOpen: openTabs.get(key) }
    const before = session.last_tab
    tab = await sessions.touchTab(session.path, req.tabId)
    resume = true
    kind = before && before !== tab.id ? 'resume-after-others' : null
  } else {
    if (!workspace.engines.supported.includes(req.engine)) throw new Error(`Motor ${req.engine} não suportado por este workspace`)
    const sessionWorkdir = session.workdir || workspace.workdir
    tab = await sessions.addTab(session.path, { engine: req.engine, workdir: sessionWorkdir })
    kind = kind || 'join-session'
  }

  filesWatcher.watch(workspace) // desenhos criados pela IA abrem sozinhos como subaba


  const cwd = fs.existsSync(tab.workdir) ? tab.workdir : workspace.workdir
  const engineCfg = workspace[tab.engine] || {}
  // Se o terminal abre dentro do workspace, ele já enxerga tudo (sessão e files/).
  // Se abre num projeto externo (workdir definido), damos acesso extra à pasta do workspace.
  const inside = (d, root) => { const r = path.relative(root, d); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)) }
  const addDirs = inside(cwd, workspace.path) ? [] : [workspace.path]

  const engineArgs = buildEngineArgs({
    engine: tab.engine,
    sessionId: tab.session_id,
    resume,
    name: `${workspace.title} · ${session.title} · ${tab.id}`,
    addDirs,
    prompt: tab.engine === 'gemini' && kind
      ? `${promptFor({ kind, session, workspace })} Leia também as instruções em ${path.join(workspace.path, 'AGENTS.md')} e as skills em ${path.join(workspace.path, 'skills')}.`
      : promptFor({ kind, session, workspace }),
    model: engineCfg.model || null,
    extraArgs: [
      ...(tab.engine === 'claude' ? ['--settings', claudeSettingsFile()] : []),
      ...(Array.isArray(engineCfg.args) ? engineCfg.args : [])
    ]
  })

  let term
  try {
    if (!enabledEngines(settings.get()).includes(tab.engine)) {
      throw new Error(`Motor ${tab.engine} desativado durante a abertura. Ative-o nas Configurações.`)
    }
    term = terminals.start({
    cwd,
    engine: tab.engine,
    cliPath: check.cli,
    engineArgs,
    // variáveis para os futuros hooks saberem a qual sessão/aba pertencem
    env: {
      ...(workspace.env || {}),
      ...engineEnvironment(tab.engine),
      ...browserCdpEnvironment(BROWSER_CDP_PORT),
      CCH_WORKSPACE: workspace.name,
      CCH_SESSION_DIR: session.path,
      CCH_TAB: tab.id,
      CCH_ENGINE: tab.engine
    },
    meta: { workspace: workspace.name, session: session.id, tab: tab.id }
  })
  } catch (e) {
    await sessions.appendLog(session.path, { tab: tab.id, engine: tab.engine, text: `Falha ao abrir o terminal: ${e.message}` })
    throw e
  }
  openTabs.set(`${session.path}#${tab.id}`, term.id)
  terminalEngines.set(term.id, tab.engine)

  return {
    termId: term.id,
    command: term.command,
    workspace: { name: workspace.name, title: workspace.title },
    session: sessions.get(workspace, session.id),
    tab
  }
}

// Exclui uma sessão: fecha os terminais abertos dela e apaga a pasta
ipcMain.handle('session:delete', async (_e, { workspace: workspaceName, sessionId }) => {
  try {
    const workspace = store.get(workspaceName)
    const session = sessions.get(workspace, sessionId)
    const killed = []
    for (const [key, termId] of openTabs) {
      if (key.startsWith(session.path + '#')) {
        terminals.kill(termId)
        openTabs.delete(key)
        killed.push(termId)
      }
    }
    // dá um instante para o Windows liberar os arquivos usados pelos processos encerrados
    if (killed.length) await new Promise(r => setTimeout(r, 500))
    await sessions.remove(workspace, sessionId)
    return { killed }
  } catch (e) {
    logError('session:delete', e)
    throw e
  }
})

ipcMain.on('terminal:write', (_e, { id, data }) => terminals.write(id, data))
ipcMain.on('terminal:resize', (_e, { id, cols, rows }) => terminals.resize(id, cols, rows))
ipcMain.on('terminal:kill', (_e, id) => terminals.kill(id))

// ---------- janela ----------
function createWindow () {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 520,
    backgroundColor: '#0d0e11',
    title: 'CLI Context Hub',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js')
    }
  })
  win.setMenuBarVisibility(false)
  win.setFullScreen(true)
  ipcMain.handle('window:toggleFullscreen', () => { win.setFullScreen(!win.isFullScreen()); return win.isFullScreen() })
  ipcMain.handle('window:isFullscreen', () => win.isFullScreen())
  ipcMain.handle('window:minimize', () => win.minimize())
  ipcMain.handle('window:maximize', () => { win.isMaximized() ? win.unmaximize() : win.maximize(); return win.isMaximized() })
  ipcMain.handle('window:close', () => win.close())
  ipcMain.handle('window:isMaximized', () => win.isMaximized())
  // tamanho fixo da interface: sem zoom por Ctrl +/-/0, Ctrl+scroll ou pinça
  const wc = win.webContents
  const lockZoom = () => { wc.setZoomLevel(0); wc.setVisualZoomLevelLimits(1, 1) }
  wc.on('did-finish-load', lockZoom)
  wc.on('zoom-changed', lockZoom)
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return
    if (['+', '=', '-', '_', '0'].includes(input.key)) e.preventDefault()
  })
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

// ---------- navegador embutido (multi-tab, sessão persistente) ----------
let browserSession = null
const browserTabs = new Map()   // id → { view: WebContentsView, visible: boolean }
let browserActiveTab = null     // id da aba ativa
let nextBrowserTabId = 1
let browserBounds = null        // último bounds recebido do renderer
const browserClosedTabs = []
const browserDownloads = new Map()

function makeBrowserTab (url = 'https://www.google.com') {
  const id = nextBrowserTabId++
  const view = new WebContentsView({
    webPreferences: { session: browserSession, nodeIntegration: false, contextIsolation: true, sandbox: true }
  })
  view.webContents.loadURL(url)

  const notify = () => {
    if (!win || win.isDestroyed()) return
    win.webContents.send('browser:navigated', {
      tabId: id,
      url: view.webContents.getURL(),
      title: view.webContents.getTitle(),
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward()
    })
  }
  view.webContents.on('did-navigate', notify)
  view.webContents.on('did-navigate-in-page', notify)
  view.webContents.on('page-title-updated', notify)

  // zoom: Ctrl++ / Ctrl+- / Ctrl+0
  view.webContents.on('before-input-event', (_e, input) => {
    if (!input.control || input.type !== 'keyDown') return
    if (input.key === '+' || input.key === '=') { view.webContents.setZoomLevel(view.webContents.getZoomLevel() + 0.5); _e.preventDefault() }
    else if (input.key === '-') { view.webContents.setZoomLevel(view.webContents.getZoomLevel() - 0.5); _e.preventDefault() }
    else if (input.key === '0') { view.webContents.setZoomLevel(0); _e.preventDefault() }
  })

  // zoom: Ctrl+Scroll
  view.webContents.on('did-finish-load', () => {
    view.webContents.executeJavaScript(`
      document.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
      }, { passive: false });
    `).catch(() => {})
  })
  view.webContents.on('zoom-changed', (_e, dir) => {
    const cur = view.webContents.getZoomLevel()
    view.webContents.setZoomLevel(dir === 'in' ? cur + 0.5 : cur - 0.5)
  })

  // abrir links target=_blank como nova aba interna
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    makeBrowserTab(newUrl)
    switchBrowserTab(nextBrowserTabId - 1)
    return { action: 'deny' }
  })

  browserTabs.set(id, { view, visible: false })
  return id
}

function switchBrowserTab (id) {
  if (!win || win.isDestroyed()) return
  // esconde aba anterior
  if (browserActiveTab != null) {
    const prev = browserTabs.get(browserActiveTab)
    if (prev && prev.visible) { win.contentView.removeChildView(prev.view); prev.visible = false }
  }
  browserActiveTab = id
  const tab = browserTabs.get(id)
  if (!tab) return
  // SEMPRE define bounds antes de adicionar — sem bounds, a view ocupa a janela inteira
  if (browserBounds && win && !win.isDestroyed()) {
    tab.view.setBounds(insetsToRect(browserBounds))
  } else {
    tab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  }
  win.contentView.addChildView(tab.view)
  tab.visible = true
  // envia lista de abas atualizada
  sendBrowserTabList()
}

function sendBrowserTabList () {
  if (!win || win.isDestroyed()) return
  const tabs = []
  for (const [id, { view }] of browserTabs) {
    tabs.push({ id, url: view.webContents.getURL(), title: view.webContents.getTitle() || 'Nova aba' })
  }
  win.webContents.send('browser:tabs', { tabs, activeId: browserActiveTab })
}

// Converte insets proporcionais (0-1) em bounds absolutos usando o tamanho real da janela
function insetsToRect (insets) {
  const cb = win.getContentBounds()
  const x = Math.round(insets.left * cb.width)
  const y = Math.round(insets.top * cb.height)
  const w = Math.round((1 - insets.left - insets.right) * cb.width)
  const h = Math.round((1 - insets.top - insets.bottom) * cb.height)
  return { x, y, width: Math.max(0, w), height: Math.max(0, h) }
}

function initBrowser () {
  browserSession = electronSession.fromPartition('persist:workspace-browser')

  ipcMain.handle('browser:new-tab', (_e, url) => {
    const id = makeBrowserTab(url || 'https://www.google.com')
    switchBrowserTab(id)
    return id
  })

  ipcMain.handle('browser:close-tab', (_e, id) => {
    const tab = browserTabs.get(id)
    if (!tab) return
    browserClosedTabs.unshift({
      url: tab.view.webContents.getURL(),
      title: tab.view.webContents.getTitle() || tab.view.webContents.getURL()
    })
    browserClosedTabs.splice(20)
    if (tab.visible && win && !win.isDestroyed()) win.contentView.removeChildView(tab.view)
    tab.view.webContents.close()
    browserTabs.delete(id)
    if (browserActiveTab === id) {
      const remaining = [...browserTabs.keys()]
      if (remaining.length > 0) switchBrowserTab(remaining[remaining.length - 1])
      else { browserActiveTab = null; sendBrowserTabList() }
    } else {
      sendBrowserTabList()
    }
  })

  ipcMain.handle('browser:switch-tab', (_e, id) => {
    if (browserTabs.has(id)) switchBrowserTab(id)
  })

  ipcMain.handle('browser:show', (_e, insets) => {
    if (!win || win.isDestroyed()) return
    browserBounds = insets
    if (browserActiveTab != null) {
      const tab = browserTabs.get(browserActiveTab)
      if (tab) {
        tab.view.setBounds(insetsToRect(insets))
        if (!tab.visible) { win.contentView.addChildView(tab.view); tab.visible = true }
      }
    }
  })

  ipcMain.handle('browser:hide', () => {
    if (!win || win.isDestroyed()) return
    if (browserActiveTab != null) {
      const tab = browserTabs.get(browserActiveTab)
      if (tab && tab.visible) { win.contentView.removeChildView(tab.view); tab.visible = false }
    }
  })

  ipcMain.handle('browser:navigate', async (_e, url) => {
    const tab = browserActiveTab != null ? browserTabs.get(browserActiveTab) : null
    if (!tab) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    await tab.view.webContents.loadURL(url)
    sendBrowserTabList()
    return { url: tab.view.webContents.getURL(), title: tab.view.webContents.getTitle() }
  })

  ipcMain.handle('browser:go-back', () => { const t = browserActiveTab != null && browserTabs.get(browserActiveTab); if (t?.view.webContents.canGoBack()) t.view.webContents.goBack() })
  ipcMain.handle('browser:go-forward', () => { const t = browserActiveTab != null && browserTabs.get(browserActiveTab); if (t?.view.webContents.canGoForward()) t.view.webContents.goForward() })
  ipcMain.handle('browser:reload', () => { const t = browserActiveTab != null && browserTabs.get(browserActiveTab); if (t) t.view.webContents.reload() })

  ipcMain.handle('browser:get-info', () => {
    const t = browserActiveTab != null ? browserTabs.get(browserActiveTab) : null
    if (!t) return null
    return { tabId: browserActiveTab, url: t.view.webContents.getURL(), title: t.view.webContents.getTitle(), canGoBack: t.view.webContents.canGoBack(), canGoForward: t.view.webContents.canGoForward() }
  })

  // extrai URL, título, seleção e texto da aba ativa (integração com terminal e contexts/)
  ipcMain.handle('browser:extract', async () => {
    const t = browserActiveTab != null ? browserTabs.get(browserActiveTab) : null
    if (!t) return null
    const wc = t.view.webContents
    const data = await wc.executeJavaScript("({ selection: String(getSelection() || '').trim(), text: (document.body ? document.body.innerText : '').trim() })")
    return { url: wc.getURL(), title: wc.getTitle(), selection: data.selection, text: data.text.slice(0, 200000) }
  })

  // ---------- automações (receitas JSON em contexts/navegador/automacoes/) ----------
  const AUTOMATION_DIR = 'navegador/automacoes'
  let automationRun = null // { cancelled }
  let recorder = null      // { stop }
  const automationState = state => win.webContents.send('browser:automation', state)
  const activeBrowserContents = () => {
    const t = browserActiveTab != null ? browserTabs.get(browserActiveTab) : null
    return t ? t.view.webContents : null
  }

  ipcMain.handle('automation:list', (_e, { workspace }) => {
    const h = store.get(workspace)
    return files.listDir(h, AUTOMATION_DIR).entries.filter(e => e.type === 'file' && e.name.endsWith('.json')).map(e => {
      try {
        const r = JSON.parse(files.readText(h, e.rel))
        return { rel: e.rel, name: r.name || e.name, description: r.description || '', steps: Array.isArray(r.steps) ? r.steps.length : 0 }
      } catch { return { rel: e.rel, name: e.name, description: 'JSON inválido', steps: 0, invalid: true } }
    })
  })

  ipcMain.handle('automation:run', async (_e, { workspace, rel }) => {
    if (automationRun) throw new Error('Já existe uma automação em execução.')
    const wc = activeBrowserContents()
    if (!wc) throw new Error('Abra uma aba no navegador antes de executar.')
    const h = store.get(workspace)
    const recipe = JSON.parse(files.readText(h, rel))
    const run = { cancelled: false }
    automationRun = run
    const name = recipe.name || rel
    automationState({ running: true, name, step: 0, total: (recipe.steps || []).length })
    try {
      const out = await automation.runRecipe(recipe, {
        wc,
        isCancelled: () => run.cancelled,
        confirm: async what => (await dialog.showMessageBox(win, { type: 'warning', buttons: ['Permitir', 'Cancelar'], defaultId: 1, cancelId: 1, title: 'Automação', message: `"${name}" quer fazer uma ação sensível`, detail: what })).response === 0,
        saveOutput: (outRel, text) => files.writeText(h, outRel, text),
        onProgress: info => automationState({ running: true, name, ...info })
      })
      automationState({ running: false, name, ok: true, saved: out.saved })
      return out
    } catch (e) {
      logError('automation:run', e)
      automationState({ running: false, name, ok: false, error: e.message })
      throw e
    } finally { automationRun = null }
  })

  ipcMain.handle('automation:cancel', () => { if (automationRun) automationRun.cancelled = true })

  ipcMain.handle('automation:record-start', () => {
    const wc = activeBrowserContents()
    if (!wc) throw new Error('Abra uma aba no navegador antes de gravar.')
    if (recorder) recorder.stop()
    recorder = automation.startRecording(wc)
    automationState({ recording: true })
  })

  ipcMain.handle('automation:record-stop', (_e, { workspace, name }) => {
    if (!recorder) throw new Error('Nenhuma gravação em andamento.')
    const steps = recorder.stop()
    recorder = null
    automationState({ recording: false })
    const slug = String(name || 'automacao').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'automacao'
    const rel = `${AUTOMATION_DIR}/${slug}.json`
    files.createEntry(store.get(workspace), rel, { text: JSON.stringify({ name: name || slug, description: 'Gravada no navegador. Edite os passos (ex.: adicione "wait" e "extract").', vars: {}, steps }, null, 2) })
    return rel
  })

  ipcMain.handle('browser:set-bounds', (_e, insets) => {
    browserBounds = insets
    if (browserActiveTab == null) return
    const tab = browserTabs.get(browserActiveTab)
    if (tab && tab.visible) {
      tab.view.setBounds(insetsToRect(insets))
    }
  })

  ipcMain.handle('browser:get-tabs', () => {
    const tabs = []
    for (const [id, { view }] of browserTabs) {
      tabs.push({ id, url: view.webContents.getURL(), title: view.webContents.getTitle() || 'Nova aba' })
    }
    return { tabs, activeId: browserActiveTab }
  })

  ipcMain.handle('browser:get-closed-tabs', () => browserClosedTabs.slice())
  ipcMain.handle('browser:reopen-closed-tab', () => {
    const closed = browserClosedTabs.shift()
    if (!closed) return null
    const id = makeBrowserTab(closed.url)
    switchBrowserTab(id)
    return id
  })

  browserSession.on('will-download', (_event, item) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const downloadsDir = app.getPath('downloads')
    const originalName = item.getFilename()
    const extension = path.extname(originalName)
    const stem = originalName.slice(0, originalName.length - extension.length)
    let filePath = path.join(downloadsDir, originalName)
    let suffix = 1
    while (fs.existsSync(filePath)) {
      filePath = path.join(downloadsDir, `${stem} (${suffix++})${extension}`)
    }
    item.setSavePath(filePath)
    browserDownloads.set(id, { id, filename: item.getFilename(), path: filePath, state: 'progressing', receivedBytes: 0, totalBytes: item.getTotalBytes() })
    send('browser:download', browserDownloads.get(id))
    item.on('updated', () => {
      const download = browserDownloads.get(id)
      if (!download) return
      download.receivedBytes = item.getReceivedBytes()
      download.totalBytes = item.getTotalBytes()
      download.state = item.isPaused() ? 'paused' : 'progressing'
      send('browser:download', download)
    })
    item.once('done', (_event, state) => {
      const download = browserDownloads.get(id)
      if (!download) return
      download.state = state
      download.receivedBytes = item.getReceivedBytes()
      download.totalBytes = item.getTotalBytes()
      send('browser:download', download)
    })
  })
}

app.whenReady().then(() => {
  createWindow()
  initBrowser()
  usage.start()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  usage.stop()
  filesWatcher.closeAll()
  terminals.killAll()
  for (const child of miniappWindows.values()) child.destroy()
  if (process.platform !== 'darwin') app.quit()
})
