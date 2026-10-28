// Worker de uso do mini-dashboard:
// - Claude: a statusline do cli-context-hub grava os limites do plano a cada resposta
//   (src/statusline/claude-statusline.js). Nada é consultado à parte.
// - Copilot: de tempos em tempos abre o CLI num terminal INVISÍVEL, digita /usage e lê a tela.
// - Gemini: não calcula uso; o painel identifica o modelo configurado como free.
//   O /usage do Copilot é local: não envia prompt ao modelo.
const fs = require('node:fs')
const path = require('node:path')
const pty = require('node-pty')
const { Terminal } = require('@xterm/headless')

const { ENGINES, getEngine, enabledEngines } = require('./engines')

// Só entram no painel (e são consultados) os CLIs ativos que o usuário não ocultou em usage.hidden
const tracked = (settings, engine) => enabledEngines(settings).includes(engine) && !(settings.usage?.hidden || []).includes(engine)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const GEMINI_PROBE_VERSION = 2

function geminiApiKeySession (text) {
  return /\bAuthenticated with gemini-api-key\b/i.test(text)
}

function geminiUsageResult (raw, command) {
  const base = { raw: raw.slice(-4000), command, probeVersion: GEMINI_PROBE_VERSION }
  if (geminiApiKeySession(raw)) {
    return {
      ...base,
      status: 'quota-unavailable',
      items: [],
      message: 'A sonda está usando Gemini API key. Esta consulta do CLI não fornece o consumo global do projeto. Consulte uso e limites no Google AI Studio; os tokens de /stats são apenas da sessão.'
    }
  }
  const items = parseGemini(raw)
  return {
    ...base,
    status: items.length ? 'ok' : 'unparsed',
    items,
    message: items.length ? null : 'A consulta não retornou cotas reconhecidas. Isso não significa consumo zero; consulte a saída recebida abaixo.'
  }
}

function mergeUsageResult (prev, result) {
  if (['ok', 'quota-unavailable', 'not-installed', 'unsupported'].includes(result.status) ||
      result.source === 'statusline' || !prev?.items?.length) return result
  // A data/origem descrevem a última tentativa; números antigos ficam explicitamente datados.
  return { ...result, items: prev.items, staleSince: prev.staleSince || prev.checkedAt }
}

// ---------- leitura da tela ----------
function screenText (term) {
  const buf = term.buffer.active
  const lines = []
  for (let i = 0; i < buf.length; i++) lines.push(buf.getLine(i)?.translateToString(true) ?? '')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function probeLaunch (engine, cliPath, shell) {
  const env = { ...process.env, WORKSPACE_HUB: '1', CCH_PROBE: '1' }
  const args = []
  if (engine === 'gemini') {
    args.push('--screen-reader', '--skip-trust')
    // O processo do CLI Context Hub pode herdar variáveis do VS Code/Cursor. Se elas
    // vazarem para a sonda, o Gemini sugere /ide install e abre onboarding de
    // atalhos, impedindo /stats model de chegar ao prompt.
    for (const key of Object.keys(env)) {
      if (/^(VSCODE_|CURSOR_|WINDSURF_|ANTIGRAVITY_|GEMINI_CLI_IDE_)/i.test(key)) delete env[key]
    }
    delete env.TERM_PROGRAM
    env.NO_COLOR = '1'
  }
  if (shell.kind === 'cmd') {
    const suffix = args.length ? ` ${args.map(arg => `"${arg}"`).join(' ')}` : ''
    return { file: shell.file, args: `/d /s /c ""${cliPath}"${suffix}"`, env }
  }
  return { file: cliPath, args, env }
}

/**
 * Abre o CLI escondido, roda /usage e devolve o texto da tela.
 * Etapas: espera o CLI "sossegar" → aceita a pergunta de confiança da pasta, se houver →
 * digita /usage → espera a resposta → encerra o processo.
 */
async function probe ({ engine, command = '/usage', cliPath, shell, cwd, signal, timeoutMs = 90000 }) {
  signal?.throwIfAborted()
  const term = new Terminal({ cols: 120, rows: 60, scrollback: 2000, allowProposedApi: true })
  let lastData = Date.now()
  let exited = false

  const launch = probeLaunch(engine, cliPath, shell)
  const p = pty.spawn(launch.file, launch.args, {
    name: 'xterm-256color', cols: 120, rows: 60, cwd, env: launch.env
  })

  p.onData(d => { lastData = Date.now(); term.write(d) })
  p.onExit(() => { exited = true })
  const abort = () => {
    exited = true
    try { p.kill() } catch (error) { console.error(`Falha ao encerrar sonda ${engine}: ${error.message}`) }
  }
  signal?.addEventListener('abort', abort, { once: true })

  const started = Date.now()
  const timeLeft = () => timeoutMs - (Date.now() - started)
  // espera até ficar `quietMs` sem receber nada (ou até a condição `until` ser verdadeira)
  async function settle (quietMs, maxMs, until) {
    const end = Date.now() + Math.min(maxMs, Math.max(0, timeLeft()))
    while (Date.now() < end && !exited) {
      await sleep(250)
      const text = screenText(term)
      if (until && until(text) && Date.now() - lastData > 600) return text
      if (!until && Date.now() - lastData > quietMs) return text
    }
    return screenText(term)
  }

  try {
    // 1) inicialização: espera aparecer o prompt (❯ ou >) ou a pergunta de confiança.
    //    Não dá para esperar "silêncio": as animações dos CLIs ficam redesenhando a tela.
    const terminalSetup = t => /automatically configure your terminal keybindings/i.test(t) && /Do you want to continue/i.test(t)
    const ready = t => /❯|^\s*>\s*(?:\/[^\n]*)?$/m.test(t) || /trust|confia/i.test(t) || terminalSetup(t)
    let text = await settle(2500, 30000, t => ready(t) || (engine === 'gemini' && geminiApiKeySession(t)))
    if (engine === 'gemini' && geminiApiKeySession(text)) return text
    // Versões que ainda exibirem o onboarding apesar do ambiente isolado:
    // selecione "No" e continue sem modificar configurações do editor.
    for (let i = 0; i < 3 && terminalSetup(text); i++) {
      signal?.throwIfAborted()
      p.write('\x1b[B\r')
      text = await settle(1800, 10000, t => !terminalSetup(t) && /❯|^\s*>\s*(?:\/[^\n]*)?$/m.test(t))
    }
    if (engine === 'gemini' && (terminalSetup(text) || !ready(text))) {
      throw new Error('Gemini não chegou ao prompt de consulta. Nenhum comando de uso foi enviado.')
    }
    // 2) pergunta "você confia nesta pasta?" (pasta de sonda vazia, criada pelo app)
    for (let i = 0; i < 2 && /trust|confia/i.test(text) && /(yes|sim)/i.test(text); i++) {
      p.write('\r')
      text = await settle(2500, 20000, t => /❯/.test(t) && !/trust|confia/i.test(t))
    }
    await sleep(1500) // dá tempo do CLI terminar de carregar antes de digitar
    signal?.throwIfAborted()
    // 3) comando local de estatísticas do CLI (não envia prompt ao modelo)
    // Escape fecha sugestões/modais e Ctrl+U remove comandos sugeridos como
    // "/ide install" antes de inserir o comando da sonda.
    if (engine === 'gemini') {
      p.write('\x1b')
      await sleep(150)
      p.write('\x15')
      await sleep(150)
    }
    p.write(command)
    await sleep(700)
    signal?.throwIfAborted()
    p.write('\r')
    // O Claude mostra "Loading usage data…" enquanto busca os limites na API: espera sumir
    const done = engine === 'claude'
      ? t => /%\s*used/i.test(t) || (/Usage/.test(t) && !/Loading usage/i.test(t) && /error|failed|not available|only available/i.test(t))
      : engine === 'gemini'
        ? t => /model usage[\s\S]*\d{1,3}\s*%/i.test(t)
      : t => /%\s*used|AIC|premium request/i.test(t)
    text = await settle(3000, 40000, done)
    await sleep(800)
    signal?.throwIfAborted()
    return screenText(term)
  } finally {
    signal?.removeEventListener('abort', abort)
    try { p.write('\x1b') } catch {}
    try { p.kill() } catch {}
    term.dispose()
  }
}

// ---------- interpretação ----------
const PT_LABEL = {
  'Current session': 'Sessão (5h)',
  'Current week (all models)': 'Semana',
  'Current week (Sonnet only)': 'Semana · Sonnet',
  'Current week (Opus)': 'Semana · Opus'
}

function parseClaude (raw) {
  const text = raw.split(/\/usage/).pop() // só o que veio depois do comando
  const items = []
  const re = /(Current session|Current week \([^)]*\))([\s\S]*?)(?=Current session|Current week \(|$)/g
  let m
  while ((m = re.exec(text))) {
    const block = m[2]
    const pct = block.match(/(\d{1,3}(?:\.\d+)?)\s*%\s*used/i)
    if (!pct) continue
    const reset = block.match(/Resets?\s+([^\n]+?)\s*(?:\n|$)/i)
    items.push({
      label: PT_LABEL[m[1]] || m[1].replace('Current week', 'Semana'),
      percent: Number(pct[1]),
      resets: reset ? reset[1].trim() : null
    })
  }
  return items
}

function parseCopilot (raw) {
  const text = raw
  const items = []
  const num = s => Number(String(s).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))

  // Formato atual (cobrança por AI Credits):
  //    Plan       ■■■■■■■■■■ 0% used
  //               0 / 200 AIC
  const plan = text.match(/Plan\b[^\n]*?(\d{1,3}(?:[.,]\d+)?)\s*%\s*used[^\n]*\n\s*(\d[\d.,]*)\s*\/\s*(\d[\d.,]*)\s*([A-Za-z ]+)?/i)
  if (plan) {
    const unit = (plan[4] || '').trim()
    items.push({ label: unit === 'AIC' ? 'Plano (AI Credits)' : 'Plano', percent: num(plan[1]), detail: `${plan[2]} / ${plan[3]}${unit ? ' ' + unit : ''}`, resets: null })
    const sess = text.match(/Session:\s*(\d[\d.,]*)\s*(AIC|premium requests?)\s*used/i)
    if (sess) items[0].detail += ` · sessão: ${sess[1]} ${sess[2]}`
    const reset = text.match(/(?:resets?|renova\w*)\s*(?:on|em|in)?\s*:?\s*([^\n]+)/i)
    if (reset) items[0].resets = reset[1].trim()
    return items
  }

  // Formato antigo / alternativo: linhas com premium requests, créditos, cota...
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (!/premium|request|credit|quota|budget|limit|AIC/i.test(line)) continue
    const frac = line.match(/(\d[\d.,]*)\s*(?:\/|of|de)\s*(\d[\d.,]*)/i)
    const pct = line.match(/(\d{1,3}(?:\.\d+)?)\s*%\s*(used|usad|remaining|restant|left)?/i)
    if (!frac && !pct) continue
    let percent = null
    let detail = null
    if (frac) {
      const used = num(frac[1]); const limit = num(frac[2])
      if (limit > 0) { percent = Math.round((used / limit) * 1000) / 10; detail = `${frac[1]} / ${frac[2]}` }
    }
    if (percent == null && pct) {
      percent = Number(pct[1])
      if (/remaining|restant|left/i.test(pct[2] || '')) percent = Math.round((100 - percent) * 10) / 10
    }
    const label = /premium/i.test(line) ? 'Premium requests' : /credit/i.test(line) ? 'Créditos' : 'Cota'
    if (!items.some(i => i.label === label)) items.push({ label, percent, detail, resets: null })
  }
  const reset = text.match(/(?:resets?|renova\w*)\s*(?:on|em|in)?\s*:?\s*([^\n]+)/i)
  if (reset && items.length) items[0].resets = reset[1].trim()
  return items
}

function parseGemini (raw) {
  // /model também aparece no rodapé: não corte a resposta nesse atalho.
  const text = raw.replace(/[│┃]/g, ' ')
  const items = []
  const number = value => Number(String(value).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))

  // Gemini CLI 0.62+: /model exibe a cota real por tier. O percentual
  // mostrado é usado (ModelQuotaDisplay calcula 1 - remainingFraction).
  const modelUsage = text.match(/Model usage([\s\S]*?)(?=\n\s*(?:Select|Use|Esc|Enter|Model selection|$))/i)?.[1] ||
    text.split(/Model usage/i)[1] || ''
  for (const line of modelUsage.split(/\r?\n/)) {
    const row = line.match(/^\s*(Pro|Flash(?:\s+Lite)?|gemini-[a-z0-9._-]+)\s+.*?(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:Resets:\s*(.+))?$/i)
    if (!row) continue
    const percent = Math.max(0, Math.min(100, number(row[2])))
    items.push({
      label: `Cota · ${row[1]}`,
      percent,
      detail: `${Math.round((100 - percent) * 10) / 10}% restante`,
      resets: row[3]?.trim() || null
    })
  }

  // A UI varia conforme autenticação/versão. Normaliza todas as formas de
  // "remaining" para percentual usado, que é o contrato visual do dashboard.
  const quotaPatterns = [
    /(?:quota\s+)?remaining[^\d]*(\d{1,3}(?:[.,]\d+)?)\s*%/gi,
    /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:quota\s+)?remaining/gi
  ]
  const seenQuota = new Set()
  for (const pattern of quotaPatterns) {
    let match
    while ((match = pattern.exec(text))) {
      const remaining = Math.max(0, Math.min(100, number(match[1])))
      const key = `${match.index}:${remaining}`
      if (seenQuota.has(key)) continue
      seenQuota.add(key)
      const nearby = text.slice(Math.max(0, match.index - 120), match.index + match[0].length + 160)
      const model = nearby.match(/gemini-[a-z0-9._-]+/i)?.[0]
      const reset = nearby.match(/(?:resets?|reset\s+(?:at|in|on))[^\n:]*:?\s*([^\n|]+)/i)?.[1]?.trim() || null
      items.push({
        label: model ? `Cota · ${model}` : 'Cota',
        percent: Math.round((100 - remaining) * 10) / 10,
        detail: `${remaining}% restante`,
        resets: reset
      })
    }
  }

  // Algumas versões mostram usado diretamente.
  const used = text.match(/(?:quota[^\n]*?)?(\d{1,3}(?:[.,]\d+)?)\s*%\s*used/i)
  if (!items.length && used) {
    const percent = Math.max(0, Math.min(100, number(used[1])))
    const limit = text.match(/Usage limit:\s*(\d[\d.,]*)/i)?.[1]
    const reset = text.match(/Limit resets in\s*([^\n|)]+)/i)?.[1]?.trim() || null
    items.push({
      label: 'Cota diária',
      percent,
      detail: [limit && `limite ${limit}`, `${percent}% usado`].filter(Boolean).join(' · '),
      resets: reset
    })
  }
  if (!items.length && /Limit reached/i.test(text)) {
    const limit = text.match(/Usage limit:\s*(\d[\d.,]*)/i)?.[1]
    const reset = text.match(/resets in\s*([^\n|)]+)/i)?.[1]?.trim() || null
    items.push({
      label: 'Cota diária',
      percent: 100,
      detail: [limit && `limite ${limit}`, 'limite atingido'].filter(Boolean).join(' · '),
      resets: reset
    })
  }

  const requests = text.match(/(?:requests?|reqs?)\s*:?\s*(\d[\d.,]*)/i)
  const input = text.match(/(?:input(?:\s+tokens?)?|input tokens?)\s*:?\s*(\d[\d.,]*)/i)
  const output = text.match(/(?:output(?:\s+tokens?)?|output tokens?)\s*:?\s*(\d[\d.,]*)/i)
  const tokens = [
    requests && `${requests[1]} requisições na sessão`,
    input && `${input[1]} tokens de entrada`,
    output && `${output[1]} tokens de saída`
  ].filter(Boolean).join(' · ')
  if (tokens) items.push({ label: 'Sessão atual', percent: null, detail: tokens, resets: null })

  return items
}

const PARSERS = { claude: parseClaude, copilot: parseCopilot, gemini: parseGemini }

// ---------- Claude via statusline ----------
// resets_at pode vir como segundos desde 1970 ou como data ISO
function toDate (v) {
  if (v == null) return null
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v)
  return isNaN(d) ? null : d
}

function formatReset (v) {
  const d = toDate(v)
  if (!d) return null
  const pad = n => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return `hoje ${hm}`
  if (d.toDateString() === tomorrow.toDateString()) return `amanhã ${hm}`
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`
}

function readClaudeStatusline (file) {
  let data
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
  const rl = data.rate_limits || {}
  const items = []
  const add = (label, w) => {
    if (!w) return
    const pct = w.used_percentage ?? w.utilization
    if (pct == null) return
    items.push({ label, percent: Math.round(Number(pct) * 10) / 10, resets: formatReset(w.resets_at) })
  }
  add('Sessão (5h)', rl.five_hour)
  add('Semana', rl.seven_day)
  add('Semana · Opus', rl.seven_day_opus)
  add('Semana · Sonnet', rl.seven_day_sonnet)
  add('Limite de gasto', rl.spend_limit)
  return {
    status: items.length ? 'ok' : 'unparsed',
    source: 'statusline',
    items,
    raw: JSON.stringify(data, null, 2),
    checkedAt: data.receivedAt || null
  }
}

// ---------- worker ----------
function createUsageWorker ({ dataDir, getSettings, findCli, getShell, onUpdate, log = () => {} }) {
  const probeDir = path.join(dataDir, 'probe')
  const claudeFile = path.join(dataDir, 'claude-statusline.json')
  const stateFile = path.join(dataDir, 'usage.json')
  fs.mkdirSync(probeDir, { recursive: true })

  let state = { updatedAt: null, running: false, engines: {} }
  try { state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')), running: false } } catch {}
  if (state.engines.gemini?.probeVersion !== GEMINI_PROBE_VERSION) {
    delete state.engines.gemini
  }

  let timer = null
  let initialTimer = null
  let current = null
  let activeProbe = null

  function emit () {
    try { fs.writeFileSync(stateFile, JSON.stringify({ ...state, running: false }, null, 2), 'utf8') } catch {}
    onUpdate(state)
  }

  async function checkEngine (engine) {
    if (!getEngine(engine).usage) {
      return { status: 'unsupported', items: [], checkedAt: null }
    }
    if (engine === 'gemini') {
      return {
        status: 'free',
        items: [],
        checkedAt: new Date().toISOString(),
        message: 'Gemini configurado com a tag free. O CLI Context Hub não calcula uso ou cota para este CLI.'
      }
    }
    if (engine === 'claude') {
      if (!findCli('claude')) return { status: 'not-installed', items: [], checkedAt: new Date().toISOString() }
      return readClaudeStatusline(claudeFile) || { status: 'waiting', source: 'statusline', items: [], checkedAt: null }
    }
    const cliPath = findCli(engine)
    if (!cliPath) return { status: 'not-installed', items: [], checkedAt: new Date().toISOString() }
    const controller = new AbortController()
    activeProbe = { engine, controller }
    const command = getEngine(engine).usageCommand || '/usage'
    try {
      const raw = await probe({
        engine,
        command,
        cliPath,
        shell: getShell(),
        cwd: probeDir,
        signal: controller.signal
      })
      fs.writeFileSync(path.join(dataDir, `${engine}-last.txt`), raw, 'utf8') // para conferir/ajustar o parser
      if (engine === 'gemini') {
        const sentCommand = geminiApiKeySession(raw) ? null : command
        return { ...geminiUsageResult(raw, sentCommand), checkedAt: new Date().toISOString() }
      }
      const items = PARSERS[engine](raw)
      return { status: items.length ? 'ok' : 'unparsed', items, raw: raw.slice(-4000), checkedAt: new Date().toISOString() }
    } catch (e) {
      if (controller.signal.aborted) return { status: 'disabled', items: [] }
      log(`usage:${engine}`, e)
      return { status: 'error', error: e.message, items: [], checkedAt: new Date().toISOString() }
    } finally {
      activeProbe = null
    }
  }

  // Consulta somente CLIs ativos, em sequência.
  function refresh () {
    if (current) return current
    if (!getSettings().usage.enabled) return Promise.resolve()
    current = (async () => {
      state.running = true
      onUpdate(state)
      for (const engine of ENGINES) {
        if (!getSettings().usage.enabled) break
        if (!tracked(getSettings(), engine)) {
          delete state.engines[engine]
          continue
        }
        const result = await checkEngine(engine)
        if (!tracked(getSettings(), engine)) {
          delete state.engines[engine]
          continue
        }
        // se falhou, mantém os últimos números bons e só marca o erro
        const prev = state.engines[engine]
        state.engines[engine] = mergeUsageResult(prev, result)
        state.updatedAt = new Date().toISOString()
        emit()
      }
      state.running = false
      emit()
    })().finally(() => { current = null })
    return current
  }

  function schedule () {
    clearInterval(timer)
    if (activeProbe && (!getSettings().usage.enabled ||
        !tracked(getSettings(), activeProbe.engine))) activeProbe.controller.abort()
    for (const engine of Object.keys(state.engines)) {
      if (!tracked(getSettings(), engine)) delete state.engines[engine]
    }
    emit()
    const cfg = getSettings().usage
    if (!cfg.enabled) return
    timer = setInterval(refresh, cfg.intervalMinutes * 60 * 1000)
  }

  // Assim que o Claude grava novos números, atualiza só o Claude (sem esperar o intervalo)
  let watchTimer = null
  function onClaudeFile () {
    clearTimeout(watchTimer)
    watchTimer = setTimeout(() => {
      if (!getSettings().usage.enabled || !tracked(getSettings(), 'claude')) return
      const r = readClaudeStatusline(claudeFile)
      if (!r) return
      state.engines.claude = r
      state.updatedAt = new Date().toISOString()
      emit()
    }, 300)
  }
  let watcher = null

  return {
    start () {
      schedule()
      onClaudeFile()
      try { watcher = fs.watch(dataDir, (_ev, name) => { if (!name || String(name).startsWith('claude-statusline.json')) onClaudeFile() }) } catch {}
      initialTimer = setTimeout(refresh, 8000)
    },
    stop () {
      clearInterval(timer)
      clearTimeout(initialTimer)
      clearTimeout(watchTimer)
      activeProbe?.controller.abort()
      try { watcher?.close() } catch {}
    },
    claudeFile,
    reschedule: schedule,
    refresh,
    get: () => state
  }
}

module.exports = {
  createUsageWorker, parseClaude, parseCopilot, parseGemini, probe, probeLaunch,
  readClaudeStatusline, geminiUsageResult, mergeUsageResult
}
