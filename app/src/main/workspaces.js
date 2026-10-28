// Leitura dos workspaces armazenados em disco.
const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')
const { expandHome, isDir } = require('./util')

const { ENGINES, enabledEngines } = require('./engines')
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// getSettings: função que devolve as configurações atuais do programa
function createWorkspaceStore (root, getSettings = () => ({ engine: { default: 'claude' } })) {
  function read (name) {
    const dir = path.join(root, name)
    let cfg = {}
    try {
      cfg = YAML.parse(fs.readFileSync(path.join(dir, 'workspace.yaml'), 'utf8')) || {}
    } catch { /* sem workspace.yaml: usa padrões */ }

    const settings = getSettings()
    const available = enabledEngines(settings)
    const declared = Array.isArray(cfg.engines?.supported) ? cfg.engines.supported : ENGINES
    const supported = declared.filter(e => ENGINES.includes(e) && available.includes(e))
    // padrão do workspace > padrão das configurações > primeiro suportado
    const globalDefault = settings.engine.default
    const def = ENGINES.includes(cfg.engines?.default) && supported.includes(cfg.engines.default)
      ? cfg.engines.default
      : supported.includes(globalDefault) ? globalDefault : supported[0] || null
    const defaultFrom = ENGINES.includes(cfg.engines?.default) && supported.includes(cfg.engines.default) ? 'workspace' : 'settings'

    // workdir vazio/null (no YAML, "~" sozinho também é null) = raiz do workspace.
    // Assim os CLIs encontram AGENTS.md, CLAUDE.md e as skills geradas em .claude/skills.
    // Os arquivos de trabalho vão para files/ (regra da skill onde-salvar-arquivos).
    let workdir
    let workdirOk = true
    if (cfg.workdir == null || String(cfg.workdir).trim() === '') {
      workdir = dir
    } else {
      workdir = expandHome(cfg.workdir)
      workdirOk = isDir(workdir)
      if (!workdirOk) workdir = dir
    }
    try { fs.mkdirSync(path.join(dir, 'contexts'), { recursive: true }) } catch {}

    return {
      name,
      title: cfg.title || name,
      description: cfg.description || '',
      defaultTopics: Array.isArray(cfg.default_topics)
        ? cfg.default_topics.map(topic => String(topic).trim()).filter(Boolean)
        : [],
      path: dir,
      workdir,
      workdirWarning: workdirOk ? null : `workdir "${cfg.workdir}" não existe; usando a pasta do workspace`,
      engines: { default: def, defaultFrom, supported },
      ...Object.fromEntries(ENGINES.map(engine => [engine, cfg[engine] || {}]))
    }
  }

  function list () {
    if (!isDir(root)) return []
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map(d => read(d.name))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  function get (name) {
    if (!isDir(path.join(root, name))) throw new Error(`Workspace não encontrado: ${name}`)
    return read(name)
  }

  function create ({ name, title, description = '' }) {
    name = String(name || '').trim().toLowerCase()
    title = String(title || '').trim()
    description = String(description || '').trim()
    if (!NAME_RE.test(name) || name.startsWith('_')) {
      throw new Error('O nome deve usar kebab-case (ex.: meu-workspace), sem espaços.')
    }
    if (!title) throw new Error('Informe um título para o workspace.')
    if (!isDir(root)) fs.mkdirSync(root, { recursive: true })

    const template = path.join(root, '_template')
    const target = path.join(root, name)
    if (!isDir(template)) throw new Error('Template padrão de workspace não encontrado.')
    if (fs.existsSync(target)) throw new Error(`Já existe um workspace chamado "${name}".`)

    fs.cpSync(template, target, { recursive: true, errorOnExist: true })

    const yamlFile = path.join(target, 'workspace.yaml')
    let yaml = fs.readFileSync(yamlFile, 'utf8')
    yaml = yaml.replace(/^name:.*$/m, `name: ${name}`)
      .replace(/^title:.*$/m, `title: ${JSON.stringify(title)}`)
      .replace(/^description:.*$/m, `description: ${JSON.stringify(description || 'Descreva para que este workspace serve.')}`)
    fs.writeFileSync(yamlFile, yaml, 'utf8')

    const agentsFile = path.join(target, 'AGENTS.md')
    if (fs.existsSync(agentsFile)) {
      const agents = fs.readFileSync(agentsFile, 'utf8')
        .replace(/^# .*$/m, `# ${title}`)
      fs.writeFileSync(agentsFile, agents, 'utf8')
    }
    return read(name)
  }

  return { root, list, get, create }
}

module.exports = { createWorkspaceStore, ENGINES }
