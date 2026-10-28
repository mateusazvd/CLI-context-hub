// Cadastro único dos CLIs. A interface recebe somente os metadados via IPC.
const ENGINE_REGISTRY = {
  claude: {
    label: 'Claude', sub: 'Claude Code CLI', command: 'claude',
    install: 'npm install -g @anthropic-ai/claude-code',
    directoryFlag: '--add-dir', nameFlag: '--name', promptFlag: null,
    usage: 'statusline', resumable: true
  },
  copilot: {
    label: 'Copilot', sub: 'GitHub Copilot CLI', command: 'copilot',
    install: 'npm install -g @github/copilot',
    directoryFlag: '--add-dir', nameFlag: '--name', promptFlag: '-i',
    usage: 'probe', resumable: true
  },
  gemini: {
    label: 'Gemini', sub: 'Gemini CLI', command: 'gemini',
    install: 'npm install -g @google/gemini-cli@latest',
    directoryFlag: '--include-directories', nameFlag: null, promptFlag: '--prompt-interactive',
    usage: 'probe', usageCommand: '/model',
    requiredFlags: ['--session-id', '--resume', '--prompt-interactive', '--include-directories', '--screen-reader', '--skip-trust']
  },
  codex: {
    label: 'Codex', sub: 'OpenAI Codex CLI', command: 'codex',
    install: 'npm install -g @openai/codex',
    directoryFlag: '--add-dir', nameFlag: null, promptFlag: null,
    usage: null, requiredFlags: ['start', '--no-daemon'],
    env: { CODEX_CA_CERTIFICATE: 'C:\\Program Files\\Git\\mingw64\\etc\\ssl\\certs\\ca-bundle.crt', CODEX_APPROVAL_POLICY: 'workspace-write' }
  },
  // bare: só abre o CLI na pasta da sessão (sem ID de sessão, prompt, modelo nem skills).
  // O `ollama` sem argumentos mostra o menu dele para escolher modelo/integração.
  ollama: {
    label: 'Ollama', sub: 'Ollama CLI (menu interativo)', command: 'ollama',
    install: 'baixe em https://ollama.com/download',
    usage: null, bare: true
  }
}

const ENGINES = Object.keys(ENGINE_REGISTRY)

// Só motores com `resumable: true` podem retomar uma aba existente (por enquanto Claude e Copilot).
function canResume (id) {
  return Boolean(getEngine(id).resumable)
}

function getEngine (id) {
  if (!Object.hasOwn(ENGINE_REGISTRY, id)) throw new Error(`Motor desconhecido: ${id}`)
  return ENGINE_REGISTRY[id]
}

function enabledEngines (settings) {
  return settings.engine?.enabled || ENGINES
}

function buildEngineArgs ({ engine, sessionId, resume, name, addDirs = [], prompt, model, extraArgs = [] }) {
  const spec = getEngine(engine)
  if (!Array.isArray(extraArgs) || extraArgs.some(arg => typeof arg !== 'string')) {
    throw new Error(`Argumentos extras inválidos para ${engine}: use uma lista de textos.`)
  }
  if (spec.bare) return [...extraArgs]
  const args = []
  if (engine === 'codex') {
    if (prompt) {
      args.push('--no-daemon')
    } else {
      args.push('start', '--no-daemon')
    }
  }
  if (prompt && !spec.promptFlag) args.push(prompt)
  if (engine !== 'codex') args.push(resume ? '--resume' : '--session-id', sessionId)
  if (name && !resume && spec.nameFlag) args.push(spec.nameFlag, name)
  for (const dir of addDirs) args.push(spec.directoryFlag, dir)
  if (model) args.push('--model', model)
  if (prompt && spec.promptFlag) args.push(spec.promptFlag, prompt)
  return [...args, ...extraArgs]
}

function engineEnvironment (engine) {
  return { ...(getEngine(engine).env || {}) }
}

module.exports = { ENGINE_REGISTRY, ENGINES, getEngine, canResume, enabledEngines, buildEngineArgs, engineEnvironment }
