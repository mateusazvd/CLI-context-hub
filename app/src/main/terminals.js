// Terminais: abre um shell real (PTY) e digita nele o comando do CLI.
// Quando o CLI termina, você continua no shell, como num terminal normal.
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const pty = require('node-pty')
const { getEngine, buildEngineArgs, engineEnvironment } = require('./engines')

const isWin = process.platform === 'win32'
const DEFAULT_BROWSER_CDP_PORT = '9222'

function browserCdpEnvironment (configuredPort = process.env.CCH_BROWSER_CDP_PORT) {
  const port = String(configuredPort || DEFAULT_BROWSER_CDP_PORT).trim()
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`Porta CDP inválida: "${port}". Use um número entre 1 e 65535.`)
  }
  return {
    CCH_BROWSER_CDP_URL: `http://127.0.0.1:${port}`,
    CCH_BROWSER_CDP_PORT: port
  }
}

// Prioridade: variável CCH_SHELL > settings.terminal.shell > padrão do sistema
function defaultShell (configured) {
  const custom = process.env.CCH_SHELL || configured
  // PowerShell bloqueado não pode ser usado nem por configuração explícita.
  // No Windows, cai para CMD para manter o terminal funcional.
  if (custom && !(isWin && guessKind(custom) === 'powershell')) {
    return { file: custom, args: [], kind: guessKind(custom) }
  }
  // Windows: sempre CMD (o PowerShell pode estar bloqueado por política, erro 1260)
  if (isWin) return { file: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', args: [], kind: 'cmd' }
  return { file: process.env.SHELL || '/bin/bash', args: [], kind: 'posix' }
}

// Argumentos para o shell rodar o CLI e, quando ele terminar, continuar aberto
// No CMD devolve uma string já montada: o node-pty não sabe aplicar as regras de aspas do cmd.exe.
//   /d  ignora scripts AutoRun   /s  remove só a primeira e a última aspa do que vem depois
//   /k  roda o comando e mantém o terminal aberto   chcp 65001  UTF-8 para acentos
function runThenStay (shell, line) {
  if (shell.kind === 'powershell') return ['-NoExit', '-Command', line]
  if (shell.kind === 'cmd') return `/d /s /k "chcp 65001>nul & ${line}"`
  return ['-c', `${line}; exec ${shell.file} -l`]
}

function guessKind (file) {
  return /pwsh|powershell/i.test(file) ? 'powershell' : /cmd(\.exe)?$/i.test(file) ? 'cmd' : 'posix'
}

// Aspas seguras para cada tipo de shell
function quote (arg, kind) {
  const s = String(arg)
  if (kind === 'powershell') return `'${s.replace(/'/g, "''")}'`
  // CMD: entre aspas duplas; aspas internas viram "" e quebras de linha viram espaço
  if (kind === 'cmd') return `"${s.replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`
  return `'${s.replace(/'/g, "'\\''")}'`
}

function commandLine (bin, args, kind) {
  const line = [bin, ...args.map(a => quote(a, kind))].join(' ')
  return kind === 'powershell' ? `& ${line}` : line
}

// Procura o executável do CLI no PATH (where no Windows, which nos demais)
function findCli (bin) {
  try {
    const out = execFileSync(isWin ? 'where.exe' : 'which', [bin], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    const found = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    // No Windows, prefere .exe/.cmd: evita o .ps1, que a política de execução do PowerShell pode bloquear
    if (isWin) return found.find(f => /\.(exe|cmd|bat)$/i.test(f)) || found[0] || null
    return found[0] || null
  } catch {
    return null
  }
}

/**
 * Verifica, antes de criar sessão/aba, se dá para abrir o terminal:
 * 1. o CLI do motor está instalado e no PATH
 * 2. o shell existe
 * Lança um erro com instrução de como resolver.
 */
function preflight (engine, configuredShell) {
  const spec = getEngine(engine)
  const bin = spec.command
  const cli = findCli(bin)
  if (!cli) {
    throw new Error(`O comando "${bin}" não foi encontrado no PATH. Instale com: ${spec.install} (depois feche e abra o cli-context-hub).`)
  }
  const shell = defaultShell(configuredShell)
  const shellIsPath = /[\\/]/.test(shell.file)
  if (!(shellIsPath ? require('node:fs').existsSync(shell.file) : findCli(shell.file))) {
    throw new Error(`Shell "${shell.file}" não encontrado. Ajuste terminal.shell no settings.yaml.`)
  }
  if (spec.requiredFlags) {
    let help
    try {
      help = isWin
        ? execFileSync(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
          ['/d', '/s', '/c', `""${cli}" --help"`],
          { encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true, timeout: 20000 })
        : execFileSync(cli, ['--help'], { encoding: 'utf8', timeout: 20000 })
    } catch (error) {
      throw new Error(`Não foi possível verificar ${bin} --help: ${error.message}`)
    }
    if (spec.requiredFlags.some(flag => !help.includes(flag))) {
      throw new Error(`${spec.label} instalado não suporta os argumentos necessários para sessões. Atualize com: ${spec.install}`)
    }
  }
  return { cli, shell: shell.file }
}

function createTerminalManager ({ onData, onExit, getSettings = () => ({}) }) {
  const terms = new Map()
  let seq = 0

  // cliPath: caminho completo encontrado no preflight (se ausente, usa o nome e deixa o shell resolver)
  function start ({ cwd, engine, engineArgs, cliPath, env = {}, meta = {} }) {
    const shell = defaultShell(getSettings().terminal?.shell)
    const id = `t${++seq}`
    const bin = cliPath ? quote(cliPath, shell.kind) : getEngine(engine).command
    const line = commandLine(bin, engineArgs, shell.kind)
    let p
    try {
      const extra = runThenStay(shell, line)
      const args = typeof extra === 'string' ? [...shell.args, extra].join(' ') : [...shell.args, ...extra]
      p = pty.spawn(shell.file, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: cwd || os.homedir(),
      env: { ...process.env, ...env, WORKSPACE_HUB: '1' }
      })
    } catch (e) {
      throw new Error(`Falha ao abrir o terminal (${shell.file}): ${e.message}`)
    }
    terms.set(id, { pty: p, meta })
    p.onData(data => onData(id, data))
    p.onExit(({ exitCode }) => { terms.delete(id); onExit(id, exitCode) })

    return { id, command: line }
  }

  return {
    start,
    write: (id, data) => terms.get(id)?.pty.write(data),
    resize: (id, cols, rows) => { try { terms.get(id)?.pty.resize(cols, rows) } catch {} },
    kill: id => {
      try { terms.get(id)?.pty.kill() } catch (error) {
        throw new Error(`Falha ao encerrar terminal ${id}: ${error.message}`)
      }
    },
    killAll: () => { for (const id of terms.keys()) { try { terms.get(id).pty.kill() } catch {} } }
  }
}

module.exports = {
  createTerminalManager, preflight, findCli, defaultShell, buildEngineArgs,
  engineEnvironment, browserCdpEnvironment, commandLine, quote
}
