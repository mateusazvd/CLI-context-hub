// Renderer (o "salão"): desenha a tela e pede tudo ao processo principal via window.hub.
const $ = sel => document.querySelector(sel)
const el = (tag, props = {}, ...children) => {
  const n = Object.assign(document.createElement(tag), props)
  for (const c of children.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c))
  return n
}

// ── Tema claro/escuro ──
const savedTheme = localStorage.getItem('hub-theme') || 'dark'
document.documentElement.dataset.theme = savedTheme

const ENGINE = {}

// SVG logos dos engines — paths oficiais do Simple Icons (simpleicons.org)
// Anthropic (Claude), GitHub Copilot, Google Gemini, Ollama, OpenAI (Codex)
const ENGINE_LOGO = {
  claude: { viewBox: '0 0 24 24', path: 'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z' },
  copilot: { viewBox: '0 0 24 24', path: 'M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z' },
  gemini: { viewBox: '0 0 24 24', path: 'M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81' },
  ollama: { viewBox: '0 0 24 24', path: 'M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.375-1.451.557-2.403.557-1.009 0-1.871-.259-2.493-.734-.617-.47-.963-1.13-.963-1.845 0-.707.398-1.417 1.056-1.946.668-.537 1.55-.849 2.485-.849zm0 .896a3.07 3.07 0 00-1.916.65c-.461.37-.722.835-.722 1.25 0 .428.21.829.61 1.134.455.347 1.124.548 1.943.548.799 0 1.473-.147 1.932-.426.463-.28.7-.686.7-1.257 0-.423-.246-.89-.683-1.256-.484-.405-1.14-.643-1.864-.643zm.662 1.21l.004.004c.12.151.095.37-.056.49l-.292.23v.446a.375.375 0 01-.376.373.375.375 0 01-.376-.373v-.46l-.271-.218a.347.347 0 01-.052-.49.353.353 0 01.494-.051l.215.172.22-.174a.353.353 0 01.49.051zm-5.04-1.919c.478 0 .867.39.867.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zm8.706 0c.48 0 .868.39.868.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zM7.44 2.3l-.003.002a.659.659 0 00-.285.238l-.005.006c-.138.189-.258.467-.348.832-.17.692-.216 1.631-.124 2.782.43-.128.899-.208 1.404-.237l.01-.001.019-.034c.046-.082.095-.161.148-.239.123-.771.022-1.692-.253-2.444-.134-.364-.297-.65-.453-.813a.628.628 0 00-.107-.09L7.44 2.3zm9.174.04l-.002.001a.628.628 0 00-.107.09c-.156.163-.32.45-.453.814-.29.794-.387 1.776-.23 2.572l.058.097.008.014h.03a5.184 5.184 0 011.466.212c.086-1.124.038-2.043-.128-2.722-.09-.365-.21-.643-.349-.832l-.004-.006a.659.659 0 00-.285-.239h-.004z' },
  codex: { viewBox: '0 0 24 24', path: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z' }
}
function engineIcon (engine, size = 14) {
  const logo = ENGINE_LOGO[engine]
  if (!logo) return el('span', { className: `tab-dot dot-${engine}` })
  const wrapper = document.createElement('span')
  wrapper.className = `engine-icon icon-${engine}`
  wrapper.innerHTML = `<svg viewBox="${logo.viewBox}" width="${size}" height="${size}" fill="currentColor">${`<path d="${logo.path}"/>`}</svg>`
  return wrapper
}

async function refreshEngines () {
  const engines = await window.hub.listEngines()
  for (const engine of engines) ENGINE[engine.id] = engine
}

const activeEngines = () => Object.keys(ENGINE).filter(id => ENGINE[id].enabled)

const state = {
  harnesses: [],
  miniapps: [],
  selected: null,          // nome do harness selecionado
  sessions: [],
  tabs: new Map(),         // termId -> aba
  activeTab: null,
  pendingData: new Map()   // dados que chegaram antes da aba existir
}

// ---------- utilidades ----------
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
}

function initials (title) {
  return title.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

function relTime (iso) {
  if (!iso) return '—'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (isNaN(s)) return iso
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

// Mensagens: sucesso some sozinho; erro fica até ser fechado (para dar tempo de ler/copiar)
let toastTimer
function toast (msg, kind = 'error') {
  const t = $('#toast')
  $('#toast-msg').textContent = msg
  t.classList.toggle('ok', kind === 'ok')
  t.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.add('hidden'), kind === 'ok' ? 2500 : 5000)
}
const cleanError = e => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function showView (name) {
  if (name !== 'settings' && !$('#view-settings').classList.contains('hidden') && Object.keys(settingsDraft.changes).length) {
    toast('Alterações nas configurações não foram salvas e foram descartadas.')
    settingsDraft.changes = {}
  }
  for (const v of ['empty', 'launcher', 'settings', 'terms']) $(`#view-${v}`).classList.toggle('hidden', v !== name)
  $('#btn-settings').classList.toggle('active', name === 'settings')
  if (name === 'settings') document.querySelectorAll('.h-item.active:not(.settings-btn)').forEach(b => b.classList.remove('active'))
  else renderHarnessList()
  if (name === 'terms') fitActive()
  if (typeof applyExplorerLayout === 'function') applyExplorerLayout()
}

// ---------- menu ----------
const sidebar = {
  pinned: store.get('sidebar.pinned', false),
  collapsed: store.get('sidebar.collapsed', false),
  apply () {
    $('#sidebar').classList.toggle('collapsed', this.collapsed)
    $('#btn-pin').classList.toggle('on', this.pinned)
    $('#btn-pin').title = this.pinned ? 'Menu fixado (clique para soltar)' : 'Fixar menu aberto'
    store.set('sidebar.pinned', this.pinned)
    store.set('sidebar.collapsed', this.collapsed)
    setTimeout(fitActive, 170)
  },
  toggle () { this.collapsed = !this.collapsed; this.apply() },
  togglePin () { this.pinned = !this.pinned; if (this.pinned) this.collapsed = false; this.apply() },
  autoCollapse () { if (!this.pinned) { this.collapsed = true; this.apply() } }
}

async function createHarnessDialog () {
  const name = el('input', { className: 'modal-input', placeholder: 'nome-do-harness', maxlength: 50 })
  const title = el('input', { className: 'modal-input', placeholder: 'Nome amigável', maxlength: 80 })
  const description = el('textarea', { className: 'modal-input modal-textarea', placeholder: 'Para que este harness serve?', maxlength: 240 })
  const ok = await confirmDialog({
    title: 'Criar novo harness',
    confirmLabel: 'Criar harness',
    cancelLabel: 'Cancelar',
    danger: false,
    body: [
      el('p', {}, 'O novo harness será criado a partir do template padrão, incluindo AGENTS.md, skills, agentes, comandos, MCP, contexts e sessões.'),
      el('label', { className: 'modal-field' }, el('span', {}, 'Nome da pasta'), name),
      el('label', { className: 'modal-field' }, el('span', {}, 'Título'), title),
      el('label', { className: 'modal-field' }, el('span', {}, 'Descrição'), description)
    ]
  })
  if (!ok) return
  if (!name.value.trim() || !title.value.trim()) {
    toast('Informe o nome da pasta e o título do harness.')
    return
  }
  try {
    const created = await window.hub.createHarness({
      name: name.value,
      title: title.value,
      description: description.value
    })
    await refreshHarnesses()
    renderHarnessList()
    await selectHarness(created.name)
    toast(`Harness "${created.title}" criado`, 'ok')
  } catch (e) {
    toast(cleanError(e))
  }
}

function renderHarnessList () {
  const nav = $('#harness-list')
  nav.replaceChildren()
  if (!state.harnesses.length) {
    nav.append(el('div', { className: 's-empty', style: 'padding:8px' }, 'Nenhum harness encontrado.'))
    return
  }

  for (const h of state.harnesses) {
    const b = el('button', { className: 'h-item' + (h.name === state.selected ? ' active' : ''), title: h.title },
      el('span', { className: 'h-avatar' }, initials(h.title)),
      el('span', { className: 'h-text' },
        el('span', { className: 'h-title' }, h.title),
        el('span', { className: 'h-sub' }, h.name)))
    b.onclick = () => selectHarness(h.name)
    nav.append(b)
  }
}

function renderMiniappCatalog (query = '') {
  const grid = $('#miniapps-grid')
  const normalized = query.trim().toLocaleLowerCase('pt-BR')
  const matches = state.miniapps.filter(miniapp =>
    !normalized ||
    miniapp.title.toLocaleLowerCase('pt-BR').includes(normalized) ||
    miniapp.name.toLocaleLowerCase('pt-BR').includes(normalized) ||
    miniapp.description.toLocaleLowerCase('pt-BR').includes(normalized))
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))

  grid.replaceChildren()
  if (!matches.length) {
    grid.append(el('div', { className: 'miniapps-empty' },
      state.miniapps.length ? 'Nenhum miniapp encontrado.' : 'Nenhum miniapp instalado.'))
    return
  }

  for (const miniapp of matches) {
    const card = el('button', { className: 'miniapp-card', title: `Abrir ${miniapp.title}` },
      el('span', { className: 'miniapp-card-icon' }, '▦'),
      el('span', { className: 'miniapp-card-content' },
        el('strong', {}, miniapp.title),
        el('span', {}, miniapp.description || miniapp.name),
        el('small', {}, `v${miniapp.version}`)))
    card.onclick = async () => {
      try {
        await window.hub.openMiniapp(miniapp.name)
        closeMiniappCatalog()
      } catch (error) {
        toast(cleanError(error))
      }
    }
    grid.append(card)
  }
}

async function openMiniappCatalog () {
  const modal = $('#miniapps-modal')
  const search = $('#miniapps-search')
  search.value = ''
  try { state.miniapps = await window.hub.listMiniapps() } catch {}
  renderMiniappCatalog()
  modal.classList.remove('hidden')
  search.focus()
  // esconde a WebContentsView do navegador para não ficar por cima do modal
  window.hub.hideBrowser()
}

function closeMiniappCatalog () {
  $('#miniapps-modal').classList.add('hidden')
  // restaura o navegador se estava ativo
  const t = state.tabs.get(state.activeTab)
  if (t && t.view === BROWSER_REL && browserDrawing) {
    requestAnimationFrame(() => showBrowserView())
  }
}

// ---------- launcher ----------
async function refreshHarnesses () {
  try {
    const [data] = await Promise.all([window.hub.listHarnesses(), refreshEngines()])
    state.harnesses = data.harnesses
  } catch (error) { toast(cleanError(error)) }
}

async function selectHarness (name) {
  await refreshHarnesses()
  state.selected = name
  store.set('harness.selected', name)
  renderHarnessList()
  await renderLauncher()
  showView('launcher')
  $('#new-title').focus()
}

async function renderLauncher () {
  const h = state.harnesses.find(x => x.name === state.selected)
  if (!h) return
  $('#launcher-title').textContent = h.title
  $('#launcher-desc').textContent = h.description || ''
  $('#launcher-warn').textContent = h.workdirWarning || ''
  $('#launcher-warn').classList.toggle('hidden', !h.workdirWarning)
  $('#harness-workdir').value = h.workdir || h.path

  // cartões de motor
  const box = $('#new-engines')
  box.replaceChildren()
  for (const engine of activeEngines()) {
    const supported = h.engines.supported.includes(engine)
    const card = el('button', { className: `engine-card ${engine}`, disabled: !supported },
      el('span', { className: 'e-name' },
        engineIcon(engine), ENGINE[engine].label,
        h.engines.default === engine
          ? el('span', { className: 'e-default', title: h.engines.defaultFrom === 'harness' ? 'Definido no harness.yaml' : 'Definido em settings.yaml' }, 'padrão')
          : null),
      el('span', { className: 'e-sub' }, supported ? `Iniciar nova sessão com o ${ENGINE[engine].sub}` : 'Não suportado por este harness'))
    card.onclick = () => openSession({ harness: h.name, newSession: { title: $('#new-title').value, workdir: $('#new-workdir').value.trim() || null }, engine })
    box.append(card)
  }
  if (!h.engines.supported.length) {
    box.append(el('p', { className: 'hint' }, 'Nenhum CLI ativo é suportado por este harness. Ajuste as Configurações ou engines.supported no harness.yaml.'))
  }

  // sessões anteriores
  const list = $('#session-list')
  list.replaceChildren(el('div', { className: 's-empty' }, 'Carregando…'))
  try {
    state.sessions = await window.hub.listSessions(h.name)
  } catch (e) {
    state.sessions = []
    toast(e.message)
  }
  list.replaceChildren()
  if (!state.sessions.length) {
    list.append(el('div', { className: 's-empty' }, 'Nenhuma sessão ainda. Crie a primeira acima.'))
    return
  }
  for (const s of state.sessions) list.append(sessionCard(h, s))
}

function sessionCard (h, s) {
  const card = el('div', { className: 's-card' })
  const head = el('button', { className: 's-head' },
    el('div', { className: 's-main' },
      el('div', { className: 's-title' }, s.title),
      el('div', { className: 's-meta' },
        `${s.id} · atualizada ${relTime(s.updated)}`),
      s.topics?.length
        ? el('div', { className: 's-topics' }, s.topics.map(topic => el('span', { className: 's-topic' }, topic)))
        : null),
    el('div', { className: 's-chips' }, [...new Map(s.tabs.map(t => [t.engine, t])).values()].map(t => { const icon = engineIcon(t.engine, 10); icon.title = t.engine; icon.classList.add('s-chip'); return icon })),
    el('span', { className: `s-badge ${s.status}` }, s.status),
    el('button', { className: 's-del', title: 'Excluir sessão', ariaLabel: `Excluir sessão ${s.title}`, onclick: e => { e.stopPropagation(); deleteSession(h, s) } }, '🗑'))
  head.onclick = () => card.classList.toggle('open')

  // só a aba mais recente de cada engine retomável
  const resumableTabs = s.tabs.filter(t => ENGINE[t.engine]?.resumable)
  const latestByEngine = [...resumableTabs
    .sort((a, b) => String(b.last_used).localeCompare(String(a.last_used)))
    .reduce((m, t) => m.has(t.engine) ? m : m.set(t.engine, t), new Map())
    .values()]
  const resumeRow = el('div', { className: 's-actions' },
    latestByEngine.length
      ? latestByEngine.map(t => {
          const supported = h.engines.supported.includes(t.engine)
          const b = el('button', { className: 'btn', disabled: !supported,
            title: supported ? `session_id ${t.session_id}\n${t.workdir}` : 'CLI desativado ou não suportado pelo harness' },
            engineIcon(t.engine),
            `Retomar ${ENGINE[t.engine]?.label || t.engine}`,
            el('span', { className: 's-meta' }, relTime(t.last_used)))
          b.onclick = () => openSession({ harness: h.name, sessionId: s.id, tabId: t.id })
          return b
        })
      : el('span', { className: 's-meta' }, s.tabs.length ? 'Nenhuma aba para retomar.' : 'Nenhuma aba ainda.'))

  const newRow = el('div', { className: 's-actions' },
    h.engines.supported.map(engine => {
      const b = el('button', { className: 'btn ghost' }, engineIcon(engine), `+ nova aba ${ENGINE[engine].label}`)
      b.onclick = () => openSession({ harness: h.name, sessionId: s.id, engine })
      return b
    }))

  card.append(head, el('div', { className: 's-body' },
    el('div', { className: 's-row-title' }, 'Retomar'), resumeRow,
    el('div', { className: 's-row-title' }, 'Adicionar à sessão'), newRow))
  return card
}

// ---------- mini-dashboard de uso ----------
let usageState = null
const STATUS_TEXT = {
  unsupported: 'sem integração de uso',
  free: 'free',
  'quota-unavailable': 'cota no AI Studio',
  'not-installed': 'não instalado',
  waiting: 'aguardando uso',
  unparsed: 'sem leitura',
  error: 'erro'
}

function renderUsage (st) {
  usageState = st || usageState
  const st2 = usageState || { engines: {} }
  // atualização silenciosa, em segundo plano: só mostra quando foi a última leitura
  $('#usage-time').textContent = st2.updatedAt ? relTime(st2.updatedAt) : ''

  const body = $('#usage-body')
  body.replaceChildren()
  const mini = el('div', { className: 'u-mini' })
  const shown = activeEngines().filter(engine => !ENGINE[engine].usageHidden)
  $('#usage').classList.toggle('hidden', !shown.length)
  for (const engine of shown) {
    const e = st2.engines?.[engine]
    const items = e?.items || []
    const status = engine === 'gemini' ? STATUS_TEXT.free
      : !ENGINE[engine].usage ? STATUS_TEXT.unsupported
      : !e ? 'aguardando' : e.staleSince ? 'dados antigos' : (STATUS_TEXT[e.status] || (e.checkedAt ? relTime(e.checkedAt) : ''))
    const btn = el('button', { className: 'u-engine', title: 'Ver detalhes' },
      el('div', { className: 'u-name' },
        engineIcon(engine), ENGINE[engine].label,
        el('span', { className: 'u-status' + (e && !['ok', 'quota-unavailable', 'free'].includes(e.status) ? ' warn' : '') }, status)),
      items.map(it => {
        const pct = it.percent == null ? null : Math.max(0, Math.min(100, it.percent))
        return el('div', { className: 'u-row' },
          el('span', {}, it.label),
          el('span', { className: 'u-pct' }, pct == null ? '—' : `${it.percent}%`),
          el('div', { className: 'u-bar' }, el('div', {
            className: `u-fill ${engine}` + (pct >= 100 ? ' full' : pct >= 80 ? ' high' : ''),
            style: `width:${pct ?? 0}%`
          })),
          it.resets || it.detail ? el('span', { className: 'u-reset', title: [it.detail, it.resets && `Reseta ${it.resets}`].filter(Boolean).join(' · ') },
            [it.detail, it.resets && `reseta ${it.resets}`].filter(Boolean).join(' · ')) : null)
      }))
    btn.onclick = () => showUsageDetails(engine)
    body.append(btn)

    // versão recolhida: anel com o maior percentual
    const top = items.reduce((m, it) => Math.max(m, it.percent ?? 0), 0)
    const color = `var(--${engine}, var(--accent))`
    mini.append(el('div', {
      className: 'u-ring',
      title: `${ENGINE[engine].label}: ${items.map(i => `${i.label} ${i.percent ?? '—'}%`).join(' · ') || status}`,
      style: `background: conic-gradient(${color} ${top * 3.6}deg, var(--line) 0)`
    }, el('span', {}, items.length ? `${Math.round(top)}` : '·')))
  }
  body.append(mini)
}

function showUsageDetails (engine) {
  const e = usageState?.engines?.[engine]
  const geminiFree = engine === 'gemini'
  const unavailable = geminiFree && e?.status === 'quota-unavailable'
  confirmDialog({
    title: `Uso · ${ENGINE[engine].label}`,
    confirmLabel: unavailable ? 'Abrir Google AI Studio' : geminiFree ? 'Fechar' : 'Atualizar agora',
    cancelLabel: 'Fechar',
    danger: false,
    body: [
      el('p', {}, e ? `Última verificação: ${e.checkedAt ? new Date(e.checkedAt).toLocaleString('pt-BR') : '—'}` : 'Ainda não verificado.'),
      engine === 'gemini' ? el('p', {}, 'Modelo: free. O HarnessHub não calcula uso ou cota do Gemini.') : null,
      e?.message ? el('p', {}, e.message) : null,
      e?.staleSince ? el('p', {}, `Os números exibidos são antigos, obtidos em ${new Date(e.staleSince).toLocaleString('pt-BR')}. A última tentativa não os atualizou.`) : null,
      e?.error ? el('p', {}, el('strong', {}, `Erro: ${e.error}`)) : null,
      e?.source === 'statusline' ? el('p', {}, 'Fonte: statusline do Claude. Os números são atualizados a cada resposta nas abas do Claude abertas pelo harness-hub.') : null,
      engine === 'claude' && e?.status === 'waiting' ? el('p', {}, 'Ainda sem dados: abra uma aba do Claude pelo harness-hub e envie uma mensagem.') : null,
      e?.status === 'unparsed' && !e.message ? el('p', {}, 'Não consegui interpretar a resposta. Abaixo está o que foi recebido.') : null,
      e?.raw ? el('pre', { className: 'raw' }, e.raw) : null
    ].filter(Boolean)
  }).then(ok => {
    if (!ok) return
    return unavailable
      ? window.hub.openExternal('https://aistudio.google.com/usage')
      : geminiFree ? undefined : window.hub.refreshUsage()
  }).catch(error => toast(cleanError(error)))
}

// ---------- explorador de arquivos (pasta files/ do harness) ----------
const FILE_ICON = {
  md: '📝', txt: '📄', json: '🧾', yaml: '⚙', yml: '⚙', js: '🟨', ts: '🟦', jsx: '⚛', tsx: '⚛', py: '🐍', sql: '🗄',
  html: '🌐', css: '🎨', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', svg: '🖼', pdf: '📕', csv: '📊', xlsx: '📊', docx: '📘', zip: '🗜'
}
// ícone de pasta em SVG (cinza; aberta em vermelho), no lugar do emoji amarelo
const FOLDER_SVG = {
  closed: '<path d="M1.5 4a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>',
  open: '<path d="M1.5 12V4a1 1 0 0 1 1-1h3.6l1.4 1.5h5a1 1 0 0 1 1 1V7"/><path d="M1.5 12.5 3.4 7.6a1 1 0 0 1 .93-.6H14.3a.6.6 0 0 1 .56.82L13.2 12.4a1 1 0 0 1-.93.6H2a.5.5 0 0 1-.5-.5z"/>'
}
function folderIcon (open = false) {
  const span = el('span', { className: `ex-folder${open ? ' open' : ''}` })
  span.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">${FOLDER_SVG[open ? 'open' : 'closed']}</svg>`
  return span
}
const explorer = {
  open: store.get('explorer.open', true),
  width: store.get('explorer.width', 280),
  harness: null,              // harness mostrado
  expanded: new Map(),        // harness -> Set de pastas abertas (rel)
  cache: new Map(),           // `${harness}|${rel}` -> entries
  changed: new Map(),         // `${harness}|${rel}` -> momento da mudança
  selected: null,
  creating: null,             // caixa de nome de arquivo/pasta novo: { parent, dir, value, error, sel, focus }
  renaming: null,             // caixa de renomear: { rel, type, value, error, sel, focus, busy }
  createInput: null,
  rerendering: false
}

function exKey (h, rel) { return `${h}|${rel}` }
function exExpanded (h) {
  if (!explorer.expanded.has(h)) explorer.expanded.set(h, new Set(store.get(`explorer.expanded.${h}`, [])))
  return explorer.expanded.get(h)
}
function saveExpanded (h) { store.set(`explorer.expanded.${h}`, [...exExpanded(h)]) }

function applyExplorerLayout () {
  const show = explorer.open && !!explorer.harness && !$('#view-terms').classList.contains('hidden')
  $('#explorer').classList.toggle('hidden', !show)
  $('#btn-explorer').classList.toggle('on', explorer.open)
  $('#explorer').style.setProperty('--ex-w', `${explorer.width}px`)
  requestAnimationFrame(fitActive)
}

async function loadDir (h, rel) {
  const res = await window.hub.listFiles(h, rel)
  explorer.cache.set(exKey(h, rel), res.entries)
  if (!rel) $('#ex-root').dataset.path = res.root
  return res.entries
}

// Mostra o explorador do harness da aba ativa
async function showExplorerFor (harnessName) {
  if (explorer.harness !== harnessName) {
    explorer.harness = harnessName
    explorer.selected = null
    const h = state.harnesses.find(x => x.name === harnessName)
    $('#ex-root').textContent = `${h?.title || harnessName} / contexts`
    try {
      await loadDir(harnessName, '')
      for (const rel of exExpanded(harnessName)) { try { await loadDir(harnessName, rel) } catch { exExpanded(harnessName).delete(rel) } }
    } catch (e) { toast(cleanError(e)) }
  }
  renderExplorer()
  applyExplorerLayout()
}

function renderExplorer () {
  const h = explorer.harness
  const tree = $('#ex-tree')
  if (!h) { tree.replaceChildren(); return }
  const now = Date.now()
  const rows = []
  explorer.createInput = null
  const walk = (rel, depth) => {
    const entries = explorer.cache.get(exKey(h, rel)) || []
    if (explorer.creating?.parent === rel) rows.push(...createRows(depth))
    for (const it of entries) {
      const isOpen = it.type === 'dir' && exExpanded(h).has(it.rel)
      if (explorer.renaming?.rel === it.rel) {
        rows.push(...renameRows(it, depth, isOpen))
        if (isOpen) walk(it.rel, depth + 1)
        continue
      }
      const ext = it.name.includes('.') ? it.name.split('.').pop().toLowerCase() : ''
      const changedAt = explorer.changed.get(exKey(h, it.rel))
      const row = el('div', {
        className: `ex-row ${it.type}` + (explorer.selected === it.rel ? ' selected' : '') + (changedAt && now - changedAt < 60000 ? ' changed' : ''),
        role: 'treeitem', tabIndex: -1, title: it.rel,
        style: `padding-left:${8 + depth * 14}px`
      },
      el('span', { className: 'ex-chev' }, it.type === 'dir' ? (isOpen ? '▾' : '▸') : ''),
      el('span', { className: 'ex-icon' }, it.type === 'dir' ? folderIcon(isOpen) : (FILE_ICON[ext] || '📄')),
      el('span', { className: 'ex-name' }, it.name))
      if (it.type === 'dir') row.ariaExpanded = String(isOpen)
      // ---------- drag-and-drop ----------
      row.draggable = true
      row.dataset.rel = it.rel
      row.dataset.type = it.type
      row.ondragstart = e => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/x-explorer-rel', it.rel)
        e.dataTransfer.setData('text/x-explorer-type', it.type)
        row.classList.add('dragging')
        explorer._dragRel = it.rel
      }
      row.ondragend = () => { row.classList.remove('dragging'); explorer._dragRel = null }
      if (it.type === 'dir') {
        let expandTimer = null
        row.ondragover = e => {
          const srcRel = explorer._dragRel ?? (e.dataTransfer.types.includes('Files') ? '__external__' : null)
          if (!srcRel) return
          // não permitir soltar dentro de si mesma
          if (srcRel !== '__external__' && (srcRel === it.rel || it.rel.startsWith(srcRel + '/'))) return
          e.preventDefault()
          e.dataTransfer.dropEffect = srcRel === '__external__' ? 'copy' : 'move'
          row.classList.add('drag-over')
          // auto-expandir pasta colapsada após 600ms de hover (como no VS Code)
          if (!isOpen && !expandTimer) {
            expandTimer = setTimeout(async () => {
              exExpanded(h).add(it.rel)
              saveExpanded(h)
              try { await loadDir(h, it.rel) } catch {}
              renderExplorer()
            }, 600)
          }
        }
        row.ondragleave = e => {
          if (!row.contains(e.relatedTarget)) { row.classList.remove('drag-over'); clearTimeout(expandTimer); expandTimer = null }
        }
        row.ondrop = e => {
          e.preventDefault()
          row.classList.remove('drag-over')
          clearTimeout(expandTimer); expandTimer = null
          handleExplorerDrop(e, it.rel)
        }
      }
      // ---------- fim drag-and-drop ----------
      row.onclick = () => onExplorerClick(it)
      row.ondblclick = () => {
        if (it.type !== 'file') return
        const t = state.tabs.get(state.activeTab)
        if (DRAW_RE.test(it.name) && t && t.harness.name === h) openDrawing(t, it.rel)
        else if (MD_RE.test(it.name) && t && t.harness.name === h) openMarkdown(t, it.rel)
        else if (SVG_RE.test(it.name) && t && t.harness.name === h) openSvg(t, it.rel)
        else if (HTML_RE.test(it.name) && t && t.harness.name === h) openHtml(t, it.rel)
        else if (MATHNOTE_RE.test(it.name) && t && t.harness.name === h) openMathnote(t, it.rel)
        else if (PDF_RE.test(it.name) && t && t.harness.name === h) openPdf(t, it.rel)
        else if (JSON_RE.test(it.name) && !PATCH_RE.test(it.name) && t && t.harness.name === h) openJson(t, it.rel)
        else window.hub.openFile(h, it.rel).catch(e => toast(cleanError(e)))
      }
      row.oncontextmenu = e => { e.preventDefault(); explorer.selected = it.rel; renderExplorer(); showContextMenu(e.clientX, e.clientY, it) }
      rows.push(row)
      if (isOpen) walk(it.rel, depth + 1)
    }
  }
  walk('', 0)
  if (!rows.length) rows.push(el('div', { className: 'ex-empty' }, 'Pasta vazia. Tudo que os modelos criarem nesta pasta aparece aqui.'))
  // a árvore é redesenhada sozinha (vigia, timer): o que foi digitado na caixa de nome precisa sobreviver
  explorer.rerendering = true
  tree.replaceChildren(...rows)
  const input = explorer.createInput
  const box = explorer.creating || explorer.renaming
  if (input && box?.focus) {
    input.focus()
    input.setSelectionRange(...box.sel)
    input.scrollIntoView({ block: 'nearest' })
  }
  explorer.rerendering = false
}

// ---------- novo arquivo / nova pasta (como no VS Code) ----------
const NEW_FILE_FORMATS = [['md', 'Markdown'], ['txt', 'Texto'], ['json', 'JSON'], ['yaml', 'YAML'], ['csv', 'CSV'],
  ['js', 'JavaScript'], ['ts', 'TypeScript'], ['py', 'Python'], ['html', 'HTML'], ['css', 'CSS'], ['sql', 'SQL'], ['excalidraw', 'Desenho']]
const NEW_FILE_TEMPLATES = {
  excalidraw: () => JSON.stringify({ type: 'excalidraw', version: 2, source: 'harness-hub', elements: [], appState: {}, files: {} }),
  json: () => '{\n}\n',
  html: name => `<!doctype html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="utf-8">\n    <title>${name}</title>\n  </head>\n  <body>\n\n  </body>\n</html>\n`
}
const BAD_NAME = /[<>:"|?*\x00-\x1f]|[. ]$/
const RESERVED_NAME = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i
const parentOf = rel => rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''
const extOf = name => /\.([^./\\]+)$/.exec(name)?.[1].toLowerCase() || ''
const nameParts = value => value.trim().split(/[\\/]+/).filter(Boolean)

function findExplorerItem (rel) {
  const h = explorer.harness
  return [...explorer.cache.entries()].filter(([k]) => k.startsWith(h + '|')).flatMap(([, v]) => v).find(x => x.rel === rel)
}

// Onde criar: na pasta selecionada, na pasta do arquivo selecionado ou na raiz da files/
function targetFolder () {
  if (!explorer.selected) return ''
  const it = findExplorerItem(explorer.selected)
  return it?.type === 'dir' ? it.rel : parentOf(explorer.selected)
}

async function startCreate (parent, dir) {
  const h = explorer.harness
  if (!h) return
  const parts = parent ? parent.split('/') : []
  for (let i = 1; i <= parts.length; i++) {
    const rel = parts.slice(0, i).join('/')
    exExpanded(h).add(rel)
    if (!explorer.cache.has(exKey(h, rel))) await loadDir(h, rel).catch(() => {})
  }
  saveExpanded(h)
  explorer.renaming = null
  explorer.creating = { parent, dir, value: '', error: '', sel: [0, 0], focus: true }
  renderExplorer()
}

function cancelCreate () {
  if (!explorer.creating) return
  explorer.creating = null
  renderExplorer()
}

function validateNewName ({ value, parent }) {
  const parts = nameParts(value)
  if (!parts.length) return 'Informe um nome.'
  for (const p of parts) {
    if (p === '.' || p === '..') return 'Não use "." ou ".." como nome.'
    if (BAD_NAME.test(p)) return 'Não use < > : " | ? * nem termine o nome com ponto ou espaço.'
    if (RESERVED_NAME.test(p)) return `"${p}" é um nome reservado do Windows.`
  }
  const first = parts[0].toLowerCase()
  const clash = (explorer.cache.get(exKey(explorer.harness, parent)) || []).find(s => s.name.toLowerCase() === first)
  if (clash && (parts.length === 1 || clash.type === 'file')) return `Já existe "${clash.name}" nesta pasta.`
  return ''
}

async function commitCreate () {
  const c = explorer.creating
  if (!c || c.busy) return
  const h = explorer.harness
  c.error = validateNewName(c)
  if (c.error) { renderExplorer(); return }
  const parts = nameParts(c.value)
  const rel = [c.parent, ...parts].filter(Boolean).join('/')
  const name = parts[parts.length - 1]
  const template = c.dir ? null : NEW_FILE_TEMPLATES[extOf(name)]
  c.busy = true
  try {
    await window.hub.createEntry(h, rel, c.dir, template ? template(name.replace(/\.[^.]+$/, '')) : '')
  } catch (e) {
    c.busy = false
    c.error = cleanError(e)
    renderExplorer()
    return
  }
  explorer.creating = null
  let folder = c.parent
  await loadDir(h, folder).catch(() => {})
  for (const p of parts.slice(0, -1)) {
    folder = folder ? `${folder}/${p}` : p
    exExpanded(h).add(folder)
    await loadDir(h, folder).catch(() => {})
  }
  saveExpanded(h)
  explorer.selected = rel
  explorer.changed.set(exKey(h, rel), Date.now())
  renderExplorer()
  if (c.dir) return
  const t = state.tabs.get(state.activeTab)
  const here = t && t.harness.name === h
  if (here && DRAW_RE.test(name)) openDrawing(t, rel, { activate: true })
  else if (here && MD_RE.test(name)) openMarkdown(t, rel, { mode: 'edit' }).then(d => d && d.mode !== 'edit' && setMdMode(t, d, 'edit'))
  else if (here && SVG_RE.test(name)) openSvg(t, rel, { activate: true })
  else if (here && HTML_RE.test(name)) openHtml(t, rel, { activate: true })
  else if (here && MATHNOTE_RE.test(name)) openMathnote(t, rel, { activate: true })
  else if (here && PDF_RE.test(name)) openPdf(t, rel, { activate: true })
  else if (here && JSON_RE.test(name) && !PATCH_RE.test(name)) openJson(t, rel, { activate: true })
  else toast(`"${name}" criado. Clique duplo abre no programa padrão.`, 'ok')
}

// Linha com a caixa de nome (+ erro e atalhos de formato), no topo da pasta de destino
function createRows (depth) {
  const c = explorer.creating
  const pad = 8 + depth * 14
  const icon = el('span', { className: 'ex-icon' })
  const error = el('div', { className: 'ex-new-error', style: `padding-left:${pad + 36}px` }, c.error)
  error.hidden = !c.error
  const input = el('input', {
    className: 'ex-new-input',
    value: c.value,
    spellcheck: false,
    placeholder: c.dir ? 'nome-da-pasta' : 'nome.ext — ex.: notas.md',
    ariaLabel: c.dir ? 'Nome da nova pasta' : 'Nome do novo arquivo'
  })
  const chips = c.dir ? [] : NEW_FILE_FORMATS.map(([ext, label]) => {
    const b = el('button', { className: 'ex-chip', type: 'button', title: label }, `.${ext}`)
    b.dataset.ext = ext
    b.onmousedown = e => e.preventDefault()
    b.onclick = () => {
      const v = input.value.trim()
      const base = v ? v.replace(/\.[^./\\]*$/, '') : 'novo-arquivo'
      input.value = `${base}.${ext}`
      const start = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\')) + 1
      input.setSelectionRange(start, base.length)
      sync()
    }
    return b
  })
  const look = () => {
    const ext = extOf(nameParts(input.value).pop() || '')
    icon.replaceChildren(c.dir ? folderIcon() : (FILE_ICON[ext] || '📄'))
    for (const b of chips) b.classList.toggle('on', b.dataset.ext === ext)
  }
  const sync = () => {
    c.value = input.value
    c.sel = [input.selectionStart, input.selectionEnd]
    look()
  }
  input.addEventListener('input', () => {
    sync()
    if (c.error) { c.error = ''; error.hidden = true; row.classList.remove('invalid') }
  })
  input.addEventListener('keyup', sync)
  input.addEventListener('mouseup', sync)
  input.addEventListener('focus', () => { c.focus = true })
  input.addEventListener('keydown', e => {
    e.stopPropagation()
    if (e.key === 'Enter') { e.preventDefault(); commitCreate() }
    if (e.key === 'Escape') { e.preventDefault(); cancelCreate() }
  })
  // como no VS Code: sair da caixa cria se o nome for válido; senão desiste
  input.addEventListener('blur', () => {
    if (explorer.rerendering || explorer.creating !== c || c.busy) return
    c.focus = false
    if (c.value.trim() && !validateNewName(c)) commitCreate()
    else cancelCreate()
  })
  const row = el('div', { className: 'ex-row ex-new' + (c.error ? ' invalid' : ''), style: `padding-left:${pad}px` },
    el('span', { className: 'ex-chev' }), icon, input)
  explorer.createInput = input
  look()
  const out = [row, error]
  if (chips.length) out.push(el('div', { className: 'ex-new-formats', style: `padding-left:${pad + 36}px` }, ...chips))
  return out
}

// ---------- renomear arquivo / pasta (F2 ou menu, como no VS Code) ----------
const viewerRe = kind => ({ draw: DRAW_RE, md: MD_RE, svg: SVG_RE, html: HTML_RE, mathnote: MATHNOTE_RE, json: JSON_RE })[kind]

function startRename (it) {
  if (!explorer.harness) return
  explorer.creating = null
  explorer.selected = it.rel
  // arquivo: seleciona só o nome, sem a extensão
  const end = it.type === 'file' && it.name.lastIndexOf('.') > 0 ? it.name.lastIndexOf('.') : it.name.length
  explorer.renaming = { rel: it.rel, type: it.type, value: it.name, error: '', sel: [0, end], focus: true }
  renderExplorer()
}

function cancelRename () {
  if (!explorer.renaming) return
  explorer.renaming = null
  renderExplorer()
  $('#ex-tree').focus()
}

function validateRename ({ rel, value }) {
  const name = value.trim()
  if (!name) return 'Informe um nome.'
  if (/[\\/]/.test(name)) return 'Para mover, arraste o item até a pasta de destino.'
  if (name === '.' || name === '..') return 'Não use "." ou ".." como nome.'
  if (BAD_NAME.test(name)) return 'Não use < > : " | ? * nem termine o nome com ponto ou espaço.'
  if (RESERVED_NAME.test(name)) return `"${name}" é um nome reservado do Windows.`
  const clash = (explorer.cache.get(exKey(explorer.harness, parentOf(rel))) || [])
    .find(s => s.rel !== rel && s.name.toLowerCase() === name.toLowerCase())
  if (clash) return `Já existe "${clash.name}" nesta pasta.`
  return ''
}

async function commitRename () {
  const r = explorer.renaming
  if (!r || r.busy) return
  const h = explorer.harness
  const oldName = r.rel.split('/').pop()
  const newName = r.value.trim()
  if (newName === oldName) { cancelRename(); return }
  r.error = validateRename(r)
  if (r.error) { renderExplorer(); return }
  r.busy = true
  // subabas abertas no item (ou dentro da pasta): grava o pendente antes de mudar o caminho
  const inside = rel => rel === r.rel || rel.startsWith(r.rel + '/')
  const affected = [...state.tabs.values()].filter(t => t.harness.name === h)
    .flatMap(t => t.drawings.filter(d => !d.readOnly && inside(d.rel)).map(d => ({ t, d })))
  for (const { t, d } of affected) {
    if (!d.saveTimer && (d.text === undefined || d.text === d.lastWritten)) continue
    clearTimeout(d.saveTimer)
    d.saveTimer = null
    if (d.kind === 'md') await saveMd(t, d)
    else if (d.kind === 'mathnote') await saveMathnoteNow(t, d)
    else await saveNow(t, d)
  }
  let newRel
  try {
    newRel = await window.hub.renameFile(h, r.rel, newName)
  } catch (e) {
    r.busy = false
    r.error = cleanError(e)
    renderExplorer()
    return
  }
  const moved = rel => newRel + rel.slice(r.rel.length)
  // subabas: passam a apontar para o novo caminho; se a extensão mudou e o visualizador não serve mais, fecha
  for (const { t, d } of affected) {
    const rel = moved(d.rel)
    const name = rel.split('/').pop()
    if (!viewerRe(d.kind)?.test(name)) { await closeDrawing(t, d.rel, { discard: true }); continue }
    if (t.view === d.rel) t.view = rel
    d.rel = rel
    d.name = name.replace(viewerRe(d.kind), '')
    persistDrawings(t)
    renderSubbar(t)
  }
  // pastas abertas e cache da árvore
  const set = exExpanded(h)
  for (const rel of [...set]) if (inside(rel)) { set.delete(rel); set.add(moved(rel)) }
  saveExpanded(h)
  for (const key of [...explorer.cache.keys()]) {
    const rel = key.slice(h.length + 1)
    if (key.startsWith(h + '|') && rel && inside(rel)) explorer.cache.delete(key)
  }
  explorer.renaming = null
  explorer.selected = newRel
  explorer.changed.set(exKey(h, newRel), Date.now())
  await loadDir(h, parentOf(newRel)).catch(() => {})
  for (const rel of set) if (rel === newRel || rel.startsWith(newRel + '/')) await loadDir(h, rel).catch(() => {})
  renderExplorer()
  $('#ex-tree').focus()
}

// Linha da árvore com a caixa de nome no lugar do nome do item
function renameRows (it, depth, isOpen) {
  const r = explorer.renaming
  const pad = 8 + depth * 14
  const icon = el('span', { className: 'ex-icon' })
  const error = el('div', { className: 'ex-new-error', style: `padding-left:${pad + 36}px` }, r.error)
  error.hidden = !r.error
  const input = el('input', {
    className: 'ex-new-input',
    value: r.value,
    spellcheck: false,
    ariaLabel: it.type === 'dir' ? 'Novo nome da pasta' : 'Novo nome do arquivo'
  })
  const look = () => icon.replaceChildren(it.type === 'dir' ? folderIcon(isOpen) : (FILE_ICON[extOf(input.value.trim())] || '📄'))
  const sync = () => {
    r.value = input.value
    r.sel = [input.selectionStart, input.selectionEnd]
    look()
  }
  input.addEventListener('input', () => {
    sync()
    if (r.error) { r.error = ''; error.hidden = true; row.classList.remove('invalid') }
  })
  input.addEventListener('keyup', sync)
  input.addEventListener('mouseup', sync)
  input.addEventListener('focus', () => { r.focus = true })
  input.addEventListener('keydown', e => {
    e.stopPropagation()
    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
    if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
  })
  // sair da caixa renomeia se o nome for válido; senão desiste
  input.addEventListener('blur', () => {
    if (explorer.rerendering || explorer.renaming !== r || r.busy) return
    r.focus = false
    if (!validateRename(r)) commitRename()
    else cancelRename()
  })
  const row = el('div', { className: 'ex-row ex-new' + (r.error ? ' invalid' : ''), style: `padding-left:${pad}px` },
    el('span', { className: 'ex-chev' }, it.type === 'dir' ? (isOpen ? '▾' : '▸') : ''), icon, input)
  explorer.createInput = input
  look()
  return [row, error]
}

async function onExplorerClick (it) {
  const h = explorer.harness
  explorer.selected = it.rel
  if (it.type === 'dir') {
    const set = exExpanded(h)
    if (set.has(it.rel)) set.delete(it.rel)
    else {
      set.add(it.rel)
      try { await loadDir(h, it.rel) } catch (e) { toast(cleanError(e)) }
    }
    saveExpanded(h)
  }
  renderExplorer()
}

// it = null: clique na área vazia da árvore (raiz da files/)
function showContextMenu (x, y, it) {
  const h = explorer.harness
  const menu = $('#ctx-menu')
  const item = (label, fn) => { const b = el('button', { role: 'menuitem' }, label); b.onclick = e => { e.stopPropagation(); hideContextMenu(); fn() }; return b }
  const activeTab = state.tabs.get(state.activeTab)
  const folder = !it ? '' : it.type === 'dir' ? it.rel : parentOf(it.rel)
  const createItems = [
    item('Novo arquivo…', () => startCreate(folder, false)),
    item('Nova pasta…', () => startCreate(folder, true)),
    item('Novo desenho', () => newDrawing(folder))
  ]
  if (!it) {
    menu.replaceChildren(...createItems, el('div', { className: 'ctx-sep' }), item('Mostrar no Explorer', () => window.hub.revealFile(h, '')))
  } else menu.replaceChildren(...[
    ...createItems,
    el('div', { className: 'ctx-sep' }),
    it.type === 'file' && DRAW_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Abrir no desenho', () => openDrawing(activeTab, it.rel)) : null,
    it.type === 'file' && MD_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Abrir no leitor', () => openMarkdown(activeTab, it.rel)) : null,
    it.type === 'file' && MD_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Editar arquivo', () => openMarkdown(activeTab, it.rel, { mode: 'edit' }).then(d => d && d.mode !== 'edit' && setMdMode(activeTab, d, 'edit'))) : null,
    it.type === 'file' && SVG_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Abrir no visualizador', () => openSvg(activeTab, it.rel)) : null,
    it.type === 'file' && HTML_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Abrir no visualizador', () => openHtml(activeTab, it.rel)) : null,
    it.type === 'file' && MATHNOTE_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Abrir no MathNote', () => openMathnote(activeTab, it.rel)) : null,
    it.type === 'file' && PDF_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Abrir no visualizador', () => openPdf(activeTab, it.rel)) : null,
    it.type === 'file' && JSON_RE.test(it.name) && !PATCH_RE.test(it.name) && activeTab && activeTab.harness.name === h ? item('Abrir no visualizador', () => openJson(activeTab, it.rel)) : null,
    it.type === 'file' ? item('Abrir no programa padrão', () => window.hub.openFile(h, it.rel).catch(e => toast(cleanError(e)))) : null,
    item('Mostrar no Explorer', () => window.hub.revealFile(h, it.rel)),
    item('Copiar caminho', async () => { await navigator.clipboard.writeText(await window.hub.filePath(h, it.rel)); toast('Caminho copiado', 'ok') }),
    item('Copiar caminho relativo', async () => { await navigator.clipboard.writeText(it.rel); toast('Caminho copiado', 'ok') }),
    el('div', { className: 'ctx-sep' }),
    item('Renomear…', () => startRename(it)),
    (() => { const b = item('Excluir', () => deleteExplorerItem(it)); b.classList.add('danger'); return b })()
  ].filter(Boolean))
  menu.classList.remove('hidden')
  const r = menu.getBoundingClientRect()
  menu.style.left = `${Math.min(x, window.innerWidth - r.width - 8)}px`
  menu.style.top = `${Math.min(y, window.innerHeight - r.height - 8)}px`
}
async function deleteExplorerItem (it) {
  const h = explorer.harness
  const isDir = it.type === 'dir'
  const ok = await confirmDialog({
    title: isDir ? 'Excluir pasta' : 'Excluir arquivo',
    confirmLabel: 'Excluir',
    body: [
      el('p', {}, `Tem certeza que deseja excluir ${isDir ? 'a pasta' : 'o arquivo'}:`),
      el('span', { className: 'modal-name' }, it.name, el('small', {}, `contexts/${it.rel}`)),
      isDir ? el('p', {}, el('strong', {}, 'Todo o conteúdo da pasta também será excluído.')) : null,
      el('p', {}, 'O item vai para a Lixeira do Windows, de onde pode ser recuperado.')
    ].filter(Boolean)
  })
  if (!ok) return
  try {
    await window.hub.deleteFile(h, it.rel)
  } catch (e) {
    toast(cleanError(e))
    return
  }
  // limpa o estado da tela; o vigia de arquivos também recarrega a pasta
  for (const rel of [...exExpanded(h)]) if (rel === it.rel || rel.startsWith(it.rel + '/')) exExpanded(h).delete(rel)
  saveExpanded(h)
  if (explorer.selected === it.rel) explorer.selected = null
  const parent = it.rel.includes('/') ? it.rel.slice(0, it.rel.lastIndexOf('/')) : ''
  try { await loadDir(h, parent) } catch {}
  renderExplorer()
  toast(`"${it.name}" movido para a Lixeira`, 'ok')
}

// Delete exclui e F2 renomeia o item selecionado no explorador
$('#ex-tree').tabIndex = 0
$('#ex-tree').addEventListener('keydown', e => {
  if ((e.key !== 'Delete' && e.key !== 'F2') || !explorer.selected || !explorer.harness) return
  const it = findExplorerItem(explorer.selected)
  if (!it) return
  e.preventDefault()
  if (e.key === 'F2') startRename(it)
  else deleteExplorerItem(it)
})
// área vazia da árvore: limpa a seleção (novos itens vão para a raiz) e oferece o menu de criação
$('#ex-tree').addEventListener('click', e => {
  if (e.target !== $('#ex-tree') || !explorer.selected) return
  explorer.selected = null
  renderExplorer()
})
$('#ex-tree').addEventListener('contextmenu', e => {
  if (e.target !== $('#ex-tree') && !e.target.classList.contains('ex-empty')) return
  e.preventDefault()
  showContextMenu(e.clientX, e.clientY, null)
})

function hideContextMenu () { $('#ctx-menu').classList.add('hidden') }
window.addEventListener('click', hideContextMenu)
window.addEventListener('blur', hideContextMenu)

// ---------- drag-and-drop: mover itens e importar arquivos externos ----------
async function handleExplorerDrop (e, destFolder) {
  const h = explorer.harness
  if (!h) return
  // arquivos internos (do próprio explorador)
  const srcRel = e.dataTransfer.getData('text/x-explorer-rel')
  if (srcRel) {
    // não mover para a mesma pasta onde já está
    if (parentOf(srcRel) === destFolder) return
    try {
      const newRel = await window.hub.moveFile(h, srcRel, destFolder)
      // expandir pasta destino, recarregar origem e destino
      exExpanded(h).add(destFolder)
      saveExpanded(h)
      await Promise.all([loadDir(h, parentOf(srcRel)).catch(() => {}), loadDir(h, destFolder).catch(() => {})])
      explorer.selected = newRel
      explorer.changed.set(exKey(h, newRel), Date.now())
      renderExplorer()
      toast(`Movido para ${destFolder || 'raiz'}`, 'ok')
    } catch (err) { toast(cleanError(err)) }
    return
  }
  // arquivos externos (do Windows Explorer)
  const files = e.dataTransfer.files
  if (!files?.length) return
  let count = 0
  for (const f of files) {
    if (!f.path) continue
    try {
      const newRel = await window.hub.importFile(h, f.path, destFolder)
      explorer.changed.set(exKey(h, newRel), Date.now())
      count++
    } catch (err) { toast(cleanError(err)) }
  }
  if (count) {
    exExpanded(h).add(destFolder)
    saveExpanded(h)
    await loadDir(h, destFolder).catch(() => {})
    renderExplorer()
    toast(`${count} arquivo${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''}`, 'ok')
  }
}
// Drop na raiz da árvore (fora de qualquer pasta) = mover/importar para a raiz da contexts/
$('#ex-tree').addEventListener('dragover', e => {
  if (e.target !== $('#ex-tree') && !e.target.classList.contains('ex-empty')) return
  const srcRel = explorer._dragRel ?? (e.dataTransfer.types.includes('Files') ? '__external__' : null)
  if (!srcRel) return
  e.preventDefault()
  e.dataTransfer.dropEffect = srcRel === '__external__' ? 'copy' : 'move'
  $('#ex-tree').classList.add('drag-over-root')
})
$('#ex-tree').addEventListener('dragleave', e => {
  if (!$('#ex-tree').contains(e.relatedTarget) || (e.relatedTarget && e.relatedTarget.classList?.contains('ex-row')))
    $('#ex-tree').classList.remove('drag-over-root')
})
$('#ex-tree').addEventListener('drop', e => {
  $('#ex-tree').classList.remove('drag-over-root')
  // só processa se o drop foi na área vazia (não numa pasta específica)
  if (e.target !== $('#ex-tree') && !e.target.classList.contains('ex-empty')) return
  e.preventDefault()
  handleExplorerDrop(e, '')
})

// Mudanças vindas do disco: recarrega só as pastas afetadas que estão abertas
window.hub.onFilesChanged(async ({ harness: h, changes }) => {
  const dirs = new Set()
  for (const c of changes) {
    const parent = c.rel.includes('/') ? c.rel.slice(0, c.rel.lastIndexOf('/')) : ''
    dirs.add(parent)
    if (c.exists) {
      explorer.changed.set(exKey(h, c.rel), Date.now())
      // marca também as pastas "pai", para achar a mudança mesmo com tudo recolhido
      const parts = c.rel.split('/')
      for (let i = 1; i < parts.length; i++) explorer.changed.set(exKey(h, parts.slice(0, i).join('/')), Date.now())
      // pulsa a esfera correspondente no grafo 3D
      if (h === graph3d.harness && graph3d.renderer) {
        const nodeId = `${graph3d.harness}/contexts/${c.rel}`
        graph3d.renderer.pulse(nodeId)
      }
    }
  }
  for (const d of dirs) {
    if (d === '' || exExpanded(h).has(d) || explorer.cache.has(exKey(h, d))) {
      try { await loadDir(h, d) } catch { explorer.cache.delete(exKey(h, d)) }
    }
  }
  if (h === explorer.harness) renderExplorer()
})
setInterval(() => { if (explorer.harness && explorer.open) renderExplorer() }, 20000) // apaga destaques antigos

// Redimensionar arrastando a borda esquerda
;(function () {
  const handle = $('#explorer-resize')
  handle.addEventListener('mousedown', e => {
    e.preventDefault()
    const startX = e.clientX
    const startW = $('#explorer').getBoundingClientRect().width
    $('#explorer').classList.add('resizing')
    const move = ev => {
      explorer.width = Math.max(180, Math.min(window.innerWidth * 0.6, startW + (startX - ev.clientX)))
      $('#explorer').style.setProperty('--ex-w', `${explorer.width}px`)
      fitActive()
    }
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      $('#explorer').classList.remove('resizing'); store.set('explorer.width', explorer.width)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  })
})()

// ---------- desenhos (Excalidraw) agrupados à aba ----------
// O desenho é um arquivo .excalidraw na files/ do harness. Você desenha → o app salva no arquivo.
// A IA escreve no arquivo (ou num .patch.json) → o app percebe e redesenha na hora.
const DRAW_RE = /\.excalidraw$/i
const PATCH_RE = /\.excalidraw\.patch\.json$/i
const drawReady = new Promise(resolve => {
  if (window.HubDraw) return resolve()
  window.addEventListener('hubdraw:ready', resolve, { once: true })
})
const MD_RE = /\.(md|markdown)$/i
const mdReady = new Promise(resolve => {
  if (window.HubMd) return resolve()
  window.addEventListener('hubmd:ready', resolve, { once: true })
})
const SVG_RE = /\.svg$/i
const HTML_RE = /\.html?$/i
const MATHNOTE_RE = /\.mathnote$/i
const PDF_RE = /\.pdf$/i
const JSON_RE = /\.json$/i
const svgReady = new Promise(resolve => {
  if (window.HubSvg) return resolve()
  window.addEventListener('hubsvg:ready', resolve, { once: true })
})
const htmlReady = new Promise(resolve => {
  if (window.HubHtml) return resolve()
  window.addEventListener('hubhtml:ready', resolve, { once: true })
})
const mathnoteReady = new Promise(resolve => {
  if (window.HubMathnote) return resolve()
  window.addEventListener('hubmathnote:ready', resolve, { once: true })
})
const pdfReady = new Promise(resolve => {
  if (window.HubPdf) return resolve()
  window.addEventListener('hubpdf:ready', resolve, { once: true })
})
const jsonReady = new Promise(resolve => {
  if (window.HubJson) return resolve()
  window.addEventListener('hubjson:ready', resolve, { once: true })
})
const baseName = rel => rel.split('/').pop().replace(DRAW_RE, '')

// aba que deve receber um desenho novo do harness: a ativa (se for do harness) ou a usada por último
function tabForHarness (h) {
  const active = state.tabs.get(state.activeTab)
  if (active && active.harness.name === h && !active.exited) return active
  return [...state.tabs.values()].filter(t => t.harness.name === h && !t.exited).sort((a, b) => b.lastActive - a.lastActive)[0] || null
}
const tabWithDrawing = (h, rel) => [...state.tabs.values()].find(t => t.harness.name === h && t.drawings.some(d => d.rel === rel))

async function readWithRetry (h, rel) {
  // a IA pode estar no meio da escrita: tenta algumas vezes antes de desistir
  let lastErr
  for (let i = 0; i < 4; i++) {
    const text = await window.hub.readFile(h, rel)
    if (text == null) return null
    try { JSON.parse(text); return text } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 400)) }
  }
  throw new Error(`O desenho ${rel} não é um JSON válido: ${lastErr.message}`)
}

async function openDrawing (t, rel, { activate = true, persist = true, flash = false } = {}) {
  await drawReady
  let d = t.drawings.find(x => x.rel === rel)
  if (d) { if (activate) setTabView(t, rel); if (flash) flashSub(t, rel); return d }

  let text
  try { text = await readWithRetry(t.harness.name, rel) } catch (e) { toast(e.message); return null }
  if (text == null) text = JSON.stringify({ type: 'excalidraw', version: 2, source: 'harness-hub', elements: [], appState: {}, files: {} })

  // 1º monta o editor vazio (isso registra as fontes do Excalidraw); 2º converte e mede os textos
  d = { kind: 'draw', rel, name: baseName(rel), host: el('div', { className: 'draw-host hidden' }), handle: null, lastWritten: text, saveTimer: null, previewTimer: null, fitted: false }
  t.drawPane.append(d.host)
  t.drawings.push(d)
  let bg = '#ffffff'
  try { bg = JSON.parse(text).appState?.viewBackgroundColor || bg } catch {}
  await new Promise(resolve => {
    d.handle = window.HubDraw.mount(d.host, {
      // no tema escuro o Excalidraw inverte as cores: fundo branco no arquivo aparece escuro na tela
      initialData: { elements: [], appState: { viewBackgroundColor: bg } },
      onChange: () => scheduleSave(t, d),
      onReady: resolve
    })
  })
  let norm
  try { norm = await window.HubDraw.normalize(text) } catch (e) { toast(`${rel}: ${e.message}`); norm = null }
  if (norm) {
    d.handle.setScene({ elements: norm.elements, files: norm.files })
    if (norm.converted) saveNow(t, d) // a IA escreveu esqueleto/mermaid: grava o formato completo
    else schedulePreview(t, d)
  }
  if (persist) persistDrawings(t)
  renderSubbar(t)
  if (activate) setTabView(t, rel)
  if (flash) flashSub(t, rel)
  return d
}

// Fechar a subaba salva sozinho o que estiver pendente, sem perguntar.
// discard: o arquivo sumiu do disco — não salva para não recriá-lo.
async function closeDrawing (t, rel, { discard = false } = {}) {
  const d = t.drawings.find(x => x.rel === rel)
  if (!d) return
  const isDirty = !d.readOnly && (d.saveTimer || (d.text !== undefined && d.text !== d.lastWritten))
  clearTimeout(d.saveTimer)
  d.saveTimer = null
  if (!discard && isDirty) {
    if (d.kind === 'md') await saveMd(t, d)
    else if (d.kind === 'mathnote') await saveMathnoteNow(t, d)
    else await saveNow(t, d)
  }
  try {
    if (d.kind === 'browser') { window.hub.hideBrowser(); if (browserDrawing === d) browserDrawing = null }
    else if (d.kind === 'md') d.editor?.destroy()
    else if (d.kind === 'mathnote') d.instance?.destroy?.()
    else d.handle?.destroy()
  } catch {}
  d.host.remove()
  t.drawings = t.drawings.filter(x => x !== d)
  if (d.kind !== 'browser') persistDrawings(t)
  if (t.view === rel) setTabView(t, 'term')
  else renderSubbar(t)
}

function persistDrawings (t) {
  window.hub.setTabDrawings(t.harness.name, t.session.id, t.tab.id, t.drawings.map(d => d.rel)).catch(() => {})
}

// ---- salvar (o que você desenha vai para o arquivo) ----
function scheduleSave (t, d) {
  clearTimeout(d.saveTimer)
  d.saveTimer = setTimeout(() => saveNow(t, d), 700)
}
function flushSave (t, d) {
  if (!d.saveTimer) return
  clearTimeout(d.saveTimer)
  d.saveTimer = null
  if (d.kind === 'md') saveMd(t, d)
  else if (d.kind === 'mathnote') saveMathnoteNow(t, d)
  else saveNow(t, d)
}
async function saveMathnoteNow (t, d) {
  if (d.readOnly || d.text === d.lastWritten) return
  d.lastWritten = d.text
  try { await window.hub.writeFile(t.harness.name, d.rel, d.text) } catch (e) { toast(cleanError(e)) }
}
async function saveNow (t, d) {
  d.saveTimer = null
  const scene = d.handle?.getScene()
  if (!scene) return
  const json = window.HubDraw.serialize(scene.elements, scene.appState, scene.files)
  if (json === d.lastWritten) return
  d.lastWritten = json
  try { await window.hub.writeFile(t.harness.name, d.rel, json) } catch (e) { toast(cleanError(e)) }
  schedulePreview(t, d)
}

// ---- prévia para a IA ler: .hub/desenhos/<rel>.png e .md ----
function schedulePreview (t, d) {
  clearTimeout(d.previewTimer)
  d.previewTimer = setTimeout(async () => {
    const scene = d.handle?.getScene()
    if (!scene) return
    try {
      const png = await window.HubDraw.exportPng(scene.elements, scene.appState, scene.files)
      await window.hub.drawPreview(t.harness.name, d.rel, png, window.HubDraw.summarize(scene.elements))
    } catch (e) { console.error('prévia', e) }
  }, 1500)
}

// ---- mudanças vindas do disco (a IA escreveu) ----
async function onDrawingChanged (h, rel, autoOpen = false) {
  const t = tabWithDrawing(h, rel)
  if (!t) {
    if (!autoOpen) return
    const target = tabForHarness(h)
    if (target) {
      await openDrawing(target, rel, { activate: true, flash: true })
      toast(`Desenho aberto: ${baseName(rel)}`, 'ok')
    }
    return
  }
  const d = t.drawings.find(x => x.rel === rel)
  let text
  try { text = await readWithRetry(h, rel) } catch (e) { toast(e.message); return }
  if (text == null || text === d.lastWritten) return // eco da nossa própria gravação
  flushPendingLocal(t, d)
  let norm
  try { norm = await window.HubDraw.normalize(text) } catch (e) { toast(`${rel}: ${e.message}`); return }
  d.lastWritten = text
  d.handle.setScene({ elements: norm.elements, files: norm.files })
  if (norm.converted) saveNow(t, d)
  else schedulePreview(t, d)
  if (t.view === rel) setTimeout(() => d.handle.scrollToContent(), 50)
  flashSub(t, rel)
}
// se havia um traço seu ainda não salvo, ele é gravado antes de receber a versão da IA
function flushPendingLocal (t, d) { if (d.saveTimer) { clearTimeout(d.saveTimer); d.saveTimer = null } }

async function onPatchFile (h, patchRel) {
  const rel = patchRel.replace(/\.patch\.json$/i, '')
  let patchText
  try { patchText = await readWithRetry(h, patchRel) } catch (e) { toast(e.message); return }
  if (patchText == null) return
  let t = tabWithDrawing(h, rel)
  if (!t) {
    const target = tabForHarness(h)
    if (!target) return
    await openDrawing(target, rel, { activate: true })
    t = target
  }
  const d = t.drawings.find(x => x.rel === rel)
  if (!d) return
  try {
    const scene = d.handle.getScene()
    const res = await window.HubDraw.applyPatch(scene.elements, JSON.parse(patchText))
    d.handle.setScene(res)
    if (t.view === rel) setTimeout(() => d.handle.scrollToContent(), 50)
    await saveNow(t, d)
    await window.hub.removePatch(h, patchRel)
    flashSub(t, rel)
    if (state.activeTab === t.termId && t.view !== rel) setTabView(t, rel)
  } catch (e) { toast(`Patch ${patchRel}: ${e.message}`) }
}

window.hub.onFilesChanged(async ({ harness: h, changes }) => {
  // Abre sozinho só um arquivo novo que chegou sozinho (ex.: desenho que a IA acabou de criar).
  // Alterações em arquivos existentes, git pull, sincronização do OneDrive e pastas movidas
  // mexem em arquivos já existentes ou em vários de uma vez: atualizam o que está aberto, sem abrir abas.
  const viewable = rel => DRAW_RE.test(rel) || SVG_RE.test(rel) || HTML_RE.test(rel) || MATHNOTE_RE.test(rel) || PDF_RE.test(rel) || (JSON_RE.test(rel) && !PATCH_RE.test(rel))
  const fresh = changes.filter(c => c.exists && viewable(c.rel))
  const autoOpenRel = fresh.length === 1 && fresh[0].created ? fresh[0].rel : null
  for (const c of changes) {
    const autoOpen = c.rel === autoOpenRel
    if (!c.exists) {
      // desenho apagado no disco: fecha a subaba
      if (DRAW_RE.test(c.rel) || MD_RE.test(c.rel) || SVG_RE.test(c.rel) || HTML_RE.test(c.rel) || MATHNOTE_RE.test(c.rel) || PDF_RE.test(c.rel) || JSON_RE.test(c.rel)) { const t = tabWithDrawing(h, c.rel); if (t) closeDrawing(t, c.rel, { discard: true }) }
      continue
    }
    if (PATCH_RE.test(c.rel)) await onPatchFile(h, c.rel)
    else if (DRAW_RE.test(c.rel)) await onDrawingChanged(h, c.rel, autoOpen)
    else if (MD_RE.test(c.rel)) await onMarkdownChanged(h, c.rel)
    else if (SVG_RE.test(c.rel)) await onSvgChanged(h, c.rel, autoOpen)
    else if (HTML_RE.test(c.rel)) await onHtmlChanged(h, c.rel, autoOpen)
    else if (MATHNOTE_RE.test(c.rel)) await onMathnoteChanged(h, c.rel, autoOpen)
    else if (PDF_RE.test(c.rel)) await onPdfChanged(h, c.rel, autoOpen)
    else if (JSON_RE.test(c.rel) && !PATCH_RE.test(c.rel)) await onJsonChanged(h, c.rel, autoOpen)
  }
})

// ---- subbarra: [Terminal] [desenhos...]  ·  [dividir/maximizar] ----
let subDragRel = null // rel da subaba sendo arrastada
function renderSubbar (t) {
  const bar = t.subbar
  bar.classList.toggle('hidden', t.drawings.length === 0)
  bar.replaceChildren()
  const termBtn = el('button', { className: 'sub' + (t.view === 'term' ? ' active' : ''), title: 'Terminal' }, engineIcon(t.tab.engine, 12), 'Terminal')
  termBtn.onclick = () => setTabView(t, 'term')
  bar.append(termBtn)
  for (const d of t.drawings) {
    const x = el('span', { className: 'sub-close', title: 'Fechar desenho (o arquivo continua salvo)' }, '×')
    x.onclick = e => { e.stopPropagation(); closeDrawing(t, d.rel) }
    const icon = d.kind === 'browser' ? '⊕ ' : d.kind === 'md' ? '📝 ' : d.kind === 'svg' ? '🖼 ' : d.kind === 'html' ? '🌐 ' : '✏ '
    const tooltip = d.readOnly ? d.rel.slice(1) : `contexts/${d.rel}`
    const b = el('button', { className: 'sub draw' + (t.view === d.rel ? ' active' : ''), title: tooltip, draggable: true }, icon, d.name, x)
    b.dataset.rel = d.rel
    b.onclick = () => setTabView(t, d.rel)
    b.onauxclick = e => { if (e.button === 1) { e.preventDefault(); closeDrawing(t, d.rel) } }
    // drag-and-drop para reordenar subabas
    b.ondragstart = e => { subDragRel = d.rel; e.dataTransfer.effectAllowed = 'move'; b.classList.add('sub-dragging') }
    b.ondragend = () => { subDragRel = null; b.classList.remove('sub-dragging') }
    b.ondragover = e => {
      if (!subDragRel || subDragRel === d.rel) return
      e.preventDefault(); e.dataTransfer.dropEffect = 'move'
      const rect = b.getBoundingClientRect()
      const half = (e.clientX - rect.left) < rect.width / 2
      b.classList.toggle('sub-drop-before', half)
      b.classList.toggle('sub-drop-after', !half)
    }
    b.ondragleave = () => { b.classList.remove('sub-drop-before', 'sub-drop-after') }
    b.ondrop = e => {
      e.preventDefault()
      b.classList.remove('sub-drop-before', 'sub-drop-after')
      if (!subDragRel || subDragRel === d.rel) return
      const from = t.drawings.findIndex(x => x.rel === subDragRel)
      if (from < 0) return
      const [moved] = t.drawings.splice(from, 1)
      const rect = b.getBoundingClientRect()
      const before = (e.clientX - rect.left) < rect.width / 2
      // após o splice, encontrar a nova posição do alvo
      const targetIdx = t.drawings.findIndex(x => x.rel === d.rel)
      if (targetIdx < 0) { t.drawings.push(moved) } // fallback
      else t.drawings.splice(before ? targetIdx : targetIdx + 1, 0, moved)
      persistDrawings(t)
      renderSubbar(t)
    }
    bar.append(b)
  }
  bar.append(el('span', { className: 'tabbar-spacer' }))
  if (t.view !== 'term') {
    const cur = t.drawings.find(x => x.rel === t.view)
    if (cur?.readOnly) {
      bar.append(el('span', { className: 'sub readonly-badge', title: 'Arquivo fora de contexts/ — somente leitura' }, '🔒 Somente leitura'))
    } else if (cur?.kind === 'md') {
      const toggle = el('button', { className: 'sub action' + (cur.mode === 'edit' ? ' on' : ''), title: 'Alternar entre visualizar e editar o arquivo' },
        cur.mode === 'edit' ? '👁 Visualizar arquivo' : '✎ Editar arquivo')
      toggle.onclick = () => setMdMode(t, cur, cur.mode === 'edit' ? 'view' : 'edit')
      bar.append(toggle)
    }
    const split = el('button', { className: 'sub action', title: t.maximized ? 'Mostrar o terminal ao lado' : 'Esconder o terminal (só o desenho)' }, t.maximized ? '◫ Dividir' : '⤢ Maximizar')
    split.onclick = () => { t.maximized = !t.maximized; applyGroupLayout(t); renderSubbar(t) }
    bar.append(split)
  }
}

function setTabView (t, view) {
  t.view = view
  // visualizadores abrem maximizados; voltar ao terminal restaura o split
  if (view === 'term') t.maximized = false
  else t.maximized = true
  for (const d of t.drawings) d.host.classList.toggle('hidden', d.rel !== view)
  applyGroupLayout(t)
  renderSubbar(t)

  // browser: mostrar/esconder WebContentsView conforme a view ativa
  if (view === BROWSER_REL) {
    const d = t.drawings.find(x => x.rel === BROWSER_REL)
    if (d) {
      browserDrawing = d
      browserResizeObs.observe(d.placeholder)
      requestAnimationFrame(() => showBrowserView())
    }
  } else {
    window.hub.hideBrowser()
    if (browserDrawing) browserResizeObs.unobserve(browserDrawing.placeholder)
  }

  if (view === 'term') requestAnimationFrame(() => t.term.focus())
  else {
    requestAnimationFrame(() => {
      const d = t.drawings.find(x => x.rel === view)
      if (!d) return
      if (d.kind === 'browser') return
      if (d.kind === 'md') { if (d.mode === 'edit') d.editor?.focus(); return }
      if (d.kind === 'svg') return
      if (d.kind === 'mathnote') { d.host.querySelector('[tabindex="0"]')?.focus(); return }
      d.handle?.reveal({ fit: !d.fitted })
      d.fitted = true
      d.host.querySelector('.excalidraw')?.focus()
    })
  }
}

function applyGroupLayout (t) {
  const drawing = t.view !== 'term'
  t.drawPane.classList.toggle('hidden', !drawing)
  t.splitter.classList.toggle('hidden', !drawing || t.maximized)
  t.termPane.classList.toggle('hidden', drawing && t.maximized)
  t.termPane.style.flex = drawing && !t.maximized ? `0 0 ${t.splitPct}%` : '1 1 auto'
  requestAnimationFrame(() => { try { t.fit.fit() } catch {} })
}

function setupSplitter (t) {
  t.splitter.addEventListener('mousedown', e => {
    e.preventDefault()
    const body = t.splitter.parentElement.getBoundingClientRect()
    t.container.classList.add('resizing')
    const move = ev => {
      t.splitPct = Math.max(20, Math.min(75, ((ev.clientX - body.left) / body.width) * 100))
      t.termPane.style.flex = `0 0 ${t.splitPct}%`
      try { t.fit.fit() } catch {}
      updateBrowserBounds()
    }
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      t.container.classList.remove('resizing'); store.set('draw.splitPct', t.splitPct)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  })
}

function flashSub (t, rel) {
  requestAnimationFrame(() => {
    const b = t.subbar.querySelector(`.sub.draw[data-rel="${CSS.escape(rel)}"]`)
    if (!b) return
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash')
  })
}

// ---------- arquivos Markdown (.md): uma subaba que alterna entre visualizar e editar ----------
async function openMarkdown (t, rel, { activate = true, persist = true, mode = 'view', text: preloadText, readOnly = false } = {}) {
  await mdReady
  let d = t.drawings.find(x => x.rel === rel)
  if (d) { if (activate) setTabView(t, rel); return d }
  const text = preloadText ?? await window.hub.readFile(t.harness.name, rel)
  if (text == null) { toast(`Arquivo não encontrado: ${rel}`); return null }

  const view = el('div', { className: 'md-view' })
  const edit = el('div', { className: 'md-edit hidden' })
  d = {
    kind: 'md', rel, name: rel.split('/').pop().replace(MD_RE, ''),
    host: el('div', { className: 'draw-host md-host hidden' }, view, edit),
    viewEl: view, editEl: edit, editor: null,
    text, lastWritten: text, saveTimer: null, mode: 'view', readOnly
  }
  view.addEventListener('click', e => onMdLinkClick(t, d, e))
  t.drawPane.append(d.host)
  t.drawings.push(d)
  await renderMd(t, d)
  if (mode === 'edit' && !readOnly) setMdMode(t, d, 'edit')
  if (persist && !readOnly) persistDrawings(t)
  renderSubbar(t)
  if (activate) setTabView(t, rel)
  return d
}

async function renderMd (t, d) {
  const root = await window.hub.filePath(t.harness.name, '')
  const dir = d.rel.includes('/') ? d.rel.slice(0, d.rel.lastIndexOf('/') + 1) : ''
  const toFileUrl = rel => 'file:///' + encodeURI(`${root}/${rel}`.replace(/\\/g, '/').replace(/^\/+/, ''))
  const scroll = d.viewEl.scrollTop
  await window.HubMd.render(d.viewEl, d.text, { resolveUrl: src => toFileUrl(joinRel(dir, src)) })
  d.viewEl.scrollTop = scroll
}

// junta "pasta/" + "../outra/img.png" respeitando .. e .
function joinRel (dir, rel) {
  const parts = (dir + rel.split('#')[0].split('?')[0]).split('/')
  const out = []
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p) }
  return out.join('/')
}

function setMdMode (t, d, mode) {
  if (d.readOnly) return
  if (mode === 'edit') {
    if (!d.editor) d.editor = window.HubMd.createEditor(d.editEl, d.text, { onChange: text => { d.text = text; scheduleMdSave(t, d) } })
    d.mode = 'edit'
    d.viewEl.classList.add('hidden')
    d.editEl.classList.remove('hidden')
    requestAnimationFrame(() => d.editor.focus())
  } else {
    flushSave(t, d)
    d.mode = 'view'
    d.editEl.classList.add('hidden')
    d.viewEl.classList.remove('hidden')
    renderMd(t, d)
  }
  renderSubbar(t)
}

function scheduleMdSave (t, d) {
  clearTimeout(d.saveTimer)
  d.saveTimer = setTimeout(() => saveMd(t, d), 800)
}
async function saveMd (t, d) {
  d.saveTimer = null
  if (d.readOnly || d.text === d.lastWritten) return
  d.lastWritten = d.text
  try { await window.hub.writeFile(t.harness.name, d.rel, d.text) } catch (e) { toast(cleanError(e)) }
}

// a IA (ou outro programa) alterou um .md aberto
async function onMarkdownChanged (h, rel) {
  const t = tabWithDrawing(h, rel)
  if (!t) return
  const d = t.drawings.find(x => x.rel === rel)
  if (!d || d.kind !== 'md') return
  const text = await window.hub.readFile(h, rel)
  if (text == null || text === d.lastWritten) return // eco da nossa própria gravação
  if (d.saveTimer) {
    // você tem alterações ainda não salvas: elas têm prioridade e serão gravadas por cima
    toast(`"${d.name}" foi alterado fora do editor enquanto você editava. Mantive a sua versão.`)
    return
  }
  d.text = text
  d.lastWritten = text
  d.editor?.setText(text)
  if (d.mode === 'view') await renderMd(t, d)
  flashSub(t, rel)
}

// links dentro do Markdown: âncoras rolam, web abre no navegador, arquivos abrem no app
function onMdLinkClick (t, d, e) {
  const a = e.target.closest('a[href]')
  if (!a) return
  e.preventDefault()
  const href = a.getAttribute('href')
  if (href.startsWith('#')) {
    d.viewEl.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`)?.scrollIntoView({ behavior: 'smooth' })
    return
  }
  if (/^(https?:|mailto:)/i.test(href)) { window.hub.openExternal(href); return }
  if (/^[a-z]+:/i.test(href)) return
  const dir = d.rel.includes('/') ? d.rel.slice(0, d.rel.lastIndexOf('/') + 1) : ''
  const target = joinRel(dir, decodeURIComponent(href))
  if (MD_RE.test(target)) openMarkdown(t, target)
  else if (SVG_RE.test(target)) openSvg(t, target)
  else if (HTML_RE.test(target)) openHtml(t, target)
  else if (DRAW_RE.test(target)) openDrawing(t, target)
  else if (MATHNOTE_RE.test(target)) openMathnote(t, target)
  else if (PDF_RE.test(target)) openPdf(t, target)
  else if (JSON_RE.test(target) && !PATCH_RE.test(target)) openJson(t, target)
  else window.hub.openFile(t.harness.name, target).catch(err => toast(cleanError(err)))
}

// ---------- arquivos SVG: subaba de visualização com pan/zoom ----------
async function openSvg (t, rel, { activate = true, persist = true, text: preloadText, readOnly = false } = {}) {
  await svgReady
  let d = t.drawings.find(x => x.rel === rel)
  if (d) { if (activate) setTabView(t, rel); return d }
  const text = preloadText ?? await window.hub.readFile(t.harness.name, rel)
  if (text == null) { toast(`Arquivo não encontrado: ${rel}`); return null }

  const view = el('div', { className: 'svg-view' })
  const hint = el('div', { className: 'svg-hint' }, 'Scroll = zoom · Arrastar = mover · Duplo clique = resetar')
  d = {
    kind: 'svg', rel, name: rel.split('/').pop().replace(SVG_RE, ''),
    host: el('div', { className: 'draw-host svg-host hidden' }, view, hint),
    viewEl: view, text, lastWritten: text, readOnly
  }
  t.drawPane.append(d.host)
  t.drawings.push(d)
  window.HubSvg.render(view, text)
  if (persist && !readOnly) persistDrawings(t)
  renderSubbar(t)
  if (activate) setTabView(t, rel)
  return d
}

async function onSvgChanged (h, rel, autoOpen = false) {
  const t = tabWithDrawing(h, rel)
  if (!t) {
    if (!autoOpen) return
    const target = tabForHarness(h)
    if (target) {
      await openSvg(target, rel, { activate: true })
      toast(`SVG aberto: ${rel.split('/').pop()}`, 'ok')
    }
    return
  }
  const d = t.drawings.find(x => x.rel === rel)
  if (!d || d.kind !== 'svg') return
  const text = await window.hub.readFile(h, rel)
  if (text == null || text === d.lastWritten) return
  d.text = text
  d.lastWritten = text
  window.HubSvg.render(d.viewEl, text)
  flashSub(t, rel)
}

// ---------- arquivos HTML: subaba de visualização em iframe sandbox ----------
async function openHtml (t, rel, { activate = true, persist = true, text: preloadText, readOnly = false } = {}) {
  await htmlReady
  let d = t.drawings.find(x => x.rel === rel)
  if (d) { if (activate) setTabView(t, rel); return d }
  const text = preloadText ?? await window.hub.readFile(t.harness.name, rel)
  if (text == null) { toast(`Arquivo não encontrado: ${rel}`); return null }

  const view = el('div', { className: 'html-view' })
  const baseUrl = 'file:///' + encodeURI((await window.hub.filePath(t.harness.name, rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '')).replace(/\\/g, '/'))
  d = {
    kind: 'html', rel, name: rel.split('/').pop().replace(HTML_RE, ''),
    host: el('div', { className: 'draw-host html-host hidden' }, view),
    viewEl: view, text, lastWritten: text, readOnly, baseUrl
  }
  t.drawPane.append(d.host)
  t.drawings.push(d)
  window.HubHtml.render(view, text, baseUrl)
  if (persist && !readOnly) persistDrawings(t)
  renderSubbar(t)
  if (activate) setTabView(t, rel)
  return d
}

async function onHtmlChanged (h, rel, autoOpen = false) {
  const t = tabWithDrawing(h, rel)
  if (!t) {
    if (!autoOpen) return
    const target = tabForHarness(h)
    if (target) {
      await openHtml(target, rel, { activate: true })
      toast(`HTML aberto: ${rel.split('/').pop()}`, 'ok')
    }
    return
  }
  const d = t.drawings.find(x => x.rel === rel)
  if (!d || d.kind !== 'html') return
  const text = await window.hub.readFile(h, rel)
  if (text == null || text === d.lastWritten) return
  d.text = text
  d.lastWritten = text
  window.HubHtml.render(d.viewEl, text, d.baseUrl)
  flashSub(t, rel)
}

// ---------- arquivos MathNote: subaba de canvas matemático interativo ----------
async function openMathnote (t, rel, { activate = true, persist = true, text: preloadText, readOnly = false } = {}) {
  await mathnoteReady
  let d = t.drawings.find(x => x.rel === rel)
  if (d) { if (activate) setTabView(t, rel); return d }
  const text = preloadText ?? await window.hub.readFile(t.harness.name, rel)
  if (text == null) { toast(`Arquivo não encontrado: ${rel}`); return null }

  const view = el('div', { className: 'mathnote-view' })
  d = {
    kind: 'mathnote', rel, name: rel.split('/').pop().replace(MATHNOTE_RE, ''),
    host: el('div', { className: 'draw-host mathnote-host hidden' }, view),
    viewEl: view, text, lastWritten: text, readOnly, saveTimer: null, instance: null
  }
  t.drawPane.append(d.host)
  t.drawings.push(d)

  d.instance = window.HubMathnote.mount(view, {
    initialData: text,
    onChange: (json) => {
      d.text = json
      clearTimeout(d.saveTimer)
      d.saveTimer = setTimeout(() => saveMathnoteNow(t, d), 600)
    },
    onBlur: () => {
      clearTimeout(d.saveTimer)
      d.saveTimer = null
      saveMathnoteNow(t, d)
    },
    onAiGenerate: (prompt) => {
      if (!t.termId || t.exited) { toast('Nenhum terminal ativo nesta aba'); return }
      const cmd = `no arquivo ${rel}: ${prompt}`
      window.hub.write(t.termId, cmd + '\r')
      toast('Prompt enviado ao terminal', 'ok')
    }
  })

  if (persist && !readOnly) persistDrawings(t)
  renderSubbar(t)
  if (activate) setTabView(t, rel)
  return d
}

async function onMathnoteChanged (h, rel, autoOpen = false) {
  const t = tabWithDrawing(h, rel)
  if (!t) {
    if (!autoOpen) return
    const target = tabForHarness(h)
    if (target) {
      await openMathnote(target, rel, { activate: true })
      toast(`MathNote aberto: ${rel.split('/').pop()}`, 'ok')
    }
    return
  }
  const d = t.drawings.find(x => x.rel === rel)
  if (!d || d.kind !== 'mathnote') return
  const text = await window.hub.readFile(h, rel)
  if (text == null || text === d.lastWritten) return
  d.text = text
  d.lastWritten = text
  if (d.instance) d.instance.load(text)
  flashSub(t, rel)
}

// ---------- arquivos PDF: subaba com visualizador canvas (pdf.js) ----------
async function openPdf (t, rel, { activate = true, persist = true } = {}) {
  await pdfReady
  let d = t.drawings.find(x => x.rel === rel)
  if (d) { if (activate) setTabView(t, rel); return d }

  const absPath = await window.hub.filePath(t.harness.name, rel)
  if (!absPath) { toast(`Arquivo não encontrado: ${rel}`); return null }
  const fileUrl = 'file:///' + encodeURI(absPath.replace(/\\/g, '/'))

  const view = el('div', { className: 'pdf-view' })
  d = {
    kind: 'pdf', rel, name: rel.split('/').pop().replace(PDF_RE, ''),
    host: el('div', { className: 'draw-host pdf-host hidden' }, view),
    viewEl: view, text: '', lastWritten: '', readOnly: true, fileUrl
  }
  t.drawPane.append(d.host)
  t.drawings.push(d)
  window.HubPdf.render(view, fileUrl)
  if (persist) persistDrawings(t)
  renderSubbar(t)
  if (activate) setTabView(t, rel)
  return d
}

async function onPdfChanged (h, rel, autoOpen = false) {
  const t = tabWithDrawing(h, rel)
  if (!t) {
    if (!autoOpen) return
    const target = tabForHarness(h)
    if (target) {
      await openPdf(target, rel, { activate: true })
      toast(`PDF aberto: ${rel.split('/').pop()}`, 'ok')
    }
    return
  }
  // reload: remove e reabre
  const d = t.drawings.find(x => x.rel === rel)
  if (!d || d.kind !== 'pdf') return
  const absPath = await window.hub.filePath(h, rel)
  if (!absPath) return
  const fileUrl = 'file:///' + encodeURI(absPath.replace(/\\/g, '/'))
  window.HubPdf.render(d.viewEl, fileUrl)
  flashSub(t, rel)
}

// ---------- arquivos JSON: subaba de visualização com tree viewer ----------
async function openJson (t, rel, { activate = true, persist = true } = {}) {
  await jsonReady
  let d = t.drawings.find(x => x.rel === rel)
  if (d) { if (activate) setTabView(t, rel); return d }
  const text = await window.hub.readFile(t.harness.name, rel)
  if (text == null) { toast(`Arquivo não encontrado: ${rel}`); return null }

  const view = el('div', { className: 'json-view' })
  d = {
    kind: 'json', rel, name: rel.split('/').pop().replace(JSON_RE, ''),
    host: el('div', { className: 'draw-host json-host hidden' }, view),
    viewEl: view, text, lastWritten: text, readOnly: true
  }
  t.drawPane.append(d.host)
  t.drawings.push(d)
  window.HubJson.render(view, text)
  if (persist) persistDrawings(t)
  renderSubbar(t)
  if (activate) setTabView(t, rel)
  return d
}

async function onJsonChanged (h, rel, autoOpen = false) {
  const t = tabWithDrawing(h, rel)
  if (!t) {
    if (!autoOpen) return
    const target = tabForHarness(h)
    if (target) {
      await openJson(target, rel, { activate: true })
      toast(`JSON aberto: ${rel.split('/').pop()}`, 'ok')
    }
    return
  }
  const d = t.drawings.find(x => x.rel === rel)
  if (!d || d.kind !== 'json') return
  const text = await window.hub.readFile(h, rel)
  if (text == null || text === d.lastWritten) return
  d.text = text
  d.lastWritten = text
  window.HubJson.render(d.viewEl, text)
  flashSub(t, rel)
}

// Cria um desenho vazio na files/ (pasta indicada) e abre na aba ativa
async function newDrawing (folderRel = '') {
  const t = state.tabs.get(state.activeTab)
  if (!t || t.harness.name !== explorer.harness) { toast('Abra uma aba deste harness para desenhar.'); return }
  const entries = explorer.cache.get(exKey(explorer.harness, folderRel)) || (await loadDir(explorer.harness, folderRel))
  const names = new Set(entries.map(e => e.name))
  let n = 1
  let name = 'desenho.excalidraw'
  while (names.has(name)) name = `desenho-${++n}.excalidraw`
  const rel = folderRel ? `${folderRel}/${name}` : name
  await window.hub.writeFile(t.harness.name, rel, JSON.stringify({ type: 'excalidraw', version: 2, source: 'harness-hub', elements: [], appState: {}, files: {} }))
  // o vigia também detecta; abrir direto evita esperar
  await openDrawing(t, rel, { activate: true })
}

// ---------- modal de confirmação ----------
// Devolve uma Promise<boolean>: true se confirmou
function confirmDialog ({ title, body, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = true }) {
  return new Promise(resolve => {
    const modal = $('#modal')
    $('#modal-title').textContent = title
    $('#modal-body').replaceChildren(...body)
    $('#modal-confirm').textContent = confirmLabel
    $('#modal-cancel').textContent = cancelLabel
    $('#modal-confirm').className = 'btn ' + (danger ? 'danger' : 'primary')
    modal.classList.remove('hidden')
    $('#modal-cancel').focus() // foco no Cancelar: Enter acidental não exclui

    const close = ok => {
      modal.classList.add('hidden')
      document.removeEventListener('keydown', onKey, true)
      $('#modal-confirm').onclick = $('#modal-cancel').onclick = modal.onclick = null
      resolve(ok)
    }
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(false) } }
    document.addEventListener('keydown', onKey, true)
    $('#modal-confirm').onclick = () => close(true)
    $('#modal-cancel').onclick = () => close(false)
    modal.onclick = e => { if (e.target === modal) close(false) }
  })
}


// ---------- excluir sessão ----------
async function deleteSession (h, s) {
  const openCount = [...state.tabs.values()].filter(t => t.session.id === s.id && t.harness.name === h.name && !t.exited).length
  const ok = await confirmDialog({
    title: 'Excluir sessão',
    confirmLabel: 'Excluir',
    body: [
      el('p', {}, 'Tem certeza que deseja excluir a sessão:'),
      el('span', { className: 'modal-name' }, s.title, el('small', {}, `${h.title} · ${s.id}`)),
      el('p', {}, 'Serão apagados o handoff, o log e as mensagens desta sessão. Essa ação não pode ser desfeita. Os arquivos do harness (pasta contexts) não são afetados.'),
      openCount ? el('p', {}, el('strong', {}, `${openCount} aba${openCount > 1 ? 's abertas' : ' aberta'} desta sessão ${openCount > 1 ? 'serão fechadas' : 'será fechada'}.`)) : null,
      el('p', {}, 'O histórico guardado pelo próprio Claude/Copilot não é apagado.')
    ].filter(Boolean)
  })
  if (!ok) return

  try {
    await window.hub.deleteSession(h.name, s.id)
  } catch (e) {
    toast(cleanError(e))
    return
  }
  // fecha na tela as abas que pertenciam à sessão
  for (const t of [...state.tabs.values()]) {
    if (t.session.id === s.id && t.harness.name === h.name) closeTab(t.termId)
  }
  toast(`Sessão "${s.title}" excluída`, 'ok')
  if (state.selected === h.name) { await renderLauncher(); if (!state.activeTab) showView('launcher') }
}

// ---------- navegador embutido (subtab com multi-abas internas) ----------
const BROWSER_REL = '__browser__'
let browserDrawing = null   // referência ao drawing ativo (apenas 1 por vez, na aba ativa)
let browserTabsData = []    // [ { id, url, title } ]
let browserActiveId = null
let browserFavorites = store.get('browser.favorites', [])
let browserHistory = store.get('browser.history', [])
let browserDownloads = []

function saveBrowserFavorites () {
  store.set('browser.favorites', browserFavorites)
}

function currentBrowserTab () {
  return browserTabsData.find(tab => tab.id === browserActiveId) || null
}

function recordBrowserHistory (data) {
  if (!data?.url || !/^https?:\/\//i.test(data.url)) return
  const last = browserHistory[0]
  if (last?.url === data.url && last.title === data.title) return
  browserHistory = [{ url: data.url, title: data.title || data.url, visitedAt: new Date().toISOString() },
    ...browserHistory.filter(item => item.url !== data.url)].slice(0, 100)
  store.set('browser.history', browserHistory)
}

function closeBrowserPanel () {
  if (!browserDrawing) return
  browserDrawing.panelMode = null
  browserDrawing.placeholder.replaceChildren()
  browserDrawing.browserMenu.classList.remove('open')
  browserDrawing.favoritesBtn.classList.remove('active')
  browserDrawing.historyBtn.classList.remove('active')
  browserDrawing.downloadsBtn.classList.remove('active')
  browserDrawing.homeBtn.classList.remove('active')
  browserDrawing.automationsBtn.classList.remove('active')
  showBrowserView()
}

function renderBrowserPanel (mode) {
  if (!browserDrawing) return
  window.hub.hideBrowser()
  browserDrawing.panelMode = mode
  browserDrawing.browserMenu.classList.remove('open')
  browserDrawing.placeholder.replaceChildren()
  for (const button of [browserDrawing.favoritesBtn, browserDrawing.historyBtn, browserDrawing.downloadsBtn, browserDrawing.homeBtn, browserDrawing.automationsBtn]) {
    button.classList.toggle('active', button.dataset.panel === mode)
  }
  const panel = el('div', { className: `browser-panel browser-panel-${mode}` })
  const title = mode === 'home' ? 'Página inicial' : mode === 'history' ? 'Histórico' : mode === 'downloads' ? 'Downloads' : mode === 'automations' ? 'Automações' : 'Favoritos'
  panel.append(el('div', { className: 'browser-panel-head' }, el('strong', {}, title)))
  const list = el('div', { className: 'browser-panel-list' })
  const items = mode === 'favorites' ? browserFavorites : mode === 'history' ? browserHistory : browserDownloads
  if (mode === 'automations') {
    fillAutomationsPanel(panel, list)
    panel.append(list)
    browserDrawing.placeholder.append(panel)
    return
  }
  if (mode === 'home') {
    const active = currentBrowserTab()
    const welcome = el('div', { className: 'browser-home' },
      el('strong', {}, 'Navegador HarnessHub'),
      el('span', {}, active?.url || 'Pesquise ou digite um endereço acima.'))
    panel.append(welcome)
  } else if (!items.length) {
    list.append(el('div', { className: 'browser-panel-empty' }, `Nenhum item em ${title.toLocaleLowerCase('pt-BR')}.`))
  } else {
    for (const item of items) {
      const label = item.title || item.filename || item.url
      const detail = item.url || item.path || `${item.state || ''} ${item.receivedBytes || 0}/${item.totalBytes || 0}`
      const open = el('button', { className: 'browser-panel-item', title: detail },
        el('strong', {}, label), el('span', {}, detail))
      if (item.url) open.onclick = async () => { await window.hub.browserNewTab(item.url); closeBrowserPanel() }
      if (mode === 'favorites') {
        const remove = el('button', { className: 'browser-panel-remove', title: 'Remover favorito' }, '×')
        remove.onclick = () => {
          browserFavorites = browserFavorites.filter(favorite => favorite.url !== item.url)
          saveBrowserFavorites()
          renderBrowserPanel('favorites')
        }
        list.append(el('div', { className: 'browser-panel-row' }, open, remove))
      } else list.append(open)
    }
  }
  panel.append(list)
  browserDrawing.placeholder.append(panel)
}

// Painel de automações: lista as receitas de contexts/navegador/automacoes/, executa e grava novas
const recordingName = () => `gravacao-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`

async function stopAutomationRecordingUi (t) {
  try { toast(`Receita salva em contexts/${await window.hub.stopAutomationRecording(t.harness.name, recordingName())}`, 'ok') } catch (e) { toast(cleanError(e)) }
}

async function fillAutomationsPanel (panel, list) {
  const t = browserDrawing.tab
  const recording = Boolean(browserDrawing.recording)
  const recBtn = el('button', { className: 'browser-panel-action' + (recording ? ' danger' : '') }, recording ? '■ Parar e salvar gravação' : '● Gravar cliques desta aba')
  recBtn.onclick = async () => {
    if (browserDrawing.recording) { await stopAutomationRecordingUi(t); renderBrowserPanel('automations'); return }
    try {
      closeBrowserPanel()
      await window.hub.startAutomationRecording()
      toast('Gravando: navegue, clique e preencha. Pare pela barra acima da página.', 'ok')
    } catch (e) { toast(cleanError(e)) }
  }
  const reload = el('button', { className: 'browser-panel-action' }, '↻ Atualizar')
  reload.onclick = () => renderBrowserPanel('automations')
  panel.querySelector('.browser-panel-head').append(el('div', { className: 'browser-panel-actions' }, recBtn, reload))
  list.append(el('div', { className: 'browser-panel-empty' }, 'Carregando...'))
  let recipes = []
  try { recipes = await window.hub.listAutomations(t.harness.name) } catch (e) { toast(cleanError(e)) }
  list.replaceChildren()
  if (!recipes.length) {
    list.append(el('div', { className: 'browser-panel-empty' }, 'Nenhuma receita em contexts/navegador/automacoes/. Grave uma, ou peça ao agente para criar (skill automacoes-navegador).'))
    return
  }
  for (const r of recipes) {
    const info = el('div', { className: 'browser-panel-item' }, el('strong', {}, r.name), el('span', {}, `${r.steps} passos${r.description ? ' · ' + r.description : ''}`))
    const run = el('button', { className: 'browser-panel-action', title: 'Executar na aba ativa' }, '▶ Executar')
    run.disabled = Boolean(r.invalid)
    run.onclick = async () => {
      closeBrowserPanel()
      try {
        const out = await window.hub.runAutomation(t.harness.name, r.rel)
        toast(out.saved.length ? `Concluída. ${out.saved.length} arquivo(s) salvo(s) em contexts/` : 'Automação concluída', 'ok')
      } catch (e) { toast(cleanError(e)) }
    }
    list.append(el('div', { className: 'browser-panel-row' }, info, run))
  }
}

// Indicador de automação/gravação na aba do navegador, com botão de parar
window.hub.onBrowserAutomation(data => {
  const d = browserDrawing
  if (!d) return
  if (data.recording !== undefined) d.recording = data.recording
  let text = ''
  let stop = null
  let failed = false
  if (data.ok === false && data.error) {
    failed = true
    text = `Automação "${data.name}" falhou: ${data.error}`
    stop = ['Fechar', () => { d.agentBar.classList.remove('active', 'error'); d.host.classList.remove('agent-active'); requestAnimationFrame(() => updateBrowserBounds()) }]
  } else if (data.running) {
    text = `Automação "${data.name}" em execução${data.total ? ` — passo ${data.step}/${data.total}` : ''}${data.message ? ` · ${data.message}` : ''}`
    stop = ['Parar', () => window.hub.cancelAutomation()]
  } else if (d.recording) {
    text = 'Gravando cliques e preenchimentos desta aba'
    stop = ['Parar e salvar', () => stopAutomationRecordingUi(d.tab)]
  }
  d.agentBar.replaceChildren()
  d.agentBar.classList.toggle('active', Boolean(text))
  d.agentBar.classList.toggle('error', failed)
  d.host.classList.toggle('agent-active', Boolean(text) && !failed)
  if (text) {
    const btn = el('button', { className: 'browser-agent-stop' }, stop[0])
    btn.onclick = stop[1]
    d.agentBar.append(el('span', { className: 'browser-agent-dot' }), el('span', { className: 'browser-agent-text' }, text), btn)
  }
  requestAnimationFrame(() => updateBrowserBounds())
})

function renderBrowserFavorites () {
  renderBrowserPanel('favorites')
}

function toggleBrowserFavorites () {
  if (browserDrawing?.panelMode === 'favorites') closeBrowserPanel()
  else renderBrowserFavorites()
}

function favoriteCurrentBrowserPage () {
  const tab = currentBrowserTab()
  if (!tab?.url || !/^https?:\/\//i.test(tab.url)) return
  const existing = browserFavorites.find(item => item.url === tab.url)
  if (existing) {
    browserFavorites = browserFavorites.filter(item => item.url !== tab.url)
    toast('Favorito removido', 'ok')
  } else {
    browserFavorites = [{ url: tab.url, title: tab.title || tab.url }, ...browserFavorites]
    toast('Página adicionada aos favoritos', 'ok')
  }
  saveBrowserFavorites()
  updateBrowserFavoriteButton()
  if (browserDrawing?.panelMode === 'favorites') renderBrowserFavorites()
}

function updateBrowserFavoriteButton () {
  if (!browserDrawing) return
  const tab = currentBrowserTab()
  const saved = Boolean(tab?.url && browserFavorites.some(item => item.url === tab.url))
  browserDrawing.favoriteBtn.textContent = saved ? '★' : '☆'
  browserDrawing.favoriteBtn.title = saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
}

function openBrowser (t) {
  let d = t.drawings.find(x => x.rel === BROWSER_REL)
  if (d) { setTabView(t, BROWSER_REL); return }

  // tab bar
  const tabbar = el('div', { className: 'browser-tabbar' })
  const tabsHost = el('div', { className: 'browser-tabs-scroll' })
  const mkMenuBtn = (cls, title, label, shortcut) => {
    const btn = el('button', { className: cls, title })
    btn.append(document.createTextNode(label))
    if (shortcut) btn.append(el('kbd', { className: 'browser-menu-kbd' }, shortcut))
    return btn
  }

  const favoritesBtn = mkMenuBtn('browser-favorites-tab', 'Abrir favoritos', '★ Favoritos', 'Ctrl+B')
  favoritesBtn.dataset.panel = 'favorites'
  favoritesBtn.onclick = () => toggleBrowserFavorites()
  const historyBtn = mkMenuBtn('browser-panel-btn', 'Abrir histórico', 'Histórico', 'Ctrl+H')
  historyBtn.dataset.panel = 'history'
  historyBtn.onclick = () => browserDrawing?.panelMode === 'history' ? closeBrowserPanel() : renderBrowserPanel('history')
  const downloadsBtn = mkMenuBtn('browser-panel-btn', 'Abrir downloads', 'Downloads', 'Ctrl+J')
  downloadsBtn.dataset.panel = 'downloads'
  downloadsBtn.onclick = () => browserDrawing?.panelMode === 'downloads' ? closeBrowserPanel() : renderBrowserPanel('downloads')
  const homeBtn = mkMenuBtn('browser-panel-btn', 'Página inicial', 'Início', '')
  homeBtn.dataset.panel = 'home'
  homeBtn.onclick = () => browserDrawing?.panelMode === 'home' ? closeBrowserPanel() : renderBrowserPanel('home')
  const automationsBtn = mkMenuBtn('browser-panel-btn', 'Receitas de automação do navegador', '⚙ Automações', '')
  automationsBtn.dataset.panel = 'automations'
  automationsBtn.onclick = () => browserDrawing?.panelMode === 'automations' ? closeBrowserPanel() : renderBrowserPanel('automations')
  const reopenBtn = mkMenuBtn('browser-panel-btn', 'Reabrir aba fechada', '↶ Reabrir fechada', 'Ctrl+Shift+T')
  reopenBtn.onclick = async () => {
    closeBrowserPanel()
    await window.hub.reopenBrowserClosedTab()
  }
  const newTabBtn = el('button', { className: 'browser-new-tab', title: 'Nova aba (Ctrl+T)' }, '+')
  newTabBtn.onclick = () => {
    closeBrowserPanel()
    window.hub.browserNewTab()
  }
  const browserMenu = el('div', { className: 'browser-menu' })
  const menuBtn = el('button', { className: 'browser-menu-btn', title: 'Menu do navegador' }, '☰')
  menuBtn.onclick = e => {
    e.stopPropagation()
    const opening = !browserMenu.classList.contains('open')
    browserMenu.classList.toggle('open', opening)
    if (opening) window.hub.hideBrowser()
    else showBrowserView()
  }
  // fecha menu ao clicar fora
  document.addEventListener('click', () => {
    if (!browserDrawing || !browserMenu.classList.contains('open')) return
    browserMenu.classList.remove('open')
    showBrowserView()
  })
  browserMenu.addEventListener('click', e => e.stopPropagation())
  browserMenu.append(favoritesBtn, historyBtn, downloadsBtn, homeBtn, automationsBtn, reopenBtn)
  tabbar.append(tabsHost, menuBtn, newTabBtn, browserMenu)

  // nav bar
  const btnBack = el('button', { className: 'browser-nav-btn', title: 'Voltar (Alt+←)' }, '←')
  const btnFwd = el('button', { className: 'browser-nav-btn', title: 'Avançar (Alt+→)' }, '→')
  const btnRel = el('button', { className: 'browser-nav-btn', title: 'Recarregar (Ctrl+R)' }, '↻')
  const favoriteBtn = el('button', { className: 'browser-nav-btn browser-favorite-btn', title: 'Adicionar aos favoritos (Ctrl+D)' }, '☆')
  const urlInput = el('input', { className: 'browser-url', type: 'text', placeholder: 'Endereço... (Ctrl+L)', spellcheck: false })
  const sendBtn = el('button', { className: 'browser-nav-btn', title: 'Enviar página (ou trecho selecionado) para o terminal' }, '⇥')
  const saveBtn = el('button', { className: 'browser-nav-btn', title: 'Salvar página em contexts/navegador/ (Markdown)' }, '⤓')
  sendBtn.onclick = () => sendBrowserPageToTerminal(t)
  saveBtn.onclick = () => saveBrowserPageToContexts(t)
  const navbar = el('div', { className: 'browser-navbar' }, btnBack, btnFwd, btnRel, favoriteBtn, urlInput, sendBtn, saveBtn)

  btnBack.onclick = () => window.hub.browserBack()
  btnFwd.onclick = () => window.hub.browserForward()
  btnRel.onclick = () => window.hub.browserReload()
  favoriteBtn.onclick = () => favoriteCurrentBrowserPage()
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); window.hub.navigateBrowser(urlInput.value) }
  })

  // placeholder — a WebContentsView se sobrepõe aqui
  const placeholder = el('div', { className: 'browser-placeholder' })

  const agentBar = el('div', { className: 'browser-agent-bar' })
  const host = el('div', { className: 'draw-host browser-host hidden' }, tabbar, navbar, agentBar, placeholder)
  d = { tab: t, agentBar, recording: false, kind: 'browser', rel: BROWSER_REL, name: 'Navegador', host, tabbar, tabsHost, browserMenu, menuBtn, navbar, urlInput, btnBack, btnFwd, favoriteBtn, favoritesBtn, historyBtn, downloadsBtn, homeBtn, automationsBtn, reopenBtn, placeholder, panelMode: null }
  t.drawPane.append(host)
  t.drawings.push(d)
  browserDrawing = d
  renderSubbar(t)
  setTabView(t, BROWSER_REL)

  // Espera o layout estabilizar, envia bounds, e SÓ ENTÃO cria/mostra as abas
  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      // garante que os bounds estejam no main ANTES de qualquer addChildView
      showBrowserView()
      const info = await window.hub.getBrowserTabs()
      if (!info || info.tabs.length === 0) await window.hub.browserNewTab()
      else { browserTabsData = info.tabs; browserActiveId = info.activeId; renderBrowserTabs() }
    })
  })
}

// Envia URL + título (e o trecho selecionado, se houver) ao terminal da aba, sem executar (colagem entre colchetes)
async function sendBrowserPageToTerminal (t) {
  if (!t.termId || t.exited) { toast('Nenhum terminal ativo nesta aba'); return }
  const info = await window.hub.extractBrowserPage()
  if (!info || !info.url) { toast('Nenhuma página aberta no navegador'); return }
  let msg = `Página do navegador: ${info.title || '(sem título)'} <${info.url}>`
  if (info.selection) msg += `\n\nTrecho selecionado:\n${info.selection}`
  window.hub.write(t.termId, `\x1b[200~${msg}\x1b[201~`)
  toast(info.selection ? 'Trecho enviado ao terminal' : 'Link enviado ao terminal', 'ok')
}

// Salva a página como Markdown em contexts/navegador/ (pasta padrão; dá para mover depois pelo explorador)
async function saveBrowserPageToContexts (t) {
  const info = await window.hub.extractBrowserPage()
  if (!info || !info.url) { toast('Nenhuma página aberta no navegador'); return }
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const slug = (info.title || new URL(info.url).hostname).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'pagina'
  const rel = `navegador/${slug}-${stamp}.md`
  let md = `# ${info.title || info.url}\n\n- URL: ${info.url}\n- Salvo em: ${now.toISOString()}\n\n`
  if (info.selection) md += `## Trecho selecionado\n\n${info.selection}\n\n`
  md += `## Conteúdo da página\n\n${info.text}\n`
  try {
    await window.hub.createEntry(t.harness.name, rel, false, md)
    toast(`Salvo em contexts/${rel}`, 'ok')
  } catch (e) { toast(cleanError(e)) }
}

function closeBrowser (t) {
  const d = t.drawings.find(x => x.rel === BROWSER_REL)
  if (!d) return
  window.hub.hideBrowser()
  d.host.remove()
  t.drawings = t.drawings.filter(x => x !== d)
  if (browserDrawing === d) browserDrawing = null
  if (t.view === BROWSER_REL) setTabView(t, 'term')
  else renderSubbar(t)
}

function renderBrowserTabs () {
  if (!browserDrawing) return
  const bar = browserDrawing.tabsHost
  bar.replaceChildren()
  for (const tab of browserTabsData) {
    const closeBtn = el('span', { className: 'browser-tab-close', title: 'Fechar aba' }, '×')
    closeBtn.onclick = e => { e.stopPropagation(); window.hub.browserCloseTab(tab.id) }
    const titleSpan = el('span', { className: 'browser-tab-title' }, tab.title || tab.url || 'Nova aba')
    let host = ''
    try { host = new URL(tab.url).hostname.replace(/^www\./, '') } catch {}
    const iconSpan = el('span', { className: 'browser-tab-icon' }, (host || tab.title || '+').charAt(0))
    const btn = el('button', { className: 'browser-tab' + (tab.id === browserActiveId ? ' active' : ''), title: tab.title || tab.url || 'Nova aba' }, iconSpan, titleSpan, closeBtn)
    btn.onclick = () => {
      closeBrowserPanel()
      window.hub.browserSwitchTab(tab.id)
      requestAnimationFrame(() => showBrowserView())
    }
    bar.append(btn)
  }
  updateBrowserFavoriteButton()
}

function browserInsets () {
  // Envia insets (margens) em vez de coordenadas absolutas — o main process
  // calcula bounds a partir de win.getContentBounds(), evitando mismatch de DPI.
  const pr = browserDrawing.placeholder.getBoundingClientRect()
  const ww = window.innerWidth
  const wh = window.innerHeight
  return {
    left: pr.left / ww,
    top: pr.top / wh,
    right: (ww - pr.right) / ww,
    bottom: (wh - pr.bottom) / wh
  }
}

function updateBrowserBounds () {
  if (!browserDrawing) return
  window.hub.setBrowserBounds(browserInsets())
}

function showBrowserView () {
  if (!browserDrawing || browserDrawing.panelMode) return
  window.hub.showBrowser(browserInsets())
}

// listeners do main process
window.hub.onBrowserNavigated(data => {
  if (!browserDrawing) return
  recordBrowserHistory(data)
  if (data.tabId === browserActiveId) {
    browserDrawing.urlInput.value = data.url || ''
    browserDrawing.btnBack.disabled = !data.canGoBack
    browserDrawing.btnFwd.disabled = !data.canGoForward
    updateBrowserFavoriteButton()
  }
  // atualiza título na lista de abas
  const tab = browserTabsData.find(t => t.id === data.tabId)
  if (tab) { tab.url = data.url; tab.title = data.title }
  renderBrowserTabs()
})

window.hub.onBrowserDownload(data => {
  const existing = browserDownloads.findIndex(item => item.id === data.id)
  if (existing >= 0) browserDownloads[existing] = data
  else browserDownloads.unshift(data)
  browserDownloads = browserDownloads.slice(0, 50)
  if (browserDrawing?.panelMode === 'downloads') renderBrowserPanel('downloads')
})

window.hub.onBrowserTabs(data => {
  browserTabsData = data.tabs
  browserActiveId = data.activeId
  renderBrowserTabs()
  // atualiza URL bar se a aba ativa mudou
  const active = browserTabsData.find(t => t.id === browserActiveId)
  if (active && browserDrawing) {
    browserDrawing.urlInput.value = active.url || ''
  }
})

// observer de resize para repositionar a WebContentsView
let browserResizeRAF = null
const browserResizeObs = new ResizeObserver(() => {
  if (browserResizeRAF) return
  browserResizeRAF = requestAnimationFrame(() => { browserResizeRAF = null; updateBrowserBounds() })
})

// ---------- terminais ----------
let opening = false
async function openSession (req) {
  if (opening) return // evita cliques duplos criando sessões repetidas
  opening = true
  document.querySelectorAll('.engine-card, .s-actions .btn').forEach(b => b.classList.add('busy'))
  let res
  try {
    res = await window.hub.openSession(req)
  } catch (e) {
    toast(cleanError(e))
    if (state.selected) renderLauncher() // atualiza a lista caso algo tenha sido criado
    return
  } finally {
    opening = false
    document.querySelectorAll('.busy').forEach(b => b.classList.remove('busy'))
  }
  if (res.alreadyOpen) { activateTab(res.alreadyOpen); return }

  $('#new-title').value = ''
  $('#new-workdir').value = ''
  createTab(res)
  sidebar.autoCollapse()
}

function createTab ({ termId, harness, session, tab }) {
  // Cada aba é um "grupo": subbarra (Terminal + desenhos) e, embaixo, terminal e desenho lado a lado
  const container = el('div', { className: 'term tab-group' })
  const subbar = el('div', { className: 'subbar hidden' })
  const termPane = el('div', { className: 'term-pane' })
  const splitter = el('div', { className: 'split-handle hidden', title: 'Arraste para redimensionar' })
  const drawPane = el('div', { className: 'draw-pane hidden' })
  container.append(subbar, el('div', { className: 'group-body' }, termPane, splitter, drawPane))
  $('#view-terms').append(container)

  const term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Cascadia Mono, Cascadia Code, Consolas, "DejaVu Sans Mono", monospace',
    fontSize: 13,
    scrollback: 10000,
    allowProposedApi: true,
    theme: TERM_THEME[document.documentElement.dataset.theme] || TERM_THEME.dark
  })
  const fit = new FitAddon.FitAddon()
  term.loadAddon(fit)
  term.open(termPane)
  term.onData(data => window.hub.write(termId, data))
  term.onResize(({ cols, rows }) => window.hub.resize(termId, cols, rows))

  // Ctrl+Shift+C / Ctrl+Shift+V para copiar e colar
  term.attachCustomKeyEventHandler(e => {
    if (e.type !== 'keydown' || !e.ctrlKey || !e.shiftKey) return true
    if (e.code === 'KeyC') { navigator.clipboard.writeText(term.getSelection()); return false }
    if (e.code === 'KeyV') { navigator.clipboard.readText().then(t => window.hub.write(termId, t)); return false }
    return true
  })

  const t = {
    termId, term, fit, container, exited: false,
    harness, session, tab,
    label: `${session.title} · ${ENGINE[tab.engine]?.label || tab.engine}`,
    subbar, termPane, drawPane, splitter,
    drawings: [],          // { rel, name, host, handle, lastWritten, saveTimer, previewTimer }
    view: 'term',          // 'term' ou o rel do desenho ativo
    maximized: false,      // desenho ocupando tudo (sem o terminal ao lado)
    splitPct: store.get('draw.splitPct', 42),
    lastActive: Date.now()
  }
  state.tabs.set(termId, t)
  setupSplitter(t)

  const pending = state.pendingData.get(termId)
  if (pending) { term.write(pending.join('')); state.pendingData.delete(termId) }

  renderTabs()
  activateTab(termId)

  // reabre os desenhos que esta aba tinha (guardados no handoff)
  for (const rel of tab.drawings || []) {
    if (MD_RE.test(rel)) openMarkdown(t, rel, { activate: false, persist: false })
    else if (SVG_RE.test(rel)) openSvg(t, rel, { activate: false, persist: false })
    else if (HTML_RE.test(rel)) openHtml(t, rel, { activate: false, persist: false })
    else if (MATHNOTE_RE.test(rel)) openMathnote(t, rel, { activate: false, persist: false })
    else if (PDF_RE.test(rel)) openPdf(t, rel, { activate: false, persist: false })
    else if (JSON_RE.test(rel) && !PATCH_RE.test(rel)) openJson(t, rel, { activate: false, persist: false })
    else openDrawing(t, rel, { activate: false, persist: false })
  }
}

function renderTabs () {
  const bar = $('#tabs')
  bar.replaceChildren()
  for (const t of state.tabs.values()) {
    const close = el('button', { className: 'tab-close', title: 'Fechar aba' }, '×')
    close.onclick = e => { e.stopPropagation(); closeTab(t.termId) }
    const b = el('button', {
      className: 'tab' + (t.termId === state.activeTab ? ' active' : '') + (t.exited ? ' exited' : ''),
      title: `${t.harness.title} · ${t.session.title} · ${t.tab.id} (${t.tab.engine})` +
        `${t.session.topics?.length ? `\ntópicos: ${t.session.topics.join(', ')}` : ''}` +
        `\nsession_id ${t.tab.session_id}`
    },
    engineIcon(t.tab.engine, 12),
    el('span', { className: 'tab-label' }, t.label),
    close)
    b.onclick = () => activateTab(t.termId)
    b.onauxclick = e => { if (e.button === 1) { e.preventDefault(); closeTab(t.termId) } }
    bar.append(b)
  }
  $('#tabbar').classList.toggle('hidden', state.tabs.size === 0)
}

function activateTab (termId) {
  if (!state.tabs.has(termId)) return
  state.activeTab = termId
  for (const t of state.tabs.values()) t.container.classList.toggle('hidden-term', t.termId !== termId)
  state.tabs.get(termId).lastActive = Date.now()
  renderTabs()
  showView('terms')
  const t = state.tabs.get(termId)
  showExplorerFor(t.harness.name)
  initGraph3D()

  // browser: mostrar se a aba ativa tem browser visível, senão esconder
  const hasBrowser = t.view === BROWSER_REL && t.drawings.some(x => x.rel === BROWSER_REL)
  if (hasBrowser) {
    const d = t.drawings.find(x => x.rel === BROWSER_REL)
    if (d) { browserDrawing = d; requestAnimationFrame(() => showBrowserView()) }
  } else {
    window.hub.hideBrowser()
  }

  requestAnimationFrame(() => {
    fitActive()
    if (t.view === 'term') t.term.focus()
    else { const d = t.drawings.find(x => x.rel === t.view); if (d?.kind === 'draw') d.handle?.reveal() }
  })
}

function closeTab (termId) {
  const t = state.tabs.get(termId)
  if (!t) return
  // esconde browser se a aba sendo fechada o tem
  if (t.drawings.some(x => x.rel === BROWSER_REL)) { window.hub.hideBrowser(); browserDrawing = null }
  window.hub.kill(termId)
  for (const d of t.drawings) { if (d.kind === 'browser') continue; flushSave(t, d); try { d.kind === 'md' ? d.editor?.destroy() : d.handle?.destroy() } catch {} }
  t.term.dispose()
  t.container.remove()
  state.tabs.delete(termId)
  if (state.activeTab === termId) {
    const last = [...state.tabs.keys()].pop()
    if (last) activateTab(last)
    else { state.activeTab = null; renderTabs(); initGraph3D(); state.selected ? (renderLauncher(), showView('launcher')) : showView('empty') }
  } else {
    renderTabs()
  }
}

function fitActive () {
  const t = state.tabs.get(state.activeTab)
  if (!t || $('#view-terms').classList.contains('hidden')) return
  try { t.fit.fit() } catch {}
}

window.hub.onData(({ id, data }) => {
  const t = state.tabs.get(id)
  if (t) t.term.write(data)
  else state.pendingData.set(id, [...(state.pendingData.get(id) || []), data])
})

window.hub.onExit(({ id, code }) => {
  const t = state.tabs.get(id)
  if (!t) return
  t.exited = true
  t.term.write(`\r\n\x1b[90m[terminal encerrado · código ${code}]\x1b[0m\r\n`)
  renderTabs()
})

// ---------- configurações ----------
// Rascunho: as escolhas ficam aqui até clicar em Salvar
const settingsDraft = { saved: null, changes: {} }

async function openSettings () {
  settingsDraft.changes = {}
  await renderSettings()
  showView('settings')
}

function draftValue (key) {
  if (key in settingsDraft.changes) return settingsDraft.changes[key]
  return key.split('.').reduce((o, k) => o?.[k], settingsDraft.saved)
}

function setDraft (key, value) {
  const saved = key.split('.').reduce((o, k) => o?.[k], settingsDraft.saved)
  if (JSON.stringify(value) === JSON.stringify(saved)) delete settingsDraft.changes[key]
  else settingsDraft.changes[key] = value
  renderSettingsForm()
}

function renderSettingsStatus () {
  const dirty = Object.keys(settingsDraft.changes).length > 0
  const enabled = draftValue('engine.enabled') || []
  const valid = enabled.length > 0 && enabled.includes(draftValue('engine.default'))
  $('#btn-settings-save').disabled = !dirty || !valid
  $('#btn-settings-discard').disabled = !dirty
  const status = $('#settings-status')
  status.textContent = !enabled.length ? 'Mantenha pelo menos um CLI ativo'
    : !valid ? 'Selecione um motor padrão ativo' : dirty ? 'Alterações não salvas' : 'Tudo salvo'
  status.classList.toggle('dirty', dirty)
}

async function renderSettings () {
  let data
  try { data = await window.hub.getSettings() } catch (e) { toast(e.message); return }
  const { settings, warnings, file } = data
  if (warnings?.length) toast('Configurações: ' + warnings.join(' · '))
  await refreshEngines().catch(() => {})
  $('#settings-file').textContent = file
  settingsDraft.saved = settings
  renderSettingsForm()

  // harnesses que ignoram esta configuração por terem padrão próprio
  await refreshHarnesses()
  renderUsage()
  const own = state.harnesses.filter(h => h.engines.defaultFrom === 'harness')
  $('#settings-overrides').textContent = own.length
    ? `Com motor próprio no harness.yaml (não seguem esta opção): ${own.map(h => `${h.title} → ${ENGINE[h.engines.default].label}`).join(', ')}`
    : 'Todos os harnesses seguem esta opção.'
}

function renderSettingsForm () {
  const current = draftValue('engine.default')
  const enabled = draftValue('engine.enabled') || []
  const toggles = $('#settings-enabled-engines')
  toggles.replaceChildren()
  for (const engine of Object.keys(ENGINE)) {
    const input = el('input', { type: 'checkbox', checked: enabled.includes(engine) })
    input.onchange = () => setDraft('engine.enabled',
      Object.keys(ENGINE).filter(id => id === engine ? input.checked : enabled.includes(id)))
    toggles.append(el('label', { className: 'engine-toggle' }, input,
      el('span', {}, el('strong', {}, ENGINE[engine].label),
        el('small', {}, ENGINE[engine].sub))))
  }
  const box = $('#settings-engines')
  box.replaceChildren()
  for (const engine of Object.keys(ENGINE)) {
    const selected = engine === current
    const card = el('button', {
      className: `engine-card selectable ${engine}` + (selected ? ' selected' : ''),
      role: 'radio',
      disabled: !enabled.includes(engine),
      ariaChecked: String(selected)
    },
    el('span', { className: 'e-check' }),
    el('span', { className: 'e-name' }, engineIcon(engine), ENGINE[engine].label),
    el('span', { className: 'e-sub' }, ENGINE[engine].sub))
    card.onclick = () => setDraft('engine.default', engine)
    box.append(card)
  }

  const hidden = draftValue('usage.hidden') || []
  const usageBox = $('#settings-usage-engines')
  usageBox.replaceChildren()
  for (const engine of Object.keys(ENGINE)) {
    const active = enabled.includes(engine)
    const input = el('input', { type: 'checkbox', checked: active && !hidden.includes(engine), disabled: !active })
    input.onchange = () => setDraft('usage.hidden',
      Object.keys(ENGINE).filter(id => id === engine ? !input.checked : hidden.includes(id)))
    usageBox.append(el('label', { className: 'engine-toggle' + (active ? '' : ' off') }, input,
      el('span', {}, el('strong', {}, ENGINE[engine].label),
        el('small', {}, !active ? 'CLI inativo' : ENGINE[engine].usage ? 'com leitura de uso' : 'sem integração de uso'))))
  }
  renderSettingsStatus()
}

let savingSettings = false
async function saveSettings () {
  if (savingSettings) return
  savingSettings = true
  try {
    await persistSettings()
  } finally {
    savingSettings = false
  }
}

async function persistSettings () {
  const changes = { ...settingsDraft.changes }
  if (!Object.keys(changes).length) return
  const enabled = draftValue('engine.enabled') || []
  if (!enabled.length || !enabled.includes(draftValue('engine.default'))) {
    toast('Mantenha pelo menos um CLI ativo e selecione um padrão ativo.')
    return
  }
  const disabled = (settingsDraft.saved.engine.enabled || []).filter(id => !enabled.includes(id))
  let confirmClose = false
  if (disabled.length) {
    confirmClose = await confirmDialog({
      title: 'Desativar CLIs?',
      confirmLabel: 'Desativar e encerrar terminais',
      body: [
        el('p', {}, `Desativar ${disabled.map(id => ENGINE[id].label).join(', ')} encerrará todos os terminais abertos desses CLIs, incluindo operações em andamento.`),
        el('p', {}, 'As sessões e seus arquivos serão preservados. Novas sessões e retomadas ficam bloqueadas até reativar o CLI.')
      ]
    })
    if (!confirmClose) return
  }
  $('#btn-settings-save').disabled = true
  try {
    const result = await window.hub.saveSettings(changes, confirmClose)
    settingsDraft.changes = {}
    for (const id of result.killed || []) closeTab(id)
    showView('settings')
    toast('Configurações salvas', 'ok')
  } catch (e) {
    toast(cleanError(e))
  }
  await renderSettings()
}

function discardSettings () {
  settingsDraft.changes = {}
  renderSettingsForm()
}

// Ctrl+S salva quando a tela de configurações está aberta
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('#view-settings').classList.contains('hidden')) {
    e.preventDefault()
    saveSettings()
  }
})

// ---------- inicialização ----------
$('#btn-settings').onclick = () => openSettings()
$('#btn-settings-save').onclick = () => saveSettings()
$('#btn-settings-discard').onclick = () => discardSettings()
function toggleExplorer () { explorer.open = !explorer.open; store.set('explorer.open', explorer.open); applyExplorerLayout() }
$('#btn-explorer').onclick = toggleExplorer
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !e.shiftKey && !e.altKey) { e.preventDefault(); toggleExplorer() } })
$('#ex-close').onclick = () => { explorer.open = false; store.set('explorer.open', false); applyExplorerLayout() }
$('#ex-refresh').onclick = async () => { const h = explorer.harness; if (!h) return; explorer.harness = null; for (const k of [...explorer.cache.keys()]) if (k.startsWith(h + '|')) explorer.cache.delete(k); await showExplorerFor(h) }
$('#ex-new-drawing').onclick = () => newDrawing(targetFolder())
$('#ex-new-file').onclick = () => startCreate(targetFolder(), false)
$('#ex-new-folder').onclick = () => startCreate(targetFolder(), true)
$('#ex-collapse').onclick = () => { if (!explorer.harness) return; exExpanded(explorer.harness).clear(); saveExpanded(explorer.harness); renderExplorer() }
$('#ex-root').onclick = () => { if (explorer.harness) window.hub.revealFile(explorer.harness, '') }
$('#btn-usage-refresh').onclick = () => window.hub.refreshUsage()
window.hub.onUsage(st => renderUsage(st))
window.hub.getUsage().then(renderUsage).catch(() => {})
setInterval(() => renderUsage(), 30000) // atualiza o "há X min"
$('#toast-close').onclick = () => $('#toast').classList.add('hidden')
$('#btn-toggle').onclick = () => sidebar.toggle()
$('#btn-pin').onclick = () => sidebar.togglePin()
$('#btn-new-harness').onclick = () => createHarnessDialog()
$('#btn-browse-workdir').onclick = async () => {
  const folder = await window.hub.browseFolder()
  if (folder) $('#new-workdir').value = folder
}
$('#btn-browse-harness-workdir').onclick = async () => {
  const folder = await window.hub.browseFolder()
  if (!folder || !state.selected) return
  try {
    const updated = await window.hub.setHarnessWorkdir(state.selected, folder)
    const idx = state.harnesses.findIndex(x => x.name === state.selected)
    if (idx >= 0) state.harnesses[idx] = updated
    $('#harness-workdir').value = updated.workdir
    toast('Diretorio padrão atualizado')
  } catch (e) { toast(cleanError(e)) }
}
$('#btn-clear-harness-workdir').onclick = async () => {
  if (!state.selected) return
  try {
    const updated = await window.hub.setHarnessWorkdir(state.selected, null)
    const idx = state.harnesses.findIndex(x => x.name === state.selected)
    if (idx >= 0) state.harnesses[idx] = updated
    $('#harness-workdir').value = updated.workdir || updated.path
    toast('Diretorio padrão restaurado para pasta do harness')
  } catch (e) { toast(cleanError(e)) }
}
// toolbar: miniapps (movido do sidebar)
$('#tb-miniapps').onclick = () => openMiniappCatalog()

// toolbar: navegador
$('#tb-browser').onclick = () => {
  const t = state.tabs.get(state.activeTab)
  if (!t) { toast('Abra uma sessão antes de usar o navegador'); return }
  const hasBrowser = t.drawings.some(x => x.rel === BROWSER_REL)
  if (hasBrowser) closeBrowser(t)
  else openBrowser(t)
}

// toolbar: tema
const TERM_THEME = {
  dark: {
    background: '#0d0e11', foreground: '#e6e8ec', cursor: '#e6e8ec',
    selectionBackground: '#3a4252',
    scrollbarSliderBackground: 'rgba(139,147,161,0.20)',
    scrollbarSliderHoverBackground: 'rgba(139,147,161,0.38)',
    scrollbarSliderActiveBackground: 'rgba(139,147,161,0.50)',
  },
  light: {
    background: '#f8f9fb', foreground: '#1a1c22', cursor: '#1a1c22',
    selectionBackground: 'rgba(75,110,245,0.25)',
    black: '#1a1c22', red: '#c0392b', green: '#2d7a4f', yellow: '#a06820',
    blue: '#3050a0', magenta: '#7a3090', cyan: '#2070a0', white: '#8898aa',
    brightBlack: '#5a6275', brightRed: '#e5484d', brightGreen: '#4aaa74',
    brightYellow: '#c07a28', brightBlue: '#4b6ef5', brightMagenta: '#9050b8',
    brightCyan: '#3090c0', brightWhite: '#2d3a5a',
    scrollbarSliderBackground: 'rgba(100,110,130,0.20)',
    scrollbarSliderHoverBackground: 'rgba(100,110,130,0.40)',
    scrollbarSliderActiveBackground: 'rgba(100,110,130,0.55)',
  }
}

function applyTheme (theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('hub-theme', theme)
  const icon = theme === 'light' ? '🌙' : '☀'
  $('#tb-theme-icon').textContent = icon
  $('#tb-theme').title = theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'
  // terminais
  const termTheme = TERM_THEME[theme] || TERM_THEME.dark
  for (const t of state.tabs.values()) {
    if (t.term) t.term.options.theme = termTheme
  }
  // notifica graph3d
  if (graph3d.renderer) graph3d.renderer.applyTheme(theme === 'dark')
  // força redraw do mathnote em todas as abas abertas
  for (const t of state.tabs.values()) {
    for (const d of t.drawings) {
      if (d.kind === 'mathnote') d.instance?.getState && (() => { try { d.instance.getState().onChange?.() } catch {} })()
    }
  }
}
$('#tb-theme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
// ícone inicial
$('#tb-theme-icon').textContent = savedTheme === 'light' ? '🌙' : '☀'
$('#tb-theme').title = savedTheme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'

// toolbar: fullscreen
async function updateFsIcon () {
  const fs = await window.hub.isFullscreen()
  $('#tb-fs-icon').textContent = fs ? '⛶' : '⛶'
  $('#tb-fullscreen').title = fs ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'
  // esconder titlebar em fullscreen
  const tb = document.getElementById('titlebar')
  if (tb) tb.style.display = fs ? 'none' : ''
}
$('#tb-fullscreen').onclick = async () => { await window.hub.toggleFullscreen(); updateFsIcon() }
document.addEventListener('keydown', e => { if (e.key === 'F11') { e.preventDefault(); window.hub.toggleFullscreen().then(updateFsIcon) } })
updateFsIcon()

// titlebar: window controls
document.getElementById('tb-min')?.addEventListener('click', () => window.hub.minimizeWindow())
document.getElementById('tb-max')?.addEventListener('click', async () => {
  await window.hub.maximizeWindow()
  updateMaxIcon()
})
document.getElementById('tb-close')?.addEventListener('click', () => window.hub.closeWindow())
async function updateMaxIcon () {
  const max = await window.hub.isMaximized()
  const btn = document.getElementById('tb-max')
  if (!btn) return
  btn.title = max ? 'Restaurar' : 'Maximizar'
  btn.innerHTML = max
    ? '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="0.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x="0.5" y="3" width="8" height="8" rx="1.5" fill="var(--panel)" stroke="currentColor" stroke-width="1"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>'
}
updateMaxIcon()


$('#miniapps-search').oninput = event => renderMiniappCatalog(event.target.value)
$('#miniapps-modal-close').onclick = () => closeMiniappCatalog()
$('#miniapps-modal').onclick = event => {
  if (event.target === $('#miniapps-modal')) closeMiniappCatalog()
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#miniapps-modal').classList.contains('hidden')) {
    event.preventDefault()
    closeMiniappCatalog()
  }
}, true)

// Redireciona Ctrl+C/V/Z para o canvasWrap do mathnote quando ele não tem foco
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key !== 'c' && key !== 'v' && key !== 'z') return
  // só quando a view ativa é um mathnote
  const t = state.tabs.get(state.activeTab)
  if (!t || t.view === 'term') return
  const d = t.drawings.find(x => x.rel === t.view)
  if (!d || d.kind !== 'mathnote') return
  const active = document.activeElement
  const wrap = d.host.querySelector('[tabindex="0"]')
  if (!wrap) return
  // se o foco já está no canvasWrap, deixar o evento fluir normalmente
  if (active === wrap) return
  // se o foco está num input de edição do mathnote, deixar o input tratar (copiar texto)
  if (active && (active.classList.contains('mn-input') || active.classList.contains('mn-text-input') || active.classList.contains('mn-palette-search') || active.classList.contains('mn-ac-search'))) return
  // qualquer outro caso: foca o canvasWrap e re-dispara o evento
  wrap.focus()
  wrap.dispatchEvent(new KeyboardEvent('keydown', {
    key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey,
    shiftKey: e.shiftKey, altKey: e.altKey, bubbles: true, cancelable: true
  }))
  e.preventDefault()
  e.stopPropagation()
}, true)
// Atalhos de teclado do navegador embutido
document.addEventListener('keydown', e => {
  if (!browserDrawing) return
  const t = state.tabs.get(state.activeTab)
  if (!t || t.view !== BROWSER_REL) return
  const ctrl = e.ctrlKey || e.metaKey

  // fecha menu aberto com Escape
  if (e.key === 'Escape' && browserDrawing.browserMenu.classList.contains('open')) {
    browserDrawing.browserMenu.classList.remove('open')
    showBrowserView()
    e.preventDefault(); return
  }
  if (!ctrl && !e.altKey) return

  // Alt+← / Alt+→ — voltar / avançar
  if (e.altKey && !ctrl && e.key === 'ArrowLeft') { window.hub.browserBack(); e.preventDefault(); return }
  if (e.altKey && !ctrl && e.key === 'ArrowRight') { window.hub.browserForward(); e.preventDefault(); return }

  if (!ctrl) return
  const key = e.key.toLowerCase()

  if (key === 't' && !e.shiftKey) { closeBrowserPanel(); window.hub.browserNewTab(); e.preventDefault(); return }
  if (key === 'w') { window.hub.browserCloseTab(browserActiveId); e.preventDefault(); return }
  if (key === 't' && e.shiftKey) { closeBrowserPanel(); window.hub.reopenBrowserClosedTab(); e.preventDefault(); return }
  if (key === 'h') { browserDrawing?.panelMode === 'history' ? closeBrowserPanel() : renderBrowserPanel('history'); e.preventDefault(); return }
  if (key === 'b') { toggleBrowserFavorites(); e.preventDefault(); return }
  if (key === 'd') { favoriteCurrentBrowserPage(); e.preventDefault(); return }
  if (key === 'j') { browserDrawing?.panelMode === 'downloads' ? closeBrowserPanel() : renderBrowserPanel('downloads'); e.preventDefault(); return }
  if (key === 'l') { browserDrawing.urlInput.select(); browserDrawing.urlInput.focus(); e.preventDefault(); return }
  if (key === 'r' || e.key === 'F5') { window.hub.browserReload(); e.preventDefault(); return }
}, true)

$('#btn-new-tab').onclick = async () => {
  if (!state.selected) { showView('empty'); return }
  await renderLauncher()
  showView('launcher')
  $('#new-title').focus()
}
$('#new-title').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const h = state.harnesses.find(x => x.name === state.selected)
    if (h?.engines.default) openSession({ harness: h.name, newSession: { title: e.target.value, workdir: $('#new-workdir').value.trim() || null }, engine: h.engines.default })
  }
})

// ---------- painel 3D (dentro do explorador de arquivos) ----------
const graph3d = { renderer: null, harness: null, expanded: false }

async function initGraph3D () {
  const harness = state.tabs.get(state.activeTab)?.harness.name
  if (!harness) { setGraph3DExpanded(false); return }
  if (graph3d.harness === harness) return
  graph3d.harness = harness
  try {
    const structure = await window.hub.getHarnessStructure(harness)
    if (graph3d.harness !== harness) return
    graph3d.renderer?.dispose()
    graph3d.renderer = new Graph3DRenderer($('#graph3d-container'), new HarnessGraph(structure), {
      onPick: revealFromGraph,
      onContextMenu: showGraph3DColorMenu
    })
    // restaurar cores persistidas
    const saved = store.get(`graph3d.colors.${harness}`, {})
    for (const [id, hex] of Object.entries(saved)) graph3d.renderer.setFolderColor(id, hex)
    graph3d.renderer.setExpanded(graph3d.expanded)
    $('#graph3d-panel').classList.remove('hidden')
    // reload topics for this harness
    topics.loaded = []; topics.active = new Set(); topics.visible = false
    $('#graph3d-topics').classList.add('hidden')
    $('#graph3d-topics-btn').classList.remove('active')
    $('#graph3d-topics').replaceChildren()
  } catch (e) {
    graph3d.harness = null
    console.error('Painel 3D erro:', e)
  }
}

// ---------- menu de cores do grafo 3D ----------
const GRAPH_COLORS = [
  { hex: '#e5484d', label: 'Vermelho' },
  { hex: '#f76b15', label: 'Laranja' },
  { hex: '#f5d90a', label: 'Amarelo' },
  { hex: '#30a46c', label: 'Verde' },
  { hex: '#0091ff', label: 'Azul' },
  { hex: '#6e56cf', label: 'Roxo' },
  { hex: '#e93d82', label: 'Rosa' },
  { hex: '#b9babf', label: 'Cinza' }
]

function showGraph3DColorMenu (e, node) {
  const menu = $('#ctx-menu')
  const h = graph3d.harness
  const colorRow = el('div', { className: 'ctx-colors' })
  for (const c of GRAPH_COLORS) {
    const swatch = el('button', { className: 'ctx-swatch', title: c.label, style: `background:${c.hex}` })
    swatch.onclick = ev => {
      ev.stopPropagation()
      hideContextMenu()
      applyGraph3DColor(h, node, c.hex)
    }
    colorRow.append(swatch)
  }
  const clear = el('button', { role: 'menuitem' }, 'Remover cor')
  clear.onclick = ev => {
    ev.stopPropagation()
    hideContextMenu()
    applyGraph3DColor(h, node, null)
  }
  menu.replaceChildren(
    el('div', { className: 'ctx-label' }, `Cor: ${node.name}`),
    colorRow,
    el('div', { className: 'ctx-sep' }),
    clear
  )
  menu.classList.remove('hidden')
  const r = menu.getBoundingClientRect()
  menu.style.left = `${Math.min(e.clientX, window.innerWidth - r.width - 8)}px`
  menu.style.top = `${Math.min(e.clientY, window.innerHeight - r.height - 8)}px`
}

function applyGraph3DColor (harness, node, hex) {
  if (!graph3d.renderer) return
  graph3d.renderer.setFolderColor(node.id, hex)
  // persistir
  const key = `graph3d.colors.${harness}`
  const saved = store.get(key, {})
  // aplicar a todos os filhos recursivamente
  const walk = n => {
    if (hex) saved[n.id] = hex; else delete saved[n.id]
    for (const c of n.children) walk(c)
  }
  walk(node)
  store.set(key, saved)
}

function setGraph3DExpanded (expanded) {
  graph3d.expanded = expanded
  $('#graph3d-panel').classList.toggle('expanded', expanded)
  $('#graph3d-expand').textContent = expanded ? '⤡' : '⤢'
  $('#graph3d-expand').title = expanded ? 'Voltar ao canto' : 'Expandir'
  graph3d.renderer?.setExpanded(expanded)
}

$('#graph3d-expand').addEventListener('click', () => setGraph3DExpanded(!graph3d.expanded))

// Clique no grafo 3D: pastas abrem/fecham no explorador; arquivos abrem no viewer adequado.
async function revealFromGraph (node, open) {
  const h = explorer.harness
  if (!h || h !== graph3d.harness) return
  let root = node
  while (root.parent) root = root.parent
  const prefix = `${root.id}/contexts`
  const inContexts = node.id === prefix || node.id.startsWith(prefix + '/')

  // Arquivo fora de contexts/ (skills, agents, etc.): abre read-only no viewer
  if (!inContexts && node.isFile) {
    if (graph3d.expanded) setGraph3DExpanded(false)
    const t = state.tabs.get(state.activeTab)
    if (!t || t.harness.name !== h) return
    // rel a partir da raiz do harness: remove "harness-name/" do início do id
    const harnessRel = node.id.slice(root.id.length + 1)
    const name = harnessRel.split('/').pop()
    const text = await window.hub.readHarnessFile(h, harnessRel)
    if (text == null) { toast(`Arquivo não encontrado: ${harnessRel}`); return }
    // usar o harnessRel como identificador da subaba (prefixado para não colidir com contexts/)
    const viewRel = `~${harnessRel}`
    if (MD_RE.test(name)) await openMarkdown(t, viewRel, { text, readOnly: true })
    else if (SVG_RE.test(name)) await openSvg(t, viewRel, { text, readOnly: true })
    else if (HTML_RE.test(name)) await openHtml(t, viewRel, { text, readOnly: true })
    else window.hub.openFile(h, harnessRel).catch(e => toast(cleanError(e)))
    return
  }
  // Nó fora de contexts/ que não é arquivo (pasta): toggle no grafo, sem ação no explorador
  if (!inContexts) return

  if (!explorer.open) { explorer.open = true; store.set('explorer.open', true); applyExplorerLayout() }
  const rel = node.id.slice(prefix.length + 1)
  const set = exExpanded(h)
  if (rel) {
    const parts = rel.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      set.add(dir)
      if (!explorer.cache.has(exKey(h, dir))) await loadDir(h, dir).catch(() => {})
    }
    // arquivo: minimiza o grafo e abre no viewer (mesmo comportamento do duplo clique no explorador)
    if (node.isFile) {
      if (graph3d.expanded) setGraph3DExpanded(false)
      const t = state.tabs.get(state.activeTab)
      if (t && t.harness.name === h) {
        const name = rel.split('/').pop()
        if (DRAW_RE.test(name)) openDrawing(t, rel)
        else if (MD_RE.test(name)) openMarkdown(t, rel)
        else if (SVG_RE.test(name)) openSvg(t, rel)
        else if (HTML_RE.test(name)) openHtml(t, rel)
        else if (MATHNOTE_RE.test(name)) openMathnote(t, rel)
        else if (PDF_RE.test(name)) openPdf(t, rel)
        else window.hub.openFile(h, rel).catch(e => toast(cleanError(e)))
      }
    } else {
      if (open == null) open = !set.has(rel)
      if (open) { set.add(rel); await loadDir(h, rel).catch(() => {}) } else set.delete(rel)
      saveExpanded(h)
    }
  }
  explorer.selected = rel || null
  renderExplorer()
  const row = rel && [...document.querySelectorAll('#ex-tree .ex-row')].find(r => r.title === rel)
  if (row) row.scrollIntoView({ block: 'nearest' })
  else $('#ex-tree').scrollTop = 0
}

// Relê as pastas do harness e atualiza o grafo sem perder ramos abertos nem a posição das esferas.
async function refreshGraph3D () {
  const harness = graph3d.harness
  if (!harness || !graph3d.renderer) return initGraph3D()
  const btn = $('#graph3d-reload')
  btn.classList.add('spinning')
  try {
    const structure = await window.hub.getHarnessStructure(harness)
    if (graph3d.harness === harness && graph3d.renderer) graph3d.renderer.setGraph(new HarnessGraph(structure))
  } catch (e) {
    toast(`Não foi possível recarregar a estrutura: ${cleanError(e)}`)
  } finally {
    setTimeout(() => btn.classList.remove('spinning'), 400)
  }
}
$('#graph3d-reload').addEventListener('click', refreshGraph3D)
$('#graph3d-toggle-all').addEventListener('click', () => {
  if (!graph3d.renderer) return
  const g = graph3d.renderer.graph
  if (g.isAllOpen()) {
    g.collapseAll()
    $('#graph3d-toggle-all').textContent = '⊞'
    $('#graph3d-toggle-all').title = 'Expandir tudo'
  } else {
    g.openAll(g.root)
    $('#graph3d-toggle-all').textContent = '⊟'
    $('#graph3d-toggle-all').title = 'Recolher tudo'
  }
  graph3d.renderer.sync()
})

$('#graph3d-center').addEventListener('click', () => {
  if (!graph3d.renderer) return
  graph3d.renderer.zoom = 1
  graph3d.renderer.focusTarget.set(0, 0, 0)
})

// Mudanças na files/ (criar, excluir, renomear) atualizam o grafo sozinhas, agrupadas.
let graph3dRefreshTimer
window.hub.onFilesChanged(({ harness }) => {
  if (harness !== graph3d.harness) return
  clearTimeout(graph3dRefreshTimer)
  graph3dRefreshTimer = setTimeout(() => { refreshGraph3D(); if (topics.visible) loadTopics() }, 600)
})
// O vigia só olha a files/; ao voltar para o app, relê tudo (pastas apagadas pelo Explorer do Windows, por ex.).
window.addEventListener('focus', () => {
  clearTimeout(graph3dRefreshTimer)
  graph3dRefreshTimer = setTimeout(refreshGraph3D, 300)
})
document.addEventListener('keydown', e => { if (e.key === 'Escape' && graph3d.expanded) setGraph3DExpanded(false) })

// ---------- topics: overlay virtual sobre o grafo 3D ----------
const topics = { loaded: [], active: new Set(), visible: false }

async function loadTopics () {
  const harness = graph3d.harness
  if (!harness) return
  try {
    const result = await window.hub.listFiles(harness, '_topics')
    const entries = result?.entries || result || []
    const ymls = entries.filter(e => e.name.endsWith('.topic.yml'))
    const loaded = []
    for (const entry of ymls) {
      const text = await window.hub.readHarnessFile(harness, `contexts/_topics/${entry.name}`)
      if (!text) continue
      const topic = parseTopicYml(text, entry.name)
      if (topic) loaded.push(topic)
    }
    topics.loaded = loaded
    renderTopicChips()
    applyTopicHighlight()
  } catch (e) { console.warn('Topics load error:', e) }
}

function parseTopicYml (text, filename) {
  const lines = text.split('\n')
  const topic = { id: filename.replace('.topic.yml', ''), name: '', color: '#888', status: '', files: [], tags: [] }
  let inFiles = false, inTags = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('name:')) { topic.name = trimmed.slice(5).trim(); inFiles = false; inTags = false }
    else if (trimmed.startsWith('color:')) { topic.color = trimmed.slice(6).trim().replace(/['"]/g, ''); inFiles = false; inTags = false }
    else if (trimmed.startsWith('status:')) { topic.status = trimmed.slice(7).trim(); inFiles = false; inTags = false }
    else if (trimmed === 'files:') { inFiles = true; inTags = false }
    else if (trimmed === 'tags:') { inTags = true; inFiles = false }
    else if (trimmed.startsWith('related:') || trimmed.startsWith('description:')) { inFiles = false; inTags = false }
    else if (inFiles && trimmed.startsWith('- ')) {
      const f = trimmed.slice(2).trim()
      if (!f.startsWith('#')) topic.files.push(f)
    }
    else if (inTags && trimmed.startsWith('- ')) topic.tags.push(trimmed.slice(2).trim())
  }
  return topic.name ? topic : null
}

function resolveTopicNodeIds (topic) {
  const harness = graph3d.harness
  if (!harness) return new Set()
  const ids = new Set()
  for (const f of topic.files) {
    const rel = f.replace(/^(\.\.\/)+/g, '')
    ids.add(`${harness}/contexts/${rel}`)
  }
  return ids
}

function renderTopicChips () {
  const container = $('#graph3d-topics')
  container.replaceChildren()
  if (topics.loaded.length === 0) {
    container.append(el('span', { className: 'graph3d-topic-empty' }, 'No topics found in _topics/'))
    return
  }
  for (const topic of topics.loaded) {
    const isActive = topics.active.has(topic.id)
    const chip = el('button', {
      className: `graph3d-topic-chip${isActive ? ' active' : ''}`,
      title: `${topic.name} — ${topic.files.length} files\nClick to ${isActive ? 'hide' : 'show'}`,
    },
      el('span', { className: 'graph3d-topic-dot' }),
      topic.name
    )
    chip.style.setProperty('--topic-color', topic.color)
    chip.addEventListener('click', () => toggleTopic(topic.id))
    container.append(chip)
  }
}

function toggleTopic (id) {
  if (topics.active.has(id)) topics.active.delete(id)
  else topics.active.add(id)
  renderTopicChips()
  applyTopicHighlight()
}

function applyTopicHighlight () {
  if (!graph3d.renderer) return
  if (topics.active.size === 0) {
    graph3d.renderer.clearTopicHighlight()
    return
  }
  // Build a map: nodeId -> color (first topic wins if overlap)
  const nodeColorMap = new Map()
  for (const id of topics.active) {
    const topic = topics.loaded.find(t => t.id === id)
    if (!topic) continue
    const nodeIds = resolveTopicNodeIds(topic)
    for (const nid of nodeIds) {
      if (!nodeColorMap.has(nid)) nodeColorMap.set(nid, topic.color)
    }
  }
  graph3d.renderer.setTopicHighlight(nodeColorMap)
}

$('#graph3d-topics-btn').addEventListener('click', () => {
  topics.visible = !topics.visible
  $('#graph3d-topics').classList.toggle('hidden', !topics.visible)
  $('#graph3d-topics-btn').classList.toggle('active', topics.visible || topics.active.size > 0)
  if (topics.visible && topics.loaded.length === 0) loadTopics()
})

window.addEventListener('resize', () => { fitActive(); updateBrowserBounds() })

;(async function init () {
  sidebar.apply()
  try {
    const [{ root, harnesses, settingsWarnings }, miniapps] = await Promise.all([
      window.hub.listHarnesses(),
      window.hub.listMiniapps(),
      refreshEngines()
    ])
    state.harnesses = harnesses
    state.miniapps = miniapps
    $('#miniapp-count').textContent = `${miniapps.length} instalado${miniapps.length === 1 ? '' : 's'}`
    if (settingsWarnings?.length) toast('Configurações: ' + settingsWarnings.join(' · '))
    $('#harness-root').textContent = root
    $('#harness-root').title = root
  } catch (e) {
    toast(e.message)
  }
  renderHarnessList()
  renderUsage()
  const last = store.get('harness.selected', null)
  if (last && state.harnesses.some(h => h.name === last)) selectHarness(last)
  else showView('empty')
})()
