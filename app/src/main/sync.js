// Tradutor do harness: copia o formato neutro do harness para as pastas que cada CLI lê.
//
// Analogia: os livros (skills, agentes, comandos) ficam guardados numa caixa (skills/, agents/...).
// Cada leitor só procura numa estante com nome próprio (.claude/, .github/). Antes de abrir uma aba,
// o app arruma as estantes com cópias atualizadas dos livros da caixa.
//
//   skills/<x>/        -> .claude/skills/<x>/          (o Claude e o Copilot leem daqui)
//   agents/<x>.md      -> .claude/agents/<x>.md        (Claude)
//                      -> .github/agents/<x>.agent.md  (Copilot)
//   commands/<x>.md    -> .claude/commands/<x>.md      (Claude)
//   AGENTS.md          -> lido direto pelo Copilot; o Claude lê via CLAUDE.md com "@AGENTS.md"
//   mcp/mcp.json       -> .mcp.json                    (Claude/Copilot; só se houver servidores)
//
// Itens cujo nome começa com "_" ou "." são ignorados (ex.: _exemplo-skill).
// As pastas geradas são apagadas e recriadas a cada sincronização: edite só as originais.
const fs = require('node:fs')
const path = require('node:path')
const { getEngine } = require('./engines')

const MARK = '<!-- gerado pelo harness-hub: edite AGENTS.md, não este arquivo -->'
const GENERATED_NOTE = 'Gerado pelo harness-hub a partir de skills/, agents/ e commands/ do harness.\nNão edite aqui: as alterações são apagadas na próxima aba aberta.\n'

const visible = name => !name.startsWith('_') && !name.startsWith('.')

function list (dir, filter) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => visible(d.name) && filter(d)) } catch { return [] }
}

// Limpa o conteúdo da pasta sem apagar a pasta raiz.
// Apagar e recriar a pasta causava EPERM no Windows quando outro processo (ex.: Claude CLI)
// tinha um handle aberto nela.
function resetDir (dir) {
  fs.mkdirSync(dir, { recursive: true })
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
  }
}

function syncHarness (harnessPath, engine) {
  if (engine != null) getEngine(engine)
  const claude = engine == null || engine === 'claude'
  const copilot = engine == null || engine === 'copilot'
  const gemini = engine == null || engine === 'gemini'
  const p = (...x) => path.join(harnessPath, ...x)
  const report = { skills: [], agents: [], commands: [], claudeMd: false, mcp: false }

  // skills -> .claude/skills (lido pelo Claude e pelo Copilot)
  const skillsOut = p('.claude', 'skills')
  if (claude || copilot) resetDir(skillsOut)
  for (const d of list(p('skills'), d => d.isDirectory())) {
    if (!fs.existsSync(p('skills', d.name, 'SKILL.md'))) continue
    if (claude || copilot) fs.cpSync(p('skills', d.name), path.join(skillsOut, d.name), { recursive: true })
    report.skills.push(d.name)
  }

  // agents -> .claude/agents e .github/agents (*.agent.md)
  const claudeAgents = p('.claude', 'agents')
  const copilotAgents = p('.github', 'agents')
  if (claude) resetDir(claudeAgents)
  if (copilot) resetDir(copilotAgents)
  if (claude || copilot) {
    for (const f of list(p('agents'), d => d.isFile() && d.name.endsWith('.md'))) {
      const base = f.name.replace(/(\.agent)?\.md$/, '')
      if (claude) fs.copyFileSync(p('agents', f.name), path.join(claudeAgents, `${base}.md`))
      if (copilot) fs.copyFileSync(p('agents', f.name), path.join(copilotAgents, `${base}.agent.md`))
      report.agents.push(base)
    }
  }

  // commands -> .claude/commands
  const claudeCommands = p('.claude', 'commands')
  if (claude || copilot) {
    resetDir(claudeCommands)
    for (const f of list(p('commands'), d => d.isFile() && d.name.endsWith('.md'))) {
      fs.copyFileSync(p('commands', f.name), path.join(claudeCommands, f.name))
      report.commands.push(f.name.replace(/\.md$/, ''))
    }

  }

  if (claude || copilot) fs.writeFileSync(p('.claude', 'LEIA-ME.txt'), GENERATED_NOTE)
  if (copilot) fs.writeFileSync(p('.github', 'LEIA-ME.txt'), GENERATED_NOTE)

  // Só substitui/remove skills Gemini identificadas como geradas pelo host.
  if (gemini) {
    const geminiSkills = p('.gemini', 'skills')
    const marker = '.harness-hub-generated'
    fs.mkdirSync(geminiSkills, { recursive: true })
    for (const item of list(geminiSkills, d => d.isDirectory())) {
      const dir = path.join(geminiSkills, item.name)
      if (!report.skills.includes(item.name) && fs.existsSync(path.join(dir, marker))) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
    for (const name of report.skills) {
      const target = path.join(geminiSkills, name)
      if (fs.existsSync(target) && !fs.existsSync(path.join(target, marker))) {
        throw new Error(`Skill Gemini não gerenciada já existe: ${target}. Renomeie-a antes de sincronizar.`)
      }
      resetDir(target)
      fs.cpSync(p('skills', name), target, { recursive: true })
      fs.writeFileSync(path.join(target, marker), GENERATED_NOTE)
    }

    const geminiMd = p('GEMINI.md')
    const geminiExisting = fs.existsSync(geminiMd) ? fs.readFileSync(geminiMd, 'utf8') : null
    if (geminiExisting == null || geminiExisting.includes(MARK)) {
      fs.writeFileSync(geminiMd, `${MARK}\n@AGENTS.md\n`)
    }
  }

  // CLAUDE.md -> importa o AGENTS.md (só cria/substitui se for um arquivo gerado por nós)
  if (claude) {
    const claudeMd = p('CLAUDE.md')
    const existing = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, 'utf8') : null
    if (existing == null || existing.includes(MARK)) {
      fs.writeFileSync(claudeMd, `${MARK}\n@AGENTS.md\n`)
      report.claudeMd = true
    }
  }

  // mcp/mcp.json -> .mcp.json (Claude/Copilot)
  if (claude || copilot) {
    try {
      let mcp = {}
      try { mcp = JSON.parse(fs.readFileSync(p('mcp', 'mcp.json'), 'utf8')) } catch {}
      if (!mcp.mcpServers) mcp.mcpServers = {}

      if (Object.keys(mcp.mcpServers).length) {
        fs.writeFileSync(p('.mcp.json'), JSON.stringify(mcp, null, 2))
        report.mcp = true
      }
    } catch { /* sem mcp.json válido: nada a fazer */ }
  }

  return report
}

module.exports = { syncHarness }
