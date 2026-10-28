// Configurações do programa: lidas de cli-context-hub/settings.yaml.
// O arquivo é criado com os valores padrão na primeira execução.
// É relido a cada uso, então mudanças valem sem reiniciar o app (exceto onde indicado).
const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')

const { ENGINES } = require('./engines')

const DEFAULTS = {
  engine: {
    default: 'claude',
    enabled: ENGINES
  },
  terminal: {
    shell: null
  },
  usage: {
    enabled: true,
    intervalMinutes: 5,
    hidden: []
  }
}

const TEMPLATE = `# Configurações do cli-context-hub
# Edite pela tela de Configurações do app (⚙) ou direto neste arquivo.

# CLIs disponíveis e padrão global
engine:
  default: claude
  enabled: [${ENGINES.join(', ')}]

# Terminal integrado
# shell: null = CMD no Windows, $SHELL no Linux/macOS. Ex: C:/Program Files/Git/bin/bash.exe
terminal:
  shell: null

# Mini-dashboard de uso (roda /usage dos CLIs num terminal invisível)
usage:
  enabled: true
  intervalMinutes: 5
  hidden: []           # CLIs que não aparecem no painel de uso (e não são consultados)
`

// Junta o que veio do arquivo com os padrões, recursivamente
function merge (base, over) {
  if (over == null || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over
  const out = { ...base }
  for (const k of Object.keys(over)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null
      ? merge(base[k], over[k])
      : over[k]
  }
  return out
}

// Corrige valores inválidos, devolvendo avisos em vez de quebrar o app
function validate (s) {
  const warnings = []
  const enabled = s.engine?.enabled
  if (!Array.isArray(enabled) || !enabled.length ||
      enabled.some(id => !ENGINES.includes(id)) || new Set(enabled).size !== enabled.length) {
    warnings.push('engine.enabled deve listar pelo menos um CLI conhecido, sem duplicatas; usando todos')
    s.engine = { ...s.engine, enabled: [...ENGINES] }
  }
  if (!ENGINES.includes(s.engine?.default)) {
    warnings.push(`engine.default "${s.engine?.default}" inválido; usando "${DEFAULTS.engine.default}"`)
    s.engine = { ...s.engine, default: DEFAULTS.engine.default }
  }
  if (!s.engine.enabled.includes(s.engine.default)) {
    warnings.push('O motor padrão deve estar ativo; selecione outro padrão antes de desativá-lo')
    s.engine = { ...s.engine, default: s.engine.enabled[0] }
  }
  if (s.terminal?.shell != null && typeof s.terminal.shell !== 'string') {
    warnings.push('terminal.shell deve ser texto ou null; ignorado')
    s.terminal = { ...s.terminal, shell: null }
  }
  const mins = Number(s.usage?.intervalMinutes)
  if (!Number.isFinite(mins) || mins < 1) {
    warnings.push(`usage.intervalMinutes "${s.usage?.intervalMinutes}" inválido (mínimo 1); usando ${DEFAULTS.usage.intervalMinutes}`)
    s.usage = { ...s.usage, intervalMinutes: DEFAULTS.usage.intervalMinutes }
  } else {
    s.usage = { ...s.usage, intervalMinutes: mins }
  }
  s.usage.enabled = s.usage.enabled !== false
  const hidden = s.usage.hidden ?? []
  if (!Array.isArray(hidden) || hidden.some(id => !ENGINES.includes(id))) {
    warnings.push('usage.hidden deve listar CLIs conhecidos; mostrando todos no painel de uso')
    s.usage.hidden = []
  } else {
    s.usage.hidden = [...new Set(hidden)]
  }
  return warnings
}

function createSettings (file) {
  function ensureFile () {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, TEMPLATE, 'utf8')
    }
  }

  function load () {
    ensureFile()
    let raw = {}
    const warnings = []
    try {
      raw = YAML.parse(fs.readFileSync(file, 'utf8')) || {}
    } catch (e) {
      warnings.push(`Erro ao ler ${path.basename(file)}: ${e.message}. Usando padrões.`)
    }
    const settings = merge(DEFAULTS, raw)
    warnings.push(...validate(settings))
    return { settings, warnings, file }
  }

  // Grava várias chaves de uma vez ({ 'engine.default': 'copilot' }) mantendo os comentários do arquivo.
  // Tudo ou nada: se algum valor for inválido, nada é gravado.
  function save (changes) {
    ensureFile()
    const doc = YAML.parseDocument(fs.readFileSync(file, 'utf8'))
    if (doc.errors.length) throw new Error(`settings.yaml com erro de sintaxe: ${doc.errors[0].message}`)
    for (const [key, value] of Object.entries(changes)) doc.setIn(key.split('.'), value)

    const check = merge(DEFAULTS, doc.toJS() || {})
    const warnings = validate(check)
    if (warnings.length) throw new Error(warnings.join(' · '))

    fs.writeFileSync(file, doc.toString(), 'utf8')
    return load()
  }

  return { file, load, save, get: () => load().settings }
}

module.exports = { createSettings, DEFAULTS, ENGINES }
