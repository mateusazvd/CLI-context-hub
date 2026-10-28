const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const { ENGINES, buildEngineArgs, engineEnvironment, getEngine } = require('../src/main/engines')
const { createSettings } = require('../src/main/settings')
const { createWorkspaceStore } = require('../src/main/workspaces')
const { syncWorkspace } = require('../src/main/sync')

function fixture (t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cch-engines-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

function loadWithMocks (file, mocks, globals = {}) {
  const localRequire = createRequire(file)
  const context = {
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name),
    module: { exports: {} }, __dirname: path.dirname(file),
    console, process, ...globals
  }

  function usageForTest () {
    return loadWithMocks(path.resolve(__dirname, '../src/main/usage.js'), {
      'node-pty': {},
      '@xterm/headless': {}
    })
  }
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file })
  return context.module.exports
}

test('argumentos preservam Claude/Copilot, Gemini e iniciam Codex com start e no-daemon', () => {
  const common = { sessionId: 'uuid', name: 'aba', addDirs: ['C:\\meu workspace'], prompt: 'leia', model: 'modelo', extraArgs: ['--debug'] }
  assert.deepEqual(buildEngineArgs({ ...common, engine: 'claude' }),
    ['leia', '--session-id', 'uuid', '--name', 'aba', '--add-dir', 'C:\\meu workspace', '--model', 'modelo', '--debug'])
  assert.deepEqual(buildEngineArgs({ ...common, engine: 'copilot' }),
    ['--session-id', 'uuid', '--name', 'aba', '--add-dir', 'C:\\meu workspace', '--model', 'modelo', '-i', 'leia', '--debug'])
  assert.deepEqual(buildEngineArgs({ ...common, engine: 'gemini' }),
    ['--session-id', 'uuid', '--include-directories', 'C:\\meu workspace', '--model', 'modelo', '--prompt-interactive', 'leia', '--debug'])
  assert.deepEqual(buildEngineArgs({ ...common, engine: 'ollama' }), ['--debug'])
  assert.deepEqual(buildEngineArgs({ ...common, engine: 'codex' }),
    ['start', '--no-daemon', 'leia', '--add-dir', 'C:\\meu workspace', '--model', 'modelo', '--debug'])
  for (const engine of ENGINES) {
    assert.deepEqual(buildEngineArgs({ engine, sessionId: 'uuid', resume: true, name: 'ignorado' }),
      engine === 'codex' ? ['start', '--no-daemon'] : getEngine(engine).bare ? [] : ['--resume', 'uuid'])
  }
  assert.deepEqual(engineEnvironment('codex'), {
    CODEX_CA_CERTIFICATE: 'C:\\Program Files\\Git\\mingw64\\etc\\ssl\\certs\\ca-bundle.crt',
    CODEX_APPROVAL_POLICY: 'workspace-write'
  })
  assert.throws(() => getEngine('desconhecido'), /desconhecido/)
  assert.throws(() => buildEngineArgs({ engine: 'gemini', extraArgs: [42] }), /Argumentos/)
})

test('settings legados migram em memória; gravação valida tudo antes de persistir', t => {
  const file = path.join(fixture(t), 'settings.yaml')
  fs.writeFileSync(file, '# preservar\nengine:\n  default: copilot\n')
  const settings = createSettings(file)
  assert.deepEqual(settings.get().engine.enabled, ENGINES)
  const before = fs.readFileSync(file, 'utf8')
  for (const enabled of [[], ['invalido'], ['copilot', 'copilot'], ['gemini']]) {
    assert.throws(() => settings.save({ 'engine.enabled': enabled }))
    assert.equal(fs.readFileSync(file, 'utf8'), before)
  }
  settings.save({ 'engine.enabled': ['gemini'], 'engine.default': 'gemini' })
  assert.equal(createSettings(file).get().engine.default, 'gemini')
  assert.match(fs.readFileSync(file, 'utf8'), /# preservar/)
  settings.save({ 'engine.enabled': ENGINES })
  assert.deepEqual(settings.get().engine.enabled, ENGINES)
})

test('workspace intersecta compatibilidade com ativação, sem fallback a um desativado', t => {
  const root = fixture(t)
  const dir = path.join(root, 'demo')
  fs.mkdirSync(dir)
  const file = path.join(dir, 'workspace.yaml')
  const store = createWorkspaceStore(root, () => ({ engine: { default: 'gemini', enabled: ['gemini'] } }))
  fs.writeFileSync(file, 'engines:\n  supported: null\n')
  assert.deepEqual(store.get('demo').engines.supported, ['gemini'])
  assert.equal(store.get('demo').engines.default, 'gemini')
  fs.writeFileSync(file, 'engines:\n  default: claude\n  supported: [claude]\n')
  assert.deepEqual(store.get('demo').engines.supported, [])
  assert.equal(store.get('demo').engines.default, null)
})

test('sincronização Gemini é repetível, remove só gerados e preserva contexto manual', t => {
  const dir = fixture(t)
  const skill = path.join(dir, 'skills', 'demo')
  fs.mkdirSync(skill, { recursive: true })
  fs.writeFileSync(path.join(skill, 'SKILL.md'), 'demo')
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# contexto')
  syncWorkspace(dir)
  syncWorkspace(dir)
  const output = path.join(dir, '.gemini', 'skills', 'demo', 'SKILL.md')
  assert.equal(fs.readFileSync(output, 'utf8'), 'demo')
  assert.match(fs.readFileSync(path.join(dir, 'GEMINI.md'), 'utf8'), /@AGENTS.md/)
  fs.writeFileSync(path.join(dir, 'GEMINI.md'), '# manual')
  fs.rmSync(skill, { recursive: true })
  syncWorkspace(dir)
  assert.equal(fs.existsSync(output), false)
  assert.equal(fs.readFileSync(path.join(dir, 'GEMINI.md'), 'utf8'), '# manual')
  fs.mkdirSync(skill, { recursive: true })
  fs.writeFileSync(path.join(skill, 'SKILL.md'), 'novo')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, 'manual')
  assert.throws(() => syncWorkspace(dir), /não gerenciada/)
  assert.equal(fs.readFileSync(output, 'utf8'), 'manual')
})

test('preflight rejeita Gemini ausente/antigo e consulta help via CMD no Windows', () => {
  let installed = true
  let help = '--resume'
  const calls = []
  const terminals = loadWithMocks(path.resolve(__dirname, '../src/main/terminals.js'), {
    'node-pty': {},
    'node:fs': { existsSync: () => true },
    'node:child_process': {
      execFileSync: (bin, args) => {
        calls.push({ bin, args })
        if (bin === 'where.exe') {
          if (!installed) throw new Error('ausente')
          return 'C:\\Program Files\\gemini.cmd\n'
        }
        return help
      }
    }
  }, { process: { platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' } } })
  assert.throws(() => terminals.preflight('gemini'), /Atualize/)
  help = getEngine('gemini').requiredFlags.join('\n')
  assert.equal(terminals.preflight('gemini').cli, 'C:\\Program Files\\gemini.cmd')
  assert.ok(calls.some(c => c.bin.endsWith('cmd.exe') && c.args.includes('/d')))
  installed = false
  assert.throws(() => terminals.preflight('gemini'), /não foi encontrado/)
})

test('Windows nunca usa PowerShell configurado e cai para CMD', () => {
  const terminals = loadWithMocks(path.resolve(__dirname, '../src/main/terminals.js'), {
    'node-pty': {},
    'node:child_process': { execFileSync: () => 'C:\\Windows\\System32\\cmd.exe\n' }
  }, { process: { platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' } } })
  assert.deepEqual(terminals.defaultShell('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'), {
    file: 'C:\\Windows\\System32\\cmd.exe', args: [], kind: 'cmd'
  })

  test('sessão recebe endpoint CDP local do navegador embutido', () => {
    const terminals = loadWithMocks(path.resolve(__dirname, '../src/main/terminals.js'), {
      'node-pty': {},
      'node:child_process': { execFileSync: () => 'C:\\Windows\\System32\\cmd.exe\n' }
    }, { process: { platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' } } })
    assert.deepEqual(terminals.browserCdpEnvironment(), {
      CCH_BROWSER_CDP_URL: 'http://127.0.0.1:9222',
      CCH_BROWSER_CDP_PORT: '9222'
    })
    assert.deepEqual(terminals.browserCdpEnvironment('9333'), {
      CCH_BROWSER_CDP_URL: 'http://127.0.0.1:9333',
      CCH_BROWSER_CDP_PORT: '9333'
    })
    assert.throws(() => terminals.browserCdpEnvironment('0'), /Porta CDP inválida/)
    assert.throws(() => terminals.browserCdpEnvironment('abc'), /Porta CDP inválida/)
  })
  assert.deepEqual(terminals.defaultShell('C:\\Program Files\\Git\\bin\\bash.exe'), {
    file: 'C:\\Program Files\\Git\\bin\\bash.exe', args: [], kind: 'posix'
  })
})

test('Ollama só abre o CLI na pasta da sessão: sem sessão, variáveis nem skills', t => {
  assert.equal(getEngine('ollama').command, 'ollama')
  assert.equal(getEngine('ollama').usage, null)
  assert.deepEqual(engineEnvironment('ollama'), {})
  assert.deepEqual(buildEngineArgs({ engine: 'ollama', sessionId: 'uuid', name: 'aba', addDirs: ['C:\\h'], prompt: 'leia', model: 'm' }), [])
  assert.deepEqual(buildEngineArgs({ engine: 'ollama', sessionId: 'uuid', resume: true, extraArgs: ['run', 'qwen3.5:9b'] }), ['run', 'qwen3.5:9b'])
  const dir = fixture(t)
  fs.mkdirSync(path.join(dir, 'skills', 'demo'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), 'skill')
  syncWorkspace(dir, 'ollama')
  for (const name of ['.claude', '.github', '.gemini', 'CLAUDE.md', 'GEMINI.md']) assert.equal(fs.existsSync(path.join(dir, name)), false)
  const terminals = loadWithMocks(path.resolve(__dirname, '../src/main/terminals.js'), {
    'node-pty': {},
    'node:fs': { existsSync: () => true },
    'node:child_process': { execFileSync: (bin, args) => { if (bin === 'where.exe' && args[0] === 'ollama') return 'C:\\bin\\ollama.exe\n'; throw new Error('ausente') } }
  }, { process: { platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' } } })
  assert.equal(terminals.preflight('ollama').cli, 'C:\\bin\\ollama.exe')
  assert.throws(() => terminals.preflight('claude'), /não foi encontrado/)
})

test('uso verifica CLI ausente e ignora CLIs desativados', async t => {
  const dir = fixture(t)
  const calls = []
  const settings = { engine: { enabled: ['gemini'] }, usage: { enabled: true, intervalMinutes: 5 } }
  const { createUsageWorker } = loadWithMocks(path.resolve(__dirname, '../src/main/usage.js'), {
    'node-pty': { spawn: () => { throw new Error('Sonda inesperada') } },
    '@xterm/headless': {}
  }, { setInterval: () => 1, clearInterval () {} })
  const worker = createUsageWorker({
    dataDir: dir, getSettings: () => settings, getShell: () => ({}), onUpdate () {},
    findCli: id => { calls.push(id); return null }
  })
  await worker.refresh()
  assert.equal(worker.get().engines.gemini.status, 'not-installed')
  assert.deepEqual(calls, ['gemini'])
  settings.engine.enabled = ['copilot']
  worker.reschedule()
  assert.equal(worker.get().engines.gemini, undefined)
  await worker.refresh()
  assert.deepEqual(calls, ['gemini', 'copilot'])
})

test('parser Gemini normaliza cota restante e estatísticas da sessão', () => {
  const { parseGemini } = usageForTest()
  const modelItems = parseGemini(`
    /model
    Model usage
    Pro         ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬    25%  Resets: 1:30 PM (1h 30m)
    Flash       ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬    72%  Resets: 2:00 PM (2h)
    Select a model
    workspace (/directory) no sandbox /model
  `)
  assert.equal(modelItems[0].label, 'Cota · Pro')
  assert.equal(modelItems[0].percent, 25)
  assert.equal(modelItems[0].detail, '75% restante')
  assert.match(modelItems[0].resets, /1:30 PM/)
  assert.equal(modelItems[1].label, 'Cota · Flash')
  assert.equal(modelItems[1].percent, 72)
  const items = parseGemini(`
    /stats model
    Model Usage
    gemini-2.5-pro
    Quota remaining: 73.5%
    Resets in 4h 20m
    Requests: 18
    Input Tokens: 12,345
    Output Tokens: 2,100
  `)
  assert.equal(items[0].label, 'Cota · gemini-2.5-pro')
  assert.equal(items[0].percent, 26.5)
  assert.equal(items[0].detail, '73.5% restante')
  assert.match(items[1].detail, /18 requisições/)
  assert.match(items[1].detail, /12,345 tokens de entrada/)
  const current = parseGemini('/stats model\n42% used (Limit resets in 3h)\nUsage limit: 1,000')
  assert.equal(current[0].percent, 42)
  assert.match(current[0].detail, /limite 1,000/)
  assert.equal(current[0].resets, '3h')
  assert.equal(parseGemini('/stats model\nLimit reached, resets in 25m\nUsage limit: 250')[0].percent, 100)
})

test('sonda Gemini isola IDE e inicia em modo acessível sem prompt de confiança', () => {
  const previous = {
    TERM_PROGRAM: process.env.TERM_PROGRAM,
    VSCODE_GIT_IPC_HANDLE: process.env.VSCODE_GIT_IPC_HANDLE,
    CURSOR_TRACE_ID: process.env.CURSOR_TRACE_ID
  }
  process.env.TERM_PROGRAM = 'vscode'
  process.env.VSCODE_GIT_IPC_HANDLE = 'ipc'
  process.env.CURSOR_TRACE_ID = 'cursor'
  try {
    const { probeLaunch } = usageForTest()
    const launch = probeLaunch('gemini', 'C:\\Program Files\\gemini.cmd', {
      file: 'C:\\Windows\\System32\\cmd.exe', kind: 'cmd'
    })
    assert.match(launch.args, /--screen-reader/)
    assert.match(launch.args, /--skip-trust/)
    assert.equal(launch.env.TERM_PROGRAM, undefined)
    assert.equal(launch.env.VSCODE_GIT_IPC_HANDLE, undefined)
    assert.equal(launch.env.CURSOR_TRACE_ID, undefined)
    assert.equal(launch.env.NO_COLOR, '1')
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('resposta reportada é limitação da API key, não zero nem erro de parser', () => {
  const { geminiUsageResult, mergeUsageResult } = usageForTest()
  const raw = `Gemini CLI v0.62.0
Authenticated with gemini-api-key /auth
 > /stats model
No API calls have been made in this session.
 > Type your message or @path/to/file
workspace (/directory) no sandbox /model`
  const result = geminiUsageResult(raw, '/stats model')
  assert.equal(result.status, 'quota-unavailable')
  assert.equal(result.command, '/stats model')
  assert.equal(result.items.length, 0)
  assert.match(result.message, /AI Studio/)
  const merged = mergeUsageResult({ items: [{ percent: 42 }], command: '/model' }, result)
  assert.equal(merged.items.length, 0)
  assert.equal(merged.command, '/stats model')

  const unknown = geminiUsageResult('No API calls have been made in this session.', '/stats model')
  assert.equal(unknown.status, 'unparsed')
  assert.equal(unknown.items.length, 0)
})

test('falha preserva idade dos números, não mascara data/origem da tentativa', () => {
  const { mergeUsageResult } = usageForTest()
  const old = { status: 'ok', command: '/stats model', items: [{ percent: 25 }], checkedAt: '2026-10-02T10:00:00Z' }
  const result = { status: 'unparsed', command: '/model', items: [], raw: 'novo', checkedAt: '2026-10-02T10:10:00Z' }
  const merged = mergeUsageResult(old, result)
  assert.equal(merged.checkedAt, result.checkedAt)
  assert.equal(merged.command, '/model')
  assert.equal(merged.raw, 'novo')
  assert.equal(merged.staleSince, old.checkedAt)
  assert.equal(merged.items[0].percent, 25)
})

test('cache Gemini anterior à versão da sonda não reaparece com origem nova', t => {
  const dir = fixture(t)
  fs.writeFileSync(path.join(dir, 'usage.json'), JSON.stringify({
    engines: { gemini: { status: 'unparsed', raw: '> /stats model' }, copilot: { status: 'ok', items: [] } }
  }))
  const { createUsageWorker } = usageForTest()
  const worker = createUsageWorker({ dataDir: dir })
  assert.equal(worker.get().engines.gemini, undefined)
  assert.equal(worker.get().engines.copilot.status, 'ok')
})

test('sonda encerra ao detectar API key sem Enter, /model ou prompt', async () => {
  let now = 0
  let screen = ''
  let killed = false
  const writes = []
  const { probe } = loadWithMocks(path.resolve(__dirname, '../src/main/usage.js'), {
    'node-pty': {
      spawn: () => ({
        onData: fn => fn('Authenticated with gemini-api-key /auth'),
        onExit () {},
        write: text => writes.push(text),
        kill: () => { killed = true }
      })
    },
    '@xterm/headless': {
      Terminal: class {
        buffer = { active: { length: 1, getLine: () => ({ translateToString: () => screen }) } }
        write (text) { screen = text }
        dispose () {}
      }
    }
  }, {
    Date: class extends Date { static now () { return now } },
    setTimeout: (fn, delay) => { now += delay; fn() }
  })
  const raw = await probe({ engine: 'gemini', command: '/model', cliPath: 'gemini', shell: { kind: 'posix' }, cwd: '.' })
  assert.match(raw, /gemini-api-key/)
  assert.equal(writes.some(text => text.includes('\r') || text.includes('/model')), false)
  assert.equal(killed, true)
})

test('IPC bloqueia desativado, exige confirmação e encerra apenas terminais afetados', async t => {
  const root = fixture(t)
  const h = { name: 'demo', title: 'Demo', path: root, workdir: root, engines: { supported: ENGINES } }
  const session = { id: 'sessao', title: 'Sessao', path: root, tabs: [], last_tab: null }
  const config = createSettings(path.join(root, 'settings.yaml'))
  const handlers = new Map()
  const killed = []
  let count = 0
  const electron = {
    app: { getAppPath: () => root, whenReady: () => ({ then () {} }), on () {} },
    BrowserWindow: class {}, ipcMain: { handle: (name, fn) => handlers.set(name, fn), on () {} }, shell: {}
  }
  loadWithMocks(path.resolve(__dirname, '../src/main/main.js'), {
    electron,
    './settings': { createSettings: () => config },
    './workspaces': { createWorkspaceStore: () => ({ get: () => h }) },
    './terminals': {
      buildEngineArgs, preflight: () => ({ cli: 'gemini' }), defaultShell: () => ({}), findCli: () => 'gemini',
      createTerminalManager: () => ({ start: () => ({ id: `t${++count}` }), kill: id => killed.push(id) })
    },
    './usage': { createUsageWorker: () => ({ reschedule () {} }) },
    './files': { createFilesWatcher: () => ({ watch () {} }) },
    './sync': { syncWorkspace () {} },
    './miniapps': { createMiniappStore: () => ({}) },
    './sessions': {
      get: () => session,
      addTab: async (_path, { engine, workdir }) => {
        const tab = { id: `aba-${session.tabs.length + 1}`, engine, workdir, session_id: 'uuid' }
        session.tabs.push(tab)
        return tab
      }
    }
  }, { process: { env: { CCH_SETTINGS: config.file }, on () {} }, console: { error () {} } })
  const open = engine => handlers.get('session:open')({}, { workspace: 'demo', sessionId: 'sessao', engine })
  await open('gemini')
  await open('copilot')
  const save = handlers.get('settings:save')
  assert.throws(() => save({}, { 'engine.enabled': ['claude', 'copilot'] }), /Confirme/)
  assert.ok(config.get().engine.enabled.includes('gemini'))
  save({}, { 'engine.enabled': ['claude', 'copilot'] }, true)
  assert.deepEqual(killed, ['t1'])
  await assert.rejects(open('gemini'), /desativado/)
  await assert.rejects(handlers.get('session:open')({}, {
    workspace: 'demo', sessionId: 'sessao', tabId: 'aba-1'
  }), /desativado/)
  assert.equal(session.tabs.length, 2)
  save({}, { 'engine.enabled': ENGINES }, true)
  await open('gemini')
  assert.equal(session.tabs.length, 3)
})
